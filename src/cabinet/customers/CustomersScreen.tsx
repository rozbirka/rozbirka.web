import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  ChevronLeft,
  Copy,
  MessageSquare,
  Phone,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { cn, plural } from '@/lib/utils'
import {
  Button,
  Card,
  ConfirmDialog,
  DeniedState,
  ErrorState,
  Field,
  Notice,
  PageBody,
  PageHeader,
  Pagination,
  Panel,
  PanelFooter,
  SearchInput,
  SectionPanel,
  SkeletonRows,
  StatusPill,
  TextArea,
  TextInput,
  useOperation,
} from '@/components/app'
import {
  customersApi,
  readCustomerPhoneConflict,
  type CustomerDetail,
  type CustomerListItem,
  type CustomerPhoneConflict,
} from '@/api/customers'
import { normalizeApiProblem } from '@/api/errors'
import { orderStatusPresentation } from '../orders/order-labels'
import type { Permission } from '../access-types'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { useCabinet } from '../CabinetContext'
import {
  evaluateModuleAccess,
  ModuleAccessDeniedError,
  type ModuleAccessOperation,
} from '../policy'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'

const loadError = 'Не вдалося завантажити дані. Спробуйте ще раз.'
const nameExample = 'Наприклад: Ірина Коваль або СТО «Пітстоп»'
const phoneExample = 'Наприклад: +380 50 111 22 33'
const nameMissing = `Введіть ім’я клієнта — за ним ви знайдете його в списку й у замовленнях. ${nameExample}`
/** Digits, spaces, brackets, dashes and a leading plus — nothing else. */
const phoneShape = /^\+?[\d\s()-]+$/
const phoneProblem = (value: string): string | null => {
  if (value === '') return null
  if (!phoneShape.test(value))
    return `Приберіть із номера зайві символи — залиште цифри, пробіли, дужки та «+». ${phoneExample}`
  const digits = value.replace(/\D/g, '')
  if (digits.length < 9)
    return `У номері замало цифр. Додайте код оператора та країни. ${phoneExample}`
  if (digits.length > 15)
    return `У номері забагато цифр. Перевірте його: у міжнародному форматі їх щонайбільше 15. ${phoneExample}`
  return null
}
/** Turns a failed save into a reason the user can act on. */
const saveProblem = (failure: unknown): string => {
  const conflict = readCustomerPhoneConflict(failure)
  if (conflict) return conflict.message
  if (failure instanceof ModuleAccessDeniedError)
    return 'Права на зміну клієнтів більше немає. Оновіть сторінку або попросіть власника кабінету відкрити доступ.'
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
    return <CustomerForm definition={definition} customerId={null} />
  if (location.pathname.endsWith('/edit'))
    return <CustomerForm definition={definition} customerId={id} />
  return id ? (
    <CustomerDetailScreen definition={definition} customerId={id} />
  ) : (
    <CustomerDirectory definition={definition} />
  )
}

/** Dates arrive as ISO strings; anything unparsable is shown as it came. */
const day = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' }).format(parsed)
}

/** Two initials for the avatar chip; a single word gives one. */
const customerInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

const AVATAR_TONES = [
  'bg-amber-400/15 text-amber-300',
  'bg-sky-400/15 text-sky-300',
  'bg-emerald-400/15 text-emerald-300',
  'bg-violet-400/15 text-violet-300',
  'bg-rose-400/15 text-rose-300',
  'bg-cyan-400/15 text-cyan-300',
] as const
const customerAvatarTone = (value: string) => {
  let hash = 0
  for (const character of value)
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}
const currencySymbol = (currency: string | null) =>
  ({ UAH: '₴', USD: '$', EUR: '€' })[currency ?? ''] ?? currency ?? ''

/** How a customer is grouped by how often they buy. */
const CUSTOMER_SEGMENTS = [
  { value: 'all' as const, label: 'Усі' },
  { value: 'regular' as const, label: 'Постійні' },
  { value: 'once' as const, label: 'Разові' },
  { value: 'none' as const, label: 'Без покупок' },
]

type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number]['value']

/** From how many orders a customer counts as a regular. */
const REGULAR_FROM = 3

const segmentOf = (ordersCount: number): CustomerSegment =>
  ordersCount >= REGULAR_FROM ? 'regular' : ordersCount > 0 ? 'once' : 'none'

const segmentTag = (ordersCount: number) =>
  ({
    all: 'клієнт',
    regular: 'постійний',
    once: 'разовий',
    none: 'без покупок',
  })[segmentOf(ordersCount)]

