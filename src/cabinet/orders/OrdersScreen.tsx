import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  ChevronLeft,
  CreditCard,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
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
  QuantityStepper,
  SearchInput,
  SkeletonRows,
  StatusPill,
  TextArea,
  TextInput,
  useOptionalToast,
} from '@/components/app'
import { normalizeApiProblem } from '@/api/errors'
import { orderStatusPresentation } from './order-labels'
import { DeliverySection } from './delivery/DeliverySection'
import { cn, plural } from '@/lib/utils'
import {
  customersApi,
  readCustomerPhoneConflict,
  type CustomerPhoneConflict,
  type CustomerSearchItem,
} from '@/api/customers'
import { ordersApi, type OrderDetail, type OrderListItem } from '@/api/orders'
import {
  PartSearchPicker,
  type PartPickerItem,
} from '@/components/parts/PartSearchPicker'
import { useCabinet } from '../CabinetContext'
import type { Permission } from '../access-types'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  newCustomerPhoneDraft,
  normalizeCustomerPhoneDraft,
} from '../customers/customer-phone'
import { OrderPaymentDialog } from './OrderPaymentDialog'
import { OrderCreateDrawer } from './OrderCreateDrawer'

const idFromPath = (path: string) => /\/orders\/([^/]+)/.exec(path)?.[1] ?? null
const errorMessage = (error: unknown) => {
  const problem = normalizeApiProblem(error)
  if (problem.status === 402)
    return 'Функція потребує активної підписки. Поновіть підписку в розділі «Підписка» та спробуйте ще раз.'
  if (problem.kind === 'forbidden')
    return 'У вас немає прав для цієї дії. Попросіть адміністратора розбірки розширити вашу роль.'
  if (problem.code === 'PARTS_NOT_AVAILABLE')
    return 'Недостатньо доступних запчастин для вказаної кількості.'
  if (problem.code === 'PART_IN_ACTIVE_INVENTORY')
    return 'Запчастина зараз бере участь в інвентаризації. Завершіть інвентаризацію та спробуйте ще раз.'
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
  if (!currency) return String(value)
  try {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value} ${currency}`
  }
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
  itemsupdated: 'Позиції оновлено',
  itemupdated: 'Позицію оновлено',
  notesupdated: 'Нотатки оновлено',
  customerset: 'Клієнта змінено',
  customerchanged: 'Клієнта змінено',
  confirmed: 'Замовлення підтверджено',
  paymentaccepted: 'Платіж прийнято',
  cancelled: 'Замовлення скасовано',
  refunded: 'Кошти повернено',
}

const orderEventTitle = (eventType: string) =>
  ORDER_EVENTS[eventType.toLowerCase().replace(/[^a-z0-9]/g, '')] ??
  'Замовлення оновлено'

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
    if (!isItemForm)
      return (
        <>
          <OrderDirectory definition={definition} />
          <OrderForm definition={definition} orderId={null} />
        </>
      )
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

const orderMoney = (value: number | null) =>
  value === null ? '—' : `${new Intl.NumberFormat('uk-UA').format(value)} $`

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

export function OrderForm({
  createContext,
  definition,
  orderId,
}: CabinetModuleScreenProps & {
  orderId: string | null
  createContext?: {
    customer: { id: string; name: string }
    onClose: () => void
    orderBasePath: string
  }
}) {
  const cabinet = useCabinet()
  const toast = useOptionalToast()
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
  const [customerId, setCustomerId] = useState(
    createContext?.customer.id ?? params.get('customerId') ?? '',
  )
  const [customerQuery, setCustomerQuery] = useState(
    createContext?.customer.name ?? '',
  )
  const [selectedCustomerName, setSelectedCustomerName] = useState(
    createContext?.customer.name ?? '',
  )
  const [customerResults, setCustomerResults] = useState<CustomerSearchItem[]>(
    [],
  )
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const customerPickerRef = useRef<HTMLDivElement>(null)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerFormOpen, setNewCustomerFormOpen] = useState(false)
  const [newCustomerPhone, setNewCustomerPhone] = useState(
    newCustomerPhoneDraft,
  )
  const [customerConflict, setCustomerConflict] =
    useState<CustomerPhoneConflict | null>(null)
  const [customerBusy, setCustomerBusy] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [existingItems, setExistingItems] = useState<
    { partId: string; quantity: number; unitPrice: number }[]
  >([])
  const [draftItems, setDraftItems] = useState<
    {
      part: PartPickerItem
      quantity: number
      unitPrice: number
    }[]
  >([])
  const [selectedPartDraft, setSelectedPartDraft] =
    useState<PartPickerItem | null>(null)
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
  const linkedCustomerId =
    orderId === null
      ? (createContext?.customer.id ?? params.get('customerId'))
      : null
  useEffect(() => {
    if (!linkedCustomerId || !customerSearchAllowed || createContext) return
    const controller = new AbortController()
    void customersApi
      .getById(linkedCustomerId, { signal: controller.signal })
      .then((customer) => {
        if (controller.signal.aborted) return
        setCustomerId(customer.id)
        setSelectedCustomerName(customer.name)
        setCustomerQuery(customer.name)
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError))
      })
    return () => controller.abort()
  }, [createContext, customerSearchAllowed, linkedCustomerId])
  useEffect(() => {
    const closePickers = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!customerPickerRef.current?.contains(target))
        setCustomerPickerOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setCustomerPickerOpen(false)
    }
    document.addEventListener('pointerdown', closePickers)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closePickers)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])
  useEffect(() => {
    const q = customerQuery.trim()
    if (!customerSearchAllowed || !q || customerId) return
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
  }, [customerId, customerQuery, customerSearchAllowed])
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
    const directItem =
      partId && quantity && unitPrice
        ? {
            partId,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
          }
        : null
    const creationItems =
      draftItems.length > 0
        ? draftItems.map((item) => ({
            partId: item.part.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        : directItem
          ? [directItem]
          : []
    if (
      busy ||
      !dependenciesAllowed ||
      (orderId !== null && existingItemsLoadStatus !== 'loaded') ||
      (orderId !== null && !directItem) ||
      (orderId === null && creationItems.length === 0)
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
            items: creationItems,
          })
      if (scope.signal.aborted) return
      const detailPath = orderId
        ? location.pathname.replace(/\/items\/new$/, '')
        : `${createContext?.orderBasePath ?? location.pathname.replace(/\/new$/, '')}/${detail.id}`
      if (orderId === null) {
        toast?.show({ message: 'Замовлення створено.', tone: 'ok' })
      }
      await navigate(detailPath, { replace: true })
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
          phone:
            newCustomerPhone.trim() === newCustomerPhoneDraft()
              ? null
              : newCustomerPhone.trim() || null,
          notes: null,
        },
        { signal: scope.signal },
      )
      if (scope.signal.aborted) return
      setCustomerId(result.customer.id)
      setSelectedCustomerName(result.customer.name)
      setCustomerQuery(result.customer.name)
      setNewCustomerName('')
      setNewCustomerPhone(newCustomerPhoneDraft())
      setNewCustomerFormOpen(false)
      setCustomerPickerOpen(false)
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
    setSelectedCustomerName(customerConflict.customerName)
    setCustomerQuery(customerConflict.customerName)
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
      setSelectedCustomerName(customer.name)
      setCustomerQuery(customer.name)
      setCustomerConflict(null)
      setNewCustomerName('')
      setNewCustomerPhone('')
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setCustomerBusy(false)
    }
  }
  const addDraftItem = () => {
    if (orderId !== null || !selectedPartDraft || !quantity || !unitPrice)
      return
    const parsedQuantity = Number(quantity)
    const parsedUnitPrice = Number(unitPrice)
    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      !Number.isFinite(parsedUnitPrice) ||
      parsedUnitPrice < 0
    )
      return
    setDraftItems((current) => {
      const existing = current.find(
        (item) => item.part.id === selectedPartDraft.id,
      )
      if (!existing)
        return [
          ...current,
          {
            part: selectedPartDraft,
            quantity: parsedQuantity,
            unitPrice: parsedUnitPrice,
          },
        ]
      return current.map((item) =>
        item.part.id === selectedPartDraft.id
          ? {
              ...item,
              quantity: item.quantity + parsedQuantity,
              unitPrice: parsedUnitPrice,
            }
          : item,
      )
    })
    setPartId('')
    setSelectedPartDraft(null)
    setPartQuery('')
    setQuantity('')
    setUnitPrice('')
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
  const draftLineTotal =
    quantity && unitPrice
      ? lineTotal(Number(quantity), Number(unitPrice))
      : null
  const existingTotal = existingItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  const draftItemsTotal = draftItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  const backPath = orderId
    ? location.pathname.replace(/\/items\/new$/, '')
    : createContext?.onClose
      ? location.pathname
      : location.pathname.replace(/\/new$/, '')
  const submitBlocked =
    !mutationsAllowed ||
    busy ||
    (orderId !== null && existingItemsLoadStatus !== 'loaded') ||
    (orderId !== null && (!partId || !quantity || !unitPrice)) ||
    (orderId === null &&
      draftItems.length === 0 &&
      (!partId || !quantity || !unitPrice))
  const form = (
    <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
      {error && <Notice tone="danger">{error}</Notice>}
      <SectionPanel
        className={cn(
          orderId === null && 'rounded-[16px] [&>header]:pt-3.5 [&>div]:p-3.5',
        )}
        description={
          orderId
            ? 'Знайдіть запчастину, вкажіть кількість і ціну — позиція долучиться до наявних у замовленні.'
            : 'Оберіть запчастину, вкажіть кількість і ціну, а потім додайте її до замовлення.'
        }
        title="Позиція"
      >
        <div className="grid gap-3">
          {partSearchAllowed && (
            <PartSearchPicker
              onClear={() => {
                setPartId('')
                setSelectedPartDraft(null)
              }}
              onQueryChange={setPartQuery}
              onSelect={(part) => {
                setPartId(part.id)
                setSelectedPartDraft(part)
                setPartQuery(part.name)
              }}
              query={partQuery}
              value={selectedPartDraft}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Кількість">
              <QuantityStepper
                label="Кількість"
                min={0}
                onChange={(value) => setQuantity(String(value))}
                value={Number(quantity || '0')}
              />
            </Field>
            <Field label="Ціна за одиницю">
              <TextInput
                className="text-left"
                inputMode="decimal"
                onChange={(event) => setUnitPrice(event.target.value)}
                value={unitPrice}
              />
            </Field>
          </div>
          {orderId === null && (
            <Button
              className="w-full justify-center border-dashed"
              disabled={
                !selectedPartDraft ||
                !quantity ||
                !unitPrice ||
                Number(quantity) < 1 ||
                Number(unitPrice) < 0
              }
              onClick={addDraftItem}
            >
              <Plus aria-hidden />
              Додати деталь
            </Button>
          )}
          {orderId === null && draftItems.length > 0 && (
            <div
              aria-label="Позиції замовлення"
              className="border-app-line grid gap-2 border-t pt-4"
            >
              {draftItems.map((item) => (
                <div
                  className="border-app-line bg-app-canvas/45 grid gap-3 rounded-[14px] border p-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                  key={item.part.id}
                >
                  <div className="min-w-0">
                    <p className="text-app-ink truncate text-[14px] font-bold">
                      {item.part.name}
                    </p>
                    <p className="text-app-muted mt-1 text-[13px] tabular-nums">
                      {item.quantity} × ${item.unitPrice}
                    </p>
                  </div>
                  <p className="text-brand text-right text-[16px] font-extrabold tabular-nums">
                    $
                    {new Intl.NumberFormat('uk-UA').format(
                      item.quantity * item.unitPrice,
                    )}
                  </p>
                  <Button
                    aria-label={`Прибрати ${item.part.name}`}
                    className="size-10 justify-center px-0"
                    onClick={() =>
                      setDraftItems((current) =>
                        current.filter(
                          (draft) => draft.part.id !== item.part.id,
                        ),
                      )
                    }
                    variant="quiet"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionPanel>
      {customerSearchAllowed && (
        <SectionPanel
          className="rounded-[16px] [&>header]:pt-3.5 [&>div]:p-3.5"
          description="Замовлення можна створити й без клієнта — тоді поле лишається порожнім."
          title="Клієнт"
        >
          <div className="grid gap-3" ref={customerPickerRef}>
            <Field
              hint={customerId ? undefined : 'Клієнта не обрано'}
              label="Пошук клієнта"
            >
              <SearchInput
                className={
                  customerId ? 'border-brand/40 bg-brand/[0.08]' : undefined
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (customerId && value !== selectedCustomerName) {
                    setCustomerId('')
                    setSelectedCustomerName('')
                  }
                  setCustomerQuery(value)
                  setCustomerPickerOpen(true)
                }}
                onFocus={() => setCustomerPickerOpen(true)}
                value={customerQuery}
              />
            </Field>
            {customerPickerOpen &&
              customerQuery.trim() &&
              customerResults.length > 0 && (
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
                        onClick={() => {
                          setCustomerId(customer.id)
                          setSelectedCustomerName(customer.name)
                          setCustomerQuery(customer.name)
                          setCustomerPickerOpen(false)
                        }}
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
            {customerMutationAllowed && !customerId && !newCustomerFormOpen && (
              <Button
                className="w-fit"
                onClick={() => setNewCustomerFormOpen(true)}
                type="button"
              >
                <Plus aria-hidden />
                Створити нового клієнта
              </Button>
            )}
            {customerMutationAllowed && !customerId && newCustomerFormOpen && (
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
                        setNewCustomerPhone(
                          normalizeCustomerPhoneDraft(event.target.value),
                        )
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
                  <Button
                    disabled={customerBusy}
                    onClick={() => setNewCustomerFormOpen(false)}
                    type="button"
                    variant="quiet"
                  >
                    Скасувати
                  </Button>
                </div>
              </fieldset>
            )}
            {customerConflict && (
              <Notice
                action={
                  customerConflict.isActive ? (
                    <Button onClick={selectDuplicateCustomer} variant="primary">
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
        <SectionPanel
          className="rounded-[16px] [&>header]:pt-3.5 [&>div]:p-3.5"
          title="Нотатки"
        >
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
      {orderId === null && draftItems.length > 0 && (
        <Panel
          aria-label="Підсумок замовлення"
          className="border-brand/25 bg-brand/[0.055]"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-app-muted text-[13.5px]">
                Разом за замовлення
              </p>
              <p className="text-app-dim mt-1 text-[12.5px]">
                {draftItems.length}{' '}
                {plural(draftItems.length, ['позиція', 'позиції', 'позицій'])}
              </p>
            </div>
            <p className="text-brand text-[28px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
              ${new Intl.NumberFormat('uk-UA').format(draftItemsTotal)}
            </p>
          </div>
        </Panel>
      )}
      <Panel>
        <div
          className={cn(
            'grid gap-3 sm:items-end',
            orderId !== null
              ? 'sm:grid-cols-[minmax(0,1fr)_auto]'
              : 'sm:justify-items-end',
          )}
        >
          {orderId !== null && (
            <div className="grid min-w-0 gap-1">
              <TotalLine
                label="Уже в замовленні"
                value={
                  existingItemsLoadStatus === 'loaded'
                    ? money(existingTotal, 'USD')
                    : '—'
                }
              />
              <TotalLine
                label="Разом за позицію"
                strong
                value={money(draftLineTotal, 'USD')}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {createContext ? (
              <Button
                onClick={createContext.onClose}
                type="button"
                variant="quiet"
              >
                Скасувати
              </Button>
            ) : (
              <Button asChild variant="quiet">
                <Link to={backPath}>
                  {orderId ? 'До замовлення' : 'До списку замовлень'}
                </Link>
              </Button>
            )}
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
  )
  if (orderId === null) {
    return (
      <OrderCreateDrawer
        busy={busy}
        onClose={() => {
          if (createContext) createContext.onClose()
          else void navigate(backPath, { replace: true })
        }}
      >
        {form}
      </OrderCreateDrawer>
    )
  }
  return (
    <PageBody width="narrow">
      <PageHeader eyebrow="Продажі · Замовлення" title="Додати позицію" />
      {form}
    </PageBody>
  )
}

function OrderDetailScreen({
  definition,
  orderId,
}: CabinetModuleScreenProps & { orderId: string }) {
  const cabinet = useCabinet()
  const toast = useOptionalToast()
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
  const [draftNotes, setDraftNotes] = useState('')
  const [itemsPage, setItemsPage] = useState(1)
  const [editingItems, setEditingItems] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const acceptOrder = useCallback((detail: OrderDetail) => {
    setOrder(detail)
    setItemDrafts(detail.items)
    setDraftNotes(detail.notes ?? '')
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
    if (busy) return false
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
      return true
    } catch (error) {
      if (replay && !isAmbiguousMutationFailure(error))
        replayKeys.clear(replay.operation)
      setError(errorMessage(error))
      return false
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
  const orderEditable = mutationsAllowed && order.status === 'pending'
  const itemsEditable = orderEditable && editingItems
  const draftsTotal = itemDrafts.reduce((sum, item) => {
    const total = lineTotal(item.quantity, item.unitPrice)
    return total === null ? sum : sum + total
  }, 0)
  const itemDraftsValid =
    itemDrafts.length > 0 &&
    itemDrafts.every(
      (item) =>
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        Number.isFinite(item.unitPrice) &&
        item.unitPrice >= 0,
    )
  const itemsPageSize = 20
  const visibleItems = (itemsEditable ? itemDrafts : order.items).slice(
    (itemsPage - 1) * itemsPageSize,
    itemsPage * itemsPageSize,
  )
  const itemsTotalPages = Math.max(
    1,
    Math.ceil(
      (itemsEditable ? itemDrafts.length : order.items.length) / itemsPageSize,
    ),
  )
  const computedItemsTotalUsd = order.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  )
  const orderTotalUsd =
    typeof order.itemsTotalUsd === 'number' &&
    Number.isFinite(order.itemsTotalUsd)
      ? order.itemsTotalUsd
      : order.items.length > 0
        ? computedItemsTotalUsd
        : typeof order.totalAmount === 'number' &&
            Number.isFinite(order.totalAmount)
          ? order.totalAmount
          : null
  const paymentState =
    order.status === 'pending'
      ? { label: 'Очікує оплату', className: 'text-state-warn' }
      : order.status === 'confirmed'
        ? { label: 'Оплачено повністю', className: 'text-state-ok' }
        : order.status === 'refunded'
          ? { label: 'Кошти повернено', className: 'text-state-info' }
          : { label: 'Замовлення скасовано', className: 'text-app-dim' }
  const displayedPayments = order.payments
  const ordersPath = location.pathname.replace(/\/orders\/.*$/, '/orders')
  const customerPath =
    order.customerId === null
      ? null
      : `${location.pathname.replace(/\/orders\/.*$/, '')}/customers/${order.customerId}`
  const historyRows = order.history
    .map((entry, index) => ({
      ...entry,
      key: `${entry.createdAt}-${entry.eventType}-${entry.userName}-${index}`,
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const visibleHistoryRows = historyExpanded
    ? historyRows
    : historyRows.slice(0, 3)
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
        {orderEditable || (financeAllowed && order.status === 'confirmed') ? (
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
            {orderEditable ? (
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

        {error && paymentOrderId !== order.id ? (
          <Notice tone="danger">{error}</Notice>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="grid min-w-0 gap-5">
            <Card title="Нотатки">
              {orderEditable ? (
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
                </div>
              ) : (
                <p className="text-app-ink text-[15px] leading-[1.55] whitespace-pre-line">
                  {order.notes === null || order.notes === ''
                    ? 'Нотаток немає.'
                    : order.notes}
                </p>
              )}
            </Card>

            <Card
              aside={
                <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                  {displayedPayments.length}{' '}
                  {plural(displayedPayments.length, [
                    'платіж',
                    'платежі',
                    'платежів',
                  ])}
                </span>
              }
              bodyClassName="p-0"
              headerClassName="border-app-line border-b pb-5"
              title="Платежі"
            >
              {displayedPayments.length > 0 ? (
                <ul aria-label="Платежі замовлення">
                  {displayedPayments.map((payment, index) => (
                    <li
                      className="border-app-line flex items-center justify-between gap-4 border-b px-6 py-4 last:border-b-0"
                      key={`${payment.accountId}-${payment.currency}-${index}`}
                    >
                      <span className="flex min-w-0 items-center gap-3.5">
                        <span className="bg-app-input text-app-muted grid size-9 shrink-0 place-items-center rounded-[10px]">
                          <CreditCard aria-hidden className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-bold text-white">
                            {payment.accountName}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[15px] font-bold text-white tabular-nums">
                        {money(payment.amount, payment.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  description="Платежі з’являться тут після підтвердження замовлення."
                  title="Платежів немає"
                />
              )}
            </Card>

            {itemsEditable ? (
              <SectionPanel
                aside={
                  <span className="text-app-muted text-[13.5px] tabular-nums">
                    Разом за позиціями {money(draftsTotal, 'USD')}
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
                      disabled={busy || !itemDraftsValid}
                      onClick={() => {
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
                        ).then((saved) => {
                          if (saved) setEditingItems(false)
                        })
                      }}
                      variant="primary"
                    >
                      Зберегти позиції
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setItemDrafts(order.items)
                        setEditingItems(false)
                        setError(null)
                      }}
                      variant="ghost"
                    >
                      Скасувати
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
                  {visibleItems.map((item, visibleIndex) => {
                    const index = (itemsPage - 1) * itemsPageSize + visibleIndex
                    return (
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
                              'USD',
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
                                          (_, draftIndex) =>
                                            draftIndex !== index,
                                        )
                                        .map(
                                          ({
                                            partId,
                                            quantity,
                                            unitPrice,
                                          }) => ({
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
                    )
                  })}
                </ul>
                {itemDrafts.length > itemsPageSize ? (
                  <Pagination
                    label="Пагінація позицій замовлення"
                    onPage={setItemsPage}
                    page={itemsPage}
                    totalPages={itemsTotalPages}
                  />
                ) : null}
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
                headerClassName="border-app-line border-b pb-5"
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
                      cell: (item) => money(item.unitPrice, 'USD'),
                    },
                    {
                      key: 'totalPrice',
                      label: 'Сума',
                      align: 'end',
                      cell: (item) => (
                        <span className="font-bold text-white">
                          {money(item.totalPrice, 'USD')}
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
                  embedded
                  footer={
                    <div>
                      <div className="border-app-line flex flex-wrap items-baseline justify-end gap-5 border-t px-6 py-4">
                        <span className="text-app-muted text-sm font-semibold">
                          Разом
                        </span>
                        <span className="text-[20px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
                          {money(orderTotalUsd, 'USD')}
                        </span>
                      </div>
                      {orderEditable ? (
                        <div className="border-app-line flex flex-wrap justify-end gap-2.5 border-t px-6 py-4">
                          <Button
                            disabled={busy}
                            onClick={() => {
                              setItemDrafts(order.items)
                              setEditingItems(true)
                              setError(null)
                            }}
                          >
                            Редагувати
                          </Button>
                          <Button asChild variant="primary">
                            <Link to={`${location.pathname}/items/new`}>
                              <Plus aria-hidden />
                              Додати позицію
                            </Link>
                          </Button>
                        </div>
                      ) : null}
                      {order.items.length > itemsPageSize ? (
                        <Pagination
                          label="Пагінація позицій замовлення"
                          onPage={setItemsPage}
                          page={itemsPage}
                          totalPages={itemsTotalPages}
                        />
                      ) : null}
                    </div>
                  }
                  rowKey={(item) => item.id}
                  rows={visibleItems}
                />
              </Card>
            )}
          </div>

          <aside className="grid min-w-0 gap-5 lg:sticky lg:top-24">
            <Card
              aside={
                <span
                  className={cn(
                    'text-[13px] font-bold',
                    paymentState.className,
                  )}
                >
                  {paymentState.label}
                </span>
              }
              title="Оплата"
            >
              <p className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-white tabular-nums">
                {money(orderTotalUsd, 'USD')}
              </p>
              <dl className="border-app-line mt-4.5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5 border-t pt-4">
                <dt className="text-app-muted text-sm font-semibold">
                  Сума замовлення
                </dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {money(orderTotalUsd, 'USD')}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">
                  Платежів
                </dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {displayedPayments.length}
                </dd>
              </dl>
              {financeAllowed && order.status === 'pending' ? (
                <div className="mt-5 grid gap-2.5">
                  <Button
                    className="w-full justify-center"
                    disabled={busy}
                    onClick={() => setPaymentOrderId(order.id)}
                  >
                    Додати платіж
                  </Button>
                  <Button
                    className="w-full justify-center"
                    disabled={
                      busy ||
                      ((orderTotalUsd ?? 0) > 0 && order.payments.length === 0)
                    }
                    onClick={() => {
                      const input = {
                        payments: order.payments.map(
                          ({ accountId, amount, currency }) => ({
                            accountId,
                            amount,
                            currency,
                          }),
                        ),
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
                    Підтвердити замовлення
                  </Button>
                </div>
              ) : null}
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

            <DeliverySection
              key={order.id}
              customerId={order.customerId}
              customerName={order.customerName}
              mutationsAllowed={mutationsAllowed}
              orderId={order.id}
              totalAmount={order.totalAmount}
            />

            <Card title="Історія">
              {historyRows.length === 0 ? (
                <p className="text-app-muted text-sm">
                  Дії із замовленням зʼявляться тут одразу після збереження.
                </p>
              ) : (
                <>
                  <ol aria-label="Історія замовлення" className="grid">
                    {visibleHistoryRows.map((entry, index) => (
                      <li className="flex gap-3.5" key={entry.key}>
                        <span
                          aria-hidden
                          className="flex flex-col items-center"
                        >
                          <span className="bg-app-muted mt-1.5 size-2.5 rounded-full" />
                          {index < visibleHistoryRows.length - 1 ? (
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
                        </span>
                      </li>
                    ))}
                  </ol>
                  {historyRows.length > 3 ? (
                    <button
                      className="border-app-line-2 text-app-muted hover:border-brand/60 hover:text-brand w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-colors"
                      onClick={() =>
                        setHistoryExpanded((expanded) => !expanded)
                      }
                      type="button"
                    >
                      {historyExpanded
                        ? 'Згорнути історію'
                        : 'Показати всю історію'}
                    </button>
                  ) : null}
                </>
              )}
            </Card>
          </aside>
        </div>
        {financeAllowed &&
        order.status === 'pending' &&
        paymentOrderId === order.id ? (
          <OrderPaymentDialog
            busy={busy}
            error={error}
            initialPayments={order.payments}
            onSave={(payments) => {
              const input = payments.map(({ accountId, amount, currency }) => ({
                accountId,
                amount,
                currency,
              }))
              void transition(
                () => ordersApi.updatePayments(order.id, input),
                undefined,
                'finance.manage',
              ).then((saved) => {
                if (saved) {
                  setPaymentOrderId(null)
                  toast?.show({ message: 'Платежі збережено.', tone: 'ok' })
                }
              })
            }}
            onOpenChange={(open) => setPaymentOrderId(open ? order.id : null)}
            open
            orderNumber={order.number}
            totalAmount={orderTotalUsd}
          />
        ) : null}
      </div>
    </div>
  )
}
