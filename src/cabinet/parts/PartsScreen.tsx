import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  ActionMenu,
  Amount,
  DateValue,
  FileField,
  Gallery,
  Quantity,
  Card,
  SectionPanel,
  PillGroup,
  QuantityStepper,
  SkeletonRows,
  SpecGrid,
  SpecNote,
  BulkBar,
  Button,
  ConfirmDialog,
  DataTable,
  FormDialog,
  EmptyState,
  ErrorState,
  Field,
  InlineEdit,
  Notice,
  PageBody,
  PageHeader,
  SelectInput,
  StatusPill,
  TextArea,
  TextInput,
  type NoticeTone,
} from '@/components/app'
import { cn, plural } from '@/lib/utils'
import {
  conditionFacetLabel,
  conditionLabel,
  historyDetails,
  historyLabel,
  originLabel,
  partStatusDot,
  partStatusPresentation,
  sourceLabel,
} from './part-labels'
import {
  partsApi,
  type PartCondition,
  type PartFacets,
  type PartOrigin,
  type PartSearchItem,
  type PartSearchRequest,
  type CreatePartRequest,
  type UpdatePartRequest,
  type PartDetail,
  type PartsSummary,
} from '@/api/parts'
import { carsApi, type CarListItem } from '@/api/cars'
import { intakesApi, type IntakeListItem } from '@/api/intakes'
import { mediaApi } from '@/api/media'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import {
  cabinetModules,
  type CabinetModuleDefinition,
} from '../module-registry'
import { evaluateModuleAccess, type ModuleAccessDecision } from '../policy'
import { normalizeApiProblem } from '@/api/errors'
import type { ApiProblem } from '@/api/contracts'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  isListDensity,
  readDensity,
  writeDensity,
  type ListDensity,
} from '../list-density'
import {
  readSavedViews,
  sameView,
  savedViewLimit,
  writeSavedViews,
  type SavedView,
  type SavedViewScope,
} from '../saved-views'

const partStatuses = new Set(['available', 'reserved', 'sold'])
/** Every group the filter panel draws; the server counts each one for us. */
const FACET_DIMENSIONS = [
  'status',
  'condition',
  'origin',
  'make',
  'model',
  'warehouse',
  'zone',
] as const
const positiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
const pageSizeParam = (value: string | null, fallback: number) => {
  const parsed = positiveInteger(value, fallback)
  return parsed <= 100 ? parsed : fallback
}

const optional = (value: string) => value.trim() || undefined
const optionalNumber = (value: string) =>
  value.trim() ? Number(value) : undefined
const normalizedIds = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
]

interface SourceOptions {
  cars: CarListItem[]
  intakes: IntakeListItem[]
  carsUnavailable: boolean
  intakesUnavailable: boolean
}

function useSourceOptions(
  loadCars: boolean,
  loadIntakes: boolean,
): SourceOptions {
  const [options, setOptions] = useState<SourceOptions>({
    cars: [],
    intakes: [],
    carsUnavailable: false,
    intakesUnavailable: false,
  })
  useEffect(() => {
    if (!loadCars) return
    const controller = new AbortController()
    void carsApi
      .list({ page: 1, pageSize: 100 }, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted)
            setOptions((current) => ({
              ...current,
              cars: page.items,
              carsUnavailable: false,
            }))
        },
        () => {
          if (!controller.signal.aborted)
            setOptions((current) => ({
              ...current,
              carsUnavailable: true,
            }))
        },
      )
    return () => controller.abort()
  }, [loadCars])
  useEffect(() => {
    if (!loadIntakes) return
    const controller = new AbortController()
    void intakesApi
      .list({ page: 1, pageSize: 100 }, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted)
            setOptions((current) => ({
              ...current,
              intakes: page.items,
              intakesUnavailable: false,
            }))
        },
        () => {
          if (!controller.signal.aborted)
            setOptions((current) => ({
              ...current,
              intakesUnavailable: true,
            }))
        },
      )
    return () => controller.abort()
  }, [loadIntakes])
  return options
}

const carLabel = (car: CarListItem) =>
  `${car.code} · ${car.brand} ${car.model} (${car.year})`
const intakeLabel = (intake: IntakeListItem) =>
  `${intake.name ?? 'Без назви'} · ${intake.supplier ?? 'Постачальника не вказано'}`

const accessState = (cabinet: ReturnType<typeof useCabinet>) =>
  cabinet.status === 'ready' && cabinet.snapshot
    ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
    : cabinet.status === 'error'
      ? { status: 'error' as const, snapshot: null, error: cabinet.error }
      : { status: 'loading' as const, snapshot: null, error: null }

const withoutQuota = (definition: CabinetModuleDefinition) => {
  const { quotaResource: _quotaResource, ...unmetered } = definition
  return unmetered
}

function AccessDenied({ decision }: { decision: ModuleAccessDecision }) {
  const message =
    decision.kind === 'quota-exhausted'
      ? 'Ліміт деталей вичерпано.'
      : decision.kind === 'subscription-blocked'
        ? 'Поточна підписка не дозволяє цю дію.'
        : decision.kind === 'access-loading'
          ? 'Перевіряємо доступ…'
          : decision.kind === 'access-error'
            ? 'Не вдалося перевірити доступ.'
            : 'Недостатньо прав.'
  return (
    <Notice role="alert" tone="warn">
      {message}
    </Notice>
  )
}

const allowedToView = (
  definition: CabinetModuleDefinition,
  cabinet: ReturnType<typeof useCabinet>,
) =>
  evaluateModuleAccess(
    { ...definition, released: true },
    accessState(cabinet),
    'view',
  ).kind === 'allowed'

