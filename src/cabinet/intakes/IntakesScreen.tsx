import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
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
import { useFeatureFlag } from '../FeatureFlags'
import { FEATURE_FLAGS } from '@/api/feature-flags'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Inbox,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  SearchX,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Field,
  Notice,
  Pagination,
  PillGroup,
  QuantityStepper,
  SearchInput,
  SectionPanel,
  Sheet,
  Skeleton,
  SkeletonRows,
  StateScreen,
  StatusPill,
  type StatusTone,
  TextArea,
  TextInput,
} from '@/components/app'
import {
  intakesApi,
  type AddIntakePartRequest,
  type CreateIntakeRequest,
  type Intake,
  type IntakeListItem,
  type IntakeListParams,
  isIntakeStatus,
} from '@/api/intakes'
import { inventoryApi } from '@/api/inventory'
import { PartPlacementPicker } from '../inventory/PartPlacementPicker'
import {
  emptyPartPlacement,
  type PartPlacement,
} from '../inventory/part-placement-state'
import { usePlacementOptions } from '../inventory/usePlacementOptions'
import { placementMessages } from '../inventory/part-placement-messages'
import { partsApi } from '@/api/parts'
import { normalizeApiProblem } from '@/api/errors'
import { cn } from '@/lib/utils'
import { commonMessages, useLocale, useT, type Translate } from '@/i18n'
import { formatDay } from '../cars/day'
import { intakeFormMessages } from './intake-form-messages'
import { intakesMessages } from './messages'
import { useCabinet } from '../CabinetContext'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { Crumbs, RedesignShell, RedesignTitle } from '../redesign-shell'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { MediaPicker } from '../cars/CarsScreen'
import { CompatibilityRowCard, ConditionTile } from '../parts/PartFormChoices'
import { partFormMessages } from '../parts/part-form-messages'
import { conditionLabel } from '../parts/part-labels'
import {
  emptyRow,
  resolveCompatibility,
  rowsProblem,
  unknownBrandsMessage,
  type CompatibilityRow,
} from '../parts/compatibility-rows'
import type { MediaUploadResult } from '@/api/media'
import { cabinetModules } from '../module-registry'
import { evaluateModuleAccess } from '../policy'
import type { ModuleAccessDecision } from '../policy'
import type { CabinetModuleDefinition } from '../module-registry'
import type { Permission } from '../access-types'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import type { SupportedCurrency } from '@/i18n'
import { useWholeMoney } from '../currency/money'
import { MoneyInput } from '../currency/price-currency'
import {
  useAccountingCurrency,
  useFirstPriceGuard,
} from '../currency/use-accounting-currency'
import { usePriceSlots } from '../currency/use-price-slots'
import { useCurrencyDraft } from '../currency/form-draft'
import {
  amountPrecisionError,
  BATCH_COST_LIMIT,
} from '../currency/amount-precision'

const defaultPageSize = 20
const positiveInteger = (value: string | null, fallback: number) => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}
const pageSizeParam = (value: string | null, fallback: number) => {
  const number = positiveInteger(value, fallback)
  return number <= 100 ? number : fallback
}
/**
 * Intakes are bought in the accounting currency, like the cars and the parts
 * they become: each screen formats sums with `useWholeMoney` (ISO code, a
 * round sum without cents).
 */

/** `formatDay` bound to the reader's locale and the business time zone. */
function useDay() {
  const { locale, timeZone } = useLocale()
  return (value: string) => formatDay(value, locale, timeZone)
}

/**
 * The unit the forms send is the stored code `шт`; it is shown in the reader's
 * language. Any other unit is the yard's own word and is shown as written.
 */
const PIECES = 'шт'
const unitLabel = (
  t: Translate<(typeof intakesMessages)['uk']>,
  unit: string,
) => (unit === PIECES ? t('pcs') : unit)

/** Two initials for the avatar chip; a single word gives one. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

function useIntakeAccess() {
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
  const viewDecision = (
    definition: CabinetModuleDefinition,
    permission: Permission,
  ): ModuleAccessDecision =>
    evaluateModuleAccess(
      { ...definition, viewPermission: permission },
      access,
      'view',
    )
  const createDecision = decision(
    cabinetModules.intakes,
    'intakes.manage',
    true,
  )
  const manageDecision = decision(
    cabinetModules.intakes,
    'intakes.manage',
    false,
  )
  const partsViewDecision = viewDecision(cabinetModules.parts, 'parts.view')
  const partQuotaDecision = decision(
    cabinetModules.parts,
    'intakes.manage',
    true,
  )
  const partCreateDecision =
    manageDecision.kind !== 'allowed'
      ? manageDecision
      : partsViewDecision.kind !== 'allowed'
        ? partsViewDecision
        : partQuotaDecision
  const partsMediaManage =
    decision(cabinetModules.parts, 'parts.manage', false).kind === 'allowed'
  const financeManage =
    decision(cabinetModules.intakes, 'finance.manage', false).kind === 'allowed'
  return {
    cabinet,
    createDecision,
    manageDecision,
    partCreateDecision,
    partsMediaManage,
    financeManage,
    manage: manageDecision.kind === 'allowed',
    partsView: partsViewDecision.kind === 'allowed',
    financeView:
      viewDecision(cabinetModules.intakes, 'finance.view').kind === 'allowed',
  }
}

const allowedToView = (
  definition: CabinetModuleDefinition,
  cabinet: ReturnType<typeof useCabinet>,
) =>
  evaluateModuleAccess(
    { ...definition },
    cabinet.status === 'ready' && cabinet.snapshot
      ? { status: 'ready', snapshot: cabinet.snapshot, error: null }
      : { status: 'loading', snapshot: null, error: null },
    'view',
  ).kind === 'allowed'

function Denied({ decision }: { decision: ModuleAccessDecision }) {
  const t = useT(intakesMessages)
  const message =
    decision.kind === 'quota-exhausted'
      ? decision.resource === 'parts'
        ? t('deniedPartsQuota')
        : t('deniedIntakesQuota')
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

export function IntakesScreen(_props: Partial<CabinetModuleScreenProps> = {}) {
  const {
    cabinet,
    createDecision,
    manageDecision,
    partCreateDecision,
    partsMediaManage,
    financeManage,
  } = useIntakeAccess()
  const tf = useT(intakeFormMessages)
  const params = useParams<{ tenant: string; intakeId: string }>()
  const location = useLocation()
  const tenant = params.tenant ?? cabinet.targetTenant?.slug ?? ''
  const base = `/app/${tenant}/intakes`
  const intakeId = params.intakeId
  if (location.pathname.endsWith('/parts/batch')) {
    if (manageDecision.kind !== 'allowed')
      return <Denied decision={manageDecision} />
    if (partCreateDecision.kind !== 'allowed')
      return <Denied decision={partCreateDecision} />
    return intakeId ? (
      <BatchPartsForm canManageFinance={financeManage} intakeId={intakeId} />
    ) : (
      <Denied decision={{ kind: 'permission-denied' }} />
    )
  }
  if (location.pathname.endsWith('/parts/new')) {
    if (manageDecision.kind !== 'allowed')
      return <Denied decision={manageDecision} />
    if (partCreateDecision.kind !== 'allowed')
      return <Denied decision={partCreateDecision} />
    return intakeId ? (
      <>
        <IntakeDetail base={base} intakeId={intakeId} />
        <PartForm canUploadMedia={partsMediaManage} intakeId={intakeId} />
      </>
    ) : (
      <Denied decision={{ kind: 'permission-denied' }} />
    )
  }
  if (location.pathname.endsWith('/new')) {
    if (createDecision.kind !== 'allowed')
      return <Denied decision={createDecision} />
    return (
      <IntakeForm
        canManageFinance={financeManage}
        title={tf('newIntake')}
        submit={(request, signal) => intakesApi.create(request, { signal })}
      />
    )
  }
  if (intakeId && location.pathname.endsWith('/edit')) {
    if (manageDecision.kind !== 'allowed')
      return <Denied decision={manageDecision} />
    return (
      <IntakeForm
        canManageFinance={financeManage}
        intakeId={intakeId}
        title={tf('editIntake')}
        submit={(request, signal) =>
          intakesApi.update(intakeId, request, { signal })
        }
      />
    )
  }
  if (intakeId) return <IntakeDetail base={base} intakeId={intakeId} />
  return <IntakesList base={base} />
}

/** The lifecycle segments the list endpoint really understands. */
const INTAKE_SEGMENTS = [
  { value: '', label: 'segmentAll' },
  { value: 'active', label: 'segmentActive' },
  { value: 'closed', label: 'segmentClosed' },
] as const

/**
 * How far a batch has sold through, said as a pill. The list item carries no
 * lifecycle status of its own, so this is what the numbers actually support.
 */
const intakeSaleState = (
  intake: Pick<IntakeListItem, 'partsCount' | 'soldCount'>,
): {
  label: 'saleNoItems' | 'saleNothingSold' | 'saleSelling' | 'saleSoldOut'
  tone: StatusTone
} =>
  intake.partsCount === 0
    ? { label: 'saleNoItems', tone: 'neutral' }
    : intake.soldCount === 0
      ? { label: 'saleNothingSold', tone: 'warn' }
      : intake.soldCount < intake.partsCount
        ? { label: 'saleSelling', tone: 'ok' }
        : { label: 'saleSoldOut', tone: 'neutral' }

