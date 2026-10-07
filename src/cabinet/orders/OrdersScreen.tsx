import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ChevronLeft, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react'
import {
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  SectionPanel,
  Sheet,
  DeniedState,
  ErrorState,
  Field,
  Notice,
  PageBody,
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
import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import {
  commonMessages,
  formatNumber,
  translate,
  useFormat,
  useLocale,
  useT,
  type Locale,
  type MessageKey,
  type SupportedCurrency,
} from '@/i18n'
import { orderEventTitle, orderStatusPresentation } from './order-labels'
import { money, moneyList, orderMoney, refundEffects } from './order-money'
import { paymentMessages } from './payment-messages'
import { paymentRecorded } from './payment-policy'
import { isUnknownOutcome } from '../currency/accounting-currency'
import { MoneyInput } from '../currency/price-currency'
import {
  useAccountingCurrency,
  useFirstPriceGuard,
} from '../currency/use-accounting-currency'
import { usePriceSlots } from '../currency/use-price-slots'
import { amountPrecisionError } from '../currency/amount-precision'
import { orderSteps } from './order-steps'
import {
  OrderCustomerCard,
  OrderDueCard,
  OrderItemsCard,
  OrderNotesCard,
  OrderPaymentsCard,
  OrderSteps,
} from './OrderDetailCards'
import { DeliveryConfigureCard } from './delivery/DeliveryConfigureCard'
import { DeliveryOrderBody } from './delivery/DeliveryOrderBody'
import { orderChip } from './delivery/delivery-view'
import {
  INTEGRATION_COUNTRY_UNAVAILABLE,
  useNovaPoshtaAvailability,
} from './delivery/nova-poshta-availability'
import { deliveryMessages } from './delivery/messages'
import { useDeliveryOrder } from './delivery/use-delivery-order'
import { orderMessages } from './messages'
import { orderFormMessages } from './order-form-messages'
import { cn } from '@/lib/utils'
import {
  customersApi,
  readCustomerPhoneConflict,
  type CustomerPhoneConflict,
  type CustomerSearchItem,
} from '@/api/customers'
import {
  ordersApi,
  type ConfirmPayment,
  type OrderDetail,
  type OrderListItem,
} from '@/api/orders'
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
  customerPhoneForSave,
  newCustomerPhoneDraft,
  normalizeCustomerPhoneDraft,
} from '../customers/customer-phone'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { isPhoneCountry } from '@/lib/phone'
import { OrderCustomerDrawer } from './OrderCustomerDrawer'
import { OrderItemDrawer } from './OrderItemDrawer'
import { OrderPaymentDrawer, type PaymentOutcome } from './OrderPaymentDrawer'

const idFromPath = (path: string) => /\/orders\/([^/]+)/.exec(path)?.[1] ?? null
const orderErrorMessage = (error: unknown, locale: Locale) => {
  const problem = normalizeApiProblem(error)
  const say = (key: MessageKey<typeof orderMessages>) =>
    translate(orderMessages, locale, key)
  if (problem.status === 402) return say('errorSubscription')
  if (problem.kind === 'forbidden') return say('errorForbidden')
  if (problem.code === 'PARTS_NOT_AVAILABLE')
    return say('errorPartsNotAvailable')
  if (problem.code === 'PART_IN_ACTIVE_INVENTORY')
    return say('errorPartInInventory')
  if (isProblemCode(error, INTEGRATION_COUNTRY_UNAVAILABLE))
    return translate(deliveryMessages, locale, 'countryUnavailable')
  if (problem.kind === 'conflict') return say('errorConflict')
  return problem.message
}

