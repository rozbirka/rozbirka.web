import { NewOrderItems } from './NewOrderItems'
import {
  orderItemPrice,
  restoreOrderItems,
  validOrderDraftItem,
} from './order-draft-items'
import { CustomerSearchPicker } from '@/components/customers/CustomerSearchPicker'
import { localizeApiError } from '@/api/error-localization'
import { CabinetLoadingContent } from '../loading-screen'
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
  ArrowLeft,
  Banknote,
  Check,
  ChevronRight,
  RefreshCw,
  Undo2,
  ClipboardList,
  Plus,
  SearchX,
  Trash2,
  X,
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
  SearchInput,
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
} from '@/api/customers'
import {
  ordersApi,
  type ConfirmPayment,
  type OrderDetail,
  type OrderListItem,
} from '@/api/orders'
import { type PartPickerItem } from '@/components/parts/PartSearchPicker'
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
import { SheetGroup } from './sheet-group'
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
  return localizeApiError(problem, locale)
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
          key={orderId}
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
    <OrderDetailScreen key={id} definition={definition} orderId={id} />
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
  /** False until the first answer: the list shows skeleton rows, not «empty». */
  const [loaded, setLoaded] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  /** Bumped by «Спробувати ще раз» to ask for the same page again. */
  const [attempt, setAttempt] = useState(0)
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
        setPageSize(result.pageSize)
        setError(null)
        setLoaded(true)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setError(errorMessage(error))
        setLoaded(true)
      })
    return () => controller.abort()
    // The message is chosen when the request fails, not re-run per locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, page, search, status, attempt])

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    next.set('page', '1')
    setParams(next, { flushSync: name === 'q' })
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
            className="rz-mono w-fit"
            onClick={(event) => event.stopPropagation()}
            to={order.id}
          >
            #{order.number}
          </Link>
          <span className="rz-caption rz-mono font-normal">
            {day(order.createdAt)}
          </span>
        </span>
      ),
    },
    {
      key: 'buyer',
      label: t('columnBuyer'),
      cell: (order) => (
        <span
          className={cn(
            'block max-w-72 truncate',
            order.customerName === null ? 'rz-muted' : 'rz-strong',
          )}
        >
          {order.customerName ?? t('noBuyer')}
        </span>
      ),
    },
    {
      key: 'items',
      label: t('columnItems'),
      cell: (order) => (
        <span className="grid min-w-0 max-w-96 py-1.5">
          <span
            className="text-app-ink truncate"
            title={
              order.partNames.length === 0
                ? undefined
                : order.partNames.join(', ')
            }
          >
            {t('itemCount', { count: order.itemCount })}
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
            'rz-mono whitespace-nowrap',
            UNPAID_STATUSES.has(order.status) && 'rz-dim',
          )}
        >
          {listMoney(order.totalAmount, accountingCurrency, locale)}
        </span>
      ),
    },
  ]
  const newOrderButton = createAllowed ? (
    <Button asChild variant="primary">
      <Link to="new">
        <Plus aria-hidden />
        {t('newOrder')}
      </Link>
    </Button>
  ) : undefined
  /** An account with no orders at all: the head and the filters say nothing. */
  const firstRun = loaded && error === null && orders.length === 0 && !filtered

  return (
    <RedesignShell
      actions={newOrderButton}
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
        {loaded && error === null && !firstRun ? (
          <>
            <span className="rz-muted">
              {t('orderCount', { count: total })}
            </span>
            <dl className="rz-totals">
              <div className="flex items-baseline gap-1.5">
                <dt>{t('pageSum')}</dt>
                <dd className="rz-strong">
                  {listMoney(pageSum, accountingCurrency, locale)}
                </dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>

      {firstRun ? null : (
        <div className="rz-toolbar" role="search">
          <SearchInput
            aria-label={t('searchLabel')}
            className="sm:max-w-80"
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
              </button>
            ))}
          </div>
          {filtered ? (
            <Button onClick={resetFilters} variant="ghost">
              {t('resetFilters')}
            </Button>
          ) : null}
        </div>
      )}

      <section aria-label={t('listLabel')}>
        {error !== null ? (
          <ErrorState
            description={error}
            onRetry={() => setAttempt((value) => value + 1)}
            title={t('loadFailed')}
          />
        ) : !loaded ? (
          <CabinetLoadingContent
            module="orders"
            heading={false}
            label={t('loading')}
          />
        ) : (
          <DataTable
            caption={t('listLabel')}
            columns={columns}
            empty={
              <div
                className={cn('rz-state', !filtered && 'rz-state--brand')}
                role="status"
              >
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
                  <Button onClick={resetFilters}>
                    <X aria-hidden />
                    {t('resetFilters')}
                  </Button>
                ) : (
                  newOrderButton
                )}
              </div>
            }
            footer={
              <Pagination
                label={t('pagesLabel')}
                onPage={goToPage}
                page={page}
                totalPages={Math.max(totalPages, 1)}
                {...(pageSize === undefined || total === 0
                  ? {}
                  : { pageSize, total })}
              />
            }
            onRowClick={(order) => void navigate(order.id)}
            rowKey={(order) => order.id}
            rows={orders}
          />
        )}
      </section>
    </RedesignShell>
  )
}

