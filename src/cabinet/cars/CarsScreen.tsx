import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import { sourceReturnPath } from '../parts/source-return'
import { CabinetLoadingContent } from '../loading-screen'
import { FeatureGate } from '../FeatureFlags'
import { FEATURE_FLAGS } from '@/api/feature-flags'
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Lock,
  CarFront,
  Copy,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  SearchX,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  commonMessages,
  useLocale,
  useT,
  type SupportedCurrency,
  type Translate,
} from '@/i18n'
import {
  ActionMenu,
  Button,
  CodeChip,
  ConfirmDialog,
  DataTable,
  type DataColumn,
  EmptyState,
  Field,
  ErrorState,
  Notice,
  Gallery,
  InlineNotes,
  PhotoFileField,
  Thumbnail,
  PillGroup,
  SearchInput,
  SearchPicker,
  SearchPickerOptions,
  SearchPickerOption,
  StateScreen,
  StatusPill,
  TextArea,
  TextInput,
  useOptionalToast,
} from '@/components/app'
import {
  carsApi,
  type Car,
  type CarExpense,
  type CarListItem,
  type CarListParams,
  type CreateCarRequest,
  type UpdateCarRequest,
  isCarStatus,
} from '@/api/cars'
import { normalizeApiProblem } from '@/api/errors'
import {
  mediaApi,
  type MediaEntityType,
  type MediaUploadResult,
} from '@/api/media'
import { useCabinet } from '../CabinetContext'
import { appMessages } from '@/components/app/app-messages'
import { Crumbs, RedesignShell, RedesignTitle } from '../redesign-shell'
import { intakesMessages } from '../intakes/messages'
import type { Permission } from '../access-types'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import {
  cabinetModules,
  type CabinetModuleDefinition,
} from '../module-registry'
import { evaluateModuleAccess } from '../policy'
import type { ModuleAccessDecision } from '../policy'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { CarExpenseDrawer } from './CarExpenseDrawer'
import { CarPartsCard } from './CarPartsCard'
import { CarPayoffPill, CarProfitabilityCard } from './CarProfitabilityCard'
import { carCardMessages } from './car-card-messages'
import { carFormMessages } from './car-form-messages'
import { formatDay } from './day'
import { carsMessages } from './messages'
import { useCarMoney } from './car-money'
import { currencyMessages } from '../currency/messages'
import { MoneyInput } from '../currency/price-currency'
import {
  useAccountingCurrency,
  useFirstPriceGuard,
} from '../currency/use-accounting-currency'
import { usePriceSlots, type PriceSlots } from '../currency/use-price-slots'
import { useCurrencyDraft } from '../currency/form-draft'
import { amountPrecisionError } from '../currency/amount-precision'

/**
 * The shots that make a car card usable to someone who never saw the car. The
 * order is the upload order: photo N carries suggestion N, so the labels guide
 * without pretending the server stores a slot per shot.
 */
const CAR_SHOTS = [
  'shotFront',
  'shotRearQuarter',
  'shotSide',
  'shotInterior',
  'shotDisplay',
  'shotVinPlate',
] as const

/**
 * How long the car has been sitting, in whole days. A yard reads this as money
 * standing still, so it goes next to the acquisition date rather than being
 * left for the reader to work out.
 */
const daysOnStock = (acquiredAt: string): number | null => {
  const since = new Date(acquiredAt)
  if (Number.isNaN(since.getTime())) return null
  return Math.max(0, Math.round((Date.now() - since.getTime()) / 86_400_000))
}

/** `formatDay` bound to the reader's locale and the business time zone. */
function useDay() {
  const { locale, timeZone } = useLocale()
  return (value: string) => formatDay(value, locale, timeZone)
}
const positiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
const pageSizeParam = (value: string | null, fallback: number) => {
  const parsed = positiveInteger(value, fallback)
  return parsed <= 100 ? parsed : fallback
}

function useAccess() {
  const cabinet = useCabinet()
  const access =
    cabinet.status === 'ready' && cabinet.snapshot
      ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  const decision = (
    definition: CabinetModuleDefinition,
    permission: Permission,
    quota: boolean,
  ): ModuleAccessDecision => {
    const { quotaResource, ...definitionWithoutQuota } = definition
    return evaluateModuleAccess(
      {
        ...definitionWithoutQuota,
        mutationPermission: permission,
        ...(quota && quotaResource !== undefined ? { quotaResource } : {}),
      },
      access,
      'mutation',
    )
  }
  const viewAllowed = (
    definition: CabinetModuleDefinition,
    permission: Permission,
  ) =>
    evaluateModuleAccess(
      { ...definition, viewPermission: permission },
      access,
      'view',
    ).kind === 'allowed'
  const carCreateDecision = decision(cabinetModules.cars, 'cars.manage', true)
  const financeManageDecision = decision(
    cabinetModules.cars,
    'finance.manage',
    false,
  )
  return {
    cabinet,
    createDecision:
      carCreateDecision.kind === 'allowed'
        ? financeManageDecision
        : carCreateDecision,
    manageDecision: decision(cabinetModules.cars, 'cars.manage', false),
    partsView: viewAllowed(cabinetModules.parts, 'parts.view'),
    partsManage:
      decision(cabinetModules.parts, 'parts.manage', false).kind === 'allowed',
    financeView: viewAllowed(cabinetModules.cars, 'finance.view'),
    financeManage: financeManageDecision.kind === 'allowed',
  }
}

function Denied({ decision }: { decision: ModuleAccessDecision }) {
  const t = useT(carsMessages)
  const message =
    decision.kind === 'quota-exhausted'
      ? t('deniedQuota')
      : decision.kind === 'subscription-blocked'
        ? t('deniedSubscription')
        : t('deniedPermission')
  return (
    <RedesignShell
      crumb={
        <>
          <span>{t('eyebrow')}</span>
          <ChevronRight aria-hidden className="size-3" />
          <span aria-current="page">{t('title')}</span>
        </>
      }
    >
      <StateScreen
        className="min-h-[420px]"
        icon={<Lock aria-hidden />}
        role="alert"
        title={message}
        tone="warn"
      />
    </RedesignShell>
  )
}

export function CarsScreen(_props: Partial<CabinetModuleScreenProps> = {}) {
  const { cabinet, createDecision, manageDecision } = useAccess()
  const tf = useT(carFormMessages)
  const { tenant, carId } = useParams<{ tenant: string; carId: string }>()
  const location = useLocation()
  const base = `/app/${tenant ?? cabinet.targetTenant?.slug ?? ''}/cars`
  if (location.pathname.endsWith('/new') && createDecision.kind !== 'allowed')
    return <Denied decision={createDecision} />
  if (location.pathname.endsWith('/edit') && manageDecision.kind !== 'allowed')
    return <Denied decision={manageDecision} />
  if (location.pathname.endsWith('/new'))
    return <CarForm title={tf('newCar')} />
  if (carId && location.pathname.endsWith('/edit'))
    return <CarForm carId={carId} title={tf('editCar')} />
  return carId ? (
    <CarDetail base={base} carId={carId} key={carId} />
  ) : (
    <CarsList base={base} />
  )
}

/** How the table is ordered. The list endpoint has no sort yet, so this orders
 *  the page that came back — the control says «на цій сторінці» when there is
 *  more than one, rather than pretending it reordered the whole yard. */
type CarSort = 'payback' | 'parts'
const isCarSort = (value: string | null): value is CarSort =>
  value === 'payback' || value === 'parts'

const sortCars = (cars: readonly CarListItem[], sort: CarSort) =>
  [...cars].sort((left, right) =>
    sort === 'parts'
      ? right.partsCount - left.partsCount
      : (right.profitability?.recoupedPercent ?? -1) -
        (left.profitability?.recoupedPercent ?? -1),
  )

/** How far a car has paid off: a short bar with the percentage beside it. */
function PaybackCell({ percent }: { percent: number | null }) {
  const value = percent ?? 0
  return (
    <span className="flex w-[120px] items-center gap-2">
      <span
        aria-hidden
        className={cn(
          'rz-meter flex-1',
          value > 0 && value < 100 && 'rz-meter--warn',
        )}
      >
        <span style={{ width: `${String(Math.min(value, 100))}%` }} />
      </span>
      <span
        className={cn(
          'rz-mono w-11 shrink-0 text-right text-caption',
          value >= 100 ? 'text-state-ok' : value > 0 ? 'rz-strong' : 'rz-dim',
        )}
      >
        {percent === null ? '—' : `${String(percent)} %`}
      </span>
    </span>
  )
}

