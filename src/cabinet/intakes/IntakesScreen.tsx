import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import { sourceReturnPath } from '../parts/source-return'
import { FeatureGate } from '../FeatureFlags'
import { FEATURE_FLAGS } from '@/api/feature-flags'
import {
  Check,
  ChevronLeft,
  PackagePlus,
  Plus,
  Printer,
  ScanLine,
  Trash2,
  X,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Notice,
  PageBody,
  Pagination,
  PillGroup,
  QuantityStepper,
  SearchInput,
  SelectInput,
  SkeletonRows,
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
import { inventoryApi, type InventoryZone } from '@/api/inventory'
import { partsApi } from '@/api/parts'
import { normalizeApiProblem } from '@/api/errors'
import { cn } from '@/lib/utils'
import { commonMessages, useLocale, useT, type Translate } from '@/i18n'
import { formatDay } from '../cars/day'
import { intakeFormMessages } from './intake-form-messages'
import { intakesMessages } from './messages'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { MediaPicker } from '../cars/CarsScreen'
import type { MediaUploadResult } from '@/api/media'
import { cabinetModules } from '../module-registry'
import { evaluateModuleAccess } from '../policy'
import type { ModuleAccessDecision } from '../policy'
import type { CabinetModuleDefinition } from '../module-registry'
import type { Permission } from '../access-types'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'

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
 * Intakes are bought in dollars, like the cars and the parts they become. A
 * round sum drops its cents; real cents are kept.
 */
const money = (amount: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    trailingZeroDisplay: 'stripIfInteger',
  }).format(amount)

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
    <Notice role="alert" tone="warn">
      {message}
    </Notice>
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
      <PartForm canUploadMedia={partsMediaManage} intakeId={intakeId} />
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
  }, [selection])
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
  const positions = items.reduce((total, item) => total + item.partsCount, 0)
  const sold = items.reduce((total, item) => total + item.soldCount, 0)
  const cost = items.reduce((total, item) => total + (item.totalCost ?? 0), 0)

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
          <span>{t('eyebrow')}</span>
          <span aria-hidden className="text-white/20">
            /
          </span>
          <span className="text-app-muted">{t('title')}</span>
        </p>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
          <form
            className="min-w-[180px] flex-[0_1_320px]"
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
          {createDecision.kind === 'allowed' ? (
            <Button
              asChild
              className="px-5 text-sm font-bold"
              variant="primary"
            >
              <Link to={`${base}/new`}>
                <Plus aria-hidden />
                {t('newIntake')}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid w-full gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
            {t('title')}
          </h1>
          <p className="text-app-muted mt-3 text-[15px]">{t('subtitle')}</p>
        </div>

        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

        <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px overflow-hidden rounded-[20px] border">
          <IntakeStat
            label={t('statIntakes')}
            meta={t('statTotalFiltered')}
            value={String(state.page?.total ?? 0)}
          />
          <IntakeStat
            label={t('statPositions')}
            meta={t('statThisPage')}
            unit={t('pcs')}
            value={String(positions)}
          />
          <IntakeStat
            label={t('statSold')}
            meta={t('statThisPage')}
            unit={t('pcs')}
            value={String(sold)}
          />
          {financeView ? (
            <IntakeStat
              label={t('statCost')}
              meta={t('statThisPage')}
              value={money(cost)}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            aria-label={t('segmentsLabel')}
            className="border-app-line bg-app-raised flex flex-wrap gap-1 rounded-xl border p-1"
            role="radiogroup"
          >
            {INTAKE_SEGMENTS.map((option) => {
              const active = (selection.status ?? '') === option.value
              return (
                <button
                  aria-checked={active}
                  className={cn(
                    'focus-visible:outline-brand flex min-h-9 cursor-pointer items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-bold',
                    active
                      ? 'text-app-ink bg-white/[0.08]'
                      : 'text-app-muted hover:text-app-ink',
                  )}
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
                    <span className="text-app-dim font-mono text-[11px] font-medium">
                      {state.page?.total ?? 0}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <section
          aria-label={t('listLabel')}
          className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
        >
          <DataTable
            caption={t('listLabel')}
            columns={[
              {
                key: 'name',
                label: t('columnIntake'),
                variant: 'primary',
                cell: (intake) => (
                  <Link
                    className="hover:text-brand grid gap-0.5"
                    to={`${base}/${intake.id}`}
                  >
                    <span className="font-semibold text-white">
                      {intake.name ?? t('untitled')}
                    </span>
                    <span className="text-app-muted text-[13px]">
                      {intake.createdBy.displayName}
                    </span>
                  </Link>
                ),
              },
              {
                key: 'date',
                label: t('columnDate'),
                cell: (intake) => (
                  <span className="text-app-muted font-mono text-[13px]">
                    {day(intake.purchasedAt ?? intake.createdAt)}
                  </span>
                ),
              },
              {
                key: 'parts',
                label: t('columnPositions'),
                align: 'end',
                cell: (intake) => (
                  <span className="font-mono text-white tabular-nums">
                    {intake.partsCount}
                  </span>
                ),
              },
              ...(financeView
                ? [
                    {
                      key: 'cost',
                      label: t('columnCost'),
                      align: 'end' as const,
                      cell: (intake: IntakeListItem) => (
                        <span className="font-mono font-bold text-white tabular-nums">
                          {intake.totalCost === null
                            ? '—'
                            : money(intake.totalCost)}
                        </span>
                      ),
                    },
                  ]
                : []),
              {
                key: 'status',
                label: t('columnStatus'),
                align: 'end',
                cell: (intake) => {
                  const sale = intakeSaleState(intake)
                  return (
                    <StatusPill tone={sale.tone}>{t(sale.label)}</StatusPill>
                  )
                },
              },
            ]}
            empty={
              <EmptyState
                description={
                  (selection.search ?? '') === '' &&
                  selection.status === undefined
                    ? t('emptyDescription')
                    : t('emptyFilteredDescription')
                }
                title={
                  (selection.search ?? '') === '' &&
                  selection.status === undefined
                    ? t('emptyTitle')
                    : t('emptyFilteredTitle')
                }
              />
            }
            embedded
            footer={
              <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
                <p className="text-app-dim text-[13px]">
                  {t('shownOfIntakes', {
                    shown: items.length,
                    count: state.page?.total ?? 0,
                  })}
                </p>
                <Pagination
                  label={t('paginationLabel')}
                  onPage={(nextPage) => updatePage(nextPage, currentPageSize)}
                  page={currentPage}
                  totalPages={totalPages}
                />
              </div>
            }
            rowKey={(intake) => intake.id}
            rows={items}
          />
        </section>
      </div>
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

/** One cell of the strip under the title: a figure with its unit and a note. */
function IntakeStat({
  label,
  value,
  unit,
  meta,
  tone,
}: {
  label: string
  value: string
  unit?: string
  meta?: string
  tone?: 'ok'
}) {
  return (
    <div className="bg-app-raised px-6 pt-[22px] pb-6">
      <p className="text-app-muted font-mono text-[11px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-3.5 flex items-baseline gap-2">
        <span
          className={cn(
            'text-[30px] leading-none font-extrabold tracking-[-0.03em]',
            tone === 'ok' ? 'text-state-ok' : 'text-white',
          )}
        >
          {value}
        </span>
        {unit === undefined ? null : (
          <span className="text-app-muted font-mono text-[13px] font-medium">
            {unit}
          </span>
        )}
      </p>
      {meta === undefined ? null : (
        <p className="text-app-dim mt-3.5 text-[13px]">{meta}</p>
      )}
    </div>
  )
}

function IntakeDetail({ base, intakeId }: { base: string; intakeId: string }) {
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
  const canPrintStickers = allowedToView(cabinetModules.stickers, cabinet)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.intakes,
  )
  useEffect(() => {
    const controller = new AbortController()
    void intakesApi
      .get(intakeId, { signal: controller.signal })
      .then(setIntake, (error: unknown) => {
        if (!controller.signal.aborted)
          setProblem(normalizeApiProblem(error).message)
      })
    return () => controller.abort()
  }, [intakeId])
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
  if (!intake && problem)
    return (
      <PageBody width="narrow">
        <ErrorState
          actions={
            <Button asChild>
              <Link to={base}>{t('backToList')}</Link>
            </Button>
          }
          description={problem}
          title={t('loadFailed')}
        />
      </PageBody>
    )
  if (!intake)
    return (
      <PageBody width="narrow">
        <SkeletonRows label={t('loading')} rows={3} />
      </PageBody>
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

  return (
    <div
      aria-busy={busy}
      className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10"
      role="main"
    >
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={base}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            {t('backToIntakes')}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>{t('eyebrow')}</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>{t('title')}</span>
          </p>
        </div>
        {manage ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild className="px-[18px] text-sm font-semibold">
              <Link to={`${base}/${intake.id}/edit`}>{tc('edit')}</Link>
            </Button>
            {/* Import is a parts mutation, the same gate as the parts list. */}
            {partCreateDecision.kind === 'allowed' && partsMediaManage ? (
              <FeatureGate name={FEATURE_FLAGS.partsBulkImport}>
                <Button asChild>
                  <Link
                    to={`${base.replace(/\/intakes$/, '/parts')}/imports?intake_id=${encodeURIComponent(intake.id)}`}
                  >
                    {t('importParts')}
                  </Link>
                </Button>
              </FeatureGate>
            ) : null}
            {partCreateDecision.kind === 'allowed' ? (
              <Button
                asChild
                className="px-5 text-sm font-bold"
                variant="primary"
              >
                <Link to={`${base}/${intake.id}/parts/new`}>
                  {t('addPart')}
                </Link>
              </Button>
            ) : null}
            <ActionMenu
              actions={[
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
                ...(partCreateDecision.kind === 'allowed'
                  ? [
                      {
                        key: 'batch',
                        label: t('addBatch'),
                        icon: <PackagePlus aria-hidden />,
                        onSelect: () =>
                          void navigate(`${base}/${intake.id}/parts/batch`),
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
          </div>
        ) : null}
      </div>

      <div className="grid w-full gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              {intake.name ?? t('untitledIntake')}
            </h1>
            <StatusPill tone={saleState.tone}>{t(saleState.label)}</StatusPill>
          </div>
          <p className="text-app-muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px]">
            <span>
              {intake.purchasedAt === null
                ? t('noPurchaseDate')
                : day(intake.purchasedAt)}
            </span>
            <span aria-hidden className="text-white/20">
              ·
            </span>
            <span>
              {t('createdBy', {
                name: intake.createdBy.displayName,
                date: day(intake.createdAt),
              })}
            </span>
          </p>
        </div>

        {problem ? <Notice tone="danger">{problem}</Notice> : null}

        <div className="bg-app-line border-app-line grid gap-px overflow-hidden rounded-[20px] border sm:grid-cols-2 lg:grid-cols-4">
          <IntakeStat
            label={t('statPositions')}
            meta={t('statUnits', { count: units })}
            unit={t('statPositionsUnit')}
            value={String(intake.partsCount)}
          />
          <IntakeStat
            label={t('statSold')}
            meta={t('statStillInStock', {
              count: intake.partsCount - intake.soldCount,
            })}
            unit={t('statOf', { count: intake.partsCount })}
            value={String(intake.soldCount)}
          />
          {financeView ? (
            <>
              <IntakeStat
                label={t('statInvested')}
                meta={t('statBatchCost')}
                value={money(profit?.invested ?? intake.totalCost ?? 0)}
              />
              <IntakeStat
                label={t('statRecouped')}
                meta={
                  profit?.recoupedPercent === null ||
                  profit?.recoupedPercent === undefined
                    ? t('statNothingBack')
                    : t('statRecoupedShare', {
                        percent: profit.recoupedPercent,
                      })
                }
                tone="ok"
                value={money(profit?.recouped ?? 0)}
              />
            </>
          ) : null}
        </div>

        {/* wrap-reverse puts the rail above the list on narrow screens; it also
            flips the cross axis, so items-end is what pins both to the top. */}
        <div className="flex flex-wrap-reverse items-end gap-6">
          <div className="grid min-w-[320px] flex-[1_1_560px] gap-5">
            {partsView ? (
              <section
                aria-label={t('positionsTitle')}
                className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
              >
                <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-b px-6 pt-5 pb-4">
                  <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
                    {t('positionsTitle')}
                  </h2>
                  <div
                    aria-label={t('partFiltersLabel')}
                    className="border-app-line bg-app-input flex gap-1 rounded-[10px] border p-1"
                    role="radiogroup"
                  >
                    {INTAKE_PART_FILTERS.map((option) => {
                      const active = option.value === filter
                      return (
                        <button
                          aria-checked={active}
                          className={cn(
                            'focus-visible:outline-brand flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-bold',
                            active
                              ? 'text-app-ink bg-white/[0.08]'
                              : 'text-app-muted hover:text-app-ink',
                          )}
                          key={option.value}
                          onClick={() => {
                            setFilter(option.value)
                            setPartsPage(1)
                          }}
                          role="radio"
                          type="button"
                        >
                          {t(option.label)}
                          <span className="text-app-dim font-mono text-[11px] font-medium">
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
                        <span className="text-app-muted font-mono text-[13px]">
                          {part.qrCode}
                        </span>
                      ),
                    },
                    {
                      key: 'name',
                      label: t('columnName'),
                      variant: 'primary',
                      cell: (part) => (
                        <Link
                          className="hover:text-brand grid gap-0.5"
                          to={`${partsBase}/${part.id}`}
                        >
                          <span className="font-semibold text-white">
                            {part.name}
                          </span>
                          <span className="text-app-dim font-mono text-[12px]">
                            {part.partType ?? t('noType')}
                          </span>
                        </Link>
                      ),
                    },
                    {
                      key: 'quantity',
                      label: t('columnQuantity'),
                      align: 'end',
                      cell: (part) => (
                        <span className="text-app-muted font-mono tabular-nums">
                          {t('quantityWithUnit', {
                            count: part.quantity,
                            unit: unitLabel(t, part.unit),
                          })}
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      label: t('columnState'),
                      align: 'end',
                      cell: (part) => {
                        const pill = partStatusPill(t, part.status)
                        return (
                          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                        )
                      },
                    },
                  ]}
                  empty={
                    <EmptyState
                      description={
                        filter === 'all'
                          ? t('partsEmptyDescription')
                          : t('partsEmptyFilteredDescription')
                      }
                      title={
                        filter === 'all'
                          ? t('partsEmptyTitle')
                          : t('partsEmptyFilteredTitle')
                      }
                    />
                  }
                  embedded
                  footer={
                    filteredRows.length > partsPageSize ? (
                      <div className="border-app-line flex items-center justify-between gap-4 border-t px-6 py-4">
                        <p className="text-app-dim text-[13px]">
                          {t('shownOf', {
                            shown: rows.length,
                            total: filteredRows.length,
                          })}
                        </p>
                        <Pagination
                          label={t('partsPaginationLabel')}
                          onPage={setPartsPage}
                          page={currentPartsPage}
                          totalPages={partsTotalPages}
                        />
                      </div>
                    ) : null
                  }
                  rowKey={(part) => part.id}
                  rows={rows}
                />
              </section>
            ) : null}

            <Card
              aside={
                <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                  {t('historyCount', { count: history.length })}
                </span>
              }
              bodyClassName="p-0"
              title={t('historyTitle')}
            >
              <ul className="divide-app-line grid divide-y">
                {history.map((event) => (
                  <li
                    className="flex items-center gap-3.5 px-6 py-3.5"
                    key={event.id}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'size-[7px] shrink-0 rounded-full',
                        event.tone === 'ok' ? 'bg-state-ok' : 'bg-app-dim',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {event.title}
                      </span>
                      <span className="text-app-muted mt-0.5 block text-xs">
                        {event.meta}
                      </span>
                    </span>
                    <span className="text-app-muted font-mono text-[13px] whitespace-nowrap">
                      {event.value}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {intake.notes === null ? null : (
              <Card title={t('notesTitle')}>
                <p className="text-app-muted text-sm leading-[1.6] whitespace-pre-line">
                  {intake.notes}
                </p>
              </Card>
            )}

            {intake.photos.length > 0 ? (
              <Card title={t('photosTitle')}>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {intake.photos.map((photo, index) => (
                    <li key={photo.url}>
                      <a
                        className="border-app-line block overflow-hidden rounded-[14px] border"
                        href={photo.url}
                      >
                        <img
                          alt={t('photoAlt', { number: index + 1 })}
                          className="aspect-4/3 w-full object-cover"
                          src={photo.thumbnailUrl || photo.url}
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>

          <aside className="sticky top-24 grid min-w-[300px] flex-[0_1_340px] gap-5">
            <Card title={t('salesTitle')}>
              <p className="flex items-baseline gap-2.5">
                <span className="text-[26px] leading-none font-extrabold tracking-[-0.03em] text-white">
                  {intake.soldCount}
                </span>
                <span className="text-app-muted font-mono text-[13px]">
                  {t('ofPositions', { count: intake.partsCount })}
                </span>
              </p>
              <span
                aria-label={t('soldProgress')}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={
                  intake.partsCount === 0
                    ? 0
                    : Math.round((intake.soldCount / intake.partsCount) * 100)
                }
                className="bg-app-line-2 mt-3.5 block h-2 overflow-hidden rounded-full"
                role="progressbar"
              >
                <span
                  className="bg-state-ok block h-full rounded-full"
                  style={{
                    width: `${String(
                      intake.partsCount === 0
                        ? 0
                        : Math.round(
                            (intake.soldCount / intake.partsCount) * 100,
                          ),
                    )}%`,
                  }}
                />
              </span>
              <p className="text-app-muted mt-3 text-[13px]">
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
                <Button
                  asChild
                  className="mt-4.5 min-h-11 w-full text-sm font-bold"
                  variant="primary"
                >
                  <Link to={`${base}/${intake.id}/parts/new`}>
                    {t('addPart')}
                  </Link>
                </Button>
              ) : null}
            </Card>
          </aside>
        </div>
      </div>

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
  const [values, setValues] = useState({
    name: '',
    purchasedAt: '',
    totalCost: '',
    notes: '',
  })
  const [media, setMedia] = useState<MediaUploadResult[]>([])
  const [intake, setIntake] = useState<Intake | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ totalCost?: string }>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.intakes,
  )
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
  }, [canManageFinance, intakeId])
  const cost = values.totalCost === '' ? null : Number(values.totalCost)
  const hasCost = cost !== null && Number.isFinite(cost) && cost > 0
  const positions = intake?.partsCount ?? 0
  const units =
    intake?.parts.reduce((total, part) => total + part.quantity, 0) ?? 0
  const named = values.name.trim().length > 0

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    const amount = values.totalCost === '' ? null : Number(values.totalCost)
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
    setFieldErrors({})
    setBusy(true)
    try {
      const request = {
        name: values.name.trim() || null,
        supplier: null,
        purchasedAt: values.purchasedAt || null,
        ...(canManageFinance ? { totalCost: amount } : {}),
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
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={backTo}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            {intakeId ? tf('backToIntake') : t('backToIntakes')}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>{t('eyebrow')}</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>{t('title')}</span>
            {named ? (
              <>
                <span aria-hidden className="text-white/20">
                  /
                </span>
                <span className="text-app-muted max-w-40 truncate normal-case">
                  {values.name}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild className="px-[18px] text-sm font-semibold">
            <Link to={backTo}>{tc('cancel')}</Link>
          </Button>
          <Button
            aria-busy={busy}
            className="px-5 text-sm font-bold"
            disabled={busy}
            form="intake-form"
            type="submit"
            variant="primary"
          >
            {saveLabel}
          </Button>
        </div>
      </div>

      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
            {title}
          </h1>
          {intakeId === undefined ? (
            <p className="text-app-muted mt-3.5 text-[15px]">{tf('intro')}</p>
          ) : (
            <p className="text-app-muted mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-medium">
              <span className="text-app-ink font-mono">
                {values.name || t('untitled')}
              </span>
              {intake ? (
                <>
                  <span aria-hidden className="text-white/20">
                    ·
                  </span>
                  <span>
                    {tf('positionsCount', { count: positions })} ·{' '}
                    {t('quantityWithUnit', { count: units, unit: t('pcs') })}
                  </span>
                  <span aria-hidden className="text-white/20">
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
          className="flex flex-wrap items-start gap-6"
          id="intake-form"
          onSubmit={(event) => void save(event)}
        >
          <div className="grid min-w-[320px] flex-[1_1_560px] gap-5">
            <FormCard step="01" title={tf('basicsTitle')}>
              <div className="grid gap-4">
                <Field hint={tf('nameHint')} label={tf('nameLabel')}>
                  <TextInput
                    autoComplete="off"
                    name="name"
                    onChange={update('name')}
                    placeholder={tf('namePlaceholder')}
                    value={values.name}
                  />
                </Field>
              </div>
            </FormCard>

            <FormCard step="02" title={tf('dateOwnerTitle')}>
              <div className="grid gap-4 sm:grid-cols-2">
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
                  <p className="border-app-line-2 text-app-ink inline-flex w-fit min-h-11 items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-2 text-sm font-semibold">
                    <span className="text-app-muted grid size-7 place-items-center rounded-full bg-white/[0.06] text-xs font-bold">
                      {initials(intake.createdBy.displayName)}
                    </span>
                    {intake.createdBy.displayName}
                  </p>
                ) : (
                  <p className="text-app-dim text-sm">{tf('ownerOnCreate')}</p>
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
                <div className="grid gap-4">
                  <Field
                    error={fieldErrors.totalCost}
                    hint="Скільки заплачено за всю партію, у доларах"
                    label="Загальна вартість"
                  >
                    <TextInput
                      className="font-mono"
                      inputMode="decimal"
                      name="totalCost"
                      onChange={update('totalCost')}
                      placeholder="6120"
                      value={values.totalCost}
                    />
                  </Field>
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

          <aside className="sticky top-24 grid min-w-[280px] flex-[0_0_320px] gap-5">
            <Card
              title={
                intakeId === undefined
                  ? tf('beforeCreateTitle')
                  : tf('summaryTitle')
              }
            >
              <div className="border-app-line bg-app-input rounded-[14px] border p-4">
                <p
                  className={cn(
                    'text-[17px] font-bold tracking-[-0.015em]',
                    named ? 'text-white' : 'text-app-dim',
                  )}
                >
                  {named ? values.name : tf('nameMissing')}
                </p>
                <p className="text-app-muted mt-1.5 text-sm">
                  {[
                    values.purchasedAt ? day(values.purchasedAt) : null,
                    intake?.createdBy.displayName ?? null,
                  ]
                    .filter((part) => part !== null)
                    .join(' · ') || tf('dateMissing')}
                </p>
                <p className="text-app-dim mt-3 font-mono text-[12px]">
                  {intakeId === undefined
                    ? tf('numberAssigned')
                    : `${values.name || tf('untitledLower')} · ${tf('positionsCount', { count: positions })}`}
                </p>
              </div>
              {canManageFinance ? (
                <dl className="mt-5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                  <dt className="text-app-muted text-sm font-semibold">
                    {tf('summaryCost')}
                  </dt>
                  <dd
                    className={cn(
                      'font-mono text-[15px] tabular-nums',
                      hasCost ? 'text-white' : 'text-app-dim',
                    )}
                  >
                    {hasCost && cost !== null ? money(cost) : '—'}
                  </dd>
                  <dt className="text-app-muted text-sm font-semibold">
                    {tf('summaryExpenses')}
                  </dt>
                  <dd
                    className="text-app-dim font-mono text-[15px] tabular-nums"
                    title={tf('expensesNotStored')}
                  >
                    —
                  </dd>
                  <div className="bg-app-line col-span-2 my-1 h-px" />
                  <dt className="text-[15px] font-bold text-white">
                    {tf('summaryTotal')}
                  </dt>
                  <dd className="font-mono text-[20px] text-white tabular-nums">
                    {money(hasCost && cost !== null ? cost : 0)}
                  </dd>
                </dl>
              ) : null}
              <ul className="border-app-line mt-5 grid gap-2.5 border-t pt-4.5">
                {checks.map((item) => (
                  <li
                    className={cn(
                      'flex items-center gap-2.5 text-[13px] font-semibold',
                      item.done ? 'text-app-ink' : 'text-app-dim',
                    )}
                    key={item.label}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-4.5 shrink-0 place-items-center rounded-full',
                        item.done
                          ? 'bg-state-ok-soft text-state-ok'
                          : 'bg-white/[0.06]',
                      )}
                    >
                      {item.done ? <Check className="size-3" /> : null}
                    </span>
                    {item.label}
                  </li>
                ))}
              </ul>
              <Button
                aria-busy={busy}
                className="mt-5 min-h-12 w-full text-[16px] font-bold"
                disabled={busy}
                type="submit"
                variant="primary"
              >
                {saveLabel}
              </Button>
              <p className="text-app-dim mt-3 text-[13px] leading-[1.5]">
                {intakeId === undefined ? tf('nextOnCreate') : tf('nextOnEdit')}
              </p>
            </Card>

            {intakeId ? (
              <Card title={tf('deleteIntake')}>
                <p className="text-app-muted text-[13px] leading-[1.5]">
                  {tf('deleteInfo', { count: positions })}{' '}
                  {positions > 0
                    ? tf('deleteInfoBlocked')
                    : tf('deleteInfoFree')}
                </p>
                <Button
                  className="mt-3 min-h-10 w-full text-[13px] font-bold"
                  disabled={busy || positions > 0}
                  onClick={() => setConfirmDelete(true)}
                  type="button"
                  variant="danger"
                >
                  {tf('deleteIntake')}
                </Button>
              </Card>
            ) : null}
          </aside>
        </form>
      </div>

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
  const params = useParams<{ tenant: string }>()
  const base = `/app/${params.tenant ?? cabinet.targetTenant?.slug ?? ''}/intakes`
  const canPlace = allowedToView(cabinetModules.inventory, cabinet)
  const [values, setValues] = useState({
    name: '',
    partType: '',
    oemCode: '',
    condition: 'good',
    quantity: 1,
    unit: PIECES,
    price: '',
    zoneId: '',
    notes: '',
  })
  const [media, setMedia] = useState<MediaUploadResult[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({})
  const [intake, setIntake] = useState<Intake | null>(null)
  const [zones, setZones] = useState<InventoryZone[]>([])
  const [added, setAdded] = useState<AddedPart[]>([])
  const [busy, setBusy] = useState(false)
  const intakeMutation = useLatestMutationGuard(cabinetModules.intakes)
  const partMutation = useLatestMutationGuard(cabinetModules.parts)

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

  useEffect(() => {
    if (!canPlace) return
    const controller = new AbortController()
    void inventoryApi
      .getZones({ activeOnly: true, signal: controller.signal })
      .then(
        (next) => {
          if (!controller.signal.aborted) setZones(next)
        },
        () => {
          // Without zones the cell simply stays unset — the part is still added.
        },
      )
    return () => controller.abort()
  }, [canPlace])

  const update = (key: keyof typeof values, value: string | number) =>
    setValues((current) => ({ ...current, [key]: value }))

  /**
   * What one piece of this batch cost: the price of the whole intake spread
   * over the positions already in it. It is the yard's own arithmetic, shown
   * so the sale price is set against something rather than guessed.
   */
  const unitCost =
    intake && intake.totalCost !== null && intake.partsCount > 0
      ? intake.totalCost / intake.partsCount
      : null
  const price = Number(values.price.replace(',', '.'))
  const hasPrice =
    values.price.trim() !== '' && Number.isFinite(price) && price > 0
  const margin =
    hasPrice && unitCost !== null
      ? Math.round(((price - unitCost) / price) * 100)
      : null
  const named = values.name.trim().length > 0
  const zone = zones.find((item) => item.id === values.zoneId) ?? null

  const save = async (event: React.FormEvent, andAnother = false) => {
    event.preventDefault()
    if (busy) return
    if (!named) {
      setFieldErrors({
        name: tf('partNameRequired'),
      })
      return
    }
    setFieldErrors({})
    const request: AddIntakePartRequest = {
      name: values.name.trim(),
      partType: values.partType.trim() || null,
      condition: values.condition || null,
      quantity: values.quantity,
      unit: values.unit || null,
      notes: values.notes.trim() || null,
      photoKeys: media.map((item) => item.storageKey),
      ...(values.zoneId ? { inventoryZoneIds: [values.zoneId] } : {}),
    }
    setBusy(true)
    try {
      const intakeScope = intakeMutation.requireLatestMutation({ quota: false })
      partMutation.requireLatestMutation({ permission: 'parts.view' })
      const created = await intakesApi.addPart(intakeId, request, {
        signal: intakeScope.signal,
      })
      // The intake endpoint carries no price, so the asking price is set on the
      // part it just created — one call, right after, before anyone sees it.
      if (hasPrice) {
        const priceScope = partMutation.requireLatestMutation({
          permission: 'parts.manage',
          quota: false,
        })
        await partsApi.update(
          created.id,
          { desiredSalePrice: { isSet: true, value: price } },
          { signal: priceScope.signal },
        )
      }
      if (!andAnother) {
        void navigate(`${base}/${intakeId}`)
        return
      }
      setAdded((current) => [
        {
          id: created.id,
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
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={backTo}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            {tf('backToIntake')}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>{t('eyebrow')}</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>{t('title')}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            aria-busy={busy}
            className="px-[18px] text-sm font-semibold"
            disabled={busy || !named}
            onClick={(event) => void save(event, true)}
          >
            {tf('saveAndAddAnother')}
          </Button>
          <Button
            aria-busy={busy}
            className="px-5 text-sm font-bold"
            disabled={busy || !named}
            onClick={(event) => void save(event)}
            variant="primary"
          >
            {tf('addPart')}
          </Button>
        </div>
      </div>

      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
            {tf('addPart')}
          </h1>
          <p className="text-app-muted mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium">
            <span>
              {tf('partInIntake')}{' '}
              <span className="text-app-ink font-semibold">
                {intake?.name ?? '…'}
              </span>
            </span>
            {intake ? (
              <>
                <span aria-hidden className="text-white/20">
                  ·
                </span>
                <span>
                  {tf('alreadyPositions', { count: intake.partsCount })}
                </span>
              </>
            ) : null}
          </p>
        </div>

        {problem ? <Notice tone="danger">{problem}</Notice> : null}

        <form
          aria-busy={busy}
          className="flex flex-wrap items-start gap-6"
          onSubmit={(event) => void save(event)}
        >
          <div className="grid min-w-[320px] flex-[1_1_560px] gap-5">
            <FormCard step="01" title={tf('descriptionTitle')}>
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
                    className="font-mono"
                    disabled
                    name="oemCode"
                    placeholder="1RV-8820-02"
                    value=""
                  />
                </Field>
              </div>
              <Field label={tf('conditionLabel')}>
                <PillGroup
                  label={tf('conditionGroup')}
                  onChange={(next) => update('condition', next)}
                  options={conditionOptions(tf)}
                  value={values.condition}
                />
              </Field>
            </FormCard>

            <FormCard
              description={
                unitCost === null
                  ? tf('unitCostPending')
                  : tf('unitCostFromBatch', { amount: money(unitCost) })
              }
              step="02"
              title={tf('quantityPriceTitle')}
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
                <Field hint="Бажана ціна, у доларах" label="Ціна продажу">
                  <TextInput
                    inputMode="decimal"
                    name="price"
                    onChange={(event) => update('price', event.target.value)}
                    placeholder="0"
                    value={values.price}
                  />
                </Field>
              </div>
            </FormCard>

            {canPlace ? (
              <FormCard
                description={tf('placementHint')}
                step="03"
                title={tf('placementTitle')}
              >
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label={tf('cell')}>
                    <SelectInput
                      name="zoneId"
                      onChange={(event) => update('zoneId', event.target.value)}
                      value={values.zoneId}
                    >
                      <option value="">{tf('noCell')}</option>
                      {zones.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {item.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Button
                    className="min-h-11"
                    disabled
                    title={tf('scanUnavailable')}
                    type="button"
                  >
                    <ScanLine aria-hidden />
                    {tf('scan')}
                  </Button>
                </div>
              </FormCard>
            ) : null}

            <FormCard
              step={canPlace ? '04' : '03'}
              title={tf('photosNotesTitle')}
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
            </FormCard>
          </div>

          <aside className="sticky top-24 grid min-w-[280px] flex-[0_0_320px] gap-5">
            <Card title={tf('newPosition')}>
              <div className="border-app-line bg-app-input rounded-[14px] border p-4">
                <p
                  className={cn(
                    'text-[17px] font-bold tracking-[-0.015em]',
                    named ? 'text-white' : 'text-app-dim',
                  )}
                >
                  {named ? values.name : tf('partNameFallback')}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusPill tone={zone ? 'ok' : 'warn'}>
                    {zone
                      ? tf('availableInCell', { code: zone.code })
                      : tf('noCell')}
                  </StatusPill>
                  <span className="text-app-muted font-mono text-[13px]">
                    {t('quantityWithUnit', {
                      count: values.quantity,
                      unit: unitLabel(t, values.unit || PIECES),
                    })}
                  </span>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                <dt className="text-app-muted text-sm font-semibold">
                  {tf('unitCost')}
                </dt>
                <dd className="font-mono text-[16px] text-white tabular-nums">
                  {unitCost === null ? '—' : money(unitCost)}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">
                  {tf('salePrice')}
                </dt>
                <dd
                  className={cn(
                    'font-mono text-[16px] tabular-nums',
                    hasPrice ? 'text-white' : 'text-app-dim',
                  )}
                >
                  {hasPrice ? money(price) : '—'}
                </dd>
                <div className="bg-app-line col-span-2 my-1 h-px" />
                <dt className="text-[16px] font-bold text-white">
                  {tf('margin')}
                </dt>
                <dd
                  className={cn(
                    'font-mono text-[20px] tabular-nums',
                    margin === null
                      ? 'text-app-dim'
                      : margin >= 30
                        ? 'text-state-ok'
                        : margin > 0
                          ? 'text-state-warn'
                          : 'text-state-danger',
                  )}
                >
                  {margin === null ? '—' : `${String(margin)}%`}
                </dd>
              </dl>
              <Button
                aria-busy={busy}
                className="mt-5 min-h-12 w-full text-[16px] font-bold"
                disabled={busy || !named}
                type="submit"
                variant="primary"
              >
                {tf('addPart')}
              </Button>
              <p className="text-app-dim mt-3 text-[13px] leading-[1.5]">
                {saveNote}
              </p>
            </Card>

            {added.length > 0 ? (
              <Card
                aside={
                  <span className="text-app-muted font-mono text-[12px]">
                    {added.length}
                  </span>
                }
                bodyClassName="p-0"
                title={tf('justAdded')}
              >
                <ul className="divide-app-line grid divide-y">
                  {added.map((item) => (
                    <li
                      className="flex items-center gap-3 px-6 py-3"
                      key={item.id}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {item.name}
                        </span>
                        <span className="text-app-muted mt-0.5 block font-mono text-[13px]">
                          {item.zone ?? tf('noCellLower')}
                        </span>
                      </span>
                      <span className="text-app-muted font-mono text-[14px] whitespace-nowrap">
                        {t('quantityWithUnit', {
                          count: item.quantity,
                          unit: unitLabel(t, item.unit),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </aside>
        </form>
      </div>
    </div>
  )
}

/** One line of the batch sheet, before it becomes a part. */
interface BatchRow {
  key: string
  name: string
  quantity: string
  price: string
  zoneId: string
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
  const canPlace = allowedToView(cabinetModules.inventory, cabinet)
  const [rows, setRows] = useState<BatchRow[]>(() => [
    emptyBatchRow(),
    emptyBatchRow(),
    emptyBatchRow(),
    emptyBatchRow(),
  ])
  const [condition, setCondition] = useState('good')
  const [sharedZoneId, setSharedZoneId] = useState('')
  const [intake, setIntake] = useState<Intake | null>(null)
  const [zones, setZones] = useState<InventoryZone[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(0)
  const [busy, setBusy] = useState(false)
  const intakeMutation = useLatestMutationGuard(cabinetModules.intakes)
  const partMutation = useLatestMutationGuard(cabinetModules.parts)

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

  useEffect(() => {
    if (!canPlace) return
    const controller = new AbortController()
    void inventoryApi
      .getZones({ activeOnly: true, signal: controller.signal })
      .then(
        (next) => {
          if (!controller.signal.aborted) setZones(next)
        },
        () => {
          // Without zones the positions are simply booked in without a cell.
        },
      )
    return () => controller.abort()
  }, [canPlace])

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
    (row) => (row.zoneId || sharedZoneId) === '',
  ).length
  const withoutPrice = filled.filter(
    (row) => batchNumber(row.price) === 0,
  ).length
  const fillDown = () =>
    setRows((current) => {
      const source = current.find((row) => row.zoneId !== '')
      if (!source) return current
      return current.map((row) =>
        row.name.trim() !== '' && row.zoneId === ''
          ? { ...row, zoneId: source.zoneId }
          : row,
      )
    })

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || filled.length === 0) return
    setProblem(null)
    setSaved(0)
    setBusy(true)
    for (const [index, row] of filled.entries()) {
      const zoneId = row.zoneId || sharedZoneId
      const price = batchNumber(row.price)
      const request: AddIntakePartRequest = {
        name: row.name.trim(),
        partType: null,
        condition,
        quantity: Math.max(1, Math.round(batchNumber(row.quantity)) || 1),
        unit: PIECES,
        notes: null,
        photoKeys: [],
        ...(zoneId ? { inventoryZoneIds: [zoneId] } : {}),
      }
      try {
        const scope = intakeMutation.requireLatestMutation({ quota: false })
        partMutation.requireLatestMutation({ permission: 'parts.view' })
        const created = await intakesApi.addPart(intakeId, request, {
          signal: scope.signal,
        })
        if (price > 0) {
          const priceScope = partMutation.requireLatestMutation({
            permission: 'parts.manage',
            quota: false,
          })
          await partsApi.update(
            created.id,
            { desiredSalePrice: { isSet: true, value: price } },
            { signal: priceScope.signal },
          )
        }
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

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={backTo}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            {tf('backToIntake')}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>{t('title')}</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span className="text-app-muted">{tf('batchCrumb')}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button disabled title={tf('draftsUnavailable')}>
            {tf('saveDraft')}
          </Button>
          <Button
            aria-busy={busy}
            className="px-5 text-sm font-bold"
            disabled={busy || !ready}
            form="batch-parts"
            type="submit"
            variant="primary"
          >
            {saveLabel}
          </Button>
        </div>
      </div>

      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
            {tf('batchTitle')}
          </h1>
          <p className="text-app-muted mt-3 text-[15px]">
            {intake?.name ?? tf('untitledIntake')}
            {intake ? ' · ' : null}
            {tf('batchSubtitle')}
          </p>
        </div>

        {problem ? <Notice tone="danger">{problem}</Notice> : null}

        <form
          aria-busy={busy}
          className="flex flex-wrap items-start gap-6"
          id="batch-parts"
          onSubmit={(event) => void save(event)}
        >
          <div className="grid min-w-[360px] flex-[1_1_620px] gap-5">
            <section
              aria-label={tf('batchPositions')}
              className="border-app-line bg-app-raised overflow-hidden rounded-[18px] border"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-[18px] pb-4">
                <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
                  {tf('batchPositions')}
                </h2>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                    {tf('rowsCount', { count: rows.length })}
                  </span>
                  {canPlace ? (
                    <Button
                      className="min-h-9 px-3 text-xs font-semibold"
                      onClick={fillDown}
                      type="button"
                    >
                      {tf('fillCellDown')}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div
                aria-hidden
                className={cn(
                  'border-app-line text-app-muted hidden gap-3 border-t border-b px-6 py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase sm:grid',
                  canPlace
                    ? 'sm:grid-cols-[2.4fr_0.8fr_1fr_1.4fr_44px]'
                    : 'sm:grid-cols-[2.4fr_0.8fr_1fr_44px]',
                )}
              >
                <span>{tf('columnName')}</span>
                <span className="text-right">{tf('columnQuantity')}</span>
                <span className="text-right">Ціна, $</span>
                {canPlace ? <span>{tf('cell')}</span> : null}
                <span />
              </div>
              <ul className="divide-app-line border-app-line grid divide-y border-t sm:border-t-0">
                {rows.map((row, index) => (
                  <li
                    className={cn(
                      'grid items-center gap-3 px-6 py-2.5',
                      canPlace
                        ? 'sm:grid-cols-[2.4fr_0.8fr_1fr_1.4fr_44px]'
                        : 'sm:grid-cols-[2.4fr_0.8fr_1fr_44px]',
                    )}
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
                      aria-label={`Ціна в рядку ${String(index + 1)}`}
                      className="font-mono"
                      inputMode="decimal"
                      numeric
                      onChange={(event) =>
                        update(row.key, 'price', event.target.value)
                      }
                      placeholder="—"
                      value={row.price}
                    />
                    {canPlace ? (
                      <SelectInput
                        aria-label={tf('rowCell', { number: index + 1 })}
                        onChange={(event) =>
                          update(row.key, 'zoneId', event.target.value)
                        }
                        value={row.zoneId}
                      >
                        <option value="">
                          {sharedZoneId === ''
                            ? tf('noCell')
                            : tf('sameAsBatch')}
                        </option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.code}
                          </option>
                        ))}
                      </SelectInput>
                    ) : null}
                    <Button
                      aria-label={tf('removeRow', { number: index + 1 })}
                      className="min-w-11 px-0"
                      disabled={rows.length <= 1}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((item) => item.key !== row.key),
                        )
                      }
                      type="button"
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <Button
                  onClick={() =>
                    setRows((current) => [...current, emptyBatchRow()])
                  }
                  type="button"
                >
                  <Plus aria-hidden />
                  {tf('addRow')}
                </Button>
                <p className="text-app-dim text-[13px]">
                  {tf('emptyRowsSkipped')}
                </p>
              </div>
            </section>

            <Card title={tf('sharedTitle')}>
              <p className="text-app-muted -mt-1 text-sm">{tf('sharedHint')}</p>
              <PillGroup
                className="mt-4 w-fit"
                label={tf('sharedCondition')}
                onChange={setCondition}
                options={conditionOptions(tf)}
                value={condition}
              />
              {canPlace && zones.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    aria-pressed={sharedZoneId === ''}
                    className={cn(
                      'focus-visible:outline-brand min-h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold',
                      sharedZoneId === ''
                        ? 'border-app-line-2 bg-app-input text-white'
                        : 'border-app-line text-app-muted hover:text-app-ink',
                    )}
                    onClick={() => setSharedZoneId('')}
                    type="button"
                  >
                    {tf('noCell')}
                  </button>
                  {zones.map((zone) => (
                    <button
                      aria-pressed={sharedZoneId === zone.id}
                      className={cn(
                        'focus-visible:outline-brand min-h-9 cursor-pointer rounded-full border px-3.5 font-mono text-[13px] font-semibold',
                        sharedZoneId === zone.id
                          ? 'border-app-line-2 bg-app-input text-white'
                          : 'border-app-line text-app-muted hover:text-app-ink',
                      )}
                      key={zone.id}
                      onClick={() => setSharedZoneId(zone.id)}
                      type="button"
                    >
                      {zone.code}
                    </button>
                  ))}
                </div>
              ) : null}
            </Card>
          </div>

          <aside className="sticky top-24 grid min-w-[300px] flex-[0_1_320px] gap-5">
            <Card title={tf('batchCard')}>
              <dl className="grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                <dt className="text-app-muted text-sm font-semibold">
                  {tf('positions')}
                </dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {filled.length}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">
                  {tf('units')}
                </dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {t('quantityWithUnit', { count: units, unit: t('pcs') })}
                </dd>
                {canManageFinance ? (
                  <>
                    <dt className="text-app-muted text-sm font-semibold">
                      {tf('priceSum')}
                    </dt>
                    <dd
                      className={cn(
                        'font-mono text-[15px] tabular-nums',
                        priceSum > 0 ? 'text-white' : 'text-app-dim',
                      )}
                    >
                      {priceSum > 0 ? money(priceSum) : '—'}
                    </dd>
                  </>
                ) : null}
              </dl>
              <Button
                aria-busy={busy}
                className="mt-5 min-h-11 w-full text-sm font-bold"
                disabled={busy || !ready}
                type="submit"
                variant="primary"
              >
                {saveLabel}
              </Button>
              <p className="text-app-dim mt-2.5 text-xs leading-[1.5]">
                {busy
                  ? tf('batchProgress', { saved, total: filled.length })
                  : ready
                    ? tf('batchReady')
                    : tf('batchNotReady')}
              </p>
            </Card>

            <Card title={tf('checkTitle')}>
              <ul className="grid gap-2.5">
                {[
                  {
                    state: ready ? 'ok' : 'idle',
                    label: ready
                      ? tf('readyPositions', { count: filled.length })
                      : tf('nothingFilled'),
                  },
                  ...(canPlace
                    ? [
                        {
                          state: withoutCell === 0 && ready ? 'ok' : 'warn',
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
                ].map((check) => (
                  <li
                    className={cn(
                      'flex items-start gap-2.5 text-[13px] leading-[1.45] font-semibold',
                      check.state === 'ok'
                        ? 'text-app-ink'
                        : check.state === 'warn'
                          ? 'text-state-warn'
                          : 'text-app-dim',
                    )}
                    key={check.label}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-px grid size-4.5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold',
                        check.state === 'ok'
                          ? 'bg-state-ok-soft text-state-ok'
                          : check.state === 'warn'
                            ? 'bg-state-warn-soft text-state-warn'
                            : 'bg-white/[0.06]',
                      )}
                    >
                      {check.state === 'ok' ? (
                        <Check className="size-3" />
                      ) : check.state === 'warn' ? (
                        '!'
                      ) : null}
                    </span>
                    {check.label}
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </form>
      </div>
    </div>
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
    <section
      aria-labelledby={titleId}
      className="border-app-line bg-app-raised rounded-[18px] border px-6 pt-[22px] pb-6"
    >
      <div className="flex items-baseline gap-2.5">
        <span className="text-app-dim font-mono text-[12px]">{step}</span>
        <h2
          className="text-[17px] font-bold tracking-[-0.01em] text-white"
          id={titleId}
        >
          {title}
        </h2>
        {aside}
      </div>
      {description === undefined ? null : (
        <p className="text-app-muted mt-1.5 text-sm">{description}</p>
      )}
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  )
}
