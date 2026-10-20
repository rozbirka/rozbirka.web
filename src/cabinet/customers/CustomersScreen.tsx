import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Power,
  PowerOff,
  SearchX,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Amount,
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  type DataColumn,
  DeniedState,
  ErrorState,
  Field,
  Notice,
  Pagination,
  SearchInput,
  SectionPanel,
  SelectInput,
  Sheet,
  SkeletonRows,
  StatusPill,
  TextArea,
  TextInput,
  useOperation,
} from '@/components/app'
import {
  CUSTOMER_ADDRESS_MAX_LENGTH,
  customerAddressChanges,
  customerAddressForCreate,
  customersApi,
  readCustomerAddress,
  readCustomerPhoneConflict,
  type CustomerAddress,
  type CustomerAddressField,
  type CustomerDetail,
  type CustomerListItem,
  type CustomerPhoneConflict,
} from '@/api/customers'
import { normalizeApiProblem } from '@/api/errors'
import { useTenantSettings } from '@/auth/useTenantSettings'
import {
  commonMessages,
  intlLocale,
  useFormat,
  useLocale,
  useT,
  type Translate,
} from '@/i18n'
import { phoneExample } from '@/lib/phone'
import { orderStatusPresentation } from '../orders/order-labels'
import type { Permission } from '../access-types'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { useCabinet } from '../CabinetContext'
import { useAccountingCurrency } from '../currency/use-accounting-currency'
import {
  evaluateModuleAccess,
  ModuleAccessDeniedError,
  type ModuleAccessOperation,
} from '../policy'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { cabinetModules } from '../module-registry'
import { RedesignShell } from '../redesign-shell'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { OrderForm } from '../orders/OrdersScreen'
import {
  customerPhoneForSave,
  displayCustomerPhone,
  isCustomerPhoneAcceptable,
  newCustomerPhoneDraft,
  normalizeCustomerPhoneDraft,
} from './customer-phone'
import {
  customerAddressDraft,
  customerAddressLines,
  customerCountryOptions,
  type CustomerAddressDraft,
} from './customer-address'
import { customerFormMessages } from './customer-form-messages'
import { customerMessages } from './messages'

type FormText = Translate<(typeof customerFormMessages)['uk']>

/** Turns a failed save into a reason the user can act on. */
const saveProblem = (failure: unknown, t: FormText): string => {
  const conflict = readCustomerPhoneConflict(failure)
  if (conflict) return conflict.message
  if (failure instanceof ModuleAccessDeniedError) return t('accessLost')
  return normalizeApiProblem(failure).message
}
const idFromPath = (path: string) =>
  /\/customers\/([^/]+)/.exec(path)?.[1] ?? null
const customerDirectoryPath = (path: string) =>
  path.replace(/\/new$|\/[^/]+\/edit$/, '')
function canAccess(
  definition: CabinetModuleScreenProps['definition'],
  cabinet: ReturnType<typeof useCabinet>,
  operation: ModuleAccessOperation,
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
      : operation === 'view'
        ? { ...definition, viewPermission: permission }
        : { ...definition, mutationPermission: permission }
  return (
    evaluateModuleAccess(scopedDefinition, access, operation).kind === 'allowed'
  )
}

export function CustomersScreen({ definition }: CabinetModuleScreenProps) {
  const location = useLocation()
  const id = idFromPath(location.pathname)
  if (location.pathname.endsWith('/new'))
    return (
      <>
        <CustomerDirectory definition={definition} />
        <CustomerForm definition={definition} customerId={null} />
      </>
    )
  if (location.pathname.endsWith('/edit') && id)
    return (
      <>
        <CustomerDetailScreen definition={definition} customerId={id} />
        <CustomerForm definition={definition} customerId={id} />
      </>
    )
  return id ? (
    <CustomerDetailScreen definition={definition} customerId={id} />
  ) : (
    <CustomerDirectory definition={definition} />
  )
}

/**
 * Dates arrive as ISO strings and read as a day in the business time zone;
 * anything unparsable is shown as it came.
 */
function useDay() {
  const format = useFormat()
  return (value: string) => format.date(value) ?? value
}

/** Two initials for the avatar chip; a single word gives one. */
const customerInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

/** How a customer is grouped by how often they buy. */
const CUSTOMER_SEGMENTS = [
  { value: 'all' as const, label: 'segmentAll' as const },
  { value: 'regular' as const, label: 'segmentRegular' as const },
  { value: 'once' as const, label: 'segmentOnce' as const },
  { value: 'none' as const, label: 'segmentNone' as const },
]

type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number]['value']

/** From how many orders a customer counts as a regular. */
const REGULAR_FROM = 3