/** The order error mapper bound to the current locale. */
const useErrorMessage = () => {
  const { locale } = useLocale()
  return (error: unknown) => orderErrorMessage(error, locale)
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

const lineTotal = (quantity: number, unitPrice: number) => {
  const total = quantity * unitPrice
  return Number.isFinite(total) ? total : null
}
/** Two initials for the avatar chip; a single word gives one. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

/**
 * Date and time in the business time zone; the machine value stays in
 * `dateTime`. Anything unparsable is shown as it came.
 */
const useTimestamp = () => {
  const format = useFormat()
  return (value: string) => format.dateTime(value) ?? value
}

export function OrdersScreen({ definition }: CabinetModuleScreenProps) {
  const location = useLocation()
  const id = idFromPath(location.pathname)
  if (location.pathname.endsWith('/items/new')) {
    // Adding a part is a drawer over the order it belongs to: the route still
    // resolves, but the card underneath stays on screen and readable.
    const orderId = idFromPath(location.pathname.replace('/items/new', ''))
    if (orderId)
      return (
        <OrderDetailScreen
          addingItem
          definition={definition}
          orderId={orderId}
        />
      )
  }
  if (location.pathname.endsWith('/new'))
    return (
      <>
        <OrderDirectory definition={definition} />
        <OrderForm definition={definition} />
      </>
    )
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

/** The statuses the list filters by, in the order a sale moves through them. */
const ORDER_STATUS_FILTERS = [
  { value: '', dot: 'bg-app-line-2' },
  { value: 'pending', dot: 'bg-state-warn' },
  { value: 'confirmed', dot: 'bg-state-ok' },
  { value: 'refunded', dot: 'bg-state-info' },
  { value: 'cancelled', dot: 'bg-app-muted' },
]

/** Statuses whose money never reached the till. */
const UNPAID_STATUSES = new Set(['cancelled', 'refunded'])

/** Order values are in the accounting currency; no code when it is unknown. */
const listMoney = (
  value: number | null,
  currency: string | null,
  locale: Locale,
) =>
  value === null
    ? '—'
    : `${formatNumber(value, locale) ?? String(value)}${currency === null ? '' : ` ${currency}`}`

function OrderDirectory({ definition }: CabinetModuleScreenProps) {
  const { locale } = useLocale()
  const t = useT(orderMessages)
  const format = useFormat()
  const errorMessage = useErrorMessage()
  /** Dates arrive as ISO strings; anything unparsable is shown as it came. */
  const day = (value: string) => format.date(value) ?? value
  const cabinet = useCabinet()
  const { currency: accountingCurrency } = useAccountingCurrency()
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
    // The message is chosen when the request fails, not re-run per locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              {t('eyebrow')}
            </p>
            <h1 className="mt-2.5 text-[38px] leading-none font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              {t('title')}
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
                {t('newOrder')}
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-2.5">
          <SearchInput
            aria-label={t('searchLabel')}
            className="min-h-12.5 text-[15px]"
            onChange={(event) => setParam('q', event.target.value)}
            placeholder={t('searchPlaceholder')}
            value={params.get('q') ?? ''}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div
            aria-label={t('statusFilter')}
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
                  {option.value === ''
                    ? t('filterAll')
                    : orderStatusPresentation(option.value, locale).label}
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
              {t('pageSum')}
            </span>
            <span className="text-[20px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
              {listMoney(pageSum, accountingCurrency, locale)}
            </span>
          </p>
        </div>

        {error === null ? null : <Notice tone="danger">{error}</Notice>}

        <section
          aria-label={t('listLabel')}
          className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
        >
          <div
            aria-hidden
            className="border-app-line text-app-dim hidden gap-4 border-b px-6 py-3.5 font-mono text-[10px] tracking-[0.14em] uppercase md:grid md:grid-cols-[7rem_1.4fr_1fr_9.5rem_7.5rem]"
          >
            <span>{t('columnOrder')}</span>
            <span>{t('columnBuyer')}</span>
            <span>{t('columnItems')}</span>
            <span>{t('columnStatus')}</span>
            <span className="text-right">{t('columnTotal')}</span>
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 px-6 py-14 text-center">
              <p className="text-[16px] font-bold text-white">
                {filtered ? t('nothingFound') : t('noOrders')}
              </p>
              <p className="text-app-muted text-[14px]">
                {filtered ? t('nothingFoundHint') : t('noOrdersHint')}
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
                  {t('resetFilters')}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="grid">
              {orders.map((order) => {
                const presentation = orderStatusPresentation(
                  order.status,
                  locale,
                )
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
                          {order.customerName ?? t('noBuyer')}
                        </span>
                        <span className="text-app-muted mt-0.5 block truncate text-[13px]">
                          {order.paymentAccountNames.length === 0
                            ? t('noPayments')
                            : order.paymentAccountNames.join(', ')}
                        </span>
                      </span>
                      <span className="text-app-muted min-w-0 truncate text-[14px] font-medium">
                        {order.partNames.length === 0
                          ? t('itemCount', { count: order.itemCount })
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
                        {listMoney(
                          order.totalAmount,
                          accountingCurrency,
                          locale,
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-6 py-3.5">
            <p className="text-app-muted text-[13px] font-semibold">
              {t('orderCount', { count: total })}
            </p>
            <Pagination
              label={t('pagesLabel')}
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
}: CabinetModuleScreenProps & {
  createContext?: {
    customer: { id: string; name: string }
    onClose: () => void
    orderBasePath: string
  }
}) {
  const t = useT(orderFormMessages)
  const tc = useT(commonMessages)
  const tenantCountry = useTenantSettings().countryCode
  const phoneCountry = isPhoneCountry(tenantCountry) ? tenantCountry : 'UA'
  const errorMessage = useErrorMessage()
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
    cabinet.snapshot?.permissions.has('customers.view') === true
  const customerMutationAllowed = canMutate(
    definition,
    cabinet,
    'customers.manage',
  )
  const dependenciesAllowed = partSearchAllowed && customerSearchAllowed
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
  const [newCustomerPhone, setNewCustomerPhone] = useState(() =>
    newCustomerPhoneDraft(phoneCountry),
  )
  const [customerConflict, setCustomerConflict] =
    useState<CustomerPhoneConflict | null>(null)
  const [customerBusy, setCustomerBusy] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')
  const guard = useFirstPriceGuard()
  const { locale } = useLocale()
  const [draftItems, setDraftItems] = useState<
    {
      part: PartPickerItem
      quantity: number
      unitPrice: number
    }[]
  >([])
  const [selectedPartDraft, setSelectedPartDraft] =
    useState<PartPickerItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemPrices = usePriceSlots(guard, {
    values: [unitPrice, ...draftItems.map((item) => item.unitPrice)],
    onAccept: (accepted) => void submit(undefined, accepted),
  })
  const closeNewCustomerForm = () => {
    setNewCustomerFormOpen(false)
    setNewCustomerName('')
    setNewCustomerPhone(newCustomerPhoneDraft(phoneCountry))
    setCustomerConflict(null)
  }
  const linkedCustomerId =
    createContext?.customer.id ?? params.get('customerId')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- message picked at failure time
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- message picked at failure time
  }, [customerId, customerQuery, customerSearchAllowed])
  const submit = async (
    event?: FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
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
      creationItems.length === 0 ||
      itemPrices.disabled
    )
      return
    setBusy(true)
    setError(null)
    try {
      if (guard.needsCheck(true) && !(await guard.beforeSave(true, accepted))) {
        setBusy(false)
        return
      }
      const scope = requireLatestMutation({ quota: true })
      requireLatestMutation({ permission: 'parts.view', quota: false })
      requireLatestMutation({ permission: 'customers.view', quota: false })
      const detail = await ordersApi.create({
        customerId: customerId || null,
        notes: notes || null,
        items: creationItems,
      })
      if (scope.signal.aborted) return
      guard.afterSave(true)
      const detailPath = `${createContext?.orderBasePath ?? location.pathname.replace(/\/new$/, '')}/${detail.id}`
      toast?.show({ message: t('created'), tone: 'ok' })
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
          phone: customerPhoneForSave(newCustomerPhone, phoneCountry),
          notes: null,
        },
        { signal: scope.signal },
      )
      if (scope.signal.aborted) return
      setCustomerId(result.customer.id)
      setSelectedCustomerName(result.customer.name)
      setCustomerQuery(result.customer.name)
      setCustomerResults([])
      closeNewCustomerForm()
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
    setCustomerResults([])
    closeNewCustomerForm()
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
      setCustomerResults([])
      closeNewCustomerForm()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setCustomerBusy(false)
    }
  }
  const addDraftItem = () => {
    if (!selectedPartDraft || !quantity || !unitPrice) return
    const parsedQuantity = Number(quantity)
    const parsedUnitPrice = Number(unitPrice)
    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      !Number.isFinite(parsedUnitPrice) ||
      parsedUnitPrice < 0
    )
      return
    const precision = amountPrecisionError(
      parsedUnitPrice,
      guard.currency,
      locale,
    )
    if (precision !== null) {
      setError(precision)
      return
    }
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
          description={t('deniedDescription')}
          role="alert"
          title={t('deniedTitle')}
        />
      </PageBody>
    )
  }
  const draftItemsTotal = draftItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  )
  const backPath = createContext?.onClose
    ? location.pathname
    : location.pathname.replace(/\/new$/, '')
  const closeCreate = () => {
    if (createContext) createContext.onClose()
    else void navigate(backPath, { replace: true })
  }
  const submitBlocked =
    !mutationsAllowed ||
    busy ||
    itemPrices.disabled ||
    (draftItems.length === 0 && (!partId || !quantity || !unitPrice))
  const form = (
    <form
      className="grid"
      id={ORDER_FORM}
      onSubmit={(event) => void submit(event)}
    >
      {error && <Notice tone="danger">{error}</Notice>}
      <SectionPanel
        description={t('itemDescription')}
        title={t('itemTitle')}
        variant="plain"
      >
        <div className="grid gap-3">
          {partSearchAllowed && (
            <PartSearchPicker
              currency={guard.currency}
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
            <Field label={t('quantity')}>
              <QuantityStepper
                label={t('quantity')}
                min={0}
                onChange={(value) => setQuantity(String(value))}
                value={Number(quantity || '0')}
              />
            </Field>
            <Field hint={itemPrices.hint} label={t('unitPrice')}>
              <MoneyInput
                className="text-left"
                currency={itemPrices.currency}
                disabled={itemPrices.disabled}
                inputMode="decimal"
                onChange={(event) => setUnitPrice(event.target.value)}
                value={unitPrice}
              />
            </Field>
          </div>
          {itemPrices.note}
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
            {t('addPart')}
          </Button>

          {draftItems.length > 0 && (
            <div
              aria-label={t('orderItems')}
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
                      {item.quantity} ×{' '}
                      {money(item.unitPrice, guard.currency, locale)}
                    </p>
                  </div>
                  <p className="text-brand text-right text-[16px] font-extrabold tabular-nums">
                    {money(
                      item.quantity * item.unitPrice,
                      guard.currency,
                      locale,
                    )}
                  </p>
                  <Button
                    aria-label={t('removeItem', { name: item.part.name })}
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
          variant="plain"
          description={t('customerDescription')}
          title={t('customerTitle')}
        >
          <div className="grid gap-3" ref={customerPickerRef}>
            <Field
              hint={customerId ? undefined : t('noCustomerChosen')}
              label={t('searchCustomer')}
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
                  setCustomerResults([])
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
                        aria-label={t('pickCustomer', { name: customer.name })}
                        className={
                          customer.id === customerId
                            ? 'border-brand/40 bg-brand/[0.1] w-full justify-between'
                            : 'w-full justify-between'
                        }
                        onClick={() => {
                          setCustomerId(customer.id)
                          setSelectedCustomerName(customer.name)
                          setCustomerQuery(customer.name)
                          setCustomerResults([])
                          setCustomerPickerOpen(false)
                        }}
                      >
                        <span className="min-w-0 truncate">
                          {customer.name}
                        </span>
                        <span className="text-app-dim text-[13px]">
                          {customer.phone ?? t('noPhone')}
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
                {t('createCustomer')}
              </Button>
            )}
            {customerMutationAllowed && !customerId && newCustomerFormOpen && (
              <fieldset className="border-app-line-2 rounded-control grid gap-3 border border-dashed p-3">
                <legend className="text-app-muted px-1 text-[13.5px]">
                  {t('newCustomer')}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('newCustomerName')}>
                    <TextInput
                      onChange={(event) =>
                        setNewCustomerName(event.target.value)
                      }
                      value={newCustomerName}
                    />
                  </Field>
                  <Field label={t('newCustomerPhone')}>
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
                    {customerBusy
                      ? t('creatingCustomer')
                      : t('createCustomerSubmit')}
                  </Button>
                  <Button
                    disabled={customerBusy}
                    onClick={closeNewCustomerForm}
                    type="button"
                    variant="quiet"
                  >
                    {tc('cancel')}
                  </Button>
                </div>
              </fieldset>
            )}
            {customerConflict && (
              <Notice
                action={
                  customerConflict.isActive ? (
                    <Button onClick={selectDuplicateCustomer} variant="primary">
                      {t('useCustomer', {
                        name: customerConflict.customerName,
                      })}
                    </Button>
                  ) : (
                    <Button
                      disabled={customerBusy}
                      onClick={() => void reactivateDuplicateCustomer()}
                      variant="primary"
                    >
                      {t('activateCustomer', {
                        name: customerConflict.customerName,
                      })}
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
      <SectionPanel variant="plain" title={t('notes')}>
        <div>
          <Field hint={t('notesHint')} label={t('notes')}>
            <TextArea
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </Field>
        </div>
      </SectionPanel>

      {draftItems.length > 0 && (
        <Panel
          aria-label={t('summary')}
          className="border-brand/25 bg-brand/[0.055]"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-app-muted text-[13.5px]">{t('orderTotal')}</p>
              <p className="text-app-dim mt-1 text-[12.5px]">
                {t('itemCount', { count: draftItems.length })}
              </p>
            </div>
            <p className="text-brand text-[28px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
              {money(draftItemsTotal, guard.currency, locale)}
            </p>
          </div>
        </Panel>
      )}
    </form>
  )
  return (
    <Sheet
      description={t('sheetDescription')}
      eyebrow={t('sheetEyebrow')}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2.5">
          <div className="basis-full empty:hidden">{itemPrices.saveNotes}</div>
          <div className="ml-auto flex items-center gap-2.5">
            <Button disabled={busy} onClick={closeCreate} type="button">
              {tc('cancel')}
            </Button>
            <Button
              aria-busy={busy}
              disabled={submitBlocked}
              form={ORDER_FORM}
              type="submit"
              variant="primary"
            >
              {busy ? t('creating') : t('createOrder')}
            </Button>
          </div>
        </div>
      }
      onOpenChange={(next) => {
        if (!next && !busy) closeCreate()
      }}
      open
      title={t('sheetTitle')}
    >
      {form}
    </Sheet>
  )
}

function OrderDetailScreen({
  addingItem = false,
  definition,
  orderId,
}: CabinetModuleScreenProps & { addingItem?: boolean; orderId: string }) {
  const { locale } = useLocale()
  const t = useT(orderMessages)
  const tc = useT(commonMessages)
  const errorMessage = useErrorMessage()
  const formatTimestamp = useTimestamp()
  const novaPoshta = useNovaPoshtaAvailability()
  const cabinet = useCabinet()
  const toast = useOptionalToast()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const replayKeys = useOrderIdempotencyKeys()
  const location = useLocation()
  const navigate = useNavigate()
  const mutationsAllowed = canMutate(definition, cabinet)
  const financeAllowed =
    mutationsAllowed &&
    cabinet.snapshot?.permissions.has('finance.manage') === true
  /**
   * An order that ships is settled through its own endpoints; Core refuses the
   * ordinary item, customer, confirm, cancel and refund calls on one outright,
   * so those controls have to go. Only the delivery section can tell us — the
   * order DTO carries no flag.
   */
  const [loadedCustomerId, setLoadedCustomerId] = useState<string | null>(null)
  const deliveryLoad = useDeliveryOrder(
    orderId,
    loadedCustomerId,
    novaPoshta.available,
  )
  const deliveryMoney = deliveryLoad.state?.money ?? null
  const deliveryOrder = deliveryMoney !== null
  const ordinaryFinance = financeAllowed && !deliveryOrder
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [itemDrafts, setItemDrafts] = useState<OrderDetail['items']>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)
  const [itemsPage, setItemsPage] = useState(1)
  const [editingItems, setEditingItems] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [paymentOutcome, setPaymentOutcome] = useState<PaymentOutcome | null>(
    null,
  )
  const [customerOpen, setCustomerOpen] = useState(false)
  const guard = useFirstPriceGuard()
  const currency = guard.currency
  const tp = useT(paymentMessages)
  const itemPrices = usePriceSlots(guard, {
    values: itemDrafts.map((item) => item.unitPrice),
    onAccept: (accepted) => saveItemDrafts(accepted),
  })
  const changeRefundOpen = (next: boolean) => {
    setRefundOpen(next)
    setError(null)
    if (!next) setRefundReason('')
  }
  const acceptOrder = useCallback((detail: OrderDetail) => {
    setOrder(detail)
    setLoadedCustomerId(detail.customerId)
    setItemDrafts(detail.items)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- message picked at failure time
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
          title={t('loadFailed')}
        />
      </PageBody>
    )
  if (!order)
    return (
      <PageBody width="narrow">
        <SkeletonRows label={t('loading')} rows={4} />
      </PageBody>
    )
  const status = orderStatusPresentation(order.status, locale)
  const orderEditable =
    mutationsAllowed && order.status === 'pending' && !deliveryOrder
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
  const ordersPath = location.pathname.replace(/\/orders\/.*$/, '/orders')
  const moduleBase = location.pathname.replace(/\/orders\/.*$/, '')
  const partsPath =
    cabinet.snapshot?.permissions.has('parts.view') === true
      ? `${moduleBase}/parts`
      : null
  // Core demands team.manage even to list integrations: a stored API key is a
  // key to someone else's account.
  const integrationsPath =
    cabinet.snapshot?.permissions.has('team.manage') === true
      ? `${moduleBase}/settings/integrations`
      : null
  const summary = orderMoney(order)
  /**
   * Sale prices are accounting prices: the first-price check applies. Runs
   * `save` synchronously when there is nothing to check.
   */
  const withPriceCheck = (
    save: () => void,
    accepted?: SupportedCurrency | null,
  ) => {
    if (!guard.needsCheck(true)) {
      save()
      return
    }
    void guard.beforeSave(true, accepted).then((ok) => {
      if (ok) save()
    })
  }
  const saveItemDrafts = (accepted?: SupportedCurrency | null) => {
    if (busy) return
    const precision =
      itemDrafts
        .map((item) => amountPrecisionError(item.unitPrice, currency, locale))
        .find((message) => message !== null) ?? null
    if (precision !== null) {
      setError(precision)
      return
    }
    withPriceCheck(() => {
      void transition(() =>
        ordersApi.updateItems(
          order.id,
          itemDrafts.map(({ partId, quantity, unitPrice }) => ({
            partId,
            quantity,
            unitPrice,
          })),
        ),
      ).then((saved) => {
        if (saved) {
          guard.afterSave(true)
          setEditingItems(false)
        }
      })
    }, accepted)
  }
  /**
   * Records one more actual payment (board 3a/3c). A refusal keeps the draft
   * and says why; an unknown outcome re-reads the order's payments before
   * anything else, so the same money is never written twice.
   */
  const savePayment = async (
    payments: ConfirmPayment[],
    added: ConfirmPayment,
  ) => {
    if (busy) return
    setBusy(true)
    setPaymentOutcome(null)
    setError(null)
    const before = order.payments
    try {
      const scope = requireLatestMutation({ quota: false })
      requireLatestMutation({ permission: 'finance.manage', quota: false })
      const updated = await ordersApi.updatePayments(order.id, payments)
      if (scope.signal.aborted) return
      acceptOrder(updated)
      setPaymentOrderId(null)
      toast?.show({ message: tp('saved'), tone: 'ok' })
    } catch (failure) {
      if (!isUnknownOutcome(failure)) {
        setPaymentOutcome({ kind: 'refused', message: errorMessage(failure) })
        return
      }
      setPaymentOutcome({ kind: 'checking' })
      try {
        const fresh = await ordersApi.getById(order.id)
        acceptOrder(fresh)
        if (paymentRecorded(before, fresh.payments, added)) {
          setPaymentOutcome(null)
          setPaymentOrderId(null)
          toast?.show({ message: tp('saved'), tone: 'ok' })
        } else setPaymentOutcome({ kind: 'not-recorded' })
      } catch {
        setPaymentOutcome({ kind: 'check-failed' })
      }
    } finally {
      setBusy(false)
    }
  }
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
            {t('backToOrders')}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>{t('eyebrow')}</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span className="text-app-muted">{t('title')}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button disabled title={t('printUnavailable')}>
            {t('print')}
          </Button>
          {orderEditable ? (
            <ActionMenu
              actions={[
                {
                  key: 'cancel',
                  label: t('cancelOrder'),
                  icon: <XCircle aria-hidden />,
                  destructive: true,
                  disabled: busy,
                  onSelect: () =>
                    void transition(() => ordersApi.cancel(order.id)),
                },
              ]}
              label={t('moreActions')}
            />
          ) : null}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1200px] gap-5 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-9 lg:px-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              {t('orderTitle', { number: String(order.number) })}
            </h1>
            <StatusPill
              tone={
                deliveryMoney === null
                  ? status.tone
                  : orderChip(deliveryMoney, locale).tone
              }
            >
              {deliveryMoney === null
                ? status.label
                : orderChip(deliveryMoney, locale).label}
            </StatusPill>
            <p className="text-app-muted text-sm">
              {t('createdBy', {
                when: formatTimestamp(order.createdAt),
                who: order.createdByName,
              })}
            </p>
          </div>
          {deliveryMoney === null ? (
            <div className="mt-6">
              <OrderSteps steps={orderSteps(order, formatTimestamp, locale)} />
            </div>
          ) : null}
        </div>

        {deliveryMoney === null ? null : (
          <DeliveryOrderBody
            countryCode={novaPoshta.countryCode}
            accountingCurrency={currency}
            customerPath={customerPath}
            delivery={deliveryMoney}
            financeAllowed={financeAllowed}
            integrationsPath={integrationsPath}
            load={deliveryLoad}
            mutationsAllowed={mutationsAllowed}
            novaPoshtaAvailable={novaPoshta.available}
            order={order}
            partsPath={partsPath}
          />
        )}

        {error && paymentOrderId !== order.id && !refundOpen ? (
          <Notice tone="danger">{error}</Notice>
        ) : null}

        {deliveryOrder ? null : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="grid min-w-0 gap-5">
              {itemsEditable ? (
                <SectionPanel
                  aside={
                    <span className="text-app-muted text-[13.5px] tabular-nums">
                      {t('itemsTotal', {
                        amount: money(draftsTotal, currency, locale),
                      })}
                    </span>
                  }
                  description={
                    itemDrafts.length === 1
                      ? t('lastItemHint')
                      : t('editItemsHint')
                  }
                  footer={
                    <>
                      <div className="basis-full empty:hidden">
                        {itemPrices.saveNotes}
                      </div>
                      <Button
                        disabled={
                          busy || !itemDraftsValid || itemPrices.disabled
                        }
                        onClick={() => saveItemDrafts()}
                        variant="primary"
                      >
                        {t('saveItems')}
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
                        {tc('cancel')}
                      </Button>
                    </>
                  }
                  title={t('items')}
                >
                  {itemDrafts.length === 0 && (
                    <p className="text-app-muted px-4 py-3 text-sm">
                      {t('noItems')}
                    </p>
                  )}
                  <ul>
                    {visibleItems.map((item, visibleIndex) => {
                      const index =
                        (itemsPage - 1) * itemsPageSize + visibleIndex
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
                              {t('lineTotal', {
                                amount: money(
                                  lineTotal(item.quantity, item.unitPrice),
                                  currency,
                                  locale,
                                ),
                              })}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="grid w-20 gap-1.5">
                              <span
                                aria-hidden
                                className="text-app-dim text-[12.5px]"
                              >
                                {t('quantity')}
                              </span>
                              <TextInput
                                aria-label={t('quantityOf', {
                                  name: item.partName,
                                })}
                                className="text-right"
                                inputMode="numeric"
                                onChange={(event) =>
                                  setItemDrafts((current) =>
                                    current.map((draft, draftIndex) =>
                                      draftIndex === index
                                        ? {
                                            ...draft,
                                            quantity: Number(
                                              event.target.value,
                                            ),
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
                                {t('price')}
                              </span>
                              <TextInput
                                aria-label={
                                  currency === null
                                    ? t('priceOf', { name: item.partName })
                                    : t('priceOfIn', {
                                        name: item.partName,
                                        code: currency,
                                      })
                                }
                                className="text-right"
                                inputMode="decimal"
                                onChange={(event) =>
                                  setItemDrafts((current) =>
                                    current.map((draft, draftIndex) =>
                                      draftIndex === index
                                        ? {
                                            ...draft,
                                            unitPrice: Number(
                                              event.target.value,
                                            ),
                                          }
                                        : draft,
                                    ),
                                  )
                                }
                                value={item.unitPrice}
                              />
                            </div>
                            <Button
                              aria-label={t('deleteItem', {
                                name: item.partName,
                              })}
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
                      label={t('itemsPages')}
                      onPage={setItemsPage}
                      page={itemsPage}
                      totalPages={itemsTotalPages}
                    />
                  ) : null}
                </SectionPanel>
              ) : (
                <OrderItemsCard
                  addPath={
                    orderEditable ? `${location.pathname}/items/new` : null
                  }
                  editable={orderEditable}
                  items={order.items}
                  onEdit={() => {
                    setItemDrafts(order.items)
                    setEditingItems(true)
                    setError(null)
                  }}
                  currency={currency}
                  partsPath={partsPath}
                  total={orderTotalUsd}
                />
              )}

              {deliveryOrder ? null : (
                <OrderPaymentsCard
                  paidLine={
                    summary.paid.length === 0
                      ? null
                      : moneyList(summary.paid, ' · ', locale)
                  }
                  payments={order.payments}
                />
              )}

              <OrderNotesCard
                busy={busy}
                editable={orderEditable}
                notes={order.notes}
                onSave={(value) =>
                  void transition(() => ordersApi.updateNotes(order.id, value))
                }
              />
            </div>

            <aside className="grid min-w-0 gap-5 lg:sticky lg:top-24">
              {deliveryOrder ? null : (
                <OrderDueCard
                  actions={
                    ordinaryFinance && order.status === 'pending' ? (
                      <>
                        <Button
                          className="w-full justify-center"
                          disabled={busy}
                          onClick={() => setPaymentOrderId(order.id)}
                          variant="primary"
                        >
                          {t('addPayment')}
                        </Button>
                        {/* Confirming is the operator's acknowledgement of
                            full payment (R-10): it does not wait for a
                            payment and compares nothing with the value. */}
                        <Button
                          className="w-full justify-center"
                          disabled={busy}
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
                        >
                          {t('confirmOrder')}
                        </Button>
                      </>
                    ) : ordinaryFinance && order.status === 'confirmed' ? (
                      <Button
                        className="w-full justify-center"
                        onClick={() => changeRefundOpen(!refundOpen)}
                        variant="danger"
                      >
                        {t('startRefund')}
                      </Button>
                    ) : null
                  }
                  accountingCurrency={currency}
                  hint={
                    ordinaryFinance && order.status === 'pending'
                      ? tp('confirmNote')
                      : ordinaryFinance && order.status === 'confirmed'
                        ? t('refundHint')
                        : null
                  }
                  summary={summary}
                  tills={[
                    ...new Set(
                      order.payments.map((payment) => payment.accountName),
                    ),
                  ]}
                />
              )}

              <OrderCustomerCard
                accountingCurrency={currency}
                customerId={order.customerId}
                customerName={order.customerName}
                initials={initials(order.customerName ?? '—')}
                onChange={
                  orderEditable ? () => setCustomerOpen(true) : undefined
                }
                to={customerPath ?? '#'}
              />

              {/* Whether an order ships is Core's decision, not the carrier's:
                  offering it only while Nova Poshta answers made the order's
                  kind depend on an integration that has nothing to do with it. */}
              {deliveryLoad.state !== null && order.status === 'pending' ? (
                <DeliveryConfigureCard
                  mutationsAllowed={mutationsAllowed}
                  novaPoshtaAvailable={novaPoshta.available}
                  onConfigured={deliveryLoad.setMoney}
                  orderId={order.id}
                />
              ) : null}

              <Card title={t('history')}>
                {historyRows.length === 0 ? (
                  <p className="text-app-muted text-sm">{t('historyEmpty')}</p>
                ) : (
                  <>
                    <ol aria-label={t('historyLabel')} className="grid">
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
                              {orderEventTitle(entry.eventType, locale)}
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
                          ? t('historyCollapse')
                          : t('historyExpand')}
                      </button>
                    ) : null}
                  </>
                )}
              </Card>
            </aside>
          </div>
        )}
        <ConfirmDialog
          confirmLabel={
            summary.paid.length === 0
              ? tp('refundNothing')
              : tp('refundLabel', {
                  amounts: moneyList(summary.paid, tp('and'), locale),
                })
          }
          confirmDisabled={!refundReason.trim()}
          consequence={t('refundConsequence')}
          destructive
          effects={refundEffects(order, summary, locale)}
          error={refundOpen ? error : null}
          icon={RotateCcw}
          onConfirm={() => {
            const normalizedReason = refundReason.trim()
            if (!normalizedReason) return
            const input = { refundReason: normalizedReason }
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
            ).then((done) => {
              if (done) changeRefundOpen(false)
            })
          }}
          onOpenChange={changeRefundOpen}
          open={refundOpen && ordinaryFinance && order.status === 'confirmed'}
          pending={busy}
          title={t('refundTitle')}
        >
          <Field label={t('refundReason')}>
            <TextInput
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder={t('refundReasonPlaceholder')}
              value={refundReason}
            />
          </Field>
        </ConfirmDialog>

        <OrderItemDrawer
          busy={busy}
          error={addingItem ? error : null}
          guard={guard}
          onOpenChange={(next) => {
            if (!next) void navigate(`${ordersPath}/${order.id}`)
          }}
          onSubmit={(item, accepted) => {
            const add = () =>
              void transition(
                () =>
                  ordersApi.updateItems(order.id, [
                    ...order.items.map(({ partId, quantity, unitPrice }) => ({
                      partId,
                      quantity,
                      unitPrice,
                    })),
                    item,
                  ]),
                undefined,
                // The part was chosen from the catalogue; losing the right to
                // read it between opening the drawer and saving stops the save.
                'parts.view',
              ).then((saved) => {
                if (saved) {
                  guard.afterSave(true)
                  toast?.show({ message: t('itemAdded'), tone: 'ok' })
                  void navigate(`${ordersPath}/${order.id}`)
                }
              })
            withPriceCheck(add, accepted)
          }}
          open={addingItem && orderEditable}
          orderNumber={order.number}
          orderTotal={orderTotalUsd}
          takenPartIds={order.items.map((item) => item.partId)}
        />

        <OrderCustomerDrawer
          busy={busy}
          currentId={order.customerId}
          currentName={order.customerName}
          error={customerOpen ? error : null}
          onAssign={(customerId) => {
            void transition(() =>
              ordersApi.setCustomer(order.id, customerId),
            ).then((saved) => {
              if (saved) {
                setCustomerOpen(false)
                toast?.show({ message: t('customerAssigned'), tone: 'ok' })
              }
            })
          }}
          onOpenChange={setCustomerOpen}
          open={customerOpen && orderEditable}
          orderNumber={order.number}
        />

        {ordinaryFinance &&
        order.status === 'pending' &&
        paymentOrderId === order.id ? (
          <OrderPaymentDrawer
            accountingCurrency={currency}
            busy={busy}
            existing={order.payments}
            onOpenChange={(next) => {
              setPaymentOutcome(null)
              setPaymentOrderId(next ? order.id : null)
            }}
            onSave={(payments, added) => void savePayment(payments, added)}
            open
            orderNumber={order.number}
            orderValue={summary.value}
            outcome={paymentOutcome}
          />
        ) : null}
      </div>
    </div>
  )
}

const ORDER_FORM = 'order-create-form'
