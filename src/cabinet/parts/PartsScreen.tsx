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
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  Car as CarIcon,
  CircleMinus,
  MapPin,
  Package,
  ShoppingBag,
  Tag,
  Plus,
  X,
  Printer,
  Search,
  Trash2,
} from 'lucide-react'
import {
  ActionMenu,
  Amount,
  DateValue,
  PhotoFileField,
  Gallery,
  Card,
  CodeChip,
  SectionPanel,
  Sheet,
  PillGroup,
  QuantityStepper,
  SkeletonRows,
  SpecGrid,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  InlineEdit,
  Notice,
  SelectInput,
  StatusPill,
  TextArea,
  TextInput,
  type StatusTone,
} from '@/components/app'
import { cn, plural } from '@/lib/utils'
import {
  conditionLabel,
  conditionPhrase,
  historyChange,
  historyDetails,
  historyKind,
  type HistoryKind,
  historyLabel,
  originLabel,
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
  type PartCompatibilities,
} from '@/api/parts'
import { carsApi, type Car, type CarListItem } from '@/api/cars'
import { intakesApi, type IntakeListItem } from '@/api/intakes'
import { mediaApi } from '@/api/media'
import { useCabinet } from '../CabinetContext'
import { ImportEntryButton } from '../imports/ImportEntryButton'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import {
  cabinetModules,
  type CabinetModuleDefinition,
} from '../module-registry'
import { evaluateModuleAccess, type ModuleAccessDecision } from '../policy'
import { inventoryApi, type PartInventoryZone } from '@/api/inventory'
import { normalizeApiProblem } from '@/api/errors'
import type { ApiProblem } from '@/api/contracts'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { VehicleCatalogPicker } from '../cars/CarsScreen'
import {
  emptyRow,
  filledRows,
  resolveCompatibility,
  rowProblem,
  rowsProblem,
  unknownBrandsMessage,
  type CompatibilityRow,
} from './compatibility-rows'
import {
  DRAFT_PARAM,
  clearPartDraft,
  readPartDraft,
  savePartDraft,
  sourceCreateHref,
} from './source-return'

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
const statusPresentation = (
  status: string,
): { label: string; tone: StatusTone } => {
  if (status === 'available') return { label: 'Доступно', tone: 'ok' }
  if (status === 'reserved') return { label: 'У резерві', tone: 'warn' }
  if (status === 'sold') return { label: 'Продано', tone: 'danger' }
  return { label: status, tone: 'neutral' }
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
      .list(
        { status: 'active', page: 1, pageSize: 100 },
        { signal: controller.signal },
      )
      .then(
        (page) => {
          if (!controller.signal.aborted)
            setOptions((current) => ({
              ...current,
              cars: page.items.filter((car) => car.status !== 'archived'),
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
  evaluateModuleAccess(definition, accessState(cabinet), 'view').kind ===
  'allowed'

export function PartsScreen({ definition }: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
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
  const [filteredCarResult, setFilteredCarResult] = useState<{
    key: string
    cars: Car[]
  } | null>(null)
  const appliedCarPresetRef = useRef('')
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

  const [reloadToken, setReloadToken] = useState(0)
  const removedOrigin =
    searchParams.get('origin')?.toLowerCase() === 'free' ||
    (location.state as { removedOrigin?: boolean } | null)?.removedOrigin ===
      true
  const links = {
    cars: allowedToView(cabinetModules.cars, cabinet),
    intakes: allowedToView(cabinetModules.intakes, cabinet),
    orders: allowedToView(cabinetModules.orders, cabinet),
    inventory: allowedToView(cabinetModules.inventory, cabinet),
  }
  const filters = useMemo(() => {
    const one = (name: string) => searchParams.get(name)?.trim() ?? ''
    const status = one('status')
    return {
      q: one('q'),
      status: partStatuses.has(status) ? status : '',
      condition: one('condition'),
      origin: ['car', 'batch'].includes(one('origin')) ? one('origin') : '',
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
  const filteredCarKey = filters.carIds.join(',')
  const filteredCars = useMemo(
    () =>
      filteredCarResult?.key === filteredCarKey ? filteredCarResult.cars : [],
    [filteredCarKey, filteredCarResult],
  )

  useEffect(() => {
    if (partId || isNew || !links.cars || filters.carIds.length === 0) return
    const controller = new AbortController()
    void Promise.all(
      filters.carIds.map((id) =>
        carsApi.get(id, { signal: controller.signal }).then(
          (car) => car,
          () => null,
        ),
      ),
    ).then((cars) => {
      if (!controller.signal.aborted)
        setFilteredCarResult({
          key: filteredCarKey,
          cars: cars.filter((car): car is Car => car !== null),
        })
    })
    return () => controller.abort()
  }, [filteredCarKey, filters.carIds, isNew, links.cars, partId])

  useEffect(() => {
    if (
      partId ||
      isNew ||
      filters.carIds.length !== 1 ||
      filteredCars.length !== 1 ||
      !facets ||
      appliedCarPresetRef.current === filteredCarKey
    )
      return

    const car = filteredCars[0]
    if (!car) return
    const sameName = (left: string, right: string) =>
      left.trim().localeCompare(right.trim(), undefined, {
        sensitivity: 'accent',
      }) === 0
    const make = facets.makes.find((value) => sameName(value.name, car.brand))
    const model = facets.models.find((value) => sameName(value.name, car.model))
    const warehouse =
      facets.warehouses.length === 1 ? facets.warehouses[0] : undefined
    const zone = facets.zones.length === 1 ? facets.zones[0] : undefined
    const next = new URLSearchParams(searchParams)

    if (!filters.makeId && make) next.set('make', make.id)
    if (!filters.modelId && model) next.set('model', model.id)
    if (!filters.warehouseId && warehouse) next.set('warehouse', warehouse.id)
    if (!filters.zoneId && zone) next.set('zone', zone.id)
    next.delete('page')

    appliedCarPresetRef.current = filteredCarKey
    if (next.toString() !== searchParams.toString())
      setSearchParams(next, { replace: true })
  }, [
    facets,
    filteredCarKey,
    filteredCars,
    filters.carIds.length,
    filters.makeId,
    filters.modelId,
    filters.warehouseId,
    filters.zoneId,
    isNew,
    partId,
    searchParams,
    setSearchParams,
  ])

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
    if (searchParams.get('origin')?.toLowerCase() === 'free') {
      next.delete('origin')
      next.set('page', '1')
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
      setSearchParams(next, {
        replace: true,
        ...(searchParams.get('origin')?.toLowerCase() === 'free'
          ? { state: { removedOrigin: true } }
          : {}),
      })
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

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        {removedOrigin ? (
          <Notice tone="info">
            Фільтр «Вільні запчастини» скинуто: кожна деталь має автомобіль або
            партію.
          </Notice>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
              Склад
            </p>
            <h1 className="mt-1.5 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
              Деталі
            </h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
            {manageDecision.kind === 'allowed' ? (
              <ImportEntryButton to="imports" />
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
                  dot: 'bg-state-ok',
                },
                { value: 'reserved', label: 'У резерві', dot: 'bg-state-warn' },
                { value: 'sold', label: 'Продано', dot: 'bg-state-danger' },
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
                  label={conditionLabel(value.id)}
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
              {(facets?.origins ?? [])
                .filter((value) => ['car', 'batch'].includes(value.id))
                .map((value) => (
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
                <span className="text-app-muted flex items-baseline gap-2 text-sm">
                  <span className="text-state-danger text-[22px] font-bold tabular-nums">
                    {summary?.sold ?? 0}
                  </span>
                  продано
                </span>
              </p>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
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
              </div>
            </div>

            {error ? (
              <ErrorState
                description={
                  error.kind === 'network' || error.kind === 'timeout'
                    ? 'Немає звʼязку з сервером. Фільтри лишилися на місці — повторіть, коли мережа повернеться.'
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
                <div className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border">
                  <DataTable
                    caption="Деталі на складі"
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
                          const presentation = statusPresentation(
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
  { value: 'good', label: 'Хороший' },
  { value: 'fair', label: 'Задовільний' },
  { value: 'scrap', label: 'На запчастини' },
] as const

/** Two letters standing in for a person where a photo would be. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '—'

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
  const [copied, setCopied] = useState<string | null>(null)
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
  const [compat, setCompat] = useState<PartCompatibilities | null>(null)
  const [zones, setZones] = useState<PartInventoryZone[] | null>(null)
  const [historyFilter, setHistoryFilter] =
    useState<(typeof HISTORY_FILTERS)[number]['value']>('all')
  const [historyAll, setHistoryAll] = useState(false)
  const [salesTab, setSalesTab] =
    useState<(typeof SALES_TABS)[number]['value']>('all')

  useEffect(() => {
    if (partId === undefined) return
    const controller = new AbortController()
    void partsApi.compatibilities(partId, { signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted) setCompat(result)
      },
      () => {
        // Compatibility is a detail of the page, not the page itself.
      },
    )
    return () => controller.abort()
  }, [partId])

  useEffect(() => {
    if (partId === undefined || !links.inventory) return
    const controller = new AbortController()
    void inventoryApi.getPartZones(partId, { signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted) setZones(result)
      },
      () => {
        if (!controller.signal.aborted) setZones([])
      },
    )
    return () => controller.abort()
  }, [links.inventory, partId])
  // Every order this part is promised to, the current one included: the card
  // shows one list rather than singling out the order that was opened last.
  const reservations = detail?.reservations ?? []
  const soldOrders = detail?.soldOrders ?? []
  const filteredHistory = (history?.events ?? []).filter(
    (event) =>
      historyFilter === 'all' ||
      historyKind(event.eventType, event.data) === historyFilter,
  )
  const shownHistory = historyAll
    ? filteredHistory
    : filteredHistory.slice(0, HISTORY_LIMIT)
  // Events arrive newest first; the day heading changes as the list walks down.
  const historyGroups = shownHistory.reduce<
    { date: string; items: typeof shownHistory; last: boolean }[]
  >((groups, event) => {
    const date = day(event.createdAt)
    const current = groups.at(-1)
    if (current?.date === date) current.items.push(event)
    else groups.push({ date, items: [event], last: false })
    return groups
  }, [])
  const lastGroup = historyGroups.at(-1)
  if (lastGroup) lastGroup.last = true

  /** The asking price the yard set; a sale below it is a discount. */
  const listPrice = detail?.desiredSalePrice ?? null
  // One table over two different things: a reservation has no price of its
  // own, a sale does. The row keeps that difference rather than hiding it.
  const salesRows = [
    ...(salesTab === 'sold'
      ? []
      : reservations.map((reservation) => ({
          kind: 'reserved' as const,
          orderId: reservation.orderId,
          orderNumber: reservation.orderNumber,
          customerName: reservation.customerName,
          quantity: reservation.quantity,
          unitPrice: null as number | null,
          date: null as string | null,
          discount: 0,
        }))),
    ...(salesTab === 'reserved'
      ? []
      : soldOrders.map((order) => ({
          kind: 'sold' as const,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          quantity: order.quantitySold,
          unitPrice: order.unitPrice,
          date: order.confirmedAt,
          discount:
            listPrice === null
              ? 0
              : Math.max(0, listPrice - order.unitPrice) * order.quantitySold,
        }))),
  ]
  /** What the yard gave away against its own asking price. */
  const soldDiscount =
    listPrice === null
      ? 0
      : soldOrders.reduce(
          (sum, order) =>
            sum + Math.max(0, listPrice - order.unitPrice) * order.quantitySold,
          0,
        )

  const soldRevenue = soldOrders.reduce(
    (sum, order) => sum + order.quantitySold * order.unitPrice,
    0,
  )

  const copyCode = async (code: string) => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(code)
      setCopied('Код скопійовано.')
    } catch {
      setCopied('Не вдалося скопіювати код.')
    }
  }

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
          <Button asChild className="px-4 text-sm font-semibold">
            <Link to={`/app/${tenantSlug}/stickers?part=${partId ?? ''}`}>
              Друк стікера
            </Link>
          </Button>
          {canManage ? (
            <>
              <Button asChild className="px-4 text-sm font-semibold">
                <Link to={`${base}/${partId}/edit`}>Редагувати</Link>
              </Button>
              <Button
                disabled
                title="Додавання деталі в замовлення з її картки ще не підключене — відкрийте замовлення й додайте позицію там."
                variant="primary"
              >
                Додати в замовлення
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

      <div className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-11 lg:px-12">
        {deleteError !== null && !confirmingDelete ? (
          <Notice tone="danger">{deleteError}</Notice>
        ) : null}
        {copied === null ? null : (
          <Notice tone={copied.startsWith('Не') ? 'danger' : 'ok'}>
            {copied}
          </Notice>
        )}

        <div className="min-w-0">
          {detail === null ? null : (
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={statusPresentation(detail.status).tone}>
                {statusPresentation(detail.status).label}
              </StatusPill>
              {detail.quantityReserved > 0 && detail.quantityAvailable > 0 ? (
                <StatusPill tone="warn">
                  {detail.quantityReserved} у резерві
                </StatusPill>
              ) : null}
              <span className="text-app-ink flex items-center gap-[7px] text-[13px] font-semibold">
                <span
                  aria-hidden
                  className={cn(
                    'size-[7px] rounded-full',
                    CONDITION_DOT[detail.condition] ?? 'bg-app-dim',
                  )}
                />
                {conditionPhrase(detail.condition)}
              </span>
            </div>
          )}
          <h1 className="mt-3.5 text-[38px] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance text-white sm:text-[46px] lg:text-[48px]">
            {detail === null ? 'Деталь' : detail.name}
          </h1>
          {detail === null ? null : (
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              {detail.qrCode ? (
                <CodeChip
                  code={detail.qrCode}
                  label="Копіювати код"
                  onCopy={() => {
                    void copyCode(detail.qrCode)
                  }}
                />
              ) : null}
              {detail.oemCode ? (
                <span className="text-app-muted font-mono text-[13px]">
                  OEM {detail.oemCode}
                </span>
              ) : null}
              {detail.partType ? (
                <span className="text-app-muted text-[13px]">
                  {detail.partType}
                </span>
              ) : null}
              <SourceChip
                href={
                  detail.carId && links.cars
                    ? `/app/${tenantSlug}/cars/${detail.carId}`
                    : detail.intakeId && links.intakes
                      ? `/app/${tenantSlug}/intakes/${detail.intakeId}`
                      : null
                }
                kind={
                  detail.carId ? 'car' : detail.intakeId ? 'batch' : 'unknown'
                }
                meta={detail.carId ? (detail.carCode ?? '') : ''}
                name={
                  detail.carId
                    ? [detail.carBrand, detail.carModel, detail.carYear]
                        .filter(Boolean)
                        .join(' ') ||
                      (detail.carCode ?? 'авто')
                    : detail.intakeId
                      ? 'приймання'
                      : 'без прив’язки'
                }
              />
            </div>
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
              <div className="flex min-w-[320px] flex-[1_1_560px] flex-col gap-6">
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
              </div>
              <div className="flex min-w-[320px] flex-[1_1_440px] flex-col gap-6">
                <Card
                  aside={
                    canManage && detail.effectiveSalePrice !== null ? (
                      <Button
                        asChild
                        className="min-h-8 px-3 text-[12px] font-bold"
                      >
                        <Link to={`${base}/${partId}/edit`}>Змінити</Link>
                      </Button>
                    ) : null
                  }
                  title="Ціна продажу"
                >
                  {detail.effectiveSalePrice === null ? (
                    <div className="border-state-warn/25 bg-state-warn/[0.07] flex flex-wrap items-center justify-between gap-4 rounded-[12px] border px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="text-state-warn text-[14px] font-bold">
                          Ціни ще немає
                        </p>
                        <p className="text-app-muted mt-1 text-[13px] leading-[1.45] text-pretty">
                          Без ціни деталь не можна додати в замовлення.
                        </p>
                      </div>
                      {canManage ? (
                        <Button asChild variant="primary">
                          <Link to={`${base}/${partId}/edit`}>
                            Вказати ціну
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="flex items-baseline gap-2.5">
                        <Amount
                          className="font-mono text-[30px] font-medium tracking-[-0.01em] text-white"
                          currency={PART_CURRENCY}
                          value={detail.effectiveSalePrice}
                        />
                        <span className="text-app-muted text-[13px]">
                          за 1 {detail.unit || 'шт'}
                        </span>
                      </p>
                      <p className="text-app-muted mt-1.5 text-[13px]">
                        {detail.quantityAvailable > 0 ? (
                          <>
                            Вільний залишок на{' '}
                            <Amount
                              currency={PART_CURRENCY}
                              value={
                                detail.effectiveSalePrice *
                                detail.quantityAvailable
                              }
                            />
                            {detail.quantityReserved > 0
                              ? ` · ще ${String(detail.quantityReserved)} ${detail.unit || 'шт'} у резерві`
                              : ''}
                          </>
                        ) : detail.quantityReserved > 0 ? (
                          `Вільних одиниць немає, ${String(detail.quantityReserved)} ${detail.unit || 'шт'} у резерві`
                        ) : (
                          'Усі одиниці продано'
                        )}
                      </p>
                      {detail.desiredSalePrice !== null &&
                      detail.desiredSalePrice !== detail.effectiveSalePrice ? (
                        <p className="text-app-dim mt-1 text-[12.5px]">
                          бажана{' '}
                          <Amount
                            currency={PART_CURRENCY}
                            value={detail.desiredSalePrice}
                          />
                        </p>
                      ) : null}
                    </>
                  )}
                </Card>
                <Card
                  aside={
                    <span className="text-app-muted text-[13px] font-semibold">
                      прийнято {detail.quantityTotal} {detail.unit || 'шт'}
                    </span>
                  }
                  title="Наявність"
                >
                  <dl className="grid gap-2 sm:grid-cols-3">
                    <StockTile
                      label="Доступно"
                      sub={
                        detail.quantityAvailable > 0
                          ? 'можна продати'
                          : 'немає вільних'
                      }
                      tone="ok"
                      value={detail.quantityAvailable}
                    />
                    <StockTile
                      label="У резерві"
                      sub={
                        detail.quantityReserved > 0
                          ? `${String(reservations.length)} ${plural(reservations.length, ['замовлення', 'замовлення', 'замовлень'])}`
                          : 'немає'
                      }
                      tone="warn"
                      value={detail.quantityReserved}
                    />
                    <StockTile
                      label="Продано"
                      sub={
                        detail.quantitySoldTotal > 0
                          ? `${String(soldOrders.length)} ${plural(soldOrders.length, ['замовлення', 'замовлення', 'замовлень'])}`
                          : 'ще не продавалась'
                      }
                      tone="plain"
                      value={detail.quantitySoldTotal}
                    />
                  </dl>

                  {detail.quantityAvailable === 1 ? (
                    <p className="text-app-muted mt-3 text-[13px]">
                      Остання одиниця.
                    </p>
                  ) : detail.quantityAvailable === 0 &&
                    detail.quantityReserved > 0 ? (
                    <p className="text-state-warn mt-3 text-[13px] text-pretty">
                      Усі фізично на складі, але зарезервовані.
                    </p>
                  ) : null}

                  <div className="border-app-line mt-[18px] flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                    <div className="min-w-0">
                      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                        Місце на складі
                      </p>
                      <p className="text-app-ink mt-1.5 text-[15px] font-semibold text-pretty">
                        {detail.quantityAvailable + detail.quantityReserved ===
                        0
                          ? `На складі немає. Останнє місце: ${placementLabel(zones, links.inventory).toLowerCase()}`
                          : placementLabel(zones, links.inventory)}
                      </p>
                    </div>
                    {links.inventory ? (
                      <Button
                        asChild
                        className="min-h-9 px-3 text-[12px] font-bold"
                      >
                        <Link to={`${base}/${partId}/inventory`}>
                          Перемістити
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </div>
            </div>

            {reservations.length > 0 || soldOrders.length > 0 ? (
              <Card
                aside={
                  <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-2">
                    <div className="flex items-baseline gap-2.5">
                      <dt className="text-app-muted text-[13px]">Виручка</dt>
                      <dd className="font-mono text-[17px] font-medium text-white">
                        <Amount currency={PART_CURRENCY} value={soldRevenue} />
                      </dd>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                      <dt className="text-app-muted text-[13px]">
                        У резерві на
                      </dt>
                      <dd
                        className="text-app-dim font-mono text-[17px] font-medium"
                        title={RESERVE_HAS_NO_PRICE}
                      >
                        —
                      </dd>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                      <dt className="text-app-muted text-[13px]">Знижки</dt>
                      <dd
                        className={cn(
                          'font-mono text-[17px] font-medium',
                          soldDiscount > 0 ? 'text-state-warn' : 'text-app-dim',
                        )}
                      >
                        <Amount currency={PART_CURRENCY} value={soldDiscount} />
                      </dd>
                    </div>
                  </dl>
                }
                bodyClassName="p-0"
                headerClassName="pb-0"
                title="Продажі"
              >
                <div
                  aria-label="Що показати в продажах"
                  className="border-app-line flex flex-wrap gap-6 border-b px-6"
                  role="tablist"
                >
                  {SALES_TABS.map((tab) => {
                    const count =
                      tab.value === 'reserved'
                        ? reservations.length
                        : tab.value === 'sold'
                          ? soldOrders.length
                          : reservations.length + soldOrders.length
                    const active = salesTab === tab.value
                    return (
                      <button
                        aria-selected={active}
                        className={cn(
                          'flex min-h-11 items-center gap-2 border-b-2 text-[14px] font-bold transition-colors',
                          active
                            ? 'border-brand text-white'
                            : 'text-app-muted hover:text-app-ink border-transparent',
                        )}
                        key={tab.value}
                        onClick={() => setSalesTab(tab.value)}
                        role="tab"
                        type="button"
                      >
                        {tab.label}
                        <span
                          className={cn(
                            'rounded-full px-1.5 font-mono text-[11px]',
                            active
                              ? 'bg-white/[0.12] text-white'
                              : 'text-app-muted bg-white/[0.05]',
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {salesRows.length === 0 ? (
                  <p className="text-app-muted px-6 py-6 text-[13px]">
                    {salesTab === 'reserved'
                      ? 'Зараз немає резервів на цю деталь.'
                      : 'Деталь ще не продавалась.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
                      <caption className="sr-only">
                        Замовлення, у яких стоїть ця деталь
                      </caption>
                      <thead>
                        <tr className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
                          <th className="px-6 pt-4 pb-3 font-normal">
                            Замовлення
                          </th>
                          <th className="px-3 pt-4 pb-3 font-normal">
                            Клієнт і доставка
                          </th>
                          <th className="px-3 pt-4 pb-3 font-normal">Статус</th>
                          <th className="px-3 pt-4 pb-3 text-right font-normal">
                            К-сть
                          </th>
                          <th className="px-3 pt-4 pb-3 text-right font-normal">
                            Ціна
                          </th>
                          <th className="px-3 pt-4 pb-3 text-right font-normal">
                            Сума
                          </th>
                          <th className="px-6 pt-4 pb-3 font-normal">
                            <span className="sr-only">Дії</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesRows.map((row) => (
                          <tr
                            className="border-app-line border-t align-top transition-colors hover:bg-white/[0.025]"
                            key={`${row.kind}-${row.orderId}`}
                          >
                            <td className="px-6 py-4">
                              {orderHref(row.orderId) === null ? (
                                <span className="text-app-ink font-mono text-[15px]">
                                  № {row.orderNumber}
                                </span>
                              ) : (
                                <Link
                                  className="text-brand font-mono text-[15px] underline-offset-4 hover:underline"
                                  to={orderHref(row.orderId) ?? '#'}
                                >
                                  № {row.orderNumber}
                                </Link>
                              )}
                              <span className="text-app-dim mt-1 block font-mono text-[12px]">
                                {row.date === null ? (
                                  '—'
                                ) : (
                                  <DateValue
                                    value={row.date}
                                    withTime={false}
                                  />
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-4">
                              <span className="text-app-ink block text-[15px] font-semibold">
                                {row.customerName ?? 'без клієнта'}
                              </span>
                              <span
                                className="text-app-dim mt-1 block text-[13px]"
                                title={DELIVERY_NOT_ON_PART}
                              >
                                спосіб доставки не показуємо тут
                              </span>
                            </td>
                            <td className="px-3 py-4">
                              <StatusPill
                                tone={row.kind === 'reserved' ? 'warn' : 'ok'}
                              >
                                {row.kind === 'reserved' ? 'Резерв' : 'Продано'}
                              </StatusPill>
                              <span
                                className="text-app-dim mt-1.5 block text-[13px] text-pretty"
                                title={
                                  row.kind === 'reserved'
                                    ? RESERVE_HAS_NO_TERM
                                    : undefined
                                }
                              >
                                {row.kind === 'reserved'
                                  ? 'тримається, доки стоїть у замовленні'
                                  : 'позиція закрита продажем'}
                              </span>
                            </td>
                            <td className="text-app-ink px-3 py-4 text-right font-mono text-[15px]">
                              {row.quantity}
                            </td>
                            <td className="px-3 py-4 text-right">
                              <span className="text-app-ink block font-mono text-[15px]">
                                {row.unitPrice === null ? (
                                  <span title={RESERVE_HAS_NO_PRICE}>—</span>
                                ) : (
                                  <Amount
                                    currency={PART_CURRENCY}
                                    value={row.unitPrice}
                                  />
                                )}
                              </span>
                              {row.discount > 0 ? (
                                <span className="text-state-warn mt-1 block font-mono text-[12px]">
                                  −
                                  <Amount
                                    currency={PART_CURRENCY}
                                    value={row.discount}
                                  />
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-4 text-right font-mono text-[15px] text-white">
                              {row.unitPrice === null ? (
                                <span
                                  className="text-app-dim"
                                  title={RESERVE_HAS_NO_PRICE}
                                >
                                  —
                                </span>
                              ) : (
                                <Amount
                                  currency={PART_CURRENCY}
                                  value={row.unitPrice * row.quantity}
                                />
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <Button
                                className="min-h-9 px-3 text-[12px] font-bold whitespace-nowrap"
                                disabled
                                title={
                                  row.kind === 'reserved'
                                    ? RESERVE_HAS_NO_TERM
                                    : RETURN_NOT_FROM_PART
                                }
                              >
                                {row.kind === 'reserved'
                                  ? 'Продовжити'
                                  : 'Повернення'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-app-line border-t">
                          <td
                            className="text-app-muted px-6 py-4 text-right text-[13px]"
                            colSpan={5}
                          >
                            {salesTab === 'reserved'
                              ? 'Разом у резерві'
                              : 'Разом продано'}
                          </td>
                          <td className="px-3 py-4 text-right font-mono text-[17px] font-medium text-white">
                            {salesTab === 'reserved' ? (
                              <span
                                className="text-app-dim"
                                title={RESERVE_HAS_NO_PRICE}
                              >
                                —
                              </span>
                            ) : (
                              <Amount
                                currency={PART_CURRENCY}
                                value={salesRows.reduce(
                                  (sum, row) =>
                                    sum + (row.unitPrice ?? 0) * row.quantity,
                                  0,
                                )}
                              />
                            )}
                          </td>
                          <td className="px-6 py-4" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            ) : null}

            <div className="flex flex-wrap items-start gap-6">
              <div className="flex min-w-[320px] flex-[1_1_440px] flex-col gap-6">
                <Card
                  aside={
                    compat === null ? null : (
                      <span className="text-app-muted text-[13px] font-semibold">
                        {compat.items.length}{' '}
                        {plural(compat.items.length, ['авто', 'авто', 'авто'])}
                      </span>
                    )
                  }
                  bodyClassName="p-0"
                  headerClassName="pb-3.5"
                  title="Сумісність"
                >
                  {compat === null ? (
                    <p className="text-app-muted px-6 pb-5 text-[13px]">
                      Завантажуємо…
                    </p>
                  ) : compat.items.length === 0 ? (
                    <p className="text-app-muted px-6 pb-5 text-[13px] leading-5 text-pretty">
                      Сумісність не вказана. Її задають під час створення
                      деталі.
                    </p>
                  ) : (
                    <ul className="grid">
                      {compat.items.map((item) => (
                        <li
                          className="border-app-line grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t px-6 py-3"
                          key={item.id}
                        >
                          <span className="min-w-0">
                            <span className="text-app-ink block text-[14px] font-semibold">
                              {[item.makeName, item.modelName]
                                .filter(Boolean)
                                .join(' ') || item.equipmentTypeName}
                            </span>
                            <span className="text-app-dim mt-0.5 block text-[12px]">
                              {item.evidenceType === 'DonorObservation'
                                ? 'авто-джерело, не редагується'
                                : item.modelName === null
                                  ? 'будь-яка модель'
                                  : ''}
                            </span>
                          </span>
                          <span className="text-app-ink font-mono text-[13px] whitespace-nowrap">
                            {yearSpan(item.yearFrom, item.yearTo)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Нотатки">
                  {detail.notes ? (
                    <p className="text-app-ink text-[15px] leading-[1.55] whitespace-pre-line text-pretty">
                      {detail.notes}
                    </p>
                  ) : (
                    <p className="text-app-muted text-[14px]">
                      Нотаток немає. Їх можна додати в редагуванні деталі.
                    </p>
                  )}
                  {detail.createdByName ? (
                    <div className="border-app-line text-app-muted mt-4 flex flex-wrap items-center gap-2.5 border-t pt-3.5 text-[13px]">
                      <span
                        aria-hidden
                        className="text-app-ink grid size-[26px] place-items-center rounded-full bg-white/[0.07] text-[11px] font-bold"
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
              </div>
              <div className="flex min-w-[320px] flex-[1_1_440px] flex-col gap-6">
                <Card
                  aside={
                    history === null || history.events.length === 0 ? null : (
                      <div
                        aria-label="Що показати в історії"
                        className="border-app-line flex gap-0.5 rounded-[9px] border bg-white/[0.04] p-[3px]"
                        role="group"
                      >
                        {HISTORY_FILTERS.map((filter) => {
                          const active = historyFilter === filter.value
                          return (
                            <button
                              aria-pressed={active}
                              className={cn(
                                // 26px to match the card's scale; the hit area
                                // is grown back to 44px by the overlay.
                                'relative h-[26px] rounded-[6px] px-2.5 text-[12px] font-bold whitespace-nowrap transition-colors',
                                "after:absolute after:-inset-y-[9px] after:-inset-x-0 after:content-['']",
                                active
                                  ? 'bg-white/10 text-white'
                                  : 'text-app-muted hover:text-app-ink',
                              )}
                              key={filter.value}
                              onClick={() => {
                                setHistoryFilter(filter.value)
                                setHistoryAll(false)
                              }}
                              type="button"
                            >
                              {filter.label}
                            </button>
                          )
                        })}
                      </div>
                    )
                  }
                  bodyClassName="p-0"
                  headerClassName="pb-3"
                  title="Історія"
                >
                  {history === null ? (
                    <div className="px-6 pb-6">
                      <SkeletonRows
                        columns={1}
                        label="Завантажуємо історію…"
                        rows={3}
                      />
                    </div>
                  ) : shownHistory.length === 0 ? (
                    <p className="text-app-muted px-6 pb-5 text-[13px] text-pretty">
                      {history.events.length === 0
                        ? 'Подій ще немає — вони зʼявляться після першої зміни.'
                        : 'У цій добірці подій немає.'}
                    </p>
                  ) : (
                    <div className="px-6 pb-2">
                      {historyGroups.map((group) => (
                        <section className="pt-3" key={group.date}>
                          <h3 className="text-app-dim pb-2 font-mono text-[10px] tracking-[0.14em] uppercase">
                            {group.date}
                          </h3>
                          <ol>
                            {group.items.map((event, index) => {
                              const kind = historyKind(
                                event.eventType,
                                event.data,
                              )
                              const change = historyChange(event.data)
                              const facts = historyDetails(event.data)
                              const last =
                                group.last && index === group.items.length - 1
                              return (
                                <li
                                  className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3"
                                  key={event.id}
                                >
                                  <span className="flex flex-col items-center self-stretch">
                                    <span
                                      aria-hidden
                                      className={cn(
                                        'grid size-7 shrink-0 place-items-center rounded-full',
                                        HISTORY_ICON[kind].tint,
                                      )}
                                    >
                                      {HISTORY_ICON[kind].icon}
                                    </span>
                                    {last ? null : (
                                      <span
                                        aria-hidden
                                        className="min-h-2.5 w-px flex-1 bg-white/[0.08]"
                                      />
                                    )}
                                  </span>
                                  <span className="min-w-0 pt-1 pb-4">
                                    <span className="text-app-ink block text-[14px] font-semibold text-pretty">
                                      {historyLabel(event.eventType)}
                                      {event.order ? (
                                        <>
                                          {' '}
                                          <span className="text-brand font-mono text-[13px]">
                                            № {event.order.number}
                                          </span>
                                        </>
                                      ) : null}
                                    </span>
                                    {change === null ? null : (
                                      <span className="mt-1.5 inline-flex items-center gap-2 rounded-[7px] bg-white/[0.04] px-2.5 py-1 font-mono text-[12px]">
                                        <span className="text-app-muted line-through">
                                          {change.from}
                                        </span>
                                        <span className="text-app-dim">→</span>
                                        <span className="text-app-ink">
                                          {change.to}
                                        </span>
                                      </span>
                                    )}
                                    {change !== null ||
                                    facts.length === 0 ? null : (
                                      <span className="text-app-muted mt-1 block text-[13px] text-pretty">
                                        {facts.join(' · ')}
                                      </span>
                                    )}
                                    <span className="text-app-dim mt-1.5 flex items-center gap-[7px] text-[12px]">
                                      <span
                                        aria-hidden
                                        className="text-app-muted grid size-[18px] place-items-center rounded-full bg-white/[0.07] text-[8px] font-extrabold"
                                      >
                                        {initials(event.user.name)}
                                      </span>
                                      {event.user.name}
                                    </span>
                                  </span>
                                  <span className="text-app-muted pt-1.5 font-mono text-[12px] whitespace-nowrap">
                                    {clock(event.createdAt)}
                                  </span>
                                </li>
                              )
                            })}
                          </ol>
                        </section>
                      ))}
                    </div>
                  )}
                  {filteredHistory.length > HISTORY_LIMIT ? (
                    <Button
                      className="border-app-line w-full justify-center rounded-none border-0 border-t bg-transparent"
                      onClick={() => setHistoryAll((value) => !value)}
                    >
                      {historyAll
                        ? 'Згорнути'
                        : `Показати всі · ${String(filteredHistory.length)}`}
                    </Button>
                  ) : null}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        confirmLabel="Видалити"
        consequence="Історія продажів, резерви та фото цієї деталі зникнуть назавжди. Сервер відхилить видалення, якщо деталь уже в замовленні."
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
}

const emptyPartForm: PartFormValues = {
  sourceType: 'car',
  sourceId: '',
  name: '',
  quantity: '1',
  unit: 'шт',
  condition: 'good',
  notes: '',
  oemCode: '',
  partType: '',
  desiredSalePrice: '',
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
  previewUrl?: string
}

const committedPhotoKeys = (items: PartMediaItem[]) =>
  items.flatMap((item) =>
    item.status === 'uploaded' && item.storageKey ? [item.storageKey] : [],
  )

const safeMediaUrl = (value: string | undefined) => {
  if (!value) return null
  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === 'http:' ||
      url.protocol === 'https:' ||
      url.protocol === 'blob:'
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
  deferUploads = false,
  items,
  requireLatestMutation,
  setItems,
  title = 'Фото',
  variant = 'panel',
}: {
  deferUploads?: boolean
  items: PartMediaItem[]
  requireLatestMutation: ReturnType<
    typeof useLatestMutationGuard
  >['requireLatestMutation']
  setItems: React.Dispatch<React.SetStateAction<PartMediaItem[]>>
  title?: ReactNode
  variant?: 'panel' | 'plain'
}) {
  const sequenceRef = useRef(0)
  const mountedRef = useRef(true)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(
    () => () => {
      mountedRef.current = false
      for (const item of itemsRef.current) {
        if (item.previewUrl && typeof URL.revokeObjectURL === 'function')
          URL.revokeObjectURL(item.previewUrl)
      }
    },
    [],
  )

  const updateItem = (id: string, update: Partial<PartMediaItem>) => {
    if (!mountedRef.current) return
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    )
  }
  const upload = async (item: PartMediaItem) => {
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
    const additions = Array.from(files, (file) => {
      const previewUrl =
        typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : null
      return {
        id: `new-media-${sequenceRef.current++}`,
        name: file.name,
        status: deferUploads ? ('selected' as const) : ('uploading' as const),
        existing: false,
        file,
        ...(previewUrl ? { previewUrl } : {}),
      }
    })
    setItems((current) => [...current, ...additions])
    if (!deferUploads) additions.forEach((item) => void upload(item))
  }
  const remove = async (item: PartMediaItem) => {
    if (item.previewUrl && typeof URL.revokeObjectURL === 'function')
      URL.revokeObjectURL(item.previewUrl)
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
      description={
        deferUploads
          ? 'Виберіть фото та перевірте перелік. Файли завантажаться разом зі створенням деталі.'
          : 'Додайте або приберіть фото деталі.'
      }
      title={title}
      variant={variant}
    >
      <Field
        hint="Формати зображень, кілька файлів за раз."
        label="Фото деталі"
      >
        <PhotoFileField
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
            const previewUrl = safeMediaUrl(item.previewUrl ?? item.url)
            const url = safeMediaUrl(item.url)
            return (
              <li
                className="border-app-line rounded-control flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border px-3 py-2"
                key={item.id}
              >
                {previewUrl ? (
                  <img
                    alt={`Попередній перегляд ${item.name}`}
                    className="size-14 shrink-0 rounded-control object-cover"
                    src={previewUrl}
                  />
                ) : null}
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
                      onClick={() => void upload(item)}
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
  Record<'name' | 'quantity' | 'desiredSalePrice' | 'sourceId', string>
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
  if (requireSource && !values.sourceId.trim())
    errors.sourceId =
      values.sourceType === 'car'
        ? 'Оберіть автомобіль зі списку.'
        : 'Оберіть партію зі списку.'
  return errors
}

/** One vehicle in the compatibility list, with its own pair of pickers. */
function CompatibilityRowCard({
  index,
  onChange,
  onRemove,
  row,
}: {
  index: number
  onChange: (patch: Partial<CompatibilityRow>) => void
  onRemove?: (() => void) | undefined
  row: CompatibilityRow
}) {
  // The picker keeps the make's own id so it can list that make's models.
  const [makeId, setMakeId] = useState<number | null>(null)
  const problem = rowProblem(row)
  const title = `Авто ${String(index + 1)}`

  return (
    <section
      aria-label={title}
      className="border-app-line bg-app-raised rounded-[14px] border px-4 pt-3.5 pb-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
          {title}
        </h4>
        {onRemove === undefined ? null : (
          <Button
            className="min-h-8 px-2.5 text-[12px]"
            onClick={onRemove}
            type="button"
            variant="quiet"
          >
            <X aria-hidden className="size-3" />
            Прибрати
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <VehicleCatalogPicker
          disabled={false}
          label="Марка"
          onSelect={(option) => {
            setMakeId(option.id)
            onChange({ brand: option.name, model: '' })
          }}
          type="make"
          value={row.brand}
        />
        <VehicleCatalogPicker
          disabled={row.brand === ''}
          label="Модель"
          makeId={makeId}
          makeName={row.brand}
          onSelect={(option) => {
            onChange({ model: option.name })
          }}
          type="model"
          value={row.model}
        />
        <Field label="Рік">
          <TextInput
            inputMode="numeric"
            onChange={(event) => {
              onChange({ year: event.target.value })
            }}
            value={row.year}
          />
        </Field>
      </div>

      {problem === null ? null : (
        <Notice className="mt-3" tone="danger">
          {problem}
        </Notice>
      )}
    </section>
  )
}

/** Where the part came from, as one chip that leads to the source. */
function SourceChip({
  href,
  kind,
  meta,
  name,
}: {
  href: string | null
  kind: 'car' | 'batch' | 'unknown'
  meta: string
  name: string
}) {
  const Icon =
    kind === 'car' ? CarIcon : kind === 'batch' ? Package : CircleMinus
  const label =
    kind === 'car' ? 'З авто' : kind === 'batch' ? 'Партія' : 'Джерело'
  const body = (
    <>
      <Icon aria-hidden className="text-app-muted size-[15px] shrink-0" />
      <span className="text-app-muted text-[13px] font-semibold whitespace-nowrap">
        {label}
      </span>
      <span className="text-app-ink text-[14px] font-bold whitespace-nowrap">
        {name}
      </span>
      {meta === '' ? null : (
        <span className="border-app-line-2 text-app-ink rounded-[4px] border px-1.5 font-mono text-[11px] leading-5 tracking-[0.06em] whitespace-nowrap">
          {meta}
        </span>
      )}
      {href === null ? null : (
        <ChevronRight aria-hidden className="text-brand size-3" />
      )}
    </>
  )
  const className =
    'border-app-line flex items-center gap-2.5 rounded-[8px] border bg-white/[0.03] py-1 pr-2.5 pl-2'

  return href === null ? (
    <span className={className}>{body}</span>
  ) : (
    <Link
      className={`${className} hover:border-app-line-2 hover:bg-white/[0.06]`}
      to={href}
    >
      {body}
    </Link>
  )
}

/**
 * What the sales table cannot promise. A reservation is a line in an order,
 * not a document of its own: it carries no price until the order is confirmed,
 * and the yard keeps no clock on it.
 */
const RESERVE_HAS_NO_PRICE =
  'Ціна фіксується під час продажу — у резерві її ще немає.'
const RESERVE_HAS_NO_TERM =
  'Строку резерву розбірка не веде: позиція тримається, доки стоїть у замовленні. Щоб звільнити деталь, приберіть її із замовлення.'
const DELIVERY_NOT_ON_PART =
  'Спосіб доставки й номер накладної живуть у самому замовленні — відкрийте його за номером.'
const RETURN_NOT_FROM_PART =
  'Повернення оформлюється в замовленні, з картки деталі такої дії немає.'

const SALES_TABS = [
  { value: 'all', label: 'Усі' },
  { value: 'reserved', label: 'У резерві' },
  { value: 'sold', label: 'Продано' },
] as const

/** How many events the history shows before it has to be asked for more. */
const HISTORY_LIMIT = 5

const HISTORY_FILTERS = [
  { value: 'all', label: 'Усе' },
  { value: 'sale', label: 'Продажі' },
  { value: 'price', label: 'Ціна' },
  { value: 'stock', label: 'Склад' },
] as const

/** A colour and a glyph per kind, so a long history can be skimmed. */
const HISTORY_ICON: Record<HistoryKind, { icon: ReactNode; tint: string }> = {
  sale: {
    icon: <ShoppingBag aria-hidden className="size-3.5" />,
    tint: 'bg-state-ok/15 text-state-ok',
  },
  price: {
    icon: <Tag aria-hidden className="size-3.5" />,
    tint: 'bg-state-info/15 text-state-info',
  },
  stock: {
    icon: <MapPin aria-hidden className="size-3.5" />,
    tint: 'text-app-muted bg-white/[0.07]',
  },
}

/** The clock reading of an event, next to the day it belongs to. */
const clock = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
      })
}

const day = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

/** A compatibility's years, as one span: a single year stays a single year. */
const yearSpan = (from: number | null, to: number | null): string => {
  if (from === null && to === null) return 'будь-який рік'
  if (from !== null && to !== null)
    return from === to ? String(from) : `${String(from)} – ${String(to)}`
  return from !== null ? `з ${String(from)}` : `до ${String(to ?? 0)}`
}

/**
 * Where the part sits, in the words the warehouse uses. Core keeps a system
 * zone for everything nobody has placed yet, so that one reads as "not placed"
 * rather than as a location.
 */
const placementLabel = (
  zones: PartInventoryZone[] | null,
  allowed: boolean,
): string => {
  if (!allowed) return 'Розміщення доступне зі складським модулем'
  if (zones === null) return 'Завантажуємо…'
  const placed = zones.filter((zone) => !zone.isSystemUnassigned)
  if (placed.length === 0) return 'Не розміщена'
  return placed
    .map((zone) => `${zone.warehouseName} · ${zone.zoneName}`)
    .join(', ')
}

/** The condition, as a colour a person can scan before reading the word. */
const CONDITION_DOT: Record<string, string> = {
  good: 'bg-state-ok',
  fair: 'bg-state-warn',
  scrap: 'bg-state-danger',
}

/** One of the three counts a part is split into, as its own tile. */
function StockTile({
  label,
  sub,
  tone,
  value,
}: {
  label: string
  sub: string
  tone: 'ok' | 'warn' | 'plain'
  value: number
}) {
  return (
    <div
      className={cn(
        'rounded-[14px] border px-3.5 pt-3 pb-3.5',
        tone === 'ok' && value > 0
          ? 'border-state-ok/20 bg-state-ok/[0.06]'
          : 'border-app-line bg-white/[0.02]',
      )}
    >
      <dt
        className={cn(
          'flex items-center gap-[7px] text-[12px] font-semibold',
          tone === 'ok'
            ? 'text-state-ok'
            : tone === 'warn'
              ? 'text-state-warn'
              : 'text-app-muted',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            tone === 'ok'
              ? 'bg-state-ok'
              : tone === 'warn'
                ? 'bg-state-warn'
                : 'bg-app-dim',
          )}
        />
        {label}
      </dt>
      <dd>
        <span
          className={cn(
            'mt-1.5 block text-[26px] leading-none font-extrabold tracking-[-0.02em] tabular-nums',
            value > 0 ? 'text-white' : 'text-app-dim',
          )}
        >
          {value}
        </span>
        <span className="text-app-dim mt-1.5 block text-[12px] text-pretty">
          {sub}
        </span>
      </dd>
    </div>
  )
}

/** A part belongs to one car or intake. */
const SOURCE_KINDS = [
  {
    value: 'car',
    label: 'З авто',
    hint: 'Розібране авто зі складу',
  },
  {
    value: 'batch',
    label: 'З партії',
    hint: 'Закупівля в постачальника',
  },
] as const

/**
 * What each condition means for a buyer. The label alone is a guess; the line
 * under it is what stops "задовільний" and "на запчастини" being used
 * interchangeably.
 */
const CONDITION_HINTS: Record<string, { hint: string; tone: string }> = {
  good: {
    hint: 'Справна, без суттєвих дефектів. Можна ставити без підготовки.',
    tone: 'border-state-ok bg-state-ok',
  },
  fair: {
    hint: 'Справна, є сліди використання або дрібні косметичні дефекти.',
    tone: 'border-state-warn bg-state-warn',
  },
  scrap: {
    hint: 'Несправна або некомплектна. Для розбору чи відновлення.',
    tone: 'border-state-danger bg-state-danger',
  },
}

function ConditionTile({
  label,
  onPick,
  picked,
  value,
}: {
  label: string
  onPick: () => void
  picked: boolean
  value: string
}) {
  const meaning = CONDITION_HINTS[value]
  const hintId = useId()
  return (
    <button
      aria-checked={picked}
      aria-describedby={hintId}
      aria-label={label}
      className={cn(
        'rounded-control flex min-h-[92px] flex-col items-start gap-2 border px-3.5 py-3 text-left transition-colors',
        picked
          ? 'border-app-line-2 bg-white/[0.06]'
          : 'border-app-line hover:border-app-line-2',
      )}
      onClick={onPick}
      role="radio"
      type="button"
    >
      <span className="flex w-full items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]',
            picked ? meaning?.tone.split(' ')[0] : 'border-white/20',
          )}
        >
          <span
            className={cn(
              'size-[7px] rounded-full',
              picked ? meaning?.tone.split(' ')[1] : '',
            )}
          />
        </span>
        <span
          className={cn(
            'text-[14px] font-bold whitespace-nowrap',
            picked ? 'text-white' : 'text-app-ink',
          )}
        >
          {label}
        </span>
      </span>
      <span
        className="text-app-dim text-[12px] leading-[1.4] text-pretty"
        id={hintId}
      >
        {meaning?.hint}
      </span>
    </button>
  )
}

function SourceTile({
  kind,
  onPick,
  picked,
}: {
  kind: (typeof SOURCE_KINDS)[number]
  onPick: () => void
  picked: boolean
}) {
  return (
    <button
      aria-pressed={picked}
      className={cn(
        'rounded-control min-h-16 border px-3.5 py-3 text-left transition-colors',
        picked
          ? 'border-app-line-2 bg-white/[0.07] text-white'
          : 'border-app-line text-app-muted hover:border-app-line-2',
      )}
      onClick={onPick}
      type="button"
    >
      <span className="block text-[14px] font-bold">{kind.label}</span>
      <span className="text-app-dim mt-1 block text-[12px] leading-[1.35] text-pretty">
        {kind.hint}
      </span>
    </button>
  )
}

function PartFields({
  values,
  setValues,
  sourceOptions,
  canViewCars,
  canViewIntakes,
  compatibility,
  errors,
  edit,
  variant = 'panel',
}: {
  /** The vehicles this part fits. Absent on the edit screen, which hides them. */
  compatibility?:
    | { rows: CompatibilityRow[]; setRows: (rows: CompatibilityRow[]) => void }
    | undefined
  values: PartFormValues
  setValues: (values: PartFormValues) => void
  sourceOptions: SourceOptions
  canViewCars: boolean
  canViewIntakes: boolean
  errors: PartFieldErrors
  edit?: boolean
  /** `plain` is the drawer: numbered sections divided by a rule. */
  variant?: 'panel' | 'plain'
}) {
  const cabinet = useCabinet()
  const location = useLocation()
  const cabinetRoot = `/app/${cabinet.targetTenant!.slug}`
  const sourceCreateKind =
    values.sourceType === 'car'
      ? ('cars' as const)
      : values.sourceType === 'batch'
        ? ('intakes' as const)
        : null
  const sourceCreateLink =
    !edit &&
    sourceCreateKind !== null &&
    evaluateModuleAccess(
      cabinetModules[sourceCreateKind],
      accessState(cabinet),
      'mutation',
    ).kind === 'allowed'
      ? sourceCreateKind
      : null
  const field =
    (name: keyof PartFormValues) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setValues({ ...values, [name]: event.target.value })
  const sourceCar =
    values.sourceType === 'car'
      ? (sourceOptions.cars.find((car) => car.id === values.sourceId) ?? null)
      : null
  const showCompatibility = !edit
  const step = (number: string, title: string) =>
    variant === 'plain' ? (
      <span className="flex items-baseline gap-2.5">
        <span className="text-app-dim font-mono text-[11px]">{number}</span>
        {title}
      </span>
    ) : (
      title
    )
  return (
    <>
      <SectionPanel
        description="Звідки походить деталь. Після створення джерело не змінюється."
        title={step('01', 'Джерело')}
        variant={variant}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {variant === 'plain' && !edit ? (
            <fieldset className="col-span-full grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Тип джерела</legend>
              {SOURCE_KINDS.filter(
                (kind) =>
                  (kind.value !== 'car' || canViewCars) &&
                  (kind.value !== 'batch' || canViewIntakes),
              ).map((kind) => (
                <SourceTile
                  key={kind.value}
                  kind={kind}
                  onPick={() =>
                    setValues({
                      ...values,
                      sourceType: kind.value,
                      sourceId: '',
                    })
                  }
                  picked={values.sourceType === kind.value}
                />
              ))}
            </fieldset>
          ) : (
            <Field
              hint={
                edit
                  ? 'Тип джерела задається під час створення деталі.'
                  : 'Оберіть автомобіль або партію перед створенням деталі.'
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
                {canViewCars || values.sourceType === 'car' ? (
                  <option value="car">Автомобіль</option>
                ) : null}
                {canViewIntakes || values.sourceType === 'batch' ? (
                  <option value="batch">Партія</option>
                ) : null}
              </SelectInput>
            </Field>
          )}
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
                  ? 'Партію-джерело змінити не можна.'
                  : 'Деталь буде прив’язана до цієї партії.'
              }
              label="Партія-джерело"
              required={!edit}
            >
              <SelectInput
                aria-label="Партія-джерело"
                disabled={(edit ?? false) || sourceOptions.intakesUnavailable}
                onChange={field('sourceId')}
                value={values.sourceId}
              >
                <option value="">Оберіть партію</option>
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
                    Партія недоступна у поточній вибірці
                  </option>
                ) : null}
              </SelectInput>
            </Field>
          ) : null}
        </div>
        {sourceCreateLink ? (
          <div className="grid gap-1.5">
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link
                  onClick={() =>
                    savePartDraft({
                      root: cabinetRoot,
                      values: { ...values, sourceId: '' },
                      compatibility: compatibility?.rows ?? [],
                    })
                  }
                  to={sourceCreateHref(
                    cabinetRoot,
                    sourceCreateLink,
                    `${location.pathname}${location.search}`,
                  )}
                >
                  <Plus aria-hidden />
                  {sourceCreateLink === 'cars'
                    ? 'Створити автомобіль'
                    : 'Створити партію'}
                </Link>
              </Button>
            </div>
            <p className="text-app-dim text-[12px] leading-5 text-pretty">
              Після створення повернетеся сюди з новим джерелом. Введені дані
              збережуться, фото потрібно буде додати ще раз.
            </p>
          </div>
        ) : null}
        {values.sourceType === 'car' && !canViewCars ? (
          <Notice role="status" tone="warn">
            Вибір автомобіля недоступний без права перегляду автомобілів.
            Попросіть власника кабінету відкрити доступ до автомобілів або
            оберіть інший тип джерела.
          </Notice>
        ) : null}
        {values.sourceType === 'batch' && !canViewIntakes ? (
          <Notice role="status" tone="warn">
            Вибір партії недоступний без права перегляду приймань. Попросіть
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
            Вибір партії недоступний: список не завантажено. Оновіть сторінку,
            щоб повторити запит.
          </Notice>
        ) : null}
      </SectionPanel>
      <SectionPanel
        description="Як деталь виглядає у списку складу та в пошуку."
        title={step('02', 'Опис деталі')}
        variant={variant}
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
        <Field hint="Дефекти, комплектність, місце зберігання" label="Нотатки">
          <TextArea
            className="resize-none"
            aria-label="Нотатки"
            onChange={field('notes')}
            rows={3}
            value={values.notes}
          />
        </Field>
      </SectionPanel>
      <SectionPanel
        description="Оберіть один із трьох сталих станів деталі."
        title={step('03', 'Стан деталі')}
        variant={variant}
      >
        {variant === 'plain' ? (
          <>
            <div
              aria-label="Стан деталі"
              className="grid gap-2 sm:grid-cols-3"
              role="radiogroup"
            >
              {PART_CONDITIONS.map((option) => (
                <ConditionTile
                  key={option.value}
                  label={option.label}
                  onPick={() =>
                    setValues({ ...values, condition: option.value })
                  }
                  picked={values.condition === option.value}
                  value={option.value}
                />
              ))}
            </div>
            <p className="text-app-dim text-[12px] leading-5 text-pretty">
              Стан бачать покупці у картці деталі й у пошуку. Його можна змінити
              пізніше.
            </p>
          </>
        ) : (
          <PillGroup
            className="flex-wrap"
            label="Стан деталі"
            onChange={(condition) => setValues({ ...values, condition })}
            options={PART_CONDITIONS}
            value={values.condition}
          />
        )}
      </SectionPanel>
      <SectionPanel
        description="Скільки одиниць на складі та за скільки їх продавати."
        title={step('04', 'Кількість і ціна')}
        variant={variant}
      >
        <div className="grid items-start gap-3 sm:grid-cols-3">
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
          <Field hint="Фіксована одиниця обліку" label="Одиниця">
            <TextInput aria-label="Одиниця" readOnly value="шт" />
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
          description={
            sourceCar === null
              ? 'До яких авто підходить деталь. Можна вказати кілька. Необовʼязково.'
              : 'Перший рядок підставлено з авто-джерела. Додайте інші, якщо деталь підходить і до них.'
          }
          title={step('05', 'Сумісність')}
          variant={variant}
        >
          {sourceCar === null ? null : (
            <div className="border-app-line flex items-center gap-3.5 rounded-[14px] border bg-white/[0.03] px-4 py-3.5">
              <span
                aria-hidden
                className="bg-app-input text-app-muted grid size-9 shrink-0 place-items-center rounded-[10px]"
              >
                <Lock className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold tracking-[-0.01em] text-white">
                  {sourceCar.brand} {sourceCar.model}{' '}
                  <span className="text-app-dim">·</span>{' '}
                  <span className="text-app-ink font-mono font-medium">
                    {sourceCar.year}
                  </span>
                </span>
                <span className="text-app-muted mt-0.5 block text-[12px] text-pretty">
                  З вибраного авто-джерела. Змінюється разом із джерелом.
                </span>
              </span>
            </div>
          )}
          {compatibility === undefined ? null : (
            <div className="grid gap-2.5">
              {compatibility.rows.map((row, index) => (
                <CompatibilityRowCard
                  index={index}
                  key={row.key}
                  onChange={(patch) => {
                    compatibility.setRows(
                      compatibility.rows.map((item) =>
                        item.key === row.key ? { ...item, ...patch } : item,
                      ),
                    )
                  }}
                  onRemove={
                    compatibility.rows.length > 1
                      ? () => {
                          compatibility.setRows(
                            compatibility.rows.filter(
                              (item) => item.key !== row.key,
                            ),
                          )
                        }
                      : undefined
                  }
                  row={row}
                />
              ))}
              <Button
                className="w-full justify-center border-dashed"
                onClick={() => {
                  compatibility.setRows([
                    ...compatibility.rows,
                    emptyRow(`row-${String(Date.now())}`),
                  ])
                }}
                type="button"
              >
                <Plus aria-hidden />
                Додати ще авто
              </Button>
            </div>
          )}
          <Notice tone="warn">
            Сумісність задається лише під час створення. Після збереження її не
            можна змінити.
          </Notice>
        </SectionPanel>
      ) : null}
    </>
  )
}

function validFormNumbers(values: PartFormValues) {
  const quantity = Number(values.quantity)
  const price = optionalNumber(values.desiredSalePrice)
  return {
    quantity,
    price,
    valid:
      Number.isInteger(quantity) &&
      quantity > 0 &&
      (price === undefined || (Number.isFinite(price) && price >= 0)),
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cabinet = useCabinet()
  // Coming back from creating a car or intake restores what was typed.
  const [draft] = useState(() =>
    searchParams.get(DRAFT_PARAM) === '1'
      ? readPartDraft<PartFormValues>(`/app/${cabinet.targetTenant!.slug}`)
      : null,
  )
  useEffect(() => {
    if (draft) clearPartDraft()
  }, [draft])
  const [compatRows, setCompatRows] = useState<CompatibilityRow[]>(() =>
    draft?.compatibility.length ? draft.compatibility : [emptyRow('row-1')],
  )
  // A part started from a car's page arrives with that car already chosen,
  // so nobody has to find it again in the source list.
  const [values, setValues] = useState<PartFormValues>(() => {
    const base = draft?.values ?? emptyPartForm
    const presetCar = searchParams.get('car_id')
    const presetIntake = searchParams.get('intake_id')
    if (presetCar) return { ...base, sourceType: 'car', sourceId: presetCar }
    if (presetIntake)
      return { ...base, sourceType: 'batch', sourceId: presetIntake }
    return draft ? base : { ...base, sourceType: canViewCars ? 'car' : 'batch' }
  })
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
  // A car given by link but missing from the active list is most likely
  // archived; say so now rather than after the whole form is filled.
  const [archivedCarId, setArchivedCarId] = useState<string | null>(null)
  const outsideCarId =
    canViewCars &&
    values.sourceType === 'car' &&
    values.sourceId &&
    !sourceOptions.carsUnavailable &&
    !sourceOptions.cars.some((car) => car.id === values.sourceId)
      ? values.sourceId
      : null
  useEffect(() => {
    if (!outsideCarId) return
    const controller = new AbortController()
    void carsApi.get(outsideCarId, { signal: controller.signal }).then(
      (car) => {
        if (!controller.signal.aborted && car.status === 'archived')
          setArchivedCarId(car.id)
      },
      () => undefined,
    )
    return () => controller.abort()
  }, [outsideCarId])
  const archivedSource =
    values.sourceType === 'car' && archivedCarId === values.sourceId
  const mediaPending = mediaItems.some(
    (item) => item.status !== 'uploaded' && item.status !== 'selected',
  )
  const requireSource = true
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
    const condition = optional(values.condition)
    const notes = optional(values.notes)
    const oemCode = optional(values.oemCode)
    const partType = optional(values.partType)
    const request: CreatePartRequest = {
      sourceType: values.sourceType,
      ...(values.sourceType === 'car' ? { carId: values.sourceId.trim() } : {}),
      ...(values.sourceType === 'batch'
        ? { intakeId: values.sourceId.trim() }
        : {}),
      name: values.name.trim(),
      quantity: parsed.quantity,
      unit: 'шт',
      photoKeys: [],
      ...(condition !== undefined ? { condition } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(oemCode !== undefined ? { oemCode } : {}),
      ...(partType !== undefined ? { partType } : {}),
      ...(parsed.price !== undefined ? { desiredSalePrice: parsed.price } : {}),
    }
    pendingRef.current = true
    setPending(true)
    setStatus(null)
    setError(null)
    try {
      const scope = requireLatestMutation()
      if (request.sourceType === 'car')
        carMutation.requireLatestMutation({
          permission: 'cars.view',
          quota: false,
        })
      if (request.sourceType === 'batch')
        intakeMutation.requireLatestMutation({
          permission: 'intakes.view',
          quota: false,
        })
      if (request.sourceType === 'car') {
        const car = await carsApi.get(request.carId!, { signal: scope.signal })
        if (car.status === 'archived') {
          setError('До архівного автомобіля не можна додавати деталі.')
          return
        }
      }
      const selected = mediaItems.filter(
        (item) => item.status === 'selected' && item.file,
      )
      let readyMedia = mediaItems
      if (selected.length > 0) {
        const selectedIds = new Set(selected.map((item) => item.id))
        setMediaItems((current) =>
          current.map((item) =>
            selectedIds.has(item.id) ? { ...item, status: 'uploading' } : item,
          ),
        )
        const uploads = await Promise.allSettled(
          selected.map(async (item) => ({
            item,
            uploaded: await mediaApi.upload(item.file!, 'parts', {
              signal: scope.signal,
            }),
          })),
        )
        const byId = new Map(
          uploads.map((result, index) => [selected[index]!.id, result]),
        )
        readyMedia = mediaItems.map((item) => {
          const result = byId.get(item.id)
          if (!result) return item
          if (result.status === 'rejected')
            return { ...item, status: 'upload-error' as const }
          return {
            ...item,
            status: 'uploaded' as const,
            storageKey: result.value.uploaded.storageKey,
            url: result.value.uploaded.url,
          }
        })
        setMediaItems(readyMedia)
        if (uploads.some((result) => result.status === 'rejected')) {
          setError(
            'Частина фото не завантажилася. Повторіть завантаження або приберіть ці файли.',
          )
          return
        }
      }
      request.photoKeys = committedPhotoKeys(readyMedia)
      /**
       * The vehicle list and the yard's catalogue are separate, so the chosen
       * names are looked up before anything is sent — a make the yard has
       * never seen would otherwise be stored as nothing at all.
       */
      // Nothing filled in means nothing to look up — and no round trip.
      const resolved =
        filledRows(compatRows).length === 0
          ? ({ kind: 'none' } as const)
          : await resolveCompatibility(compatRows, { signal: scope.signal })
      if (resolved.kind === 'unknown') {
        setError(unknownBrandsMessage(resolved.brands))
        return
      }
      /**
       * Sending the list with the part makes Core take it as the whole truth
       * and skip the row it would otherwise observe from the donor car. So a
       * car-sourced part is created bare — keeping that donor row — and the
       * rows are replaced afterwards, which leaves the donor alone.
       */
      const replaceAfterwards = values.sourceType === 'car'
      if (resolved.kind === 'ready' && !replaceAfterwards)
        request.compatibilities = resolved.items
      const created = await partsApi.create(request, { signal: scope.signal })
      if (resolved.kind === 'ready' && replaceAfterwards) {
        const current = await partsApi.compatibilities(created.id, {
          signal: scope.signal,
        })
        await partsApi.replaceCompatibilities(
          created.id,
          current.version,
          resolved.items,
        )
      }
      setStatus('Деталь створено.')
    } catch {
      setError(
        'Не вдалося створити деталь. Перевірте зв’язок і надішліть форму ще раз.',
      )
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  // The footer says the single next thing to fix, in the order the form reads.
  const archivedMessage =
    'Автомобіль в архіві — нові деталі до нього не додаються. Оберіть інше авто.'
  const blocking = {
    ...partFieldErrors(values, { requireSource }),
    ...(archivedSource ? { sourceId: archivedMessage } : {}),
  }
  const footerNote = mediaPending
    ? 'Дочекайтеся, доки завантажаться всі фото.'
    : (blocking.name ??
      blocking.quantity ??
      blocking.sourceId ??
      blocking.desiredSalePrice ??
      rowsProblem(compatRows) ??
      'Фото можна додати пізніше.')
  const ready =
    Object.keys(blocking).length === 0 && rowsProblem(compatRows) === null

  return (
    <Sheet
      description={
        <>
          Обовʼязкові поля позначені <span className="text-brand">*</span>.
          Решту можна заповнити пізніше.
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2.5">
          <p
            className={cn(
              'min-w-0 text-[12px] text-pretty',
              ready ? 'text-app-muted' : 'text-state-warn',
            )}
          >
            {footerNote}
          </p>
          <div className="ml-auto flex items-center gap-2.5">
            <Button asChild disabled={pending}>
              <Link to="..">Скасувати</Link>
            </Button>
            <Button
              aria-busy={pending || mediaPending}
              disabled={pending || mediaPending}
              form={CREATE_PART_FORM}
              type="submit"
              variant="primary"
            >
              Створити деталь
            </Button>
          </div>
        </div>
      }
      eyebrow="Склад · Деталі"
      onOpenChange={(next: boolean) => {
        if (!next && !pending) void navigate('..')
      }}
      open
      size="lg"
      title={title}
    >
      <form
        className="grid"
        id={CREATE_PART_FORM}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <PartFields
          canViewCars={canViewCars}
          canViewIntakes={canViewIntakes}
          compatibility={{ rows: compatRows, setRows: setCompatRows }}
          errors={
            archivedSource ? { ...errors, sourceId: archivedMessage } : errors
          }
          setValues={setValues}
          sourceOptions={sourceOptions}
          values={values}
          variant="plain"
        />
        <PartMediaFields
          deferUploads
          items={mediaItems}
          requireLatestMutation={requireLatestMutation}
          setItems={setMediaItems}
          title={
            <span className="flex items-baseline gap-2.5">
              <span className="text-app-dim font-mono text-[11px]">06</span>
              Фото
            </span>
          }
          variant="plain"
        />
        {status ? <Notice tone="ok">{status}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Sheet>
  )
}

const CREATE_PART_FORM = 'create-part-form'

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
  const mediaPending = mediaItems.some((item) => item.status !== 'uploaded')
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
          unit: 'шт',
          condition: part.condition,
          notes: part.notes ?? '',
          oemCode: part.oemCode ?? '',
          partType: part.partType ?? '',
          desiredSalePrice:
            part.desiredSalePrice == null ? '' : String(part.desiredSalePrice),
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
      await partsApi.update(
        partId,
        {
          name: values.name.trim(),
          condition: optional(values.condition) ?? null,
          notes: optional(values.notes) ?? null,
          quantity: parsed.quantity,
          partType: optional(values.partType) ?? null,
          unit: 'шт',
          photoKeys: committedPhotoKeys(mediaItems),
          desiredSalePrice: {
            isSet: true,
            value: parsed.price ?? null,
          },
        },
        { signal: scope.signal },
      )
      setStatus('Зміни збережено.')
    } catch {
      setError(
        'Не вдалося зберегти зміни. Перевірте зв’язок і надішліть форму ще раз.',
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

      <div className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
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
                <div className="grid gap-4">
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
                    <Field
                      hint="Редагування OEM поки не приймає сервер"
                      label="OEM-код"
                    >
                      <TextInput
                        className="font-mono"
                        disabled
                        name="oemCode"
                        value={values.oemCode}
                      />
                    </Field>
                  </div>
                  <Field label="Нотатки">
                    <TextArea
                      className="resize-none"
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
                </div>
              </Card>

              <Card title="Стан деталі">
                <div className="grid gap-4">
                  <p className="text-app-muted text-sm">
                    Оберіть один із трьох сталих станів деталі.
                  </p>
                  <PillGroup
                    className="flex-wrap"
                    label="Стан деталі"
                    onChange={(next) =>
                      setValues((current) =>
                        current ? { ...current, condition: next } : current,
                      )
                    }
                    options={PART_CONDITIONS}
                    value={values.condition}
                  />
                </div>
              </Card>

              <Card title="Кількість і ціна">
                <p className="text-app-muted text-sm">
                  Скільки одиниць на складі та за скільки їх продавати.
                </p>
                <div className="grid items-start gap-4 sm:grid-cols-3">
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
                  <Field hint="Фіксована одиниця обліку" label="Одиниця">
                    <TextInput name="unit" readOnly value="шт" />
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
                    ? 'Деталь у резерві під замовлення — сервер відхилить видалення.'
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