export function PartsScreen({ definition }: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const navigate = useNavigate()
  const { partId } = useParams<{ partId: string }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<PartSearchItem[]>([])
  const [facets, setFacets] = useState<PartFacets | null>(null)
  const [summary, setSummary] = useState<PartsSummary | null>(null)
  const [pageMeta, setPageMeta] = useState<{
    page: number
    totalPages: number
  } | null>(null)
  const [detail, setDetail] = useState<PartDetail | null>(null)
  const [history, setHistory] = useState<Awaited<
    ReturnType<typeof partsApi.history>
  > | null>(null)
  // Holds why, not just whether: a dead network and a broken server ask for
  // different words, and only one of them is worth retrying right now.
  const [error, setError] = useState<ApiProblem | null>(null)
  const isNew = location.pathname.endsWith('/new')
  const isEdit = location.pathname.endsWith('/edit')
  const createDecision = evaluateModuleAccess(
    definition,
    accessState(cabinet),
    'mutation',
  )
  const manageDecision = evaluateModuleAccess(
    withoutQuota(definition),
    accessState(cabinet),
    'mutation',
  )
  const canManage = manageDecision.kind === 'allowed'

  // A working set, not a highlight: what is ticked here is what the next action
  // runs on. It is dropped whenever the query changes, so an action can never
  // reach a row the current filter no longer shows.
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())
  const [pickedFor, setPickedFor] = useState<PartSearchRequest | null>(null)
  const [asking, setAsking] = useState<'price' | 'delete' | null>(null)
  const [bulkPrice, setBulkPrice] = useState('')
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [bulkResult, setBulkResult] = useState<{
    tone: NoticeTone
    text: string
  } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const viewUserId = cabinet.snapshot?.userId ?? null
  const viewTenantId = cabinet.targetTenant?.id ?? null
  const viewScope = useMemo<SavedViewScope | null>(
    () =>
      viewUserId && viewTenantId
        ? { userId: viewUserId, tenantId: viewTenantId, screen: 'parts' }
        : null,
    [viewUserId, viewTenantId],
  )
  // Keyed on the identifiers rather than the object, so a fresh context object
  // on every render does not read storage again — or loop.
  const viewKey = `${viewUserId ?? ''}:${viewTenantId ?? ''}`
  const [views, setViews] = useState<SavedView[]>([])
  const [viewsFor, setViewsFor] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [density, setDensity] = useState<ListDensity>('comfortable')
  const [densityFor, setDensityFor] = useState<string | null>(null)
  if (densityFor !== viewKey) {
    setDensityFor(viewKey)
    setDensity(readDensity(viewScope))
  }
  const [viewName, setViewName] = useState('')
  if (viewsFor !== viewKey) {
    setViewsFor(viewKey)
    setViews(viewScope ? readSavedViews(viewScope) : [])
  }
  const links = {
    cars: allowedToView(cabinetModules.cars, cabinet),
    intakes: allowedToView(cabinetModules.intakes, cabinet),
    orders: allowedToView(cabinetModules.orders, cabinet),
    inventory: allowedToView(cabinetModules.inventory, cabinet),
    stickers: allowedToView(cabinetModules.stickers, cabinet),
  }
  const filters = useMemo(() => {
    const one = (name: string) => searchParams.get(name)?.trim() ?? ''
    const status = one('status')
    return {
      q: one('q'),
      status: partStatuses.has(status) ? status : '',
      condition: one('condition'),
      origin: one('origin'),
      makeId: one('make'),
      modelId: one('model'),
      warehouseId: one('warehouse'),
      zoneId: one('zone'),
      page: positiveInteger(searchParams.get('page'), 1),
      pageSize: pageSizeParam(searchParams.get('per_page'), 30),
      carIds: normalizedIds(searchParams.getAll('car_ids')),
      intakeIds: normalizedIds(searchParams.getAll('intake_ids')),
    }
  }, [searchParams])

  /** The screen's URL, said the way the search endpoint wants to hear it. */
  const searchRequest = useMemo<PartSearchRequest>(
    () => ({
      ...(filters.q ? { query: filters.q } : {}),
      ...(filters.status ? { statuses: [filters.status] } : {}),
      ...(filters.condition
        ? { conditions: [filters.condition as PartCondition] }
        : {}),
      ...(filters.origin
        ? { originTypes: [filters.origin as PartOrigin] }
        : {}),
      ...(filters.warehouseId ? { warehouseIds: [filters.warehouseId] } : {}),
      ...(filters.zoneId ? { zoneIds: [filters.zoneId] } : {}),
      ...(filters.carIds.length > 0 ? { carIds: filters.carIds } : {}),
      ...(filters.makeId || filters.modelId
        ? {
            compatibility: {
              ...(filters.makeId ? { makeIds: [filters.makeId] } : {}),
              ...(filters.modelId ? { modelIds: [filters.modelId] } : {}),
            },
          }
        : {}),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    [filters],
  )

  // A new query is a new set of rows, so the working set starts over with it.
  // Adjusting during render rather than in an effect keeps the list from
  // painting once with a selection that belongs to the previous query.
  if (pickedFor !== searchRequest) {
    setPickedFor(searchRequest)
    if (picked.size > 0) setPicked(new Set())
  }

  useEffect(() => {
    if (partId || isNew) return
    const next = new URLSearchParams(searchParams)
    for (const name of [
      'q',
      'condition',
      'origin',
      'make',
      'model',
      'warehouse',
      'zone',
    ] as const) {
      const raw = searchParams.get(name)
      if (raw === null) continue
      const trimmed = raw.trim()
      if (trimmed) next.set(name, trimmed)
      else next.delete(name)
    }
    const rawStatus = searchParams.get('status')
    if (rawStatus !== null && !partStatuses.has(rawStatus))
      next.delete('status')
    const rawPage = searchParams.get('page')
    if (rawPage !== null && String(filters.page) !== rawPage)
      next.set('page', String(filters.page))
    const rawPageSize = searchParams.get('per_page')
    if (rawPageSize !== null && String(filters.pageSize) !== rawPageSize)
      next.set('per_page', String(filters.pageSize))
    for (const [name, values] of [
      ['car_ids', filters.carIds],
      ['intake_ids', filters.intakeIds],
    ] as const) {
      const rawValues = searchParams.getAll(name)
      if (
        rawValues.length === values.length &&
        rawValues.every((value, index) => value === values[index])
      )
        continue
      next.delete(name)
      values.forEach((value) => next.append(name, value))
    }
    if (next.toString() !== searchParams.toString())
      setSearchParams(next, { replace: true })
  }, [filters, isNew, partId, searchParams, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()
    if (partId && !isEdit) {
      void Promise.all([
        partsApi.get(partId, { signal: controller.signal }),
        partsApi.history(partId, { signal: controller.signal }),
      ])
        .then(([result, nextHistory]) => {
          if (controller.signal.aborted) return
          setDetail(result)
          setHistory(nextHistory)
          setError(null)
        })
        .catch((failure: unknown) => {
          if (!controller.signal.aborted) setError(normalizeApiProblem(failure))
        })
      return () => controller.abort()
    }
    if (!partId && !isNew) {
      void Promise.all([
        partsApi.search(searchRequest, { signal: controller.signal }),
        partsApi.facets(searchRequest, FACET_DIMENSIONS, {
          signal: controller.signal,
        }),
        partsApi.summary({ signal: controller.signal }),
      ])
        .then(([page, nextFacets, nextSummary]) => {
          if (controller.signal.aborted) return
          setItems(page.items)
          setPageMeta({ page: page.page, totalPages: page.totalPages })
          setFacets(nextFacets)
          setSummary(nextSummary)
          setError(null)
        })
        .catch((failure: unknown) => {
          if (!controller.signal.aborted) setError(normalizeApiProblem(failure))
        })
    }
    return () => controller.abort()
  }, [isEdit, isNew, partId, reloadToken, searchRequest])

  if (isNew && createDecision.kind !== 'allowed')
    return <AccessDenied decision={createDecision} />
  if (isEdit && manageDecision.kind !== 'allowed')
    return <AccessDenied decision={manageDecision} />
  if (isNew)
    return (
      <PartForm
        canViewCars={links.cars}
        canViewIntakes={links.intakes}
        requireLatestMutation={requireLatestMutation}
        title="Нова деталь"
      />
    )
  if (isEdit && partId)
    return (
      <PartEdit
        canViewCars={links.cars}
        canViewIntakes={links.intakes}
        partId={partId}
        requireLatestMutation={requireLatestMutation}
      />
    )
  if (partId)
    return (
      <PartDetailScreen
        detail={detail}
        history={history}
        error={error !== null}
        partId={partId}
        canManage={canManage}
        links={links}
        requireLatestMutation={requireLatestMutation}
        tenantSlug={cabinet.targetTenant?.slug ?? ''}
      />
    )

  /** Counts arrive per dimension; a value with no row simply has none. */
  const facetCount = (dimension: keyof PartFacets, id: string) =>
    facets?.[dimension].find((value) => value.id === id)?.count
  const facetTotal = (dimension: keyof PartFacets) =>
    facets === null
      ? undefined
      : facets[dimension].reduce((sum, value) => sum + value.count, 0)
  const facetOptions = (dimension: keyof PartFacets) =>
    (facets?.[dimension] ?? []).map((value) => (
      <option key={value.id} value={value.id}>
        {value.name} ({value.count})
      </option>
    ))
  const statusTotal = facetTotal('statuses')

  const updatePage = (page: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }
  const updateFilter = (name: string, value: string, list = false) => {
    const next = new URLSearchParams(searchParams)
    next.delete(name)
    if (list) {
      normalizedIds(value.split(',')).forEach((entry) =>
        next.append(name, entry),
      )
    } else if (value.trim()) {
      next.set(name, value.trim())
    }
    next.delete('page')
    setSearchParams(next)
  }
  /** Which filters are on, so the reset button knows whether it has work. */
  const activeFilters: string[] = (
    [
      ['q', filters.q],
      ['status', filters.status],
      ['condition', filters.condition],
      ['origin', filters.origin],
      ['make', filters.makeId],
      ['model', filters.modelId],
      ['warehouse', filters.warehouseId],
      ['zone', filters.zoneId],
    ] as const
  )
    .filter(([, value]) => value !== '')
    .map(([key]) => String(key))
    .concat(filters.carIds.length > 0 ? ['car_ids'] : [])
    .concat(filters.intakeIds.length > 0 ? ['intake_ids'] : [])

  const currentQuery = searchParams.toString()
  const activeView = views.find((view) => sameView(view.query, currentQuery))
  const applyView = (view: SavedView) => {
    setSearchParams(new URLSearchParams(view.query))
  }
  const saveCurrentView = () => {
    const name = viewName.trim()
    if (!viewScope || name === '' || views.length >= savedViewLimit) return
    const next = [
      ...views.filter((view) => view.name !== name),
      { id: `${Date.now().toString(36)}-${name}`, name, query: currentQuery },
    ]
    setViews(next)
    writeSavedViews(viewScope, next)
    setNaming(false)
    setViewName('')
  }
  const forgetView = (id: string) => {
    const next = views.filter((view) => view.id !== id)
    setViews(next)
    if (viewScope) writeSavedViews(viewScope, next)
  }

  /**
   * Edits one field of one part in place. PUT /parts/{id} replaces the record,
   * so the current one is read first and written back whole with the single
   * change applied — the same reason the bulk price change reads first.
   * Returns the message to show in the cell, or null when it went through.
   */
  const rewritePart = async (
    id: string,
    change: (current: UpdatePartRequest) => UpdatePartRequest | string,
  ): Promise<string | null> => {
    try {
      const scope = requireLatestMutation({ quota: false })
      const current = await partsApi.get(id, { signal: scope.signal })
      const next = change({
        name: current.name,
        condition: current.condition,
        notes: current.notes,
        quantity: current.quantityTotal,
        partType: current.partType,
        unit: current.unit,
        photoKeys: current.photos.map((photo) => photo.storageKey),
        desiredSalePrice: { isSet: false },
      })
      if (typeof next === 'string') return next
      await partsApi.update(id, next, { signal: scope.signal })
      setReloadToken((value) => value + 1)
      return null
    } catch {
      return 'Не вдалося зберегти. Спробуйте ще раз.'
    }
  }

  const pickedIds = [...picked]
  const pickedNoun = plural(pickedIds.length, ['деталь', 'деталі', 'деталей'])

  /**
   * Runs one request per part and keeps counting when one of them fails, so a
   * single bad row does not hide the twenty-nine that worked. The report says
   * how many went through and how many did not.
   */
  const runOverPicked = async (
    ids: readonly string[],
    each: (id: string, signal: AbortSignal) => Promise<unknown>,
    done: (ok: number, failed: number) => { tone: NoticeTone; text: string },
  ) => {
    if (ids.length === 0 || progress !== null) return
    setAsking(null)
    setBulkResult(null)
    setProgress({ done: 0, total: ids.length })
    let ok = 0
    let failed = 0
    for (const [index, id] of ids.entries()) {
      try {
        const scope = requireLatestMutation({ quota: false })
        await each(id, scope.signal)
        ok += 1
      } catch {
        failed += 1
      }
      setProgress({ done: index + 1, total: ids.length })
    }
    setProgress(null)
    setPicked(new Set())
    setBulkResult(done(ok, failed))
    setReloadToken((value) => value + 1)
  }

  const setPickedPrice = () => {
    const value = bulkPrice.trim() === '' ? null : Number(bulkPrice.trim())
    if (value !== null && (!Number.isFinite(value) || value < 0)) return
    void runOverPicked(
      pickedIds,
      async (id, signal) => {
        // PUT /parts/{id} replaces the record and only the price carries an
        // is-set wrapper, so sending the price alone would clear the name,
        // notes, photos and quantity. Each part is read back first and written
        // whole, with the price as the single difference.
        const current = await partsApi.get(id, { signal })
        await partsApi.update(
          id,
          {
            name: current.name,
            condition: current.condition,
            notes: current.notes,
            quantity: current.quantityTotal,
            partType: current.partType,
            unit: current.unit,
            photoKeys: current.photos.map((photo) => photo.storageKey),
            desiredSalePrice: { isSet: true, value },
          },
          { signal },
        )
      },
      (ok, failed) =>
        failed === 0
          ? {
              tone: 'ok',
              text: `Ціну змінено на ${String(ok)} ${plural(ok, ['деталі', 'деталях', 'деталях'])}.`,
            }
          : {
              tone: 'warn',
              text: `Ціну змінено на ${String(ok)} з ${String(ok + failed)}. Решту не вдалося зберегти.`,
            },
    )
  }

  const deletePicked = () => {
    void runOverPicked(
      pickedIds,
      (id, signal) => partsApi.delete(id, { signal }),
      (ok, failed) =>
        failed === 0
          ? {
              tone: 'ok',
              text: `Видалено ${String(ok)} ${plural(ok, ['деталь', 'деталі', 'деталей'])}.`,
            }
          : {
              tone: 'warn',
              text: `Видалено ${String(ok)} з ${String(ok + failed)}. Решта лишилася — деталь у замовленні видалити не можна.`,
            },
    )
  }

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
              Склад
            </p>
            <h1 className="mt-1.5 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
              Деталі
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {manageDecision.kind === 'allowed' ? (
              <Button asChild>
                <Link to="imports">Імпорт запчастин</Link>
              </Button>
            ) : null}
            {createDecision.kind === 'allowed' ? (
              <Button
                asChild
                className="px-5 text-sm font-bold"
                variant="primary"
              >
                <Link to="new">
                  <Plus aria-hidden />
                  Додати деталь
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <span className="border-app-line bg-app-raised focus-within:border-app-line-2 flex h-13 items-center gap-3 rounded-[14px] border px-4">
          <Search aria-hidden className="text-app-dim size-4 shrink-0" />
          <input
            aria-label="Пошук деталей"
            className="text-app-ink placeholder:text-app-dim min-w-0 flex-1 bg-transparent text-sm outline-none"
            name="q"
            onChange={(event) => updateFilter('q', event.target.value)}
            placeholder="Пошук: назва, OEM або QR"
            value={filters.q ?? ''}
          />
        </span>

        <div className="flex flex-wrap items-start gap-6">
          <aside className="border-app-line bg-app-raised grid min-w-0 flex-[0_1_320px] gap-6 rounded-[20px] border p-5 sm:min-w-[260px]">
            {viewScope === null ? null : (
              <FilterGroup label="Мої подання">
                {views.length === 0 ? (
                  <p className="text-app-dim text-[13px] leading-5">
                    Наберіть фільтри, які ставите щодня, і збережіть їх — вони
                    лишаться на цьому пристрої.
                  </p>
                ) : (
                  <ul className="grid gap-1.5">
                    {views.map((view) => (
                      <li className="flex items-center gap-1.5" key={view.id}>
                        <button
                          aria-pressed={activeView?.id === view.id}
                          className={cn(
                            'focus-visible:outline-brand min-h-10 min-w-0 flex-1 truncate rounded-[10px] px-3 text-left text-sm transition-colors',
                            activeView?.id === view.id
                              ? 'bg-app-input font-semibold text-white'
                              : 'text-app-muted hover:bg-white/[0.03] hover:text-app-ink',
                          )}
                          onClick={() => applyView(view)}
                          type="button"
                        >
                          {view.name}
                        </button>
                        <Button
                          aria-label={`Забути подання: ${view.name}`}
                          onClick={() => forgetView(view.id)}
                          size="icon"
                        >
                          <X aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  className="w-full text-sm font-semibold"
                  disabled={
                    views.length >= savedViewLimit || activeView !== undefined
                  }
                  onClick={() => {
                    setViewName('')
                    setNaming(true)
                  }}
                  {...(views.length >= savedViewLimit
                    ? {
                        title: `Більше ${String(savedViewLimit)} подань на цей список не зберігається.`,
                      }
                    : activeView !== undefined
                      ? { title: 'Ці фільтри вже збережені.' }
                      : {})}
                >
                  Зберегти ці фільтри
                </Button>
              </FilterGroup>
            )}

            <FilterGroup label="Статус">
              <FilterRow
                active={filters.status === ''}
                count={statusTotal}
                dot="bg-app-dim"
                label="Усі"
                onSelect={() => updateFilter('status', '')}
              />
              {[
                {
                  value: 'available',
                  label: 'В наявності',
                  dot: partStatusDot.available,
                },
                {
                  value: 'reserved',
                  label: 'У резерві',
                  dot: partStatusDot.reserved,
                },
                { value: 'sold', label: 'Продано', dot: partStatusDot.sold },
              ].map((option) => (
                <FilterRow
                  active={filters.status === option.value}
                  count={facetCount('statuses', option.value)}
                  dot={option.dot}
                  key={option.value}
                  label={option.label}
                  onSelect={() => updateFilter('status', option.value)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Сумісність">
              <SelectInput
                aria-label="Марка"
                name="make"
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams)
                  if (event.target.value) next.set('make', event.target.value)
                  else next.delete('make')
                  next.delete('model')
                  next.delete('page')
                  setSearchParams(next)
                }}
                value={filters.makeId}
              >
                <option value="">Марка: будь-яка</option>
                {facetOptions('makes')}
              </SelectInput>
              <SelectInput
                aria-label="Модель"
                className={filters.makeId ? undefined : 'opacity-55'}
                disabled={!filters.makeId}
                name="model"
                onChange={(event) => updateFilter('model', event.target.value)}
                title={
                  filters.makeId
                    ? undefined
                    : 'Спершу оберіть марку автомобіля.'
                }
                value={filters.modelId}
              >
                <option value="">└ Модель: будь-яка</option>
                {facetOptions('models')}
              </SelectInput>
            </FilterGroup>

            <FilterGroup label="Розміщення">
              <SelectInput
                aria-label="Склад"
                name="warehouse"
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams)
                  if (event.target.value)
                    next.set('warehouse', event.target.value)
                  else next.delete('warehouse')
                  next.delete('zone')
                  next.delete('page')
                  setSearchParams(next)
                }}
                value={filters.warehouseId}
              >
                <option value="">Склад: усі</option>
                {facetOptions('warehouses')}
              </SelectInput>
              <SelectInput
                aria-label="Зона"
                className={filters.warehouseId ? undefined : 'opacity-55'}
                disabled={!filters.warehouseId}
                name="zone"
                onChange={(event) => updateFilter('zone', event.target.value)}
                title={
                  filters.warehouseId ? undefined : 'Спершу оберіть склад.'
                }
                value={filters.zoneId}
              >
                <option value="">└ Зона: усі</option>
                {facetOptions('zones')}
              </SelectInput>
            </FilterGroup>

            <FilterGroup label="Стан деталі">
              <FilterRow
                active={filters.condition === ''}
                count={facetTotal('conditions')}
                dot="bg-transparent"
                label="Усі"
                onSelect={() => updateFilter('condition', '')}
              />
              {(facets?.conditions ?? []).map((value) => (
                <FilterRow
                  active={filters.condition === value.id}
                  count={value.count}
                  dot="bg-transparent"
                  key={value.id}
                  label={conditionFacetLabel(value.id, value.name)}
                  onSelect={() => updateFilter('condition', value.id)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Походження">
              <FilterRow
                active={filters.origin === ''}
                count={facetTotal('origins')}
                dot="bg-transparent"
                label="Усі"
                onSelect={() => updateFilter('origin', '')}
              />
              {(facets?.origins ?? []).map((value) => (
                <FilterRow
                  active={filters.origin === value.id}
                  count={value.count}
                  dot="bg-transparent"
                  key={value.id}
                  label={originLabel(value.id, value.name)}
                  onSelect={() => updateFilter('origin', value.id)}
                />
              ))}
            </FilterGroup>

            <Button
              className="w-full text-sm font-semibold"
              disabled={activeFilters.length === 0}
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Скинути фільтри
            </Button>
          </aside>

          <div className="grid min-w-0 flex-[1_1_320px] gap-4">
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
              <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="text-app-muted flex items-baseline gap-2 text-sm">
                  <span className="text-[22px] font-bold text-white tabular-nums">
                    {summary?.total ?? 0}
                  </span>
                  усього
                </span>
                <span className="text-app-muted flex items-baseline gap-2 text-sm">
                  <span className="text-state-ok text-[22px] font-bold tabular-nums">
                    {summary?.available ?? 0}
                  </span>
                  доступно
                </span>
                <span className="text-app-muted flex items-baseline gap-2 text-sm">
                  <span className="text-state-warn text-[22px] font-bold tabular-nums">
                    {summary?.reserved ?? 0}
                  </span>
                  у резерві
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-app-dim font-mono text-[11px] tracking-[0.14em] uppercase">
                  Розмір сторінки
                </span>
                <PillGroup
                  label="Кількість деталей на сторінці"
                  onChange={(next) => updateFilter('per_page', next)}
                  options={[
                    { value: '30', label: '30' },
                    { value: '60', label: '60' },
                    { value: '100', label: '100' },
                  ]}
                  value={String(filters.pageSize)}
                />
                <span className="text-app-dim hidden font-mono text-[11px] tracking-[0.14em] uppercase md:inline">
                  Рядки
                </span>
                <PillGroup
                  className="hidden md:inline-flex"
                  label="Щільність рядків"
                  onChange={(next) => {
                    if (!isListDensity(next)) return
                    setDensity(next)
                    writeDensity(viewScope, next)
                  }}
                  options={[
                    { value: 'comfortable', label: 'Просторо' },
                    { value: 'compact', label: 'Щільно' },
                  ]}
                  value={density}
                />
              </div>
            </div>

            {error ? (
              <ErrorState
                description={
                  error.kind === 'network' || error.kind === 'timeout'
                    ? 'Немає звʼязку з мережею. Фільтри лишилися на місці — повторіть, коли звʼязок повернеться.'
                    : 'Не вдалося завантажити склад. Дані на місці — потрібно лише повторити запит.'
                }
                onRetry={() =>
                  setSearchParams(new URLSearchParams(searchParams))
                }
                title={
                  error.kind === 'network' || error.kind === 'timeout'
                    ? 'Склад не відповідає'
                    : 'Склад не завантажився'
                }
              />
            ) : (
              <>
                {bulkResult === null ? null : (
                  <Notice tone={bulkResult.tone}>{bulkResult.text}</Notice>
                )}
                {picked.size === 0 ? null : (
                  <BulkBar
                    actions={[
                      {
                        key: 'stickers',
                        label: 'Надрукувати стікери',
                        onRun: () => {
                          const query = new URLSearchParams()
                          for (const id of pickedIds) query.append('part', id)
                          void navigate(`../stickers?${query.toString()}`)
                        },
                        ...(links.stickers
                          ? {}
                          : {
                              unavailable: 'Немає доступу до модуля «Стікери».',
                            }),
                      },
                      {
                        key: 'price',
                        label: 'Змінити бажану ціну',
                        onRun: () => {
                          setBulkPrice('')
                          setAsking('price')
                        },
                        ...(canManage
                          ? {}
                          : { unavailable: 'Немає права змінювати деталі.' }),
                      },
                      {
                        key: 'sold',
                        label: 'Перевести в «Продано»',
                        onRun: () => undefined,
                        unavailable:
                          'Статус деталі рахується з залишку й замовлень — окремо його виставити не можна.',
                      },
                      {
                        key: 'archive',
                        label: 'Архівувати',
                        onRun: () => undefined,
                        unavailable:
                          'Деталь не можна архівувати: в API є лише видалення.',
                      },
                      {
                        key: 'delete',
                        label: 'Видалити',
                        onRun: () => {
                          setAsking('delete')
                        },
                        tone: 'danger',
                        ...(canManage
                          ? {}
                          : { unavailable: 'Немає права видаляти деталі.' }),
                      },
                    ]}
                    count={picked.size}
                    noun={pickedNoun}
                    onClear={() => setPicked(new Set())}
                    onSelectPage={() =>
                      setPicked(new Set(items.map((part) => part.id)))
                    }
                    pageCount={items.length}
                    {...(progress === null
                      ? {}
                      : {
                          busy: (
                            <span className="text-app-muted text-sm tabular-nums">
                              {progress.done} з {progress.total}
                            </span>
                          ),
                        })}
                  />
                )}
                <div className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border">
                  <DataTable
                    caption="Деталі на складі"
                    density={density}
                    selection={{
                      selected: picked,
                      onChange: setPicked,
                      rowLabel: (part) => `Обрати: ${part.name}`,
                    }}
                    columns={[
                      {
                        key: 'name',
                        label: 'Деталь',
                        variant: 'primary',
                        cell: (part) => (
                          <Link
                            className="hover:text-brand block font-semibold"
                            to={part.id}
                          >
                            {part.name}
                          </Link>
                        ),
                      },
                      {
                        key: 'car',
                        label: 'Авто-джерело',
                        cell: (part) =>
                          part.car
                            ? `${part.car.make} ${part.car.model} · ${String(part.car.year)}`
                            : '—',
                      },
                      {
                        key: 'status',
                        label: 'Стан',
                        cell: (part) => {
                          const presentation = partStatusPresentation(
                            part.status ?? '',
                          )
                          return presentation.label === '' ? (
                            '—'
                          ) : (
                            <StatusPill tone={presentation.tone}>
                              {presentation.label}
                            </StatusPill>
                          )
                        },
                      },
                      {
                        key: 'quantity',
                        label: 'Всього',
                        align: 'end',
                        cell: (part) => (
                          <InlineEdit
                            inputMode="numeric"
                            label={`Кількість — ${part.name}`}
                            onCommit={(next) =>
                              rewritePart(part.id, (current) => {
                                const quantity = Number(next.trim())
                                return Number.isInteger(quantity) &&
                                  quantity >= 0
                                  ? { ...current, quantity }
                                  : 'Кількість — ціле число від нуля.'
                              })
                            }
                            value={String(part.quantity)}
                            {...(canManage
                              ? {}
                              : {
                                  unavailable: 'Немає права змінювати деталі.',
                                })}
                            {...(part.isInventoryLocked
                              ? {
                                  unavailable:
                                    'Деталь у відкритій інвентаризації — кількість рахує сесія.',
                                }
                              : {})}
                          >
                            {part.quantity}
                          </InlineEdit>
                        ),
                      },
                      {
                        key: 'available',
                        label: 'Доступно',
                        align: 'end',
                        cell: (part) => part.quantityAvailable,
                      },
                      {
                        key: 'reserved',
                        label: 'Резерв',
                        align: 'end',
                        cell: (part) => part.quantityReserved,
                      },
                    ]}
                    empty={
                      <EmptyState
                        description={
                          activeFilters.length > 0
                            ? 'За цими фільтрами нічого немає. Спробуйте прибрати частину умов.'
                            : 'Додайте першу деталь або розберіть авто — позиції з’являться тут.'
                        }
                        title={
                          activeFilters.length > 0
                            ? 'Нічого не знайдено'
                            : 'Тут поки порожньо'
                        }
                      />
                    }
                    footer={
                      pageMeta ? (
                        <nav
                          aria-label="Пагінація деталей"
                          className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4"
                        >
                          <p className="text-app-dim text-[14px]">
                            Сторінка {pageMeta.page} з {pageMeta.totalPages}
                          </p>
                          <span className="flex items-center gap-2.5">
                            <Button
                              aria-label="Попередня сторінка"
                              className="px-4 text-sm font-semibold"
                              disabled={pageMeta.page <= 1}
                              onClick={() => updatePage(pageMeta.page - 1)}
                            >
                              <ChevronLeft aria-hidden />
                              Назад
                            </Button>
                            <Button
                              aria-label="Наступна сторінка"
                              className="px-4 text-sm font-semibold"
                              disabled={pageMeta.page >= pageMeta.totalPages}
                              onClick={() => updatePage(pageMeta.page + 1)}
                            >
                              Далі
                              <ChevronRight aria-hidden />
                            </Button>
                          </span>
                        </nav>
                      ) : null
                    }
                    rowKey={(part) => part.id}
                    rows={items}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <FormDialog
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
        onSubmit={(event) => {
          event.preventDefault()
          setPickedPrice()
        }}
        open={asking === 'price'}
        submitLabel="Змінити ціну"
        title={`Бажана ціна для ${String(pickedIds.length)} ${pickedNoun}`}
      >
        <Field
          hint="Порожнє поле прибирає бажану ціну. Ціна продажу від цього не змінюється."
          label="Бажана ціна, USD"
        >
          <TextInput
            inputMode="decimal"
            onChange={(event) => setBulkPrice(event.target.value)}
            value={bulkPrice}
          />
        </Field>
      </FormDialog>

      <FormDialog
        description="Подання зберігає поточні фільтри разом із пошуком. Воно лишається в цьому браузері — на іншому пристрої його не буде."
        onOpenChange={(open) => {
          if (!open) setNaming(false)
        }}
        onSubmit={(event) => {
          event.preventDefault()
          saveCurrentView()
        }}
        open={naming}
        submitDisabled={viewName.trim() === ''}
        submitLabel="Зберегти"
        title="Назвіть подання"
      >
        <Field
          hint="Назвіть його так, як ви це питаєте вголос: «Резерв понад тиждень»."
          label="Назва подання"
        >
          <TextInput
            maxLength={60}
            onChange={(event) => setViewName(event.target.value)}
            value={viewName}
          />
        </Field>
      </FormDialog>

      <ConfirmDialog
        confirmLabel="Видалити"
        consequence={`Буде видалено ${String(pickedIds.length)} ${pickedNoun}. Ті, що стоять у замовленнях, лишаться — про них буде сказано окремо.`}
        onConfirm={deletePicked}
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
        open={asking === 'delete'}
        destructive
        title="Видалити обрані деталі?"
      />
    </div>
  )
}

/** A titled block of the filter rail. */
function FilterGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section aria-label={label} className="grid gap-2.5">
      <h2 className="text-app-dim font-mono text-[11px] tracking-[0.14em] uppercase">
        {label}
      </h2>
      {children}
    </section>
  )
}

/**
 * One value of a filter, with how many records carry it. The count is the
 * point: it says whether the click is worth making before it is made.
 */
function FilterRow({
  label,
  count,
  dot,
  active,
  disabled = false,
  hint,
  onSelect,
}: {
  label: string
  count?: number | undefined
  /** Colour class of the state this row stands for. */
  dot: string
  active: boolean
  /** The list endpoint cannot filter by this yet. */
  disabled?: boolean
  /** Said out loud by assistive technology when the row is out of reach. */
  hint?: string
  onSelect: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'focus-visible:outline-brand flex min-h-10 w-full items-center justify-between gap-3 rounded-[10px] px-3 text-sm transition-colors',
        disabled
          ? 'text-app-dim cursor-not-allowed opacity-55'
          : active
            ? 'bg-app-input cursor-pointer font-semibold text-white'
            : 'text-app-muted hover:bg-white/[0.03] hover:text-app-ink cursor-pointer',
      )}
      disabled={disabled}
      onClick={onSelect}
      title={hint}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', dot)}
        />
        <span className="truncate">{label}</span>
      </span>
      {count === undefined ? null : (
        <span
          className={cn(
            'text-[14px] tabular-nums',
            active ? 'text-white' : 'text-app-dim',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * Parts are priced in dollars, like the cars they are pulled off: the contract
 * sends bare numbers, so the currency is stated here until it carries one.
 */
const PART_CURRENCY = 'USD'

/** The conditions the yard sorts by, in the server's own vocabulary. */
const PART_CONDITIONS = [
  { value: 'good', label: 'б/в' },
  { value: 'refurbished', label: 'після ремонту' },
  { value: 'new', label: 'нова' },
  { value: 'scrap', label: 'під відновлення' },
] as const

/** Two letters standing in for a person where a photo would be. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '—'

/** The three states a quantity can be in, with the colour each one owns. */
const stockSegments = (available: number, reserved: number, sold: number) => [
  {
    key: 'available',
    label: 'Доступно',
    value: available,
    fill: 'bg-state-ok',
    ink: 'text-state-ok',
  },
  {
    key: 'reserved',
    label: 'У резерві',
    value: reserved,
    fill: 'bg-state-warn',
    ink: 'text-state-warn',
  },
  {
    key: 'sold',
    label: 'Продано',
    value: sold,
    fill: 'bg-app-line-2',
    ink: 'text-app-dim',
  },
]

/**
 * The stock figures beside the title, where they answer the question people
 * open a part for — how much of it can still be sold — before anything has to
 * be scrolled. Zero is greyed rather than hidden: a part with nothing reserved
 * and nothing sold should say so.
 */
function StockStats({
  available,
  reserved,
  sold,
  unit,
}: {
  available: number
  reserved: number
  sold: number
  unit: string | null
}) {
  return (
    <dl className="border-app-line bg-app-raised grid grid-cols-3 gap-x-8 gap-y-3 rounded-[16px] border px-7 py-5">
      {stockSegments(available, reserved, sold).map((segment) => (
        <div className="grid gap-2" key={segment.key}>
          <dt
            className={cn(
              'flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] whitespace-nowrap uppercase',
              segment.value > 0 ? segment.ink : 'text-app-dim',
            )}
          >
            <span
              aria-hidden
              className={cn('size-1.5 rounded-full', segment.fill)}
            />
            {segment.label}
          </dt>
          <dd
            className={cn(
              'flex items-baseline gap-1.5 text-[30px] leading-none font-bold tracking-[-0.02em] tabular-nums',
              segment.value > 0 ? 'text-white' : 'text-app-dim',
            )}
          >
            {segment.value}
            <span
              className={cn(
                'text-[16px] font-semibold',
                segment.value > 0 ? 'text-app-muted' : 'text-app-dim',
              )}
            >
              {unit ?? 'шт'}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The same split as a bar. Decoration on purpose: the figures above carry the
 * numbers, so this only has to show the proportion at a glance.
 */
function StockBar({
  available,
  reserved,
  sold,
}: {
  available: number
  reserved: number
  sold: number
}) {
  const segments = stockSegments(available, reserved, sold)
  const scale = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (scale === 0) return null

  return (
    <span aria-hidden className="flex h-2 w-full gap-[3px]">
      {segments.map((segment) =>
        segment.value > 0 ? (
          <span
            className={cn('block h-full rounded-full', segment.fill)}
            key={segment.key}
            style={{ width: `${String((segment.value / scale) * 100)}%` }}
          />
        ) : null,
      )}
    </span>
  )
}

/** One order this part is promised to or was sold through. */
function OrderRow({
  number,
  href,
  detail,
  aside,
}: {
  number: number
  href: string | null
  detail: ReactNode
  aside?: ReactNode
}) {
  const label = `Замовлення ${String(number)}`
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        {href === null ? (
          <span className="text-sm font-medium text-white">{label}</span>
        ) : (
          <Link
            className="hover:text-brand text-sm font-medium text-white"
            to={href}
          >
            {label}
          </Link>
        )}
        <span className="text-app-dim text-[13.5px]">{detail}</span>
      </span>
      {aside === undefined ? null : (
        <span className="text-app-muted text-[13.5px] tabular-nums">
          {aside}
        </span>
      )}
    </div>
  )
}

function PartDetailScreen({
  detail,
  history,
  partId,
  error,
  canManage,
  links,
  requireLatestMutation,
  tenantSlug,
}: {
  detail: PartDetail | null
  history: Awaited<ReturnType<typeof partsApi.history>> | null
  partId: string
  error: boolean
  canManage: boolean
  links: {
    cars: boolean
    intakes: boolean
    orders: boolean
    inventory: boolean
  }
  requireLatestMutation: ReturnType<
    typeof useLatestMutationGuard
  >['requireLatestMutation']
  tenantSlug: string
}) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const remove = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const scope = requireLatestMutation({ quota: false })
      await partsApi.delete(partId, { signal: scope.signal })
      setConfirmingDelete(false)
      void navigate('..', { replace: true })
    } catch (failure) {
      const status =
        typeof failure === 'object' &&
        failure !== null &&
        'response' in failure &&
        typeof failure.response === 'object' &&
        failure.response !== null &&
        'status' in failure.response
          ? failure.response.status
          : undefined
      setDeleteError(
        status === 409
          ? 'Не вдалося видалити деталь через конфлікт.'
          : 'Не вдалося видалити деталь.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const base = `/app/${tenantSlug}/parts`
  const orderHref = (id: string) =>
    links.orders ? `/app/${tenantSlug}/orders/${id}` : null
  const compat = detail
    ? [detail.compatCarBrand, detail.compatCarModel, detail.compatCarYear]
        .filter(Boolean)
        .join(' ')
    : ''
  const allReservations = detail?.reservations ?? []
  const currentOrderId = detail?.order?.id
  const currentReservation = currentOrderId
    ? allReservations.find(
        (reservation) => reservation.orderId === currentOrderId,
      )
    : undefined
  const reservations = allReservations.filter(
    (reservation) => reservation.orderId !== currentOrderId,
  )
  const soldOrders = detail?.soldOrders ?? []
  const soldRevenue = soldOrders.reduce(
    (sum, order) => sum + order.quantitySold * order.unitPrice,
    0,
  )

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={base}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            До складу
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Склад</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>Деталі</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {links.inventory ? (
            <Button asChild className="px-[18px] text-sm font-semibold">
              <Link to={`${base}/${partId}/inventory`}>
                Розміщення на складі
              </Link>
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button
                asChild
                className="px-5 text-sm font-bold"
                variant="primary"
              >
                <Link to={`${base}/${partId}/edit`}>Редагувати деталь</Link>
              </Button>
              <ActionMenu
                actions={[
                  {
                    key: 'delete',
                    label: 'Видалити деталь',
                    icon: <Trash2 aria-hidden className="size-4" />,
                    destructive: true,
                    disabled: deleting,
                    onSelect: () => setConfirmingDelete(true),
                  },
                ]}
                label="Інші дії з деталлю"
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-11 lg:px-12">
        {deleteError !== null && !confirmingDelete ? (
          <Notice tone="danger">{deleteError}</Notice>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            {detail === null ? null : (
              <StatusPill tone={partStatusPresentation(detail.status).tone}>
                {partStatusPresentation(detail.status).label}
              </StatusPill>
            )}
            <h1 className="mt-4 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
              {detail === null ? 'Деталь' : detail.name}
            </h1>
            {detail === null ? null : (
              <p className="text-app-muted mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm font-medium">
                {detail.qrCode ? (
                  <span className="border-app-line bg-app-input text-app-ink rounded-[7px] border px-2.5 py-1 font-mono text-[14px]">
                    {detail.qrCode}
                  </span>
                ) : null}
                <span>Стан: {conditionLabel(detail.condition)}</span>
              </p>
            )}
          </div>
          {detail === null ? null : (
            <StockStats
              available={detail.quantityAvailable}
              reserved={detail.quantityReserved}
              sold={detail.quantitySoldTotal}
              unit={detail.unit || null}
            />
          )}
        </div>

        {error ? (
          <ErrorState
            description="Деталь не вдалося завантажити. Спробуйте ще раз."
            title="Не вдалося завантажити деталь"
          />
        ) : detail === null ? (
          <SkeletonRows columns={2} label="Завантажуємо деталь…" rows={4} />
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-start gap-6">
              <Card
                aside={
                  <span className="text-app-dim font-mono text-[12px] tracking-[0.1em] uppercase">
                    {detail.photos.length}{' '}
                    {plural(detail.photos.length, [
                      'знімок',
                      'знімки',
                      'знімків',
                    ])}
                  </span>
                }
                bodyClassName="p-0"
                className="min-w-[320px] flex-[1_1_620px]"
                headerClassName="pb-4"
                title="Фото"
              >
                <Gallery
                  emptyLabel="Фото цієї деталі ще немає — їх додають під час редагування."
                  label={`Фото деталі ${detail.name}`}
                  photos={detail.photos.map((photo, index) => ({
                    id: photo.id,
                    url: photo.url,
                    ...(photo.thumbnailUrl
                      ? { thumbnailUrl: photo.thumbnailUrl }
                      : {}),
                    alt: `Фото деталі ${detail.name} ${String(index + 1)}`,
                  }))}
                  variant="framed"
                />
              </Card>

              <div className="flex min-w-[320px] flex-[1_1_460px] flex-col gap-6">
                <Card
                  aside={
                    <span className="text-app-muted text-[14px] font-semibold">
                      Усього {detail.quantityTotal} {detail.unit || 'шт'}
                    </span>
                  }
                  title="Наявність"
                >
                  <StockBar
                    available={detail.quantityAvailable}
                    reserved={detail.quantityReserved}
                    sold={detail.quantitySoldTotal}
                  />
                  <div className="border-app-line mt-[22px] flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                    <span className="text-app-muted text-sm font-semibold">
                      Ціна продажу
                    </span>
                    {detail.effectiveSalePrice === null ? (
                      <span className="flex flex-wrap items-center gap-2.5">
                        <span className="text-state-warn text-[16px] font-bold">
                          ціни ще немає
                        </span>
                        {canManage ? (
                          <Button
                            asChild
                            className="min-h-9 px-3 text-xs font-bold"
                          >
                            <Link to={`${base}/${partId}/edit`}>Додати</Link>
                          </Button>
                        ) : null}
                      </span>
                    ) : (
                      <span className="grid justify-items-end gap-0.5">
                        <Amount
                          className="text-[18px] font-bold text-white"
                          currency={PART_CURRENCY}
                          value={detail.effectiveSalePrice}
                        />
                        {detail.desiredSalePrice !== null &&
                        detail.desiredSalePrice !==
                          detail.effectiveSalePrice ? (
                          <span className="text-app-dim text-[12.5px]">
                            бажана{' '}
                            <Amount
                              currency={PART_CURRENCY}
                              value={detail.desiredSalePrice}
                            />
                          </span>
                        ) : null}
                      </span>
                    )}
                  </div>
                </Card>

                <Card title="Характеристики">
                  <SpecGrid
                    specs={[
                      { label: 'OEM', value: detail.oemCode ?? '—' },
                      { label: 'Тип', value: detail.partType ?? '—' },
                      {
                        label: 'Стан',
                        value: conditionLabel(detail.condition),
                      },
                      {
                        label: 'Джерело',
                        value:
                          detail.carId && detail.carCode && links.cars ? (
                            <Link
                              className="hover:text-brand"
                              to={`/app/${tenantSlug}/cars/${detail.carId}`}
                            >
                              {detail.carCode}
                            </Link>
                          ) : detail.intakeId && links.intakes ? (
                            <Link
                              className="hover:text-brand"
                              to={`/app/${tenantSlug}/intakes/${detail.intakeId}`}
                            >
                              Приймання
                            </Link>
                          ) : (
                            (detail.carCode ?? sourceLabel(detail.source))
                          ),
                      },
                      {
                        label: 'Сумісність',
                        value: compat || 'не вказано',
                        wide: true,
                        note: (
                          <SpecNote
                            icon={<Lock aria-hidden className="size-3" />}
                          >
                            Сумісність недоступна для редагування
                          </SpecNote>
                        ),
                      },
                      {
                        label: 'QR-код',
                        value: (
                          <span className="font-mono font-normal break-all">
                            {detail.qrCode || '—'}
                          </span>
                        ),
                        wide: true,
                      },
                      {
                        label: 'Нотатки',
                        value: (
                          <span className="text-app-ink font-normal">
                            {detail.notes ?? '—'}
                          </span>
                        ),
                        wide: true,
                      },
                    ]}
                  />
                  {detail.createdByName ? (
                    <div className="text-app-muted mt-[18px] flex flex-wrap items-center gap-3 text-[14px]">
                      <span
                        aria-hidden
                        className="text-app-ink grid size-[30px] place-items-center rounded-full bg-white/[0.07] text-[13px] font-bold"
                      >
                        {initials(detail.createdByName)}
                      </span>
                      <span>
                        Створено{' '}
                        <span className="text-app-ink font-semibold">
                          {detail.createdByName}
                        </span>{' '}
                        · <DateValue value={detail.createdAt} />
                      </span>
                    </div>
                  ) : null}
                </Card>

                {detail.order || reservations.length > 0 ? (
                  <Card title="Резерви">
                    <div className="divide-app-line grid divide-y">
                      {detail.order ? (
                        <OrderRow
                          aside={
                            <span className="flex flex-wrap items-baseline gap-2">
                              {currentReservation ? (
                                <Quantity
                                  unit={detail.unit || null}
                                  value={currentReservation.quantity}
                                />
                              ) : null}
                              <span className="text-app-dim">поточне</span>
                            </span>
                          }
                          detail={
                            <>
                              {detail.order.customerName ?? 'без клієнта'} ·{' '}
                              {detail.order.status}
                            </>
                          }
                          href={orderHref(detail.order.id)}
                          number={detail.order.number}
                        />
                      ) : null}
                      {reservations.map((reservation) => (
                        <OrderRow
                          aside={
                            <Quantity
                              unit={detail.unit || null}
                              value={reservation.quantity}
                            />
                          }
                          detail={reservation.customerName ?? 'без клієнта'}
                          href={orderHref(reservation.orderId)}
                          key={reservation.orderId}
                          number={reservation.orderNumber}
                        />
                      ))}
                    </div>
                  </Card>
                ) : null}

                {soldOrders.length > 0 ? (
                  <Card
                    aside={
                      <span className="text-app-muted text-[14px] font-semibold">
                        Виручка{' '}
                        <Amount currency={PART_CURRENCY} value={soldRevenue} />
                      </span>
                    }
                    title="Продажі"
                  >
                    <div className="divide-app-line grid divide-y">
                      {soldOrders.map((order) => (
                        <OrderRow
                          aside={
                            <>
                              {order.quantitySold} ×{' '}
                              <Amount
                                currency={PART_CURRENCY}
                                value={order.unitPrice}
                              />
                            </>
                          }
                          detail={
                            <>
                              {order.customerName ?? 'без клієнта'}
                              {order.confirmedAt ? (
                                <>
                                  {' · '}
                                  <DateValue
                                    value={order.confirmedAt}
                                    withTime={false}
                                  />
                                </>
                              ) : null}
                            </>
                          }
                          href={orderHref(order.orderId)}
                          key={order.orderId}
                          number={order.orderNumber}
                        />
                      ))}
                    </div>
                  </Card>
                ) : null}
              </div>
            </div>

            <Card title="Історія">
              {history === null ? (
                <SkeletonRows
                  columns={1}
                  label="Завантажуємо історію…"
                  rows={3}
                />
              ) : history.events.length === 0 ? (
                <p className="text-app-dim text-[14px]">
                  Подій ще немає — вони зʼявляться після першої зміни.
                </p>
              ) : (
                <ol className="grid">
                  {history.events.map((event, index) => (
                    <li
                      className={cn(
                        'flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3',
                        index > 0 && 'border-app-line border-t',
                      )}
                      key={event.id}
                    >
                      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <span className="text-[16px] font-semibold text-white">
                          {historyLabel(event.eventType)}
                        </span>
                        {historyDetails(event.data).map((fact) => (
                          <span
                            className="text-app-muted text-[14px] break-words"
                            key={fact}
                          >
                            {fact}
                          </span>
                        ))}
                        {event.order ? (
                          <span className="text-[14px]">
                            {links.orders ? (
                              <Link
                                className="hover:text-brand text-app-muted"
                                to={`/app/${tenantSlug}/orders/${event.order.id}`}
                              >
                                Замовлення {event.order.number}
                              </Link>
                            ) : (
                              <span className="text-app-muted">
                                Замовлення {event.order.number}
                              </span>
                            )}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-app-dim flex flex-wrap items-baseline gap-x-2.5 text-[13px]">
                        {event.user.name}
                        <DateValue value={event.createdAt} />
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </>
        )}
      </div>

      <ConfirmDialog
        confirmLabel="Видалити"
        consequence="Історія продажів, резерви та фото цієї деталі зникнуть назавжди. Деталь, яка вже в замовленні, видалити не вийде."
        error={deleteError}
        onConfirm={() => void remove()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pending={deleting}
        title="Видалити деталь?"
      />
    </div>
  )
}

interface PartFormValues {
  sourceType: string
  sourceId: string
  name: string
  quantity: string
  unit: string
  condition: string
  notes: string
  oemCode: string
  partType: string
  desiredSalePrice: string
  carBrand: string
  carModel: string
  carYear: string
}

const emptyPartForm: PartFormValues = {
  sourceType: 'free',
  sourceId: '',
  name: '',
  quantity: '1',
  unit: '',
  condition: '',
  notes: '',
  oemCode: '',
  partType: '',
  desiredSalePrice: '',
  carBrand: '',
  carModel: '',
  carYear: '',
}

type PartMediaStatus =
  | 'selected'
  | 'uploading'
  | 'uploaded'
  | 'upload-error'
  | 'removing'
  | 'remove-error'

interface PartMediaItem {
  id: string
  name: string
  status: PartMediaStatus
  existing: boolean
  file?: File
  storageKey?: string
  url?: string
}

const committedPhotoKeys = (items: PartMediaItem[]) =>
  items.flatMap((item) =>
    item.status === 'uploaded' && item.storageKey ? [item.storageKey] : [],
  )

/** Files chosen but not sent anywhere yet. */
const selectedFiles = (items: PartMediaItem[]) =>
  items.filter(
    (item) => item.status === 'selected' || item.status === 'upload-error',
  )

/** Names of the photos that failed, so the form can say which to retry. */
class PartPhotoUploadError extends Error {
  readonly names: string[]
  constructor(names: string[]) {
    super('part-photo-upload-failed')
    this.name = 'PartPhotoUploadError'
    this.names = names
  }
}

/**
 * Sends the files that were only chosen so far and answers with the storage
 * keys of every photo the part should carry. Nothing is uploaded before this
 * runs, so a form that is filled in and abandoned leaves no orphans behind.
 */
async function commitPartPhotos(
  items: PartMediaItem[],
  setItems: React.Dispatch<React.SetStateAction<PartMediaItem[]>>,
  signal: AbortSignal,
): Promise<string[]> {
  const pending = selectedFiles(items)
  if (pending.length === 0) return committedPhotoKeys(items)
  const ids = new Set(pending.map((item) => item.id))
  setItems((current) =>
    current.map((item) =>
      ids.has(item.id) ? { ...item, status: 'uploading' } : item,
    ),
  )
  const results = await Promise.all(
    pending.map(async (item) => {
      if (!item.file)
        return { id: item.id, name: item.name, ok: false as const }
      try {
        const uploaded = await mediaApi.upload(item.file, 'parts', { signal })
        return {
          id: item.id,
          name: item.name,
          ok: true as const,
          storageKey: uploaded.storageKey,
          url: uploaded.url,
        }
      } catch {
        return { id: item.id, name: item.name, ok: false as const }
      }
    }),
  )
  setItems((current) =>
    current.map((item) => {
      const result = results.find((one) => one.id === item.id)
      if (!result) return item
      return result.ok
        ? {
            ...item,
            status: 'uploaded' as const,
            storageKey: result.storageKey,
            url: result.url,
          }
        : { ...item, status: 'upload-error' as const }
    }),
  )
  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0)
    throw new PartPhotoUploadError(failed.map((result) => result.name))
  return [
    ...committedPhotoKeys(items),
    ...results.flatMap((result) =>
      result.ok && result.storageKey ? [result.storageKey] : [],
    ),
  ]
}

const safeMediaUrl = (value: string | undefined) => {
  if (!value) return null
  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null
  } catch {
    return null
  }
}

const fileSizeLabel = (size: number) => {
  if (size < 1024) return `${String(size)} Б`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`
}

const mediaMetaLabel = (item: PartMediaItem) =>
  item.file ? fileSizeLabel(item.file.size) : 'Збережене фото'

/** Section of a form: one heading, one purpose, one surface. */
function PartMediaFields({
  items,
  requireLatestMutation,
  setItems,
}: {
  items: PartMediaItem[]
  requireLatestMutation: ReturnType<
    typeof useLatestMutationGuard
  >['requireLatestMutation']
  setItems: React.Dispatch<React.SetStateAction<PartMediaItem[]>>
}) {
  const sequenceRef = useRef(0)
  const mountedRef = useRef(true)
  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const updateItem = (id: string, update: Partial<PartMediaItem>) => {
    if (!mountedRef.current) return
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    )
  }
  const uploadOne = async (item: PartMediaItem) => {
    if (!item.file) return
    updateItem(item.id, { status: 'uploading' })
    try {
      const scope = requireLatestMutation({ quota: false })
      const uploaded = await mediaApi.upload(item.file, 'parts', {
        signal: scope.signal,
      })
      updateItem(item.id, {
        status: 'uploaded',
        storageKey: uploaded.storageKey,
        url: uploaded.url,
      })
    } catch {
      updateItem(item.id, { status: 'upload-error' })
    }
  }
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    // Nothing leaves the browser until the form is submitted: a photo picked
    // for a part that is never created has no business sitting in storage.
    const additions = Array.from(files, (file) => ({
      id: `new-media-${sequenceRef.current++}`,
      name: file.name,
      status: 'selected' as const,
      existing: false,
      file,
    }))
    setItems((current) => [...current, ...additions])
  }
  const remove = async (item: PartMediaItem) => {
    if (item.existing || !item.storageKey) {
      setItems((current) => current.filter(({ id }) => id !== item.id))
      return
    }
    updateItem(item.id, { status: 'removing' })
    try {
      const scope = requireLatestMutation({ quota: false })
      await mediaApi.remove(item.storageKey, { signal: scope.signal })
      if (mountedRef.current)
        setItems((current) => current.filter(({ id }) => id !== item.id))
    } catch {
      updateItem(item.id, { status: 'remove-error' })
    }
  }
  const statusLabel = (item: PartMediaItem) => {
    if (item.status === 'selected') return 'Вибрано'
    if (item.status === 'uploading') return 'Завантаження…'
    if (item.status === 'uploaded') return 'Завантажено'
    if (item.status === 'upload-error') return 'Помилка завантаження'
    if (item.status === 'removing') return 'Видалення…'
    return 'Помилка видалення'
  }
  const failed = items.some(
    (item) => item.status === 'upload-error' || item.status === 'remove-error',
  )
  return (
    <SectionPanel
      description="Фото вирушають разом зі збереженням деталі — доти вони лишаються у вас."
      title="Фото"
    >
      <Field
        hint="Формати зображень, кілька файлів за раз."
        label="Фото деталі"
      >
        <FileField
          accept="image/*"
          aria-label="Фото деталі"
          multiple
          onChange={(event) => {
            addFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
      </Field>
      {failed ? (
        <Notice role="status" tone="warn">
          Частина фото не завантажилася. Повторіть завантаження або приберіть ці
          файли, щоб зберегти деталь.
        </Notice>
      ) : null}
      {items.length ? (
        <ul aria-label="Вибрані фото" className="grid gap-2">
          {items.map((item) => {
            const url = safeMediaUrl(item.url)
            return (
              <li
                className="border-app-line rounded-control flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border px-3 py-2"
                key={item.id}
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-app-ink text-[14.5px] break-words">
                    {item.name} · {statusLabel(item)}
                  </p>
                  <p className="text-app-dim text-[12.5px]">
                    {mediaMetaLabel(item)}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {url ? (
                    <Button asChild variant="quiet">
                      <a className="min-w-0 max-w-full shrink" href={url}>
                        <ExternalLink aria-hidden />
                        <span className="truncate">{item.name}</span>
                      </a>
                    </Button>
                  ) : null}
                  {item.status === 'upload-error' ? (
                    <Button
                      aria-label={`Повторити ${item.name}`}
                      onClick={() => void uploadOne(item)}
                    >
                      Повторити
                    </Button>
                  ) : null}
                  {item.status === 'remove-error' ? (
                    <Button
                      aria-label={`Повторити видалення ${item.name}`}
                      onClick={() => void remove(item)}
                    >
                      Повторити видалення
                    </Button>
                  ) : null}
                  {item.status !== 'uploading' && item.status !== 'removing' ? (
                    <Button
                      aria-label={`Прибрати ${item.name}`}
                      onClick={() => void remove(item)}
                      variant="danger"
                    >
                      Прибрати
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-app-dim text-[13.5px]">
          Фото ще не вибрано. Додайте знімки — покупці бачать їх у картці
          деталі.
        </p>
      )}
    </SectionPanel>
  )
}

type PartFieldErrors = Partial<
  Record<
    'name' | 'quantity' | 'desiredSalePrice' | 'carYear' | 'sourceId',
    string
  >
>

function partFieldErrors(
  values: PartFormValues,
  { requireSource }: { requireSource: boolean },
): PartFieldErrors {
  const errors: PartFieldErrors = {}
  if (!values.name.trim())
    errors.name = 'Введіть назву деталі — за нею її знаходять на складі.'
  const quantity = Number(values.quantity)
  if (!Number.isInteger(quantity) || quantity <= 0)
    errors.quantity = 'Вкажіть ціле число від 1, наприклад 3.'
  const price = optionalNumber(values.desiredSalePrice)
  if (price !== undefined && (!Number.isFinite(price) || price < 0))
    errors.desiredSalePrice =
      'Вкажіть число від 0, наприклад 1250.50, або залиште поле порожнім.'
  const year = optionalNumber(values.carYear)
  if (year !== undefined && (!Number.isInteger(year) || year <= 0))
    errors.carYear =
      'Вкажіть рік чотирма цифрами, наприклад 2018, або залиште поле порожнім.'
  if (requireSource && !values.sourceId.trim())
    errors.sourceId =
      values.sourceType === 'car'
        ? 'Оберіть автомобіль зі списку.'
        : 'Оберіть приймання зі списку.'
  return errors
}

function PartFields({
  values,
  setValues,
  sourceOptions,
  canViewCars,
  canViewIntakes,
  errors,
  edit,
}: {
  values: PartFormValues
  setValues: (values: PartFormValues) => void
  sourceOptions: SourceOptions
  canViewCars: boolean
  canViewIntakes: boolean
  errors: PartFieldErrors
  edit?: boolean
}) {
  const field =
    (name: keyof PartFormValues) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setValues({ ...values, [name]: event.target.value })
  const showCompatibility = !edit && values.sourceType === 'free'
  return (
    <>
      <SectionPanel
        description="Звідки походить деталь. Після створення джерело не змінюється."
        title="Джерело"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            hint={
              edit
                ? 'Тип джерела задається під час створення деталі.'
                : 'Вільна деталь не прив’язана ні до авто, ні до приймання.'
            }
            label="Тип джерела"
          >
            <SelectInput
              aria-label="Тип джерела"
              disabled={edit}
              onChange={(event) =>
                setValues({
                  ...values,
                  sourceType: event.target.value,
                  sourceId: '',
                })
              }
              value={values.sourceType}
            >
              <option value="free">Вільне</option>
              {canViewCars || values.sourceType === 'car' ? (
                <option value="car">Автомобіль</option>
              ) : null}
              {canViewIntakes || values.sourceType === 'batch' ? (
                <option value="batch">Приймання</option>
              ) : null}
            </SelectInput>
          </Field>
          {values.sourceType === 'car' && canViewCars ? (
            <Field
              error={errors.sourceId}
              hint={
                edit
                  ? 'Автомобіль-джерело змінити не можна.'
                  : 'Деталь буде прив’язана до цього авто.'
              }
              label="Автомобіль-джерело"
              required={!edit}
            >
              <SelectInput
                aria-label="Автомобіль-джерело"
                disabled={(edit ?? false) || sourceOptions.carsUnavailable}
                onChange={field('sourceId')}
                value={values.sourceId}
              >
                <option value="">Оберіть автомобіль</option>
                {sourceOptions.cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {carLabel(car)}
                  </option>
                ))}
                {values.sourceId &&
                !sourceOptions.cars.some(
                  (car) => car.id === values.sourceId,
                ) ? (
                  <option value={values.sourceId}>
                    Автомобіль недоступний у поточній вибірці
                  </option>
                ) : null}
              </SelectInput>
            </Field>
          ) : values.sourceType === 'batch' && canViewIntakes ? (
            <Field
              error={errors.sourceId}
              hint={
                edit
                  ? 'Приймання-джерело змінити не можна.'
                  : 'Деталь буде прив’язана до цього приймання.'
              }
              label="Приймання-джерело"
              required={!edit}
            >
              <SelectInput
                aria-label="Приймання-джерело"
                disabled={(edit ?? false) || sourceOptions.intakesUnavailable}
                onChange={field('sourceId')}
                value={values.sourceId}
              >
                <option value="">Оберіть приймання</option>
                {sourceOptions.intakes.map((intake) => (
                  <option key={intake.id} value={intake.id}>
                    {intakeLabel(intake)}
                  </option>
                ))}
                {values.sourceId &&
                !sourceOptions.intakes.some(
                  (intake) => intake.id === values.sourceId,
                ) ? (
                  <option value={values.sourceId}>
                    Приймання недоступне у поточній вибірці
                  </option>
                ) : null}
              </SelectInput>
            </Field>
          ) : null}
        </div>
        {values.sourceType === 'car' && !canViewCars ? (
          <Notice role="status" tone="warn">
            Вибір автомобіля недоступний без права перегляду автомобілів.
            Попросіть власника кабінету відкрити доступ до автомобілів або
            оберіть інший тип джерела.
          </Notice>
        ) : null}
        {values.sourceType === 'batch' && !canViewIntakes ? (
          <Notice role="status" tone="warn">
            Вибір приймання недоступний без права перегляду приймань. Попросіть
            власника кабінету відкрити доступ до приймань або оберіть інший тип
            джерела.
          </Notice>
        ) : null}
        {values.sourceType === 'car' &&
        canViewCars &&
        sourceOptions.carsUnavailable ? (
          <Notice role="status" tone="warn">
            Вибір автомобіля недоступний: список не завантажено. Оновіть
            сторінку, щоб повторити запит.
          </Notice>
        ) : null}
        {values.sourceType === 'batch' &&
        canViewIntakes &&
        sourceOptions.intakesUnavailable ? (
          <Notice role="status" tone="warn">
            Вибір приймання недоступний: список не завантажено. Оновіть
            сторінку, щоб повторити запит.
          </Notice>
        ) : null}
      </SectionPanel>
      <SectionPanel
        description="Як деталь виглядає у списку складу та в пошуку."
        title="Опис деталі"
      >
        <Field error={errors.name} label="Назва" required>
          <TextInput
            aria-label="Назва"
            onChange={field('name')}
            value={values.name}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field hint="Наприклад: кузов, оптика, двигун" label="Тип деталі">
            <TextInput
              aria-label="Тип деталі"
              onChange={field('partType')}
              value={values.partType}
            />
          </Field>
          <Field
            hint={
              edit
                ? 'OEM-код не змінюється після створення.'
                : 'Каталожний номер виробника'
            }
            label="OEM-код"
          >
            <TextInput
              aria-label="OEM-код"
              disabled={edit}
              onChange={field('oemCode')}
              value={values.oemCode}
            />
          </Field>
        </div>
        <Field hint="Наприклад: б/в, після ремонту, нова" label="Стан">
          <TextInput
            aria-label="Стан"
            onChange={field('condition')}
            value={values.condition}
          />
        </Field>
        <Field hint="Дефекти, комплектність, місце зберігання" label="Нотатки">
          <TextArea
            aria-label="Нотатки"
            onChange={field('notes')}
            rows={3}
            value={values.notes}
          />
        </Field>
      </SectionPanel>
      <SectionPanel
        description="Скільки одиниць на складі та за скільки їх продавати."
        title="Кількість і ціна"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field error={errors.quantity} label="Кількість" required>
            <TextInput
              aria-label="Кількість"
              inputMode="numeric"
              min="1"
              onChange={field('quantity')}
              type="number"
              value={values.quantity}
            />
          </Field>
          <Field hint="Наприклад: шт, компл" label="Одиниця">
            <TextInput
              aria-label="Одиниця"
              onChange={field('unit')}
              value={values.unit}
            />
          </Field>
          <Field
            error={errors.desiredSalePrice}
            hint="У гривнях, можна залишити порожнім"
            label="Бажана ціна"
          >
            <TextInput
              aria-label="Бажана ціна"
              inputMode="decimal"
              min="0"
              onChange={field('desiredSalePrice')}
              step="0.01"
              type="number"
              value={values.desiredSalePrice}
            />
          </Field>
        </div>
      </SectionPanel>
      {showCompatibility ? (
        <SectionPanel
          description="До якого авто підходить деталь. Задається лише під час створення."
          title="Сумісність"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Марка сумісності">
              <TextInput
                aria-label="Марка сумісності"
                onChange={field('carBrand')}
                value={values.carBrand}
              />
            </Field>
            <Field label="Модель сумісності">
              <TextInput
                aria-label="Модель сумісності"
                onChange={field('carModel')}
                value={values.carModel}
              />
            </Field>
            <Field error={errors.carYear} label="Рік сумісності">
              <TextInput
                aria-label="Рік сумісності"
                inputMode="numeric"
                onChange={field('carYear')}
                type="number"
                value={values.carYear}
              />
            </Field>
          </div>
        </SectionPanel>
      ) : null}
    </>
  )
}

function validFormNumbers(values: PartFormValues) {
  const quantity = Number(values.quantity)
  const price = optionalNumber(values.desiredSalePrice)
  const year = optionalNumber(values.carYear)
  return {
    quantity,
    price,
    year,
    valid:
      Number.isInteger(quantity) &&
      quantity > 0 &&
      (price === undefined || (Number.isFinite(price) && price >= 0)) &&
      (year === undefined || (Number.isInteger(year) && year > 0)),
  }
}

function PartForm({
  title,
  canViewCars,
  canViewIntakes,
  requireLatestMutation,
}: {
  title: string
  canViewCars: boolean
  canViewIntakes: boolean
  requireLatestMutation: ReturnType<
    typeof useLatestMutationGuard
  >['requireLatestMutation']
}) {
  const carMutation = useLatestMutationGuard(cabinetModules.cars)
  const intakeMutation = useLatestMutationGuard(cabinetModules.intakes)
  const [values, setValues] = useState(emptyPartForm)
  const [mediaItems, setMediaItems] = useState<PartMediaItem[]>([])
  const sourceOptions = useSourceOptions(
    canViewCars && values.sourceType === 'car',
    canViewIntakes && values.sourceType === 'batch',
  )
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const mediaPending = mediaItems.some(
    (item) => item.status === 'uploading' || item.status === 'removing',
  )
  const requireSource = values.sourceType !== 'free'
  const errors = showErrors ? partFieldErrors(values, { requireSource }) : {}
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pendingRef.current || mediaPending) return
    const parsed = validFormNumbers(values)
    if (Object.keys(partFieldErrors(values, { requireSource })).length > 0) {
      setShowErrors(true)
      setStatus(null)
      setError('Деталь не створено: виправте позначені нижче поля.')
      return
    }
    setShowErrors(false)
    const unit = optional(values.unit)
    const condition = optional(values.condition)
    const notes = optional(values.notes)
    const oemCode = optional(values.oemCode)
    const partType = optional(values.partType)
    const carBrand = optional(values.carBrand)
    const carModel = optional(values.carModel)
    const request = (photoKeys: string[]): CreatePartRequest => ({
      sourceType: values.sourceType,
      ...(values.sourceType === 'car' ? { carId: values.sourceId.trim() } : {}),
      ...(values.sourceType === 'batch'
        ? { intakeId: values.sourceId.trim() }
        : {}),
      name: values.name.trim(),
      quantity: parsed.quantity,
      photoKeys,
      ...(unit !== undefined ? { unit } : {}),
      ...(condition !== undefined ? { condition } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(oemCode !== undefined ? { oemCode } : {}),
      ...(partType !== undefined ? { partType } : {}),
      ...(parsed.price !== undefined ? { desiredSalePrice: parsed.price } : {}),
      ...(carBrand !== undefined ? { carBrand } : {}),
      ...(carModel !== undefined ? { carModel } : {}),
      ...(parsed.year !== undefined ? { carYear: parsed.year } : {}),
    })
    pendingRef.current = true
    setPending(true)
    setStatus(null)
    setError(null)
    try {
      const scope = requireLatestMutation()
      if (values.sourceType === 'car')
        carMutation.requireLatestMutation({
          permission: 'cars.view',
          quota: false,
        })
      if (values.sourceType === 'batch')
        intakeMutation.requireLatestMutation({
          permission: 'intakes.view',
          quota: false,
        })
      // The photos go up first and only now: the form is filled in, valid and
      // confirmed, so nothing lands in storage for a part that never appears.
      const photoKeys = await commitPartPhotos(
        mediaItems,
        setMediaItems,
        scope.signal,
      )
      await partsApi.create(request(photoKeys), { signal: scope.signal })
      setStatus('Деталь створено.')
    } catch (failure) {
      setError(
        failure instanceof PartPhotoUploadError
          ? `Деталь не створено: не вдалося завантажити фото (${failure.names.join(', ')}). Повторіть завантаження або приберіть ці файли.`
          : 'Не вдалося створити деталь. Перевірте зв’язок і надішліть форму ще раз.',
      )
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  return (
    <PageBody width="narrow">
      <PageHeader eyebrow="Склад · Деталі" title={title} />
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <PartFields
          canViewCars={canViewCars}
          canViewIntakes={canViewIntakes}
          errors={errors}
          setValues={setValues}
          sourceOptions={sourceOptions}
          values={values}
        />
        <PartMediaFields
          items={mediaItems}
          requireLatestMutation={requireLatestMutation}
          setItems={setMediaItems}
        />
        {status ? <Notice tone="ok">{status}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="border-app-line rounded-panel bg-app-raised flex flex-wrap items-center justify-end gap-2 border p-3">
          {mediaPending ? (
            <p className="text-app-dim mr-auto text-[13.5px]">
              Дочекайтеся, доки завантажаться всі фото.
            </p>
          ) : null}
          <Button asChild>
            <Link to="..">Скасувати</Link>
          </Button>
          <Button
            aria-busy={pending || mediaPending}
            disabled={pending || mediaPending}
            type="submit"
            variant="primary"
          >
            Створити деталь
          </Button>
        </div>
      </form>
      <div className="text-app-dim grid gap-1 text-[13.5px]">
        <p>
          VIN та OEM-декодування недоступні: за кодом не визначається операція
          декодування.
        </p>
        <p>Сумісність недоступна для редагування</p>
      </div>
    </PageBody>
  )
}

function PartEdit({
  partId,
  canViewCars,
  canViewIntakes,
  requireLatestMutation,
}: {
  partId: string
  canViewCars: boolean
  canViewIntakes: boolean
  requireLatestMutation: ReturnType<
    typeof useLatestMutationGuard
  >['requireLatestMutation']
}) {
  const [values, setValues] = useState<PartFormValues | null>(null)
  const [detail, setDetail] = useState<PartDetail | null>(null)
  const [mediaItems, setMediaItems] = useState<PartMediaItem[]>([])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const mediaPending = mediaItems.some(
    (item) => item.status === 'uploading' || item.status === 'removing',
  )
  const errors =
    showErrors && values
      ? partFieldErrors(values, { requireSource: false })
      : {}
  useEffect(() => {
    const controller = new AbortController()
    void partsApi.get(partId, { signal: controller.signal }).then(
      (part) => {
        if (!part) {
          setError(
            'Не вдалося завантажити деталь для редагування. Оновіть сторінку або поверніться до списку.',
          )
          return
        }
        setValues({
          sourceType: part.source,
          sourceId: part.carId ?? part.intakeId ?? '',
          name: part.name,
          quantity: String(part.quantityTotal),
          unit: part.unit,
          condition: part.condition,
          notes: part.notes ?? '',
          oemCode: part.oemCode ?? '',
          partType: part.partType ?? '',
          desiredSalePrice:
            part.desiredSalePrice === null ? '' : String(part.desiredSalePrice),
          carBrand: '',
          carModel: '',
          carYear: '',
        })
        setDetail(part)
        setMediaItems(
          (part.photos ?? []).map((photo, index) => ({
            id: `existing-media-${photo.id}`,
            name: `Існуюче фото ${index + 1}`,
            status: 'uploaded',
            existing: true,
            storageKey: photo.storageKey,
            url: photo.url,
          })),
        )
        setError(null)
      },
      () => {
        if (!controller.signal.aborted)
          setError(
            'Не вдалося завантажити деталь для редагування. Оновіть сторінку або поверніться до списку.',
          )
      },
    )
    return () => controller.abort()
  }, [partId])
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!values || pendingRef.current || mediaPending) return
    const parsed = validFormNumbers(values)
    if (
      Object.keys(partFieldErrors(values, { requireSource: false })).length > 0
    ) {
      setShowErrors(true)
      setStatus(null)
      setError('Зміни не збережено: виправте позначені нижче поля.')
      return
    }
    setShowErrors(false)
    pendingRef.current = true
    setPending(true)
    setStatus(null)
    setError(null)
    try {
      const scope = requireLatestMutation({ quota: false })
      const photoKeys = await commitPartPhotos(
        mediaItems,
        setMediaItems,
        scope.signal,
      )
      await partsApi.update(
        partId,
        {
          name: values.name.trim(),
          condition: optional(values.condition) ?? null,
          notes: optional(values.notes) ?? null,
          quantity: parsed.quantity,
          partType: optional(values.partType) ?? null,
          unit: optional(values.unit) ?? null,
          photoKeys,
          desiredSalePrice: {
            isSet: true,
            value: parsed.price ?? null,
          },
        },
        { signal: scope.signal },
      )
      setStatus('Зміни збережено.')
    } catch (failure) {
      setError(
        failure instanceof PartPhotoUploadError
          ? `Зміни не збережено: не вдалося завантажити фото (${failure.names.join(', ')}). Повторіть завантаження або приберіть ці файли.`
          : 'Не вдалося зберегти зміни. Перевірте зв’язок і надішліть форму ще раз.',
      )
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  const navigate = useNavigate()
  const tenantSlug = useParams<{ tenant: string }>().tenant ?? ''
  const base = `/app/${tenantSlug}/parts`
  const backTo = `${base}/${partId}`
  const remove = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const scope = requireLatestMutation({ quota: false })
      await partsApi.delete(partId, { signal: scope.signal })
      setConfirmingDelete(false)
      void navigate(base, { replace: true })
    } catch {
      setDeleteError('Не вдалося видалити деталь.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            className="border-app-line-2 text-app-muted hover:text-app-ink flex items-center gap-2 rounded-full border py-2 pr-3.5 pl-2.5 text-sm font-semibold hover:bg-white/[0.05]"
            to={backTo}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            До деталі
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>Склад</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>Запчастини</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild className="px-[18px] text-sm font-semibold">
            <Link to={backTo}>Скасувати</Link>
          </Button>
          <Button
            aria-busy={pending || mediaPending}
            className="px-5 text-sm font-bold"
            disabled={pending || mediaPending || values === null}
            form="part-edit"
            type="submit"
            variant="primary"
          >
            Зберегти зміни
          </Button>
        </div>
      </div>

      <div className="grid w-full gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
            {detail?.name ?? 'Редагувати деталь'}
          </h1>
          {detail ? (
            <p className="text-app-muted mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium">
              <span className="border-app-line bg-app-input text-app-ink rounded-[7px] border px-2.5 py-1 font-mono text-[13px]">
                {detail.qrCode}
              </span>
              <span>
                Створено {detail.createdByName} ·{' '}
                <DateValue value={detail.createdAt} />
              </span>
            </p>
          ) : null}
        </div>

        {status ? <Notice tone="ok">{status}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}

        {values ? (
          <form
            className="flex flex-wrap items-start gap-6"
            id="part-edit"
            noValidate
            onSubmit={(event) => void save(event)}
          >
            <div className="grid min-w-[320px] flex-[1_1_560px] gap-5">
              <Card
                aside={
                  <span className="text-app-dim text-[13px]">
                    Не змінюється
                  </span>
                }
                title="Джерело"
              >
                <p className="text-app-muted text-sm">
                  Джерело задане під час створення запчастини.
                </p>
                <div className="border-app-line bg-app-input flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3.5">
                  <span className="text-[16px] font-semibold text-white">
                    {detail?.carId && detail.carCode
                      ? `З авто · ${detail.carCode}${detail.carBrand ? ` (${detail.carBrand} ${detail.carModel ?? ''})` : ''}`
                      : detail?.intakeId
                        ? 'З приймання'
                        : sourceLabel(values.sourceType)}
                  </span>
                  {detail?.carId && canViewCars ? (
                    <Button asChild>
                      <Link to={`/app/${tenantSlug}/cars/${detail.carId}`}>
                        Відкрити авто
                        <ExternalLink aria-hidden />
                      </Link>
                    </Button>
                  ) : detail?.intakeId && canViewIntakes ? (
                    <Button asChild>
                      <Link
                        to={`/app/${tenantSlug}/intakes/${detail.intakeId}`}
                      >
                        Відкрити приймання
                        <ExternalLink aria-hidden />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </Card>

              <Card title="Опис деталі">
                <p className="text-app-muted text-sm">
                  Як запчастина виглядає у списку складу та в пошуку.
                </p>
                <Field error={errors.name} label="Назва" required>
                  <TextInput
                    name="name"
                    onChange={(event) =>
                      setValues((current) =>
                        current
                          ? { ...current, name: event.target.value }
                          : current,
                      )
                    }
                    required
                    value={values.name}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Тип деталі">
                    <TextInput
                      name="partType"
                      onChange={(event) =>
                        setValues((current) =>
                          current
                            ? { ...current, partType: event.target.value }
                            : current,
                        )
                      }
                      value={values.partType}
                    />
                  </Field>
                  <Field hint="OEM-код поки не редагується" label="OEM-код">
                    <TextInput
                      className="font-mono"
                      disabled
                      name="oemCode"
                      value={values.oemCode}
                    />
                  </Field>
                </div>
                <Field label="Стан">
                  <PillGroup
                    label="Стан деталі"
                    onChange={(next) =>
                      setValues((current) =>
                        current ? { ...current, condition: next } : current,
                      )
                    }
                    options={PART_CONDITIONS}
                    value={values.condition}
                  />
                </Field>
                <Field label="Нотатки">
                  <TextArea
                    name="notes"
                    onChange={(event) =>
                      setValues((current) =>
                        current
                          ? { ...current, notes: event.target.value }
                          : current,
                      )
                    }
                    rows={2}
                    value={values.notes}
                  />
                </Field>
              </Card>

              <Card title="Кількість і ціна">
                <p className="text-app-muted text-sm">
                  Скільки одиниць на складі та за скільки їх продавати.
                </p>
                <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr]">
                  <Field error={errors.quantity} label="Кількість" required>
                    <QuantityStepper
                      label="Кількість на складі"
                      min={0}
                      onChange={(next) =>
                        setValues((current) =>
                          current
                            ? { ...current, quantity: String(next) }
                            : current,
                        )
                      }
                      value={Number(values.quantity) || 0}
                    />
                  </Field>
                  <Field label="Одиниця">
                    <TextInput
                      name="unit"
                      onChange={(event) =>
                        setValues((current) =>
                          current
                            ? { ...current, unit: event.target.value }
                            : current,
                        )
                      }
                      value={values.unit}
                    />
                  </Field>
                  <Field
                    error={errors.desiredSalePrice}
                    hint="У доларах"
                    label="Бажана ціна"
                  >
                    <TextInput
                      inputMode="decimal"
                      name="desiredSalePrice"
                      onChange={(event) =>
                        setValues((current) =>
                          current
                            ? {
                                ...current,
                                desiredSalePrice: event.target.value,
                              }
                            : current,
                        )
                      }
                      value={values.desiredSalePrice}
                    />
                  </Field>
                </div>
              </Card>

              <Card
                aside={
                  <span className="text-app-dim text-[13px]">
                    Лише для читання
                  </span>
                }
                title="Сумісність"
              >
                <p className="text-app-muted text-sm">
                  Сумісність задана під час створення і доступна лише для
                  читання.
                </p>
                <SpecGrid
                  specs={[
                    { label: 'Марка', value: detail?.compatCarBrand ?? '—' },
                    { label: 'Модель', value: detail?.compatCarModel ?? '—' },
                    {
                      label: 'Рік',
                      value:
                        detail?.compatCarYear === null ||
                        detail?.compatCarYear === undefined
                          ? '—'
                          : String(detail.compatCarYear),
                    },
                  ]}
                />
              </Card>

              <Card title="Фото">
                <p className="text-app-muted text-sm">
                  Нові фото завантажуються одразу після вибору. Зберегти можна,
                  коли всі файли завантажені.
                </p>
                <PartMediaFields
                  items={mediaItems}
                  requireLatestMutation={requireLatestMutation}
                  setItems={setMediaItems}
                />
                <p className="text-app-dim text-[13px]">
                  Покупці бачать фото у картці деталі.
                </p>
              </Card>
            </div>

            <aside className="sticky top-24 grid min-w-[280px] flex-[0_0_320px] gap-5">
              <Card title="Зведення">
                <dl className="grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                  <dt className="text-app-muted text-sm font-semibold">
                    Доступно
                  </dt>
                  <dd className="font-mono text-[16px] text-white tabular-nums">
                    {detail?.quantityAvailable ?? 0} {values.unit || 'шт'}
                  </dd>
                  <dt className="text-app-muted text-sm font-semibold">
                    У резерві
                  </dt>
                  <dd className="font-mono text-[16px] text-white tabular-nums">
                    {detail?.quantityReserved ?? 0} {values.unit || 'шт'}
                  </dd>
                  <dt className="text-app-muted text-sm font-semibold">
                    QR-код
                  </dt>
                  <dd className="font-mono text-[14px] break-all text-white">
                    {detail?.qrCode ?? '—'}
                  </dd>
                </dl>
                <Button asChild className="mt-4 w-full text-sm font-semibold">
                  <Link to={`/app/${tenantSlug}/stickers?part=${partId}`}>
                    <Printer aria-hidden />
                    Надрукувати стікер
                  </Link>
                </Button>
              </Card>

              <Card title="Видалення">
                <p className="text-app-muted text-sm">
                  {detail && detail.quantityReserved > 0
                    ? 'Деталь у резерві під замовлення — видалити її не вийде.'
                    : 'Деталь не входить у відкриті замовлення — її можна видалити.'}
                </p>
                <Button
                  className="w-full text-sm font-semibold"
                  onClick={() => setConfirmingDelete(true)}
                  type="button"
                  variant="danger"
                >
                  <Trash2 aria-hidden />
                  Видалити запчастину
                </Button>
              </Card>
            </aside>
          </form>
        ) : !error ? (
          <SkeletonRows columns={2} label="Завантажуємо деталь…" rows={4} />
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel="Видалити"
        consequence="Історія продажів, резерви та фото цієї деталі зникнуть назавжди."
        destructive
        error={deleteError}
        onConfirm={() => void remove()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pending={deleting}
        title="Видалити деталь?"
      />
    </div>
  )
}