const segmentOf = (ordersCount: number): CustomerSegment =>
  ordersCount >= REGULAR_FROM ? 'regular' : ordersCount > 0 ? 'once' : 'none'

const SEGMENT_TAGS = {
  all: 'tagAll',
  regular: 'tagRegular',
  once: 'tagOnce',
  none: 'tagNone',
} as const

const segmentTag = (ordersCount: number) => SEGMENT_TAGS[segmentOf(ordersCount)]

const CUSTOMER_SORTS = [
  { value: 'sum' as const, label: 'sortSum' as const },
  { value: 'name' as const, label: 'sortName' as const },
]

type CustomerSort = (typeof CUSTOMER_SORTS)[number]['value']

function CustomerDirectory({ definition }: CabinetModuleScreenProps) {
  const t = useT(customerMessages)
  const { locale } = useLocale()
  const day = useDay()
  const { currency: accountingCurrency } = useAccountingCurrency()
  const cabinet = useCabinet()
  const navigate = useNavigate()
  const mutationsAllowed = canAccess(definition, cabinet, 'mutation')
  const financeViewAllowed = canAccess(
    definition,
    cabinet,
    'view',
    'finance.view',
  )
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? 1) || 1
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [error, setError] = useState(false)
  const [segment, setSegment] = useState<CustomerSegment>('all')
  const [sort, setSort] = useState<CustomerSort>('sum')

  useEffect(() => {
    const controller = new AbortController()
    void customersApi
      .list({ ...(q ? { q } : {}), page }, { signal: controller.signal })
      .then((result) => {
        setCustomers(result.items)
        setTotal(result.total)
        setTotalPages(result.totalPages)
        setError(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [page, q])

  const counts: Record<CustomerSegment, number> = {
    all: customers.length,
    regular: 0,
    once: 0,
    none: 0,
  }
  for (const customer of customers) counts[segmentOf(customer.ordersCount)] += 1
  const rows = customers
    .filter(
      (customer) =>
        segment === 'all' || segmentOf(customer.ordersCount) === segment,
    )
    .sort((left, right) =>
      sort === 'name'
        ? left.name.localeCompare(right.name, intlLocale(locale))
        : (right.totalAmount ?? 0) - (left.totalAmount ?? 0),
    )
  const filtered = q !== '' || segment !== 'all'

  const columns: DataColumn<CustomerListItem>[] = [
    {
      key: 'customer',
      label: t('columnCustomer'),
      variant: 'primary',
      cell: (customer) => (
        <span className="rz-cell-main">
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="rz-avatar rz-avatar--round size-7 shrink-0"
            >
              {customerInitials(customer.name)}
            </span>
            <span className="grid min-w-0">
              <Link
                className="text-app-strong truncate"
                onClick={(event) => event.stopPropagation()}
                to={customer.id}
              >
                {customer.name}
              </Link>
              <span className="rz-caption font-normal">
                {t(segmentTag(customer.ordersCount))}
              </span>
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'phone',
      label: t('columnPhone'),
      cell: (customer) => (
        <span
          className={cn(
            'font-mono whitespace-nowrap',
            customer.phone === null ? 'rz-dim' : 'text-app-ink',
          )}
        >
          {customer.phone === null ? '—' : displayCustomerPhone(customer.phone)}
        </span>
      ),
    },
    {
      key: 'last',
      label: t('columnLastPurchase'),
      cell: (customer) => (
        <span
          className={cn(
            'font-mono whitespace-nowrap',
            customer.lastOrderAt === null && 'rz-dim',
          )}
        >
          {customer.lastOrderAt === null ? '—' : day(customer.lastOrderAt)}
        </span>
      ),
    },
    {
      key: 'orders',
      label: t('columnOrders'),
      align: 'end',
      cell: (customer) => (
        <span className={cn(customer.ordersCount === 0 && 'rz-dim')}>
          {customer.ordersCount}
        </span>
      ),
    },
    ...(financeViewAllowed
      ? [
          {
            key: 'amount',
            label: t('columnAmount'),
            align: 'end' as const,
            cell: (customer: CustomerListItem) => (
              <span
                className={cn(
                  'whitespace-nowrap',
                  (customer.totalAmount ?? 0) > 0 ? '' : 'rz-dim',
                )}
              >
                {customer.totalAmount === null || customer.totalAmount === 0 ? (
                  '—'
                ) : (
                  <Amount
                    currency={accountingCurrency}
                    currencyDisplay="code"
                    value={customer.totalAmount}
                  />
                )}
              </span>
            ),
          },
        ]
      : []),
  ]

  return (
    <RedesignShell
      actions={
        mutationsAllowed ? (
          <Button asChild variant="primary">
            <Link to="new">
              <Plus aria-hidden />
              {t('newCustomer')}
            </Link>
          </Button>
        ) : undefined
      }
      crumb={
        <>
          <span>{t('section')}</span>
          <ChevronRight aria-hidden className="size-3" />
          <span aria-current="page">{t('title')}</span>
        </>
      }
    >
      <div className="rz-page-head">
        <h1 className="rz-h-page">{t('title')}</h1>
        {totalPages > 1 ? (
          <p className="rz-muted m-0 max-w-[72ch] text-pretty">
            {t('pageScope', { count: total })}
          </p>
        ) : null}
      </div>

      <div className="rz-toolbar" role="search">
        <SearchInput
          aria-label={t('searchLabel')}
          onChange={(event) =>
            setParams(
              event.target.value ? { q: event.target.value, page: '1' } : {},
            )
          }
          placeholder={t('searchPlaceholder')}
          value={q}
        />
        <div
          aria-label={t('segmentsLabel')}
          className="rz-seg max-w-full flex-wrap"
          role="radiogroup"
        >
          {CUSTOMER_SEGMENTS.map((option) => (
            <button
              aria-checked={option.value === segment}
              key={option.value}
              onClick={() => setSegment(option.value)}
              role="radio"
              type="button"
            >
              {t(option.label)}
              <span className="rz-count">{counts[option.value]}</span>
            </button>
          ))}
        </div>
        <div className="rz-toolbar__end items-center gap-2">
          <span className="rz-eyebrow" id="customer-sort-label">
            {t('sortLabel')}
          </span>
          <div
            aria-labelledby="customer-sort-label"
            className="rz-seg"
            role="radiogroup"
          >
            {CUSTOMER_SORTS.map((option) => (
              <button
                aria-checked={option.value === sort}
                key={option.value}
                onClick={() => setSort(option.value)}
                role="radio"
                type="button"
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <Notice tone="danger">{t('loadError')}</Notice> : null}

      <section aria-label={t('listLabel')}>
        <DataTable
          caption={t('listLabel')}
          columns={columns}
          empty={
            <div className="rz-state" role="status">
              <span className="rz-state__icon">
                {filtered ? <SearchX aria-hidden /> : <Users aria-hidden />}
              </span>
              <h2 className="rz-state__title">
                {filtered ? t('emptyFilteredTitle') : t('emptyTitle')}
              </h2>
              <p className="rz-state__body">
                {filtered ? t('emptyFilteredHint') : t('emptyHint')}
              </p>
              {filtered ? (
                <Button
                  onClick={() => {
                    setSegment('all')
                    setParams({})
                  }}
                >
                  {t('resetFilters')}
                </Button>
              ) : null}
            </div>
          }
          footer={
            <Pagination
              label={t('pagesLabel')}
              onPage={(nextPage) => {
                const next = new URLSearchParams(params)
                next.set('page', String(nextPage))
                setParams(next)
              }}
              page={page}
              totalPages={Math.max(totalPages, 1)}
            />
          }
          onRowClick={(customer) => void navigate(customer.id)}
          rowKey={(customer) => customer.id}
          rows={rows}
        />
      </section>
    </RedesignShell>
  )
}

function CustomerDetailScreen({
  definition,
  customerId,
}: CabinetModuleScreenProps & { customerId: string }) {
  const t = useT(customerMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const day = useDay()
  const { currency: accountingCurrency } = useAccountingCurrency()
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const mutationsAllowed = canAccess(definition, cabinet, 'mutation')
  const ordersViewAllowed = canAccess(
    definition,
    cabinet,
    'view',
    'orders.view',
  )
  const financeViewAllowed = canAccess(
    definition,
    cabinet,
    'view',
    'finance.view',
  )
  const orderCreateAllowed =
    canAccess(definition, cabinet, 'mutation', 'orders.manage') &&
    cabinet.snapshot?.permissions.has('parts.view') === true
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [error, setError] = useState<'loadError' | 'copyFailed' | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false)
  const [ordersPage, setOrdersPage] = useState(1)
  /** Where focus goes when the delete question is answered or dismissed. */
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)
  const [notes, setNotes] = useState('')
  const ordersTitleId = useId()
  const navigate = useNavigate()
  const directoryPath = `/app/${cabinet.targetTenant?.slug ?? ''}/customers`
  useEffect(() => {
    if (!ordersViewAllowed) return
    const controller = new AbortController()
    void customersApi
      .getById(customerId, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setCustomer(result)
          setNotes(result.notes ?? '')
          setOrdersPage(1)
          setError(null)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('loadError')
      })
    return () => controller.abort()
  }, [customerId, ordersViewAllowed])
  const updateLifecycle = async () => {
    if (!customer || busy || !mutationsAllowed) return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      requireLatestMutation({ permission: 'orders.view', quota: false })
      setCustomer(
        customer.isActive
          ? await customersApi.deactivate(customer.id, {
              signal: scope.signal,
            })
          : await customersApi.activate(customer.id, {
              signal: scope.signal,
            }),
      )
      setError(null)
    } catch {
      setError('loadError')
    } finally {
      setBusy(false)
    }
  }
  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
    } catch {
      setError('copyFailed')
    }
  }
  const saveNotes = async () => {
    if (!customer || busy || !mutationsAllowed) return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      requireLatestMutation({ permission: 'orders.view', quota: false })
      const saved = await customersApi.update(
        customer.id,
        { notes: notes.trim() || null },
        { signal: scope.signal },
      )
      setCustomer({ ...customer, notes: saved.customer.notes })
      setNotes(saved.customer.notes ?? '')
      setError(null)
    } catch {
      setError('loadError')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!customer || busy || !mutationsAllowed || customer.ordersCount !== 0)
      return
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      requireLatestMutation({ permission: 'orders.view', quota: false })
      await customersApi.remove(customer.id, { signal: scope.signal })
      await navigate(directoryPath, { replace: true })
    } catch {
      setError('loadError')
      setBusy(false)
    }
  }
  if (!ordersViewAllowed)
    return (
      <div className="rz-page max-w-[1240px]">
        <DeniedState
          description={t('deniedDescription')}
          role="alert"
          title={t('deniedTitle')}
        />
      </div>
    )
  if (error)
    return (
      <div className="rz-page max-w-[1240px]">
        <ErrorState description={t(error)} title={t('loadFailedTitle')} />
      </div>
    )
  if (!customer)
    return (
      <div className="rz-page max-w-[1240px]">
        <SkeletonRows label={t('loading')} rows={3} />
      </div>
    )
  const ordersPath = `/app/${cabinet.targetTenant?.slug ?? ''}/orders`
  const orderHref = (orderId: string) =>
    `/app/${cabinet.targetTenant?.slug ?? ''}/orders/${orderId}`
  const ordersPageSize = 20
  const ordersTotalPages = Math.max(
    1,
    Math.ceil(customer.orders.length / ordersPageSize),
  )
  const currentOrdersPage = Math.min(ordersPage, ordersTotalPages)
  const visibleOrders = customer.orders.slice(
    (currentOrdersPage - 1) * ordersPageSize,
    currentOrdersPage * ordersPageSize,
  )
  const addressLines = customerAddressLines(customer, locale)
  const money = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? (
      <Amount
        currency={accountingCurrency}
        currencyDisplay="code"
        value={value}
      />
    ) : (
      '—'
    )

  return (
    <div className="grid content-start">
      <header className="rz-topbar h-auto min-h-topbar flex-wrap gap-y-1.5 py-1.5">
        <p className="rz-crumbs m-0">
          <Link className="flex items-center gap-1" to={directoryPath}>
            <ChevronLeft aria-hidden className="size-3.5" />
            {t('backToCustomers')}
          </Link>
          <ChevronRight aria-hidden className="size-3" />
          <span className="max-sm:hidden">{t('section')}</span>
          <ChevronRight aria-hidden className="size-3 max-sm:hidden" />
          <span aria-current="page">{customer.name}</span>
        </p>
        <div className="rz-topbar__actions flex-wrap items-center">
          {mutationsAllowed ? (
            <Button asChild>
              <Link to="edit">
                <Pencil aria-hidden />
                {tc('edit')}
              </Link>
            </Button>
          ) : null}
          {orderCreateAllowed && customer.isActive ? (
            <Button onClick={() => setOrderDrawerOpen(true)} variant="primary">
              <Plus aria-hidden />
              {t('createOrder')}
            </Button>
          ) : null}
          {mutationsAllowed ? (
            <ActionMenu
              actions={[
                {
                  key: 'lifecycle',
                  label: customer.isActive ? t('deactivate') : t('activate'),
                  icon: customer.isActive ? (
                    <PowerOff aria-hidden />
                  ) : (
                    <Power aria-hidden />
                  ),
                  disabled: busy,
                  onSelect: () => void updateLifecycle(),
                },
                {
                  key: 'delete',
                  label: t('deleteCustomer'),
                  icon: <Trash2 aria-hidden />,
                  destructive: true,
                  disabled: busy || customer.ordersCount !== 0,
                  ...(customer.ordersCount === 0
                    ? {}
                    : {
                        title: t('deleteBlocked'),
                      }),
                  onSelect: () => setConfirmDelete(true),
                },
              ]}
              label={t('moreActions')}
              triggerRef={deleteTriggerRef}
            />
          ) : null}
        </div>
      </header>

      <div className="rz-page max-w-[1240px]">
        {error ? <Notice tone="danger">{t(error)}</Notice> : null}
        {copied ? <Notice tone="ok">{t('phoneCopied')}</Notice> : null}

        <div className="grid gap-2">
          <div className="rz-page-head items-center">
            <span aria-hidden className="rz-avatar rz-avatar--round size-8">
              {customerInitials(customer.name)}
            </span>
            <h1 className="rz-h-page">{customer.name}</h1>
            <StatusPill tone={customer.isActive ? 'ok' : 'neutral'}>
              {customer.isActive ? t('active') : t('inactive')}
            </StatusPill>
          </div>
          {customer.phone === null ? (
            <p className="rz-muted m-0">{t('phoneMissing')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rz-strong font-mono">
                {displayCustomerPhone(customer.phone)}
              </span>
              <div className="rz-btn-row gap-1.5">
                <Button
                  onClick={() => void copyPhone(customer.phone ?? '')}
                  size="sm"
                >
                  <Copy aria-hidden />
                  {t('copyPhone')}
                </Button>
                <Button asChild size="sm">
                  <a href={`tel:${customer.phone}`}>
                    <Phone aria-hidden />
                    {t('call')}
                  </a>
                </Button>
                <Button asChild size="sm">
                  <a href={`sms:${customer.phone}`}>
                    <MessageSquare aria-hidden />
                    {t('sms')}
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>

        <KpiStrip>
          <Kpi
            label={t('statOrders')}
            meta=""
            tone={(customer.ordersCount ?? 0) > 0 ? 'plain' : 'dim'}
            value={
              customer.ordersCount === null ? '—' : String(customer.ordersCount)
            }
          />
          {financeViewAllowed ? (
            <>
              <Kpi
                label={t('statSpent')}
                meta=""
                tone={(customer.totalAmount ?? 0) > 0 ? 'plain' : 'dim'}
                value={money(customer.totalAmount)}
              />
              <Kpi
                label={t('statAverage')}
                meta=""
                tone={(customer.averageAmount ?? 0) > 0 ? 'plain' : 'dim'}
                value={money(
                  typeof customer.averageAmount === 'number'
                    ? Math.round(customer.averageAmount)
                    : null,
                )}
              />
            </>
          ) : null}
        </KpiStrip>

        <div className="flex flex-wrap items-start gap-4">
          <section
            aria-labelledby={ordersTitleId}
            className="rz-card min-w-0 flex-[1_1_480px]"
          >
            <div className="rz-card__head py-2">
              <h2 className="rz-h-card" id={ordersTitleId}>
                {t('orderHistory')}{' '}
                <span className="rz-dim font-mono text-caption font-normal">
                  {t('ordersCount', { count: customer.orders.length })}
                </span>
              </h2>
            </div>
            {customer.orders.length === 0 ? (
              <div className="rz-state rz-state--brand min-h-60" role="status">
                <span className="rz-state__icon">
                  <ShoppingCart aria-hidden />
                </span>
                <h3 className="rz-state__title">{t('noOrdersTitle')}</h3>
                <p className="rz-state__body text-pretty">
                  {t('noOrdersHint')}
                </p>
                {orderCreateAllowed && customer.isActive ? (
                  <Button
                    onClick={() => setOrderDrawerOpen(true)}
                    variant="primary"
                  >
                    {t('createOrder')}
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                <ul className="m-0 grid list-none p-0">
                  {visibleOrders.map((order) => {
                    const status = orderStatusPresentation(order.status, locale)
                    return (
                      <li
                        className="border-app-line border-t first:border-t-0"
                        key={order.id}
                      >
                        <Link
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-(--rz-card-p) py-2.5 transition-colors hover:bg-app-hover"
                          to={orderHref(order.id)}
                        >
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="rz-strong font-mono font-medium">
                                #{order.number}
                              </span>
                              <StatusPill tone={status.tone}>
                                {status.label}
                              </StatusPill>
                            </span>
                            <span className="rz-caption block truncate">
                              {[
                                day(order.createdAt),
                                order.partNames.join(', ') || null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          <span className="rz-num rz-strong whitespace-nowrap">
                            {/* The ISO code the server sends, never a symbol:
                                CAD and USD would both read «$». */}
                            <Amount
                              currency={order.currency ?? null}
                              currencyDisplay="code"
                              value={order.totalAmount}
                            />
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                {ordersTotalPages > 1 ? (
                  <Pagination
                    label={t('ordersPagesLabel')}
                    onPage={setOrdersPage}
                    page={currentOrdersPage}
                    totalPages={ordersTotalPages}
                  />
                ) : null}
              </>
            )}
          </section>

          <aside className="grid max-w-full min-w-0 flex-[1_1_280px] gap-4 lg:max-w-95">
            <Card bodyClassName="p-0" title={t('details')}>
              <dl className="rz-facts">
                <div>
                  <dt>{t('phone')}</dt>
                  <dd
                    className={cn(
                      'font-mono',
                      customer.phone === null && 'text-app-dim',
                    )}
                  >
                    {customer.phone === null
                      ? '—'
                      : displayCustomerPhone(customer.phone)}
                  </dd>
                </div>
                <div>
                  <dt>{t('address')}</dt>
                  <dd
                    className={cn(addressLines.length === 0 && 'text-app-dim')}
                  >
                    {addressLines.length === 0
                      ? tc('notSet')
                      : addressLines.map((line) => (
                          <span className="block" key={line}>
                            {line}
                          </span>
                        ))}
                  </dd>
                </div>
                <div>
                  <dt title={t('channelHint')}>{t('channel')}</dt>
                  <dd className="text-app-dim">—</dd>
                </div>
                <div>
                  <dt>{t('customerSince')}</dt>
                  <dd className="font-mono">{day(customer.createdAt)}</dd>
                </div>
                <div>
                  <dt>{t('firstPurchase')}</dt>
                  <dd
                    className={cn(
                      'font-mono',
                      customer.firstOrderAt === null && 'text-app-dim',
                    )}
                  >
                    {customer.firstOrderAt === null
                      ? '—'
                      : day(customer.firstOrderAt)}
                  </dd>
                </div>
                <div>
                  <dt>{t('lastPurchase')}</dt>
                  <dd
                    className={cn(
                      'font-mono',
                      customer.lastOrderAt === null && 'text-app-dim',
                    )}
                  >
                    {customer.lastOrderAt === null
                      ? '—'
                      : day(customer.lastOrderAt)}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card title={t('notes')}>
              {mutationsAllowed ? (
                <>
                  <Field label={t('notesLabel')} srLabel={customer.name}>
                    <TextArea
                      disabled={busy}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder={t('notesPlaceholder')}
                      rows={4}
                      value={notes}
                    />
                  </Field>
                  {notes.trim() === (customer.notes ?? '') ? null : (
                    <div className="rz-btn-row mt-3 justify-end">
                      <Button
                        disabled={busy}
                        onClick={() => setNotes(customer.notes ?? '')}
                      >
                        {tc('cancel')}
                      </Button>
                      <Button
                        aria-busy={busy}
                        disabled={busy}
                        onClick={() => void saveNotes()}
                        variant="primary"
                      >
                        {t('saveNotes')}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p
                  className={cn(
                    'm-0 whitespace-pre-wrap',
                    customer.notes === null ? 'text-app-dim' : 'text-app-muted',
                  )}
                >
                  {customer.notes ?? t('noNotes')}
                </p>
              )}
            </Card>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel={t('confirm')}
        consequence={t('deleteConsequence')}
        destructive
        onCloseAutoFocus={(event) => {
          // The overflow row may have re-rendered; put focus back by hand.
          event.preventDefault()
          deleteTriggerRef.current?.focus()
        }}
        onConfirm={() => void remove()}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        pending={busy}
        title={t('deleteTitle')}
      />
      {orderDrawerOpen ? (
        <OrderForm
          createContext={{
            customer: { id: customer.id, name: customer.name },
            onClose: () => setOrderDrawerOpen(false),
            orderBasePath: ordersPath,
          }}
          definition={cabinetModules.orders}
        />
      ) : null}
    </div>
  )
}

function CustomerForm({
  definition,
  customerId,
}: CabinetModuleScreenProps & { customerId: string | null }) {
  const t = useT(customerFormMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const country = useTenantSettings().countryCode ?? 'UA'
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const mutationsAllowed = canAccess(definition, cabinet, 'mutation')
  const ordersViewAllowed =
    customerId === null || canAccess(definition, cabinet, 'view', 'orders.view')
  const navigate = useNavigate()
  const location = useLocation()
  const directoryPath = customerDirectoryPath(location.pathname)
  const editing = customerId !== null
  const backPath = editing ? `${directoryPath}/${customerId}` : directoryPath
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(() => newCustomerPhoneDraft(country))
  const [notes, setNotes] = useState('')
  /** A new customer starts in the business country; it can be changed. */
  const [address, setAddress] = useState<CustomerAddressDraft>(() =>
    customerAddressDraft({ countryCode: editing ? null : country }),
  )
  /** What the server holds, so an edit sends only the changed fields. */
  const [loadedAddress, setLoadedAddress] = useState<CustomerAddress>(() =>
    readCustomerAddress({}),
  )
  const [touched, setTouched] = useState({ name: false, phone: false })
  const [duplicate, setDuplicate] = useState<CustomerPhoneConflict | null>(null)
  const [retryable, setRetryable] = useState(true)
  const [loadProblem, setLoadProblem] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [loading, setLoading] = useState(editing && ordersViewAllowed)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (customerId && ordersViewAllowed) {
      const controller = new AbortController()
      void customersApi
        .getById(customerId, { signal: controller.signal })
        .then((customer) => {
          if (!controller.signal.aborted) {
            setName(customer.name)
            setPhone(customer.phone ?? newCustomerPhoneDraft(country))
            setNotes(customer.notes ?? '')
            const stored = readCustomerAddress(customer)
            setLoadedAddress(stored)
            setAddress(customerAddressDraft(stored))
            setLoadProblem(false)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setLoadProblem(true)
            setLoading(false)
          }
        })
      return () => controller.abort()
    }
  }, [country, customerId, ordersViewAllowed, reloadToken])
  const nameIssue = name.trim() === '' ? t('nameMissing') : null
  const phoneIssue = isCustomerPhoneAcceptable(phone, country)
    ? null
    : t('phoneInvalid', { example: phoneExample(country) })
  const setAddressField = (field: CustomerAddressField, value: string) =>
    setAddress((current) => ({ ...current, [field]: value }))
  const save = useOperation(
    async () => {
      const scope = requireLatestMutation({ quota: false })
      if (customerId)
        requireLatestMutation({ permission: 'orders.view', quota: false })
      const input = {
        name: name.trim(),
        phone: customerPhoneForSave(phone, country),
        notes: notes.trim() || null,
      }
      return customerId
        ? await customersApi.update(
            customerId,
            { ...input, ...customerAddressChanges(loadedAddress, address) },
            { signal: scope.signal },
          )
        : await customersApi.create(
            { ...input, ...customerAddressForCreate(address) },
            { signal: scope.signal },
          )
    },
    {
      successMessage: editing ? t('saved') : t('created'),
      errorMessage: (failure) => saveProblem(failure, t),
      onError: (failure) => {
        setDuplicate(readCustomerPhoneConflict(failure))
        setRetryable(!(failure instanceof ModuleAccessDeniedError))
      },
      onSuccess: (result) => {
        void navigate(`${directoryPath}/${customerId ?? result.customer.id}`, {
          replace: true,
        })
      },
    },
  )
  const reactivateDuplicate = useOperation(
    async () => {
      if (duplicate === null || !mutationsAllowed) return null
      const scope = requireLatestMutation({ quota: false })
      if (customerId)
        requireLatestMutation({ permission: 'orders.view', quota: false })
      await customersApi.activate(duplicate.customerId, {
        signal: scope.signal,
      })
      return duplicate.customerId
    },
    {
      successMessage: t('activated'),
      errorMessage: (failure) => saveProblem(failure, t),
      onSuccess: (activatedId) => {
        if (activatedId !== null)
          void navigate(`${directoryPath}/${activatedId}`, { replace: true })
      },
    },
  )
  /** One entry point for saving: the footer button and the retry both validate. */
  const attemptSave = () => {
    setTouched({ name: true, phone: true })
    if (nameIssue !== null) {
      nameRef.current?.focus()
      return
    }
    if (phoneIssue !== null) {
      phoneRef.current?.focus()
      return
    }
    if (!mutationsAllowed || !ordersViewAllowed || save.pending) return
    setDuplicate(null)
    setRetryable(true)
    save.run()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    attemptSave()
  }
  /** Leaving the field shows a usable number in E.164; a bad one stays as typed. */
  const finishPhone = () => {
    setTouched((current) => ({ ...current, phone: true }))
    const e164 = customerPhoneForSave(phone, country)
    if (e164 !== null && isCustomerPhoneAcceptable(e164, country))
      setPhone(e164)
  }
  const busy = save.pending || reactivateDuplicate.pending
  const addressText = (
    field: Exclude<CustomerAddressField, 'countryCode'>,
    autoComplete: string,
  ) => (
    <Field label={t(field)}>
      <TextInput
        autoComplete={autoComplete}
        disabled={!mutationsAllowed}
        maxLength={CUSTOMER_ADDRESS_MAX_LENGTH[field]}
        onChange={(event) => setAddressField(field, event.target.value)}
        value={address[field]}
      />
    </Field>
  )
  const body = !ordersViewAllowed ? (
    <DeniedState
      description={t('deniedDescription')}
      role="alert"
      title={t('deniedTitle')}
    />
  ) : loadProblem ? (
    <ErrorState
      description={t('loadError')}
      onRetry={() => {
        setLoadProblem(false)
        setLoading(true)
        setReloadToken((token) => token + 1)
      }}
      title={t('loadFailedTitle')}
    />
  ) : loading ? (
    <SkeletonRows columns={2} label={t('loading')} rows={3} />
  ) : (
    <>
      {mutationsAllowed ? null : <Notice tone="warn">{t('readOnly')}</Notice>}
      <form
        aria-busy={save.pending}
        className="grid gap-4"
        id={CUSTOMER_FORM}
        noValidate
        onSubmit={submit}
      >
        <SectionPanel
          variant="plain"
          description={t('contactDescription')}
          title={t('contactTitle')}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              error={touched.name ? nameIssue : null}
              hint={t('nameExample')}
              label={t('name')}
              required
            >
              <TextInput
                autoComplete="name"
                disabled={!mutationsAllowed}
                onBlur={() =>
                  setTouched((current) => ({ ...current, name: true }))
                }
                onChange={(event) => setName(event.target.value)}
                ref={nameRef}
                required
                value={name}
              />
            </Field>
            <Field
              error={touched.phone ? phoneIssue : null}
              hint={t('phoneHint', { example: phoneExample(country) })}
              label={t('phone')}
            >
              <TextInput
                autoComplete="tel"
                disabled={!mutationsAllowed}
                inputMode="tel"
                onBlur={finishPhone}
                onChange={(event) =>
                  setPhone(normalizeCustomerPhoneDraft(event.target.value))
                }
                ref={phoneRef}
                type="tel"
                value={phone}
              />
            </Field>
          </div>
        </SectionPanel>
        <SectionPanel
          variant="plain"
          description={t('addressDescription')}
          title={t('addressTitle')}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('country')}>
              <SelectInput
                autoComplete="country"
                disabled={!mutationsAllowed}
                onChange={(event) =>
                  setAddressField('countryCode', event.target.value)
                }
                value={address.countryCode}
              >
                <option value="">{t('countryNotSet')}</option>
                {customerCountryOptions(
                  locale,
                  address.countryCode || null,
                ).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            {addressText('city', 'address-level2')}
            {addressText('street', 'address-line1')}
            {addressText('building', 'address-line2')}
            {addressText('postcode', 'postal-code')}
          </div>
        </SectionPanel>
        <SectionPanel
          variant="plain"
          description={t('notesDescription')}
          title={t('notesTitle')}
        >
          <Field hint={t('notesHint')} label={t('notes')}>
            <TextArea
              disabled={!mutationsAllowed}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              value={notes}
            />
          </Field>
        </SectionPanel>
        {duplicate === null ? null : (
          <Notice block role="alert" tone="warn">
            <p className="m-0">
              {duplicate.message} {t('duplicateHint')}
            </p>
            <div className="rz-btn-row mt-2">
              <Button asChild>
                <Link to={`${directoryPath}/${duplicate.customerId}`}>
                  {t('useExisting', { name: duplicate.customerName })}
                </Link>
              </Button>
              {!duplicate.isActive && mutationsAllowed && (
                <Button
                  {...reactivateDuplicate.triggerProps}
                  onClick={() => {
                    reactivateDuplicate.run()
                  }}
                >
                  {t('activateNamed', { name: duplicate.customerName })}
                </Button>
              )}
            </div>
          </Notice>
        )}
        {reactivateDuplicate.error === null ? null : (
          <Notice tone="danger">{reactivateDuplicate.error}</Notice>
        )}
        {save.error === null || duplicate !== null ? null : (
          <Notice
            action={
              retryable ? (
                <Button onClick={attemptSave}>{tc('retry')}</Button>
              ) : undefined
            }
            tone="danger"
          >
            {save.error}
          </Notice>
        )}
      </form>
    </>
  )
  const formReady = ordersViewAllowed && !loadProblem && !loading
  return (
    <Sheet
      description={editing ? t('descriptionEdit') : t('descriptionNew')}
      eyebrow={t('eyebrow')}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <p className="rz-caption m-0 min-w-0 text-pretty">
            {t('requiredNote')}
          </p>
          <div className="rz-btn-row ml-auto">
            <Button
              disabled={busy}
              onClick={() => void navigate(backPath)}
              type="button"
            >
              {tc('cancel')}
            </Button>
            {formReady ? (
              <Button
                {...save.triggerProps}
                disabled={!mutationsAllowed || save.pending}
                form={CUSTOMER_FORM}
                type="submit"
                variant="primary"
              >
                {save.pending
                  ? tc('saving')
                  : editing
                    ? t('saveChanges')
                    : t('createCustomer')}
              </Button>
            ) : null}
          </div>
        </div>
      }
      onOpenChange={(next) => {
        if (!next && !busy) void navigate(backPath)
      }}
      open
      title={editing ? t('titleEdit') : t('titleNew')}
    >
      {body}
    </Sheet>
  )
}

const CUSTOMER_FORM = 'customer-form'