function IntakesList({ base }: { base: string }) {
  const money = useWholeMoney(useAccountingCurrency().currency)
  const { createDecision, financeView } = useIntakeAccess()
  const t = useT(intakesMessages)
  const day = useDay()
  const [searchParams, setSearchParams] = useSearchParams()
  const selection = useMemo<IntakeListParams>(
    () => ({
      search: searchParams.get('search') ?? undefined,
      status: isIntakeStatus(searchParams.get('status'))
        ? (searchParams.get('status') as IntakeListParams['status'])
        : undefined,
      page: positiveInteger(searchParams.get('page'), 1),
      pageSize: pageSizeParam(searchParams.get('pageSize'), defaultPageSize),
    }),
    [searchParams],
  )
  const [query, setQuery] = useState(searchParams.get('search') ?? '')
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    page: Awaited<ReturnType<typeof intakesApi.list>> | null
    error: string | null
  }>({ page: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    void intakesApi.list(selection, { signal: controller.signal }).then(
      (page) => setState({ page, error: null }),
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            error: normalizeApiProblem(error).message,
          }))
      },
    )
    return () => controller.abort()
  }, [selection, attempt])
  const updateSearch = () => {
    const next = new URLSearchParams(searchParams)
    const value = query.trim()
    if (value) next.set('search', value)
    else next.delete('search')
    next.set('page', '1')
    setSearchParams(next)
  }
  const updatePage = (page: number, pageSize: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    next.set('pageSize', String(pageSize))
    setSearchParams(next)
  }
  const currentPage = state.page?.page ?? selection.page ?? 1
  const currentPageSize =
    state.page?.pageSize ?? selection.pageSize ?? defaultPageSize
  const totalPages = state.page?.totalPages ?? 1
  const items = state.page?.items ?? []

  const filtered =
    (selection.search ?? '') !== '' || selection.status !== undefined

  return (
    <RedesignShell
      actions={
        createDecision.kind === 'allowed' ? (
          <Button asChild variant="primary">
            <Link to={`${base}/new`}>
              <Plus aria-hidden />
              {t('newIntake')}
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
      <RedesignTitle title={t('title')} />

      <div className="rz-toolbar" role="search">
        <form
          className="flex min-w-0 flex-[1_1_240px] sm:max-w-[360px]"
          onSubmit={(event) => {
            event.preventDefault()
            updateSearch()
          }}
        >
          <SearchInput
            aria-label={t('searchLabel')}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            value={query}
          />
        </form>
        <div
          aria-label={t('segmentsLabel')}
          className="rz-seg flex-wrap"
          role="radiogroup"
        >
          {INTAKE_SEGMENTS.map((option) => {
            const active = (selection.status ?? '') === option.value
            return (
              <button
                aria-checked={active}
                key={option.value}
                onClick={() => {
                  const next = new URLSearchParams(searchParams)
                  if (option.value) next.set('status', option.value)
                  else next.delete('status')
                  next.set('page', '1')
                  setSearchParams(next)
                }}
                role="radio"
                type="button"
              >
                {t(option.label)}
                {/* Only the chosen segment has a count: the list endpoint
                    totals what it returns, not the segments beside it. */}
                {active ? (
                  <span className="rz-count">{state.page?.total ?? 0}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {state.error !== null && state.page === null ? (
        <ErrorState
          description={state.error}
          onRetry={() => {
            setState({ page: null, error: null })
            setAttempt((current) => current + 1)
          }}
        />
      ) : state.page === null ? (
        <SkeletonRows label={t('listLabel')} rows={6} />
      ) : (
        <section aria-label={t('listLabel')} className="min-w-0">
          {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
          <DataTable
            caption={t('listLabel')}
            columns={[
              {
                key: 'name',
                label: t('columnIntake'),
                variant: 'primary',
                cell: (intake) => (
                  <Link
                    className="grid min-w-0 gap-0.5"
                    to={`${base}/${intake.id}`}
                  >
                    <span className="rz-strong truncate">
                      {intake.name ?? t('untitled')}
                    </span>
                    <span className="rz-caption font-normal">
                      {intake.createdBy.displayName}
                    </span>
                  </Link>
                ),
              },
              {
                key: 'date',
                label: t('columnDate'),
                cell: (intake) => (
                  <span className="rz-mono rz-dim text-caption">
                    {day(intake.purchasedAt ?? intake.createdAt)}
                  </span>
                ),
              },
              {
                key: 'parts',
                label: t('columnPositions'),
                align: 'end',
                cell: (intake) => (
                  <span className="rz-strong">{intake.partsCount}</span>
                ),
              },
              ...(financeView
                ? [
                    {
                      key: 'cost',
                      label: t('columnCost'),
                      align: 'end' as const,
                      cell: (intake: IntakeListItem) =>
                        intake.totalCost === null
                          ? '—'
                          : money(intake.totalCost),
                    },
                  ]
                : []),
              {
                key: 'status',
                label: t('columnStatus'),
                cell: (intake) => {
                  const sale = intakeSaleState(intake)
                  return (
                    <StatusPill tone={sale.tone}>{t(sale.label)}</StatusPill>
                  )
                },
              },
            ]}
            empty={
              <StateScreen
                className="border-0"
                description={
                  filtered
                    ? t('emptyFilteredDescription')
                    : t('emptyDescription')
                }
                icon={
                  filtered ? <SearchX aria-hidden /> : <Inbox aria-hidden />
                }
                title={filtered ? t('emptyFilteredTitle') : t('emptyTitle')}
                tone={filtered ? 'neutral' : 'brand'}
              />
            }
            footer={
              <ListFooter
                summary={t('shownOfIntakes', {
                  shown: items.length,
                  count: state.page?.total ?? 0,
                })}
              >
                <Pagination
                  label={t('paginationLabel')}
                  onPage={(nextPage) => updatePage(nextPage, currentPageSize)}
                  page={currentPage}
                  totalPages={totalPages}
                />
              </ListFooter>
            }
            rowKey={(intake) => intake.id}
            rows={items}
          />
        </section>
      )}
    </RedesignShell>
  )
}

/**
 * The foot of a list: what is shown, then the pager. `Pagination` draws its
 * own `.rz-pager`; here it sits inside the row that also carries the summary.
 */
function ListFooter({
  summary,
  children,
}: {
  summary: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rz-pager [&_.rz-pager]:min-h-0 [&_.rz-pager]:flex-1 [&_.rz-pager]:border-0 [&_.rz-pager]:p-0">
      <p className="m-0">{summary}</p>
      {children}
    </div>
  )
}

/** The three ways a yard looks at the positions of one batch. */
const INTAKE_PART_FILTERS = [
  { value: 'all', label: 'partFilterAll' },
  { value: 'available', label: 'partFilterAvailable' },
  { value: 'sold', label: 'partFilterSold' },
] as const

type IntakePartFilter = (typeof INTAKE_PART_FILTERS)[number]['value']

/** Known statuses in the reader's language; an unknown one is shown as sent. */
const partStatusPill = (
  t: Translate<(typeof intakesMessages)['uk']>,
  status: string,
): { label: string; tone: StatusTone } => {
  if (status === 'available') return { label: t('partAvailable'), tone: 'ok' }
  if (status === 'reserved') return { label: t('partReserved'), tone: 'warn' }
  if (status === 'sold') return { label: t('partSold'), tone: 'danger' }
  return { label: status, tone: 'neutral' }
}

function IntakeDetail({ base, intakeId }: { base: string; intakeId: string }) {
  const { pathname } = useLocation()
  const money = useWholeMoney(useAccountingCurrency().currency)
  const {
    cabinet,
    manage,
    partsView,
    partCreateDecision,
    partsMediaManage,
    financeView,
  } = useIntakeAccess()
  const t = useT(intakesMessages)
  const tc = useT(commonMessages)
  const day = useDay()
  const navigate = useNavigate()
  const [intake, setIntake] = useState<Intake | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [filter, setFilter] = useState<IntakePartFilter>('all')
  const [partsPage, setPartsPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const importEnabled = useFeatureFlag(FEATURE_FLAGS.partsBulkImport)
  const canPrintStickers = allowedToView(cabinetModules.stickers, cabinet)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.intakes,
  )
  // The record stays mounted behind the add-part drawer. Reload its parts
  // when navigation returns here, including after saving several positions.
  useEffect(() => {
    const controller = new AbortController()
    void intakesApi.get(intakeId, { signal: controller.signal }).then(
      (next) => {
        if (!controller.signal.aborted) setIntake(next)
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setProblem(normalizeApiProblem(error).message)
      },
    )
    return () => controller.abort()
  }, [intakeId, attempt, pathname])
  const remove = async () => {
    if (busy) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      await intakesApi.remove(intakeId, { signal: scope.signal })
      void navigate(base)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }
  const crumb = (
    <Crumbs
      items={[
        t('eyebrow'),
        <Link className="text-app-muted" key="list" to={base}>
          {t('title')}
        </Link>,
        ...(intake
          ? [
              <span
                className="inline-block max-w-[9rem] truncate align-bottom sm:max-w-none"
                key="intake"
              >
                {intake.name ?? t('untitledIntake')}
              </span>,
            ]
          : []),
      ]}
    />
  )
  if (!intake && problem)
    return (
      <RedesignShell crumb={crumb} width="record">
        <ErrorState
          actions={
            <>
              <Button asChild>
                <Link to={base}>
                  <ArrowLeft aria-hidden />
                  {t('backToList')}
                </Link>
              </Button>
              <Button
                onClick={() => {
                  setProblem(null)
                  setAttempt((current) => current + 1)
                }}
                variant="primary"
              >
                <RefreshCw aria-hidden />
                {tc('retry')}
              </Button>
            </>
          }
          description={problem}
          title={t('loadFailed')}
        />
      </RedesignShell>
    )
  if (!intake)
    return (
      <RedesignShell crumb={crumb} width="record">
        <div className="grid gap-3">
          <p className="sr-only" role="status">
            {t('loading')}
          </p>
          <Skeleton className="h-[22px] w-[36%]" />
          <Skeleton className="w-[52%]" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[200px]" />
          </div>
        </div>
      </RedesignShell>
    )

  const units = intake.parts.reduce((total, part) => total + part.quantity, 0)
  const sold = intake.parts.filter((part) => part.status === 'sold')
  const available = intake.parts.filter((part) => part.status !== 'sold')
  const counts: Record<IntakePartFilter, number> = {
    all: intake.parts.length,
    available: available.length,
    sold: sold.length,
  }
  const filteredRows =
    filter === 'all' ? intake.parts : filter === 'sold' ? sold : available
  const partsPageSize = 20
  const partsTotalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / partsPageSize),
  )
  const currentPartsPage = Math.min(partsPage, partsTotalPages)
  const rows = filteredRows.slice(
    (currentPartsPage - 1) * partsPageSize,
    currentPartsPage * partsPageSize,
  )
  const partsBase = base.replace(/\/intakes$/, '/parts')
  const profit = intake.profitability ?? null
  const saleState = intakeSaleState(intake)
  /**
   * The batch's own trail, built from the timestamps the records carry: when
   * it was opened, and what was booked into it since. Anything a person did in
   * between — a price corrected, a position moved — is not recorded server-side.
   */
  const history = [
    // Position names belong to the parts module; without it the trail keeps
    // only what the intake itself records.
    ...(partsView ? intake.parts : [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 4)
      .map((part) => ({
        id: part.id,
        title: t('historyAdded', { name: part.name }),
        meta: day(part.createdAt),
        value: t('quantityWithUnit', {
          count: part.quantity,
          unit: unitLabel(t, part.unit),
        }),
        tone: 'ok' as const,
      })),
    {
      id: 'created',
      title: t('historyCreated'),
      meta: `${day(intake.createdAt)} · ${intake.createdBy.displayName}`,
      value: intake.name ?? '—',
      tone: 'dim' as const,
    },
  ]
  const stickerHref =
    intake.parts.length > 0
      ? `${base.replace(/\/intakes$/, '/stickers')}?${intake.parts
          .map((part) => `part=${encodeURIComponent(part.id)}`)
          .join('&')}`
      : null

  const soldPercent =
    intake.partsCount === 0
      ? 0
      : Math.round((intake.soldCount / intake.partsCount) * 100)

  return (
    <div aria-busy={busy} className="grid content-start" role="main">
      <RedesignShell
        actions={
          manage ? (
            <>
              {partCreateDecision.kind === 'allowed' ? (
                <Button asChild variant="primary">
                  <Link to={`${base}/${intake.id}/parts/new`}>
                    <Plus aria-hidden />
                    {t('addPart')}
                  </Link>
                </Button>
              ) : null}
              <ActionMenu
                actions={[
                  {
                    key: 'edit',
                    label: tc('edit'),
                    icon: <Pencil aria-hidden />,
                    onSelect: () => void navigate(`${base}/${intake.id}/edit`),
                  },
                  // Import is a parts mutation, the same gate as the parts list.
                  ...(partCreateDecision.kind === 'allowed' &&
                  partsMediaManage &&
                  importEnabled
                    ? [
                        {
                          key: 'import',
                          label: t('importParts'),
                          icon: <Upload aria-hidden />,
                          onSelect: () =>
                            void navigate(
                              `${base.replace(/\/intakes$/, '/parts')}/imports?intake_id=${encodeURIComponent(intake.id)}`,
                            ),
                        },
                      ]
                    : []),
                  ...(canPrintStickers
                    ? [
                        {
                          key: 'stickers',
                          label: t('printStickers'),
                          icon: <Printer aria-hidden />,
                          disabled: stickerHref === null,
                          onSelect: () => {
                            if (stickerHref !== null) void navigate(stickerHref)
                          },
                        },
                      ]
                    : []),
                  {
                    key: 'delete',
                    label: t('deleteIntake'),
                    icon: <Trash2 aria-hidden />,
                    destructive: true,
                    disabled: busy,
                    onSelect: () => setConfirmDelete(true),
                  },
                ]}
                label={t('moreActions')}
              />
            </>
          ) : undefined
        }
        crumb={crumb}
        width="record"
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="rz-h-page">
                {intake.name ?? t('untitledIntake')}
              </h1>
              <span className="rz-caption">
                {t('createdBy', {
                  name: intake.createdBy.displayName,
                  date: day(intake.createdAt),
                })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={saleState.tone}>
                {t(saleState.label)}
              </StatusPill>
              <span className="rz-caption">
                {intake.purchasedAt === null
                  ? t('noPurchaseDate')
                  : day(intake.purchasedAt)}
              </span>
            </div>
          </div>

          {problem ? <Notice tone="danger">{problem}</Notice> : null}

          <KpiStrip>
            <Kpi
              label={t('statPositions')}
              meta={t('statUnits', { count: units })}
              unit={t('statPositionsUnit')}
              value={String(intake.partsCount)}
            />
            <Kpi
              label={t('statSold')}
              meta={t('statStillInStock', {
                count: intake.partsCount - intake.soldCount,
              })}
              unit={t('statOf', { count: intake.partsCount })}
              value={String(intake.soldCount)}
            />
            {financeView ? (
              <>
                <Kpi
                  label={t('statInvested')}
                  meta={t('statBatchCost')}
                  value={money(profit?.invested ?? intake.totalCost ?? 0)}
                />
                <Kpi
                  label={t('statRecouped')}
                  meta={
                    profit?.recoupedPercent === null ||
                    profit?.recoupedPercent === undefined
                      ? t('statNothingBack')
                      : t('statRecoupedShare', {
                          percent: profit.recoupedPercent,
                        })
                  }
                  value={money(profit?.recouped ?? 0)}
                />
              </>
            ) : null}
          </KpiStrip>

          <div className="flex flex-wrap items-start gap-4">
            <div className="grid min-w-0 flex-[1_1_480px] gap-4">
              {partsView ? (
                <section aria-label={t('positionsTitle')} className="rz-card">
                  <div className="rz-card__head py-2">
                    <h2 className="rz-h-card">{t('positionsTitle')}</h2>
                    <div
                      aria-label={t('partFiltersLabel')}
                      className="rz-seg flex-wrap"
                      role="radiogroup"
                    >
                      {INTAKE_PART_FILTERS.map((option) => {
                        const active = option.value === filter
                        return (
                          <button
                            aria-checked={active}
                            key={option.value}
                            onClick={() => {
                              setFilter(option.value)
                              setPartsPage(1)
                            }}
                            role="radio"
                            type="button"
                          >
                            {t(option.label)}
                            <span className="rz-count">
                              {counts[option.value]}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <DataTable
                    caption={t('positionsTitle')}
                    columns={[
                      {
                        key: 'qr',
                        label: t('columnCode'),
                        cell: (part) => (
                          <span className="rz-mono">{part.qrCode}</span>
                        ),
                      },
                      {
                        key: 'name',
                        label: t('columnName'),
                        variant: 'primary',
                        cell: (part) => (
                          <Link
                            className="grid min-w-0 gap-0.5"
                            to={`${partsBase}/${part.id}`}
                          >
                            <span className="rz-strong truncate">
                              {part.name}
                            </span>
                            <span className="rz-caption font-mono font-normal">
                              {part.partType ?? t('noType')}
                            </span>
                          </Link>
                        ),
                      },
                      {
                        key: 'quantity',
                        label: t('columnQuantity'),
                        align: 'end',
                        cell: (part) =>
                          t('quantityWithUnit', {
                            count: part.quantity,
                            unit: unitLabel(t, part.unit),
                          }),
                      },
                      {
                        key: 'status',
                        label: t('columnState'),
                        align: 'end',
                        cell: (part) => {
                          const pill = partStatusPill(t, part.status)
                          return (
                            <StatusPill tone={pill.tone}>
                              {pill.label}
                            </StatusPill>
                          )
                        },
                      },
                    ]}
                    empty={
                      <StateScreen
                        className="rounded-none border-0"
                        description={
                          filter === 'all'
                            ? t('partsEmptyDescription')
                            : t('partsEmptyFilteredDescription')
                        }
                        icon={<Inbox aria-hidden />}
                        title={
                          filter === 'all'
                            ? t('partsEmptyTitle')
                            : t('partsEmptyFilteredTitle')
                        }
                        tone={filter === 'all' ? 'brand' : 'neutral'}
                      />
                    }
                    embedded
                    footer={
                      filteredRows.length > partsPageSize ? (
                        <ListFooter
                          summary={t('shownOf', {
                            shown: rows.length,
                            total: filteredRows.length,
                          })}
                        >
                          <Pagination
                            label={t('partsPaginationLabel')}
                            onPage={setPartsPage}
                            page={currentPartsPage}
                            totalPages={partsTotalPages}
                          />
                        </ListFooter>
                      ) : null
                    }
                    rowKey={(part) => part.id}
                    rows={rows}
                  />
                </section>
              ) : null}

              <Card
                aside={
                  <span className="rz-eyebrow">
                    {t('historyCount', { count: history.length })}
                  </span>
                }
                bodyClassName="p-0"
                title={t('historyTitle')}
              >
                <ol className="rz-timeline">
                  {history.map((event) => (
                    <li key={event.id}>
                      <span aria-hidden className="rz-timeline__icon">
                        <span
                          className={cn(
                            'rz-dot',
                            event.tone === 'ok' && 'rz-dot--ok',
                          )}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="rz-strong block truncate">
                          {event.title}
                        </span>
                        <span className="rz-caption block">{event.meta}</span>
                      </span>
                      <span className="rz-timeline__date">{event.value}</span>
                    </li>
                  ))}
                </ol>
              </Card>

              {intake.notes === null ? null : (
                <Card title={t('notesTitle')}>
                  <p className="rz-muted m-0 whitespace-pre-line">
                    {intake.notes}
                  </p>
                </Card>
              )}

              {intake.photos.length > 0 ? (
                <Card title={t('photosTitle')}>
                  <ul className="rz-photos m-0 list-none p-0">
                    {intake.photos.map((photo, index) => (
                      <li key={photo.url}>
                        <a className="rz-photo" href={photo.url}>
                          <img
                            alt={t('photoAlt', { number: index + 1 })}
                            src={photo.thumbnailUrl || photo.url}
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>

            <aside className="grid min-w-0 flex-[1_1_280px] gap-4 lg:sticky lg:top-[calc(var(--rz-topbar-h)+16px)] lg:max-w-[380px]">
              <Card title={t('salesTitle')}>
                <div className="grid gap-3">
                  <p className="rz-kpi__value m-0">
                    <span className="rz-display">{intake.soldCount}</span>
                    <span className="rz-kpi__unit">
                      {t('ofPositions', { count: intake.partsCount })}
                    </span>
                  </p>
                  <span
                    aria-label={t('soldProgress')}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={soldPercent}
                    className="rz-meter"
                    role="progressbar"
                  >
                    <span style={{ width: `${String(soldPercent)}%` }} />
                  </span>
                  <p className="rz-muted m-0">
                    {profit === null
                      ? t('positionsInStock', {
                          count: intake.partsCount - intake.soldCount,
                        })
                      : t('availableAndSold', {
                          available: profit.partsAvailable,
                          sold: profit.partsSold,
                        })}
                  </p>
                  {partCreateDecision.kind === 'allowed' ? (
                    <Button asChild size="wide">
                      <Link to={`${base}/${intake.id}/parts/new`}>
                        {t('addPart')}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </RedesignShell>

      <ConfirmDialog
        confirmLabel={intake.partsCount > 0 ? t('understood') : tc('delete')}
        consequence={
          intake.partsCount > 0
            ? t('deleteBlocked', { count: intake.partsCount })
            : t('deleteForever')
        }
        destructive={intake.partsCount === 0}
        onConfirm={() => {
          if (intake.partsCount > 0) setConfirmDelete(false)
          else void remove()
        }}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        pending={busy}
        title={
          intake.partsCount > 0 ? t('deleteBlockedTitle') : t('deleteTitle')
        }
      />
    </div>
  )
}

/**
 * The way back, at the head of the breadcrumb: a quiet small button, so the
 * crumb trail after it still reads as the path.
 */
function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button asChild size="sm" variant="quiet">
      <Link to={to}>
        <ChevronLeft aria-hidden />
        {children}
      </Link>
    </Button>
  )
}

function IntakeForm({
  title,
  intakeId,
  canManageFinance,
  submit,
}: {
  title: string
  intakeId?: string
  canManageFinance: boolean
  submit: (request: CreateIntakeRequest, signal: AbortSignal) => Promise<Intake>
}) {
  const cabinet = useCabinet()
  const t = useT(intakesMessages)
  const tf = useT(intakeFormMessages)
  const tc = useT(commonMessages)
  const day = useDay()
  const params = useParams<{ tenant: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const base = `/app/${params.tenant ?? cabinet.targetTenant?.slug ?? ''}/intakes`
  const cabinetRoot = base.replace(/\/intakes$/, '')
  // What was typed survives the trip to the accounting-currency setting.
  const draft = useCurrencyDraft<{
    name: string
    purchasedAt: string
    totalCost: string
    notes: string
  }>(`intake-form:${intakeId ?? 'new'}`)
  const [values, setValues] = useState(
    () =>
      draft.initial ?? {
        name: '',
        purchasedAt: '',
        totalCost: '',
        notes: '',
      },
  )
  const [media, setMedia] = useState<MediaUploadResult[]>([])
  const [intake, setIntake] = useState<Intake | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ totalCost?: string }>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.intakes,
  )
  const guard = useFirstPriceGuard()
  const { locale } = useLocale()
  const money = useWholeMoney(guard.currency)
  const price = usePriceSlots(guard, {
    values: canManageFinance ? [values.totalCost] : [],
    onAccept: (accepted) => void save(undefined, accepted),
    draftKept: true,
    onLeave: () => draft.keep(values),
  })
  const restoredDraft = draft.initial !== null
  const update =
    (key: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target
      setValues((current) => ({ ...current, [key]: value }))
    }
  useEffect(() => {
    if (!intakeId) return
    const controller = new AbortController()
    void intakesApi.get(intakeId, { signal: controller.signal }).then(
      (next) => {
        setIntake(next)
        // A draft brought back from the currency setting wins.
        if (!restoredDraft)
          setValues({
            name: next.name ?? '',
            purchasedAt: next.purchasedAt ?? '',
            totalCost:
              canManageFinance && next.totalCost !== null
                ? String(next.totalCost)
                : '',
            notes: next.notes ?? '',
          })
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setProblem(normalizeApiProblem(error).message)
      },
    )
    return () => controller.abort()
  }, [canManageFinance, intakeId, restoredDraft])
  const cost = values.totalCost === '' ? null : Number(values.totalCost)
  const hasCost = cost !== null && Number.isFinite(cost) && cost > 0
  const positions = intake?.partsCount ?? 0
  const units =
    intake?.parts.reduce((total, part) => total + part.quantity, 0) ?? 0
  const named = values.name.trim().length > 0

  const save = async (
    event?: React.FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    if (busy) return
    const amount = values.totalCost === '' ? null : Number(values.totalCost)
    // Without an accounting currency the batch saves without its cost.
    const sendCost = canManageFinance && !price.disabled
    const pricing = sendCost && price.hasPrice
    if (
      canManageFinance &&
      amount !== null &&
      (!Number.isFinite(amount) || amount < 0)
    ) {
      setFieldErrors({
        totalCost: tf('costInvalid'),
      })
      return
    }
    // Core refuses a cost finer than the currency allows; say so here.
    const costPrecision =
      canManageFinance && amount !== null && sendCost
        ? amountPrecisionError(amount, guard.currency, locale, {
            limit: BATCH_COST_LIMIT,
          })
        : null
    if (costPrecision !== null) {
      setFieldErrors({ totalCost: costPrecision })
      return
    }
    setFieldErrors({})
    setBusy(true)
    try {
      if (
        guard.needsCheck(pricing) &&
        !(await guard.beforeSave(pricing, accepted))
      ) {
        setBusy(false)
        return
      }
      const request = {
        name: values.name.trim() || null,
        supplier: null,
        purchasedAt: values.purchasedAt || null,
        ...(sendCost ? { totalCost: amount } : {}),
        notes: values.notes.trim() || null,
      }
      const scope = requireLatestMutation({ quota: intakeId === undefined })
      if ('totalCost' in request)
        requireLatestMutation({
          permission: 'finance.manage',
          quota: false,
        })
      const saved = await submit(
        intakeId
          ? request
          : { ...request, photoKeys: media.map((item) => item.storageKey) },
        scope.signal,
      )
      guard.afterSave(pricing)
      void navigate(
        (intakeId === undefined
          ? sourceReturnPath(searchParams, cabinetRoot, { intakeId: saved.id })
          : null) ?? `${base}/${saved.id}`,
      )
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }
  const remove = async () => {
    if (busy || !intakeId) return
    setConfirmDelete(false)
    setBusy(true)
    try {
      const scope = requireLatestMutation({ quota: false })
      await intakesApi.remove(intakeId, { signal: scope.signal })
      void navigate(base)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }

  const backTo = intakeId
    ? `${base}/${intakeId}`
    : (sourceReturnPath(searchParams, cabinetRoot) ?? base)
  const saveLabel = intakeId ? tf('saveChanges') : tf('createIntake')
  const checks = [
    { done: named, label: tf('checkNamed') },
    ...(canManageFinance ? [{ done: hasCost, label: tf('checkCost') }] : []),
  ]

  return (
    <div className="grid content-start">
      <RedesignShell
        actions={
          <>
            <Button asChild>
              <Link to={backTo}>{tc('cancel')}</Link>
            </Button>
            <Button
              aria-busy={busy}
              disabled={busy}
              form="intake-form"
              type="submit"
              variant="primary"
            >
              <Check aria-hidden />
              {saveLabel}
            </Button>
          </>
        }
        crumb={
          <>
            <BackLink to={backTo}>
              {intakeId ? tf('backToIntake') : t('backToIntakes')}
            </BackLink>
            <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
              <span>{t('eyebrow')}</span>
              <ChevronRight aria-hidden className="size-3" />
              <span>{t('title')}</span>
              {named ? (
                <>
                  <ChevronRight aria-hidden className="size-3" />
                  <span aria-current="page" className="max-w-40">
                    {values.name}
                  </span>
                </>
              ) : null}
            </span>
          </>
        }
      >
        <div className="grid max-w-[1240px] gap-4">
          <div className="grid gap-2">
            <h1 className="rz-h-page">{title}</h1>
            {intakeId === undefined ? (
              <p className="rz-muted m-0">{tf('intro')}</p>
            ) : (
              <p className="rz-muted m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rz-mono rz-strong">
                  {values.name || t('untitled')}
                </span>
                {intake ? (
                  <>
                    <span aria-hidden className="rz-dim">
                      ·
                    </span>
                    <span>
                      {tf('positionsCount', { count: positions })} ·{' '}
                      {t('quantityWithUnit', { count: units, unit: t('pcs') })}
                    </span>
                    <span aria-hidden className="rz-dim">
                      ·
                    </span>
                    <span>
                      {tf('createdOnBy', {
                        date: day(intake.createdAt),
                        name: intake.createdBy.displayName,
                      })}
                    </span>
                  </>
                ) : null}
              </p>
            )}
          </div>

          {problem ? <Notice tone="danger">{problem}</Notice> : null}

          <form
            aria-busy={busy}
            className="flex flex-wrap items-start gap-4"
            id="intake-form"
            onSubmit={(event) => void save(event)}
          >
            <div className="grid min-w-0 flex-[1_1_480px] gap-4">
              <FormCard step="01" title={tf('basicsTitle')}>
                <Field hint={tf('nameHint')} label={tf('nameLabel')}>
                  <TextInput
                    autoComplete="off"
                    name="name"
                    onChange={update('name')}
                    placeholder={tf('namePlaceholder')}
                    value={values.name}
                  />
                </Field>
              </FormCard>

              <FormCard step="02" title={tf('dateOwnerTitle')}>
                <div className="rz-form-grid">
                  <Field label={tf('intakeDate')}>
                    <TextInput
                      name="purchasedAt"
                      onChange={update('purchasedAt')}
                      type="date"
                      value={values.purchasedAt.slice(0, 10)}
                    />
                  </Field>
                </div>
                <Field hint={tf('ownerHint')} label={tf('ownerLabel')}>
                  {intake ? (
                    <p className="rz-strong m-0 inline-flex w-fit items-center gap-2">
                      <span className="rz-avatar rz-avatar--round">
                        {initials(intake.createdBy.displayName)}
                      </span>
                      {intake.createdBy.displayName}
                    </p>
                  ) : (
                    <p className="rz-dim m-0">{tf('ownerOnCreate')}</p>
                  )}
                </Field>
              </FormCard>

              <FormCard
                description={
                  positions > 0
                    ? tf('costSplitNow', { count: positions })
                    : tf('costSplit')
                }
                step="03"
                title={tf('costTitle')}
              >
                {canManageFinance ? (
                  <div className="grid gap-3">
                    <Field
                      error={fieldErrors.totalCost}
                      hint={
                        price.hint === undefined
                          ? tf('totalCostHint')
                          : `${tf('totalCostHint')}. ${price.hint}`
                      }
                      label={tf('totalCost')}
                    >
                      <MoneyInput
                        className="font-mono"
                        currency={price.currency}
                        disabled={price.disabled}
                        inputMode="decimal"
                        name="totalCost"
                        onChange={update('totalCost')}
                        placeholder="6120"
                        value={values.totalCost}
                      />
                    </Field>
                    {price.note}
                  </div>
                ) : null}
                <Field hint={tf('commentHint')} label={tf('commentLabel')}>
                  <TextArea
                    name="notes"
                    onChange={update('notes')}
                    placeholder={tf('commentPlaceholder')}
                    rows={2}
                    value={values.notes}
                  />
                </Field>
              </FormCard>

              {!intakeId ? (
                <FormCard step="04" title={tf('photosTitle')}>
                  <MediaPicker
                    entityType="intakes"
                    items={media}
                    onChange={setMedia}
                  />
                </FormCard>
              ) : null}
            </div>

            <aside className="grid min-w-0 flex-[1_1_280px] gap-4 lg:sticky lg:top-[calc(var(--rz-topbar-h)+16px)] lg:max-w-[380px]">
              <Card
                title={
                  intakeId === undefined
                    ? tf('beforeCreateTitle')
                    : tf('summaryTitle')
                }
              >
                <div className="grid gap-4">
                  <div className="rz-inset grid gap-1">
                    <p
                      className={cn(
                        'm-0 font-semibold',
                        named ? 'rz-strong' : 'rz-dim',
                      )}
                    >
                      {named ? values.name : tf('nameMissing')}
                    </p>
                    <p className="rz-muted m-0">
                      {[
                        values.purchasedAt ? day(values.purchasedAt) : null,
                        intake?.createdBy.displayName ?? null,
                      ]
                        .filter((part) => part !== null)
                        .join(' · ') || tf('dateMissing')}
                    </p>
                    <p className="rz-caption rz-mono m-0">
                      {intakeId === undefined
                        ? tf('numberAssigned')
                        : `${values.name || tf('untitledLower')} · ${tf('positionsCount', { count: positions })}`}
                    </p>
                  </div>
                  {canManageFinance ? (
                    <dl className="m-0 grid grid-cols-[1fr_auto] items-baseline gap-y-2">
                      <dt className="rz-muted">{tf('summaryCost')}</dt>
                      <dd
                        className={cn(
                          'rz-mono m-0',
                          hasCost ? 'rz-strong' : 'rz-dim',
                        )}
                      >
                        {hasCost && cost !== null ? money(cost) : '—'}
                      </dd>
                      <dt className="rz-muted">{tf('summaryExpenses')}</dt>
                      <dd
                        className="rz-mono rz-dim m-0"
                        title={tf('expensesNotStored')}
                      >
                        —
                      </dd>
                      <div className="bg-app-line col-span-2 my-1 h-px" />
                      <dt className="rz-strong font-semibold">
                        {tf('summaryTotal')}
                      </dt>
                      <dd className="rz-mono rz-strong m-0 text-title">
                        {money(hasCost && cost !== null ? cost : 0)}
                      </dd>
                    </dl>
                  ) : null}
                  <ChecksList
                    items={checks.map((item) => ({
                      state: item.done ? 'ok' : 'idle',
                      label: item.label,
                    }))}
                  />
                  {canManageFinance ? (
                    <div className="empty:hidden">{price.saveNotes}</div>
                  ) : null}
                  <Button
                    aria-busy={busy}
                    disabled={busy}
                    size="wide"
                    type="submit"
                    variant="primary"
                  >
                    {saveLabel}
                  </Button>
                  <p className="rz-caption m-0">
                    {intakeId === undefined
                      ? tf('nextOnCreate')
                      : tf('nextOnEdit')}
                  </p>
                </div>
              </Card>

              {intakeId ? (
                <Card title={tf('deleteIntake')}>
                  <div className="grid gap-3">
                    <p className="rz-muted m-0">
                      {tf('deleteInfo', { count: positions })}{' '}
                      {positions > 0
                        ? tf('deleteInfoBlocked')
                        : tf('deleteInfoFree')}
                    </p>
                    <Button
                      disabled={busy || positions > 0}
                      onClick={() => setConfirmDelete(true)}
                      size="wide"
                      type="button"
                      variant="danger"
                    >
                      {tf('deleteIntake')}
                    </Button>
                  </div>
                </Card>
              ) : null}
            </aside>
          </form>
        </div>
      </RedesignShell>

      <ConfirmDialog
        confirmLabel={tc('delete')}
        consequence={tf('deleteConsequence')}
        onConfirm={() => void remove()}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        pending={busy}
        title={tf('deleteTitle')}
      />
    </div>
  )
}

/**
 * A short checklist before saving: a tick, a warning mark or an empty ring,
 * always with its sentence — the mark only repeats what the text says.
 */
function ChecksList({
  items,
}: {
  items: readonly { state: 'ok' | 'warn' | 'idle'; label: string }[]
}) {
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {items.map((item) => (
        <li
          className={cn(
            'flex items-start gap-2',
            item.state === 'ok'
              ? 'text-app-ink'
              : item.state === 'warn'
                ? 'text-state-warn'
                : 'rz-dim',
          )}
          key={item.label}
        >
          <span
            aria-hidden
            className={cn(
              'mt-px grid size-4 shrink-0 place-items-center rounded-full text-micro font-bold',
              item.state === 'ok'
                ? 'bg-state-ok-soft text-state-ok'
                : item.state === 'warn'
                  ? 'bg-state-warn-soft text-state-warn'
                  : 'bg-app-hover',
            )}
          >
            {item.state === 'ok' ? (
              <Check className="size-3" />
            ) : item.state === 'warn' ? (
              '!'
            ) : null}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/** The four states a yard actually sorts parts into, mapped to the server enum. */
const INTAKE_CONDITIONS = [
  { value: 'good', label: 'conditionUsed' },
  { value: 'refurbished', label: 'conditionRefurbished' },
  { value: 'new', label: 'conditionNew' },
  { value: 'scrap', label: 'conditionForRebuild' },
] as const
const conditionOptions = (tf: Translate<(typeof intakeFormMessages)['uk']>) =>
  INTAKE_CONDITIONS.map((option) => ({
    value: option.value,
    label: tf(option.label),
  }))

/** A part added in this sitting, kept only for the session's own recap. */
interface AddedPart {
  id: string
  name: string
  quantity: number
  unit: string
  zone: string | null
}

function PartForm({
  canUploadMedia,
  intakeId,
}: {
  canUploadMedia: boolean
  intakeId: string
}) {
  const navigate = useNavigate()
  const cabinet = useCabinet()
  const t = useT(intakesMessages)
  const tf = useT(intakeFormMessages)
  const tc = useT(commonMessages)
  const tp = useT(partFormMessages)
  const tPlacement = useT(placementMessages)
  const params = useParams<{ tenant: string }>()
  const base = `/app/${params.tenant ?? cabinet.targetTenant?.slug ?? ''}/intakes`
  const canPlace =
    allowedToView(cabinetModules.inventory, cabinet) &&
    Boolean(cabinet.snapshot?.permissions.has('inventory.zones.manage'))
  const emptyPosition = {
    name: '',
    partType: '',
    oemCode: '',
    condition: 'good',
    quantity: 1,
    unit: PIECES,
    price: '',
    placement: emptyPartPlacement,
    notes: '',
  }
  // The position typed before leaving for the currency setting comes back.
  const draft = useCurrencyDraft<typeof emptyPosition>(
    `intake-position:${intakeId}`,
  )
  const [values, setValues] = useState(() => draft.initial ?? emptyPosition)
  const [media, setMedia] = useState<MediaUploadResult[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({})
  const [intake, setIntake] = useState<Intake | null>(null)
  const placementOptions = usePlacementOptions(
    canPlace,
    cabinet.targetTenant?.id,
  )
  const [added, setAdded] = useState<AddedPart[]>([])
  const [compatRows, setCompatRows] = useState<CompatibilityRow[]>([])
  const nextCompatibilityKey = useRef(0)
  const pendingCreatedId = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const intakeMutation = useLatestMutationGuard(cabinetModules.intakes)
  const partMutation = useLatestMutationGuard(cabinetModules.parts)
  const guard = useFirstPriceGuard()
  const { locale } = useLocale()
  const lastAnother = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    void intakesApi.get(intakeId, { signal: controller.signal }).then(
      (next) => {
        if (!controller.signal.aborted) setIntake(next)
      },
      () => undefined,
    )
    return () => controller.abort()
  }, [intakeId])

  const update = (key: keyof typeof values, value: string | number) =>
    setValues((current) => ({ ...current, [key]: value }))

  const price = Number(values.price.replace(',', '.'))
  const hasPrice =
    values.price.trim() !== '' && Number.isFinite(price) && price > 0
  const named = values.name.trim().length > 0
  const zone =
    placementOptions.zones.find(
      (item) => item.id === values.placement?.zoneId,
    ) ?? null
  // Only a positive price is sent, so only that one can lock the currency.
  const priceSlots = usePriceSlots(guard, {
    values: hasPrice ? [values.price] : [],
    onAccept: (accepted) => void save(undefined, lastAnother.current, accepted),
    draftKept: true,
    onLeave: () => draft.keep(values),
  })
  const pricing = hasPrice && !priceSlots.disabled

  const save = async (
    event: React.FormEvent | undefined,
    andAnother = false,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    if (busy) return
    lastAnother.current = andAnother
    if (!named) {
      setFieldErrors({
        name: tf('partNameRequired'),
      })
      return
    }
    const pricePrecision = pricing
      ? amountPrecisionError(price, guard.currency, locale)
      : null
    if (pricePrecision !== null) {
      setProblem(pricePrecision)
      return
    }
    const compatibilityProblem = rowsProblem(compatRows, locale)
    if (compatibilityProblem !== null) {
      setProblem(compatibilityProblem)
      return
    }
    setFieldErrors({})
    const request: AddIntakePartRequest = {
      name: values.name.trim(),
      partType: values.partType.trim() || null,
      oemCode: values.oemCode.trim() || null,
      condition: values.condition || null,
      quantity: values.quantity,
      unit: values.unit || null,
      notes: values.notes.trim() || null,
      photoKeys: media.map((item) => item.storageKey),
    }
    setBusy(true)
    try {
      if (
        guard.needsCheck(pricing) &&
        !(await guard.beforeSave(pricing, accepted))
      ) {
        setBusy(false)
        return
      }
      const intakeScope = intakeMutation.requireLatestMutation({ quota: false })
      partMutation.requireLatestMutation({ permission: 'parts.view' })
      const resolved = await resolveCompatibility(compatRows, {
        signal: intakeScope.signal,
      })
      if (resolved.kind === 'unknown') {
        setProblem(unknownBrandsMessage(resolved.brands, locale))
        setBusy(false)
        return
      }
      const needsPartManage = pricing || resolved.kind === 'ready'
      const partScope = needsPartManage
        ? partMutation.requireLatestMutation({
            permission: 'parts.manage',
            quota: false,
          })
        : null
      const createdId =
        pendingCreatedId.current ??
        (
          await intakesApi.addPart(intakeId, request, {
            signal: intakeScope.signal,
          })
        ).id
      pendingCreatedId.current = createdId
      if (resolved.kind === 'ready') {
        const current = await partsApi.compatibilities(createdId, {
          signal: partScope!.signal,
        })
        await partsApi.replaceCompatibilities(
          createdId,
          current.version,
          resolved.items,
        )
      }
      // The intake endpoint carries no price, so the asking price is set on the
      // part it just created — one call, right after, before anyone sees it.
      if (pricing) {
        await partsApi.update(
          createdId,
          { desiredSalePrice: { isSet: true, value: price } },
          { signal: partScope!.signal },
        )
        guard.afterSave(true)
      }
      if (canPlace && values.placement?.zoneId) {
        try {
          await inventoryApi.replacePartZones(
            createdId,
            [values.placement.zoneId],
            { signal: intakeScope.signal },
            values.placement.shelfId || undefined,
            values.placement.sectionId || undefined,
          )
        } catch {
          setProblem(tPlacement('retrySave'))
          setBusy(false)
          return
        }
      }
      pendingCreatedId.current = null
      if (!andAnother) {
        void navigate(`${base}/${intakeId}`)
        return
      }
      setAdded((current) => [
        {
          id: createdId,
          name: request.name,
          quantity: values.quantity,
          unit: values.unit || PIECES,
          zone: zone?.code ?? null,
        },
        ...current,
      ])
      setValues((current) => ({
        ...current,
        name: '',
        partType: '',
        oemCode: '',
        quantity: 1,
        price: '',
        notes: '',
      }))
      setMedia([])
      setCompatRows([])
      setIntake(
        (current) =>
          current && { ...current, partsCount: current.partsCount + 1 },
      )
      setBusy(false)
    } catch (error: unknown) {
      setProblem(normalizeApiProblem(error).message)
      setBusy(false)
    }
  }

  const backTo = `${base}/${intakeId}`
  const saveNote = named ? tf('saveNoteNamed') : tf('saveNoteUnnamed')

  return (
    <Sheet
      description={
        <>
          {tf('partInIntake')} {intake?.name ?? '…'}
          {intake
            ? ` · ${tf('alreadyPositions', { count: intake.partsCount })}`
            : ''}
        </>
      }
      eyebrow={`${t('eyebrow')} · ${t('title')}`}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2.5">
          <p className="rz-caption m-0 w-full">{saveNote}</p>
          <div className="w-full empty:hidden">{priceSlots.saveNotes}</div>
          <Button disabled={busy} onClick={() => void navigate(backTo)}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !named}
            onClick={(event) => void save(event, true)}
          >
            {tf('saveAndAddAnother')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !named}
            form={INTAKE_PART_FORM}
            type="submit"
            variant="primary"
          >
            {tf('addPart')}
          </Button>
        </div>
      }
      onOpenChange={(next) => {
        if (!next && !busy) void navigate(backTo)
      }}
      open
      size="lg"
      title={tf('addPart')}
    >
      <form
        aria-busy={busy}
        className="grid gap-5"
        id={INTAKE_PART_FORM}
        onSubmit={(event) => void save(event)}
      >
        {problem ? <Notice tone="danger">{problem}</Notice> : null}
        <div className="grid gap-5">
          <SectionPanel
            title={<NumberedTitle number="01" title={tf('descriptionTitle')} />}
            variant="plain"
          >
            <Field
              error={fieldErrors.name}
              hint={tf('partNameHint')}
              label={tf('nameLabel')}
              required
            >
              <TextInput
                autoComplete="off"
                name="name"
                onChange={(event) => update('name', event.target.value)}
                placeholder={tf('partNamePlaceholder')}
                required
                value={values.name}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tf('partType')}>
                <TextInput
                  autoComplete="off"
                  name="partType"
                  onChange={(event) => update('partType', event.target.value)}
                  placeholder={tf('partTypePlaceholder')}
                  value={values.partType}
                />
              </Field>
              <Field hint={tf('oemHint')} label={tf('oemLabel')}>
                <TextInput
                  autoComplete="off"
                  className="font-mono"
                  maxLength={100}
                  name="oemCode"
                  onChange={(event) => update('oemCode', event.target.value)}
                  placeholder="1RV-8820-02"
                  value={values.oemCode}
                />
              </Field>
            </div>
          </SectionPanel>

          <SectionPanel
            description={tp('conditionDescription')}
            title={<NumberedTitle number="02" title={tp('conditionStep')} />}
            variant="plain"
          >
            <div
              aria-label={tp('conditionStep')}
              className="grid gap-2 sm:grid-cols-3"
              role="radiogroup"
            >
              {(['good', 'fair', 'scrap'] as const).map((condition) => (
                <ConditionTile
                  key={condition}
                  label={conditionLabel(condition, locale)}
                  onPick={() => update('condition', condition)}
                  picked={values.condition === condition}
                  value={condition}
                />
              ))}
            </div>
            <p className="rz-caption m-0 text-pretty">
              {tp('conditionVisible')}
            </p>
          </SectionPanel>

          <SectionPanel
            title={
              <NumberedTitle number="03" title={tf('quantityPriceTitle')} />
            }
            variant="plain"
          >
            <div className="grid items-start gap-4 sm:grid-cols-3">
              <Field label={tf('quantity')} required>
                <QuantityStepper
                  label={tf('quantityStepper')}
                  min={1}
                  onChange={(next) => update('quantity', next)}
                  value={values.quantity}
                />
              </Field>
              <Field hint={tf('unitHint')} label={tf('unitLabel')}>
                <TextInput
                  autoComplete="off"
                  name="unit"
                  readOnly
                  value={unitLabel(t, values.unit)}
                />
              </Field>
              <Field
                hint={priceSlots.hint ?? tf('desiredPriceHint')}
                label={tf('salePrice')}
              >
                <MoneyInput
                  currency={priceSlots.currency}
                  disabled={priceSlots.disabled}
                  inputMode="decimal"
                  name="price"
                  onChange={(event) => update('price', event.target.value)}
                  placeholder="0"
                  value={values.price}
                />
              </Field>
            </div>
            {priceSlots.note}
          </SectionPanel>

          <SectionPanel
            description={tp('compatDescription')}
            title={<NumberedTitle number="04" title={tp('compatStep')} />}
            variant="plain"
          >
            <div className="grid gap-2.5">
              {compatRows.map((row, index) => (
                <CompatibilityRowCard
                  index={index + 1}
                  key={row.key}
                  onChange={(patch) =>
                    setCompatRows((current) =>
                      current.map((item) =>
                        item.key === row.key ? { ...item, ...patch } : item,
                      ),
                    )
                  }
                  onRemove={() =>
                    setCompatRows((current) =>
                      current.filter((item) => item.key !== row.key),
                    )
                  }
                  row={row}
                />
              ))}
              <Button
                onClick={() => {
                  nextCompatibilityKey.current += 1
                  setCompatRows((current) => [
                    ...current,
                    emptyRow(`row-${String(nextCompatibilityKey.current)}`),
                  ])
                }}
                size="wide"
                type="button"
              >
                <Plus aria-hidden />
                {tp('addCar')}
              </Button>
            </div>
            <Notice tone="warn">{tp('compatOnlyOnCreate')}</Notice>
          </SectionPanel>

          {canPlace ? (
            <SectionPanel
              description={tPlacement('hint')}
              title={<NumberedTitle number="05" title={tf('placementTitle')} />}
              variant="plain"
            >
              <PartPlacementPicker
                value={values.placement ?? emptyPartPlacement}
                onChange={(placement) =>
                  setValues((current) => ({ ...current, placement }))
                }
                options={placementOptions}
              />
            </SectionPanel>
          ) : null}

          <SectionPanel
            title={
              <NumberedTitle
                number={canPlace ? '06' : '05'}
                title={tf('photosNotesTitle')}
              />
            }
            variant="plain"
          >
            {canUploadMedia ? (
              <MediaPicker
                beforeDispatch={() => {
                  intakeMutation.requireLatestMutation({ quota: false })
                  partMutation.requireLatestMutation({
                    permission: 'parts.view',
                    quota: false,
                  })
                }}
                entityType="parts"
                items={media}
                onChange={setMedia}
              />
            ) : null}
            <Field label={tf('notes')}>
              <TextArea
                name="notes"
                onChange={(event) => update('notes', event.target.value)}
                placeholder={tf('notesPlaceholder')}
                rows={2}
                value={values.notes}
              />
            </Field>
          </SectionPanel>
        </div>

        <SectionPanel title={tf('newPosition')} variant="plain">
          <div className="rz-inset grid gap-2">
            <p
              className={cn(
                'm-0 font-semibold',
                named ? 'rz-strong' : 'rz-dim',
              )}
            >
              {named ? values.name : tf('partNameFallback')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={zone ? 'ok' : 'warn'}>
                {zone
                  ? tf('availableInCell', { code: zone.code })
                  : tf('noCell')}
              </StatusPill>
              <span className="rz-mono rz-muted">
                {t('quantityWithUnit', {
                  count: values.quantity,
                  unit: unitLabel(t, values.unit || PIECES),
                })}
              </span>
            </div>
          </div>
        </SectionPanel>

        {added.length > 0 ? (
          <SectionPanel
            aside={added.length}
            title={tf('justAdded')}
            variant="plain"
          >
            <ul className="divide-app-line border-app-line m-0 grid list-none divide-y rounded-panel border p-0">
              {added.map((item) => (
                <li className="flex items-center gap-3 px-3 py-2" key={item.id}>
                  <span className="min-w-0 flex-1">
                    <span className="rz-strong block truncate">
                      {item.name}
                    </span>
                    <span className="rz-caption rz-mono block">
                      {item.zone ?? tf('noCellLower')}
                    </span>
                  </span>
                  <span className="rz-mono rz-muted whitespace-nowrap">
                    {t('quantityWithUnit', {
                      count: item.quantity,
                      unit: unitLabel(t, item.unit),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </SectionPanel>
        ) : null}
      </form>
    </Sheet>
  )
}

const INTAKE_PART_FORM = 'intake-part-form'

function NumberedTitle({ number, title }: { number: string; title: string }) {
  return (
    <span className="flex items-baseline gap-2.5">
      <span className="text-app-dim font-mono text-micro">{number}</span>
      {title}
    </span>
  )
}

/** One line of the batch sheet, before it becomes a part. */
interface BatchRow {
  key: string
  name: string
  quantity: string
  price: string
  zoneId: string
  placement?: PartPlacement
}

let batchRowSeq = 0
const emptyBatchRow = (): BatchRow => ({
  key: `row-${String(++batchRowSeq)}`,
  name: '',
  quantity: '1',
  price: '',
  zoneId: '',
})

const batchNumber = (value: string) => {
  const parsed = Number(value.replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * A whole delivery typed as a sheet. The server takes one part per call, so the
 * screen sends them in order and says how far it got — a row that fails leaves
 * everything before it booked in, which is what a yard wants when the van is
 * already unloaded.
 */
function BatchPartsForm({
  intakeId,
  canManageFinance,
}: {
  intakeId: string
  canManageFinance: boolean
}) {
  const navigate = useNavigate()
  const cabinet = useCabinet()
  const t = useT(intakesMessages)
  const tf = useT(intakeFormMessages)
  const params = useParams<{ tenant: string }>()
  const base = `/app/${params.tenant ?? cabinet.targetTenant?.slug ?? ''}/intakes`
  const canPlace =
    allowedToView(cabinetModules.inventory, cabinet) &&
    Boolean(cabinet.snapshot?.permissions.has('inventory.zones.manage'))
  // The rows typed before leaving for the currency setting come back.
  const draft = useCurrencyDraft<{
    rows: BatchRow[]
    condition: string
    sharedZoneId: string
    sharedPlacement?: PartPlacement
  }>(`intake-batch:${intakeId}`)
  const [rows, setRows] = useState<BatchRow[]>(
    () =>
      // Fresh keys: the stored ones may clash with rows made after a reload.
      draft.initial?.rows.map((row) => ({
        ...row,
        key: emptyBatchRow().key,
      })) ?? [
        emptyBatchRow(),
        emptyBatchRow(),
        emptyBatchRow(),
        emptyBatchRow(),
      ],
  )
  const [condition, setCondition] = useState(
    () => draft.initial?.condition ?? 'good',
  )
  const [sharedPlacement, setSharedPlacement] = useState<PartPlacement>(
    () =>
      draft.initial?.sharedPlacement ?? {
        ...emptyPartPlacement,
        zoneId: draft.initial?.sharedZoneId ?? '',
      },
  )
  const [intake, setIntake] = useState<Intake | null>(null)
  const placementOptions = usePlacementOptions(
    canPlace,
    cabinet.targetTenant?.id,
  )
  const pendingCreatedRows = useRef(new Map<string, string>())
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(0)
  const [busy, setBusy] = useState(false)
  const intakeMutation = useLatestMutationGuard(cabinetModules.intakes)
  const partMutation = useLatestMutationGuard(cabinetModules.parts)
  const guard = useFirstPriceGuard()
  const { locale } = useLocale()
  const money = useWholeMoney(guard.currency)

  useEffect(() => {
    const controller = new AbortController()
    void intakesApi.get(intakeId, { signal: controller.signal }).then(
      (next) => {
        if (!controller.signal.aborted) setIntake(next)
      },
      () => undefined,
    )
    return () => controller.abort()
  }, [intakeId])

  const update = (key: string, field: keyof BatchRow, value: string) =>
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, [field]: value } : row,
      ),
    )
  const filled = rows.filter((row) => row.name.trim() !== '')
  const units = filled.reduce(
    (total, row) => total + batchNumber(row.quantity),
    0,
  )
  const priceSum = filled.reduce(
    (total, row) => total + batchNumber(row.quantity) * batchNumber(row.price),
    0,
  )
  const withoutCell = filled.filter(
    (row) => !row.placement?.zoneId && !row.zoneId && !sharedPlacement.zoneId,
  ).length
  const withoutPrice = filled.filter(
    (row) => batchNumber(row.price) === 0,
  ).length
  // Only positive prices are sent, so only those can lock the currency.
  const priceSlots = usePriceSlots(guard, {
    values: filled
      .filter((row) => batchNumber(row.price) > 0)
      .map((row) => row.price),
    onAccept: (accepted) => void save(undefined, accepted),
    draftKept: true,
    onLeave: () =>
      draft.keep({
        rows,
        condition,
        sharedZoneId: sharedPlacement.zoneId,
        sharedPlacement,
      }),
  })
  const pricing = priceSlots.hasPrice && !priceSlots.disabled
  const fillDown = () =>
    setRows((current) => {
      const source = current.find(
        (row) => Boolean(row.placement?.zoneId) || Boolean(row.zoneId),
      )
      if (!source) return current
      return current.map((row) =>
        row.name.trim() !== '' && !row.placement?.zoneId && row.zoneId === ''
          ? {
              ...row,
              zoneId: source.zoneId,
              ...(source.placement ? { placement: source.placement } : {}),
            }
          : row,
      )
    })

  const save = async (
    event?: React.FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    if (busy || filled.length === 0) return
    const rowPrecision = pricing
      ? (filled
          .map((row) => batchNumber(row.price))
          .filter((price) => price > 0)
          .map((price) => amountPrecisionError(price, guard.currency, locale))
          .find((message) => message !== null) ?? null)
      : null
    if (rowPrecision !== null) {
      setProblem(rowPrecision)
      return
    }
    setProblem(null)
    setSaved(0)
    setBusy(true)
    if (
      guard.needsCheck(pricing) &&
      !(await guard.beforeSave(pricing, accepted))
    ) {
      setBusy(false)
      return
    }
    for (const [index, row] of filled.entries()) {
      const placement = row.placement?.zoneId
        ? row.placement
        : row.zoneId
          ? { ...emptyPartPlacement, zoneId: row.zoneId }
          : sharedPlacement
      const price = batchNumber(row.price)
      const request: AddIntakePartRequest = {
        name: row.name.trim(),
        partType: null,
        condition,
        quantity: Math.max(1, Math.round(batchNumber(row.quantity)) || 1),
        unit: PIECES,
        notes: null,
        photoKeys: [],
      }
      try {
        const scope = intakeMutation.requireLatestMutation({ quota: false })
        partMutation.requireLatestMutation({ permission: 'parts.view' })
        const createdId =
          pendingCreatedRows.current.get(row.key) ??
          (
            await intakesApi.addPart(intakeId, request, {
              signal: scope.signal,
            })
          ).id
        pendingCreatedRows.current.set(row.key, createdId)
        if (price > 0 && !priceSlots.disabled) {
          const priceScope = partMutation.requireLatestMutation({
            permission: 'parts.manage',
            quota: false,
          })
          await partsApi.update(
            createdId,
            { desiredSalePrice: { isSet: true, value: price } },
            { signal: priceScope.signal },
          )
          guard.afterSave(true)
        }
        if (canPlace && placement.zoneId)
          await inventoryApi.replacePartZones(
            createdId,
            [placement.zoneId],
            { signal: scope.signal },
            placement.shelfId || undefined,
            placement.sectionId || undefined,
          )
        pendingCreatedRows.current.delete(row.key)
        setSaved(index + 1)
      } catch (error: unknown) {
        setProblem(
          tf('batchFailed', {
            error: normalizeApiProblem(error).message,
            done: index,
            total: filled.length,
          }),
        )
        setRows(filled.slice(index))
        setBusy(false)
        return
      }
    }
    void navigate(`${base}/${intakeId}`)
  }

  const backTo = `${base}/${intakeId}`
  const ready = filled.length > 0
  const saveLabel = ready
    ? tf('acceptPositions', { count: filled.length })
    : tf('acceptBatch')

  const priceColumn =
    guard.currency === null
      ? tf('columnPrice')
      : tf('columnPriceIn', { code: guard.currency })

  return (
    <RedesignShell
      actions={
        <>
          <Button disabled title={tf('draftsUnavailable')}>
            {tf('saveDraft')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !ready}
            form="batch-parts"
            type="submit"
            variant="primary"
          >
            <Check aria-hidden />
            {saveLabel}
          </Button>
        </>
      }
      crumb={
        <>
          <BackLink to={backTo}>{tf('backToIntake')}</BackLink>
          <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
            <span>{t('title')}</span>
            <ChevronRight aria-hidden className="size-3" />
            <span aria-current="page">{tf('batchCrumb')}</span>
          </span>
        </>
      }
    >
      <div className="grid max-w-[1240px] gap-4">
        <div className="grid gap-2">
          <h1 className="rz-h-page">{tf('batchTitle')}</h1>
          <p className="rz-muted m-0">
            {intake?.name ?? tf('untitledIntake')}
            {intake ? ' · ' : null}
            {tf('batchSubtitle')}
          </p>
        </div>

        {problem ? <Notice tone="danger">{problem}</Notice> : null}

        <form
          aria-busy={busy}
          className="flex flex-wrap items-start gap-4"
          id="batch-parts"
          onSubmit={(event) => void save(event)}
        >
          <div className="grid min-w-0 flex-[1_1_560px] gap-4">
            <section aria-label={tf('batchPositions')} className="rz-card">
              <div className="rz-card__head py-2">
                <h2 className="rz-h-card">{tf('batchPositions')}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rz-eyebrow">
                    {tf('rowsCount', { count: rows.length })}
                  </span>
                  {canPlace ? (
                    <Button onClick={fillDown} size="sm" type="button">
                      {tf('fillCellDown')}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div
                aria-hidden
                className="rz-th-label border-app-line hidden gap-2 border-b px-4 py-2 sm:grid sm:grid-cols-[2.4fr_0.8fr_1fr_var(--rz-control-h)]"
              >
                <span>{tf('columnName')}</span>
                <span className="text-right">{tf('columnQuantity')}</span>
                <span className="text-right">{priceColumn}</span>
                <span />
              </div>
              <ul className="divide-app-line m-0 grid list-none divide-y p-0">
                {rows.map((row, index) => (
                  <li
                    className="grid items-center gap-2 px-4 py-2 sm:grid-cols-[2.4fr_0.8fr_1fr_var(--rz-control-h)]"
                    key={row.key}
                  >
                    <TextInput
                      aria-label={tf('rowName', { number: index + 1 })}
                      autoComplete="off"
                      onChange={(event) =>
                        update(row.key, 'name', event.target.value)
                      }
                      placeholder={tf('rowNamePlaceholder', {
                        number: index + 1,
                      })}
                      value={row.name}
                    />
                    <TextInput
                      aria-label={tf('rowQuantity', { number: index + 1 })}
                      inputMode="numeric"
                      numeric
                      onChange={(event) =>
                        update(row.key, 'quantity', event.target.value)
                      }
                      value={row.quantity}
                    />
                    <TextInput
                      aria-label={
                        guard.currency === null
                          ? tf('rowPrice', { number: index + 1 })
                          : tf('rowPriceIn', {
                              number: index + 1,
                              code: guard.currency,
                            })
                      }
                      disabled={priceSlots.disabled}
                      inputMode="decimal"
                      numeric
                      onChange={(event) =>
                        update(row.key, 'price', event.target.value)
                      }
                      placeholder="—"
                      value={row.price}
                    />
                    <Button
                      aria-label={tf('removeRow', { number: index + 1 })}
                      disabled={rows.length <= 1}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((item) => item.key !== row.key),
                        )
                      }
                      size="icon"
                      type="button"
                      variant="quiet"
                    >
                      <X aria-hidden />
                    </Button>
                    {canPlace ? (
                      <details className="border-app-line min-w-0 border-t pt-2 sm:col-span-4">
                        <summary className="cursor-pointer font-medium text-app-ink">
                          {row.placement?.zoneId
                            ? (placementOptions.zones.find(
                                (zone) => zone.id === row.placement?.zoneId,
                              )?.name ?? tf('cell'))
                            : row.zoneId
                              ? (placementOptions.zones.find(
                                  (zone) => zone.id === row.zoneId,
                                )?.name ?? tf('cell'))
                              : sharedPlacement.zoneId
                                ? tf('sameAsBatch')
                                : tf('noCell')}
                        </summary>
                        <div className="mt-2 grid gap-2">
                          <Button
                            type="button"
                            onClick={() =>
                              setRows((current) =>
                                current.map((item) => {
                                  if (item.key !== row.key) return item
                                  const { placement: _placement, ...rest } =
                                    item
                                  return { ...rest, zoneId: '' }
                                }),
                              )
                            }
                          >
                            {tf('sameAsBatch')}
                          </Button>
                          <PartPlacementPicker
                            compact
                            value={
                              row.placement ??
                              (row.zoneId
                                ? { ...emptyPartPlacement, zoneId: row.zoneId }
                                : emptyPartPlacement)
                            }
                            onChange={(placement) =>
                              setRows((current) =>
                                current.map((item) =>
                                  item.key === row.key
                                    ? {
                                        ...item,
                                        zoneId: placement.zoneId,
                                        placement,
                                      }
                                    : item,
                                ),
                              )
                            }
                            options={placementOptions}
                          />
                        </div>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="rz-card__foot flex-wrap items-center">
                <Button
                  onClick={() =>
                    setRows((current) => [...current, emptyBatchRow()])
                  }
                  type="button"
                >
                  <Plus aria-hidden />
                  {tf('addRow')}
                </Button>
                <p className="rz-caption m-0">{tf('emptyRowsSkipped')}</p>
              </div>
            </section>

            <Card title={tf('sharedTitle')}>
              <div className="grid gap-3">
                <p className="rz-muted m-0">{tf('sharedHint')}</p>
                <PillGroup
                  className="w-fit"
                  label={tf('sharedCondition')}
                  onChange={setCondition}
                  options={conditionOptions(tf)}
                  value={condition}
                />
                {canPlace ? (
                  <PartPlacementPicker
                    value={sharedPlacement}
                    onChange={setSharedPlacement}
                    options={placementOptions}
                  />
                ) : null}
              </div>
            </Card>
          </div>

          <aside className="grid min-w-0 flex-[1_1_280px] gap-4 lg:sticky lg:top-[calc(var(--rz-topbar-h)+16px)] lg:max-w-[380px]">
            <Card bodyClassName="grid gap-3" title={tf('batchCard')}>
              <dl className="rz-facts px-0 py-0">
                <div>
                  <dt>{tf('positions')}</dt>
                  <dd className="rz-mono rz-strong text-right">
                    {filled.length}
                  </dd>
                </div>
                <div>
                  <dt>{tf('units')}</dt>
                  <dd className="rz-mono rz-strong text-right">
                    {t('quantityWithUnit', { count: units, unit: t('pcs') })}
                  </dd>
                </div>
                {canManageFinance ? (
                  <div>
                    <dt>{tf('priceSum')}</dt>
                    <dd
                      className={cn(
                        'rz-mono text-right',
                        priceSum > 0 ? 'rz-strong' : 'rz-dim',
                      )}
                    >
                      {priceSum > 0 ? money(priceSum) : '—'}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <div className="grid gap-2 empty:hidden">
                {priceSlots.note}
                {priceSlots.saveNotes}
              </div>
              <Button
                aria-busy={busy}
                disabled={busy || !ready}
                size="wide"
                type="submit"
                variant="primary"
              >
                {saveLabel}
              </Button>
              <p className="rz-caption m-0">
                {busy
                  ? tf('batchProgress', { saved, total: filled.length })
                  : ready
                    ? tf('batchReady')
                    : tf('batchNotReady')}
              </p>
            </Card>

            <Card title={tf('checkTitle')}>
              <ChecksList
                items={[
                  {
                    state: ready ? 'ok' : 'idle',
                    label: ready
                      ? tf('readyPositions', { count: filled.length })
                      : tf('nothingFilled'),
                  },
                  ...(canPlace
                    ? [
                        {
                          state:
                            withoutCell === 0 && ready
                              ? ('ok' as const)
                              : ('warn' as const),
                          label:
                            withoutCell === 0 && ready
                              ? tf('allHaveCell')
                              : tf('withoutCell', { count: withoutCell }),
                        },
                      ]
                    : []),
                  {
                    state: withoutPrice === 0 && ready ? 'ok' : 'warn',
                    label:
                      withoutPrice === 0 && ready
                        ? tf('pricesSet')
                        : tf('withoutPrice', { count: withoutPrice }),
                  },
                ]}
              />
            </Card>
          </aside>
        </form>
      </div>
    </RedesignShell>
  )
}

/** A numbered step of a long form, as the redesign draws it. */
function FormCard({
  step,
  title,
  description,
  aside,
  children,
}: {
  step: string
  title: string
  description?: string
  /** Sits on the title line: a lock, a count. */
  aside?: ReactNode
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rz-card">
      <header className="rz-card__head justify-start py-2.5">
        <span className="rz-mono rz-dim text-caption">{step}</span>
        <h2 className="rz-h-card" id={titleId}>
          {title}
        </h2>
        {aside}
        {description === undefined ? null : (
          <p className="rz-caption m-0 w-full">{description}</p>
        )}
      </header>
      <div className="rz-card__body grid gap-4">{children}</div>
    </section>
  )
}
