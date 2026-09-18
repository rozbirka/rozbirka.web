import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ChevronLeft, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  SectionPanel,
  DataTable,
  DeniedState,
  ErrorState,
  EmptyState,
  Field,
  Notice,
  PageBody,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  SkeletonRows,
  StatusPill,
  TextArea,
  TextInput,
} from '@/components/app'
import { normalizeApiProblem } from '@/api/errors'
import { orderStatusPresentation } from './order-labels'
import { cn, plural } from '@/lib/utils'
import {
  customersApi,
  readCustomerPhoneConflict,
  type CustomerPhoneConflict,
  type CustomerSearchItem,
} from '@/api/customers'
import { ordersApi, type OrderDetail, type OrderListItem } from '@/api/orders'
import { partsApi, type PartListItem } from '@/api/parts'
import { useCabinet } from '../CabinetContext'
import type { Permission } from '../access-types'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'

const idFromPath = (path: string) => /\/orders\/([^/]+)/.exec(path)?.[1] ?? null
const errorMessage = (error: unknown) => {
  const problem = normalizeApiProblem(error)
  if (problem.status === 402)
    return 'Функція потребує активної підписки. Поновіть підписку в розділі «Підписка» та спробуйте ще раз.'
  if (problem.kind === 'forbidden')
    return 'У вас немає прав для цієї дії. Попросіть адміністратора розбірки розширити вашу роль.'
  if (problem.kind === 'conflict')
    return 'Замовлення змінилося. Оновіть сторінку та спробуйте ще раз.'
  return problem.message
}
type OrderReplayOperation = 'order-confirm' | 'order-refund'
const isAmbiguousMutationFailure = (error: unknown) => {
  const kind = normalizeApiProblem(error).kind
  return kind === 'network' || kind === 'timeout'
}
const useOrderIdempotencyKeys = () => {
  const keysRef = useRef(
    new Map<OrderReplayOperation, { signature: string; key: string }>(),
  )
  return {
    forPayload(
      tenant: string,
      operation: OrderReplayOperation,
      payload: unknown,
    ) {
      const signature = JSON.stringify([tenant, operation, payload])
      const current = keysRef.current.get(operation)
      if (current?.signature === signature) return current.key
      const key = `${operation}-${crypto.randomUUID()}`
      keysRef.current.set(operation, { signature, key })
      return key
    },
    clear(operation: OrderReplayOperation) {
      keysRef.current.delete(operation)
    },
  }
}

/** One money figure as text: the digits stay bare so columns line up. */
const money = (value: number | null | undefined, currency?: string | null) => {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  return currency ? `${value} ${currency}` : String(value)
}
const lineTotal = (quantity: number, unitPrice: number) => {
  const total = quantity * unitPrice
  return Number.isFinite(total) ? total : null
}
/** `2026-08-28T10:15:00Z` reads as `2026-08-28 10:15`; the machine value stays in `dateTime`. */
/**
 * What the server calls each order event, said in Ukrainian. An event the
 * vocabulary does not know is shown as it came rather than guessed at.
 */
const ORDER_EVENTS: Record<string, string> = {
  created: 'Замовлення створено',
  items_updated: 'Позиції змінено',
  item_updated: 'Позицію змінено',
  notes_updated: 'Нотатки змінено',
  customer_changed: 'Клієнта змінено',
  confirmed: 'Підтверджено',
  payment_accepted: 'Платіж прийнято',
  cancelled: 'Скасовано',
  refunded: 'Кошти повернено',
}

const orderEventTitle = (eventType: string) =>
  ORDER_EVENTS[eventType] ?? eventType

/** Two initials for the avatar chip; a single word gives one. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

const formatTimestamp = (value: string) => {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value)
  return parts ? `${parts[1]} ${parts[2]}` : value
}

/** A titled block of a form or a record: heading, body, one row of actions. */
/** The running figure a block is judged by: label left, digits right. */
function TotalLine({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <span className="text-app-dim text-[13.5px]">{label}</span>
      <span
        className={
          strong
            ? 'text-[16px] font-semibold tabular-nums text-white'
            : 'text-app-muted text-[14px] tabular-nums'
        }
      >
        {value}
      </span>
    </div>
  )
}

export function OrdersScreen({ definition }: CabinetModuleScreenProps) {
  const location = useLocation()
  const id = idFromPath(location.pathname)
  if (location.pathname.endsWith('/new')) {
    const isItemForm = location.pathname.endsWith('/items/new')
    return (
      <OrderForm
        definition={definition}
        orderId={
          isItemForm
            ? idFromPath(location.pathname.replace('/items/new', ''))
            : null
        }
      />
    )
  }
  return id ? (
    <OrderDetailScreen definition={definition} orderId={id} />
  ) : (
    <OrderDirectory definition={definition} />
  )
}

function canMutate(
  definition: CabinetModuleScreenProps['definition'],
  cabinet: ReturnType<typeof useCabinet>,
  permission?: Permission,
) {
  const access =
    cabinet.status === 'ready' && cabinet.snapshot !== null
      ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  const scopedDefinition =
    permission === undefined
      ? definition
      : { ...definition, mutationPermission: permission }
  return (
    evaluateModuleAccess(scopedDefinition, access, 'mutation').kind ===
    'allowed'
  )
}

const canCreateOrder = (
  definition: CabinetModuleScreenProps['definition'],
  cabinet: ReturnType<typeof useCabinet>,
) =>
  canMutate(definition, cabinet) &&
  cabinet.snapshot?.permissions.has('parts.view') === true &&
  cabinet.snapshot.permissions.has('customers.view')

/** Dates arrive as ISO strings; anything unparsable is shown as it came. */
const day = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' }).format(parsed)
}

/** The statuses the list filters by, in the order a sale moves through them. */
const ORDER_STATUS_FILTERS = [
  { value: '', label: 'Усі', dot: 'bg-app-line-2' },
  { value: 'pending', label: 'Очікує', dot: 'bg-state-warn' },
  { value: 'confirmed', label: 'Підтверджено', dot: 'bg-state-ok' },
  { value: 'refunded', label: 'Повернено', dot: 'bg-state-info' },
  { value: 'cancelled', label: 'Скасовано', dot: 'bg-app-muted' },
]

