import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Printer,
  RotateCcw,
  SearchX,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  ConfirmDialog,
  DataTable,
  type DataColumn,
  SectionPanel,
  Sheet,
  DeniedState,
  ErrorState,
  Field,
  Notice,
  Pagination,
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
import { useCurrencyDraft } from '../currency/form-draft'
import { lostResponseMessages } from '../lost-response'
import { amountPrecisionError } from '../currency/amount-precision'
import { orderSteps } from './order-steps'
import { RedesignShell } from '../redesign-shell'
import {
  OrderCustomerCard,
  OrderDueCard,
  OrderItemsCard,
  OrderNotesCard,
  OrderPaymentsCard,
  OrderSteps,
  OrderTimeline,
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
import { OrderItemDrawer, type OrderItemDraft } from './OrderItemDrawer'
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
type OrderReplayOperation = 'order-confirm' | 'order-refund' | 'order-payments'
/** The status an order reaches once a replayable transition landed. */
const REPLAY_SETTLED_STATUS: Record<OrderReplayOperation, string | null> = {
  'order-confirm': 'confirmed',
  'order-refund': 'refunded',
  // Payments are settled by comparing the payments themselves.
  'order-payments': null,
}
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
  '',
  'pending',
  'confirmed',
  'refunded',
  'cancelled',
] as const

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
  const navigate = useNavigate()
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
              ...(option === '' ? {} : { status: option }),
              ...(customerId === undefined ? {} : { customerId }),
              page: 1,
              pageSize: 1,
            },
            { signal: controller.signal },
          )
          .then((result) => [option, result.total] as const),
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

  const resetFilters = () => {
    const next = new URLSearchParams(params)
    next.delete('q')
    next.delete('status')
    next.set('page', '1')
    setParams(next)
  }
  const columns: DataColumn<OrderListItem>[] = [
    {
      key: 'order',
      label: t('columnOrder'),
      variant: 'primary',
      cell: (order) => (
        <span className="grid">
          <Link
            className="text-app-strong font-mono"
            onClick={(event) => event.stopPropagation()}
            to={order.id}
          >
            #{order.number}
          </Link>
          <span className="rz-caption font-normal">{day(order.createdAt)}</span>
        </span>
      ),
    },
    {
      key: 'buyer',
      label: t('columnBuyer'),
      cell: (order) => (
        <span className="grid min-w-0 max-w-72">
          <span
            className={cn(
              'truncate',
              order.customerName === null ? 'rz-dim' : 'rz-strong',
            )}
          >
            {order.customerName ?? t('noBuyer')}
          </span>
          <span className="rz-caption truncate">
            {order.paymentAccountNames.length === 0
              ? t('noPayments')
              : order.paymentAccountNames.join(', ')}
          </span>
        </span>
      ),
    },
    {
      key: 'items',
      label: t('columnItems'),
      cell: (order) => (
        <span className="block max-w-72 truncate">
          {order.partNames.length === 0
            ? t('itemCount', { count: order.itemCount })
            : order.partNames.join(', ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('columnStatus'),
      cell: (order) => {
        const presentation = orderStatusPresentation(order.status, locale)
        return (
          <StatusPill tone={presentation.tone}>{presentation.label}</StatusPill>
        )
      },
    },
    {
      key: 'total',
      label: t('columnTotal'),
      align: 'end',
      cell: (order) => (
        <span
          className={cn(
            'whitespace-nowrap',
            UNPAID_STATUSES.has(order.status) && 'rz-dim',
          )}
        >
          {listMoney(order.totalAmount, accountingCurrency, locale)}
        </span>
      ),
    },
  ]

  return (
    <RedesignShell
      actions={
        createAllowed ? (
          <Button asChild variant="primary">
            <Link to="new">
              <Plus aria-hidden />
              {t('newOrder')}
            </Link>
          </Button>
        ) : undefined
      }
      crumb={
        <>
          <span>{t('eyebrow')}</span>
          <ChevronRight aria-hidden className="size-3" />
          <span aria-current="page">{t('title')}</span>
        </>
      }
    >
      <div className="rz-page-head">
        <h1 className="rz-h-page">{t('title')}</h1>
        <span className="rz-muted">{t('orderCount', { count: total })}</span>
        <dl className="rz-totals">
          <div className="flex items-baseline gap-1.5">
            <dt>{t('pageSum')}</dt>
            <dd>{listMoney(pageSum, accountingCurrency, locale)}</dd>
          </div>
        </dl>
      </div>

      <div className="rz-toolbar" role="search">
        <SearchInput
          aria-label={t('searchLabel')}
          onChange={(event) => setParam('q', event.target.value)}
          placeholder={t('searchPlaceholder')}
          value={params.get('q') ?? ''}
        />
        <div
          aria-label={t('statusFilter')}
          className="rz-seg max-w-full flex-wrap"
          role="radiogroup"
        >
          {ORDER_STATUS_FILTERS.map((option) => (
            <button
              aria-checked={(status ?? '') === option}
              key={option}
              onClick={() => setParam('status', option)}
              role="radio"
              type="button"
            >
              {option === ''
                ? t('filterAll')
                : orderStatusPresentation(option, locale).label}
              {counts === null ? null : (
                <span className="rz-count">{counts[option] ?? 0}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error === null ? null : <Notice tone="danger">{error}</Notice>}

      <section aria-label={t('listLabel')}>
        <DataTable
          caption={t('listLabel')}
          columns={columns}
          empty={
            <div className="rz-state" role="status">
              <span className="rz-state__icon">
                {filtered ? (
                  <SearchX aria-hidden />
                ) : (
                  <ClipboardList aria-hidden />
                )}
              </span>
              <h2 className="rz-state__title">
                {filtered ? t('nothingFound') : t('noOrders')}
              </h2>
              <p className="rz-state__body">
                {filtered ? t('nothingFoundHint') : t('noOrdersHint')}
              </p>
              {filtered ? (
                <Button onClick={resetFilters}>{t('resetFilters')}</Button>
              ) : null}
            </div>
          }
          footer={
            <Pagination
              label={t('pagesLabel')}
              onPage={goToPage}
              page={page}
              totalPages={Math.max(totalPages, 1)}
            />
          }
          onRowClick={(order) => void navigate(order.id)}
          rowKey={(order) => order.id}
          rows={orders}
        />
      </section>
    </RedesignShell>
  )
}

/** What the order form keeps across the trip to the currency setting. */
interface OrderFormDraft {
  partId: string
  partQuery: string
  customerId: string
  customerQuery: string
  selectedCustomerName: string
  quantity: string
  unitPrice: string
  notes: string
  draftItems: { part: PartPickerItem; quantity: number; unitPrice: number }[]
  selectedPartDraft: PartPickerItem | null
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
  // The order typed before leaving for the currency setting comes back.
  const draft = useCurrencyDraft<OrderFormDraft>(
    `order-form:${createContext?.customer.id ?? 'new'}`,
  )
  const restored = draft.initial
  const [partId, setPartId] = useState(() => restored?.partId ?? '')
  const [partQuery, setPartQuery] = useState(() => restored?.partQuery ?? '')
  const [customerId, setCustomerId] = useState(
    () =>
      restored?.customerId ??
      createContext?.customer.id ??
      params.get('customerId') ??
      '',
  )
  const [customerQuery, setCustomerQuery] = useState(
    () => restored?.customerQuery ?? createContext?.customer.name ?? '',
  )
  const [selectedCustomerName, setSelectedCustomerName] = useState(
    () => restored?.selectedCustomerName ?? createContext?.customer.name ?? '',
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
  const [quantity, setQuantity] = useState(() => restored?.quantity ?? '')
  const [unitPrice, setUnitPrice] = useState(() => restored?.unitPrice ?? '')
  const [notes, setNotes] = useState(() => restored?.notes ?? '')
  const guard = useFirstPriceGuard()
  const { locale } = useLocale()
  const [draftItems, setDraftItems] = useState<OrderFormDraft['draftItems']>(
    () => restored?.draftItems ?? [],
  )
  const [selectedPartDraft, setSelectedPartDraft] =
    useState<PartPickerItem | null>(() => restored?.selectedPartDraft ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemPrices = usePriceSlots(guard, {
    values: [unitPrice, ...draftItems.map((item) => item.unitPrice)],
    onAccept: (accepted) => void submit(undefined, accepted),
    draftKept: true,
    onLeave: () =>
      draft.keep({
        partId,
        partQuery,
        customerId,
        customerQuery,
        selectedCustomerName,
        quantity,
        unitPrice,
        notes,
        draftItems,
        selectedPartDraft,
      }),
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
      <div className="rz-page">
        <DeniedState
          description={t('deniedDescription')}
          role="alert"
          title={t('deniedTitle')}
        />
      </div>
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
                currency={itemPrices.currency}
                disabled={itemPrices.disabled}
                inputMode="decimal"
                numeric
                onChange={(event) => setUnitPrice(event.target.value)}
                value={unitPrice}
              />
            </Field>
          </div>
          {itemPrices.note}
          <Button
            className="border-dashed"
            disabled={
              !selectedPartDraft ||
              !quantity ||
              !unitPrice ||
              Number(quantity) < 1 ||
              Number(unitPrice) < 0
            }
            onClick={addDraftItem}
            size="wide"
          >
            <Plus aria-hidden />
            {t('addPart')}
          </Button>

          {draftItems.length > 0 && (
            <div
              aria-label={t('orderItems')}
              className="border-app-line grid gap-2 border-t pt-3"
            >
              {draftItems.map((item) => (
                <div
                  className="rz-inset grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2"
                  key={item.part.id}
                >
                  <div className="min-w-0">
                    <p className="rz-strong m-0 truncate font-medium">
                      {item.part.name}
                    </p>
                    <p className="rz-caption rz-mono m-0">
                      {item.quantity} ×{' '}
                      {money(item.unitPrice, guard.currency, locale)}
                    </p>
                  </div>
                  <p className="rz-num rz-strong m-0 whitespace-nowrap">
                    {money(
                      item.quantity * item.unitPrice,
                      guard.currency,
                      locale,
                    )}
                  </p>
                  <Button
                    aria-label={t('removeItem', { name: item.part.name })}
                    size="icon"
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
              {/* A chosen customer is the current selection: the one place
                  the brand edge is allowed on a field. */}
              <SearchInput
                className={
                  customerId ? 'border-brand bg-brand-soft' : undefined
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
                <ul className="m-0 grid list-none gap-1 p-0">
                  {customerResults.map((customer) => (
                    <li key={customer.id}>
                      <Button
                        size="wide"
                        aria-label={t('pickCustomer', { name: customer.name })}
                        className={cn(
                          'justify-between',
                          customer.id === customerId &&
                            'border-brand bg-brand-soft',
                        )}
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
                        <span className="rz-dim font-mono text-caption">
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
                size="sm"
                type="button"
              >
                <Plus aria-hidden />
                {t('createCustomer')}
              </Button>
            )}
            {customerMutationAllowed && !customerId && newCustomerFormOpen && (
              <fieldset className="rz-inset m-0 grid gap-3">
                <legend className="rz-label float-left mb-1 w-full p-0">
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
                <div className="rz-btn-row">
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
        <div aria-label={t('summary')} className="rz-inset mt-3" role="group">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="rz-muted m-0">{t('orderTotal')}</p>
              <p className="rz-caption m-0">
                {t('itemCount', { count: draftItems.length })}
              </p>
            </div>
            <p className="rz-mono rz-strong m-0 text-title">
              {money(draftItemsTotal, guard.currency, locale)}
            </p>
          </div>
        </div>
      )}
    </form>
  )
  return (
    <Sheet
      description={t('sheetDescription')}
      eyebrow={t('sheetEyebrow')}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="basis-full empty:hidden">{itemPrices.saveNotes}</div>
          <div className="rz-btn-row ml-auto">
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
  const historyTitleId = useId()
  const guard = useFirstPriceGuard()
  const currency = guard.currency
  const tp = useT(paymentMessages)
  const tl = useT(lostResponseMessages)
  // An item typed in the add-item drawer survives the currency setting.
  const itemDraft = useCurrencyDraft<OrderItemDraft>(`order-item:${orderId}`)
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
      if (!isAmbiguousMutationFailure(error)) {
        if (replay) replayKeys.clear(replay.operation)
        setError(errorMessage(error))
        return false
      }
      // The answer was lost, not necessarily the write: read the order back
      // before anything else. Confirm and refund carry an Idempotency-Key, so
      // their retry (same key) is safe; other edits say to check first.
      try {
        const fresh = await ordersApi.getById(orderId)
        acceptOrder(fresh)
        const landed =
          replay !== undefined &&
          fresh.status === REPLAY_SETTLED_STATUS[replay.operation]
        if (landed) {
          replayKeys.clear(replay.operation)
          setError(null)
          return true
        }
        setError(replay ? tl('notSaved') : tl('reread'))
      } catch {
        setError(tl('checkFailed'))
      }
      return false
    } finally {
      setBusy(false)
    }
  }
  if (error && !order)
    return (
      <div className="rz-page max-w-[1240px]">
        <ErrorState
          description={error}
          onRetry={() => void reload()}
          title={t('loadFailed')}
        />
      </div>
    )
  if (!order)
    return (
      <div className="rz-page max-w-[1240px]">
        <SkeletonRows label={t('loading')} rows={4} />
      </div>
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
      // One key per payment set: a retry after a lost answer replays the
      // first result instead of recording the money twice.
      const idempotencyKey = replayKeys.forPayload(
        scope.tenantId,
        'order-payments',
        [order.id, payments],
      )
      const updated = await ordersApi.updatePayments(order.id, payments, {
        idempotencyKey,
      })
      replayKeys.clear('order-payments')
      if (scope.signal.aborted) return
      acceptOrder(updated)
      setPaymentOrderId(null)
      toast?.show({ message: tp('saved'), tone: 'ok' })
    } catch (failure) {
      if (!isUnknownOutcome(failure)) {
        replayKeys.clear('order-payments')
        setPaymentOutcome({ kind: 'refused', message: errorMessage(failure) })
        return
      }
      setPaymentOutcome({ kind: 'checking' })
      try {
        const fresh = await ordersApi.getById(order.id)
        acceptOrder(fresh)
        if (paymentRecorded(before, fresh.payments, added)) {
          replayKeys.clear('order-payments')
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
    <div className="grid content-start">
      <header className="rz-topbar h-auto min-h-topbar flex-wrap gap-y-1.5 py-1.5">
        <p className="rz-crumbs m-0">
          <Link className="flex items-center gap-1" to={ordersPath}>
            <ChevronLeft aria-hidden className="size-3.5" />
            {t('backToOrders')}
          </Link>
          <ChevronRight aria-hidden className="size-3" />
          <span className="max-sm:hidden">{t('eyebrow')}</span>
          <ChevronRight aria-hidden className="size-3 max-sm:hidden" />
          <span aria-current="page">
            {t('orderTitle', { number: String(order.number) })}
          </span>
        </p>
        <div className="rz-topbar__actions flex-wrap items-center">
          <Button disabled title={t('printUnavailable')}>
            <Printer aria-hidden />
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
      </header>

      <div className="rz-page max-w-[1240px]">
        <div className="grid gap-2">
          <div className="rz-page-head">
            <h1 className="rz-h-page">
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
            <p className="rz-muted m-0">
              {t('createdBy', {
                when: formatTimestamp(order.createdAt),
                who: order.createdByName,
              })}
            </p>
          </div>
          {deliveryMoney === null ? (
            <OrderSteps steps={orderSteps(order, formatTimestamp, locale)} />
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
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid min-w-0 flex-[1_1_480px] gap-4">
              {itemsEditable ? (
                <SectionPanel
                  aside={
                    <span className="rz-mono">
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
                    <p className="text-app-muted m-0">{t('noItems')}</p>
                  )}
                  <ul className="m-0 grid list-none p-0">
                    {visibleItems.map((item, visibleIndex) => {
                      const index =
                        (itemsPage - 1) * itemsPageSize + visibleIndex
                      return (
                        <li
                          className="border-app-line grid gap-3 border-t py-2.5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                          key={item.id}
                        >
                          <div className="min-w-0">
                            <p className="rz-strong m-0 truncate font-medium">
                              {item.partName}
                            </p>
                            <p className="rz-caption rz-mono m-0">
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
                            <div className="rz-field w-20">
                              <span aria-hidden className="rz-label">
                                {t('quantity')}
                              </span>
                              <TextInput
                                aria-label={t('quantityOf', {
                                  name: item.partName,
                                })}
                                className="rz-input--sm"
                                inputMode="numeric"
                                numeric
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
                            <div className="rz-field w-28">
                              <span aria-hidden className="rz-label">
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
                                className="rz-input--sm"
                                inputMode="decimal"
                                numeric
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

            <aside className="grid max-w-full min-w-0 flex-[1_1_280px] gap-4 lg:sticky lg:top-(--rz-topbar-h) lg:max-w-95">
              {deliveryOrder ? null : (
                <OrderDueCard
                  actions={
                    ordinaryFinance && order.status === 'pending' ? (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() => setPaymentOrderId(order.id)}
                          size="wide"
                          variant="primary"
                        >
                          {t('addPayment')}
                        </Button>
                        {/* Confirming is the operator's acknowledgement of
                            full payment (R-10): it does not wait for a
                            payment and compares nothing with the value. */}
                        <Button
                          disabled={busy}
                          size="wide"
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
                        onClick={() => changeRefundOpen(!refundOpen)}
                        size="wide"
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

              <section aria-labelledby={historyTitleId} className="rz-card">
                <div className="rz-card__head py-2">
                  <h2 className="rz-h-card" id={historyTitleId}>
                    {t('history')}
                  </h2>
                </div>
                {historyRows.length === 0 ? (
                  <p className="rz-card__body text-app-muted m-0">
                    {t('historyEmpty')}
                  </p>
                ) : (
                  <>
                    <OrderTimeline
                      label={t('historyLabel')}
                      rows={visibleHistoryRows}
                      title={(eventType) => orderEventTitle(eventType, locale)}
                      when={formatTimestamp}
                    />
                    {historyRows.length > 3 ? (
                      <div className="rz-card__foot">
                        <Button
                          className="justify-center"
                          onClick={() =>
                            setHistoryExpanded((expanded) => !expanded)
                          }
                          size="wide"
                          variant="quiet"
                        >
                          {historyExpanded
                            ? t('historyCollapse')
                            : t('historyExpand')}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
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
          draft={itemDraft.initial}
          error={addingItem ? error : null}
          guard={guard}
          onKeepDraft={itemDraft.keep}
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