/** What the order form keeps across the trip to the currency setting. */
interface OrderFormDraft {
  partId?: string
  partQuery?: string
  customerId: string
  customerQuery: string
  selectedCustomerName: string
  quantity?: string
  unitPrice?: string
  notes: string
  draftItems: {
    part: PartPickerItem
    quantity: number
    unitPrice: number | string
    priceBeforeEdit?: string | undefined
  }[]
  selectedPartDraft?: PartPickerItem | null
  editingPartId?: string | null
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
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerFormOpen, setNewCustomerFormOpen] = useState(false)
  const [newCustomerPhone, setNewCustomerPhone] = useState(() =>
    newCustomerPhoneDraft(phoneCountry),
  )
  const [customerConflict, setCustomerConflict] =
    useState<CustomerPhoneConflict | null>(null)
  const [customerBusy, setCustomerBusy] = useState(false)
  const [notes, setNotes] = useState(() => restored?.notes ?? '')
  const guard = useFirstPriceGuard()
  const { locale } = useLocale()
  const [draftItems, setDraftItems] = useState(() =>
    restoreOrderItems(restored),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const draftItemsValid =
    draftItems.length > 0 &&
    draftItems.every((item) =>
      validOrderDraftItem(item, guard.currency, locale),
    )
  const itemPrices = usePriceSlots(guard, {
    values: draftItems.map((item) => item.unitPrice),
    onAccept: (accepted) => void submit(undefined, accepted),
    draftKept: true,
    onLeave: () =>
      draft.keep({
        partQuery,
        customerId,
        customerQuery,
        selectedCustomerName,
        notes,
        draftItems,
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
  const submit = async (
    event?: FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    if (busy || !dependenciesAllowed || !draftItemsValid || itemPrices.disabled)
      return
    const creationItems = draftItems.map((item) => ({
      partId: item.part.id,
      quantity: item.quantity,
      unitPrice: orderItemPrice(item.unitPrice)!,
    }))
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
      // Module 00 §5: open the created record first, then confirm it.
      await navigate(detailPath, { replace: true })
      toast?.show({ message: t('created'), tone: 'ok' })
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
      closeNewCustomerForm()
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
      closeNewCustomerForm()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setCustomerBusy(false)
    }
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
  const draftUnitCount = draftItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  )
  const draftItemsTotal = draftItems.reduce(
    (sum, item) => sum + item.quantity * (orderItemPrice(item.unitPrice) ?? 0),
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
    !mutationsAllowed || busy || itemPrices.disabled || !draftItemsValid
  const totalsComplete = draftItems.every((item) => {
    const price = orderItemPrice(item.unitPrice)
    return price !== null && Number.isFinite(price) && price >= 0
  })
  const form = (
    <form
      className="new-order-form grid gap-4"
      id={ORDER_FORM}
      onSubmit={(event) => void submit(event)}
    >
      {error && <Notice tone="danger">{error}</Notice>}
      <NewOrderItems
        items={draftItems}
        onChange={setDraftItems}
        currency={guard.currency}
        priceHint={itemPrices.hint}
        inputCurrency={itemPrices.currency}
        disabled={busy}
        pricesDisabled={itemPrices.disabled}
        query={partQuery}
        onQueryChange={setPartQuery}
      />
      {itemPrices.note}
      {customerSearchAllowed && (
        <SheetGroup
          hint={customerId ? undefined : t('customerDescription')}
          title={t('customerTitle')}
        >
          <div className="grid gap-3">
            <CustomerSearchPicker
              selectionAppearance="card"
              createLabel={t('createCustomer')}
              onCreate={
                customerMutationAllowed && !customerId && !newCustomerFormOpen
                  ? () => setNewCustomerFormOpen(true)
                  : undefined
              }
              disabled={busy || customerBusy}
              hint={customerId ? undefined : t('noCustomerChosen')}
              onQueryChange={setCustomerQuery}
              selectedName={selectedCustomerName}
              onClear={() => {
                setCustomerId('')
                setSelectedCustomerName('')
                setCustomerQuery('')
              }}
              onSelect={(customer) => {
                setCustomerId(customer.id)
                setSelectedCustomerName(customer.name)
                setCustomerQuery(customer.name)
              }}
              query={customerQuery}
              selectedId={customerId || null}
            />
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
        </SheetGroup>
      )}
      <Field hint={t('notesHint')} label={t('notes')}>
        <TextArea
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </Field>

      <SheetGroup title={t('summary')}>
        <div className="rz-inset grid gap-0 bg-(--rz-sheet-band) py-1">
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="rz-muted">
              {t('unitCount', { count: draftUnitCount })}
            </span>
            <span className="rz-mono">
              {totalsComplete
                ? money(draftItemsTotal, guard.currency, locale)
                : '—'}
            </span>
          </div>
          <div className="border-app-line flex items-baseline justify-between gap-3 border-t py-1.5">
            <span className="rz-strong font-semibold">{t('orderTotal')}</span>
            <span className="rz-mono rz-strong font-bold">
              {totalsComplete
                ? money(draftItemsTotal, guard.currency, locale)
                : '—'}
            </span>
          </div>
        </div>
      </SheetGroup>
    </form>
  )
  return (
    <Sheet
      onEscapeKeyDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-order-price-edit]')
        )
          event.preventDefault()
      }}
      size="lg"
      description={t('sheetDescription')}
      eyebrow={t('sheetEyebrow')}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="basis-full empty:hidden">{itemPrices.saveNotes}</div>
          <p className="rz-muted rz-mono m-0 mr-auto text-caption">
            {draftItems.length
              ? `${t('unitCount', { count: draftUnitCount })} · ${totalsComplete ? money(draftItemsTotal, guard.currency, locale) : '—'}`
              : t('addFirstItem')}
          </p>
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
  const notesResultRef = useRef<Pick<
    OrderDetail,
    'id' | 'notes' | 'history'
  > | null>(null)
  const [itemDrafts, setItemDrafts] = useState<OrderDetail['items']>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundOpen, setRefundOpen] = useState(false)
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null)
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
            setConfirmOrderId(null)
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
  const ordersPath = location.pathname.replace(/\/orders\/.*$/, '/orders')
  const crumbTrail = (current: string) => (
    <>
      <span className="max-sm:hidden">{t('eyebrow')}</span>
      <ChevronRight aria-hidden className="size-3 max-sm:hidden" />
      <Link to={ordersPath}>{t('title')}</Link>
      <ChevronRight aria-hidden className="size-3" />
      <span aria-current="page">{current}</span>
    </>
  )
  if (error && !order)
    return (
      <RedesignShell crumb={crumbTrail(t('title'))} width="record">
        <ErrorState
          actions={
            <>
              <Button asChild>
                <Link to={ordersPath}>
                  <ArrowLeft aria-hidden />
                  {t('backToOrders')}
                </Link>
              </Button>
              <Button onClick={() => void reload()}>
                <RefreshCw aria-hidden />
                {tc('retry')}
              </Button>
            </>
          }
          description={error}
          title={t('loadFailed')}
        />
      </RedesignShell>
    )
  if (!order)
    return (
      <RedesignShell crumb={crumbTrail(t('title'))} width="record">
        <CabinetLoadingContent module="orders" label={t('loading')} />
      </RedesignShell>
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
  const canConfirm = ordinaryFinance && order.status === 'pending'
  const confirmOpen =
    canConfirm && confirmOrderId === order.id && order.id === orderId
  const canRefund = ordinaryFinance && order.status === 'confirmed'
  const confirmOrder = () => {
    if (busy || !confirmOpen) return
    const input = {
      payments: order.payments.map(({ accountId, amount, currency }) => ({
        accountId,
        amount,
        currency,
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
    ).then((done) => {
      if (done) setConfirmOrderId(null)
    })
  }
  const notesCard = (
    <OrderNotesCard
      key={order.id}
      busy={busy}
      editable={mutationsAllowed}
      notes={order.notes}
      onSave={async (value) => {
        const scope = requireLatestMutation({ quota: false })
        notesResultRef.current = null
        const saved = await ordersApi.updateNotes(order.id, value, {
          signal: scope.signal,
        })
        if (scope.signal.aborted)
          throw new DOMException('Aborted', 'AbortError')
        notesResultRef.current = saved
        return saved.notes
      }}
      onSaved={(value) => {
        const saved = notesResultRef.current
        notesResultRef.current = null
        setOrder((current) =>
          current?.id === order.id
            ? {
                ...current,
                notes: value,
                // NotesUpdated is server history; preserve unrelated drafts/state.
                history:
                  saved?.id === current.id &&
                  saved.notes === value &&
                  Array.isArray(saved.history)
                    ? saved.history
                    : current.history,
              }
            : current,
        )
      }}
      readBack={async () => {
        const scope = requireLatestMutation({ quota: false })
        const fresh = await ordersApi.getById(order.id, {
          signal: scope.signal,
        })
        if (scope.signal.aborted)
          throw new DOMException('Aborted', 'AbortError')
        notesResultRef.current = fresh
        return fresh.notes
      }}
    />
  )
  return (
    <RedesignShell
      actions={
        <>
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
          {/* Confirming is the operator's acknowledgement of full payment
              (R-10): it does not wait for a payment and compares nothing
              with the value. */}
          {canConfirm ? (
            <Button
              disabled={busy}
              onClick={() => {
                setError(null)
                setConfirmOrderId(order.id)
              }}
              variant="primary"
            >
              <Check aria-hidden />
              {t('confirmOrder')}
            </Button>
          ) : canRefund ? (
            <Button onClick={() => changeRefundOpen(!refundOpen)}>
              <Undo2 aria-hidden />
              {t('startRefund')}
            </Button>
          ) : null}
        </>
      }
      crumb={crumbTrail(`#${String(order.number)}`)}
      width="record"
    >
      <div className="grid gap-1.5">
        <div className="rz-page-head">
          <h1 className="rz-h-page">
            {t('orderTitle', { number: String(order.number) })}
          </h1>
          {deliveryMoney === null ? (
            <OrderSteps steps={orderSteps(order, formatTimestamp, locale)} />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
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
          <p className="rz-caption m-0">
            {t('createdBy', {
              when: formatTimestamp(order.createdAt),
              who: order.createdByName,
            })}
          </p>
        </div>
      </div>

      {deliveryMoney === null ? null : (
        <>
          <DeliveryOrderBody
            customerSearchAllowed={
              cabinet.status === 'ready' &&
              cabinet.snapshot?.permissions.has('customers.view') === true
            }
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
          {notesCard}
        </>
      )}

      {error && paymentOrderId !== order.id && !refundOpen && !confirmOpen ? (
        <Notice tone="danger">{error}</Notice>
      ) : null}

      {deliveryOrder ? null : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-3.5">
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
                      disabled={busy || !itemDraftsValid || itemPrices.disabled}
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
                    const index = (itemsPage - 1) * itemsPageSize + visibleIndex
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
                                          quantity: Number(event.target.value),
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

            <OrderPaymentsCard
              action={
                canConfirm ? (
                  <Button
                    className="relative after:absolute after:-inset-2 after:content-['']"
                    disabled={busy}
                    onClick={() => setPaymentOrderId(order.id)}
                    size="sm"
                  >
                    <Banknote aria-hidden />
                    {t('addPayment')}
                  </Button>
                ) : null
              }
              paidLine={
                summary.paid.length === 0
                  ? null
                  : moneyList(summary.paid, ' · ', locale)
              }
              payments={order.payments}
            />

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
          </div>

          <aside className="grid min-w-0 gap-3.5 lg:sticky lg:top-(--rz-topbar-h)">
            <OrderDueCard
              accountingCurrency={currency}
              actions={null}
              hint={
                canConfirm
                  ? tp('confirmNote')
                  : canRefund
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

            <OrderCustomerCard
              accountingCurrency={currency}
              customerId={order.customerId}
              customerName={order.customerName}
              initials={initials(order.customerName ?? '—')}
              onChange={orderEditable ? () => setCustomerOpen(true) : undefined}
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

            {notesCard}
          </aside>
        </div>
      )}
      <ConfirmDialog
        confirmLabel={t('confirmOrder')}
        consequence={tp('confirmNote')}
        destructive={false}
        error={confirmOpen ? error : null}
        onConfirm={confirmOrder}
        onOpenChange={(next) => {
          if (!next && !busy) {
            setConfirmOrderId(null)
            setError(null)
          }
        }}
        open={confirmOpen}
        pending={busy}
        title={t('confirmTitle', { number: String(order.number) })}
      />
      <ConfirmDialog
        confirmLabel={tp('refundLabel')}
        confirmDisabled={!refundReason.trim()}
        consequence={t('refundConsequence')}
        destructive
        effects={refundEffects(order, summary, locale)}
        error={refundOpen ? error : null}
        onConfirm={() => {
          const normalizedReason = refundReason.trim()
          if (!normalizedReason) return
          const input = { refundReason: normalizedReason }
          const returnsMoney = summary.paid.length > 0
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
            if (!done) return
            changeRefundOpen(false)
            // Module 20, 6.5. Without payments the order is only cancelled.
            if (returnsMoney)
              toast?.show({ message: tp('statusRefunded'), tone: 'ok' })
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
    </RedesignShell>
  )
}

const ORDER_FORM = 'order-create-form'
