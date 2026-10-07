import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  ChevronLeft,
  Copy,
  MessageSquare,
  Phone,
  Plus,
  Power,
  PowerOff,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Amount,
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  DeniedState,
  ErrorState,
  Field,
  Notice,
  PageBody,
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

/**
 * Avatar colours. The server keeps none, so the chip picks one by the name —
 * the same person gets the same colour on every screen and every reload, and
 * a wall of identical orange circles stops being a wall.
 */
const AVATAR_TONES = [
  'bg-brand/15 text-brand',
  'bg-state-ok/15 text-state-ok',
  'bg-state-info/15 text-state-info',
  'bg-state-warn/15 text-state-warn',
  'bg-white/[0.08] text-app-ink',
] as const

const avatarTone = (seed: string) => {
  let hash = 0
  for (const character of seed)
    hash = (hash * 31 + character.codePointAt(0)!) % 9973
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0]
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

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="mx-auto grid w-full max-w-[1240px] gap-4 px-4 pt-10 pb-16 sm:px-6 md:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[11px] tracking-[0.14em] uppercase">
              {t('section')}
            </p>
            <h1 className="mt-2.5 text-[38px] leading-none font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              {t('title')}
            </h1>
          </div>
          {mutationsAllowed ? (
            <Button
              asChild
              className="min-h-11 px-5.5 text-[15px] font-bold"
              variant="primary"
            >
              <Link to="new">
                <Plus aria-hidden />
                {t('newCustomer')}
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-2.5">
          <SearchInput
            aria-label={t('searchLabel')}
            className="min-h-12.5 text-[15px]"
            onChange={(event) =>
              setParams(
                event.target.value ? { q: event.target.value, page: '1' } : {},
              )
            }
            placeholder={t('searchPlaceholder')}
            value={q}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div
            aria-label={t('segmentsLabel')}
            className="border-app-line bg-app-raised flex flex-wrap gap-[3px] rounded-xl border p-[3px]"
            role="radiogroup"
          >
            {CUSTOMER_SEGMENTS.map((option) => {
              const active = option.value === segment
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
                  onClick={() => setSegment(option.value)}
                  role="radio"
                  type="button"
                >
                  {t(option.label)}
                  <span className="text-app-muted font-mono text-[12px] font-medium">
                    {counts[option.value]}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase"
              id="customer-sort-label"
            >
              {t('sortLabel')}
            </span>
            <div
              aria-labelledby="customer-sort-label"
              className="border-app-line bg-app-raised flex gap-[3px] rounded-xl border p-[3px]"
              role="radiogroup"
            >
              {CUSTOMER_SORTS.map((option) => {
                const active = option.value === sort
                return (
                  <button
                    aria-checked={active}
                    className={cn(
                      'focus-visible:outline-brand min-h-9 cursor-pointer rounded-lg px-3.5 text-[13px] font-semibold',
                      active
                        ? 'text-app-ink bg-white/[0.09]'
                        : 'text-app-muted hover:bg-white/[0.05]',
                    )}
                    key={option.value}
                    onClick={() => setSort(option.value)}
                    role="radio"
                    type="button"
                  >
                    {t(option.label)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {totalPages > 1 ? (
          <p className="text-app-dim text-[13px]">
            {t('pageScope', { count: total })}
          </p>
        ) : null}

        {error ? <Notice tone="danger">{t('loadError')}</Notice> : null}

        <section
          aria-label={t('listLabel')}
          className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
        >
          <div
            aria-hidden
            className={cn(
              'border-app-line text-app-dim hidden gap-4 border-b px-6 py-3.5 font-mono text-[10px] tracking-[0.14em] uppercase md:grid',
              financeViewAllowed
                ? 'md:grid-cols-[1.5fr_1fr_1fr_7rem_8rem]'
                : 'md:grid-cols-[1.5fr_1fr_1fr_7rem]',
            )}
          >
            <span>{t('columnCustomer')}</span>
            <span>{t('columnPhone')}</span>
            <span>{t('columnLastPurchase')}</span>
            <span className="text-right">{t('columnOrders')}</span>
            {financeViewAllowed ? (
              <span className="text-right">{t('columnAmount')}</span>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 px-6 py-14 text-center">
              <p className="text-[16px] font-bold text-white">
                {filtered ? t('emptyFilteredTitle') : t('emptyTitle')}
              </p>
              <p className="text-app-muted text-[14px]">
                {filtered ? t('emptyFilteredHint') : t('emptyHint')}
              </p>
              {filtered ? (
                <Button
                  className="text-[13px] font-bold"
                  onClick={() => {
                    setSegment('all')
                    setParams({})
                  }}
                >
                  {t('resetFilters')}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="grid">
              {rows.map((customer) => (
                <li
                  className="border-app-line border-b last:border-0"
                  key={customer.id}
                >
                  <Link
                    className={cn(
                      'grid items-center gap-x-4 gap-y-1.5 px-6 py-3.5 hover:bg-white/[0.03]',
                      financeViewAllowed
                        ? 'md:grid-cols-[1.5fr_1fr_1fr_7rem_8rem]'
                        : 'md:grid-cols-[1.5fr_1fr_1fr_7rem]',
                    )}
                    to={customer.id}
                  >
                    <span className="flex min-w-0 items-center gap-3.5">
                      <span
                        aria-hidden
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                          avatarTone(customer.name),
                        )}
                      >
                        {customerInitials(customer.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-white">
                          {customer.name}
                        </span>
                        <span className="text-app-muted mt-0.5 block text-[12px]">
                          {t(segmentTag(customer.ordersCount))}
                        </span>
                      </span>
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[14px]',
                        customer.phone === null
                          ? 'text-app-dim'
                          : 'text-app-ink',
                      )}
                    >
                      {customer.phone === null
                        ? '—'
                        : displayCustomerPhone(customer.phone)}
                    </span>
                    <span
                      className={cn(
                        'text-[14px] font-medium',
                        customer.lastOrderAt === null
                          ? 'text-app-dim'
                          : 'text-app-muted',
                      )}
                    >
                      <span className="text-app-dim mr-2 text-[10px] tracking-[0.14em] uppercase md:hidden">
                        {t('columnLastPurchase')}
                      </span>
                      {customer.lastOrderAt === null
                        ? '—'
                        : day(customer.lastOrderAt)}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[15px] tabular-nums md:text-right',
                        customer.ordersCount > 0
                          ? 'text-app-ink'
                          : 'text-app-dim',
                      )}
                    >
                      <span className="text-app-dim mr-2 text-[10px] tracking-[0.14em] uppercase md:hidden">
                        {t('columnOrders')}
                      </span>
                      {customer.ordersCount}
                    </span>
                    {financeViewAllowed ? (
                      <span
                        className={cn(
                          'text-[16px] font-bold tracking-[-0.01em] tabular-nums md:text-right',
                          (customer.totalAmount ?? 0) > 0
                            ? 'text-white'
                            : 'text-app-dim',
                        )}
                      >
                        {customer.totalAmount === null ||
                        customer.totalAmount === 0 ? (
                          '—'
                        ) : (
                          <Amount
                            currency={accountingCurrency}
                            currencyDisplay="code"
                            value={customer.totalAmount}
                          />
                        )}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-app-line border-t px-6 py-3.5">
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
          </div>
        </section>
      </div>
    </div>
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
      <PageBody width="narrow">
        <DeniedState
          description={t('deniedDescription')}
          role="alert"
          title={t('deniedTitle')}
        />
      </PageBody>
    )
  if (error)
    return (
      <PageBody width="narrow">
        <ErrorState description={t(error)} title={t('loadFailedTitle')} />
      </PageBody>
    )
  if (!customer)
    return (
      <PageBody width="narrow">
        <SkeletonRows label={t('loading')} rows={3} />
      </PageBody>
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
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={directoryPath}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            {t('backToCustomers')}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>{t('section')}</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span className="text-app-muted">{t('title')}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {mutationsAllowed ? (
            <Button asChild className="px-[18px] text-sm font-semibold">
              <Link to="edit">{tc('edit')}</Link>
            </Button>
          ) : null}
          {orderCreateAllowed && customer.isActive ? (
            <Button
              className="px-5 text-sm font-bold"
              onClick={() => setOrderDrawerOpen(true)}
              variant="primary"
            >
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
      </div>

      <div className="mx-auto grid w-full max-w-[1240px] gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        {error ? <Notice tone="danger">{t(error)}</Notice> : null}
        {copied ? <Notice tone="ok">{t('phoneCopied')}</Notice> : null}

        <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
          <span
            aria-hidden
            className={cn(
              'flex size-16 shrink-0 items-center justify-center rounded-full text-[22px] font-bold',
              avatarTone(customer.name),
            )}
          >
            {customerInitials(customer.name)}
          </span>
          <div className="min-w-0 flex-[1_1_18rem]">
            <div className="flex flex-wrap items-center gap-3.5">
              <h1 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em] text-white sm:text-[40px]">
                {customer.name}
              </h1>
              <StatusPill tone={customer.isActive ? 'ok' : 'neutral'}>
                {customer.isActive ? t('active') : t('inactive')}
              </StatusPill>
            </div>
            {customer.phone === null ? (
              <p className="text-app-muted mt-3 text-[15px]">
                {t('phoneMissing')}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <span className="text-app-ink font-mono text-[15px]">
                  {displayCustomerPhone(customer.phone)}
                </span>
                <Button
                  className="min-h-9 px-3 text-[12px] font-bold"
                  onClick={() => void copyPhone(customer.phone ?? '')}
                >
                  <Copy aria-hidden />
                  {t('copyPhone')}
                </Button>
                <Button asChild className="min-h-9 px-3 text-[12px] font-bold">
                  <a href={`tel:${customer.phone}`}>
                    <Phone aria-hidden />
                    {t('call')}
                  </a>
                </Button>
                <Button asChild className="min-h-9 px-3 text-[12px] font-bold">
                  <a href={`sms:${customer.phone}`}>
                    <MessageSquare aria-hidden />
                    {t('sms')}
                  </a>
                </Button>
              </div>
            )}
          </div>
          <dl className="border-app-line bg-app-raised ml-auto grid grid-cols-2 gap-x-7 gap-y-4 rounded-[16px] border px-6 py-4.5 sm:grid-cols-3">
            <div>
              <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                {t('statOrders')}
              </dt>
              <dd
                className={cn(
                  'mt-2 text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums',
                  (customer.ordersCount ?? 0) > 0
                    ? 'text-white'
                    : 'text-app-dim',
                )}
              >
                {customer.ordersCount === null
                  ? '—'
                  : String(customer.ordersCount)}
              </dd>
            </div>
            {financeViewAllowed ? (
              <>
                <div>
                  <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                    {t('statSpent')}
                  </dt>
                  <dd
                    className={cn(
                      'mt-2 text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums',
                      (customer.totalAmount ?? 0) > 0
                        ? 'text-white'
                        : 'text-app-dim',
                    )}
                  >
                    {money(customer.totalAmount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                    {t('statAverage')}
                  </dt>
                  <dd
                    className={cn(
                      'mt-2 text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums',
                      (customer.averageAmount ?? 0) > 0
                        ? 'text-white'
                        : 'text-app-dim',
                    )}
                  >
                    {money(
                      typeof customer.averageAmount === 'number'
                        ? Math.round(customer.averageAmount)
                        : null,
                    )}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <Card
            aside={
              <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                {t('ordersCount', { count: customer.orders.length })}
              </span>
            }
            bodyClassName="p-0"
            className="min-w-0 flex-[2_1_34rem]"
            title={t('orderHistory')}
          >
            {customer.orders.length === 0 ? (
              <div className="border-app-line flex flex-col items-center gap-3 border-t px-6 pt-14 pb-15 text-center">
                <span
                  aria-hidden
                  className="bg-brand-soft text-brand flex size-13 items-center justify-center rounded-[15px]"
                >
                  <ShoppingCart className="size-6" />
                </span>
                <p className="text-[17px] font-bold text-white">
                  {t('noOrdersTitle')}
                </p>
                <p className="text-app-muted max-w-[21rem] text-[14px] leading-[1.5] text-pretty">
                  {t('noOrdersHint')}
                </p>
                {orderCreateAllowed && customer.isActive ? (
                  <Button
                    className="mt-1.5 px-5 text-sm font-bold"
                    onClick={() => setOrderDrawerOpen(true)}
                    variant="primary"
                  >
                    {t('createOrder')}
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                <ul className="grid">
                  {visibleOrders.map((order) => (
                    <li
                      className="border-app-line border-t first:border-t-0"
                      key={order.id}
                    >
                      <Link
                        className="grid items-center gap-x-4 gap-y-1 px-6 py-4 hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_auto]"
                        to={orderHref(order.id)}
                      >
                        <span className="min-w-0">
                          <span className="block text-[15px] font-bold text-white">
                            #{order.number}
                          </span>
                          <span className="text-app-muted mt-0.5 block truncate text-[13px]">
                            {[
                              day(order.createdAt),
                              orderStatusPresentation(order.status, locale)
                                .label,
                              order.partNames.join(', ') || null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className="font-mono text-[15px] whitespace-nowrap text-white tabular-nums">
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
                  ))}
                </ul>
                {ordersTotalPages > 1 ? (
                  <div className="border-app-line border-t px-6 py-3.5">
                    <Pagination
                      label={t('ordersPagesLabel')}
                      onPage={setOrdersPage}
                      page={currentOrdersPage}
                      totalPages={ordersTotalPages}
                    />
                  </div>
                ) : null}
              </>
            )}
          </Card>

          <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-5">
            <Card title={t('details')}>
              <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-3.5">
                <dt className="text-app-muted text-[14px] font-semibold">
                  {t('phone')}
                </dt>
                <dd
                  className={cn(
                    'font-mono text-[14px]',
                    customer.phone === null ? 'text-app-dim' : 'text-app-ink',
                  )}
                >
                  {customer.phone === null
                    ? '—'
                    : displayCustomerPhone(customer.phone)}
                </dd>
                <dt className="text-app-muted text-[14px] font-semibold">
                  {t('address')}
                </dt>
                <dd
                  className={cn(
                    'text-right text-[14px] font-semibold',
                    addressLines.length === 0 ? 'text-app-dim' : 'text-app-ink',
                  )}
                >
                  {addressLines.length === 0
                    ? tc('notSet')
                    : addressLines.map((line) => (
                        <span className="block" key={line}>
                          {line}
                        </span>
                      ))}
                </dd>
                <dt
                  className="text-app-muted text-[14px] font-semibold"
                  title={t('channelHint')}
                >
                  {t('channel')}
                </dt>
                <dd className="text-app-dim text-[14px] font-semibold">—</dd>
                <dt className="text-app-muted text-[14px] font-semibold">
                  {t('customerSince')}
                </dt>
                <dd className="text-app-ink text-[14px] font-semibold">
                  {day(customer.createdAt)}
                </dd>
                <dt className="text-app-muted text-[14px] font-semibold">
                  {t('firstPurchase')}
                </dt>
                <dd
                  className={cn(
                    'text-[14px] font-semibold',
                    customer.firstOrderAt === null
                      ? 'text-app-dim'
                      : 'text-app-ink',
                  )}
                >
                  {customer.firstOrderAt === null
                    ? '—'
                    : day(customer.firstOrderAt)}
                </dd>
                <dt className="text-app-muted text-[14px] font-semibold">
                  {t('lastPurchase')}
                </dt>
                <dd
                  className={cn(
                    'text-[14px] font-semibold',
                    customer.lastOrderAt === null
                      ? 'text-app-dim'
                      : 'text-app-ink',
                  )}
                >
                  {customer.lastOrderAt === null
                    ? '—'
                    : day(customer.lastOrderAt)}
                </dd>
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
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2.5">
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
                    'text-[14px] leading-[1.6] whitespace-pre-wrap',
                    customer.notes === null ? 'text-app-dim' : 'text-app-muted',
                  )}
                >
                  {customer.notes ?? t('noNotes')}
                </p>
              )}
            </Card>
          </div>
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
            <p>
              {duplicate.message} {t('duplicateHint')}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
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
        <div className="flex w-full flex-wrap items-center gap-2.5">
          <p className="text-app-muted min-w-0 text-[12px] text-pretty">
            {t('requiredNote')}
          </p>
          <div className="ml-auto flex items-center gap-2.5">
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
