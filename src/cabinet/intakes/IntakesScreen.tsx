import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import {
  Check,
  ChevronLeft,
  Lock,
  MoreHorizontal,
  Plus,
  ScanLine,
  X,
} from 'lucide-react'
import {
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
import { partStatusPresentation } from '../parts/part-labels'
import { cn, plural } from '@/lib/utils'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { MediaPicker } from '../cars/CarsScreen'
import {
  PhotoUploadError,
  uploadPickedPhotos,
  type PickedPhoto,
} from '../cars/picked-photos'
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

/** Dates arrive as ISO strings; anything unparsable is shown as it came. */
const day = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' }).format(parsed)
}

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
        released: true,
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
      { ...definition, released: true, viewPermission: permission },
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
    { ...definition, released: true },
    cabinet.status === 'ready' && cabinet.snapshot
      ? { status: 'ready', snapshot: cabinet.snapshot, error: null }
      : { status: 'loading', snapshot: null, error: null },
    'view',
  ).kind === 'allowed'

function Denied({ decision }: { decision: ModuleAccessDecision }) {
  const message =
    decision.kind === 'quota-exhausted'
      ? decision.resource === 'parts'
        ? 'Ліміт запчастин вичерпано.'
        : 'Ліміт приймань вичерпано.'
      : decision.kind === 'subscription-blocked'
        ? 'Поточна підписка не дозволяє цю дію.'
        : 'Недостатньо прав.'
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
        title="Нове приймання"
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
        title="Редагування приймання"
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
  { value: '', label: 'Усі' },
  { value: 'active', label: 'Активні' },
  { value: 'closed', label: 'Закриті' },
] as const

/**
 * How far a batch has sold through, said as a pill. The list item carries no
 * lifecycle status of its own, so this is what the numbers actually support.
 */
const intakeSaleState = (
  intake: IntakeListItem,
): { label: string; tone: StatusTone } =>
  intake.partsCount === 0
    ? { label: 'Без позицій', tone: 'neutral' }
    : intake.soldCount === 0
      ? { label: 'Нічого не продано', tone: 'warn' }
      : intake.soldCount < intake.partsCount
        ? { label: 'Розпродається', tone: 'ok' }
        : { label: 'Розпродано', tone: 'neutral' }

