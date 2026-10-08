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
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/components/app/format'
import {
  commonMessages,
  translate,
  useFormat,
  useLocale,
  useT,
  type Locale,
  type Translate,
} from '@/i18n'
import { partsListMessages } from './parts-list-messages'
import { partDetailMessages } from './part-detail-messages'
import { partFormMessages } from './part-form-messages'
import {
  conditionLabel,
  conditionPhrase,
  historyChange,
  historyDetails,
  historyKind,
  type HistoryKind,
  historyLabel,
  originLabel,
  PIECES_UNIT,
  sourceLabel,
  unitLabel,
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
  type PartCompatibilities,
} from '@/api/parts'
import { carsApi, type Car, type CarListItem } from '@/api/cars'
import { intakesApi, type IntakeListItem } from '@/api/intakes'
import { mediaApi } from '@/api/media'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { FeatureGate } from '../FeatureFlags'
import { FEATURE_FLAGS } from '@/api/feature-flags'
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
import type { SupportedCurrency } from '@/i18n'
import { MoneyInput } from '../currency/price-currency'
import {
  useAccountingCurrency,
  useFirstPriceGuard,
} from '../currency/use-accounting-currency'
import { usePriceSlots, type PriceSlots } from '../currency/use-price-slots'
import { amountPrecisionError } from '../currency/amount-precision'
import { isLostResponse, lostResponseMessages } from '../lost-response'
import { OnboardingCompletedNotice } from '../onboarding/first-part-completion'
import { useFirstPartCompletion } from '../onboarding/use-first-part-completion'

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
  locale: Locale,
): { label: string; tone: StatusTone } => {
  const label = (key: 'statusAvailable' | 'statusReserved' | 'statusSold') =>
    translate(partsListMessages, locale, key)
  if (status === 'available')
    return { label: label('statusAvailable'), tone: 'ok' }
  if (status === 'reserved')
    return { label: label('statusReserved'), tone: 'warn' }
  if (status === 'sold') return { label: label('statusSold'), tone: 'danger' }
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
const intakeLabel = (intake: IntakeListItem, locale: Locale) =>
  `${intake.name ?? translate(partFormMessages, locale, 'intakeNoName')} · ${intake.supplier ?? translate(partFormMessages, locale, 'intakeNoSupplier')}`

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
  const t = useT(partsListMessages)
  const message =
    decision.kind === 'quota-exhausted'
      ? t('accessQuota')
      : decision.kind === 'subscription-blocked'
        ? t('accessSubscription')
        : decision.kind === 'access-loading'
          ? t('accessLoading')
          : decision.kind === 'access-error'
            ? t('accessError')
            : t('accessDenied')
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
  const t = useT(partsListMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const { partId } = useParams<{ partId: string }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<PartSearchItem[]>([])
  const [facets, setFacets] = useState<PartFacets | null>(null)
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
      ])
        .then(([page, nextFacets]) => {
          if (controller.signal.aborted) return
          setItems(page.items)
          setPageMeta({ page: page.page, totalPages: page.totalPages })
          setFacets(nextFacets)
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
        title={translate(partFormMessages, locale, 'newPart')}
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
      return t('rowSaveFailed')
    }
  }

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        {removedOrigin ? (
          <Notice tone="info">{t('removedOrigin')}</Notice>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
              {t('eyebrow')}
            </p>
            <h1 className="mt-1.5 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
              {t('title')}
            </h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
            {manageDecision.kind === 'allowed' ? (
              <FeatureGate name={FEATURE_FLAGS.partsBulkImport}>
                <Button asChild>
                  <Link to="imports">{t('importParts')}</Link>
                </Button>
              </FeatureGate>
            ) : null}
            {createDecision.kind === 'allowed' ? (
              <Button
                asChild
                className="px-5 text-sm font-bold"
                variant="primary"
              >
                <Link to="new">
                  <Plus aria-hidden />
                  {t('addPart')}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <span className="border-app-line bg-app-raised focus-within:border-app-line-2 flex h-13 items-center gap-3 rounded-[14px] border px-4">
          <Search aria-hidden className="text-app-dim size-4 shrink-0" />
          <input
            aria-label={t('searchLabel')}
            className="text-app-ink placeholder:text-app-dim min-w-0 flex-1 bg-transparent text-sm outline-none"
            name="q"
            onChange={(event) => updateFilter('q', event.target.value)}
            placeholder={t('searchPlaceholder')}
            value={filters.q ?? ''}
          />
        </span>

        <div className="flex flex-wrap items-start gap-6">
          <aside className="border-app-line bg-app-raised grid min-w-0 flex-[0_1_320px] gap-6 rounded-[20px] border p-5 sm:min-w-[260px]">
            <FilterGroup label={t('filterStatus')}>
              <FilterRow
                active={filters.status === ''}
                count={statusTotal}
                dot="bg-app-dim"
                label={t('all')}
                onSelect={() => updateFilter('status', '')}
              />
              {[
                {
                  value: 'available',
                  label: t('statusInStock'),
                  dot: 'bg-state-ok',
                },
                {
                  value: 'reserved',
                  label: t('statusReserved'),
                  dot: 'bg-state-warn',
                },
                {
                  value: 'sold',
                  label: t('statusSold'),
                  dot: 'bg-state-danger',
                },
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

            <FilterGroup label={t('filterCompatibility')}>
              <SelectInput
                aria-label={t('make')}
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
                <option value="">{t('makeAny')}</option>
                {facetOptions('makes')}
              </SelectInput>
              <SelectInput
                aria-label={t('model')}
                className={filters.makeId ? undefined : 'opacity-55'}
                disabled={!filters.makeId}
                name="model"
                onChange={(event) => updateFilter('model', event.target.value)}
                title={filters.makeId ? undefined : t('chooseMakeFirst')}
                value={filters.modelId}
              >
                <option value="">{t('modelAny')}</option>
                {facetOptions('models')}
              </SelectInput>
            </FilterGroup>

            <FilterGroup label={t('filterPlacement')}>
              <SelectInput
                aria-label={t('warehouse')}
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
                <option value="">{t('warehouseAll')}</option>
                {facetOptions('warehouses')}
              </SelectInput>
              <SelectInput
                aria-label={t('zone')}
                className={filters.warehouseId ? undefined : 'opacity-55'}
                disabled={!filters.warehouseId}
                name="zone"
                onChange={(event) => updateFilter('zone', event.target.value)}
                title={
                  filters.warehouseId ? undefined : t('chooseWarehouseFirst')
                }
                value={filters.zoneId}
              >
                <option value="">{t('zoneAll')}</option>
                {facetOptions('zones')}
              </SelectInput>
            </FilterGroup>

            <FilterGroup label={t('filterCondition')}>
              <FilterRow
                active={filters.condition === ''}
                count={facetTotal('conditions')}
                dot="bg-transparent"
                label={t('all')}
                onSelect={() => updateFilter('condition', '')}
              />
              {(facets?.conditions ?? []).map((value) => (
                <FilterRow
                  active={filters.condition === value.id}
                  count={value.count}
                  dot="bg-transparent"
                  key={value.id}
                  label={conditionLabel(value.id, locale)}
                  onSelect={() => updateFilter('condition', value.id)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label={t('filterOrigin')}>
              <FilterRow
                active={filters.origin === ''}
                count={facetTotal('origins')}
                dot="bg-transparent"
                label={t('all')}
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
                    label={originLabel(value.id, value.name, locale)}
                    onSelect={() => updateFilter('origin', value.id)}
                  />
                ))}
            </FilterGroup>

            <Button
              className="w-full text-sm font-semibold"
              disabled={activeFilters.length === 0}
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              {t('resetFilters')}
            </Button>
          </aside>

          <div className="grid min-w-0 flex-[1_1_320px] gap-4">
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
              <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="text-app-muted flex items-baseline gap-2 text-sm">
                  <span className="text-[22px] font-bold text-white tabular-nums">
                    {statusTotal ?? 0}
                  </span>
                  {t('totalAll')}
                </span>
                <span className="text-app-muted flex items-baseline gap-2 text-sm">
                  <span className="text-state-ok text-[22px] font-bold tabular-nums">
                    {facetCount('statuses', 'available') ?? 0}
                  </span>
                  {t('totalAvailable')}
                </span>
                <span className="text-app-muted flex items-baseline gap-2 text-sm">
                  <span className="text-state-warn text-[22px] font-bold tabular-nums">
                    {facetCount('statuses', 'reserved') ?? 0}
                  </span>
                  {t('totalReserved')}
                </span>
                <span className="text-app-muted flex items-baseline gap-2 text-sm">
                  <span className="text-state-danger text-[22px] font-bold tabular-nums">
                    {facetCount('statuses', 'sold') ?? 0}
                  </span>
                  {t('totalSold')}
                </span>
              </p>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                <span className="text-app-dim font-mono text-[11px] tracking-[0.14em] uppercase">
                  {t('pageSize')}
                </span>
                <PillGroup
                  label={t('pageSizeLabel')}
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
                    ? t('networkDescription')
                    : t('serverDescription')
                }
                onRetry={() =>
                  setSearchParams(new URLSearchParams(searchParams))
                }
                title={
                  error.kind === 'network' || error.kind === 'timeout'
                    ? t('networkTitle')
                    : t('serverTitle')
                }
              />
            ) : (
              <>
                <div className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border">
                  <DataTable
                    caption={t('tableCaption')}
                    columns={[
                      {
                        key: 'name',
                        label: t('colPart'),
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
                        label: t('colCar'),
                        cell: (part) =>
                          part.car
                            ? `${part.car.make} ${part.car.model} · ${String(part.car.year)}`
                            : '—',
                      },
                      {
                        key: 'status',
                        label: t('colStatus'),
                        cell: (part) => {
                          const presentation = statusPresentation(
                            part.status ?? '',
                            locale,
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
                        label: t('colTotal'),
                        align: 'end',
                        cell: (part) => (
                          <InlineEdit
                            inputMode="numeric"
                            label={t('quantityLabel', { name: part.name })}
                            onCommit={(next) =>
                              rewritePart(part.id, (current) => {
                                const quantity = Number(next.trim())
                                return Number.isInteger(quantity) &&
                                  quantity >= 0
                                  ? { ...current, quantity }
                                  : t('quantityInvalid')
                              })
                            }
                            value={String(part.quantity)}
                            {...(canManage
                              ? {}
                              : {
                                  unavailable: t('noManageRight'),
                                })}
                            {...(part.isInventoryLocked
                              ? {
                                  unavailable: t('inventoryLocked'),
                                }
                              : {})}
                          >
                            {part.quantity}
                          </InlineEdit>
                        ),
                      },
                      {
                        key: 'available',
                        label: t('colAvailable'),
                        align: 'end',
                        cell: (part) => part.quantityAvailable,
                      },
                      {
                        key: 'reserved',
                        label: t('colReserved'),
                        align: 'end',
                        cell: (part) => part.quantityReserved,
                      },
                    ]}
                    empty={
                      <EmptyState
                        description={
                          activeFilters.length > 0
                            ? t('emptyFilteredDescription')
                            : t('emptyDescription')
                        }
                        title={
                          activeFilters.length > 0
                            ? t('emptyFilteredTitle')
                            : t('emptyTitle')
                        }
                      />
                    }
                    footer={
                      pageMeta ? (
                        <nav
                          aria-label={t('pagination')}
                          className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4"
                        >
                          <p className="text-app-dim text-[14px]">
                            {t('pageOf', {
                              page: pageMeta.page,
                              total: pageMeta.totalPages,
                            })}
                          </p>
                          <span className="flex items-center gap-2.5">
                            <Button
                              aria-label={t('previousPage')}
                              className="px-4 text-sm font-semibold"
                              disabled={pageMeta.page <= 1}
                              onClick={() => updatePage(pageMeta.page - 1)}
                            >
                              <ChevronLeft aria-hidden />
                              {tc('back')}
                            </Button>
                            <Button
                              aria-label={t('nextPage')}
                              className="px-4 text-sm font-semibold"
                              disabled={pageMeta.page >= pageMeta.totalPages}
                              onClick={() => updatePage(pageMeta.page + 1)}
                            >
                              {tc('next')}
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

/** The conditions the yard sorts by, in the server's own vocabulary. */
const PART_CONDITION_VALUES = ['good', 'fair', 'scrap'] as const

const partConditions = (locale: Locale) =>
  PART_CONDITION_VALUES.map((value) => ({
    value,
    label: conditionLabel(value, locale),
  }))

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
  const t = useT(partDetailMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const format = useFormat()
  const { currency: partCurrency } = useAccountingCurrency()
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [copied, setCopied] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  const remove = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const scope = requireLatestMutation({ quota: false })
      await partsApi.delete(partId, { signal: scope.signal })
      setConfirmingDelete(false)
      void navigate(base, { replace: true })
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
      setDeleteError(status === 409 ? t('deleteConflict') : t('deleteFailed'))
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
    const date = format.date(event.createdAt) ?? event.createdAt
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
      setCopied({ ok: true, text: t('copied') })
    } catch {
      setCopied({ ok: false, text: t('copyFailed') })
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
            {t('backToWarehouse')}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>{t('breadcrumbWarehouse')}</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>{t('breadcrumbParts')}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild className="px-4 text-sm font-semibold">
            <Link to={`/app/${tenantSlug}/stickers?part=${partId ?? ''}`}>
              {t('printSticker')}
            </Link>
          </Button>
          {canManage ? (
            <>
              <Button asChild className="px-4 text-sm font-semibold">
                <Link to={`${base}/${partId}/edit`}>{tc('edit')}</Link>
              </Button>
              <Button disabled title={t('addToOrderHint')} variant="primary">
                {t('addToOrder')}
              </Button>
              <ActionMenu
                actions={[
                  {
                    key: 'delete',
                    label: t('deletePart'),
                    icon: <Trash2 aria-hidden className="size-4" />,
                    destructive: true,
                    disabled: deleting,
                    onSelect: () => setConfirmingDelete(true),
                  },
                ]}
                label={t('moreActions')}
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
          <Notice tone={copied.ok ? 'ok' : 'danger'}>{copied.text}</Notice>
        )}

        <div className="min-w-0">
          {detail === null ? null : (
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={statusPresentation(detail.status, locale).tone}>
                {statusPresentation(detail.status, locale).label}
              </StatusPill>
              {detail.quantityReserved > 0 && detail.quantityAvailable > 0 ? (
                <StatusPill tone="warn">
                  {t('reservedCount', { count: detail.quantityReserved })}
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
                {conditionPhrase(detail.condition, locale)}
              </span>
            </div>
          )}
          <h1 className="mt-3.5 text-[38px] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance text-white sm:text-[46px] lg:text-[48px]">
            {detail === null ? t('titleFallback') : detail.name}
          </h1>
          {detail === null ? null : (
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              {detail.qrCode ? (
                <CodeChip
                  code={detail.qrCode}
                  label={t('copyCode')}
                  onCopy={() => {
                    void copyCode(detail.qrCode)
                  }}
                />
              ) : null}
              {detail.oemCode ? (
                <span className="text-app-muted font-mono text-[13px]">
                  {t('oem', { code: detail.oemCode })}
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
                      (detail.carCode ?? t('sourceCarFallback'))
                    : detail.intakeId
                      ? t('sourceIntake')
                      : t('sourceNone')
                }
              />
            </div>
          )}
        </div>

        {error ? (
          <ErrorState
            description={t('loadErrorDescription')}
            title={t('loadErrorTitle')}
          />
        ) : detail === null ? (
          <SkeletonRows columns={2} label={t('loading')} rows={4} />
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-start gap-6">
              <div className="flex min-w-[320px] flex-[1_1_560px] flex-col gap-6">
                <Card
                  aside={
                    <span className="text-app-dim font-mono text-[12px] tracking-[0.1em] uppercase">
                      {t('photosCount', { count: detail.photos.length })}
                    </span>
                  }
                  bodyClassName="p-0"
                  className="min-w-[320px] flex-[1_1_620px]"
                  headerClassName="pb-4"
                  title={t('photos')}
                >
                  <Gallery
                    emptyLabel={t('galleryEmpty')}
                    label={t('galleryLabel', { name: detail.name })}
                    photos={detail.photos.map((photo, index) => ({
                      id: photo.id,
                      url: photo.url,
                      ...(photo.thumbnailUrl
                        ? { thumbnailUrl: photo.thumbnailUrl }
                        : {}),
                      alt: t('photoAlt', {
                        name: detail.name,
                        index: index + 1,
                      }),
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
                        <Link to={`${base}/${partId}/edit`}>{t('change')}</Link>
                      </Button>
                    ) : null
                  }
                  title={t('salePrice')}
                >
                  {detail.effectiveSalePrice === null ? (
                    <div className="border-state-warn/25 bg-state-warn/[0.07] flex flex-wrap items-center justify-between gap-4 rounded-[12px] border px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="text-state-warn text-[14px] font-bold">
                          {t('noPriceTitle')}
                        </p>
                        <p className="text-app-muted mt-1 text-[13px] leading-[1.45] text-pretty">
                          {t('noPriceBody')}
                        </p>
                      </div>
                      {canManage ? (
                        <Button asChild variant="primary">
                          <Link to={`${base}/${partId}/edit`}>
                            {t('setPrice')}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="flex items-baseline gap-2.5">
                        <Amount
                          className="font-mono text-[30px] font-medium tracking-[-0.01em] text-white"
                          currency={partCurrency}
                          currencyDisplay="code"
                          value={detail.effectiveSalePrice}
                        />
                        <span className="text-app-muted text-[13px]">
                          {t('perUnit', {
                            unit: unitLabel(detail.unit, locale),
                          })}
                        </span>
                      </p>
                      <p className="text-app-muted mt-1.5 text-[13px]">
                        {detail.quantityAvailable > 0 ? (
                          <>
                            {t('freeStockWorth')}{' '}
                            <Amount
                              currency={partCurrency}
                              currencyDisplay="code"
                              value={
                                detail.effectiveSalePrice *
                                detail.quantityAvailable
                              }
                            />
                            {detail.quantityReserved > 0
                              ? t('moreReserved', {
                                  count: detail.quantityReserved,
                                  unit: unitLabel(detail.unit, locale),
                                })
                              : ''}
                          </>
                        ) : detail.quantityReserved > 0 ? (
                          t('noneFreeReserved', {
                            count: detail.quantityReserved,
                            unit: unitLabel(detail.unit, locale),
                          })
                        ) : (
                          t('allSold')
                        )}
                      </p>
                      {detail.desiredSalePrice !== null &&
                      detail.desiredSalePrice !== detail.effectiveSalePrice ? (
                        <p className="text-app-dim mt-1 text-[12.5px]">
                          {t('desired')}{' '}
                          <Amount
                            currency={partCurrency}
                            currencyDisplay="code"
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
                      {t('received', {
                        count: detail.quantityTotal,
                        unit: unitLabel(detail.unit, locale),
                      })}
                    </span>
                  }
                  title={t('stock')}
                >
                  <dl className="grid gap-2 sm:grid-cols-3">
                    <StockTile
                      label={t('tileAvailable')}
                      sub={
                        detail.quantityAvailable > 0
                          ? t('canSell')
                          : t('noneFree')
                      }
                      tone="ok"
                      value={detail.quantityAvailable}
                    />
                    <StockTile
                      label={t('tileReserved')}
                      sub={
                        detail.quantityReserved > 0
                          ? t('ordersCount', { count: reservations.length })
                          : t('none')
                      }
                      tone="warn"
                      value={detail.quantityReserved}
                    />
                    <StockTile
                      label={t('tileSold')}
                      sub={
                        detail.quantitySoldTotal > 0
                          ? t('ordersCount', { count: soldOrders.length })
                          : t('neverSold')
                      }
                      tone="plain"
                      value={detail.quantitySoldTotal}
                    />
                  </dl>

                  {detail.quantityAvailable === 1 ? (
                    <p className="text-app-muted mt-3 text-[13px]">
                      {t('lastUnit')}
                    </p>
                  ) : detail.quantityAvailable === 0 &&
                    detail.quantityReserved > 0 ? (
                    <p className="text-state-warn mt-3 text-[13px] text-pretty">
                      {t('allReserved')}
                    </p>
                  ) : null}

                  <div className="border-app-line mt-[18px] flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                    <div className="min-w-0">
                      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                        {t('placement')}
                      </p>
                      <p className="text-app-ink mt-1.5 text-[15px] font-semibold text-pretty">
                        {detail.quantityAvailable + detail.quantityReserved ===
                        0
                          ? t('notInStock', {
                              place: placementLabel(
                                zones,
                                links.inventory,
                                t,
                              ).toLocaleLowerCase(locale),
                            })
                          : placementLabel(zones, links.inventory, t)}
                      </p>
                    </div>
                    {links.inventory ? (
                      <Button
                        asChild
                        className="min-h-9 px-3 text-[12px] font-bold"
                      >
                        <Link to={`${base}/${partId}/inventory`}>
                          {t('move')}
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
                      <dt className="text-app-muted text-[13px]">
                        {t('revenue')}
                      </dt>
                      <dd className="font-mono text-[17px] font-medium text-white">
                        <Amount
                          currency={partCurrency}
                          currencyDisplay="code"
                          value={soldRevenue}
                        />
                      </dd>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                      <dt className="text-app-muted text-[13px]">
                        {t('reservedWorth')}
                      </dt>
                      <dd
                        className="text-app-dim font-mono text-[17px] font-medium"
                        title={t('reserveNoPrice')}
                      >
                        —
                      </dd>
                    </div>
                    <div className="flex items-baseline gap-2.5">
                      <dt className="text-app-muted text-[13px]">
                        {t('discounts')}
                      </dt>
                      <dd
                        className={cn(
                          'font-mono text-[17px] font-medium',
                          soldDiscount > 0 ? 'text-state-warn' : 'text-app-dim',
                        )}
                      >
                        <Amount
                          currency={partCurrency}
                          currencyDisplay="code"
                          value={soldDiscount}
                        />
                      </dd>
                    </div>
                  </dl>
                }
                bodyClassName="p-0"
                headerClassName="pb-0"
                title={t('sales')}
              >
                <div
                  aria-label={t('salesTabs')}
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
                        {t(tab.label)}
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
                      ? t('noReserves')
                      : t('notSoldYet')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
                      <caption className="sr-only">{t('salesCaption')}</caption>
                      <thead>
                        <tr className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
                          <th className="px-6 pt-4 pb-3 font-normal">
                            {t('colOrder')}
                          </th>
                          <th className="px-3 pt-4 pb-3 font-normal">
                            {t('colCustomer')}
                          </th>
                          <th className="px-3 pt-4 pb-3 font-normal">
                            {t('colStatus')}
                          </th>
                          <th className="px-3 pt-4 pb-3 text-right font-normal">
                            {t('colQuantity')}
                          </th>
                          <th className="px-3 pt-4 pb-3 text-right font-normal">
                            {t('colPrice')}
                          </th>
                          <th className="px-3 pt-4 pb-3 text-right font-normal">
                            {t('colSum')}
                          </th>
                          <th className="px-6 pt-4 pb-3 font-normal">
                            <span className="sr-only">{tc('actions')}</span>
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
                                  {t('orderNumber', {
                                    number: String(row.orderNumber),
                                  })}
                                </span>
                              ) : (
                                <Link
                                  className="text-brand font-mono text-[15px] underline-offset-4 hover:underline"
                                  to={orderHref(row.orderId) ?? '#'}
                                >
                                  {t('orderNumber', {
                                    number: String(row.orderNumber),
                                  })}
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
                                {row.customerName ?? t('noCustomer')}
                              </span>
                              <span
                                className="text-app-dim mt-1 block text-[13px]"
                                title={t('deliveryNotOnPart')}
                              >
                                {t('deliveryHidden')}
                              </span>
                            </td>
                            <td className="px-3 py-4">
                              <StatusPill
                                tone={row.kind === 'reserved' ? 'warn' : 'ok'}
                              >
                                {row.kind === 'reserved'
                                  ? t('reserve')
                                  : t('sold')}
                              </StatusPill>
                              <span
                                className="text-app-dim mt-1.5 block text-[13px] text-pretty"
                                title={
                                  row.kind === 'reserved'
                                    ? t('reserveNoTerm')
                                    : undefined
                                }
                              >
                                {row.kind === 'reserved'
                                  ? t('reserveHolds')
                                  : t('saleClosed')}
                              </span>
                            </td>
                            <td className="text-app-ink px-3 py-4 text-right font-mono text-[15px]">
                              {row.quantity}
                            </td>
                            <td className="px-3 py-4 text-right">
                              <span className="text-app-ink block font-mono text-[15px]">
                                {row.unitPrice === null ? (
                                  <span title={t('reserveNoPrice')}>—</span>
                                ) : (
                                  <Amount
                                    currency={partCurrency}
                                    currencyDisplay="code"
                                    value={row.unitPrice}
                                  />
                                )}
                              </span>
                              {row.discount > 0 ? (
                                <span className="text-state-warn mt-1 block font-mono text-[12px]">
                                  −
                                  <Amount
                                    currency={partCurrency}
                                    currencyDisplay="code"
                                    value={row.discount}
                                  />
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-4 text-right font-mono text-[15px] text-white">
                              {row.unitPrice === null ? (
                                <span
                                  className="text-app-dim"
                                  title={t('reserveNoPrice')}
                                >
                                  —
                                </span>
                              ) : (
                                <Amount
                                  currency={partCurrency}
                                  currencyDisplay="code"
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
                                    ? t('reserveNoTerm')
                                    : t('returnNotFromPart')
                                }
                              >
                                {row.kind === 'reserved'
                                  ? t('extend')
                                  : t('return')}
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
                              ? t('totalReserved')
                              : t('totalSold')}
                          </td>
                          <td className="px-3 py-4 text-right font-mono text-[17px] font-medium text-white">
                            {salesTab === 'reserved' ? (
                              <span
                                className="text-app-dim"
                                title={t('reserveNoPrice')}
                              >
                                —
                              </span>
                            ) : (
                              <Amount
                                currency={partCurrency}
                                currencyDisplay="code"
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
                        {t('carsCount', { count: compat.items.length })}
                      </span>
                    )
                  }
                  bodyClassName="p-0"
                  headerClassName="pb-3.5"
                  title={t('compatibility')}
                >
                  {compat === null ? (
                    <p className="text-app-muted px-6 pb-5 text-[13px]">
                      {t('loadingShort')}
                    </p>
                  ) : compat.items.length === 0 ? (
                    <p className="text-app-muted px-6 pb-5 text-[13px] leading-5 text-pretty">
                      {t('compatEmpty')}
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
                                ? t('donorReadonly')
                                : item.modelName === null
                                  ? t('anyModel')
                                  : ''}
                            </span>
                          </span>
                          <span className="text-app-ink font-mono text-[13px] whitespace-nowrap">
                            {yearSpan(item.yearFrom, item.yearTo, t)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title={t('notes')}>
                  {detail.notes ? (
                    <p className="text-app-ink text-[15px] leading-[1.55] whitespace-pre-line text-pretty">
                      {detail.notes}
                    </p>
                  ) : (
                    <p className="text-app-muted text-[14px]">
                      {t('notesEmpty')}
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
                        {t('createdBy')}{' '}
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
                        aria-label={t('historyFilters')}
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
                              {t(filter.label)}
                            </button>
                          )
                        })}
                      </div>
                    )
                  }
                  bodyClassName="p-0"
                  headerClassName="pb-3"
                  title={t('history')}
                >
                  {history === null ? (
                    <div className="px-6 pb-6">
                      <SkeletonRows
                        columns={1}
                        label={t('loadingHistory')}
                        rows={3}
                      />
                    </div>
                  ) : shownHistory.length === 0 ? (
                    <p className="text-app-muted px-6 pb-5 text-[13px] text-pretty">
                      {history.events.length === 0
                        ? t('historyEmpty')
                        : t('historyFilteredEmpty')}
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
                              const facts = historyDetails(event.data, locale)
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
                                      {historyLabel(event.eventType, locale)}
                                      {event.order ? (
                                        <>
                                          {' '}
                                          <span className="text-brand font-mono text-[13px]">
                                            {t('orderNumber', {
                                              number: String(
                                                event.order.number,
                                              ),
                                            })}
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
                                    {format.time(event.createdAt) ?? ''}
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
                        ? t('collapse')
                        : t('showAll', { count: filteredHistory.length })}
                    </Button>
                  ) : null}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        confirmLabel={tc('delete')}
        consequence={t('deleteConsequence')}
        error={deleteError}
        onConfirm={() => void remove()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pending={deleting}
        title={t('deleteTitle')}
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
  unit: PIECES_UNIT,
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

const mediaMetaLabel = (item: PartMediaItem, locale: Locale) =>
  item.file
    ? formatFileSize(item.file.size, locale)
    : translate(partFormMessages, locale, 'savedPhoto')

/** Section of a form: one heading, one purpose, one surface. */
function PartMediaFields({
  deferUploads = false,
  items,
  requireLatestMutation,
  setItems,
  title,
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
  const t = useT(partFormMessages)
  const { locale } = useLocale()
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
    if (item.status === 'selected') return t('mediaSelected')
    if (item.status === 'uploading') return t('mediaUploading')
    if (item.status === 'uploaded') return t('mediaUploaded')
    if (item.status === 'upload-error') return t('mediaUploadError')
    if (item.status === 'removing') return t('mediaRemoving')
    return t('mediaRemoveError')
  }
  const failed = items.some(
    (item) => item.status === 'upload-error' || item.status === 'remove-error',
  )
  return (
    <SectionPanel
      description={
        deferUploads ? t('mediaDeferDescription') : t('mediaDescription')
      }
      title={title ?? t('photos')}
      variant={variant}
    >
      <Field hint={t('photoHint')} label={t('photoLabel')}>
        <PhotoFileField
          aria-label={t('photoLabel')}
          multiple
          onChange={(event) => {
            addFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
      </Field>
      {failed ? (
        <Notice role="status" tone="warn">
          {t('mediaFailed')}
        </Notice>
      ) : null}
      {items.length ? (
        <ul aria-label={t('selectedPhotos')} className="grid gap-2">
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
                    alt={t('previewAlt', { name: item.name })}
                    className="size-14 shrink-0 rounded-control object-cover"
                    src={previewUrl}
                  />
                ) : null}
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-app-ink text-[14.5px] break-words">
                    {item.name} · {statusLabel(item)}
                  </p>
                  <p className="text-app-dim text-[12.5px]">
                    {mediaMetaLabel(item, locale)}
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
                      aria-label={t('retryName', { name: item.name })}
                      onClick={() => void upload(item)}
                    >
                      {t('retry')}
                    </Button>
                  ) : null}
                  {item.status === 'remove-error' ? (
                    <Button
                      aria-label={t('retryRemoveName', { name: item.name })}
                      onClick={() => void remove(item)}
                    >
                      {t('retryRemove')}
                    </Button>
                  ) : null}
                  {item.status !== 'uploading' && item.status !== 'removing' ? (
                    <Button
                      aria-label={t('removeName', { name: item.name })}
                      onClick={() => void remove(item)}
                      variant="danger"
                    >
                      {t('remove')}
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-app-dim text-[13.5px]">{t('noPhotos')}</p>
      )}
    </SectionPanel>
  )
}

type PartFieldErrors = Partial<
  Record<'name' | 'quantity' | 'desiredSalePrice' | 'sourceId', string>
>

function partFieldErrors(
  values: PartFormValues,
  {
    requireSource,
    locale,
    currency = null,
  }: {
    requireSource: boolean
    locale: Locale
    /** Accounting currency: the price keeps to its precision, as in Core. */
    currency?: string | null
  },
): PartFieldErrors {
  const t = (
    key:
      | 'nameRequired'
      | 'quantityInvalid'
      | 'priceInvalid'
      | 'chooseCar'
      | 'chooseIntake',
  ) => translate(partFormMessages, locale, key)
  const errors: PartFieldErrors = {}
  if (!values.name.trim()) errors.name = t('nameRequired')
  const quantity = Number(values.quantity)
  if (!Number.isInteger(quantity) || quantity <= 0)
    errors.quantity = t('quantityInvalid')
  const price = optionalNumber(values.desiredSalePrice)
  if (price !== undefined && (!Number.isFinite(price) || price < 0))
    errors.desiredSalePrice = t('priceInvalid')
  else if (price !== undefined) {
    const precision = amountPrecisionError(price, currency, locale)
    if (precision !== null) errors.desiredSalePrice = precision
  }
  if (requireSource && !values.sourceId.trim())
    errors.sourceId =
      values.sourceType === 'car' ? t('chooseCar') : t('chooseIntake')
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
  const t = useT(partFormMessages)
  const { locale } = useLocale()
  const problem = rowProblem(row, locale)
  const title = t('vehicleN', { n: index + 1 })

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
            {t('remove')}
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <VehicleCatalogPicker
          disabled={false}
          label={t('make')}
          onSelect={(option) => {
            setMakeId(option.id)
            onChange({ brand: option.name, model: '' })
          }}
          type="make"
          value={row.brand}
        />
        <VehicleCatalogPicker
          disabled={row.brand === ''}
          label={t('model')}
          makeId={makeId}
          makeName={row.brand}
          onSelect={(option) => {
            onChange({ model: option.name })
          }}
          type="model"
          value={row.model}
        />
        <Field label={t('year')}>
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
  const t = useT(partDetailMessages)
  const Icon =
    kind === 'car' ? CarIcon : kind === 'batch' ? Package : CircleMinus
  const label = t(
    kind === 'car'
      ? 'sourceFromCar'
      : kind === 'batch'
        ? 'sourceBatch'
        : 'sourceUnknown',
  )
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

/*
 * What the sales table cannot promise (reserveNoPrice, reserveNoTerm, …): a
 * reservation is a line in an order, not a document of its own: it carries no
 * price until the order is confirmed, and the yard keeps no clock on it.
 */
const SALES_TABS = [
  { value: 'all', label: 'tabAll' },
  { value: 'reserved', label: 'tabReserved' },
  { value: 'sold', label: 'tabSold' },
] as const

/** How many events the history shows before it has to be asked for more. */
const HISTORY_LIMIT = 5

const HISTORY_FILTERS = [
  { value: 'all', label: 'filterAll' },
  { value: 'sale', label: 'filterSales' },
  { value: 'price', label: 'filterPrice' },
  { value: 'stock', label: 'filterStock' },
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

type DetailT = Translate<(typeof partDetailMessages)['uk']>

/**
 * A compatibility's years, as one span: a single year stays a single year.
 * Years go in as strings so no locale groups them like quantities.
 */
const yearSpan = (
  from: number | null,
  to: number | null,
  t: DetailT,
): string => {
  if (from === null && to === null) return t('anyYear')
  if (from !== null && to !== null)
    return from === to
      ? String(from)
      : t('yearRange', { from: String(from), to: String(to) })
  return from !== null
    ? t('yearFrom', { year: String(from) })
    : t('yearTo', { year: String(to ?? 0) })
}

/**
 * Where the part sits, in the words the warehouse uses. Core keeps a system
 * zone for everything nobody has placed yet, so that one reads as "not placed"
 * rather than as a location.
 */
const placementLabel = (
  zones: PartInventoryZone[] | null,
  allowed: boolean,
  t: DetailT,
): string => {
  if (!allowed) return t('placementNeedsModule')
  if (zones === null) return t('loadingShort')
  const placed = zones.filter((zone) => !zone.isSystemUnassigned)
  if (placed.length === 0) return t('notPlaced')
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
  { value: 'car', label: 'kindCarLabel', hint: 'kindCarHint' },
  { value: 'batch', label: 'kindBatchLabel', hint: 'kindBatchHint' },
] as const

/**
 * What each condition means for a buyer. The label alone is a guess; the line
 * under it is what stops "задовільний" and "на запчастини" being used
 * interchangeably.
 */
const CONDITION_HINTS: Record<
  string,
  { hint: 'hintGood' | 'hintFair' | 'hintScrap'; tone: string }
> = {
  good: { hint: 'hintGood', tone: 'border-state-ok bg-state-ok' },
  fair: { hint: 'hintFair', tone: 'border-state-warn bg-state-warn' },
  scrap: { hint: 'hintScrap', tone: 'border-state-danger bg-state-danger' },
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
  const t = useT(partFormMessages)
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
        {meaning ? t(meaning.hint) : null}
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
  const t = useT(partFormMessages)
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
      <span className="block text-[14px] font-bold">{t(kind.label)}</span>
      <span className="text-app-dim mt-1 block text-[12px] leading-[1.35] text-pretty">
        {t(kind.hint)}
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
  price,
  variant = 'panel',
}: {
  /** Accounting currency of the asking price: suffix, gate and notes. */
  price: PriceSlots
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
  const t = useT(partFormMessages)
  const { locale } = useLocale()
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
        description={t('sourceDescription')}
        title={step('01', t('sourceStep'))}
        variant={variant}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {variant === 'plain' && !edit ? (
            <fieldset className="col-span-full grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">{t('sourceType')}</legend>
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
              hint={edit ? t('sourceTypeEditHint') : t('sourceTypeCreateHint')}
              label={t('sourceType')}
            >
              <SelectInput
                aria-label={t('sourceType')}
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
                  <option value="car">{t('optionCar')}</option>
                ) : null}
                {canViewIntakes || values.sourceType === 'batch' ? (
                  <option value="batch">{t('optionBatch')}</option>
                ) : null}
              </SelectInput>
            </Field>
          )}
          {values.sourceType === 'car' && canViewCars ? (
            <Field
              error={errors.sourceId}
              hint={edit ? t('carEditHint') : t('carCreateHint')}
              label={t('sourceCar')}
              required={!edit}
            >
              <SelectInput
                aria-label={t('sourceCar')}
                disabled={(edit ?? false) || sourceOptions.carsUnavailable}
                onChange={field('sourceId')}
                value={values.sourceId}
              >
                <option value="">{t('chooseCarOption')}</option>
                {sourceOptions.cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {carLabel(car)}
                  </option>
                ))}
                {values.sourceId &&
                !sourceOptions.cars.some(
                  (car) => car.id === values.sourceId,
                ) ? (
                  <option value={values.sourceId}>{t('carOutside')}</option>
                ) : null}
              </SelectInput>
            </Field>
          ) : values.sourceType === 'batch' && canViewIntakes ? (
            <Field
              error={errors.sourceId}
              hint={edit ? t('batchEditHint') : t('batchCreateHint')}
              label={t('sourceBatch')}
              required={!edit}
            >
              <SelectInput
                aria-label={t('sourceBatch')}
                disabled={(edit ?? false) || sourceOptions.intakesUnavailable}
                onChange={field('sourceId')}
                value={values.sourceId}
              >
                <option value="">{t('chooseBatchOption')}</option>
                {sourceOptions.intakes.map((intake) => (
                  <option key={intake.id} value={intake.id}>
                    {intakeLabel(intake, locale)}
                  </option>
                ))}
                {values.sourceId &&
                !sourceOptions.intakes.some(
                  (intake) => intake.id === values.sourceId,
                ) ? (
                  <option value={values.sourceId}>{t('batchOutside')}</option>
                ) : null}
              </SelectInput>
            </Field>
          ) : null}
        </div>
        {sourceCreateLink &&
        (sourceCreateLink !== 'cars' || !values.sourceId) ? (
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
                    ? t('createCar')
                    : t('createBatch')}
                </Link>
              </Button>
            </div>
            <p className="text-app-dim text-[12px] leading-5 text-pretty">
              {t('createReturnHint')}
            </p>
          </div>
        ) : null}
        {values.sourceType === 'car' && !canViewCars ? (
          <Notice role="status" tone="warn">
            {t('carNoPermission')}
          </Notice>
        ) : null}
        {values.sourceType === 'batch' && !canViewIntakes ? (
          <Notice role="status" tone="warn">
            {t('batchNoPermission')}
          </Notice>
        ) : null}
        {values.sourceType === 'car' &&
        canViewCars &&
        sourceOptions.carsUnavailable ? (
          <Notice role="status" tone="warn">
            {t('carsUnavailable')}
          </Notice>
        ) : null}
        {values.sourceType === 'batch' &&
        canViewIntakes &&
        sourceOptions.intakesUnavailable ? (
          <Notice role="status" tone="warn">
            {t('batchesUnavailable')}
          </Notice>
        ) : null}
      </SectionPanel>
      <SectionPanel
        description={t('describeDescription')}
        title={step('02', t('describeStep'))}
        variant={variant}
      >
        <Field error={errors.name} label={t('name')} required>
          <TextInput
            aria-label={t('name')}
            onChange={field('name')}
            value={values.name}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field hint={t('partTypeHint')} label={t('partType')}>
            <TextInput
              aria-label={t('partType')}
              onChange={field('partType')}
              value={values.partType}
            />
          </Field>
          <Field hint={edit ? t('oemEditHint') : t('oemHint')} label={t('oem')}>
            <TextInput
              aria-label={t('oem')}
              disabled={edit}
              onChange={field('oemCode')}
              value={values.oemCode}
            />
          </Field>
        </div>
        <Field hint={t('notesHint')} label={t('notes')}>
          <TextArea
            className="resize-none"
            aria-label={t('notes')}
            onChange={field('notes')}
            rows={3}
            value={values.notes}
          />
        </Field>
      </SectionPanel>
      <SectionPanel
        description={t('conditionDescription')}
        title={step('03', t('conditionStep'))}
        variant={variant}
      >
        {variant === 'plain' ? (
          <>
            <div
              aria-label={t('conditionStep')}
              className="grid gap-2 sm:grid-cols-3"
              role="radiogroup"
            >
              {partConditions(locale).map((option) => (
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
              {t('conditionVisible')}
            </p>
          </>
        ) : (
          <PillGroup
            className="flex-wrap"
            label={t('conditionStep')}
            onChange={(condition) => setValues({ ...values, condition })}
            options={partConditions(locale)}
            value={values.condition}
          />
        )}
      </SectionPanel>
      <SectionPanel
        description={t('quantityDescription')}
        title={step('04', t('quantityStep'))}
        variant={variant}
      >
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <Field error={errors.quantity} label={t('quantity')} required>
            <TextInput
              aria-label={t('quantity')}
              inputMode="numeric"
              min="1"
              onChange={field('quantity')}
              type="number"
              value={values.quantity}
            />
          </Field>
          <Field hint={t('unitHint')} label={t('unit')}>
            <TextInput
              aria-label={t('unit')}
              readOnly
              value={unitLabel(PIECES_UNIT, locale)}
            />
          </Field>
          <Field
            error={errors.desiredSalePrice}
            hint={price.hint ?? t('priceOptional')}
            label={t('desiredPrice')}
          >
            <MoneyInput
              aria-label={t('desiredPrice')}
              currency={price.currency}
              disabled={price.disabled}
              inputMode="decimal"
              min="0"
              onChange={field('desiredSalePrice')}
              step="0.01"
              type="number"
              value={values.desiredSalePrice}
            />
          </Field>
        </div>
        {price.note}
      </SectionPanel>
      {showCompatibility ? (
        <SectionPanel
          description={
            sourceCar === null
              ? t('compatDescription')
              : t('compatFromSourceDescription')
          }
          title={step('05', t('compatStep'))}
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
                  {t('compatFromSource')}
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
                {t('addCar')}
              </Button>
            </div>
          )}
          <Notice tone="warn">{t('compatOnlyOnCreate')}</Notice>
        </SectionPanel>
      ) : null}
    </>
  )
}

/**
 * Source error codes Core sends on create, read in the interface language.
 * An unknown code falls back to the server's own message (it already follows
 * Accept-Language); a failure without a code gets the generic sentence.
 */
const SOURCE_ERROR_KEYS: Readonly<
  Record<string, 'archivedSource' | 'invalidSourceType'>
> = {
  PART_SOURCE_ARCHIVED: 'archivedSource',
  INVALID_PART_SOURCE_TYPE: 'invalidSourceType',
}

const createFailureMessage = (failure: unknown, locale: Locale): string => {
  const problem = normalizeApiProblem(failure)
  const code = problem.code?.toUpperCase()
  if (code === undefined)
    return translate(partFormMessages, locale, 'createFailed')
  const known = SOURCE_ERROR_KEYS[code]
  return known
    ? translate(partFormMessages, locale, known)
    : problem.message || translate(partFormMessages, locale, 'createFailed')
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
  const t = useT(partFormMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const base = `/app/${cabinet.targetTenant?.slug ?? ''}/parts`
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
  // The owner's first part may finish onboarding: say so here, keep the list.
  const firstPart = useFirstPartCompletion({
    tenantId: cabinet.targetTenant?.id ?? null,
    userId: cabinet.snapshot?.userId ?? null,
    role: cabinet.snapshot?.role,
  })
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
  const guard = useFirstPriceGuard()
  const errors = showErrors
    ? partFieldErrors(values, {
        requireSource,
        locale,
        currency: guard.currency,
      })
    : {}
  const price = usePriceSlots(guard, {
    values: [values.desiredSalePrice],
    onAccept: (accepted) => void submit(undefined, accepted),
    // The typed part survives the trip to the currency setting.
    draftKept: true,
    onLeave: () =>
      savePartDraft({
        root: `/app/${cabinet.targetTenant!.slug}`,
        values,
        compatibility: compatRows,
      }),
  })
  const submit = async (
    event?: React.FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    if (pendingRef.current || mediaPending) return
    const parsed = validFormNumbers(values)
    if (
      Object.keys(
        partFieldErrors(values, {
          requireSource,
          locale,
          currency: guard.currency,
        }),
      ).length > 0
    ) {
      setShowErrors(true)
      setStatus(null)
      setError(t('createInvalid'))
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
      unit: PIECES_UNIT,
      photoKeys: [],
      ...(condition !== undefined ? { condition } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(oemCode !== undefined ? { oemCode } : {}),
      ...(partType !== undefined ? { partType } : {}),
      // No price without an accounting currency; the part itself still saves.
      ...(parsed.price !== undefined && !price.disabled
        ? { desiredSalePrice: parsed.price }
        : {}),
    }
    const pricing = price.hasPrice && !price.disabled
    pendingRef.current = true
    setPending(true)
    setStatus(null)
    setError(null)
    try {
      if (
        guard.needsCheck(pricing) &&
        !(await guard.beforeSave(pricing, accepted))
      )
        return
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
          setError(t('archivedCarBlocked'))
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
          setError(t('mediaPartialFailed'))
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
        setError(unknownBrandsMessage(resolved.brands, locale))
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
      guard.afterSave(pricing)
      setStatus(t('created'))
      firstPart.check()
    } catch (failure) {
      setError(createFailureMessage(failure, locale))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  // The footer says the single next thing to fix, in the order the form reads.
  const archivedMessage = t('archivedSource')
  const blocking = {
    ...partFieldErrors(values, {
      requireSource,
      locale,
      currency: guard.currency,
    }),
    ...(archivedSource ? { sourceId: archivedMessage } : {}),
  }
  const footerNote = mediaPending
    ? t('waitForPhotos')
    : (blocking.name ??
      blocking.quantity ??
      blocking.sourceId ??
      blocking.desiredSalePrice ??
      rowsProblem(compatRows, locale) ??
      t('photosLater'))
  const ready =
    Object.keys(blocking).length === 0 &&
    rowsProblem(compatRows, locale) === null

  return (
    <Sheet
      description={
        <>
          {t('requiredFields')} <span className="text-brand">*</span>.{' '}
          {t('restLater')}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="basis-full empty:hidden">{price.saveNotes}</div>
          <p
            className={cn(
              'min-w-0 text-[12px] text-pretty',
              ready ? 'text-app-muted' : 'text-state-warn',
            )}
          >
            {footerNote}
          </p>
          <div className="ml-auto flex items-center gap-2.5">
            <Button
              disabled={pending}
              onClick={() => void navigate(base)}
              type="button"
            >
              {tc('cancel')}
            </Button>
            <Button
              aria-busy={pending || mediaPending}
              disabled={pending || mediaPending}
              form={CREATE_PART_FORM}
              type="submit"
              variant="primary"
            >
              {t('createPart')}
            </Button>
          </div>
        </div>
      }
      eyebrow={t('sheetEyebrow')}
      onOpenChange={(next: boolean) => {
        if (!next && !pending) void navigate(base)
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
          price={price}
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
              {t('photos')}
            </span>
          }
          variant="plain"
        />
        {status ? <Notice tone="ok">{status}</Notice> : null}
        {firstPart.done && cabinet.targetTenant ? (
          <OnboardingCompletedNotice
            dashboardPath={cabinetPath(cabinet.targetTenant.slug, 'dashboard')}
          />
        ) : null}
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
  const t = useT(partFormMessages)
  const tl = useT(lostResponseMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
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
  const guard = useFirstPriceGuard()
  const errors =
    showErrors && values
      ? partFieldErrors(values, {
          requireSource: false,
          locale,
          currency: guard.currency,
        })
      : {}
  const price = usePriceSlots(guard, {
    values: [values?.desiredSalePrice],
    onAccept: (accepted) => void save(undefined, accepted),
  })
  useEffect(() => {
    const controller = new AbortController()
    void partsApi.get(partId, { signal: controller.signal }).then(
      (part) => {
        if (!part) {
          setError(translate(partFormMessages, locale, 'editLoadFailed'))
          return
        }
        setValues({
          sourceType: part.source,
          sourceId: part.carId ?? part.intakeId ?? '',
          name: part.name,
          quantity: String(part.quantityTotal),
          unit: PIECES_UNIT,
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
            name: translate(partFormMessages, locale, 'existingPhoto', {
              n: index + 1,
            }),
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
          setError(translate(partFormMessages, locale, 'editLoadFailed'))
      },
    )
    return () => controller.abort()
    // The locale only words the messages; a language switch must not refetch
    // the part and throw away what is being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId])
  const save = async (
    event?: React.FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    if (!values || pendingRef.current || mediaPending) return
    const parsed = validFormNumbers(values)
    if (
      Object.keys(
        partFieldErrors(values, {
          requireSource: false,
          locale,
          currency: guard.currency,
        }),
      ).length > 0
    ) {
      setShowErrors(true)
      setStatus(null)
      setError(t('saveInvalid'))
      return
    }
    setShowErrors(false)
    pendingRef.current = true
    setPending(true)
    setStatus(null)
    setError(null)
    const pricing = price.hasPrice && !price.disabled
    try {
      if (
        guard.needsCheck(pricing) &&
        !(await guard.beforeSave(pricing, accepted))
      )
        return
      const scope = requireLatestMutation({ quota: false })
      await partsApi.update(
        partId,
        {
          name: values.name.trim(),
          condition: optional(values.condition) ?? null,
          notes: optional(values.notes) ?? null,
          quantity: parsed.quantity,
          partType: optional(values.partType) ?? null,
          unit: PIECES_UNIT,
          photoKeys: committedPhotoKeys(mediaItems),
          // Without an accounting currency the price is left as it is.
          desiredSalePrice: price.disabled
            ? { isSet: false }
            : { isSet: true, value: parsed.price ?? null },
        },
        { signal: scope.signal },
      )
      guard.afterSave(pricing)
      setStatus(t('saved'))
    } catch (failure) {
      if (!isLostResponse(failure)) {
        setError(t('saveFailed'))
        return
      }
      // The PATCH may have landed: read the part back first. Saving the same
      // values again is safe, and the form keeps them meanwhile.
      setStatus(tl('checking'))
      try {
        const fresh = await partsApi.get(partId)
        const landed =
          fresh.name === values.name.trim() &&
          (price.disabled || fresh.desiredSalePrice === (parsed.price ?? null))
        setStatus(landed ? t('saved') : null)
        if (landed) guard.afterSave(pricing)
        else setError(tl('notSaved'))
      } catch {
        setStatus(null)
        setError(tl('checkFailed'))
      }
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
      setDeleteError(t('deleteFailed'))
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
            {t('backToPart')}
          </Link>
          <p className="text-app-dim hidden items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase sm:flex">
            <span>{t('breadcrumbWarehouse')}</span>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span>{t('breadcrumbParts')}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild className="px-[18px] text-sm font-semibold">
            <Link to={backTo}>{tc('cancel')}</Link>
          </Button>
          <Button
            aria-busy={pending || mediaPending}
            className="px-5 text-sm font-bold"
            disabled={pending || mediaPending || values === null}
            form="part-edit"
            type="submit"
            variant="primary"
          >
            {t('saveChanges')}
          </Button>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px] lg:text-[54px]">
            {detail?.name ?? t('editTitle')}
          </h1>
          {detail ? (
            <p className="text-app-muted mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium">
              <span className="border-app-line bg-app-input text-app-ink rounded-[7px] border px-2.5 py-1 font-mono text-[13px]">
                {detail.qrCode}
              </span>
              <span>
                {t('createdBy', { name: detail.createdByName ?? '' })}{' '}
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
                    {t('notEditable')}
                  </span>
                }
                title={t('sourceStep')}
              >
                <p className="text-app-muted text-sm">
                  {t('sourceSetOnCreate')}
                </p>
                <div className="border-app-line bg-app-input flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-4 py-3.5">
                  <span className="text-[16px] font-semibold text-white">
                    {detail?.carId && detail.carCode
                      ? `${t('fromCar', { code: detail.carCode })}${detail.carBrand ? ` (${detail.carBrand} ${detail.carModel ?? ''})` : ''}`
                      : detail?.intakeId
                        ? t('fromIntake')
                        : sourceLabel(values.sourceType, locale)}
                  </span>
                  {detail?.carId && canViewCars ? (
                    <Button asChild>
                      <Link to={`/app/${tenantSlug}/cars/${detail.carId}`}>
                        {t('openCar')}
                        <ExternalLink aria-hidden />
                      </Link>
                    </Button>
                  ) : detail?.intakeId && canViewIntakes ? (
                    <Button asChild>
                      <Link
                        to={`/app/${tenantSlug}/intakes/${detail.intakeId}`}
                      >
                        {t('openIntake')}
                        <ExternalLink aria-hidden />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </Card>

              <Card title={t('describeStep')}>
                <div className="grid gap-4">
                  <p className="text-app-muted text-sm">
                    {t('describeEditDescription')}
                  </p>
                  <Field error={errors.name} label={t('name')} required>
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
                    <Field label={t('partType')}>
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
                    <Field hint={t('oemServerHint')} label={t('oem')}>
                      <TextInput
                        className="font-mono"
                        disabled
                        name="oemCode"
                        value={values.oemCode}
                      />
                    </Field>
                  </div>
                  <Field label={t('notes')}>
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

              <Card title={t('conditionStep')}>
                <div className="grid gap-4">
                  <p className="text-app-muted text-sm">
                    {t('conditionDescription')}
                  </p>
                  <PillGroup
                    className="flex-wrap"
                    label={t('conditionStep')}
                    onChange={(next) =>
                      setValues((current) =>
                        current ? { ...current, condition: next } : current,
                      )
                    }
                    options={partConditions(locale)}
                    value={values.condition}
                  />
                </div>
              </Card>

              <Card title={t('quantityStep')}>
                <p className="text-app-muted text-sm">
                  {t('quantityDescription')}
                </p>
                <div className="grid items-start gap-4 sm:grid-cols-3">
                  <Field error={errors.quantity} label={t('quantity')} required>
                    <QuantityStepper
                      label={t('quantityInStock')}
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
                  <Field hint={t('unitHint')} label={t('unit')}>
                    <TextInput
                      name="unit"
                      readOnly
                      value={unitLabel(values.unit, locale)}
                    />
                  </Field>
                  <Field
                    error={errors.desiredSalePrice}
                    hint={price.hint}
                    label={t('desiredPrice')}
                  >
                    <MoneyInput
                      currency={price.currency}
                      disabled={price.disabled}
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
                {price.note}
                {price.saveNotes}
              </Card>

              <Card
                aside={
                  <span className="text-app-dim text-[13px]">
                    {t('readOnly')}
                  </span>
                }
                title={t('compatStep')}
              >
                <p className="text-app-muted text-sm">{t('compatReadOnly')}</p>
                <SpecGrid
                  specs={[
                    { label: t('make'), value: detail?.compatCarBrand ?? '—' },
                    { label: t('model'), value: detail?.compatCarModel ?? '—' },
                    {
                      label: t('year'),
                      value:
                        detail?.compatCarYear === null ||
                        detail?.compatCarYear === undefined
                          ? '—'
                          : String(detail.compatCarYear),
                    },
                  ]}
                />
              </Card>

              <Card title={t('photos')}>
                <p className="text-app-muted text-sm">{t('photosUploadNow')}</p>
                <PartMediaFields
                  items={mediaItems}
                  requireLatestMutation={requireLatestMutation}
                  setItems={setMediaItems}
                />
                <p className="text-app-dim text-[13px]">
                  {t('buyersSeePhotos')}
                </p>
              </Card>
            </div>

            <aside className="sticky top-24 grid min-w-[280px] flex-[0_0_320px] gap-5">
              <Card title={t('summary')}>
                <dl className="grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
                  <dt className="text-app-muted text-sm font-semibold">
                    {t('available')}
                  </dt>
                  <dd className="font-mono text-[16px] text-white tabular-nums">
                    {detail?.quantityAvailable ?? 0}{' '}
                    {unitLabel(values.unit, locale)}
                  </dd>
                  <dt className="text-app-muted text-sm font-semibold">
                    {t('reserved')}
                  </dt>
                  <dd className="font-mono text-[16px] text-white tabular-nums">
                    {detail?.quantityReserved ?? 0}{' '}
                    {unitLabel(values.unit, locale)}
                  </dd>
                  <dt className="text-app-muted text-sm font-semibold">
                    {t('qrCode')}
                  </dt>
                  <dd className="font-mono text-[14px] break-all text-white">
                    {detail?.qrCode ?? '—'}
                  </dd>
                </dl>
                <Button asChild className="mt-4 w-full text-sm font-semibold">
                  <Link to={`/app/${tenantSlug}/stickers?part=${partId}`}>
                    <Printer aria-hidden />
                    {t('printSticker')}
                  </Link>
                </Button>
              </Card>

              <Card title={t('deletion')}>
                <p className="text-app-muted text-sm">
                  {detail && detail.quantityReserved > 0
                    ? t('deleteBlocked')
                    : t('deleteAllowed')}
                </p>
                <Button
                  className="w-full text-sm font-semibold"
                  onClick={() => setConfirmingDelete(true)}
                  type="button"
                  variant="danger"
                >
                  <Trash2 aria-hidden />
                  {t('deletePart')}
                </Button>
              </Card>
            </aside>
          </form>
        ) : !error ? (
          <SkeletonRows
            columns={2}
            label={translate(partDetailMessages, locale, 'loading')}
            rows={4}
          />
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel={tc('delete')}
        consequence={t('deleteConsequence')}
        destructive
        error={deleteError}
        onConfirm={() => void remove()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pending={deleting}
        title={t('deleteTitle')}
      />
    </div>
  )
}