function CarsList({ base }: { base: string }) {
  const { createDecision, financeView, partsManage } = useAccess()
  const t = useT(carsMessages)
  const tf = useT(carFormMessages)
  const tk = useT(carCardMessages)
  const ti = useT(intakesMessages)
  const ta = useT(appMessages)
  const accounting = useAccountingCurrency()
  const number = useCarMoney(null)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const selected = useMemo<CarListParams>(
    () => ({
      search: params.get('search') ?? undefined,
      status: isCarStatus(params.get('status'))
        ? (params.get('status') as CarListParams['status'])
        : undefined,
      page: positiveInteger(params.get('page'), 1),
      pageSize: pageSizeParam(params.get('pageSize'), 20),
    }),
    [params],
  )
  const sort: CarSort = isCarSort(params.get('sort'))
    ? (params.get('sort') as CarSort)
    : 'payback'
  const [query, setQuery] = useState(params.get('search') ?? '')
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${JSON.stringify(selected)}#${String(attempt)}`
  const [result, setResult] = useState<{
    key: string
    page: Awaited<ReturnType<typeof carsApi.list>> | null
    problem: string | null
  } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void carsApi.list(selected, { signal: controller.signal }).then(
      (page) => setResult({ key: requestKey, page, problem: null }),
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key: requestKey,
            page: null,
            problem: normalizeApiProblem(error).message,
          })
      },
    )
    return () => controller.abort()
  }, [selected, requestKey])
  const change = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    )
    setParams(next)
  }
  const loading = result?.key !== requestKey
  const data = result?.page ?? null
  const problem = loading ? null : (result?.problem ?? null)
  const page = data?.page ?? selected.page ?? 1
  const totalPages = data?.totalPages ?? 1
  const cars = sortCars(data?.items ?? [], sort)
  const filtered =
    selected.search !== undefined || selected.status !== undefined
  const canCreate = createDecision.kind === 'allowed'
  // Why the action is off — a limit or a lapsed plan says so on the button
  // itself instead of the button silently disappearing.
  const createBlocked =
    createDecision.kind === 'quota-exhausted'
      ? t('deniedQuota')
      : createDecision.kind === 'subscription-blocked'
        ? t('deniedSubscription')
        : createDecision.kind === 'permission-denied'
          ? t('deniedPermission')
          : null
  const unit = accounting.currency === null ? '' : `, ${accounting.currency}`
  const partsBase = base.replace(/\/cars$/, '/parts')

  const addCar = canCreate ? (
    <Button asChild variant="primary">
      <Link to={`${base}/new`}>
        <Plus aria-hidden />
        {t('addCar')}
      </Link>
    </Button>
  ) : createBlocked === null ? null : (
    <Button disabled title={createBlocked} variant="primary">
      <Plus aria-hidden />
      {t('addCar')}
    </Button>
  )

  const columns: DataColumn<CarListItem>[] = [
    {
      key: 'code',
      label: tf('codeLabel'),
      cell: (car) => <span className="rz-code rz-code--sm">{car.code}</span>,
    },
    {
      key: 'car',
      label: tf('checkMakeModel'),
      variant: 'primary',
      cell: (car) => (
        <Link
          className="rz-strong font-medium whitespace-nowrap"
          onClick={(event) => event.stopPropagation()}
          to={`${base}/${car.id}`}
        >
          {car.brand} {car.model} · {String(car.year)}
        </Link>
      ),
    },
    {
      key: 'status',
      label: ti('columnStatus'),
      cell: (car) => (
        <StatusPill tone={car.status === 'active' ? 'ok' : 'neutral'}>
          {car.status === 'active' ? t('cardActive') : t('cardArchived')}
        </StatusPill>
      ),
    },
    {
      key: 'parts',
      label: t('cardParts'),
      align: 'end',
      cell: (car) => <span className="rz-strong">{car.partsCount}</span>,
    },
    {
      key: 'sold',
      label: t('cardSold'),
      align: 'end',
      cell: (car) => <span className="rz-muted">{car.soldPartsCount}</span>,
    },
    ...(financeView
      ? ([
          {
            key: 'invested',
            label: `${tk('invested')}${unit}`,
            align: 'end',
            cell: (car) => (
              <span className="rz-strong">
                {car.profitability ? number(car.profitability.invested) : '—'}
              </span>
            ),
          },
          {
            key: 'recouped',
            label: `${t('cardRecouped')}${unit}`,
            align: 'end',
            cell: (car) => (
              <span className="rz-strong">
                {car.profitability ? number(car.profitability.recouped) : '—'}
              </span>
            ),
          },
          {
            key: 'payback',
            label: t('sortPayback'),
            cell: (car) => (
              <PaybackCell
                percent={car.profitability?.recoupedPercent ?? null}
              />
            ),
          },
        ] satisfies DataColumn<CarListItem>[])
      : []),
    {
      key: 'days',
      label: tk('partsInStock'),
      align: 'end',
      cell: (car) => {
        const days = daysOnStock(car.acquiredAt)
        return (
          <span className="rz-muted">
            {days === null ? '—' : t('daysOnStock', { count: days })}
          </span>
        )
      },
    },
  ]

  return (
    <RedesignShell
      actions={
        partsManage || addCar !== null ? (
          <>
            {partsManage ? (
              <FeatureGate name={FEATURE_FLAGS.partsBulkImport}>
                <Button asChild variant="quiet">
                  <Link to={`${partsBase}/imports`}>
                    <Upload aria-hidden />
                    {t('importParts')}
                  </Link>
                </Button>
              </FeatureGate>
            ) : null}
            {addCar}
          </>
        ) : undefined
      }
      banner={
        createDecision.kind === 'quota-exhausted' ? (
          <div className="rz-banner rz-banner--warn" role="status">
            <strong className="rz-strong">{t('deniedQuota')}</strong>
          </div>
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
      <RedesignTitle
        aside={
          problem === null ? (
            <span className="rz-mono rz-dim">{data?.total ?? 0}</span>
          ) : undefined
        }
        title={t('title')}
      />

      <div className="rz-toolbar" role="search">
        <form
          className="flex min-w-0 flex-[0_1_340px]"
          onSubmit={(event) => {
            event.preventDefault()
            change({ search: query.trim() || undefined, page: '1' })
          }}
        >
          <SearchInput
            aria-label={t('searchLabel')}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchLabel')}
            value={query}
          />
          <button className="sr-only" type="submit">
            {t('searchSubmit')}
          </button>
        </form>
        <PillGroup
          label={t('statusFilter')}
          onChange={(next) => change({ status: next || undefined, page: '1' })}
          options={[
            { value: '', label: t('filterAll') },
            { value: 'active', label: t('filterActive') },
            { value: 'archived', label: t('filterArchived') },
          ]}
          value={selected.status ?? ''}
        />
        {selected.search !== undefined && data !== null ? (
          <span className="rz-caption">
            {t('found')} <span className="rz-mono">{data.total}</span>
          </span>
        ) : null}
        {financeView ? (
          <div className="rz-toolbar__end">
            <PillGroup
              label={totalPages > 1 ? t('sortLabelThisPage') : t('sortLabel')}
              onChange={(next) => change({ sort: next })}
              options={[
                { value: 'payback', label: t('sortPayback') },
                { value: 'parts', label: t('sortParts') },
              ]}
              value={sort}
            />
          </div>
        ) : null}
      </div>

      {loading ? (
        <CabinetLoadingContent module="cars" heading={false} />
      ) : problem !== null ? (
        <ErrorState
          description={problem}
          onRetry={() => setAttempt((current) => current + 1)}
        />
      ) : cars.length === 0 && page <= 1 ? (
        filtered ? (
          <EmptyState
            actions={
              <Button
                onClick={() => {
                  setQuery('')
                  change({ search: undefined, status: undefined, page: '1' })
                }}
              >
                <X aria-hidden />
                {ta('clearFilter')}
              </Button>
            }
            icon={<SearchX aria-hidden />}
            tone="neutral"
            title={t('emptyTitle')}
          />
        ) : (
          <EmptyState
            actions={canCreate ? addCar : undefined}
            description={t('emptyDescription')}
            icon={<CarFront aria-hidden />}
            title={t('emptyTitle')}
          />
        )
      ) : (
        // Headers may wrap, as v2 draws «Вкладено, ₴» over two lines, so the
        // money columns fit beside the rest on a laptop.
        <div className="[&_thead_th]:whitespace-normal">
          <DataTable
            caption={t('listLabel')}
            columns={columns}
            footer={
              <nav aria-label={t('paginationLabel')} className="rz-pager">
                <p className="m-0">
                  {t('pageOf', { page, total: totalPages })}
                </p>
                <span className="rz-pager__nav">
                  <Button
                    aria-label={t('previousPage')}
                    disabled={page <= 1}
                    onClick={() => change({ page: String(page - 1) })}
                    size="icon"
                    className="rz-btn--sm"
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    aria-label={t('nextPage')}
                    disabled={page >= totalPages}
                    onClick={() => change({ page: String(page + 1) })}
                    size="icon"
                    className="rz-btn--sm"
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </span>
              </nav>
            }
            onRowClick={(car) => void navigate(`${base}/${car.id}`)}
            rowKey={(car) => car.id}
            rows={cars}
          />
        </div>
      )}
    </RedesignShell>
  )
}

/**
 * Common colour names to a swatch. Unknown names get a neutral chip rather
 * than a guess — a wrong colour dot is worse than none.
 */
const carColors: Record<string, string> = {
  blue: '#3b6fd4',
  black: '#1c1c1e',
  white: '#e9e7e4',
  silver: '#b9b7b4',
  grey: '#7c7a77',
  gray: '#7c7a77',
  red: '#c8443c',
  green: '#3f9a63',
  yellow: '#d7b13a',
  orange: '#d9762f',
  brown: '#7a5a3c',
  beige: '#cbbfa6',
  // Polish names, so a colour picked in Polish keeps its dot.
  biały: '#e9e7e4',
  czarny: '#1c1c1e',
  szary: '#7c7a77',
  srebrny: '#b9b7b4',
  niebieski: '#3b6fd4',
  czerwony: '#c8443c',
  zielony: '#3f9a63',
  żółty: '#d7b13a',
  синій: '#3b6fd4',
  чорний: '#1c1c1e',
  білий: '#e9e7e4',
  сірий: '#7c7a77',
  червоний: '#c8443c',
  зелений: '#3f9a63',
  жовтий: '#d7b13a',
  срібний: '#b9b7b4',
}
const colorSwatch = (value: string) =>
  carColors[value.trim().toLowerCase()] ?? 'var(--color-app-line-2)'

/**
 * The colours a yard writes down most often, offered as one tap. The field
 * itself stays free text — the server takes any word, and these are only a
 * shortcut to the usual ones.
 */
const CAR_COLOR_KEYS = [
  'colorWhite',
  'colorBlack',
  'colorGrey',
  'colorSilver',
  'colorBlue',
  'colorRed',
] as const
/** The quick colours in the reader's language: the word is what gets saved. */
const quickColors = (tf: Translate<(typeof carFormMessages)['uk']>) =>
  CAR_COLOR_KEYS.map((key) => ({ label: tf(key) }))

function CarDetail({ base, carId }: { base: string; carId: string }) {
  const { manageDecision, partsView, partsManage, financeView, financeManage } =
    useAccess()
  const manage = manageDecision.kind === 'allowed'
  const t = useT(carsMessages)
  const tf = useT(carFormMessages)
  const tc = useT(commonMessages)
  const photosTitleId = useId()
  const day = useDay()
  const accounting = useAccountingCurrency()
  const navigate = useNavigate()
  const [car, setCar] = useState<Car | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const toast = useOptionalToast()
  const [busy, setBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState<
    'archive' | 'delete' | null
  >(null)
  const { requireLatestMutation } = useLatestMutationGuard(cabinetModules.cars)
  const load = async () => {
    try {
      setCar(await carsApi.get(carId))
      setProblem(null)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    void carsApi.get(carId).then(
      (value) => {
        if (!controller.signal.aborted) setCar(value)
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setProblem(normalizeApiProblem(error).message)
      },
    )
    return () => controller.abort()
  }, [carId])
  const lifecycle = async (action: 'archive' | 'delete') => {
    if (busy) return
    setPendingAction(null)
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      if (action === 'archive')
        await carsApi.archive(carId, { signal: scope.signal })
      else await carsApi.remove(carId, { signal: scope.signal })
      void navigate(base)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }
  const copyVin = async (vin: string) => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(vin)
      toast?.show({ tone: 'ok', message: t('vinCopied') })
    } catch {
      setProblem(t('vinCopyFailed'))
    }
  }
  const crumb = (
    <Crumbs
      items={[
        t('eyebrow'),
        <Link className="text-app-muted" key="cars" to={base}>
          {t('title')}
        </Link>,
        ...(car ? [<span key="code">{car.code}</span>] : []),
      ]}
    />
  )
  if (!car)
    return (
      <RedesignShell crumb={crumb} width="record">
        {problem ? (
          <ErrorState
            actions={
              <>
                <Button asChild>
                  <Link to={base}>
                    <ArrowLeft aria-hidden />
                    {t('backToCars')}
                  </Link>
                </Button>
                <Button onClick={() => void load()} variant="primary">
                  <RefreshCw aria-hidden />
                  {tc('retry')}
                </Button>
              </>
            }
            description={problem}
            title={t('loadFailed')}
          />
        ) : (
          <CabinetLoadingContent module="cars" label={t('loading')} />
        )}
      </RedesignShell>
    )
  const profit = car.profitability
  // What "invested" is made of, so the figure is not a number to take on trust.
  const expensesTotal = (car.expenses ?? []).reduce(
    (sum, expense) => sum + expense.amount,
    0,
  )
  const onStock = daysOnStock(car.acquiredAt)
  const partsBase = base.replace(/\/cars$/, '/parts')
  const partsHref = `${partsBase}?car_ids=${car.id}`
  // A car with parts cannot be deleted; say so before asking, not after.
  const partsOnCar = car.profitability?.partsTotal ?? null
  const deleteBlocked =
    pendingAction === 'delete' && partsOnCar !== null && partsOnCar > 0
  const archived = car.status === 'archived'

  const photos = car.photos.map((photo, index) => {
    const shot = CAR_SHOTS[index]
    return {
      id: photo.id,
      url: photo.url,
      ...(photo.thumbnailUrl ? { thumbnailUrl: photo.thumbnailUrl } : {}),
      alt: t('photoAlt', {
        shot:
          shot === undefined ? t('shotNumber', { number: index + 1 }) : t(shot),
        code: car.code,
      }),
    }
  })

  return (
    <div className="grid content-start">
      <RedesignShell
        actions={
          manage || partsManage ? (
            <>
              {partsManage && car.status !== 'archived' ? (
                <FeatureGate name={FEATURE_FLAGS.partsBulkImport}>
                  <Button asChild variant="quiet">
                    <Link
                      to={`${partsBase}/imports?car_id=${encodeURIComponent(car.id)}`}
                    >
                      <Upload aria-hidden />
                      {t('importParts')}
                    </Link>
                  </Button>
                </FeatureGate>
              ) : null}
              {partsManage && car.status !== 'archived' ? (
                <Button asChild>
                  {/* The part form picks the car up from the link. */}
                  <Link to={`${partsBase}/new?car_id=${car.id}`}>
                    <Plus aria-hidden />
                    {t('addPart')}
                  </Link>
                </Button>
              ) : null}
              {manage ? (
                <Button asChild variant="primary">
                  <Link to={`${base}/${car.id}/edit`}>
                    <Pencil aria-hidden />
                    {tc('edit')}
                  </Link>
                </Button>
              ) : null}
              {manage ? (
                <ActionMenu
                  actions={[
                    ...(car.vin
                      ? [
                          {
                            key: 'copy-vin',
                            label: t('copyVin'),
                            icon: <Copy aria-hidden />,
                            onSelect: () => void copyVin(car.vin ?? ''),
                          },
                        ]
                      : []),
                    {
                      key: 'archive',
                      label: t('archive'),
                      icon: <Archive aria-hidden />,
                      disabled: busy,
                      onSelect: () => setPendingAction('archive'),
                    },
                    {
                      key: 'delete',
                      label: tf('deleteCar'),
                      icon: <Trash2 aria-hidden />,
                      destructive: true,
                      disabled: busy,
                      onSelect: () => setPendingAction('delete'),
                    },
                  ]}
                  label={t('moreActions')}
                />
              ) : null}
            </>
          ) : undefined
        }
        crumb={crumb}
        width="record"
      >
        <div className="grid gap-4">
          {problem ? <Notice tone="danger">{problem}</Notice> : null}

          <div className="grid gap-2">
            <div className="rz-page-head items-center">
              <h1 className="rz-h-page text-balance">
                {car.brand} {car.model} · {String(car.year)}
              </h1>
              <StatusPill tone={car.status === 'active' ? 'ok' : 'neutral'}>
                {car.status === 'active'
                  ? t('statusActive')
                  : t('statusArchived')}
              </StatusPill>
              {financeView && profit ? <CarPayoffPill profit={profit} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rz-code pr-2">{car.code}</span>
              {car.vin ? (
                <CodeChip
                  code={car.vin}
                  label={t('copyVin')}
                  onCopy={() => {
                    void copyVin(car.vin ?? '')
                  }}
                />
              ) : null}
              <span className="rz-caption">
                {t('onStockSince', { date: day(car.acquiredAt) })}
                {onStock === null
                  ? ''
                  : ` · ${t('daysOnStock', { count: onStock })}`}
              </span>
              {car.color ? (
                <span className="rz-caption flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="border-app-line-2 size-2.5 rounded-full border"
                    style={{ background: colorSwatch(car.color) }}
                  />
                  {car.color}
                </span>
              ) : null}
            </div>
          </div>

          {financeView && profit ? (
            <CarProfitabilityCard
              currency={accounting.currency}
              expensesTotal={expensesTotal}
              profit={profit}
              purchasePrice={car.purchasePrice}
            />
          ) : null}

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div
              aria-label={t('summaryLabel')}
              className="grid min-w-0 gap-4"
              role="complementary"
            >
              {profit ? (
                <CarPartsCard
                  partsHref={partsView ? partsHref : null}
                  profit={profit}
                />
              ) : null}

              {financeView ? (
                <Expenses
                  car={car}
                  canManage={financeManage}
                  onChanged={load}
                  onProblem={setProblem}
                />
              ) : null}
            </div>

            <section
              aria-labelledby={photosTitleId}
              className="rz-card min-w-0"
            >
              <header className="rz-card__head py-2.5">
                <h2 className="rz-h-card" id={photosTitleId}>
                  {t('photosAndNotes')}
                </h2>
                <span className="rz-caption">
                  {t('photoCount', { count: car.photos.length })}
                </span>
              </header>
              <div className="rz-card__body grid gap-3.5">
                <section aria-label={t('photosTitle')}>
                  <Gallery
                    emptyLabel={
                      <span className="grid gap-1">
                        <span className="rz-strong">{t('photosEmpty')}</span>
                        <span className="rz-caption text-pretty">
                          {t('photosAdvice', {
                            shots: CAR_SHOTS.slice(0, 3)
                              .map((shot) => t(shot))
                              .join(', ')
                              .toLowerCase(),
                          })}
                        </span>
                      </span>
                    }
                    label={t('galleryLabel', { code: car.code })}
                    title={`${car.brand} ${car.model} · ${String(car.year)}`}
                    coverLabel={tf('coverPhoto')}
                    photos={photos}
                  />
                </section>
                <InlineNotes
                  busy={busy}
                  canEdit={manage}
                  key={car.id}
                  onSave={async (value) => {
                    const scope = requireLatestMutation({ quota: false })
                    const updated = await carsApi.update(
                      car.id,
                      { notes: value },
                      { signal: scope.signal },
                    )
                    requireLatestMutation({ quota: false })
                    return updated.notes ?? null
                  }}
                  onSaved={(notes) => {
                    setCar((current) =>
                      current?.id === car.id ? { ...current, notes } : current,
                    )
                  }}
                  readBack={async () => {
                    const scope = requireLatestMutation({ quota: false })
                    const latest = await carsApi.get(car.id, {
                      signal: scope.signal,
                    })
                    requireLatestMutation({ quota: false })
                    return latest.notes ?? null
                  }}
                  value={car.notes}
                >
                  {({ action, content }) => (
                    <div className="border-app-line grid gap-3 border-t pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="rz-th-label m-0">{t('notesTitle')}</h3>
                        {action}
                      </div>
                      {content}
                    </div>
                  )}
                </InlineNotes>
              </div>
            </section>
          </div>
        </div>
      </RedesignShell>

      <ConfirmDialog
        confirmLabel={
          deleteBlocked
            ? archived
              ? t('understood')
              : t('archive')
            : pendingAction === 'archive'
              ? t('archive')
              : tc('delete')
        }
        consequence={
          deleteBlocked
            ? `${t('deleteBlockedParts', { count: partsOnCar ?? 0 })} ${archived ? t('deleteBlockedArchived') : t('deleteBlockedArchiveHint')}`
            : pendingAction === 'archive'
              ? t('archiveConsequence')
              : t('deleteConsequence')
        }
        destructive={pendingAction === 'delete' && !deleteBlocked}
        onConfirm={() => {
          if (deleteBlocked && archived) setPendingAction(null)
          else
            void lifecycle(
              deleteBlocked ? 'archive' : (pendingAction ?? 'archive'),
            )
        }}
        onOpenChange={(open) => setPendingAction(open ? pendingAction : null)}
        open={pendingAction !== null}
        pending={busy}
        title={
          deleteBlocked
            ? t('deleteBlockedTitle')
            : pendingAction === 'archive'
              ? t('archiveTitle')
              : t('deleteTitle')
        }
      />
    </div>
  )
}

function Expenses({
  car,
  canManage,
  onChanged,
  onProblem,
}: {
  car: Car
  canManage: boolean
  onChanged: () => Promise<void>
  onProblem: (message: string) => void
}) {
  const { requireLatestMutation } = useLatestMutationGuard(cabinetModules.cars)
  const t = useT(carsMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const day = useDay()
  const toast = useOptionalToast()
  // An expense typed before leaving for the currency setting reopens here.
  const draft = useCurrencyDraft<{
    name: string
    amount: string
    editingId: string | null
  }>(`car-expense:${car.id}`)
  const [name, setName] = useState(() => draft.initial?.name ?? '')
  const [amount, setAmount] = useState(() => draft.initial?.amount ?? '')
  const [editing, setEditing] = useState<CarExpense | null>(
    () =>
      (car.expenses ?? []).find(
        (expense) => expense.id === draft.initial?.editingId,
      ) ?? null,
  )
  const [formOpen, setFormOpen] = useState(() => draft.initial !== null)
  const [pendingRemoval, setPendingRemoval] = useState<CarExpense | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    name: string | null
    amount: string | null
  }>({ name: null, amount: null })
  const [busy, setBusy] = useState(false)
  const titleId = useId()
  const guard = useFirstPriceGuard()
  const money = useCarMoney(guard.currency)
  const price = usePriceSlots(guard, {
    values: [amount],
    onAccept: (accepted) => void create(undefined, accepted),
    draftKept: true,
    onLeave: () => draft.keep({ name, amount, editingId: editing?.id ?? null }),
  })
  const create = async (
    event?: FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    const value = Number(amount)
    if (!canManage || busy || price.disabled) return
    // Each problem goes under the field it is about, as v2 draws the sheet.
    const nameError = name.trim() ? null : t('expenseNameRequired')
    const amountError =
      !Number.isFinite(value) || value <= 0
        ? t('expenseAmountInvalid')
        : amountPrecisionError(value, guard.currency, locale)
    setFieldErrors({ name: nameError, amount: amountError })
    if (nameError !== null || amountError !== null) {
      setFormError(null)
      return
    }
    setFormError(null)
    setBusy(true)
    try {
      if (guard.needsCheck(true) && !(await guard.beforeSave(true, accepted)))
        return
      requireLatestMutation({ permission: 'cars.view', quota: false })
      const scope = requireLatestMutation({
        permission: 'finance.manage',
        quota: false,
      })
      if (editing) {
        await carsApi.updateExpense(
          car.id,
          editing.id,
          {
            name: name.trim(),
            amount: value,
          },
          { signal: scope.signal },
        )
      } else {
        await carsApi.createExpense(
          car.id,
          {
            name: name.trim(),
            amount: value,
          },
          { signal: scope.signal },
        )
      }
      guard.afterSave(true)
      await onChanged()
      const message = editing ? t('expenseUpdated') : t('expenseAdded')
      setName('')
      setAmount('')
      setEditing(null)
      setFormOpen(false)
      toast?.show({ message, tone: 'ok' })
    } catch (error: unknown) {
      setFormError(normalizeApiProblem(error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async (expense: CarExpense) => {
    if (!canManage || busy) return
    setPendingRemoval(null)
    setBusy(true)
    try {
      requireLatestMutation({ permission: 'cars.view', quota: false })
      const scope = requireLatestMutation({
        permission: 'finance.manage',
        quota: false,
      })
      await carsApi.removeExpense(car.id, expense.id, { signal: scope.signal })
      await onChanged()
    } catch (error: unknown) {
      onProblem(normalizeApiProblem(error).message)
    } finally {
      setBusy(false)
    }
  }
  const expenses = car.expenses ?? []
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const openForm = (expense: CarExpense | null) => {
    setFormError(null)
    setFieldErrors({ name: null, amount: null })
    setEditing(expense)
    setName(expense?.name ?? '')
    setAmount(expense === null ? '' : String(expense.amount))
    setFormOpen(true)
  }
  return (
    <section aria-labelledby={titleId} className="rz-card min-w-0">
      <header className="rz-card__head gap-4 px-4 py-4 sm:px-5">
        <span className="grid min-w-0 gap-1.5">
          <h2 className="rz-h-card" id={titleId}>
            {t('expensesTitle')}
          </h2>
          <span className="rz-caption text-pretty">{t('expensesIntro')}</span>
        </span>
        {canManage ? (
          <Button disabled={busy} onClick={() => openForm(null)}>
            <Plus aria-hidden />
            {t('addExpense')}
          </Button>
        ) : null}
      </header>
      {expenses.length === 0 ? (
        <EmptyState
          className="min-h-[160px] rounded-none border-0"
          description={t('expensesEmptyDescription')}
          icon={<Wallet aria-hidden />}
          title={t('expensesEmptyTitle')}
          tone="neutral"
        />
      ) : (
        <DataTable
          caption={t('expensesCaption')}
          columns={[
            {
              key: 'name',
              label: t('columnExpense'),
              variant: 'primary',
              cell: (expense: CarExpense) => expense.name,
            },
            {
              key: 'createdAt',
              label: t('columnAdded'),
              cell: (expense: CarExpense) => (
                <span className="rz-mono rz-dim text-caption">
                  {day(expense.createdAt)}
                </span>
              ),
            },
            {
              key: 'amount',
              label: t('columnAmount'),
              align: 'end',
              cell: (expense: CarExpense) => (
                <span className="rz-strong">{money(expense.amount)}</span>
              ),
            },
            ...(canManage
              ? [
                  {
                    key: 'actions',
                    label: tc('actions'),
                    align: 'end' as const,
                    headerHidden: true,
                    cell: (expense: CarExpense) => (
                      <ActionMenu
                        actions={[
                          {
                            key: 'edit',
                            label: tc('edit'),
                            icon: <Pencil aria-hidden />,
                            disabled: busy,
                            onSelect: () => openForm(expense),
                          },
                          {
                            key: 'remove',
                            label: tc('delete'),
                            icon: <Trash2 aria-hidden />,
                            destructive: true,
                            disabled: busy,
                            onSelect: () => setPendingRemoval(expense),
                          },
                        ]}
                        label={t('expenseActions', { name: expense.name })}
                      />
                    ),
                  },
                ]
              : []),
          ]}
          embedded
          footer={
            <div className="rz-card__foot flex-wrap items-baseline">
              <span className="rz-muted">
                {t('expensesTotal', { count: expenses.length })}
              </span>
              <span className="rz-mono rz-strong">{money(total)}</span>
            </div>
          }
          rowKey={(expense: CarExpense) => expense.id}
          rows={expenses}
        />
      )}

      <CarExpenseDrawer
        amount={amount}
        busy={busy}
        editing={editing}
        error={formError}
        fieldErrors={fieldErrors}
        name={name}
        onAmountChange={setAmount}
        onNameChange={setName}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditing(null)
            setFormError(null)
            setFieldErrors({ name: null, amount: null })
          }
        }}
        onSubmit={(event) => void create(event)}
        open={formOpen}
        price={price}
      />

      <ConfirmDialog
        confirmLabel={t('removeExpense')}
        consequence={
          pendingRemoval
            ? t('removeExpenseConsequence', {
                name: pendingRemoval.name,
                amount: money(pendingRemoval.amount),
              })
            : ''
        }
        onConfirm={() => {
          if (pendingRemoval) void remove(pendingRemoval)
        }}
        onOpenChange={(open) => setPendingRemoval(open ? pendingRemoval : null)}
        open={pendingRemoval !== null}
        pending={busy}
        title={t('removeExpenseTitle')}
      />
    </section>
  )
}

interface CarFormValues {
  code: string
  brand: string
  model: string
  year: string
  color: string
  vin: string
  acquiredAt: string
  purchasePrice: string
  notes: string
}

interface CarExpenseDraft {
  id: number
  name: string
  amount: string
}

function CarForm({ carId, title }: { carId?: string; title: string }) {
  const { tenant } = useParams<{ tenant: string }>()
  const { cabinet, financeManage } = useAccess()
  const t = useT(carsMessages)
  const tf = useT(carFormMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const day = useDay()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const base = `/app/${tenant ?? cabinet.targetTenant?.slug ?? ''}/cars`
  const cabinetRoot = base.replace(/\/cars$/, '')
  // What was typed survives the trip to the accounting-currency setting.
  const draft = useCurrencyDraft<{
    values: CarFormValues
    expenses: CarExpenseDraft[]
    makeId: number | null
  }>(`car-form:${carId ?? 'new'}`)
  const [values, setValues] = useState<CarFormValues>(
    () =>
      draft.initial?.values ?? {
        code: '',
        brand: '',
        model: '',
        year: '',
        color: '',
        vin: '',
        acquiredAt: '',
        purchasePrice: '',
        notes: '',
      },
  )
  const [media, setMedia] = useState<MediaUploadResult[]>([])
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [photoOrder, setPhotoOrder] = useState<string[]>([])
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])
  const pendingPreviews = useRef<PendingMedia[]>([])
  useEffect(() => {
    pendingPreviews.current = pendingMedia
  }, [pendingMedia])
  useEffect(
    () => () => {
      if (typeof URL.revokeObjectURL === 'function')
        pendingPreviews.current.forEach((item) =>
          URL.revokeObjectURL(item.previewUrl),
        )
    },
    [],
  )
  const [makeId, setMakeId] = useState<number | null>(
    () => draft.initial?.makeId ?? null,
  )
  const [expenses, setExpenses] = useState<CarExpenseDraft[]>(
    () => draft.initial?.expenses ?? [],
  )
  const [createdCarId, setCreatedCarId] = useState<string | null>(null)
  /** The car as the server last sent it — for its expenses, parts and dates. */
  const [loaded, setLoaded] = useState<Car | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Shown while typing, so the invested sum is not a surprise after saving.
  const initialExpensesTotal = expenses.reduce((sum, expense) => {
    const value = Number(expense.amount)
    return Number.isFinite(value) && value > 0 ? sum + value : sum
  }, 0)
  const [completedExpenseIds, setCompletedExpenseIds] = useState<Set<number>>(
    new Set(),
  )
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(carId !== undefined)
  const [problem, setProblem] = useState<string | null>(null)
  const { requireLatestMutation } = useLatestMutationGuard(cabinetModules.cars)
  const tCurrency = useT(currencyMessages)
  const guard = useFirstPriceGuard()
  const money = useCarMoney(guard.currency)
  const priceEditable = !carId || financeManage
  const price = usePriceSlots(guard, {
    values: priceEditable
      ? [
          values.purchasePrice,
          ...(carId ? [] : expenses.map((expense) => expense.amount)),
        ]
      : [],
    onAccept: (accepted) => void submit(undefined, accepted),
    draftKept: true,
    onLeave: () => draft.keep({ values, expenses, makeId }),
  })
  const restoredDraft = draft.initial !== null
  useEffect(() => {
    if (!carId) return
    void carsApi.get(carId).then(
      (car) => {
        setLoading(false)
        setLoaded(car)
        // A draft brought back from the currency setting wins over the
        // server copy it was typed on top of.
        if (!restoredDraft)
          setValues({
            code: car.code,
            brand: car.brand,
            model: car.model,
            year: String(car.year),
            color: car.color ?? '',
            vin: car.vin ?? '',
            acquiredAt: car.acquiredAt,
            purchasePrice: String(car.purchasePrice),
            notes: car.notes ?? '',
          })
        setPhotoOrder(car.photos.map((photo) => photo.storageKey))
        setMedia(
          car.photos.map((photo) => ({
            storageKey: photo.storageKey,
            url: photo.url,
          })),
        )
      },
      (error: unknown) => {
        setLoading(false)
        setProblem(normalizeApiProblem(error).message)
      },
    )
  }, [carId, restoredDraft])
  const submit = async (
    event?: FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    if (busy) return
    if (!carId && price.disabled) {
      // A new car needs its purchase price, and a price needs the currency.
      setProblem(tCurrency('needCurrency'))
      return
    }
    const purchasePrice = Number(values.purchasePrice)
    const request = {
      code: values.code.trim(),
      brand: values.brand.trim(),
      model: values.model.trim(),
      year: Number(values.year),
      color: values.color.trim() || null,
      vin: values.vin.trim() || null,
      acquiredAt: values.acquiredAt || null,
      notes: values.notes.trim() || null,
    }
    if (
      !request.code ||
      !request.brand ||
      !request.model ||
      !Number.isInteger(request.year) ||
      ((!carId || financeManage) && !Number.isFinite(purchasePrice))
    ) {
      setProblem(tf('requiredFieldsMissing'))
      return
    }
    // Core refuses an amount finer than the currency allows; say so here.
    const pricePrecision =
      (!carId || financeManage) && values.purchasePrice.trim() !== ''
        ? amountPrecisionError(purchasePrice, guard.currency, locale)
        : null
    if (pricePrecision !== null) {
      setProblem(pricePrecision)
      return
    }
    const preparedExpenses = expenses.map((expense) => ({
      id: expense.id,
      name: expense.name.trim(),
      amount: Number(expense.amount),
    }))
    if (
      !carId &&
      preparedExpenses.some(
        (expense) =>
          !expense.name ||
          expense.name.length > 200 ||
          !Number.isFinite(expense.amount) ||
          expense.amount <= 0,
      )
    ) {
      setProblem(tf('expensesInvalid'))
      return
    }
    const expensePrecision = carId
      ? null
      : (preparedExpenses
          .map((expense) =>
            amountPrecisionError(expense.amount, guard.currency, locale),
          )
          .find((message) => message !== null) ?? null)
    if (expensePrecision !== null) {
      setProblem(expensePrecision)
      return
    }
    const lifetimeSignal = lifetime.current?.signal
    const requestSignal = (signal: AbortSignal) =>
      lifetimeSignal ? AbortSignal.any([signal, lifetimeSignal]) : signal
    setProblem(null)
    setBusy(true)
    try {
      if (
        guard.needsCheck(price.hasPrice) &&
        !(await guard.beforeSave(price.hasPrice, accepted))
      ) {
        setBusy(false)
        return
      }
      let savedCarId = carId ?? createdCarId
      if (carId) {
        const uploadedMedia = [...media]
        const savedOrder = [...photoOrder]
        // Upload together, then keep each success in the draft if another
        // upload or the car update fails. Retrying will not upload it twice.
        const uploadResults = await Promise.allSettled(
          pendingMedia.map((item) => {
            const scope = requireLatestMutation({ quota: false })
            return mediaApi.upload(item.file, 'cars', {
              signal: requestSignal(scope.signal),
            })
          }),
        )
        lifetimeSignal?.throwIfAborted()
        const completedIds = new Set<string>()
        uploadResults.forEach((result, index) => {
          if (result.status !== 'fulfilled') return
          const item = pendingMedia[index]!
          uploadedMedia.push(result.value)
          const position = savedOrder.indexOf(item.id)
          if (position >= 0) savedOrder[position] = result.value.storageKey
          completedIds.add(item.id)
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
        })
        if (completedIds.size > 0) {
          setMedia([...uploadedMedia])
          setPhotoOrder([...savedOrder])
          setPendingMedia((current) =>
            current.filter((pending) => !completedIds.has(pending.id)),
          )
        }
        const failedUpload = uploadResults.find(
          (result) => result.status === 'rejected',
        )
        if (failedUpload?.status === 'rejected') throw failedUpload.reason
        const updateRequest: UpdateCarRequest = {
          ...request,
          photoKeys: savedOrder,
          // Without an accounting currency the price stays as it is; the
          // rest of the car still saves.
          ...(financeManage && !price.disabled ? { purchasePrice } : {}),
        }
        const scope = requireLatestMutation({ quota: false })
        if ('purchasePrice' in updateRequest)
          requireLatestMutation({
            permission: 'finance.manage',
            quota: false,
          })
        lifetimeSignal?.throwIfAborted()
        const car = await carsApi.update(carId, updateRequest, {
          signal: requestSignal(scope.signal),
        })
        savedCarId = car.id
      } else {
        if (!savedCarId) {
          const uploaded = await Promise.all(
            pendingMedia.map((item) => {
              const uploadScope = requireLatestMutation({ quota: false })
              requireLatestMutation({
                permission: 'finance.manage',
                quota: false,
              })
              return mediaApi.upload(item.file, 'cars', {
                signal: requestSignal(uploadScope.signal),
              })
            }),
          )
          const allMedia = [...media, ...uploaded]
          setMedia(allMedia)
          setPendingMedia([])
          const createRequest: CreateCarRequest = {
            ...request,
            purchasePrice,
            photoKeys: allMedia.map((item) => item.storageKey),
          }
          const scope = requireLatestMutation()
          requireLatestMutation({
            permission: 'finance.manage',
            quota: false,
          })
          const car = await carsApi.create(createRequest, {
            signal: requestSignal(scope.signal),
          })
          savedCarId = car.id
          setCreatedCarId(car.id)
        }
        const completed = new Set(completedExpenseIds)
        for (const expense of preparedExpenses) {
          if (completed.has(expense.id)) continue
          try {
            requireLatestMutation({ permission: 'cars.view', quota: false })
            const scope = requireLatestMutation({
              permission: 'finance.manage',
              quota: false,
            })
            await carsApi.createExpense(
              savedCarId,
              {
                name: expense.name,
                amount: expense.amount,
              },
              { signal: requestSignal(scope.signal) },
            )
            completed.add(expense.id)
            setCompletedExpenseIds(new Set(completed))
          } catch (error: unknown) {
            setProblem(
              tf('expensesPartiallySaved', {
                error: normalizeApiProblem(error).message,
              }),
            )
            setBusy(false)
            return
          }
        }
      }
      lifetimeSignal?.throwIfAborted()
      guard.afterSave(price.hasPrice)
      void navigate(
        (carId === undefined
          ? sourceReturnPath(searchParams, cabinetRoot, { carId: savedCarId })
          : null) ?? `${base}/${savedCarId}`,
      )
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }
  const priceLocked = carId !== undefined && !financeManage
  const summaryId = useId()
  const totalsId = useId()
  const deleteId = useId()
  const remove = async () => {
    if (busy || !carId) return
    setBusy(true)
    try {
      setProblem(null)
      const scope = requireLatestMutation({ quota: false })
      await carsApi.remove(carId, { signal: scope.signal })
      void navigate(base)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setDeleting(false)
      setBusy(false)
    }
  }

  const bind = (key: keyof typeof values) => ({
    disabled: busy,
    name: key,
    onChange: (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ): void => {
      setValues((current) => ({ ...current, [key]: event.target.value }))
    },
    value: values[key],
  })
  const backTo = carId
    ? `${base}/${carId}`
    : (sourceReturnPath(searchParams, cabinetRoot) ?? base)
  const priceNumber = Number(values.purchasePrice)
  const priceValid = Number.isFinite(priceNumber) && priceNumber > 0
  /* On a new car the expenses are still being typed; on an existing one they
     are the car's real expenses, managed on its own page. */
  const expensesTotal = carId
    ? (loaded?.expenses ?? []).reduce((sum, item) => sum + item.amount, 0)
    : initialExpensesTotal
  const invested = (priceValid ? priceNumber : 0) + expensesTotal
  const checks: { label: string; done: boolean }[] = [
    { label: tf('checkCode'), done: values.code.trim() !== '' },
    {
      label: tf('checkMakeModel'),
      done: values.brand.trim() !== '' && values.model.trim() !== '',
    },
    { label: tf('checkYear'), done: /^\d{4}$/.test(values.year.trim()) },
    {
      label: priceLocked ? tf('checkPriceLocked') : tf('checkPrice'),
      done: priceLocked || priceValid,
    },
  ]

  const crumb = (
    <Crumbs
      items={[
        t('eyebrow'),
        <Link className="text-app-muted" key="cars" to={base}>
          {t('title')}
        </Link>,
        ...(carId && loaded !== null
          ? [
              <Link
                className="text-app-muted"
                key="car"
                to={`${base}/${carId}`}
              >
                {loaded.code}
              </Link>,
            ]
          : []),
        <span
          className="inline-block max-w-[6rem] truncate align-bottom sm:max-w-none"
          key="title"
        >
          {title}
        </span>,
      ]}
    />
  )

  if (loading)
    return (
      <RedesignShell crumb={crumb} width="record">
        <CabinetLoadingContent module="cars" label={tf('loadingCar')} />
      </RedesignShell>
    )

  return (
    <div className="rz-form-page grid content-start">
      <form aria-busy={busy} onSubmit={(event) => void submit(event)}>
        <RedesignShell
          actions={
            <>
              <Button asChild variant="quiet">
                <Link to={backTo}>
                  {carId ? <ArrowLeft aria-hidden /> : <X aria-hidden />}
                  {carId ? tf('backToCar') : tc('cancel')}
                </Link>
              </Button>
              <Button
                aria-busy={busy}
                disabled={busy}
                type="submit"
                variant="primary"
              >
                <Check aria-hidden />
                {carId ? tf('saveChanges') : tf('createCar')}
              </Button>
            </>
          }
          crumb={crumb}
          width="record"
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="rz-h-page">{title}</h1>
              <p className="rz-caption m-0">
                {loaded === null
                  ? tf('restLater')
                  : tf('createdOn', { date: day(loaded.createdAt) })}
              </p>
            </div>

            {problem ? <Notice tone="danger">{problem}</Notice> : null}
            {createdCarId ? (
              <Notice tone="ok">
                {tf('createdNotice')}{' '}
                <Link to={`${base}/${createdCarId}`}>{tf('openCar')}</Link>
              </Notice>
            ) : null}

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="grid min-w-0 gap-4">
                <CarStep
                  hint={carId ? tf('identityHintEdit') : tf('identityHintNew')}
                  title={tf('identityTitle')}
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Field
                      hint={tf('codeHint')}
                      label={tf('codeLabel')}
                      required
                    >
                      <TextInput
                        {...bind('code')}
                        className="font-mono"
                        placeholder="RZB-26-0001"
                        required
                      />
                    </Field>
                    <Field
                      hint={tf('yearHint')}
                      label={tf('yearLabel')}
                      required
                    >
                      <TextInput
                        {...bind('year')}
                        className="font-mono"
                        inputMode="numeric"
                        placeholder="2020"
                        required
                      />
                    </Field>
                    <VehicleCatalogPicker
                      disabled={busy}
                      label={tf('makeLabel')}
                      onSelect={(option) => {
                        setMakeId(option.id)
                        setValues((current) => ({
                          ...current,
                          brand: option.name,
                          model: '',
                        }))
                      }}
                      type="make"
                      value={values.brand}
                    />
                    <VehicleCatalogPicker
                      disabled={busy || values.brand === ''}
                      label={tf('modelLabel')}
                      makeId={makeId}
                      makeName={values.brand}
                      onSelect={(option) =>
                        setValues((current) => ({
                          ...current,
                          model: option.name,
                        }))
                      }
                      type="model"
                      value={values.model}
                    />
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Field hint={tf('vinHint')} label="VIN">
                        <TextInput
                          {...bind('vin')}
                          className="font-mono uppercase"
                          maxLength={17}
                          placeholder="WVWD2468F220158A6"
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field
                        hint={tf('colorFreeHint')}
                        label={tf('colorFreeLabel')}
                      >
                        <TextInput
                          {...bind('color')}
                          placeholder={tf('colorPlaceholder')}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <p className="rz-label m-0">{tf('colorTitle')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickColors(tf).map((option) => {
                        const active =
                          values.color.trim().toLowerCase() ===
                          option.label.toLowerCase()
                        return (
                          <Button
                            aria-pressed={active}
                            className={cn(
                              'rounded-full',
                              active && 'border-brand text-brand-text',
                            )}
                            disabled={busy}
                            key={option.label}
                            onClick={() =>
                              setValues((current) => ({
                                ...current,
                                color: active ? '' : option.label,
                              }))
                            }
                            type="button"
                          >
                            {option.label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                </CarStep>

                <CarStep hint={tf('purchaseHint')} title={tf('purchaseTitle')}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      hint={
                        priceLocked ? tf('purchasePriceLocked') : price.hint
                      }
                      label={tf('checkPrice')}
                      required={!priceLocked}
                    >
                      <MoneyInput
                        {...bind('purchasePrice')}
                        className="font-mono"
                        currency={price.currency}
                        disabled={busy || priceLocked || price.disabled}
                        inputMode="decimal"
                        placeholder="10380"
                        required={!priceLocked && !price.disabled}
                      />
                    </Field>
                    <Field label={tf('acquiredAt')}>
                      <TextInput {...bind('acquiredAt')} type="date" />
                    </Field>
                  </div>
                  {priceLocked ? null : price.note}
                </CarStep>

                {financeManage && !carId ? (
                  <CarStep
                    hint={tf('extraExpensesHint')}
                    title={tf('extraExpensesTitle')}
                  >
                    <NewCarExpenses
                      busy={busy}
                      completed={completedExpenseIds}
                      expenses={expenses}
                      onChange={setExpenses}
                      price={price}
                    />
                  </CarStep>
                ) : null}

                <CarStep hint={tf('photosHint')} title={tf('photosTitle')}>
                  {carId ? (
                    <fieldset className="grid gap-3" disabled={busy}>
                      <p className="rz-muted m-0">{tf('photosEditNote')}</p>
                      <PhotoFileField
                        aria-label={tf('addPhotos')}
                        multiple
                        disabled={busy}
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? [])
                          event.target.value = ''
                          if (photoOrder.length + files.length > 10) {
                            setProblem(tf('photosLimit'))
                            return
                          }
                          const picked = files.map((file) => ({
                            id: crypto.randomUUID(),
                            file,
                            previewUrl: URL.createObjectURL(file),
                          }))
                          setPendingMedia((current) => [...current, ...picked])
                          setPhotoOrder((current) => [
                            ...current,
                            ...picked.map((item) => item.id),
                          ])
                        }}
                      />
                      {photoOrder.length === 0 ? (
                        <p className="rz-dim m-0">{tf('noPhotos')}</p>
                      ) : (
                        <ul className="rz-photos m-0 list-none p-0">
                          {photoOrder.map((key, index) => {
                            const existing = media.find(
                              (item) => item.storageKey === key,
                            )
                            const pending = pendingMedia.find(
                              (item) => item.id === key,
                            )
                            return (
                              <li
                                key={key}
                                className="grid min-w-0 content-start gap-2"
                              >
                                <Thumbnail
                                  photo={{
                                    url:
                                      existing?.url ??
                                      pending?.previewUrl ??
                                      '',
                                  }}
                                  alt={tf('currentPhotoAlt', {
                                    number: index + 1,
                                  })}
                                  ratio="wide"
                                />
                                {index === 0 ? (
                                  <span className="rz-pill rz-pill--info justify-self-start">
                                    {tf('coverPhoto')}
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="quiet"
                                    className="min-w-0 justify-self-start whitespace-normal"
                                    aria-label={tf('makeCoverPhoto', {
                                      number: index + 1,
                                    })}
                                    onClick={() =>
                                      setPhotoOrder((current) => [
                                        key,
                                        ...current.filter(
                                          (item) => item !== key,
                                        ),
                                      ])
                                    }
                                  >
                                    {tf('makeCover')}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="quiet"
                                  className="min-w-0 justify-self-start whitespace-normal"
                                  aria-label={tf('removePhotoNumber', {
                                    number: index + 1,
                                  })}
                                  onClick={() => {
                                    setPhotoOrder((current) =>
                                      current.filter((item) => item !== key),
                                    )
                                    setMedia((current) =>
                                      current.filter(
                                        (item) => item.storageKey !== key,
                                      ),
                                    )
                                    setPendingMedia((current) =>
                                      current.filter((item) => item.id !== key),
                                    )
                                    if (pending?.previewUrl)
                                      URL.revokeObjectURL(pending.previewUrl)
                                  }}
                                >
                                  {tf('removePhoto')}
                                </Button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </fieldset>
                  ) : (
                    <PendingMediaPicker
                      disabled={busy}
                      items={pendingMedia}
                      onChange={setPendingMedia}
                    />
                  )}
                </CarStep>

                <CarStep hint={tf('notesHint')} title={tf('notesTitle')}>
                  <Field label={tf('notesTitle')}>
                    <TextArea
                      {...bind('notes')}
                      placeholder={tf('notesPlaceholder')}
                      rows={4}
                    />
                  </Field>
                </CarStep>

                {carId && loaded !== null ? (
                  <section aria-labelledby={deleteId} className="rz-card">
                    <header className="rz-card__head py-2.5">
                      <h2 className="rz-h-card" id={deleteId}>
                        {tf('deleteCar')}
                      </h2>
                    </header>
                    <div className="rz-card__body flex flex-wrap items-center gap-3">
                      <p className="rz-muted m-0 min-w-[240px] flex-1 text-pretty">
                        {loaded.profitability == null
                          ? tf('deleteNoProfitability')
                          : loaded.profitability.partsTotal > 0
                            ? tf('deleteBlockedParts', {
                                count: loaded.profitability.partsTotal,
                              })
                            : tf('deleteAllowed')}
                      </p>
                      <Button
                        disabled={
                          busy || (loaded.profitability?.partsTotal ?? 0) > 0
                        }
                        onClick={() => setDeleting(true)}
                        variant="danger"
                      >
                        <Trash2 aria-hidden />
                        {tf('deleteCar')}
                      </Button>
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="grid min-w-0 gap-3">
                <section aria-labelledby={summaryId} className="rz-card">
                  <header className="rz-card__head py-2.5">
                    <h2 className="rz-h-card" id={summaryId}>
                      {carId ? t('summaryLabel') : tf('beforeCreateTitle')}
                    </h2>
                  </header>
                  <ul className="m-0 grid list-none gap-0.5 px-3 py-2">
                    {checks.map((check) => (
                      <li
                        className={cn(
                          'flex min-h-7 items-center gap-2',
                          check.done ? 'text-app-ink' : 'text-app-muted',
                        )}
                        key={check.label}
                      >
                        {check.done ? (
                          <CircleCheck
                            aria-hidden
                            className="text-state-ok size-3.5 shrink-0"
                          />
                        ) : (
                          <Circle
                            aria-hidden
                            className="text-app-dim size-3.5 shrink-0"
                          />
                        )}
                        {check.label}
                        <span className="sr-only">
                          {check.done ? tf('checkDone') : tf('checkNotDone')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section aria-labelledby={totalsId} className="rz-card">
                  <header className="rz-card__head py-2.5">
                    <h2 className="rz-h-card" id={totalsId}>
                      {tf('summaryTitle')}
                    </h2>
                  </header>
                  <div className="grid gap-3 px-4 py-1">
                    <dl className="m-0 grid grid-cols-[1fr_auto] items-baseline">
                      <dt className="rz-muted py-2">{tf('summaryPrice')}</dt>
                      <dd
                        className={cn(
                          'rz-mono m-0 py-2 text-right',
                          priceValid ? 'text-app-ink' : 'rz-dim',
                        )}
                      >
                        {priceValid ? money(priceNumber) : '—'}
                      </dd>
                      <dt className="rz-muted py-2">{tf('summaryExpenses')}</dt>
                      <dd
                        className={cn(
                          'rz-mono m-0 py-2 text-right',
                          expensesTotal > 0 ? 'text-app-ink' : 'rz-dim',
                        )}
                      >
                        {expensesTotal > 0 ? money(expensesTotal) : '—'}
                      </dd>
                      <dt className="rz-muted border-app-line-2 border-t py-2">
                        {tf('summaryInvested')}
                      </dt>
                      <dd className="rz-mono rz-strong border-app-line-2 m-0 border-t py-2 text-right font-semibold">
                        {invested > 0 ? money(invested) : '—'}
                      </dd>
                    </dl>
                    {priceEditable ? (
                      <div className="pb-3 empty:hidden">{price.saveNotes}</div>
                    ) : null}
                  </div>
                </section>
                <p className="rz-caption m-0">
                  {tf('requiredMarked')}{' '}
                  <span className="text-brand-text">*</span>. {tf('restLater')}
                </p>
              </aside>
            </div>
          </div>
        </RedesignShell>
      </form>

      <ConfirmDialog
        confirmLabel={tf('deleteCar')}
        consequence={tf('deleteConsequence')}
        destructive
        onConfirm={() => void remove()}
        onOpenChange={(next) => {
          if (!next) setDeleting(false)
        }}
        open={deleting}
        pending={busy}
        title={tf('deleteTitle')}
      />
    </div>
  )
}

/** One card of the car form, with its own explanation under the title. */
function CarStep({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rz-card">
      <header className="rz-card__head py-2.5">
        <span className="grid min-w-0 gap-0.5">
          <h2 className="rz-h-card" id={titleId}>
            {title}
          </h2>
          <p className="rz-caption m-0 text-pretty">{hint}</p>
        </span>
      </header>
      <div className="rz-card__body grid gap-3">{children}</div>
    </section>
  )
}

/** The expense rows typed while a car is being created. */
function NewCarExpenses({
  busy,
  completed,
  expenses,
  onChange,
  price,
}: {
  price: PriceSlots
  busy: boolean
  completed: ReadonlySet<number>
  expenses: { id: number; name: string; amount: string }[]
  onChange: (
    update: (
      current: { id: number; name: string; amount: string }[],
    ) => { id: number; name: string; amount: string }[],
  ) => void
}) {
  const tf = useT(carFormMessages)
  const tc = useT(commonMessages)
  return (
    <>
      {expenses.length === 0 ? (
        <p className="rz-inset rz-muted bg-app-sheet-field m-0">
          {tf('noNewExpenses')}
        </p>
      ) : (
        <ul className="m-0 grid list-none p-0">
          {expenses.map((expense, index) => {
            const saved = completed.has(expense.id)
            return (
              <li
                className={cn(
                  'grid gap-3 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-start',
                  index > 0 && 'border-app-line border-t',
                )}
                key={expense.id}
              >
                {/* The label stays short on screen; the number that keeps
                    each row apart is carried in the accessible name. */}
                <Field
                  label={tf('expenseNameLabel')}
                  srLabel={tf('expenseRowSr', { number: index + 1 })}
                >
                  <TextInput
                    disabled={busy || saved}
                    onChange={(event) =>
                      onChange((current) =>
                        current.map((item) =>
                          item.id === expense.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder={tf('expenseNamePlaceholder')}
                    value={expense.name}
                  />
                </Field>
                <Field
                  hint={index === 0 ? price.hint : undefined}
                  label={tf('expenseAmountLabel')}
                  srLabel={tf('expenseRowSr', { number: index + 1 })}
                >
                  <MoneyInput
                    className="font-mono"
                    currency={price.currency}
                    disabled={busy || saved || price.disabled}
                    inputMode="decimal"
                    onChange={(event) =>
                      onChange((current) =>
                        current.map((item) =>
                          item.id === expense.id
                            ? { ...item, amount: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="500"
                    value={expense.amount}
                  />
                </Field>
                <div className="flex items-center justify-end gap-2 sm:self-end sm:pb-0.5">
                  {saved ? (
                    <StatusPill tone="ok">{tc('saved')}</StatusPill>
                  ) : null}
                  <Button
                    aria-label={tf('removeExpenseRow', { number: index + 1 })}
                    disabled={busy || saved}
                    onClick={() =>
                      onChange((current) =>
                        current.filter((item) => item.id !== expense.id),
                      )
                    }
                    size="icon"
                    variant="quiet"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="rz-muted m-0">{tf('expensesLater')}</p>
        <Button
          disabled={busy}
          onClick={() =>
            onChange((current) => [
              ...current,
              { id: Date.now(), name: '', amount: '' },
            ])
          }
        >
          <Plus aria-hidden />
          {tf('addExpense')}
        </Button>
      </div>
    </>
  )
}

interface VehicleOption {
  id: number
  name: string
}
interface PendingMedia {
  id: string
  file: File
  previewUrl: string
}

const vehicleCatalogUrl = 'https://vpic.nhtsa.dot.gov/api/vehicles'

async function loadMakes(): Promise<VehicleOption[]> {
  const response = await fetch(
    `${vehicleCatalogUrl}/GetMakesForVehicleType/car?format=json`,
  )
  if (!response.ok) throw new Error('vehicle-makes-unavailable')
  const payload = (await response.json()) as {
    Results?: {
      MakeId?: number
      Make_ID?: number
      MakeName?: string
      Make_Name?: string
    }[]
  }
  return (payload.Results ?? [])
    .map((item) => ({
      id: item.MakeId ?? item.Make_ID ?? 0,
      name: item.MakeName ?? item.Make_Name ?? '',
    }))
    .filter((item) => item.id > 0 && item.name !== '')
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function loadModels(makeId: number): Promise<VehicleOption[]> {
  const response = await fetch(
    `${vehicleCatalogUrl}/GetModelsForMakeId/${String(makeId)}?format=json`,
  )
  if (!response.ok) throw new Error('vehicle-models-unavailable')
  const payload = (await response.json()) as {
    Results?: { Model_ID?: number; Model_Name?: string }[]
  }
  return (payload.Results ?? [])
    .map((item) => ({ id: item.Model_ID ?? 0, name: item.Model_Name ?? '' }))
    .filter((item) => item.id > 0 && item.name !== '')
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function VehicleCatalogPicker({
  disabled,
  label,
  makeId,
  makeName,
  onSelect,
  type,
  value,
}: {
  disabled: boolean
  label: string
  makeId?: number | null
  makeName?: string
  onSelect: (option: VehicleOption) => void
  type: 'make' | 'model'
  value: string
}) {
  const tf = useT(carFormMessages)
  const ta = useT(appMessages)
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<VehicleOption[]>([])
  const [query, setQuery] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestKey =
    type === 'make' ? 'make' : `${String(makeId)}:${makeName ?? ''}`
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    if (loadedFor === requestKey) return
    let cancelled = false
    const request = async () => {
      if (type === 'make') return loadMakes()
      let resolvedMakeId = makeId ?? null
      if (resolvedMakeId === null) {
        const makes = await loadMakes()
        resolvedMakeId =
          makes.find(
            (make) =>
              make.name.toLowerCase() === (makeName ?? '').toLowerCase(),
          )?.id ?? null
      }
      if (resolvedMakeId === null) return []
      return loadModels(resolvedMakeId)
    }
    void request()
      .then(
        (items) => {
          if (!cancelled) {
            setOptions(items)
            setLoadedFor(requestKey)
          }
        },
        () => {
          if (!cancelled) setProblem(tf('listFailed'))
        },
      )
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadedFor, makeId, makeName, open, requestKey, tf, type])
  const currentOptions = loadedFor === requestKey ? options : []
  const shown = currentOptions.filter((option) =>
    option.name
      .toLocaleLowerCase('uk')
      .includes(query.trim().toLocaleLowerCase('uk')),
  )
  const changeOpen = (next: boolean) => {
    if (next && !open) {
      setLoading(loadedFor !== requestKey)
      setProblem(null)
    }
    setOpen(next)
    if (!next) setQuery('')
  }
  return (
    <SearchPicker
      label={label}
      triggerLabel={
        value || (type === 'make' ? tf('pickMake') : tf('pickModel'))
      }
      placeholder={tf('searchIn', { label })}
      heading={label}
      resultsLabel={label}
      count={
        loading
          ? '…'
          : ta('pickerResultsCount', {
              shown: shown.length,
              total: currentOptions.length,
            })
      }
      disabled={disabled}
      open={open}
      query={query}
      onOpenChange={changeOpen}
      onQueryChange={setQuery}
      showLabel
      required
      allowEmptyQuery
      floating
    >
      {loading ? (
        <p role="status" className="rz-muted m-0 px-4 py-6 text-center">
          {tf('loadingList')}
        </p>
      ) : null}
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      {!loading && !problem ? (
        <SearchPickerOptions label={label}>
          {shown.map((option) => (
            <SearchPickerOption
              key={option.id}
              label={option.name}
              selected={option.name === value}
              onSelect={() => {
                onSelect(option)
                changeOpen(false)
              }}
              aside={
                option.name === value ? (
                  <Check aria-hidden className="text-app-muted size-4" />
                ) : null
              }
            >
              <span className="rz-strong block break-words font-medium">
                {option.name}
              </span>
            </SearchPickerOption>
          ))}
        </SearchPickerOptions>
      ) : null}
      {!loading && !problem && shown.length === 0 ? (
        <p role="status" className="rz-muted m-0 px-4 py-6 text-center">
          {ta('noMatchingOptions')}
        </p>
      ) : null}
    </SearchPicker>
  )
}

function PendingMediaPicker({
  disabled,
  items,
  onChange,
}: {
  disabled: boolean
  items: PendingMedia[]
  onChange: (items: PendingMedia[]) => void
}) {
  const tf = useT(carFormMessages)
  const choose = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files).map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${String(index)}`,
      file,
      previewUrl:
        typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : '',
    }))
    onChange([...items, ...next])
  }
  const remove = (id: string) => {
    const item = items.find((candidate) => candidate.id === id)
    if (item?.previewUrl && typeof URL.revokeObjectURL === 'function')
      URL.revokeObjectURL(item.previewUrl)
    onChange(items.filter((candidate) => candidate.id !== id))
  }
  return (
    <fieldset className="grid gap-3">
      <label className="rz-photo rz-photo--add aspect-auto min-h-28 gap-1 px-5 py-4 text-center">
        <ImagePlus aria-hidden className="size-5" />
        <span className="rz-strong text-body font-semibold">
          {tf('choosePhotos')}
        </span>
        <span className="rz-caption">{tf('uploadAfterCreate')}</span>
        <input
          accept="image/*"
          aria-label={tf('addPhotos')}
          className="sr-only"
          disabled={disabled}
          multiple
          onChange={(event) => choose(event.target.files)}
          type="file"
        />
      </label>
      {items.length === 0 ? (
        <p className="rz-dim m-0">{tf('noFiles')}</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {items.map((item) => (
            <li
              className="border-app-line flex min-w-0 items-center gap-3 rounded-control border p-2"
              key={item.id}
            >
              {item.previewUrl ? (
                <img
                  alt={tf('photoPreview')}
                  className="size-control-lg shrink-0 rounded-rz-xs object-cover"
                  src={item.previewUrl}
                />
              ) : (
                <ImagePlus aria-hidden className="rz-dim size-5" />
              )}
              <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
              <Button
                aria-label={tf('removeFile', { name: item.file.name })}
                disabled={disabled}
                onClick={() => remove(item.id)}
                size="icon"
                variant="quiet"
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

export function MediaPicker({
  additionalPermission,
  beforeDispatch,
  bare = false,
  entityType,
  items,
  onChange,
}: {
  additionalPermission?: Permission
  beforeDispatch?: () => unknown
  /** Drops the picker's own frame and heading, for a host that has one. */
  bare?: boolean
  entityType: Exclude<MediaEntityType, 'tenants'>
  items: MediaUploadResult[]
  onChange: (items: MediaUploadResult[]) => void
}) {
  const tf = useT(carFormMessages)
  const definition = cabinetModules[entityType]
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState<string[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<
    { id: string; name: string; url: string }[]
  >([])
  const pendingPreviewsRef = useRef(pendingPreviews)
  useEffect(() => {
    pendingPreviewsRef.current = pendingPreviews
  }, [pendingPreviews])
  useEffect(
    () => () => {
      if (typeof URL.revokeObjectURL !== 'function') return
      pendingPreviewsRef.current.forEach((item) =>
        URL.revokeObjectURL(item.url),
      )
    },
    [],
  )
  /** Uploads answer with a storage key only, so the file name is kept here. */
  const [names, setNames] = useState<Record<string, string>>({})
  const upload = async (files: FileList | null) => {
    if (!files || busy) return
    setBusy(true)
    const selected = Array.from(files)
    const previews = selected.flatMap((file, index) =>
      typeof URL.createObjectURL === 'function'
        ? [
            {
              id: `${file.name}-${String(file.lastModified)}-${String(index)}`,
              name: file.name,
              url: URL.createObjectURL(file),
            },
          ]
        : [],
    )
    setPendingPreviews(previews)
    const results = await Promise.allSettled(
      selected.map((file) =>
        Promise.resolve().then(() => {
          beforeDispatch?.()
          const scope = requireLatestMutation({ quota: false })
          if (additionalPermission)
            requireLatestMutation({
              permission: additionalPermission,
              quota: false,
            })
          return mediaApi.upload(file, entityType, { signal: scope.signal })
        }),
      ),
    )
    const uploaded = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    )
    const uploadedNames = results.flatMap((result, index) => {
      const file = selected[index]
      return result.status === 'fulfilled' && file
        ? [[result.value.storageKey, file.name] as const]
        : []
    })
    if (uploadedNames.length > 0)
      setNames((current) => ({
        ...current,
        ...Object.fromEntries(uploadedNames),
      }))
    if (uploaded.length > 0) onChange([...items, ...uploaded])
    const errors = results.flatMap((result, index) => {
      const file = selected[index]
      return result.status === 'rejected' && file
        ? [`${file.name}: ${normalizeApiProblem(result.reason).message}`]
        : []
    })
    setProblems(errors)
    if (typeof URL.revokeObjectURL === 'function')
      previews.forEach((item) => URL.revokeObjectURL(item.url))
    setPendingPreviews([])
    setBusy(false)
  }
  const remove = async (item: MediaUploadResult) => {
    if (busy) return
    setBusy(true)
    try {
      beforeDispatch?.()
      const scope = requireLatestMutation({ quota: false })
      if (additionalPermission)
        requireLatestMutation({
          permission: additionalPermission,
          quota: false,
        })
      await mediaApi.remove(item.storageKey, { signal: scope.signal })
      onChange(items.filter((value) => value.storageKey !== item.storageKey))
    } catch (error: unknown) {
      setProblems([normalizeApiProblem(error).message])
    } finally {
      setBusy(false)
    }
  }
  return (
    <fieldset className={cn('grid min-w-0 gap-3', !bare && 'rz-inset')}>
      <legend className={cn('rz-h-card float-left w-full', bare && 'sr-only')}>
        {tf('photosTitle')}
      </legend>
      {bare ? null : <p className="rz-caption m-0">{tf('photosHint')}</p>}
      <PhotoFileField
        aria-label={tf('addPhotos')}
        capture="environment"
        disabled={busy}
        multiple
        onChange={(event) => void upload(event.target.files)}
      />
      {pendingPreviews.length > 0 ? (
        <ul
          aria-label={tf('selectedPhotos')}
          className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2"
        >
          {pendingPreviews.map((item) => (
            <li
              className="border-app-line flex min-w-0 items-center gap-3 rounded-control border p-2"
              key={item.id}
            >
              <img
                alt={tf('previewOf', { name: item.name })}
                className="size-control-lg shrink-0 rounded-rz-xs object-cover"
                src={item.url}
              />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="rz-caption">{tf('uploading')}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {problems.length > 0 ? (
        <div className="rz-notice rz-notice--danger" role="alert">
          <div className="rz-notice__body">
            <p className="text-state-danger m-0 font-medium">
              {tf('uploadFailed')}
            </p>
            <ul className="m-0 mt-1 grid list-none gap-1 p-0">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {items.map((item) => (
            <li
              className="border-app-line rounded-control flex flex-wrap items-center gap-3 border p-2"
              key={item.storageKey}
            >
              <img
                alt={tf('photoPreview')}
                className="size-control-lg shrink-0 rounded-rz-xs object-cover"
                src={item.url}
              />
              <span className="min-w-0 flex-1 truncate">
                {names[item.storageKey] ??
                  item.storageKey.split('/').pop() ??
                  tf('photoFallback')}
              </span>
              <Button
                disabled={busy}
                onClick={() => void remove(item)}
                size="sm"
              >
                <Trash2 aria-hidden />
                {tf('removePhoto')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rz-dim m-0">
          <ImagePlus
            aria-hidden
            className="mr-1.5 inline size-4 align-text-bottom"
          />
          {tf('noFiles')}
        </p>
      )}
    </fieldset>
  )
}