const CUSTOMER_SORTS = [
  { value: 'sum' as const, label: 'Сумою' },
  { value: 'name' as const, label: 'Іменем' },
]

type CustomerSort = (typeof CUSTOMER_SORTS)[number]['value']

function CustomerDirectory({ definition }: CabinetModuleScreenProps) {
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
  const [error, setError] = useState<string | null>(null)
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
        setError(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(loadError)
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
        ? left.name.localeCompare(right.name, 'uk')
        : (right.totalAmount ?? 0) - (left.totalAmount ?? 0),
    )
  const filtered = q !== '' || segment !== 'all'

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full gap-4 px-4 pt-10 pb-16 sm:px-6 md:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[11px] tracking-[0.14em] uppercase">
              Продажі
            </p>
            <h1 className="mt-2.5 text-[38px] leading-none font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              Клієнти
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
                Новий клієнт
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-2.5">
          <SearchInput
            aria-label="Пошук клієнта"
            className="min-h-12.5 text-[15px]"
            onChange={(event) =>
              setParams(
                event.target.value ? { q: event.target.value, page: '1' } : {},
              )
            }
            placeholder="Імʼя або телефон"
            value={q}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div
            aria-label="Сегмент клієнтів"
            className="border-app-line bg-app-raised flex flex-wrap gap-[3px] rounded-xl border p-[3px]"
            role="radiogroup"
          >
            {CUSTOMER_SEGMENTS.map((option) => {
              const active = option.value === segment
              return (
                <button
                  aria-checked={active}
                  className={cn(
                    'focus-visible:outline-brand flex min-h-11 cursor-pointer items-baseline gap-2 rounded-[9px] px-3.5 text-[14px] font-semibold',
                    active
                      ? 'text-app-ink bg-white/[0.09]'
                      : 'text-app-muted hover:bg-white/[0.05]',
                  )}
                  key={option.value}
                  onClick={() => setSegment(option.value)}
                  role="radio"
                  type="button"
                >
                  {option.label}{' '}
                  <span className="text-app-muted font-mono text-[12px] leading-none font-medium tabular-nums">
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
              Сортувати
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
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {totalPages > 1 ? (
          <p className="text-app-dim text-[13px]">
            Сегмент і сортування застосовуються до завантаженої сторінки —
            сервер не приймає їх у запиті. Знайдено {total}{' '}
            {plural(total, ['клієнта', 'клієнти', 'клієнтів'])}.
          </p>
        ) : null}

        {error === null ? null : <Notice tone="danger">{error}</Notice>}

        <section
          aria-label="Список клієнтів"
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
            <span>Клієнт</span>
            <span>Телефон</span>
            <span>Остання покупка</span>
            <span className="text-right">Замовлень</span>
            {financeViewAllowed ? (
              <span className="text-right">Сума</span>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 px-6 py-14 text-center">
              <p className="text-[16px] font-bold text-white">
                {filtered ? 'Нічого не знайдено' : 'Клієнтів поки немає'}
              </p>
              <p className="text-app-muted text-[14px]">
                {filtered
                  ? 'Спробуйте змінити пошук або сегмент.'
                  : 'Клієнти зʼявляються після першого замовлення або коли ви додасте їх самі.'}
              </p>
              {filtered ? (
                <Button
                  className="text-[13px] font-bold"
                  onClick={() => {
                    setSegment('all')
                    setParams({})
                  }}
                >
                  Скинути фільтри
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
                          customerAvatarTone(customer.id),
                        )}
                      >
                        {customerInitials(customer.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-white">
                          {customer.name}
                        </span>
                        <span className="text-app-muted mt-0.5 block text-[12px]">
                          {segmentTag(customer.ordersCount)}
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
                      {customer.phone ?? '—'}
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
                        Остання покупка
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
                        Замовлень
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
                        customer.totalAmount === 0
                          ? '—'
                          : `${new Intl.NumberFormat('uk-UA').format(customer.totalAmount)} $`}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-app-line border-t px-6 py-3.5">
            <Pagination
              label="Сторінки клієнтів"
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
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  /** Where focus goes when the delete question is answered or dismissed. */
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)
  const [notes, setNotes] = useState('')
  const navigate = useNavigate()
  useEffect(() => {
    if (!ordersViewAllowed) return
    const controller = new AbortController()
    void customersApi
      .getById(customerId, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setCustomer(result)
          setNotes(result.notes ?? '')
          setError(null)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(loadError)
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
      setError(loadError)
    } finally {
      setBusy(false)
    }
  }
  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
    } catch {
      setError('Не вдалося скопіювати телефон.')
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
      setError(loadError)
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
      await navigate('..', { replace: true })
    } catch {
      setError(loadError)
      setBusy(false)
    }
  }
  if (!ordersViewAllowed)
    return (
      <PageBody width="narrow">
        <DeniedState
          description="Картка клієнта показує його замовлення, тож потрібен доступ до розділу «Замовлення»."
          role="alert"
          title="Потрібен доступ до замовлень."
        />
      </PageBody>
    )
  if (error)
    return (
      <PageBody width="narrow">
        <ErrorState
          description={error}
          title="Не вдалося завантажити клієнта"
        />
      </PageBody>
    )
  if (!customer)
    return (
      <PageBody width="narrow">
        <SkeletonRows label="Завантажуємо клієнта…" rows={3} />
      </PageBody>
    )
  const orderPath = `/app/${cabinet.targetTenant?.slug ?? ''}/orders/new?customerId=${encodeURIComponent(customer.id)}`
  const orderHref = (orderId: string) =>
    `/app/${cabinet.targetTenant?.slug ?? ''}/orders/${orderId}`
  const money = (value: number | null) =>
    value === null
      ? '—'
      : `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(value)} $`
  const averageAmount =
    customer.totalAmount !== null &&
    customer.ordersCount !== null &&
    customer.ordersCount > 0
      ? customer.totalAmount / customer.ordersCount
      : null
  const customersPath = `/app/${cabinet.targetTenant?.slug ?? ''}/customers`

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={customersPath}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            До клієнтів
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Продажі</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span className="text-app-muted">Клієнти</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {mutationsAllowed ? (
            <Button asChild className="px-[18px] text-sm font-semibold">
              <Link to="edit">Редагувати</Link>
            </Button>
          ) : null}
          {orderCreateAllowed && customer.isActive ? (
            <Button
              asChild
              className="px-5 text-sm font-bold"
              variant="primary"
            >
              <Link to={orderPath}>Створити замовлення</Link>
            </Button>
          ) : null}
          {mutationsAllowed ? (
            <Button
              aria-expanded={menuOpen}
              aria-label="Інші дії з клієнтом"
              className="min-w-11 px-0 text-base font-bold tracking-[0.1em]"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden>···</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid w-full gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {copied ? <Notice tone="ok">Телефон скопійовано.</Notice> : null}

        <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
          <span
            aria-hidden
            className={cn(
              'flex size-16 shrink-0 items-center justify-center rounded-full text-[22px] font-bold',
              customerAvatarTone(customer.id),
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
                {customer.isActive ? 'Активний' : 'Неактивний'}
              </StatusPill>
            </div>
            {customer.phone === null ? (
              <p className="text-app-muted mt-3 text-[15px]">
                Телефон не записаний.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <span className="text-app-ink font-mono text-[15px]">
                  {customer.phone}
                </span>
                <Button
                  className="min-h-9 px-3 text-[12px] font-bold"
                  onClick={() => void copyPhone(customer.phone ?? '')}
                >
                  <Copy aria-hidden />
                  Копіювати телефон
                </Button>
                <Button asChild className="min-h-9 px-3 text-[12px] font-bold">
                  <a href={`tel:${customer.phone}`}>
                    <Phone aria-hidden />
                    Зателефонувати
                  </a>
                </Button>
                <Button asChild className="min-h-9 px-3 text-[12px] font-bold">
                  <a href={`sms:${customer.phone}`}>
                    <MessageSquare aria-hidden />
                    SMS
                  </a>
                </Button>
              </div>
            )}
          </div>
          <dl className="border-app-line bg-app-raised ml-auto grid grid-cols-2 gap-x-7 gap-y-4 rounded-[16px] border px-6 py-4.5 sm:grid-cols-3">
            <div>
              <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                Замовлень
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
                    Витрачено
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
                    Середній чек
                  </dt>
                  <dd
                    className={cn(
                      'mt-2 text-[28px] leading-none font-bold tracking-[-0.02em] tabular-nums',
                      (averageAmount ?? 0) > 0 ? 'text-white' : 'text-app-dim',
                    )}
                  >
                    {money(averageAmount)}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>

        {menuOpen && mutationsAllowed ? (
          <div className="border-app-line bg-app-raised flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3">
            <Button disabled={busy} onClick={() => void updateLifecycle()}>
              {customer.isActive ? 'Деактивувати' : 'Активувати'}
            </Button>
            <Button
              disabled={busy || customer.ordersCount !== 0}
              onClick={() => setConfirmDelete(true)}
              ref={deleteTriggerRef}
              title={
                customer.ordersCount === 0
                  ? undefined
                  : 'Клієнта із замовленнями видалити не можна'
              }
              variant="danger"
            >
              <Trash2 aria-hidden />
              Видалити клієнта
            </Button>
            <p className="text-app-muted text-[13px]">
              {customer.ordersCount === 0
                ? 'Видалення не можна скасувати.'
                : 'Клієнта із замовленнями можна лише деактивувати.'}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start gap-6">
          <Card
            aside={
              <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                {customer.orders.length}{' '}
                {plural(customer.orders.length, [
                  'замовлення',
                  'замовлення',
                  'замовлень',
                ])}
              </span>
            }
            bodyClassName="p-0"
            className="min-w-0 flex-[2_1_34rem]"
            title="Історія замовлень"
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
                  Замовлень ще не було
                </p>
                <p className="text-app-muted max-w-[21rem] text-[14px] leading-[1.5] text-pretty">
                  Щойно клієнт зробить перше замовлення, воно зʼявиться тут.
                </p>
                {orderCreateAllowed && customer.isActive ? (
                  <Button
                    asChild
                    className="mt-1.5 px-5 text-sm font-bold"
                    variant="primary"
                  >
                    <Link to={orderPath}>Створити замовлення</Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="grid">
                {customer.orders.map((order) => (
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
                            orderStatusPresentation(order.status).label,
                            order.partNames.join(', ') || null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="font-mono text-[15px] whitespace-nowrap text-white tabular-nums">
                        {order.totalAmount === null
                          ? '—'
                          : `${new Intl.NumberFormat('uk-UA').format(order.totalAmount)} ${currencySymbol(order.currency)}`.trim()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-5">
            <Card title="Деталі">
              <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-3.5">
                <dt
                  className="text-app-muted text-[14px] font-semibold"
                  title="Сервер не зберігає, звідки прийшов клієнт"
                >
                  Канал
                </dt>
                <dd className="text-app-dim text-[14px] font-semibold">—</dd>
                <dt className="text-app-muted text-[14px] font-semibold">
                  Клієнт з
                </dt>
                <dd className="text-app-ink text-[14px] font-semibold">
                  {day(customer.createdAt)}
                </dd>
                <dt className="text-app-muted text-[14px] font-semibold">
                  Перша покупка
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
                  Остання покупка
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

            <Card title="Нотатки">
              {mutationsAllowed ? (
                <>
                  <Field label="Нотатки про клієнта" srLabel={customer.name}>
                    <TextArea
                      disabled={busy}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Домовленості, побажання, що шукає клієнт"
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
                        Скасувати
                      </Button>
                      <Button
                        aria-busy={busy}
                        disabled={busy}
                        onClick={() => void saveNotes()}
                        variant="primary"
                      >
                        Зберегти нотатки
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
                  {customer.notes ?? 'Нотаток ще немає.'}
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Підтвердити"
        consequence="Картка клієнта та його контакти зникнуть назавжди. Замовлень у нього немає, тож історія продажів не постраждає."
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
        title="Підтвердити видалення"
      />
    </div>
  )
}

function CustomerForm({
  definition,
  customerId,
}: CabinetModuleScreenProps & { customerId: string | null }) {
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
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState({ name: false, phone: false })
  const [duplicate, setDuplicate] = useState<CustomerPhoneConflict | null>(null)
  const [retryable, setRetryable] = useState(true)
  const [loadProblem, setLoadProblem] = useState<string | null>(null)
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
            setPhone(customer.phone ?? '')
            setNotes(customer.notes ?? '')
            setLoadProblem(null)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setLoadProblem(loadError)
            setLoading(false)
          }
        })
      return () => controller.abort()
    }
  }, [customerId, ordersViewAllowed, reloadToken])
  const nameIssue = name.trim() === '' ? nameMissing : null
  const phoneIssue = phoneProblem(phone.trim())
  const save = useOperation(
    async () => {
      const scope = requireLatestMutation({ quota: false })
      if (customerId)
        requireLatestMutation({ permission: 'orders.view', quota: false })
      const input = {
        name: name.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      }
      return customerId
        ? await customersApi.update(customerId, input, {
            signal: scope.signal,
          })
        : await customersApi.create(input, { signal: scope.signal })
    },
    {
      successMessage: editing ? 'Зміни збережено' : 'Клієнта створено',
      errorMessage: saveProblem,
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
      successMessage: 'Клієнта активовано',
      errorMessage: saveProblem,
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
  if (!ordersViewAllowed)
    return (
      <PageBody width="narrow">
        <DeniedState
          description="Картку клієнта не відкрити без його замовлень, тож потрібен доступ до розділу «Замовлення». Попросіть власника кабінету відкрити його."
          role="alert"
          title="Потрібен доступ до замовлень."
        />
      </PageBody>
    )
  if (loadProblem !== null)
    return (
      <PageBody width="narrow">
        <ErrorState
          description={loadProblem}
          onRetry={() => {
            setLoadProblem(null)
            setLoading(true)
            setReloadToken((token) => token + 1)
          }}
          title="Не вдалося завантажити клієнта"
        />
      </PageBody>
    )
  if (loading)
    return (
      <PageBody width="narrow">
        <PageHeader eyebrow="Продажі · Клієнти" title="Редагувати клієнта" />
        <SkeletonRows columns={2} label="Завантажуємо клієнта…" rows={3} />
      </PageBody>
    )
  return (
    <PageBody width="narrow">
      <Button asChild className="justify-self-start" variant="quiet">
        <Link to={backPath}>
          <ChevronLeft aria-hidden />
          {editing ? 'До картки клієнта' : 'До списку клієнтів'}
        </Link>
      </Button>
      <PageHeader
        eyebrow="Продажі · Клієнти"
        title={editing ? 'Редагувати клієнта' : 'Новий клієнт'}
      />
      {mutationsAllowed ? null : (
        <Notice tone="warn">
          Дані можна переглянути, але не змінити. Щоб редагувати клієнтів,
          попросіть власника кабінету відкрити доступ.
        </Notice>
      )}
      <form
        aria-busy={save.pending}
        className="grid gap-4"
        noValidate
        onSubmit={submit}
      >
        <SectionPanel
          description="Ім’я показуємо в списку клієнтів і в замовленнях, телефон — для дзвінка та пошуку."
          title="Контакт"
        >
          <div className="grid items-start gap-3 sm:grid-cols-2">
            <Field
              error={touched.name ? nameIssue : null}
              hint={nameExample}
              label="Ім’я"
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
              hint={`Один номер для дзвінка та SMS. ${phoneExample}`}
              label="Телефон"
            >
              <TextInput
                autoComplete="tel"
                disabled={!mutationsAllowed}
                inputMode="tel"
                onBlur={() =>
                  setTouched((current) => ({ ...current, phone: true }))
                }
                onChange={(event) => setPhone(event.target.value)}
                ref={phoneRef}
                type="tel"
                value={phone}
              />
            </Field>
          </div>
        </SectionPanel>
        <SectionPanel
          description="Домовленості, зручний час для дзвінка, побажання щодо доставки."
          title="Нотатки"
        >
          <Field hint="Видно лише вашій команді" label="Нотатки">
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
              {duplicate.message} Відкрийте наявну картку, щоб не заводити
              другу.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button asChild>
                <Link to={`${directoryPath}/${duplicate.customerId}`}>
                  Використати клієнта {duplicate.customerName}
                </Link>
              </Button>
              {!duplicate.isActive && mutationsAllowed && (
                <Button
                  {...reactivateDuplicate.triggerProps}
                  onClick={() => {
                    reactivateDuplicate.run()
                  }}
                >
                  Активувати {duplicate.customerName}
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
                <Button onClick={attemptSave}>Спробувати ще раз</Button>
              ) : undefined
            }
            tone="danger"
          >
            {save.error}
          </Notice>
        )}
        <Panel padded={false}>
          <PanelFooter
            className="border-t-0"
            leading="Зірочкою позначено обов’язкове поле"
          >
            <Button asChild variant="quiet">
              <Link to={backPath}>Скасувати</Link>
            </Button>
            <Button
              {...save.triggerProps}
              disabled={!mutationsAllowed || save.pending}
              type="submit"
              variant="primary"
            >
              {save.pending
                ? 'Зберігаємо…'
                : editing
                  ? 'Зберегти зміни'
                  : 'Створити клієнта'}
            </Button>
          </PanelFooter>
        </Panel>
      </form>
    </PageBody>
  )
}