function IntakesList({ base }: { base: string }) {
  const { createDecision, financeView } = useIntakeAccess()
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
          <span>Склад</span>
          <span aria-hidden className="text-white/20">
            /
          </span>
          <span className="text-app-muted">Приймання</span>
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
              aria-label="Пошук приймань"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Назва, постачальник"
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
                Нове приймання
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1240px] gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
            Приймання
          </h1>
          <p className="text-app-muted mt-3 text-[15px]">
            Надходження запчастин з авто, від постачальників і з аукціонів
          </p>
        </div>

        {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

        <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px overflow-hidden rounded-[20px] border">
          <IntakeStat
            label="Приймань"
            meta="усього за фільтром"
            value={String(state.page?.total ?? 0)}
          />
          <IntakeStat
            label="Позицій"
            meta="на цій сторінці"
            value={String(positions)}
          />
          <IntakeStat
            label="Продано"
            meta="на цій сторінці"
            value={String(sold)}
          />
          {financeView ? (
            <IntakeStat
              label="Вартість надходжень"
              meta="на цій сторінці"
              unit="USD"
              value={money(cost)}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            aria-label="Які приймання показувати"
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
                  {option.label}
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
          <p className="text-app-dim text-[13px]">
            Спочатку найновіші приймання
          </p>
        </div>

        <section
          aria-label="Список приймань"
          className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
        >
          <DataTable
            caption="Список приймань"
            columns={[
              {
                key: 'name',
                label: 'Приймання',
                variant: 'primary',
                cell: (intake) => (
                  <Link
                    className="hover:text-brand grid gap-0.5"
                    to={`${base}/${intake.id}`}
                  >
                    <span className="font-semibold text-white">
                      {intake.name ?? 'Без назви'}
                    </span>
                    <span className="text-app-muted text-[13px]">
                      {[
                        intake.supplier ?? 'без постачальника',
                        intake.createdBy.displayName,
                      ].join(' · ')}
                    </span>
                  </Link>
                ),
              },
              {
                key: 'date',
                label: 'Дата',
                cell: (intake) => (
                  <span className="text-app-muted font-mono text-[13px]">
                    {day(intake.purchasedAt ?? intake.createdAt)}
                  </span>
                ),
              },
              {
                key: 'parts',
                label: 'Позицій',
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
                      label: 'Вартість',
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
                label: 'Статус',
                align: 'end',
                cell: (intake) => {
                  const sale = intakeSaleState(intake)
                  return <StatusPill tone={sale.tone}>{sale.label}</StatusPill>
                },
              },
            ]}
            empty={
              <EmptyState
                description={
                  (selection.search ?? '') === '' &&
                  selection.status === undefined
                    ? 'Створіть перше приймання, щоб оприбуткувати партію запчастин.'
                    : 'Спробуйте інший фільтр або очистіть пошук.'
                }
                title={
                  (selection.search ?? '') === '' &&
                  selection.status === undefined
                    ? 'Приймань поки немає'
                    : 'Приймань за цим фільтром немає'
                }
              />
            }
            footer={
              <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
                <p className="text-app-dim text-[13px]">
                  Показано {items.length} з {state.page?.total ?? 0}{' '}
                  {plural(state.page?.total ?? 0, [
                    'приймання',
                    'приймання',
                    'приймань',
                  ])}
                </p>
                <Pagination
                  label="Пагінація приймань"
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
  { value: 'all', label: 'Усі' },
  { value: 'available', label: 'Доступні' },
  { value: 'sold', label: 'Продані' },
] as const

type IntakePartFilter = (typeof INTAKE_PART_FILTERS)[number]['value']

/**
 * What a position is measured in when nobody said otherwise. It is a default,
 * not a rule: the single-part form lets it be changed to компл, кг or anything
 * else the yard counts in.
 */
const DEFAULT_UNIT = 'шт'

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
  const { cabinet, manage, partsView, partCreateDecision, financeView } =
    useIntakeAccess()
  const navigate = useNavigate()
  const [intake, setIntake] = useState<Intake | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filter, setFilter] = useState<IntakePartFilter>('all')
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
      setProblem(
        error instanceof PhotoUploadError
          ? `Не вдалося завантажити фото (${error.names.join(', ')}). Повторіть спробу або приберіть ці файли.`
          : normalizeApiProblem(error).message,
      )
      setBusy(false)
    }
  }
  if (!intake && problem)
    return (
      <PageBody width="narrow">
        <ErrorState
          actions={
            <Button asChild>
              <Link to={base}>До списку</Link>
            </Button>
          }
          description={problem}
          title="Не вдалося завантажити приймання"
        />
      </PageBody>
    )
  if (!intake)
    return (
      <PageBody width="narrow">
        <SkeletonRows label="Завантажуємо приймання…" rows={3} />
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
  const rows =
    filter === 'all' ? intake.parts : filter === 'sold' ? sold : available
  /** What one position of this batch cost: the batch price over its positions. */
  const unitCost =
    intake.totalCost !== null && intake.partsCount > 0
      ? intake.totalCost / intake.partsCount
      : null
  const profit = intake.profitability ?? null
  const saleState =
    intake.partsCount === 0
      ? { label: 'Без позицій', tone: 'neutral' as StatusTone }
      : intake.soldCount === 0
        ? { label: 'Нічого не продано', tone: 'warn' as StatusTone }
        : intake.soldCount < intake.partsCount
          ? { label: 'Розпродається', tone: 'ok' as StatusTone }
          : { label: 'Розпродано', tone: 'neutral' as StatusTone }
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
        title: `Додано «${part.name}»`,
        meta: day(part.createdAt),
        value: `${String(part.quantity)} ${part.unit}`,
        tone: 'ok' as const,
      })),
    {
      id: 'created',
      title: 'Приймання створено',
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
            До приймань
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Склад</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>Приймання</span>
          </p>
        </div>
        {manage ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild className="px-[18px] text-sm font-semibold">
              <Link to={`${base}/${intake.id}/edit`}>Редагувати</Link>
            </Button>
            {partCreateDecision.kind === 'allowed' ? (
              <Button
                asChild
                className="px-5 text-sm font-bold"
                variant="primary"
              >
                <Link to={`${base}/${intake.id}/parts/new`}>Додати деталь</Link>
              </Button>
            ) : null}
            <Button
              aria-expanded={menuOpen}
              aria-label="Інші дії з прийманням"
              className="min-w-11 px-0 text-base font-bold tracking-[0.1em]"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mx-auto grid w-full max-w-[1240px] gap-7 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              {intake.name ?? 'Приймання без назви'}
            </h1>
            <StatusPill tone={saleState.tone}>{saleState.label}</StatusPill>
          </div>
          <p className="text-app-muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px]">
            <span>{intake.supplier ?? 'Постачальника не вказано'}</span>
            <span aria-hidden className="text-white/20">
              ·
            </span>
            <span>
              {intake.purchasedAt === null
                ? 'без дати придбання'
                : day(intake.purchasedAt)}
            </span>
            <span aria-hidden className="text-white/20">
              ·
            </span>
            <span>
              Створив {intake.createdBy.displayName}, {day(intake.createdAt)}
            </span>
          </p>
        </div>

        {menuOpen && manage ? (
          <div
            aria-label="Інші дії з прийманням"
            className="border-app-line bg-app-raised flex flex-wrap items-center gap-2.5 rounded-[14px] border px-4 py-3"
            role="group"
          >
            {canPrintStickers ? (
              <Button
                asChild={stickerHref !== null}
                disabled={stickerHref === null}
              >
                {stickerHref === null ? (
                  <>Друк стікерів партії</>
                ) : (
                  <Link to={stickerHref}>Друк стікерів партії</Link>
                )}
              </Button>
            ) : null}
            {partCreateDecision.kind === 'allowed' ? (
              <Button asChild>
                <Link to={`${base}/${intake.id}/parts/batch`}>
                  Додати партією
                </Link>
              </Button>
            ) : null}
            <Button
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              variant="danger"
            >
              Видалити приймання
            </Button>
          </div>
        ) : null}

        {problem ? <Notice tone="danger">{problem}</Notice> : null}

        <div className="bg-app-line border-app-line grid gap-px overflow-hidden rounded-[20px] border sm:grid-cols-2 lg:grid-cols-4">
          <IntakeStat
            label="Позицій"
            meta={`${String(units)} ${plural(units, ['одиниця', 'одиниці', 'одиниць'])}`}
            unit="найменувань"
            value={String(intake.partsCount)}
          />
          <IntakeStat
            label="Продано"
            meta={`${String(intake.partsCount - intake.soldCount)} ще на складі`}
            unit={`з ${String(intake.partsCount)}`}
            value={String(intake.soldCount)}
          />
          {financeView ? (
            <>
              <IntakeStat
                label="Інвестовано"
                meta={
                  unitCost === null
                    ? 'вартість партії не вказано'
                    : `${money(unitCost)} на позицію`
                }
                unit="USD"
                value={money(profit?.invested ?? intake.totalCost ?? 0)}
              />
              <IntakeStat
                label="Повернено"
                meta={
                  profit?.recoupedPercent === null ||
                  profit?.recoupedPercent === undefined
                    ? 'ще нічого не повернулося'
                    : `${String(profit.recoupedPercent)}% від вкладеного`
                }
                tone="ok"
                unit="USD"
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
                aria-label="Позиції приймання"
                className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5 pb-4">
                  <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
                    Позиції приймання
                  </h2>
                  <div
                    aria-label="Які позиції показувати"
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
                          onClick={() => setFilter(option.value)}
                          role="radio"
                          type="button"
                        >
                          {option.label}
                          <span className="text-app-dim font-mono text-[11px] font-medium">
                            {counts[option.value]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <DataTable
                  caption="Позиції приймання"
                  columns={[
                    {
                      key: 'qr',
                      label: 'Код',
                      cell: (part) => (
                        <span className="text-app-muted font-mono text-[13px]">
                          {part.qrCode}
                        </span>
                      ),
                    },
                    {
                      key: 'name',
                      label: 'Назва',
                      variant: 'primary',
                      cell: (part) => (
                        <span className="grid gap-0.5">
                          <span className="font-semibold text-white">
                            {part.name}
                          </span>
                          <span className="text-app-dim font-mono text-[12px]">
                            {part.partType ?? 'без типу'}
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: 'quantity',
                      label: 'К-сть',
                      align: 'end',
                      cell: (part) => (
                        <span className="text-app-muted font-mono tabular-nums">
                          {part.quantity} {part.unit}
                        </span>
                      ),
                    },
                    ...(financeView
                      ? [
                          {
                            key: 'cost',
                            label: 'Собів.',
                            align: 'end' as const,
                            cell: () => (
                              <span className="text-app-muted font-mono tabular-nums">
                                {unitCost === null ? '—' : money(unitCost)}
                              </span>
                            ),
                          },
                        ]
                      : []),
                    {
                      key: 'status',
                      label: 'Стан',
                      align: 'end',
                      cell: (part) => {
                        const pill = partStatusPresentation(part.status)
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
                          ? 'Додайте запчастину, щоб оприбуткувати вміст цього приймання.'
                          : 'За цим фільтром позицій немає — спробуйте «Усі».'
                      }
                      title={
                        filter === 'all'
                          ? 'У прийманні ще немає запчастин'
                          : 'Порожньо за фільтром'
                      }
                    />
                  }
                  rowKey={(part) => part.id}
                  rows={rows}
                />
              </section>
            ) : null}

            <Card
              aside={
                <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                  {history.length}{' '}
                  {plural(history.length, ['подія', 'події', 'подій'])}
                </span>
              }
              bodyClassName="p-0"
              title="Історія"
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
              <Card title="Нотатки">
                <p className="text-app-muted text-sm leading-[1.6] whitespace-pre-line">
                  {intake.notes}
                </p>
              </Card>
            )}

            {intake.photos.length > 0 ? (
              <Card title="Фото партії">
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {intake.photos.map((photo, index) => (
                    <li key={photo.url}>
                      <a
                        className="border-app-line block overflow-hidden rounded-[14px] border"
                        href={photo.url}
                      >
                        <img
                          alt={`Фото приймання ${String(index + 1)}`}
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
            {financeView ? (
              <Card title="Собівартість">
                <p className="flex items-baseline gap-2">
                  <span className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-white">
                    {intake.totalCost === null ? '—' : money(intake.totalCost)}
                  </span>
                  <span className="text-app-muted font-mono text-sm">USD</span>
                </p>
                <dl className="border-app-line mt-4.5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5 border-t pt-4">
                  <dt className="text-app-muted text-sm font-semibold">
                    Придбання
                  </dt>
                  <dd className="font-mono text-[15px] text-white tabular-nums">
                    {intake.totalCost === null ? '—' : money(intake.totalCost)}
                  </dd>
                  <dt className="text-app-muted text-sm font-semibold">
                    На позицію
                  </dt>
                  <dd className="font-mono text-[15px] text-white tabular-nums">
                    {unitCost === null ? '—' : money(unitCost)}
                  </dd>
                  <div className="bg-app-line col-span-2 my-1 h-px" />
                  <dt className="text-[15px] font-bold text-white">
                    Повернено
                  </dt>
                  <dd className="text-state-ok font-mono text-[19px] tabular-nums">
                    {money(profit?.recouped ?? 0)}
                  </dd>
                </dl>
              </Card>
            ) : null}

            <Card title="Продаж партії">
              <p className="flex items-baseline gap-2.5">
                <span className="text-[26px] leading-none font-extrabold tracking-[-0.03em] text-white">
                  {intake.soldCount}
                </span>
                <span className="text-app-muted font-mono text-[13px]">
                  з {intake.partsCount}{' '}
                  {plural(intake.partsCount, ['позиції', 'позицій', 'позицій'])}
                </span>
              </p>
              <span
                aria-label="Продано позицій партії"
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
                  ? `${String(intake.partsCount - intake.soldCount)} позицій ще на складі`
                  : `${String(profit.partsAvailable)} доступно · ${String(profit.partsSold)} продано`}
              </p>
              {partCreateDecision.kind === 'allowed' ? (
                <Button
                  asChild
                  className="mt-4.5 min-h-11 w-full text-sm font-bold"
                  variant="primary"
                >
                  <Link to={`${base}/${intake.id}/parts/new`}>
                    Додати деталь
                  </Link>
                </Button>
              ) : null}
            </Card>

            <Card title="Постачальник">
              <div className="flex items-center gap-3.5">
                <span className="text-app-ink grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-sm font-bold">
                  {initials(intake.supplier ?? '—')}
                </span>
                <span className="min-w-0">
                  <span className="block text-[17px] font-bold tracking-[-0.015em] text-white">
                    {intake.supplier ?? 'Не вказано'}
                  </span>
                  <span className="text-app-muted mt-0.5 block text-xs">
                    Постачальники поки не ведуться окремим довідником
                  </span>
                </span>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Видалити"
        consequence="Приймання та його звʼязок із оприбуткованими деталями зникнуть назавжди."
        onConfirm={() => void remove()}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        pending={busy}
        title="Видалити приймання?"
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
  const params = useParams<{ tenant: string }>()
  const navigate = useNavigate()
  const base = `/app/${params.tenant ?? cabinet.targetTenant?.slug ?? ''}/intakes`
  const [values, setValues] = useState({
    name: '',
    supplier: '',
    purchasedAt: '',
    totalCost: '',
    notes: '',
  })
  const [media, setMedia] = useState<PickedPhoto[]>([])
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
          supplier: next.supplier ?? '',
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
  const supplied = values.supplier.trim().length > 0

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
        totalCost:
          'Вартість має бути числом не менше нуля. Введіть суму цифрами, наприклад 7500.',
      })
      return
    }
    setFieldErrors({})
    setBusy(true)
    try {
      const request = {
        name: values.name.trim() || null,
        supplier: values.supplier.trim() || null,
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
          : {
              ...request,
              // Photos go up with the intake, not when they were picked.
              photoKeys: await uploadPickedPhotos(
                media,
                'intakes',
                scope.signal,
              ),
            },
        scope.signal,
      )
      void navigate(`${base}/${saved.id}`)
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

  const backTo = intakeId ? `${base}/${intakeId}` : base
  const saveLabel = intakeId ? 'Зберегти зміни' : 'Створити приймання'
  const checks = [
    { done: named, label: 'Назва партії вказана' },
    { done: supplied, label: 'Постачальник вказаний' },
    ...(canManageFinance
      ? [{ done: hasCost, label: 'Сума придбання вказана' }]
      : []),
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
            {intakeId ? 'До приймання' : 'До приймань'}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Склад</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>Приймання</span>
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
            <Link to={backTo}>Скасувати</Link>
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

      <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
            {title}
          </h1>
          {intakeId === undefined ? (
            <p className="text-app-muted mt-3.5 text-[15px]">
              Спочатку створіть приймання, потім додайте до нього запчастини —
              по одній або партією.
            </p>
          ) : (
            <p className="text-app-muted mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-medium">
              <span className="text-app-ink font-mono">
                {values.name || 'Без назви'}
              </span>
              {intake ? (
                <>
                  <span aria-hidden className="text-white/20">
                    ·
                  </span>
                  <span>
                    {positions}{' '}
                    {plural(positions, ['позиція', 'позиції', 'позицій'])} ·{' '}
                    {units} {plural(units, ['одиниця', 'одиниці', 'одиниць'])}
                  </span>
                  <span aria-hidden className="text-white/20">
                    ·
                  </span>
                  <span>
                    Створено {day(intake.createdAt)} ·{' '}
                    {intake.createdBy.displayName}
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
            <FormCard
              aside={
                intakeId ? (
                  <span className="border-app-line-2 text-app-muted inline-flex h-6 items-center gap-1.5 rounded-full border bg-white/[0.05] px-2.5 text-xs font-bold">
                    <Lock aria-hidden className="size-3" />
                    Не змінюється
                  </span>
                ) : undefined
              }
              description={
                intakeId === undefined
                  ? 'Після створення джерело не змінюється — від нього залежить розрахунок собівартості.'
                  : 'Джерело задане під час створення — від нього залежить розрахунок собівартості.'
              }
              step="01"
              title="Джерело надходження"
            >
              <p className="text-app-dim text-[13px] leading-5 text-pretty">
                Партія завжди приходить від постачальника — окремого виду
                джерела приймання не розрізняє.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field hint="Від кого прийшла партія" label="Постачальник">
                  <TextInput
                    autoComplete="off"
                    name="supplier"
                    onChange={update('supplier')}
                    placeholder="Європа Авто"
                    value={values.supplier}
                  />
                </Field>
                <Field hint="Як у накладній постачальника" label="Назва">
                  <TextInput
                    autoComplete="off"
                    name="name"
                    onChange={update('name')}
                    placeholder="Липнева партія"
                    value={values.name}
                  />
                </Field>
              </div>
            </FormCard>

            <FormCard step="02" title="Дата й відповідальний">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Дата приймання">
                  <TextInput
                    name="purchasedAt"
                    onChange={update('purchasedAt')}
                    type="date"
                    value={values.purchasedAt.slice(0, 10)}
                  />
                </Field>
              </div>
              <Field hint="Хто прийняв партію" label="Відповідальний">
                {intake ? (
                  <p className="border-app-line-2 text-app-ink inline-flex w-fit min-h-11 items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-2 text-sm font-semibold">
                    <span className="text-app-muted grid size-7 place-items-center rounded-full bg-white/[0.06] text-xs font-bold">
                      {initials(intake.createdBy.displayName)}
                    </span>
                    {intake.createdBy.displayName}
                  </p>
                ) : (
                  <p className="text-app-dim text-sm">
                    Відповідальним стає той, хто створює приймання.
                  </p>
                )}
              </Field>
            </FormCard>

            <FormCard
              description={
                positions > 0
                  ? `Сума придбання ділиться між позиціями партії — зараз їх ${String(positions)}.`
                  : 'Сума придбання ділиться між позиціями партії й формує їхню собівартість.'
              }
              step="03"
              title="Вартість партії"
            >
              {canManageFinance ? (
                <div className="grid gap-4 sm:grid-cols-2">
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
              <Field
                hint="Домовленості, стан партії, усе, що знадобиться складу згодом"
                label="Коментар"
              >
                <TextArea
                  name="notes"
                  onChange={update('notes')}
                  placeholder="Стан партії, домовленості, що перевірити"
                  rows={2}
                  value={values.notes}
                />
              </Field>
            </FormCard>

            {!intakeId ? (
              <FormCard step="04" title="Фото партії">
                <MediaPicker items={media} onChange={setMedia} />
              </FormCard>
            ) : null}
          </div>

          <aside className="sticky top-24 grid min-w-[280px] flex-[0_0_320px] gap-5">
            <Card
              title={intakeId === undefined ? 'Перед створенням' : 'Зведення'}
            >
              <div className="border-app-line bg-app-input rounded-[14px] border p-4">
                <p
                  className={cn(
                    'text-[17px] font-bold tracking-[-0.015em]',
                    supplied ? 'text-white' : 'text-app-dim',
                  )}
                >
                  {supplied ? values.supplier : 'Постачальник не вказаний'}
                </p>
                <p className="text-app-muted mt-1.5 text-sm">
                  {[
                    values.purchasedAt ? day(values.purchasedAt) : null,
                    intake?.createdBy.displayName ?? null,
                  ]
                    .filter((part) => part !== null)
                    .join(' · ') || 'Дата не вказана'}
                </p>
                <p className="text-app-dim mt-3 font-mono text-[12px]">
                  {intakeId === undefined
                    ? 'номер присвоїться автоматично'
                    : `${values.name || 'без назви'} · ${String(positions)} ${plural(positions, ['позиція', 'позиції', 'позицій'])}`}
                </p>
              </div>
              {canManageFinance ? (
                <dl className="mt-5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                  <dt className="text-app-muted text-sm font-semibold">
                    Сума придбання
                  </dt>
                  <dd
                    className={cn(
                      'font-mono text-[15px] tabular-nums',
                      hasCost ? 'text-white' : 'text-app-dim',
                    )}
                  >
                    {hasCost && cost !== null ? money(cost) : '—'}
                  </dd>
                  <div className="bg-app-line col-span-2 my-1 h-px" />
                  <dt className="text-[15px] font-bold text-white">Разом</dt>
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
                {intakeId === undefined
                  ? 'Далі відкриється картка приймання, де додаються запчастини.'
                  : 'Зміна суми придбання перерахує собівартість усіх позицій партії.'}
              </p>
            </Card>

            {intakeId ? (
              <Card title="Видалити приймання">
                <p className="text-app-muted text-[13px] leading-[1.5]">
                  У прийманні {positions}{' '}
                  {plural(positions, ['позиція', 'позиції', 'позицій'])}.
                  Видалення розірве їхній звʼязок із партією — його не
                  відновити.
                </p>
                <Button
                  className="mt-3 min-h-10 w-full text-[13px] font-bold"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                  type="button"
                  variant="danger"
                >
                  Видалити приймання
                </Button>
              </Card>
            ) : null}
          </aside>
        </form>
      </div>

      <ConfirmDialog
        confirmLabel="Видалити"
        consequence="Приймання та його звʼязок із оприбуткованими деталями зникнуть назавжди."
        onConfirm={() => void remove()}
        onOpenChange={setConfirmDelete}
        open={confirmDelete}
        pending={busy}
        title="Видалити приймання?"
      />
    </div>
  )
}

/** The four states a yard actually sorts parts into, mapped to the server enum. */
const INTAKE_CONDITIONS = [
  { value: 'good', label: 'б/в' },
  { value: 'refurbished', label: 'після ремонту' },
  { value: 'new', label: 'нова' },
  { value: 'scrap', label: 'під відновлення' },
] as const

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
  const params = useParams<{ tenant: string }>()
  const base = `/app/${params.tenant ?? cabinet.targetTenant?.slug ?? ''}/intakes`
  const canPlace = allowedToView(cabinetModules.inventory, cabinet)
  const [values, setValues] = useState({
    name: '',
    partType: '',
    oemCode: '',
    condition: 'good',
    quantity: 1,
    unit: DEFAULT_UNIT,
    price: '',
    zoneId: '',
    notes: '',
  })
  const [media, setMedia] = useState<PickedPhoto[]>([])
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
        name: 'Вкажіть назву деталі, як її шукатимуть на складі — наприклад, «Бампер передній».',
      })
      return
    }
    setFieldErrors({})
    setBusy(true)
    try {
      const intakeScope = intakeMutation.requireLatestMutation({ quota: false })
      partMutation.requireLatestMutation({ permission: 'parts.view' })
      const request: AddIntakePartRequest = {
        name: values.name.trim(),
        partType: values.partType.trim() || null,
        condition: values.condition || null,
        quantity: values.quantity,
        unit: values.unit || null,
        notes: values.notes.trim() || null,
        photoKeys: await uploadPickedPhotos(media, 'parts', intakeScope.signal),
        ...(values.zoneId ? { inventoryZoneIds: [values.zoneId] } : {}),
      }
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
          unit: values.unit || DEFAULT_UNIT,
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
  const saveNote = named
    ? 'Деталь отримає QR-код і потрапить у це приймання.'
    : 'Вкажіть назву, щоб додати деталь.'

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={backTo}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            До приймання
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Склад</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>Приймання</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            aria-busy={busy}
            className="px-[18px] text-sm font-semibold"
            disabled={busy || !named}
            onClick={(event) => void save(event, true)}
          >
            Зберегти й додати ще
          </Button>
          <Button
            aria-busy={busy}
            className="px-5 text-sm font-bold"
            disabled={busy || !named}
            onClick={(event) => void save(event)}
            variant="primary"
          >
            Додати деталь
          </Button>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
            Додати деталь
          </h1>
          <p className="text-app-muted mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium">
            <span>
              Деталь у приймання{' '}
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
                  уже {intake.partsCount}{' '}
                  {plural(intake.partsCount, ['позиція', 'позиції', 'позицій'])}
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
            <FormCard step="01" title="Опис">
              <Field
                error={fieldErrors.name}
                hint="Назва, за якою деталь шукатимуть на складі"
                label="Назва"
                required
              >
                <TextInput
                  autoComplete="off"
                  name="name"
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="Наприклад: Фара права LED"
                  required
                  value={values.name}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Тип деталі">
                  <TextInput
                    autoComplete="off"
                    name="partType"
                    onChange={(event) => update('partType', event.target.value)}
                    placeholder="оптика, кузов, ходова"
                    value={values.partType}
                  />
                </Field>
                <Field
                  hint="Приймання поки не зберігає OEM — впишіть його на картці деталі"
                  label="OEM-код"
                >
                  <TextInput
                    className="font-mono"
                    disabled
                    name="oemCode"
                    placeholder="1RV-8820-02"
                    value=""
                  />
                </Field>
              </div>
              <Field label="Стан">
                <PillGroup
                  label="Стан деталі"
                  onChange={(next) => update('condition', next)}
                  options={INTAKE_CONDITIONS}
                  value={values.condition}
                />
              </Field>
            </FormCard>

            <FormCard
              description={
                unitCost === null
                  ? 'Собівартість позиції з’явиться, щойно приймання матиме ціну й позиції.'
                  : `Собівартість підтягується з партії — ${money(unitCost)} на одиницю.`
              }
              step="02"
              title="Кількість і ціна"
            >
              <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr]">
                <Field label="Кількість" required>
                  <QuantityStepper
                    label="Кількість деталей"
                    min={1}
                    onChange={(next) => update('quantity', next)}
                    value={values.quantity}
                  />
                </Field>
                <Field hint="шт, компл, кг" label="Одиниця">
                  <TextInput
                    autoComplete="off"
                    name="unit"
                    onChange={(event) => update('unit', event.target.value)}
                    value={values.unit}
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
                description="Можна вказати комірку зараз або розмістити партію пізніше."
                step="03"
                title="Розміщення"
              >
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Комірка">
                    <SelectInput
                      name="zoneId"
                      onChange={(event) => update('zoneId', event.target.value)}
                      value={values.zoneId}
                    >
                      <option value="">Без комірки</option>
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
                    title="Сканування комірки камерою ще не підключене до цієї форми"
                    type="button"
                  >
                    <ScanLine aria-hidden />
                    Сканувати
                  </Button>
                </div>
              </FormCard>
            ) : null}

            <FormCard step="03" title="Фото й нотатки">
              {canUploadMedia ? (
                <MediaPicker items={media} onChange={setMedia} />
              ) : null}
              <Field label="Нотатки">
                <TextArea
                  name="notes"
                  onChange={(event) => update('notes', event.target.value)}
                  placeholder="Дефекти, комплектність"
                  rows={2}
                  value={values.notes}
                />
              </Field>
            </FormCard>
          </div>

          <aside className="sticky top-24 grid min-w-[280px] flex-[0_0_320px] gap-5">
            <Card title="Нова позиція">
              <div className="border-app-line bg-app-input rounded-[14px] border p-4">
                <p
                  className={cn(
                    'text-[17px] font-bold tracking-[-0.015em]',
                    named ? 'text-white' : 'text-app-dim',
                  )}
                >
                  {named ? values.name : 'Назва деталі'}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusPill tone={zone ? 'ok' : 'warn'}>
                    {zone ? `Доступно · ${zone.code}` : 'Без комірки'}
                  </StatusPill>
                  <span className="text-app-muted font-mono text-[13px]">
                    {values.quantity} {values.unit || DEFAULT_UNIT}
                  </span>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                <dt className="text-app-muted text-sm font-semibold">
                  Собівартість
                </dt>
                <dd className="font-mono text-[16px] text-white tabular-nums">
                  {unitCost === null ? '—' : money(unitCost)}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">
                  Ціна продажу
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
                <dt className="text-[16px] font-bold text-white">Маржа</dt>
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
                Додати деталь
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
                title="Додані щойно"
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
                          {item.zone ?? 'без комірки'}
                        </span>
                      </span>
                      <span className="text-app-muted font-mono text-[14px] whitespace-nowrap">
                        {item.quantity} {item.unit}
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
  /** The batch price spread over what the intake will hold once this is booked. */
  const unitCost =
    intake && intake.totalCost !== null && intake.partsCount + filled.length > 0
      ? intake.totalCost / (intake.partsCount + filled.length)
      : null

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
        unit: DEFAULT_UNIT,
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
          `${normalizeApiProblem(error).message} Прийнято ${String(index)} з ${String(filled.length)} позицій — решта лишилася в таблиці.`,
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
    ? `Прийняти ${String(filled.length)} ${plural(filled.length, ['позицію', 'позиції', 'позицій'])}`
    : 'Прийняти партію'

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={backTo}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            До приймання
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Приймання</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span className="text-app-muted">Партією</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
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

      <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
            Приймання партією
          </h1>
          <p className="text-app-muted mt-3 text-[15px]">
            {[intake?.name, intake?.supplier].filter(Boolean).join(' · ')}
            {intake ? ' · ' : null}
            додавайте позиції рядками; собівартість розподілиться по всій
            партії.
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
              aria-label="Позиції партії"
              className="border-app-line bg-app-raised overflow-hidden rounded-[18px] border"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-[18px] pb-4">
                <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
                  Позиції партії
                </h2>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-app-muted font-mono text-[11px] tracking-[0.1em] uppercase">
                    {rows.length}{' '}
                    {plural(rows.length, ['рядок', 'рядки', 'рядків'])}
                  </span>
                  {canPlace ? (
                    <Button
                      className="min-h-9 px-3 text-xs font-semibold"
                      onClick={fillDown}
                      type="button"
                    >
                      Заповнити комірку вниз
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
                <span>Назва</span>
                <span className="text-right">К-сть</span>
                <span className="text-right">Ціна, $</span>
                {canPlace ? <span>Комірка</span> : null}
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
                      aria-label={`Назва позиції ${String(index + 1)}`}
                      autoComplete="off"
                      onChange={(event) =>
                        update(row.key, 'name', event.target.value)
                      }
                      placeholder={`${String(index + 1)} · назва запчастини`}
                      value={row.name}
                    />
                    <TextInput
                      aria-label={`Кількість у рядку ${String(index + 1)}`}
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
                        aria-label={`Комірка в рядку ${String(index + 1)}`}
                        onChange={(event) =>
                          update(row.key, 'zoneId', event.target.value)
                        }
                        value={row.zoneId}
                      >
                        <option value="">
                          {sharedZoneId === '' ? 'Без комірки' : 'Як у партії'}
                        </option>
                        {zones.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.code}
                          </option>
                        ))}
                      </SelectInput>
                    ) : null}
                    <Button
                      aria-label={`Прибрати рядок ${String(index + 1)}`}
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
                  Додати рядок
                </Button>
                <p className="text-app-dim text-[13px]">
                  Порожні рядки не зберігаються
                </p>
              </div>
            </section>

            <Card title="Спільні властивості">
              <p className="text-app-muted -mt-1 text-sm">
                Застосуються до всіх позицій без власного значення.
              </p>
              <PillGroup
                className="mt-4 w-fit"
                label="Стан позицій партії"
                onChange={setCondition}
                options={INTAKE_CONDITIONS}
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
                    Без комірки
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
            <Card title="Партія">
              <dl className="grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                <dt className="text-app-muted text-sm font-semibold">
                  Позицій
                </dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {filled.length}
                </dd>
                <dt className="text-app-muted text-sm font-semibold">
                  Одиниць
                </dt>
                <dd className="font-mono text-[15px] text-white tabular-nums">
                  {units}
                </dd>
                {canManageFinance ? (
                  <>
                    <dt className="text-app-muted text-sm font-semibold">
                      Сума за цінами
                    </dt>
                    <dd
                      className={cn(
                        'font-mono text-[15px] tabular-nums',
                        priceSum > 0 ? 'text-white' : 'text-app-dim',
                      )}
                    >
                      {priceSum > 0 ? money(priceSum) : '—'}
                    </dd>
                    <div className="bg-app-line col-span-2 my-1 h-px" />
                    <dt className="text-app-muted text-sm font-semibold">
                      Собівартість партії
                    </dt>
                    <dd className="font-mono text-[15px] text-white tabular-nums">
                      {intake?.totalCost === null ||
                      intake?.totalCost === undefined
                        ? '—'
                        : money(intake.totalCost)}
                    </dd>
                    <dt className="text-[15px] font-bold text-white">
                      На позицію
                    </dt>
                    <dd className="font-mono text-[19px] text-white tabular-nums">
                      {unitCost === null ? '—' : money(unitCost)}
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
                  ? `Прийнято ${String(saved)} з ${String(filled.length)} — не закривайте сторінку.`
                  : ready
                    ? 'Позиції отримають QR-коди й потраплять у це приймання.'
                    : 'Заповніть хоча б одну назву, щоб прийняти партію.'}
              </p>
            </Card>

            <Card title="Перевірка">
              <ul className="grid gap-2.5">
                {[
                  {
                    state: ready ? 'ok' : 'idle',
                    label: ready
                      ? `${String(filled.length)} ${plural(filled.length, ['позиція готова', 'позиції готові', 'позицій готові'])} до приймання`
                      : 'Жодної заповненої позиції',
                  },
                  ...(canPlace
                    ? [
                        {
                          state: withoutCell === 0 && ready ? 'ok' : 'warn',
                          label:
                            withoutCell === 0 && ready
                              ? 'Усі позиції мають комірку'
                              : `${String(withoutCell)} ${plural(withoutCell, ['позиція', 'позиції', 'позицій'])} без комірки — розмістите пізніше`,
                        },
                      ]
                    : []),
                  {
                    state: withoutPrice === 0 && ready ? 'ok' : 'warn',
                    label:
                      withoutPrice === 0 && ready
                        ? 'Ціни вказані'
                        : `${String(withoutPrice)} ${plural(withoutPrice, ['позиція', 'позиції', 'позицій'])} без ціни`,
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