/** Statuses whose money never reached the till. */
const UNPAID_STATUSES = new Set(['cancelled', 'refunded'])

/** A sum that never came back is an em dash — never NaN, never «undefined». */
const orderMoney = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${new Intl.NumberFormat('uk-UA').format(value)} $`
    : '—'

function OrderDirectory({ definition }: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const createAllowed = canCreateOrder(definition, cabinet)
  const [params, setParams] = useSearchParams()
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  /** How many orders sit behind each status chip, under the same search. */
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const search = params.get('q') ?? undefined
  const status = params.get('status') ?? undefined
  const customerId = params.get('customerId') ?? undefined
  const page = Number(params.get('page') ?? 1) || 1
  useEffect(() => {
    const controller = new AbortController()
    void ordersApi
      .list(
        {
          ...(search === undefined ? {} : { search }),
          ...(status === undefined ? {} : { status }),
          ...(customerId === undefined ? {} : { customerId }),
          page,
        },
        { signal: controller.signal },
      )
      .then((result) => {
        setOrders(result.items)
        setTotalPages(result.totalPages)
        setTotal(result.total)
        setError(null)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error))
      })
    return () => controller.abort()
  }, [customerId, page, search, status])

  /* The endpoint reports a total per filter, not a breakdown, so each chip's
     count is its own one-row request under the current search. */
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all(
      ORDER_STATUS_FILTERS.map((option) =>
        ordersApi
          .list(
            {
              ...(search === undefined ? {} : { search }),
              ...(option.value === '' ? {} : { status: option.value }),
              ...(customerId === undefined ? {} : { customerId }),
              page: 1,
              pageSize: 1,
            },
            { signal: controller.signal },
          )
          .then((result) => [option.value, result.total] as const),
      ),
    ).then(
      (pairs) => setCounts(Object.fromEntries(pairs)),
      () => setCounts(null),
    )
    return () => controller.abort()
  }, [customerId, search])

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    next.set('page', '1')
    setParams(next)
  }
  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
  }
  const pageSum = orders
    .filter((order) => !UNPAID_STATUSES.has(order.status))
    .reduce((sum, order) => sum + (order.totalAmount ?? 0), 0)
  const filtered = (search ?? '') !== '' || (status ?? '') !== ''

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full gap-4 px-4 pt-10 pb-16 sm:px-6 md:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[11px] tracking-[0.14em] uppercase">
              Продажі
            </p>
            <h1 className="mt-2.5 text-[38px] leading-none font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              Замовлення
            </h1>
          </div>
          {createAllowed ? (
            <Button
              asChild
              className="min-h-11 px-5.5 text-[15px] font-bold"
              variant="primary"
            >
              <Link to="new">
                <Plus aria-hidden />
                Нове замовлення
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-2.5">
          <SearchInput
            aria-label="Пошук замовлень"
            className="min-h-12.5 text-[15px]"
            onChange={(event) => setParam('q', event.target.value)}
            placeholder="Номер замовлення або покупець"
            value={params.get('q') ?? ''}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div
            aria-label="Статус замовлення"
            className="border-app-line bg-app-raised flex flex-wrap gap-[3px] rounded-xl border p-[3px]"
            role="radiogroup"
          >
            {ORDER_STATUS_FILTERS.map((option) => {
              const active = (status ?? '') === option.value
              return (
                <button
                  aria-checked={active}
                  className={cn(
                    'focus-visible:outline-brand flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[9px] px-3.5 text-[14px] font-semibold',
                    active
                      ? 'text-app-ink bg-white/[0.09]'
                      : 'text-app-muted hover:bg-white/[0.05]',
                  )}
                  key={option.value}
                  onClick={() => setParam('status', option.value)}
                  role="radio"
                  type="button"
                >
                  <span
                    aria-hidden
                    className={cn('size-1.5 rounded-full', option.dot)}
                  />
                  {option.label}
                  {counts === null ? null : (
                    <span className="text-app-muted font-mono text-[12px] font-medium">
                      {counts[option.value] ?? 0}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="flex items-baseline gap-2.5">
            <span className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
              Сума на сторінці
            </span>
            <span className="text-[20px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
              {orderMoney(pageSum)}
            </span>
          </p>
        </div>

        {error === null ? null : <Notice tone="danger">{error}</Notice>}

        <section
          aria-label="Список замовлень"
          className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
        >
          <div
            aria-hidden
            className="border-app-line text-app-dim hidden gap-4 border-b px-6 py-3.5 font-mono text-[10px] tracking-[0.14em] uppercase md:grid md:grid-cols-[7rem_1.4fr_1fr_9.5rem_7.5rem]"
          >
            <span>Замовлення</span>
            <span>Покупець</span>
            <span>Позиції</span>
            <span>Статус</span>
            <span className="text-right">Сума</span>
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 px-6 py-14 text-center">
              <p className="text-[16px] font-bold text-white">
                {filtered ? 'Нічого не знайдено' : 'Замовлень поки немає'}
              </p>
              <p className="text-app-muted text-[14px]">
                {filtered
                  ? 'Спробуйте змінити пошук або статус.'
                  : 'Замовлення зʼявляться тут, щойно ви створите перше.'}
              </p>
              {filtered ? (
                <Button
                  className="text-[13px] font-bold"
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    next.delete('q')
                    next.delete('status')
                    next.set('page', '1')
                    setParams(next)
                  }}
                >
                  Скинути фільтри
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="grid">
              {orders.map((order) => {
                const presentation = orderStatusPresentation(order.status)
                const unpaid = UNPAID_STATUSES.has(order.status)
                return (
                  <li
                    className="border-app-line border-b last:border-0"
                    key={order.id}
                  >
                    <Link
                      className="grid items-center gap-x-4 gap-y-1.5 px-6 py-3.5 hover:bg-white/[0.03] md:grid-cols-[7rem_1.4fr_1fr_9.5rem_7.5rem]"
                      to={order.id}
                    >
                      <span>
                        <span className="text-app-ink block font-mono text-[15px]">
                          #{order.number}
                        </span>
                        <span className="text-app-muted mt-0.5 block text-[12px]">
                          {day(order.createdAt)}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block truncate text-[15px] font-semibold tracking-[-0.01em]',
                            order.customerName === null
                              ? 'text-app-dim'
                              : 'text-white',
                          )}
                        >
                          {order.customerName ?? 'Без покупця'}
                        </span>
                        <span className="text-app-muted mt-0.5 block truncate text-[13px]">
                          {order.paymentAccountNames.length === 0
                            ? 'платежів ще немає'
                            : order.paymentAccountNames.join(', ')}
                        </span>
                      </span>
                      <span className="text-app-muted min-w-0 truncate text-[14px] font-medium">
                        {order.partNames.length === 0
                          ? `${String(order.itemCount)} ${plural(order.itemCount, ['позиція', 'позиції', 'позицій'])}`
                          : order.partNames.join(', ')}
                      </span>
                      <span>
                        <StatusPill tone={presentation.tone}>
                          {presentation.label}
                        </StatusPill>
                      </span>
                      <span
                        className={cn(
                          'text-[16px] font-bold tracking-[-0.01em] tabular-nums md:text-right',
                          unpaid ? 'text-app-dim' : 'text-white',
                        )}
                      >
                        {orderMoney(order.totalAmount)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-6 py-3.5">
            <p className="text-app-muted text-[13px] font-semibold">
              {total} {plural(total, ['замовлення', 'замовлення', 'замовлень'])}
            </p>
            <Pagination
              label="Сторінки замовлень"
              onPage={goToPage}
              page={page}
              totalPages={Math.max(totalPages, 1)}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function OrderForm({
  definition,
  orderId,
}: CabinetModuleScreenProps & { orderId: string | null }) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const mutationsAllowed = canMutate(definition, cabinet)
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const partSearchAllowed =
    cabinet.snapshot?.permissions.has('parts.view') === true
  const customerSearchAllowed =
    !orderId && cabinet.snapshot?.permissions.has('customers.view') === true
  const customerMutationAllowed =
    !orderId && canMutate(definition, cabinet, 'customers.manage')
  const dependenciesAllowed =
    partSearchAllowed && (orderId !== null || customerSearchAllowed)
  const [partId, setPartId] = useState('')
  const [partQuery, setPartQuery] = useState('')
  const [partResults, setPartResults] = useState<PartListItem[]>([])
  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerSearchItem[]>(
    [],
  )
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [customerConflict, setCustomerConflict] =
    useState<CustomerPhoneConflict | null>(null)
  const [customerBusy, setCustomerBusy] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [existingItems, setExistingItems] = useState<
    { partId: string; quantity: number; unitPrice: number }[]
  >([])
  const [existingItemsLoad, setExistingItemsLoad] = useState<{
    orderId: string | null
    status: 'not-needed' | 'loaded' | 'failed'
  }>({ orderId: null, status: 'not-needed' })
  const existingItemsLoadStatus =
    orderId === null
      ? 'not-needed'
      : existingItemsLoad.orderId === orderId
        ? existingItemsLoad.status
        : 'loading'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const q = partQuery.trim()
    if (!partSearchAllowed || !q) return
    const controller = new AbortController()
    void partsApi
      .list({ q, page: 1, pageSize: 10, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setPartResults(result.items)
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError))
      })
    return () => controller.abort()
  }, [partQuery, partSearchAllowed])
  useEffect(() => {
    const q = customerQuery.trim()
    if (!customerSearchAllowed || !q) return
    const controller = new AbortController()
    void customersApi
      .search(q, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setCustomerResults(result)
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError))
      })
    return () => controller.abort()
  }, [customerQuery, customerSearchAllowed])
  useEffect(() => {
    if (!orderId) return
    const controller = new AbortController()
    void ordersApi
      .getById(orderId, { signal: controller.signal })
      .then((order) => {
        if (!controller.signal.aborted) {
          setExistingItems(
            order.items.map(({ partId, quantity, unitPrice }) => ({
              partId,
              quantity,
              unitPrice,
            })),
          )
          setExistingItemsLoad({ orderId, status: 'loaded' })
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setExistingItemsLoad({ orderId, status: 'failed' })
          setError(errorMessage(requestError))
        }
      })
    return () => controller.abort()
  }, [orderId])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (
      busy ||
      !dependenciesAllowed ||
      (orderId !== null && existingItemsLoadStatus !== 'loaded') ||
      !partId ||
      !quantity ||
      !unitPrice
    )
      return
    setBusy(true)
    setError(null)
    try {
      const scope = requireLatestMutation({ quota: orderId === null })
      requireLatestMutation({ permission: 'parts.view', quota: false })
      if (orderId === null) {
        requireLatestMutation({ permission: 'customers.view', quota: false })
      }
      const detail = orderId
        ? await ordersApi.updateItems(
            orderId,
            existingItems.some((item) => item.partId === partId)
              ? existingItems.map((item) =>
                  item.partId === partId
                    ? {
                        ...item,
                        quantity: item.quantity + Number(quantity),
                        unitPrice: Number(unitPrice),
                      }
                    : item,
                )
              : [
                  ...existingItems,
                  {
                    partId,
                    quantity: Number(quantity),
                    unitPrice: Number(unitPrice),
                  },
                ],
          )
        : await ordersApi.create({
            customerId: customerId || null,
            notes: notes || null,
            items: [
              {
                partId,
                quantity: Number(quantity),
                unitPrice: Number(unitPrice),
              },
            ],
          })
      if (scope.signal.aborted) return
      await navigate(`../${detail.id}`, { replace: true })
    } catch (error) {
      setError(errorMessage(error))
      setBusy(false)
    }
  }
  const createCustomerInline = async () => {
    if (customerBusy || !newCustomerName.trim() || !customerMutationAllowed)
      return
    setCustomerBusy(true)
    setError(null)
    setCustomerConflict(null)
    try {
      requireLatestMutation()
      requireLatestMutation({
        permission: 'customers.manage',
        quota: false,
      })
      const scope = requireLatestMutation({
        permission: 'customers.view',
        quota: false,
      })
      const result = await customersApi.create(
        {
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          notes: null,
        },
        { signal: scope.signal },
      )
      if (scope.signal.aborted) return
      setCustomerId(result.customer.id)
      setNewCustomerName('')
      setNewCustomerPhone('')
    } catch (requestError) {
      const conflict = readCustomerPhoneConflict(requestError)
      if (conflict) setCustomerConflict(conflict)
      else setError(errorMessage(requestError))
    } finally {
      setCustomerBusy(false)
    }
  }
  const selectDuplicateCustomer = () => {
    if (!customerConflict?.isActive || !customerMutationAllowed) return
    setCustomerId(customerConflict.customerId)
    setCustomerConflict(null)
    setNewCustomerName('')
    setNewCustomerPhone('')
  }
  const reactivateDuplicateCustomer = async () => {
    if (
      !customerConflict ||
      customerConflict.isActive ||
      customerBusy ||
      !customerMutationAllowed
    )
      return
    setCustomerBusy(true)
    setError(null)
    try {
      requireLatestMutation({ quota: false })
      requireLatestMutation({
        permission: 'customers.manage',
        quota: false,
      })
      const scope = requireLatestMutation({
        permission: 'customers.view',
        quota: false,
      })
      const customer = await customersApi.activate(
        customerConflict.customerId,
        {
          signal: scope.signal,
        },
      )
      if (scope.signal.aborted) return
      setCustomerId(customer.id)
      setCustomerConflict(null)
      setNewCustomerName('')
      setNewCustomerPhone('')
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setCustomerBusy(false)
    }
  }
  if (!dependenciesAllowed) {
    return (
      <PageBody width="narrow">
        <DeniedState
          description="Потрібен доступ до запчастин і клієнтів. Попросіть адміністратора розбірки відкрити ці розділи для вашої ролі."
          role="alert"
          title="Замовлення недоступні для створення"
        />
      </PageBody>
    )
  }
  const selectedPart = partResults.find((part) => part.id === partId)
  const selectedCustomer = customerResults.find(
    (customer) => customer.id === customerId,
  )
  const draftLineTotal =
    quantity && unitPrice
      ? lineTotal(Number(quantity), Number(unitPrice))
      : null
  const existingTotal = existingItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  const backPath = orderId
    ? location.pathname.replace(/\/items\/new$/, '')
    : location.pathname.replace(/\/new$/, '')
  const submitBlocked =
    !mutationsAllowed ||
    busy ||
    (orderId !== null && existingItemsLoadStatus !== 'loaded') ||
    !partId ||
    !quantity ||
    !unitPrice
  return (
    <PageBody width="narrow">
      <PageHeader
        eyebrow={orderId ? 'Продажі · Замовлення' : 'Продажі'}
        title={orderId ? 'Додати позицію' : 'Створити замовлення'}
      />
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        {error && <Notice tone="danger">{error}</Notice>}
        <SectionPanel
          description={
            orderId
              ? 'Знайдіть запчастину, вкажіть кількість і ціну — позиція долучиться до наявних у замовленні.'
              : 'Замовлення створюється з однією позицією. Решту можна додати на сторінці замовлення.'
          }
          title="Позиція"
        >
          <div className="grid gap-3">
            {partSearchAllowed && (
              <div className="grid gap-2">
                <Field
                  hint="Введіть назву — знайдені запчастини з’являться нижче."
                  label="Пошук запчастини"
                >
                  <SearchInput
                    onChange={(event) => setPartQuery(event.target.value)}
                    value={partQuery}
                  />
                </Field>
                {partQuery.trim() && partResults.length > 0 && (
                  <ul className="grid gap-1.5">
                    {partResults.map((part) => (
                      <li key={part.id}>
                        <Button
                          aria-label={`Обрати запчастину ${part.name}`}
                          className={
                            part.id === partId
                              ? 'border-brand/40 bg-brand/[0.1] w-full justify-between'
                              : 'w-full justify-between'
                          }
                          onClick={() => setPartId(part.id)}
                        >
                          <span className="min-w-0 truncate">{part.name}</span>
                          <span className="text-app-dim text-[13px] tabular-nums">
                            {part.quantityAvailable} шт
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Field
              hint={
                selectedPart
                  ? `Обрано ${selectedPart.name}`
                  : 'Заповнюється автоматично, коли ви обираєте запчастину в пошуку.'
              }
              label="ID запчастини"
            >
              <TextInput
                onChange={(event) => setPartId(event.target.value)}
                value={partId}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Кількість">
                <TextInput
                  className="text-right"
                  inputMode="numeric"
                  onChange={(event) => setQuantity(event.target.value)}
                  value={quantity}
                />
              </Field>
              <Field label="Ціна за одиницю">
                <TextInput
                  className="text-right"
                  inputMode="decimal"
                  onChange={(event) => setUnitPrice(event.target.value)}
                  value={unitPrice}
                />
              </Field>
            </div>
          </div>
        </SectionPanel>
        {customerSearchAllowed && (
          <SectionPanel
            description="Замовлення можна створити й без клієнта — тоді поле лишається порожнім."
            title="Клієнт"
          >
            <div className="grid gap-3">
              <Field
                hint={
                  selectedCustomer
                    ? `Обрано ${selectedCustomer.name}`
                    : customerId
                      ? `Обрано клієнта ${customerId}`
                      : 'Клієнта не обрано'
                }
                label="Пошук клієнта"
              >
                <SearchInput
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  value={customerQuery}
                />
              </Field>
              {customerQuery.trim() && customerResults.length > 0 && (
                <ul className="grid gap-1.5">
                  {customerResults.map((customer) => (
                    <li key={customer.id}>
                      <Button
                        aria-label={`Обрати клієнта ${customer.name}`}
                        className={
                          customer.id === customerId
                            ? 'border-brand/40 bg-brand/[0.1] w-full justify-between'
                            : 'w-full justify-between'
                        }
                        onClick={() => setCustomerId(customer.id)}
                      >
                        <span className="min-w-0 truncate">
                          {customer.name}
                        </span>
                        <span className="text-app-dim text-[13px]">
                          {customer.phone ?? 'без телефону'}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {customerMutationAllowed && (
                <fieldset className="border-app-line-2 rounded-control grid gap-3 border border-dashed p-3">
                  <legend className="text-app-muted px-1 text-[13.5px]">
                    Новий клієнт
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Ім’я нового клієнта">
                      <TextInput
                        onChange={(event) =>
                          setNewCustomerName(event.target.value)
                        }
                        value={newCustomerName}
                      />
                    </Field>
                    <Field label="Телефон нового клієнта">
                      <TextInput
                        inputMode="tel"
                        onChange={(event) =>
                          setNewCustomerPhone(event.target.value)
                        }
                        value={newCustomerPhone}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      aria-busy={customerBusy}
                      disabled={customerBusy || !newCustomerName.trim()}
                      onClick={() => void createCustomerInline()}
                    >
                      {customerBusy ? 'Створюємо клієнта…' : 'Створити клієнта'}
                    </Button>
                  </div>
                </fieldset>
              )}
              {customerConflict && (
                <Notice
                  action={
                    customerConflict.isActive ? (
                      <Button
                        onClick={selectDuplicateCustomer}
                        variant="primary"
                      >
                        Використати клієнта {customerConflict.customerName}
                      </Button>
                    ) : (
                      <Button
                        disabled={customerBusy}
                        onClick={() => void reactivateDuplicateCustomer()}
                        variant="primary"
                      >
                        Активувати {customerConflict.customerName}
                      </Button>
                    )
                  }
                  className="flex-wrap"
                  role="alert"
                  tone="warn"
                >
                  {customerConflict.message}
                </Notice>
              )}
            </div>
          </SectionPanel>
        )}
        {orderId === null && (
          <SectionPanel title="Нотатки">
            <div>
              <Field
                hint="Видно команді розбірки на сторінці замовлення."
                label="Нотатки"
              >
                <TextArea
                  onChange={(event) => setNotes(event.target.value)}
                  value={notes}
                />
              </Field>
            </div>
          </SectionPanel>
        )}
        <Panel>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="grid min-w-0 gap-1">
              {orderId !== null && (
                <TotalLine
                  label="Уже в замовленні"
                  value={
                    existingItemsLoadStatus === 'loaded'
                      ? money(existingTotal)
                      : '—'
                  }
                />
              )}
              <TotalLine
                label={orderId ? 'Разом за позицію' : 'Разом за замовлення'}
                strong
                value={money(draftLineTotal)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="quiet">
                <Link to={backPath}>
                  {orderId ? 'До замовлення' : 'До списку замовлень'}
                </Link>
              </Button>
              <Button
                aria-busy={busy || existingItemsLoadStatus === 'loading'}
                disabled={submitBlocked}
                type="submit"
                variant="primary"
              >
                {busy
                  ? orderId
                    ? 'Додаємо…'
                    : 'Створюємо…'
                  : orderId
                    ? 'Додати позицію'
                    : 'Створити замовлення'}
              </Button>
            </div>
          </div>
        </Panel>
      </form>
    </PageBody>
  )
}

function OrderDetailScreen({
  definition,
  orderId,
}: CabinetModuleScreenProps & { orderId: string }) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const replayKeys = useOrderIdempotencyKeys()
  const location = useLocation()
  const mutationsAllowed = canMutate(definition, cabinet)
  const financeAllowed =
    mutationsAllowed &&
    cabinet.snapshot?.permissions.has('finance.manage') === true
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [itemDrafts, setItemDrafts] = useState<OrderDetail['items']>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [rawHistory, setRawHistory] = useState(false)
  const [draftNotes, setDraftNotes] = useState('')
  const [draftCustomerId, setDraftCustomerId] = useState('')
  const [paymentDrafts, setPaymentDrafts] = useState([
    { accountId: '', amount: '', currency: '' },
  ])
  const acceptOrder = useCallback((detail: OrderDetail) => {
    setOrder(detail)
    setItemDrafts(detail.items)
    setDraftNotes(detail.notes ?? '')
    setDraftCustomerId(detail.customerId ?? '')
  }, [])
  const reload = useCallback(
    (signal?: AbortSignal) =>
      ordersApi
        .getById(orderId, signal ? { signal } : {})
        .then((detail) => {
          if (!signal?.aborted) {
            acceptOrder(detail)
            setError(null)
          }
        })
        .catch((error) => {
          if (!signal?.aborted) setError(errorMessage(error))
        }),
    [acceptOrder, orderId],
  )
  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    return () => controller.abort()
  }, [reload])
  const transition = async (
    action: (idempotencyKey?: string) => Promise<OrderDetail>,
    replay?: { operation: OrderReplayOperation; payload: unknown },
    permission?: Permission,
  ) => {
    if (busy) return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      if (permission) {
        requireLatestMutation({ permission, quota: false })
      }
      const replayKey = replay
        ? replayKeys.forPayload(
            scope.tenantId,
            replay.operation,
            replay.payload,
          )
        : undefined
      const updated = await action(replayKey)
      if (replay) replayKeys.clear(replay.operation)
      if (scope.signal.aborted) return
      acceptOrder(updated)
      setError(null)
    } catch (error) {
      if (replay && !isAmbiguousMutationFailure(error))
        replayKeys.clear(replay.operation)
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  if (error && !order)
    return (
      <PageBody width="narrow">
        <ErrorState
          description={error}
          onRetry={() => void reload()}
          title="Не вдалося завантажити замовлення"
        />
      </PageBody>
    )
  if (!order)
    return (
      <PageBody width="narrow">
        <SkeletonRows label="Завантажуємо замовлення…" rows={4} />
      </PageBody>
    )
  const status = orderStatusPresentation(order.status)
  const currency = order.paymentCurrency
  const itemsEditable = mutationsAllowed && order.status === 'pending'
  const draftsTotal = itemDrafts.reduce((sum, item) => {
    const total = lineTotal(item.quantity, item.unitPrice)
    return total === null ? sum : sum + total
  }, 0)
  const paymentsTotal = paymentDrafts.reduce((sum, payment) => {
    const amount = Number(payment.amount)
    return payment.amount && Number.isFinite(amount) ? sum + amount : sum
  }, 0)
  const outstanding =
    order.totalAmount === null || order.totalPaid === null
      ? null
      : order.totalAmount - order.totalPaid
  const ordersPath = location.pathname.replace(/\/orders\/.*$/, '/orders')
  const customerPath =
    order.customerId === null
      ? null
      : `${location.pathname.replace(/\/orders\/.*$/, '')}/customers/${order.customerId}`
  const historyRows = order.history.map((entry, index) => ({
    ...entry,
    key: `${entry.createdAt}-${entry.eventType}-${entry.userName}-${index}`,
  }))
  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={ordersPath}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            До замовлень
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Продажі</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span className="text-app-muted">Замовлення</span>
          </p>
        </div>
        {itemsEditable || (financeAllowed && order.status === 'confirmed') ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              aria-expanded={menuOpen}
              aria-label="Інші дії із замовленням"
              className="min-w-11 px-0"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              Замовлення #{order.number}
            </h1>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            <p className="text-app-muted text-sm">
              Створено {formatTimestamp(order.createdAt)} ·{' '}
              {order.createdByName}
            </p>
          </div>
        </div>

        {menuOpen ? (
          <div
            aria-label="Інші дії із замовленням"
            className="border-app-line bg-app-raised flex flex-wrap items-center gap-2.5 rounded-[14px] border px-4 py-3"
            role="group"
          >
            {itemsEditable ? (
              <Button
                disabled={busy}
                onClick={() =>
                  void transition(() => ordersApi.cancel(order.id))
                }
              >
                Скасувати замовлення
              </Button>
            ) : null}
            {financeAllowed && order.status === 'confirmed' ? (
              <Button
                onClick={() => setRefundOpen((open) => !open)}
                variant="danger"
              >
                Повернути кошти
              </Button>
            ) : null}
          </div>
        ) : null}

        {refundOpen && financeAllowed && order.status === 'confirmed' ? (
          <section
            aria-label="Повернення коштів"
            className="border-state-danger/30 bg-app-raised rounded-[16px] border px-6 pt-5 pb-6"
          >
            <h2 className="text-base font-bold text-white">
              Повернути кошти клієнту
            </h2>
            <p className="text-app-muted mt-1.5 text-sm leading-[1.5]">
              Замовлення перейде у статус «Повернено». Дію не можна скасувати,
              причина потрапляє в історію.
            </p>
            <form
              className="mt-3.5 grid gap-3.5"
              onSubmit={(event) => {
                event.preventDefault()
                const input = { refundReason }
                void transition(
                  (idempotencyKey) =>
                    ordersApi.refund(order.id, input, {
                      idempotencyKey: idempotencyKey!,
                    }),
                  {
                    operation: 'order-refund',
                    payload: { orderId: order.id, input },
                  },
                  'finance.manage',
                )
              }}
            >
              <Field
                hint="Причина потрапляє в історію замовлення."
                label="Причина повернення"
              >
                <TextInput
                  onChange={(event) => setRefundReason(event.target.value)}
                  value={refundReason}
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2.5">
                <Button onClick={() => setRefundOpen(false)} type="button">
                  Скасувати
                </Button>
                <Button
                  disabled={busy || !refundReason}
                  type="submit"
                  variant="danger"
                >
                  Повернути кошти
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        {error && <Notice tone="danger">{error}</Notice>}

        <div className="flex flex-wrap-reverse items-end gap-6">
          <div className="grid min-w-[320px] flex-[1_1_560px] gap-5">
            {itemsEditable ? (
              <SectionPanel
                aside={
                  <span className="text-app-muted text-[13.5px] tabular-nums">
                    Разом за позиціями {money(draftsTotal, currency)}
                  </span>
                }
                description={
                  itemDrafts.length === 1
                    ? 'Видалення останньої позиції скасує замовлення.'
                    : 'Змініть кількість або ціну й збережіть позиції — набір замінюється цілком.'
                }
                footer={
                  <>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void transition(() =>
                          ordersApi.updateItems(
                            order.id,
                            itemDrafts.map(
                              ({ partId, quantity, unitPrice }) => ({
                                partId,
                                quantity,
                                unitPrice,
                              }),
                            ),
                          ),
                        )
                      }
                      variant="primary"
                    >
                      Зберегти позиції
                    </Button>
                    <Button asChild variant="ghost">
                      <Link to={`${location.pathname}/items/new`}>
                        <Plus aria-hidden />
                        Додати позицію
                      </Link>
                    </Button>
                  </>
                }
                title="Позиції"
              >
                {itemDrafts.length === 0 && (
                  <p className="text-app-muted px-4 py-3 text-sm">
                    Позицій немає. Додайте запчастину, щоб замовлення можна було
                    підтвердити.
                  </p>
                )}
                <ul>
                  {itemDrafts.map((item, index) => (
                    <li
                      className="border-app-line grid gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                      key={item.id}
                    >
                      <div className="min-w-0">
                        <p className="text-app-ink truncate text-sm font-medium">
                          {item.partName}
                        </p>
                        <p className="text-app-dim mt-0.5 text-[12.5px] tabular-nums">
                          Сума позиції{' '}
                          {money(
                            lineTotal(item.quantity, item.unitPrice),
                            currency,
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="grid w-20 gap-1.5">
                          <span
                            aria-hidden
                            className="text-app-dim text-[12.5px]"
                          >
                            Кількість
                          </span>
                          <TextInput
                            aria-label={`Кількість ${item.partName}`}
                            className="text-right"
                            inputMode="numeric"
                            onChange={(event) =>
                              setItemDrafts((current) =>
                                current.map((draft, draftIndex) =>
                                  draftIndex === index
                                    ? {
                                        ...draft,
                                        quantity: Number(event.target.value),
                                      }
                                    : draft,
                                ),
                              )
                            }
                            value={item.quantity}
                          />
                        </div>
                        <div className="grid w-28 gap-1.5">
                          <span
                            aria-hidden
                            className="text-app-dim text-[12.5px]"
                          >
                            Ціна
                          </span>
                          <TextInput
                            aria-label={`Ціна ${item.partName}`}
                            className="text-right"
                            inputMode="decimal"
                            onChange={(event) =>
                              setItemDrafts((current) =>
                                current.map((draft, draftIndex) =>
                                  draftIndex === index
                                    ? {
                                        ...draft,
                                        unitPrice: Number(event.target.value),
                                      }
                                    : draft,
                                ),
                              )
                            }
                            value={item.unitPrice}
                          />
                        </div>
                        <Button
                          aria-label={`Видалити ${item.partName}`}
                          disabled={busy}
                          onClick={() =>
                            void transition(() =>
                              itemDrafts.length === 1
                                ? ordersApi.cancel(order.id)
                                : ordersApi.updateItems(
                                    order.id,
                                    itemDrafts
                                      .filter(
                                        (_, draftIndex) => draftIndex !== index,
                                      )
                                      .map(
                                        ({ partId, quantity, unitPrice }) => ({
                                          partId,
                                          quantity,
                                          unitPrice,
                                        }),
                                      ),
                                  ),
                            )
                          }
                          size="icon"
                          variant="danger"
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionPanel>
            ) : (
              <Card
                aside={
                  <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                    {order.items.length}{' '}
                    {plural(order.items.length, [
                      'позиція',
                      'позиції',
                      'позицій',
                    ])}
                  </span>
                }
                bodyClassName="p-0"
                title="Позиції"
              >
                <DataTable
                  caption="Позиції замовлення"
                  columns={[
                    {
                      key: 'part',
                      label: 'Позиція',
                      variant: 'primary',
                      cell: (item) => item.partName,
                    },
                    {
                      key: 'quantity',
                      label: 'К-сть',
                      align: 'end',
                      cell: (item) => item.quantity,
                    },
                    {
                      key: 'unitPrice',
                      label: 'Ціна',
                      align: 'end',
                      cell: (item) => money(item.unitPrice, currency),
                    },
                    {
                      key: 'totalPrice',
                      label: 'Сума',
                      align: 'end',
                      cell: (item) => (
                        <span className="font-bold text-white">
                          {money(item.totalPrice, currency)}
                        </span>
                      ),
                    },
                  ]}
                  empty={
                    <EmptyState
                      description="У цьому замовленні немає жодної запчастини."
                      title="Позицій немає"
                    />
                  }
                  footer={
                    <div className="border-app-line flex flex-wrap items-baseline justify-end gap-5 border-t px-6 py-4">
                      <span className="text-app-muted text-sm font-semibold">
                        Разом
                      </span>
                      <span className="text-[20px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
                        {money(order.totalAmount, currency)}
                      </span>
                    </div>
                  }
                  rowKey={(item) => item.id}
                  rows={order.items}
                />
              </Card>
            )}

            {financeAllowed && order.status === 'pending' && (
              <SectionPanel
                description="Підтвердження фіксує оплату й переводить замовлення у статус «Підтверджено»."
                footer={
                  <>
                    <Button
                      disabled={
                        busy ||
                        paymentDrafts.some(
                          (payment) =>
                            !payment.accountId ||
                            !payment.amount ||
                            !payment.currency,
                        )
                      }
                      onClick={() => {
                        const input = {
                          payments: paymentDrafts.map((payment) => ({
                            accountId: payment.accountId,
                            amount: Number(payment.amount),
                            currency: payment.currency,
                          })),
                        }
                        void transition(
                          (idempotencyKey) =>
                            ordersApi.confirm(order.id, input, {
                              idempotencyKey: idempotencyKey!,
                            }),
                          {
                            operation: 'order-confirm',
                            payload: { orderId: order.id, input },
                          },
                          'finance.manage',
                        )
                      }}
                      variant="primary"
                    >
                      Підтвердити
                    </Button>
                    <Button
                      onClick={() =>
                        setPaymentDrafts((current) => [
                          ...current,
                          { accountId: '', amount: '', currency: '' },
                        ])
                      }
                    >
                      <Plus aria-hidden />
                      Додати платіж
                    </Button>
                  </>
                }
                title="Оплата й підтвердження"
              >
                <div className="grid gap-3">
                  {paymentDrafts.map((payment, index) => {
                    const suffix = index === 0 ? '' : ` ${index + 1}`
                    const updatePayment = (
                      field: 'accountId' | 'amount' | 'currency',
                      value: string,
                    ) =>
                      setPaymentDrafts((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, [field]: value }
                            : item,
                        ),
                      )
                    return (
                      <fieldset
                        className="border-app-line-2 rounded-control grid gap-3 border border-dashed p-3"
                        key={index}
                      >
                        <legend className="text-app-muted px-1 text-[13.5px]">
                          Платіж {index + 1}
                        </legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label={`ID рахунку${suffix}`}>
                            <TextInput
                              onChange={(event) =>
                                updatePayment('accountId', event.target.value)
                              }
                              value={payment.accountId}
                            />
                          </Field>
                          <Field label={`Сума платежу${suffix}`}>
                            <TextInput
                              className="text-right"
                              inputMode="decimal"
                              onChange={(event) =>
                                updatePayment('amount', event.target.value)
                              }
                              value={payment.amount}
                            />
                          </Field>
                          <Field label={`Валюта платежу${suffix}`}>
                            <TextInput
                              onChange={(event) =>
                                updatePayment('currency', event.target.value)
                              }
                              value={payment.currency}
                            />
                          </Field>
                        </div>
                        {paymentDrafts.length > 1 && (
                          <div className="flex flex-wrap">
                            <Button
                              onClick={() =>
                                setPaymentDrafts((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                              variant="quiet"
                            >
                              Прибрати платіж {index + 1}
                            </Button>
                          </div>
                        )}
                      </fieldset>
                    )
                  })}
                  <div className="grid gap-1">
                    <TotalLine
                      label="Сума платежів"
                      strong
                      value={money(paymentsTotal, currency)}
                    />
                    <TotalLine
                      label="Разом за замовленням"
                      value={money(order.totalAmount, currency)}
                    />
                  </div>
                </div>
              </SectionPanel>
            )}

            <Card
              aside={
                <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                  {order.payments.length}{' '}
                  {plural(order.payments.length, [
                    'платіж',
                    'платежі',
                    'платежів',
                  ])}
                </span>
              }
              bodyClassName="p-0"
              title="Платежі"
            >
              <DataTable
                caption="Платежі замовлення"
                columns={[
                  {
                    key: 'account',
                    label: 'Рахунок',
                    variant: 'primary',
                    cell: (payment) => payment.accountName,
                  },
                  {
                    key: 'amount',
                    label: 'Сума',
                    align: 'end',
                    cell: (payment) => (
                      <span className="font-bold text-white">
                        {payment.amount} {payment.currency}
                      </span>
                    ),
                  },
                ]}
                empty={
                  <EmptyState
                    description="Платежі з’являться тут після підтвердження замовлення."
                    title="Платежів немає"
                  />
                }
                rowKey={(payment) => payment.id}
                rows={order.payments}
              />
            </Card>

            <Card title="Нотатки">
              {itemsEditable ? (
                <div className="grid gap-3">
                  <Field label="Нотатки замовлення">
                    <TextArea
                      onChange={(event) => setDraftNotes(event.target.value)}
                      value={draftNotes}
                    />
                  </Field>
                  <div className="flex flex-wrap items-end gap-2.5">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void transition(() =>
                          ordersApi.updateNotes(order.id, draftNotes),
                        )
                      }
                    >
                      Зберегти нотатки
                    </Button>
                  </div>
                  <Field
                    className="min-w-52"
                    hint="Порожнє поле відв’яже клієнта від замовлення."
                    label="ID клієнта замовлення"
                  >
                    <TextInput
                      onChange={(event) =>
                        setDraftCustomerId(event.target.value)
                      }
                      value={draftCustomerId}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void transition(() =>
                          ordersApi.setCustomer(
                            order.id,
                            draftCustomerId || null,
                          ),
                        )
                      }
                    >
                      Зберегти клієнта
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-app-ink text-[15px] leading-[1.55] whitespace-pre-line">
                  {order.notes === null || order.notes === ''
                    ? 'Нотаток немає.'
                    : order.notes}
                </p>
              )}
            </Card>
          </div>

          <aside className="sticky top-24 grid min-w-[300px] flex-[0_1_340px] gap-5">
            <Card title="Оплата">
              <p className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-white tabular-nums">
                  {money(order.totalAmount, currency)}
                </span>
                <span
                  className={cn(
                    'text-[13px] font-bold',
                    outstanding === null
                      ? 'text-app-dim'
                      : outstanding > 0
                        ? 'text-state-warn'
                        : 'text-state-ok',
                  )}
                >
                  {outstanding === null
                    ? 'Сума не відома'
                    : outstanding > 0
                      ? `Залишок ${money(outstanding, currency)}`
                      : 'Оплачено повністю'}
                </span>
              </p>
              <dl className="border-app-line mt-4.5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5 border-t pt-4">
                <dt className="text-app-muted text-sm font-semibold">Клієнт</dt>
                <dd className="text-sm text-white">
                  {order.customerName ?? 'Без клієнта'}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">Разом</dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {money(order.totalAmount, currency)}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">
                  Сплачено
                </dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {money(order.totalPaid, currency)}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">
                  Залишок
                </dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {money(outstanding, currency)}
                </dd>
              </dl>
            </Card>

            {order.customerId === null ? null : (
              <Card bodyClassName="px-6 pt-4 pb-5" title="Клієнт">
                <Link
                  className="hover:text-brand flex items-center gap-3.5"
                  to={customerPath ?? '#'}
                >
                  <span className="bg-brand/15 text-brand grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold">
                    {initials(order.customerName ?? '—')}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[17px] font-bold tracking-[-0.015em] text-white">
                      {order.customerName ?? 'Без імені'}
                    </span>
                    <span className="text-app-muted mt-0.5 block font-mono text-[12px]">
                      картка клієнта
                    </span>
                  </span>
                </Link>
              </Card>
            )}

            <Card
              aside={
                <Button
                  aria-pressed={rawHistory}
                  className="min-h-8 px-2.5 text-xs font-semibold"
                  onClick={() => setRawHistory((value) => !value)}
                >
                  {rawHistory ? 'Сховати дані' : 'Технічні дані'}
                </Button>
              }
              title="Історія"
            >
              {historyRows.length === 0 ? (
                <p className="text-app-muted text-sm">
                  Дії із замовленням зʼявляться тут одразу після збереження.
                </p>
              ) : (
                <ol aria-label="Історія замовлення" className="grid">
                  {historyRows.map((entry, index) => (
                    <li className="flex gap-3.5" key={entry.key}>
                      <span aria-hidden className="flex flex-col items-center">
                        <span className="bg-app-muted mt-1.5 size-2.5 rounded-full" />
                        {index < historyRows.length - 1 ? (
                          <span className="bg-app-line w-px flex-1" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 pb-5">
                        <span className="block text-[15px] font-bold text-white">
                          {orderEventTitle(entry.eventType)}
                        </span>
                        <span className="text-app-muted mt-1 block text-[13px]">
                          {entry.userName} ·{' '}
                          <time dateTime={entry.createdAt}>
                            {formatTimestamp(entry.createdAt)}
                          </time>
                        </span>
                        {rawHistory && entry.data ? (
                          <span className="border-app-line bg-app-input text-app-muted mt-2 block rounded-[9px] border px-3 py-2.5 font-mono text-[11px] leading-[1.5] break-all">
                            {entry.data}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
