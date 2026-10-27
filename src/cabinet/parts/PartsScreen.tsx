import { localizeApiError } from '@/api/error-localization'
import { PartSourceFilter } from './PartSourceFilter'
import { PartLocationCard } from './PartLocationCard'
import { PartNotesCard } from './PartNotesCard'
import { PartPriceDrawer } from './PartPriceDrawer'
import { PartPeekHeaderSkeleton, PartPeekSkeleton } from './PartPeekSkeleton'
import { CabinetLoadingContent } from '../loading-screen'
import { PartFormSkeleton } from '../form-skeletons'
import { PlacementSkeleton } from '../inventory/PlacementSkeleton'
import { FormPage } from '../form-page'
import {
  lazy,
  Suspense,
  useEffect,
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
  ChevronDown,
  ChevronUp,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Lock,
  Car as CarIcon,
  CircleMinus,
  MapPin,
  Package,
  Pencil,
  ShoppingBag,
  Tag,
  Plus,
  Printer,
  RefreshCw,
  SearchX,
  Trash2,
  Upload,
  WifiOff,
  X,
} from 'lucide-react'
import {
  ActionMenu,
  Amount,
  DateValue,
  PhotoFileField,
  PhotoGrid,
  Card,
  PanelFooter,
  CodeChip,
  SectionPanel,
  Sheet,
  PillGroup,
  QuantityStepper,
  Skeleton,
  SkeletonRows,
  SpecGrid,
  BulkBar,
  Button,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Field,
  FilterOption,
  FilterPopover,
  InlineEdit,
  Notice,
  SearchInput,
  SelectPicker,
  StateScreen,
  StatusPill,
  TextArea,
  TextInput,
  useOptionalToast,
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
import { PartLocationFilters, WITHOUT_LOCATION } from './PartLocationFilters'
import { partDetailMessages } from './part-detail-messages'
import { partFormMessages } from './part-form-messages'
import { CompatibilityRowCard, ConditionTile } from './PartFormChoices'
import {
  conditionLabel,
  conditionPhrase,
  historyChange,
  historyDetails,
  historyKind,
  type HistoryKind,
  historyLabel,
  PIECES_UNIT,
  partEditingRestriction,
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
import { RedesignShell } from '../redesign-shell'
import { FEATURE_FLAGS } from '@/api/feature-flags'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import {
  cabinetModules,
  type CabinetModuleDefinition,
} from '../module-registry'
import { evaluateModuleAccess, type ModuleAccessDecision } from '../policy'
import { inventoryApi, type PartInventoryZone } from '@/api/inventory'
import { PartPlacementPicker } from '../inventory/PartPlacementPicker'
import {
  emptyPartPlacement,
  type PartPlacement,
} from '../inventory/part-placement-state'
import { usePlacementOptions } from '../inventory/usePlacementOptions'
import { placementMessages } from '../inventory/part-placement-messages'
import { placementMessages as movePlacementMessages } from '../inventory/placement-messages'
import { normalizeApiProblem } from '@/api/errors'
import type { ApiProblem } from '@/api/contracts'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  emptyRow,
  filledRows,
  isBlankRow,
  resolveCompatibility,
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

const PartPlacementDrawer = lazy(() =>
  import('../warehouses/WarehousesScreen').then((module) => ({
    default: module.PartPlacementDrawer,
  })),
)

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
  return parsed !== 10 && parsed <= 100 ? parsed : fallback
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

const carLabel = (
  car: Pick<CarListItem, 'code' | 'brand' | 'model' | 'year'>,
) => `${car.code} · ${car.brand} ${car.model} (${car.year})`
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
  const [settledSearchKey, setSettledSearchKey] = useState<string | null>(null)
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
  // v2 list (module 11, frames 1.2–1.3): a working set of picked rows whose
  // one bulk action is printing their stickers, and the part opened beside
  // the list. Both reset when the filters change; paging keeps the picks.
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [peekId, setPeekId] = useState<string | null>(null)
  const navigateList = useNavigate()
  const toast = useOptionalToast()
  const originNoticeShown = useRef(false)
  const removedOrigin =
    searchParams.get('origin')?.toLowerCase() === 'free' ||
    (location.state as { removedOrigin?: boolean } | null)?.removedOrigin ===
      true
  useEffect(() => {
    if (!removedOrigin || isNew || partId) {
      originNoticeShown.current = false
      return
    }
    if (originNoticeShown.current) return
    originNoticeShown.current = true
    toast?.show({ tone: 'info', message: t('removedOrigin') })
  }, [removedOrigin, isNew, partId, t, toast])
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
      sectionId: one('without_section') === '1' ? '' : one('section'),
      shelfId:
        one('without_section') === '1' || one('without_shelf') === '1'
          ? ''
          : one('shelf'),
      withoutSection: one('without_section') === '1',
      withoutShelf:
        one('without_section') !== '1' && one('without_shelf') === '1',
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
      ...(filters.sectionId ? { sectionIds: [filters.sectionId] } : {}),
      ...(filters.shelfId ? { shelfIds: [filters.shelfId] } : {}),
      ...(filters.withoutSection ? { missingSection: true } : {}),
      ...(filters.withoutShelf ? { missingShelf: true } : {}),
      ...(filters.carIds.length > 0 ? { carIds: filters.carIds } : {}),
      ...(filters.intakeIds.length > 0 ? { intakeIds: filters.intakeIds } : {}),
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
  const searchKey = JSON.stringify(searchRequest)
  const selectionScope = JSON.stringify({
    ...searchRequest,
    page: undefined,
    pageSize: undefined,
  })
  const [pickScope, setPickScope] = useState(selectionScope)
  if (pickScope !== selectionScope) {
    setPickScope(selectionScope)
    setPicked(new Set())
    setPeekId(null)
  }
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
      'condition',
      'origin',
      'make',
      'model',
      'warehouse',
      'zone',
      'section',
      'shelf',
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
    for (const name of ['without_section', 'without_shelf']) {
      if (next.has(name) && next.get(name) !== '1') next.delete(name)
    }
    if (filters.withoutSection) {
      next.delete('section')
      next.delete('shelf')
      next.delete('without_shelf')
    } else if (filters.withoutShelf) next.delete('shelf')
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
          setSettledSearchKey(searchKey)
        })
        .catch((failure: unknown) => {
          if (!controller.signal.aborted) {
            setError(normalizeApiProblem(failure))
            setSettledSearchKey(searchKey)
          }
        })
    }
    return () => controller.abort()
  }, [
    createDecision.kind,
    isEdit,
    isNew,
    partId,
    reloadToken,
    searchKey,
    searchRequest,
  ])

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
        key={partId}
        canViewCars={links.cars}
        canViewIntakes={links.intakes}
        partId={partId}
        requireLatestMutation={requireLatestMutation}
      />
    )
  if (partId)
    return (
      <PartDetailScreen
        key={partId}
        detail={detail}
        history={history}
        error={error !== null}
        partId={partId}
        canManage={canManage}
        links={links}
        requireLatestMutation={requireLatestMutation}
        tenantSlug={cabinet.targetTenant?.slug ?? ''}
        onPriceSaved={(saved) => {
          setDetail((current) => (current?.id === partId ? saved : current))
          setReloadToken((value) => value + 1)
        }}
        onNotesSaved={(notes) => {
          setDetail((current) =>
            current?.id === partId ? { ...current, notes } : current,
          )
          setReloadToken((value) => value + 1)
        }}
        onPlacementSaved={() => setReloadToken((value) => value + 1)}
        placementRevision={reloadToken}
      />
    )

  /** Counts arrive per dimension; a value with no row simply has none. */
  const facetCount = (dimension: keyof PartFacets, id: string) =>
    facets?.[dimension].find((value) => value.id === id)?.count
  const facetTotal = (dimension: keyof PartFacets) =>
    facets === null
      ? undefined
      : facets[dimension].reduce((sum, value) => sum + value.count, 0)
  const statusTotal = facetTotal('statuses')

  const updatePage = (page: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }
  const resetFilters = () =>
    setSearchParams(new URLSearchParams(), { flushSync: true })
  const updateFilter = (name: string, value: string, list = false) => {
    const next = new URLSearchParams(searchParams)
    next.delete(name)
    // Keep unfinished search text intact; filters.q trims only the API query.
    const nextValue = name === 'q' ? value : value.trim()
    if (list) {
      normalizedIds(value.split(',')).forEach((entry) =>
        next.append(name, entry),
      )
    } else if (nextValue) {
      next.set(name, nextValue)
    }
    next.delete('page')
    setSearchParams(next, { flushSync: name === 'q' })
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
      ['section', filters.sectionId],
      ['shelf', filters.shelfId],
      ['without_section', filters.withoutSection ? '1' : ''],
      ['without_shelf', filters.withoutShelf ? '1' : ''],
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

  const facetName = (dimension: keyof PartFacets, id: string) =>
    facets?.[dimension].find((value) => value.id === id)?.name
  const statusTabs = [
    { value: '', label: t('all'), dot: null },
    { value: 'available', label: t('statusInStock'), dot: 'rz-dot--ok' },
    { value: 'reserved', label: t('statusReserved'), dot: 'rz-dot--warn' },
    { value: 'sold', label: t('statusSold'), dot: 'rz-dot--danger' },
  ] as const
  const totals = [
    { key: 'all', value: statusTotal ?? 0, label: t('totalAll') },
    {
      key: 'available',
      value: facetCount('statuses', 'available') ?? 0,
      label: t('totalAvailable'),
    },
    {
      key: 'reserved',
      value: facetCount('statuses', 'reserved') ?? 0,
      label: t('totalReserved'),
    },
    {
      key: 'sold',
      value: facetCount('statuses', 'sold') ?? 0,
      label: t('totalSold'),
    },
  ]
  const selectedSourceCar =
    filters.carIds.length === 1
      ? filteredCars.find((car) => car.id === filters.carIds[0])
      : undefined
  const sourceOwner = `${cabinet.snapshot?.tenantId}:${cabinet.snapshot?.userId}:${cabinet.snapshot?.generation}`
  const updateSource = (kind: 'cars' | 'intakes', id: string | null) => {
    const next = new URLSearchParams(searchParams)
    const ownKey = kind === 'cars' ? 'car_ids' : 'intake_ids'
    const otherKey = kind === 'cars' ? 'intake_ids' : 'car_ids'
    next.delete(ownKey)
    if (id) {
      next.set(ownKey, id)
      next.delete(otherKey)
    }
    for (const key of ['make', 'model', 'origin', 'page']) next.delete(key)
    appliedCarPresetRef.current = normalizedIds(next.getAll('car_ids')).join(
      ',',
    )
    setSearchParams(next)
  }
  // A settled response belongs only to its own filters. In particular, an
  // empty filtered page must not become an empty yard while reset is pending.
  const listError = settledSearchKey === searchKey ? error : null
  const loading =
    settledSearchKey !== searchKey || (pageMeta === null && listError === null)
  // Out of quota or on a lapsed subscription the button stays in its place,
  // switched off with the reason, so nobody wonders where it went.
  const createBlockedReason =
    createDecision.kind === 'quota-exhausted'
      ? t('accessQuota')
      : createDecision.kind === 'subscription-blocked'
        ? t('accessSubscription')
        : null
  // An empty yard with no filters has nothing to search or narrow yet.
  const emptyYard =
    !loading &&
    listError === null &&
    items.length === 0 &&
    statusTotal === 0 &&
    activeFilters.length === 0

  const directoryPath = isNew
    ? location.pathname.replace(/\/new$/, '')
    : location.pathname

  const emptyActions =
    manageDecision.kind === 'allowed' || createDecision.kind === 'allowed' ? (
      <>
        {manageDecision.kind === 'allowed' ? (
          <FeatureGate name={FEATURE_FLAGS.partsBulkImport}>
            <Button asChild>
              <Link to={`${directoryPath}/imports`}>
                <Upload aria-hidden />
                {t('importParts')}
              </Link>
            </Button>
          </FeatureGate>
        ) : null}
        {createDecision.kind === 'allowed' ? (
          <Button asChild variant="primary">
            <Link to={`${directoryPath}/new`}>
              <Plus aria-hidden />
              {t('addPart')}
            </Link>
          </Button>
        ) : null}
      </>
    ) : null

  const directory = (
    <RedesignShell
      {...(peekId === null || loading || listError
        ? {}
        : {
            peek: (
              <PartPeek
                key={peekId}
                links={links}
                onClose={() => setPeekId(null)}
                onOpen={setPeekId}
                partId={peekId}
                rows={items}
                tenantSlug={cabinet.targetTenant?.slug ?? ''}
              />
            ),
          })}
      actions={
        manageDecision.kind === 'allowed' ||
        createDecision.kind === 'allowed' ||
        createBlockedReason !== null ? (
          <>
            {manageDecision.kind === 'allowed' ? (
              <FeatureGate name={FEATURE_FLAGS.partsBulkImport}>
                <Button asChild>
                  <Link to={`${directoryPath}/imports`}>
                    <Upload aria-hidden />
                    {t('importParts')}
                  </Link>
                </Button>
              </FeatureGate>
            ) : null}
            {createDecision.kind === 'allowed' ? (
              <Button asChild variant="primary">
                <Link to={`${directoryPath}/new`}>
                  <Plus aria-hidden />
                  {t('addPart')}
                </Link>
              </Button>
            ) : createBlockedReason !== null ? (
              <Button disabled title={createBlockedReason} variant="primary">
                <Lock aria-hidden />
                {t('addPart')}
              </Button>
            ) : null}
          </>
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
      <div className="rz-page-head">
        <h1 className="rz-h-page">{t('title')}</h1>
        {facets === null || emptyYard ? null : (
          <dl className="rz-totals">
            {totals.map((total) => (
              <div className="flex items-baseline gap-1" key={total.key}>
                <dt className="order-last">{total.label}</dt>
                <dd>{total.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {createDecision.kind === 'quota-exhausted' ? (
        <Notice tone="warn">{t('accessQuota')}</Notice>
      ) : null}

      {picked.size > 0 ? (
        <BulkBar
          actions={[
            {
              key: 'stickers',
              label: t('bulkPrintStickers'),
              onRun: () =>
                void navigateList(
                  `/app/${cabinet.targetTenant?.slug ?? ''}/stickers?${[
                    ...picked,
                  ]
                    .map((id) => `part=${encodeURIComponent(id)}`)
                    .join('&')}`,
                ),
            },
          ]}
          count={picked.size}
          noun={t('bulkNoun', { count: picked.size })}
          onClear={() => setPicked(new Set())}
          onSelectPage={() =>
            setPicked(new Set([...picked, ...items.map((part) => part.id)]))
          }
          pageCount={items.length}
        />
      ) : null}

      <div
        className="rz-toolbar"
        hidden={emptyYard || picked.size > 0}
        role="search"
      >
        <SearchInput
          aria-label={t('searchLabel')}
          name="q"
          onChange={(event) => updateFilter('q', event.target.value)}
          placeholder={t('searchPlaceholder')}
          value={searchParams.get('q') ?? ''}
        />
        <div
          aria-label={t('filterStatus')}
          className="rz-seg max-w-full overflow-x-auto"
          role="group"
        >
          {statusTabs.map((tab) => (
            <button
              aria-pressed={filters.status === tab.value}
              key={tab.value || 'all'}
              onClick={() => updateFilter('status', tab.value)}
              type="button"
            >
              {tab.dot === null ? null : (
                <span aria-hidden className={cn('rz-dot', tab.dot)} />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {links.cars ? (
          <PartSourceFilter
            key={`${sourceOwner}:cars`}
            kind="cars"
            owner={sourceOwner}
            values={filters.carIds}
            enabled={links.cars}
            selectedLabel={
              selectedSourceCar ? carLabel(selectedSourceCar) : undefined
            }
            onChange={(id) => updateSource('cars', id)}
          />
        ) : null}

        {links.intakes ? (
          <PartSourceFilter
            key={`${sourceOwner}:intakes`}
            kind="intakes"
            owner={sourceOwner}
            values={filters.intakeIds}
            enabled={links.intakes}
            onChange={(id) => updateSource('intakes', id)}
          />
        ) : null}

        <FilterPopover
          label={t('filterPlacement')}
          placeholder={t('warehouseAll')}
          {...(filters.warehouseId
            ? {
                setKey: t('warehouse'),
                setValue: [
                  facetName('warehouses', filters.warehouseId) ??
                    t('selectedWarehouse'),
                  filters.zoneId
                    ? (facetName('zones', filters.zoneId) ?? t('selectedZone'))
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }
            : {})}
        >
          <div className="grid gap-2 p-3">
            <PartLocationFilters
              owner={`${cabinet.snapshot?.tenantId}:${cabinet.snapshot?.userId}:${cabinet.snapshot?.generation}`}
              enabled={links.inventory}
              warehouseId={filters.warehouseId}
              fallbackWarehouses={facets?.warehouses ?? []}
              fallbackZones={facets?.zones ?? []}
              zoneId={filters.zoneId}
              sectionId={filters.sectionId}
              shelfId={filters.shelfId}
              withoutSection={filters.withoutSection}
              withoutShelf={filters.withoutShelf}
              onChange={(level, value) => {
                const next = new URLSearchParams(searchParams)
                if (level === 'warehouse' || level === 'zone') {
                  const descendants =
                    level === 'warehouse'
                      ? [
                          'zone',
                          'section',
                          'shelf',
                          'without_section',
                          'without_shelf',
                        ]
                      : ['section', 'shelf', 'without_section', 'without_shelf']
                  for (const name of descendants) next.delete(name)
                  if (value) next.set(level, value)
                  else next.delete(level)
                } else if (level === 'section') {
                  for (const name of [
                    'section',
                    'shelf',
                    'without_section',
                    'without_shelf',
                  ])
                    next.delete(name)
                  if (value === WITHOUT_LOCATION)
                    next.set('without_section', '1')
                  else if (value) next.set('section', value)
                } else {
                  next.delete('shelf')
                  next.delete('without_shelf')
                  if (value === WITHOUT_LOCATION) next.set('without_shelf', '1')
                  else if (value) next.set('shelf', value)
                }
                next.delete('page')
                setSearchParams(next)
              }}
            />
          </div>
        </FilterPopover>

        <FilterPopover
          label={t('filterCondition')}
          placeholder={t('filterCondition')}
          {...(filters.condition
            ? {
                setKey: t('filterCondition'),
                setValue: conditionLabel(filters.condition, locale),
              }
            : {})}
        >
          <div className="grid gap-px p-1">
            <FilterOption
              active={filters.condition === ''}
              count={facetTotal('conditions')}
              label={t('all')}
              onSelect={() => updateFilter('condition', '')}
            />
            {(facets?.conditions ?? []).map((value) => (
              <FilterOption
                active={filters.condition === value.id}
                count={value.count}
                key={value.id}
                label={conditionLabel(value.id, locale)}
                onSelect={() => updateFilter('condition', value.id)}
              />
            ))}
          </div>
        </FilterPopover>

        {activeFilters.length === 0 ? null : (
          <Button onClick={resetFilters} variant="quiet">
            {t('resetFilters')}
          </Button>
        )}
      </div>

      {listError ? (
        listError.kind === 'network' || listError.kind === 'timeout' ? (
          <StateScreen
            actions={
              <Button
                onClick={() =>
                  setSearchParams(new URLSearchParams(searchParams))
                }
              >
                <RefreshCw aria-hidden />
                {tc('retry')}
              </Button>
            }
            description={t('networkDescription')}
            icon={<WifiOff aria-hidden />}
            role="alert"
            title={t('networkTitle')}
            tone="danger"
          />
        ) : (
          <ErrorState
            description={t('serverDescription')}
            onRetry={() => setSearchParams(new URLSearchParams(searchParams))}
            title={t('serverTitle')}
          />
        )
      ) : loading ? (
        <CabinetLoadingContent module="parts" heading={false} />
      ) : (
        <DataTable
          caption={t('tableCaption')}
          columns={[
            {
              key: 'name',
              label: t('colPart'),
              variant: 'primary',
              cell: (part) => (
                <span className="rz-cell-main">
                  <Link
                    className="text-app-strong hover:text-brand-text"
                    to={part.id}
                  >
                    {part.name}
                  </Link>
                  {part.oemCode ? (
                    <span className="rz-mono">{part.oemCode}</span>
                  ) : null}
                </span>
              ),
            },
            {
              key: 'car',
              label: t('colCar'),
              cell: (part) => (
                <span className="whitespace-nowrap">
                  {part.car
                    ? `${part.car.make} ${part.car.model} · ${String(part.car.year)}`
                    : '—'}
                </span>
              ),
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
                  className="text-app-muted"
                  inputMode="numeric"
                  label={t('quantityLabel', { name: part.name })}
                  onCommit={(next) =>
                    rewritePart(part.id, (current) => {
                      const quantity = Number(next.trim())
                      return Number.isInteger(quantity) && quantity >= 0
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
              cell: (part) => (
                <span className="inline-flex items-center gap-1.5">
                  {part.isInventoryLocked ? (
                    <span className="text-app-dim" title={t('inventoryLocked')}>
                      <Lock aria-hidden className="size-3" />
                    </span>
                  ) : null}
                  {part.quantityAvailable}
                </span>
              ),
            },
            {
              key: 'reserved',
              label: t('colReserved'),
              align: 'end',
              cell: (part) => (
                <span className="text-app-muted">{part.quantityReserved}</span>
              ),
            },
          ]}
          empty={
            <StateScreen
              className="border-0"
              description={
                activeFilters.length > 0
                  ? t('emptyFilteredDescription')
                  : t('emptyDescription')
              }
              icon={
                activeFilters.length > 0 ? (
                  <SearchX aria-hidden />
                ) : (
                  <Package aria-hidden />
                )
              }
              title={
                activeFilters.length > 0
                  ? t('emptyFilteredTitle')
                  : t('emptyTitle')
              }
              tone={activeFilters.length > 0 ? 'neutral' : 'brand'}
              {...(activeFilters.length > 0
                ? {
                    actions: (
                      <Button onClick={resetFilters}>
                        <X aria-hidden />
                        {t('resetFilters')}
                      </Button>
                    ),
                  }
                : !emptyYard || emptyActions === null
                  ? {}
                  : { actions: emptyActions })}
            />
          }
          footer={
            pageMeta ? (
              <nav aria-label={t('pagination')} className="rz-pager">
                <p className="rz-mono m-0">
                  {t('pageOf', {
                    page: pageMeta.page,
                    total: pageMeta.totalPages,
                  })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{t('pageSize')}</span>
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
                <div className="rz-pager__nav">
                  <Button
                    aria-label={t('previousPage')}
                    disabled={pageMeta.page <= 1}
                    onClick={() => updatePage(pageMeta.page - 1)}
                    size="sm"
                  >
                    <ChevronLeft aria-hidden />
                    {tc('back')}
                  </Button>
                  <Button
                    aria-label={t('nextPage')}
                    disabled={pageMeta.page >= pageMeta.totalPages}
                    onClick={() => updatePage(pageMeta.page + 1)}
                    size="sm"
                  >
                    {tc('next')}
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </nav>
            ) : null
          }
          activeKey={peekId}
          onRowClick={(part) => setPeekId(part.id)}
          rowKey={(part) => part.id}
          rows={items}
          selection={{
            selected: picked,
            onChange: setPicked,
            rowLabel: (part) => t('selectPart', { name: part.name }),
          }}
        />
      )}
    </RedesignShell>
  )

  return directory
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

function PartDetailScreen({
  detail,
  history,
  partId,
  error,
  canManage,
  links,
  requireLatestMutation,
  tenantSlug,
  onPlacementSaved,
  onNotesSaved,
  onPriceSaved,
  placementRevision,
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
  onPlacementSaved: () => void
  onNotesSaved: (notes: string) => void
  onPriceSaved: (saved: PartDetail) => void
  placementRevision: number
}) {
  const navigate = useNavigate()
  const [placementOpen, setPlacementOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const priceTrigger = useRef<HTMLButtonElement>(null)
  const tPlacement = useT(movePlacementMessages)
  const t = useT(partDetailMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const format = useFormat()
  const { currency: partCurrency } = useAccountingCurrency()
  const priceRestriction = partEditingRestriction(detail?.status, locale)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const toast = useOptionalToast()
  const [copyError, setCopyError] = useState<string | null>(null)
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
  const [zonesFailed, setZonesFailed] = useState(false)
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
        if (!controller.signal.aborted) {
          setZones(result)
          setZonesFailed(false)
        }
      },
      () => {
        if (!controller.signal.aborted) setZonesFailed(true)
      },
    )
    return () => controller.abort()
  }, [links.inventory, partId, placementRevision])
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
        }))),
  ]
  const copyCode = async (code: string) => {
    setCopyError(null)
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(code)
      toast?.show({ tone: 'ok', message: t('copied') })
    } catch {
      if (toast) toast.show({ tone: 'danger', message: t('copyFailed') })
      else setCopyError(t('copyFailed'))
    }
  }

  const name = detail === null ? t('titleFallback') : detail.name
  const editHref = `${base}/${partId}/edit`
  const hasSalesAmounts = salesRows.some((row) => row.kind === 'sold')
  const salesTotal = salesRows.reduce(
    (sum, row) => sum + (row.unitPrice ?? 0) * row.quantity,
    0,
  )

  return (
    <div className="grid content-start">
      {priceOpen && canManage && detail ? (
        <PartPriceDrawer
          part={detail}
          beforeSave={() => requireLatestMutation({ quota: false })}
          onClose={() => setPriceOpen(false)}
          onSaved={onPriceSaved}
          returnFocus={() => priceTrigger.current?.focus()}
        />
      ) : null}
      {placementOpen && links.inventory ? (
        <Suspense
          fallback={
            <Sheet
              open
              title={tPlacement('title')}
              onOpenChange={(open) => {
                if (!open) setPlacementOpen(false)
              }}
            >
              <PlacementSkeleton />
            </Sheet>
          }
        >
          <PartPlacementDrawer
            partId={partId}
            onClose={() => setPlacementOpen(false)}
            onSaved={onPlacementSaved}
          />
        </Suspense>
      ) : null}
      <div className="rz-topbar min-h-topbar h-auto flex-wrap justify-between gap-y-1.5 py-1.5">
        <p className="rz-crumbs m-0">
          <Link className="hidden sm:inline" to={base}>
            {t('breadcrumbWarehouse')}
          </Link>
          <ChevronRight aria-hidden className="hidden size-3 sm:block" />
          <Link to={base}>{t('breadcrumbParts')}</Link>
          <ChevronRight aria-hidden className="size-3" />
          <span aria-current="page">{name}</span>
        </p>
        <div className="rz-topbar__actions flex-wrap items-center">
          <Button asChild>
            <Link to={`/app/${tenantSlug}/stickers?part=${partId ?? ''}`}>
              <Printer aria-hidden />
              {t('printSticker')}
            </Link>
          </Button>
          {canManage ? (
            <>
              <Button asChild>
                <Link to={editHref}>
                  <Pencil aria-hidden />
                  {tc('edit')}
                </Link>
              </Button>
              <ActionMenu
                actions={[
                  ...(links.inventory
                    ? [
                        {
                          key: 'move',
                          label: t('move'),
                          icon: <MapPin aria-hidden />,
                          onSelect: () => setPlacementOpen(true),
                        },
                      ]
                    : []),
                  ...(detail?.qrCode
                    ? [
                        {
                          key: 'copy',
                          label: t('copyCode'),
                          icon: <Copy aria-hidden />,
                          onSelect: () => void copyCode(detail.qrCode),
                        },
                      ]
                    : []),
                  {
                    key: 'delete',
                    label: t('deletePart'),
                    icon: <Trash2 aria-hidden />,
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

      <div className="rz-page max-w-[1240px]">
        <div className="grid min-w-0 gap-2">
          {error ? null : detail === null ? (
            <div aria-hidden className="grid gap-2">
              <Skeleton className="h-5 w-64 max-w-full" />
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ) : (
            <h1 className="rz-h-page text-balance">{name}</h1>
          )}
          {detail === null ? null : (
            <div className="rz-btn-row items-center">
              {detail.oemCode ? (
                <span className="rz-code pr-2">
                  {t('oem', { code: detail.oemCode })}
                </span>
              ) : null}
              {detail.qrCode ? (
                <CodeChip
                  code={detail.qrCode}
                  label={t('copyCode')}
                  onCopy={() => {
                    void copyCode(detail.qrCode)
                  }}
                />
              ) : null}
              <StatusPill tone={statusPresentation(detail.status, locale).tone}>
                {statusPresentation(detail.status, locale).label}
              </StatusPill>
              {detail.quantityReserved > 0 && detail.quantityAvailable > 0 ? (
                <StatusPill tone="warn">
                  {t('reservedCount', { count: detail.quantityReserved })}
                </StatusPill>
              ) : null}
              <span className="text-app-muted">
                {conditionPhrase(detail.condition, locale)}
              </span>
              {detail.partType ? (
                <span className="text-app-dim">· {detail.partType}</span>
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

        {deleteError !== null && !confirmingDelete ? (
          <Notice tone="danger">{deleteError}</Notice>
        ) : null}
        {copyError === null ? null : <Notice tone="danger">{copyError}</Notice>}

        {error ? (
          <ErrorState
            actions={
              <Button asChild>
                <Link to={base}>
                  <ChevronLeft aria-hidden />
                  {t('backToWarehouse')}
                </Link>
              </Button>
            }
            description={t('loadErrorDescription')}
            title={t('loadErrorTitle')}
          />
        ) : detail === null ? (
          <CabinetLoadingContent
            module="parts"
            heading={false}
            label={t('loading')}
          />
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid min-w-0 flex-[1_1_480px] gap-4">
              <Card
                aside={
                  <span className="text-app-dim">
                    {t('photosCount', { count: detail.photos.length })}
                  </span>
                }
                title={t('photos')}
              >
                <PhotoGrid
                  emptyLabel={t('galleryEmpty')}
                  label={t('galleryLabel', { name: detail.name })}
                  title={detail.name}
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
                  variant="tiles"
                  layout="strip"
                  coverLabel={t('coverPhoto')}
                />
              </Card>

              {reservations.length > 0 || soldOrders.length > 0 ? (
                <Card
                  aside={
                    <div
                      aria-label={t('salesTabs')}
                      className="rz-seg max-w-full overflow-x-auto"
                      role="group"
                    >
                      {SALES_TABS.map((tab) => {
                        const count =
                          tab.value === 'reserved'
                            ? reservations.length
                            : tab.value === 'sold'
                              ? soldOrders.length
                              : reservations.length + soldOrders.length
                        return (
                          <button
                            aria-pressed={salesTab === tab.value}
                            key={tab.value}
                            onClick={() => setSalesTab(tab.value)}
                            type="button"
                          >
                            {t(tab.label)}
                            <span className="rz-count">{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  }
                  bodyClassName="p-0"
                  title={t('sales')}
                >
                  {salesRows.length === 0 ? (
                    <p className="text-app-dim m-0 p-4">
                      {salesTab === 'reserved'
                        ? t('noReserves')
                        : t('notSoldYet')}
                    </p>
                  ) : (
                    <>
                      <div className="rz-table-scroll relative">
                        <table className="rz-table">
                          <caption>{t('salesCaption')}</caption>
                          <thead>
                            <tr>
                              <th scope="col">{t('colOrder')}</th>
                              <th scope="col">{t('colCustomer')}</th>
                              <th scope="col">{t('colStatus')}</th>
                              <th className="rz-num" scope="col">
                                {t('colQuantity')}
                              </th>
                              {hasSalesAmounts ? (
                                <th className="rz-num" scope="col">
                                  {t('colSum')}
                                </th>
                              ) : null}
                            </tr>
                          </thead>
                          <tbody>
                            {salesRows.map((row) => (
                              <tr
                                className={cn(
                                  row.kind === 'reserved' &&
                                    links.orders &&
                                    'cursor-pointer',
                                )}
                                key={`${row.kind}-${row.orderId}`}
                                onClick={
                                  row.kind !== 'reserved' || !links.orders
                                    ? undefined
                                    : (event) => {
                                        const href = orderHref(row.orderId)
                                        if (
                                          href === null ||
                                          event.defaultPrevented ||
                                          event.button !== 0 ||
                                          event.metaKey ||
                                          event.ctrlKey ||
                                          event.shiftKey ||
                                          event.altKey ||
                                          (event.target instanceof Element &&
                                            event.target.closest(
                                              'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable]',
                                            ))
                                        )
                                          return
                                        void navigate(href)
                                      }
                                }
                              >
                                <th className="py-2 align-top" scope="row">
                                  {orderHref(row.orderId) === null ? (
                                    <span className="font-mono">
                                      {t('orderNumber', {
                                        number: String(row.orderNumber),
                                      })}
                                    </span>
                                  ) : (
                                    <Link
                                      className="font-mono"
                                      to={orderHref(row.orderId) ?? '#'}
                                    >
                                      {t('orderNumber', {
                                        number: String(row.orderNumber),
                                      })}
                                    </Link>
                                  )}
                                  {row.date !== null ? (
                                    <span className="rz-caption block font-mono font-normal">
                                      <DateValue
                                        value={row.date}
                                        withTime={false}
                                      />
                                    </span>
                                  ) : null}
                                </th>
                                <td
                                  className="py-2 align-top"
                                  data-label={t('colCustomer')}
                                >
                                  <span className="text-app-ink block">
                                    {row.customerName ?? t('noCustomer')}
                                  </span>
                                </td>
                                <td
                                  className="py-2 align-top"
                                  data-label={t('colStatus')}
                                >
                                  {row.kind === 'reserved' && links.orders ? (
                                    <Link
                                      aria-label={`${t('reserve')} · ${t('orderNumber', { number: String(row.orderNumber) })}`}
                                      className="inline-flex rounded-full"
                                      to={orderHref(row.orderId) ?? '#'}
                                    >
                                      <StatusPill tone="warn">
                                        {t('reserve')}
                                      </StatusPill>
                                    </Link>
                                  ) : (
                                    <StatusPill
                                      tone={
                                        row.kind === 'reserved' ? 'warn' : 'ok'
                                      }
                                    >
                                      {row.kind === 'reserved'
                                        ? t('reserve')
                                        : t('sold')}
                                    </StatusPill>
                                  )}
                                </td>
                                <td
                                  className="rz-num py-2 align-top"
                                  data-label={t('colQuantity')}
                                >
                                  {row.quantity}
                                </td>
                                {hasSalesAmounts ? (
                                  <td
                                    className="rz-num py-2 align-top"
                                    data-label={t('colSum')}
                                  >
                                    {row.unitPrice !== null ? (
                                      <>
                                        <Amount
                                          currency={partCurrency}
                                          currencyDisplay="code"
                                          value={row.unitPrice * row.quantity}
                                        />
                                        {row.quantity === 1 ? null : (
                                          <span
                                            className="rz-caption block"
                                            title={t('colPrice')}
                                          >
                                            {row.quantity} ×{' '}
                                            <Amount
                                              currency={partCurrency}
                                              currencyDisplay="code"
                                              value={row.unitPrice}
                                            />
                                          </span>
                                        )}
                                      </>
                                    ) : null}
                                  </td>
                                ) : null}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {hasSalesAmounts ? (
                        <div className="rz-card__foot">
                          <span className="text-app-muted">
                            {t('totalSold')}
                          </span>
                          <span className="font-mono text-app-strong">
                            <Amount
                              currency={partCurrency}
                              currencyDisplay="code"
                              value={salesTotal}
                            />
                          </span>
                        </div>
                      ) : null}
                    </>
                  )}
                </Card>
              ) : null}

              <Card
                aside={
                  compat === null ? null : (
                    <span className="text-app-dim">
                      {t('carsCount', { count: compat.items.length })}
                    </span>
                  )
                }
                bodyClassName={
                  compat !== null && compat.items.length > 0 ? 'p-0' : ''
                }
                title={t('compatibility')}
              >
                {compat === null ? (
                  <SkeletonRows embedded label={t('loadingShort')} rows={2} />
                ) : compat.items.length === 0 ? (
                  <p className="text-app-dim m-0 text-pretty">
                    {t('compatEmpty')}
                  </p>
                ) : (
                  <dl className="rz-facts">
                    {compat.items.map((item) => (
                      <div key={item.id}>
                        <dt className="text-app-ink">
                          {[item.makeName, item.modelName]
                            .filter(Boolean)
                            .join(' ') || item.equipmentTypeName}
                        </dt>
                        <dd>
                          <span className="font-mono">
                            {yearSpan(item.yearFrom, item.yearTo, t)}
                          </span>
                          {item.evidenceType === 'DonorObservation' ? (
                            <span className="rz-caption ml-2">
                              {t('donorReadonly')}
                            </span>
                          ) : item.modelName === null ? (
                            <span className="rz-caption ml-2">
                              {t('anyModel')}
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>

              <Card
                aside={
                  history === null || history.events.length === 0 ? null : (
                    <div
                      aria-label={t('historyFilters')}
                      className="rz-seg max-w-full overflow-x-auto"
                      role="group"
                    >
                      {HISTORY_FILTERS.map((filter) => (
                        <button
                          aria-pressed={historyFilter === filter.value}
                          key={filter.value}
                          onClick={() => {
                            setHistoryFilter(filter.value)
                            setHistoryAll(false)
                          }}
                          type="button"
                        >
                          {t(filter.label)}
                        </button>
                      ))}
                    </div>
                  )
                }
                bodyClassName={
                  history !== null && shownHistory.length > 0 ? 'p-0' : ''
                }
                title={t('history')}
              >
                {history === null ? (
                  <SkeletonRows
                    columns={1}
                    label={t('loadingHistory')}
                    rows={3}
                  />
                ) : shownHistory.length === 0 ? (
                  <p className="text-app-dim m-0 text-pretty">
                    {history.events.length === 0
                      ? t('historyEmpty')
                      : t('historyFilteredEmpty')}
                  </p>
                ) : (
                  <>
                    {historyGroups.map((group) => (
                      <section
                        className="border-app-line border-t first:border-t-0"
                        key={group.date}
                      >
                        <h3 className="rz-eyebrow m-0 px-3 pt-3">
                          {group.date}
                        </h3>
                        <ol className="rz-timeline">
                          {group.items.map((event) => {
                            const kind = historyKind(
                              event.eventType,
                              event.data,
                            )
                            const change = historyChange(event.data)
                            const facts = historyDetails(event.data, locale)
                            return (
                              <li key={event.id}>
                                <span aria-hidden className="rz-timeline__icon">
                                  {HISTORY_ICON[kind]}
                                </span>
                                <span className="grid min-w-0 gap-1">
                                  <span className="text-pretty">
                                    <span className="font-medium text-app-strong">
                                      {historyLabel(event.eventType, locale)}
                                    </span>
                                    {event.order ? (
                                      <>
                                        {' '}
                                        <span className="text-app-muted font-mono">
                                          {t('orderNumber', {
                                            number: String(event.order.number),
                                          })}
                                        </span>
                                      </>
                                    ) : null}
                                  </span>
                                  {change === null ? null : (
                                    <span className="rz-change">
                                      <s>{change.from}</s>
                                      <span
                                        aria-hidden
                                        className="text-app-dim"
                                      >
                                        →
                                      </span>
                                      <span className="text-app-ink">
                                        {change.to}
                                      </span>
                                    </span>
                                  )}
                                  {change !== null ||
                                  facts.length === 0 ? null : (
                                    <span className="text-app-muted text-pretty">
                                      {facts.join(' · ')}
                                    </span>
                                  )}
                                  <span className="rz-caption">
                                    {event.user.name}
                                  </span>
                                </span>
                                <span className="rz-timeline__date">
                                  {format.time(event.createdAt) ?? ''}
                                </span>
                              </li>
                            )
                          })}
                        </ol>
                      </section>
                    ))}
                    {filteredHistory.length > HISTORY_LIMIT ? (
                      <div className="rz-card__foot justify-center bg-transparent">
                        <Button
                          onClick={() => setHistoryAll((value) => !value)}
                          size="sm"
                          variant="quiet"
                        >
                          {historyAll
                            ? t('collapse')
                            : t('showAll', { count: filteredHistory.length })}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </Card>
            </div>

            <aside className="grid w-full max-w-[380px] min-w-0 flex-[1_1_280px] gap-4">
              <Card
                aside={
                  canManage && detail.effectiveSalePrice !== null ? (
                    <Button
                      ref={priceTrigger}
                      disabled={priceRestriction !== null}
                      title={priceRestriction ?? undefined}
                      size="sm"
                      onClick={() => setPriceOpen(true)}
                    >
                      {t('change')}
                    </Button>
                  ) : null
                }
                bodyClassName="grid gap-1.5"
                title={t('salePrice')}
              >
                {detail.effectiveSalePrice === null ? (
                  <>
                    <Notice block tone="warn">
                      <strong className="block font-semibold text-app-strong">
                        {t('noPriceTitle')}
                      </strong>
                      <span className="text-app-muted">{t('noPriceBody')}</span>
                    </Notice>
                    {canManage ? (
                      <Button
                        ref={priceTrigger}
                        disabled={priceRestriction !== null}
                        title={priceRestriction ?? undefined}
                        className="justify-self-start"
                        variant="primary"
                        onClick={() => setPriceOpen(true)}
                      >
                        {t('setPrice')}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="m-0 flex flex-wrap items-baseline gap-1.5">
                      <Amount
                        className="rz-display"
                        currency={partCurrency}
                        currencyDisplay="code"
                        value={detail.effectiveSalePrice}
                      />
                      <span className="rz-caption">
                        {t('perUnit', {
                          unit: unitLabel(detail.unit, locale),
                        })}
                      </span>
                    </p>
                    <p className="rz-caption m-0">
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
                      <p className="rz-caption m-0">
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
                {priceRestriction ? (
                  <p className="rz-caption m-0">{priceRestriction}</p>
                ) : null}
              </Card>

              <Card
                aside={
                  <span className="text-app-dim">
                    {t('received', {
                      count: detail.quantityTotal,
                      unit: unitLabel(detail.unit, locale),
                    })}
                  </span>
                }
                bodyClassName="p-0"
                title={t('stock')}
              >
                <dl className="rz-kpis m-0 grid-cols-3 rounded-none border-0">
                  <StockTile
                    label={t('tileAvailable')}
                    sub={
                      detail.quantityAvailable > 0
                        ? t('canSell')
                        : t('noneFree')
                    }
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
                    value={detail.quantitySoldTotal}
                  />
                </dl>
                {detail.quantityAvailable === 1 ? (
                  <div className="rz-card__foot justify-start">
                    <span className="text-app-muted">{t('lastUnit')}</span>
                  </div>
                ) : detail.quantityAvailable === 0 &&
                  detail.quantityReserved > 0 ? (
                  <div className="rz-card__foot justify-start">
                    <span className="text-state-warn text-pretty">
                      {t('allReserved')}
                    </span>
                  </div>
                ) : null}
              </Card>

              <PartLocationCard
                zones={zones}
                allowed={links.inventory}
                failed={zonesFailed}
                inStock={detail.quantityAvailable + detail.quantityReserved > 0}
                canMove={canManage && links.inventory}
                onMove={() => setPlacementOpen(true)}
                onRetry={() => {
                  setZones(null)
                  setZonesFailed(false)
                  onPlacementSaved()
                }}
              />
              <PartNotesCard
                key={partId}
                partId={partId}
                notes={detail.notes}
                canEdit={canManage && detail.quantityAvailable > 0}
                beforeSave={() => requireLatestMutation({ quota: false })}
                onSaved={onNotesSaved}
                footer={
                  detail.createdByName ? (
                    <dl className="rz-facts border-app-line border-t">
                      <div>
                        <dt>{t('createdBy')}</dt>
                        <dd>
                          {detail.createdByName}{' '}
                          <span className="rz-caption font-mono">
                            · <DateValue value={detail.createdAt} />
                          </span>
                        </dd>
                      </div>
                    </dl>
                  ) : undefined
                }
              />
            </aside>
          </div>
        )}
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
  placement?: PartPlacement
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
  description,
  items,
  requireLatestMutation,
  setItems,
  title,
  variant = 'panel',
}: {
  deferUploads?: boolean
  description?: ReactNode
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
        description ??
        (deferUploads ? t('mediaDeferDescription') : t('mediaDescription'))
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
                className="rz-inset flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 py-2"
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
                  <p className="text-app-ink m-0 break-words">
                    {item.name} · {statusLabel(item)}
                  </p>
                  <p className="rz-caption m-0">
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
        <p className="text-app-dim text-body">{t('noPhotos')}</p>
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
      <Icon aria-hidden className="text-app-dim size-3.5 shrink-0" />
      <span className="text-app-muted whitespace-nowrap">{label}</span>
      <span className="font-medium whitespace-nowrap text-app-strong">
        {name}
      </span>
      {meta === '' ? null : <span className="rz-code rz-code--sm">{meta}</span>}
      {href === null ? null : (
        <ChevronRight aria-hidden className="text-app-dim size-3" />
      )}
    </>
  )
  const className =
    'border-app-line inline-flex h-control items-center gap-2 rounded-control border px-2'

  return href === null ? (
    <span className={className}>{body}</span>
  ) : (
    <Link className={`${className} hover:bg-app-hover`} to={href}>
      {body}
    </Link>
  )
}

/** Reservation rows expose the fields supplied by PartReservationDto. */
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

/** A glyph per kind, so a long history can be skimmed. */
const HISTORY_ICON: Record<HistoryKind, ReactNode> = {
  sale: <ShoppingBag aria-hidden className="size-3" />,
  price: <Tag aria-hidden className="size-3" />,
  stock: <MapPin aria-hidden className="size-3" />,
}

type DetailT = Translate<(typeof partDetailMessages)['uk']>

/**
 * A compatibility's years, as one span: a single year stays a single year.
 * Years go in as strings so no locale groups them like quantities.
 */
const yearSpan = (
  from: number | null | undefined,
  to: number | null | undefined,
  t: DetailT,
): string => {
  if (from == null && to == null) return '—'
  if (from != null && to != null)
    return from === to
      ? String(from)
      : t('yearRange', { from: String(from), to: String(to) })
  if (from != null) return t('yearFrom', { year: String(from) })
  if (to != null) return t('yearTo', { year: String(to) })
  return '—'
}

/**
 * Core represents warehouse-level placement with a system zone. Show the
 * warehouse and the absence of a physical zone instead of hiding the location.
 */
const placementLabel = (
  zones: PartInventoryZone[] | null,
  allowed: boolean,
  t: DetailT,
): string => {
  if (!allowed) return t('placementNeedsModule')
  if (zones === null) return t('loadingShort')
  if (zones.length === 0) return t('notPlaced')
  return zones
    .map((zone) =>
      [
        zone.warehouseName,
        ...(zone.isSystemUnassigned
          ? [t('locationWarehouseLevel')]
          : [zone.zoneName, zone.sectionName, zone.shelfName]),
      ]
        .filter(Boolean)
        .join(' · '),
    )
    .join(', ')
}

/**
 * The part opened beside the list (v2 module 11, frame 1.2): the facts a
 * person checks before deciding to open the full record — stock, price,
 * place, source, the latest history. Prev/next walk the current page; the
 * expand button opens the full record. Read-only by design.
 */
function PartPeek({
  partId,
  rows,
  onOpen,
  onClose,
  tenantSlug,
  links,
}: {
  partId: string
  rows: readonly PartSearchItem[]
  onOpen: (id: string) => void
  onClose: () => void
  tenantSlug: string
  links: { cars: boolean; inventory: boolean }
}) {
  const t = useT(partDetailMessages)
  const tl = useT(partsListMessages)
  const { locale } = useLocale()
  const format = useFormat()
  const { currency } = useAccountingCurrency()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error' }
    | {
        kind: 'ready'
        detail: PartDetail
        history: Awaited<ReturnType<typeof partsApi.history>> | null
        zones: PartInventoryZone[] | null
      }
  >({ kind: 'loading' })

  useEffect(() => {
    // Keyed by part id in the parent, so a new part starts from 'loading'.
    const controller = new AbortController()
    void Promise.all([
      partsApi.get(partId, { signal: controller.signal }),
      partsApi.history(partId, { signal: controller.signal }).catch(() => null),
      links.inventory
        ? inventoryApi
            .getPartZones(partId, { signal: controller.signal })
            .catch(() => [])
        : Promise.resolve(null),
    ]).then(
      ([detail, history, zones]) => {
        if (!controller.signal.aborted)
          setState({ kind: 'ready', detail, history, zones })
      },
      () => {
        if (!controller.signal.aborted) setState({ kind: 'error' })
      },
    )
    return () => controller.abort()
  }, [links.inventory, partId])

  useEffect(() => {
    headingRef.current?.focus()
  }, [partId])

  const index = rows.findIndex((row) => row.id === partId)
  const previous = index > 0 ? rows[index - 1] : undefined
  const next =
    index >= 0 && index < rows.length - 1 ? rows[index + 1] : undefined
  const fallbackName = rows[index]?.name ?? t('titleFallback')
  const name = state.kind === 'ready' ? state.detail.name : fallbackName
  const fullHref = `/app/${tenantSlug}/parts/${partId}`

  return (
    <aside
      aria-busy={state.kind === 'loading'}
      aria-label={tl('peekLabel', { name })}
      className="rz-peek"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="rz-peek__head">
        <div className="flex items-center gap-1">
          <span className="rz-eyebrow flex-1">{tl('peekEyebrow')}</span>
          <Button
            aria-label={tl('peekPrevious')}
            disabled={previous === undefined}
            onClick={() => previous && onOpen(previous.id)}
            size="icon"
            variant="quiet"
          >
            <ChevronUp aria-hidden />
          </Button>
          <Button
            aria-label={tl('peekNext')}
            disabled={next === undefined}
            onClick={() => next && onOpen(next.id)}
            size="icon"
            variant="quiet"
          >
            <ChevronDown aria-hidden />
          </Button>
          <Button asChild size="icon" variant="quiet">
            <Link aria-label={tl('peekOpen')} to={fullHref}>
              <Maximize2 aria-hidden />
            </Link>
          </Button>
          <Button
            aria-label={tl('peekClose')}
            onClick={onClose}
            size="icon"
            variant="quiet"
          >
            <X aria-hidden />
          </Button>
        </div>
        <h2 className="rz-h-title outline-none" ref={headingRef} tabIndex={-1}>
          {name}
        </h2>
        {state.kind === 'ready' ? (
          <>
            <div className="rz-btn-row items-center">
              {state.detail.oemCode ? (
                <span className="rz-code pr-2">
                  {t('oem', { code: state.detail.oemCode })}
                </span>
              ) : null}
              {statusPresentation(state.detail.status, locale).label ===
              '' ? null : (
                <StatusPill
                  tone={statusPresentation(state.detail.status, locale).tone}
                >
                  {statusPresentation(state.detail.status, locale).label}
                </StatusPill>
              )}
              {state.detail.condition ? (
                <span className="text-app-muted">
                  {conditionLabel(state.detail.condition, locale)}
                </span>
              ) : null}
            </div>
            <div className="rz-btn-row">
              <Button asChild>
                <Link to={`/app/${tenantSlug}/stickers?part=${partId}`}>
                  <Printer aria-hidden />
                  {t('printSticker')}
                </Link>
              </Button>
            </div>
          </>
        ) : state.kind === 'loading' ? (
          <PartPeekHeaderSkeleton />
        ) : null}
      </div>

      {state.kind === 'loading' ? (
        <PartPeekSkeleton />
      ) : state.kind === 'error' ? (
        <div className="rz-peek__section">
          <Notice tone="danger">{tl('peekLoadFailed')}</Notice>
        </div>
      ) : (
        <>
          <section className="rz-peek__section" aria-label={t('stock')}>
            <h3 className="rz-label m-0">{t('stock')}</h3>
            <dl className="rz-kpis m-0 grid-cols-3">
              <StockTile
                label={t('tileAvailable')}
                sub={
                  state.detail.quantityAvailable > 0
                    ? t('canSell')
                    : t('noneFree')
                }
                value={state.detail.quantityAvailable}
              />
              <StockTile
                label={t('tileReserved')}
                sub={
                  state.detail.quantityReserved > 0
                    ? t('ordersCount', {
                        count: state.detail.reservations?.length ?? 0,
                      })
                    : t('none')
                }
                tone="warn"
                value={state.detail.quantityReserved}
              />
              <StockTile
                label={t('tileSold')}
                sub={
                  state.detail.quantitySoldTotal > 0
                    ? t('ordersCount', {
                        count: state.detail.soldOrders?.length ?? 0,
                      })
                    : t('neverSold')
                }
                value={state.detail.quantitySoldTotal}
              />
            </dl>
          </section>
          <dl className="rz-facts m-0 border-app-line border-b">
            <div>
              <dt>{t('salePrice')}</dt>
              <dd>
                {state.detail.effectiveSalePrice === null ? (
                  <span className="text-app-muted">{t('noPriceTitle')}</span>
                ) : (
                  <>
                    <Amount
                      className="text-app-strong font-mono"
                      currency={currency}
                      currencyDisplay="code"
                      value={state.detail.effectiveSalePrice}
                    />{' '}
                    <span className="rz-caption">
                      {t('perUnit', {
                        unit: unitLabel(state.detail.unit, locale),
                      })}
                    </span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>{t('placement')}</dt>
              <dd>{placementLabel(state.zones, links.inventory, t)}</dd>
            </div>
            <div>
              <dt>{tl('colCar')}</dt>
              <dd>
                {state.detail.carId ? (
                  links.cars ? (
                    <Link to={`/app/${tenantSlug}/cars/${state.detail.carId}`}>
                      {[
                        state.detail.carBrand,
                        state.detail.carModel,
                        state.detail.carYear,
                      ]
                        .filter(Boolean)
                        .join(' ') ||
                        (state.detail.carCode ?? t('sourceCarFallback'))}
                    </Link>
                  ) : (
                    [
                      state.detail.carBrand,
                      state.detail.carModel,
                      state.detail.carYear,
                    ]
                      .filter(Boolean)
                      .join(' ') ||
                    (state.detail.carCode ?? t('sourceCarFallback'))
                  )
                ) : state.detail.intakeId ? (
                  t('sourceIntake')
                ) : (
                  t('sourceNone')
                )}
              </dd>
            </div>
          </dl>
          <section className="rz-peek__section" aria-label={t('history')}>
            <h3 className="rz-label m-0">{t('history')}</h3>
            {(state.history?.events ?? []).length === 0 ? (
              <p className="rz-caption m-0">{t('historyEmpty')}</p>
            ) : (
              <ol className="rz-timeline -mx-3">
                {(state.history?.events ?? []).slice(0, 3).map((event) => (
                  <li key={event.id}>
                    <span aria-hidden className="rz-timeline__icon">
                      {HISTORY_ICON[historyKind(event.eventType, event.data)]}
                    </span>
                    <span className="min-w-0">
                      <span className="text-app-strong font-medium">
                        {historyLabel(event.eventType, locale)}
                      </span>
                      {event.order ? (
                        <span className="text-app-muted font-mono">
                          {' '}
                          {t('orderNumber', {
                            number: String(event.order.number),
                          })}
                        </span>
                      ) : null}
                    </span>
                    <span className="rz-timeline__date">
                      {format.date(event.createdAt) ?? ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </aside>
  )
}

/** One of the three counts a part is split into, as a `.rz-kpi` cell. */
function StockTile({
  label,
  sub,
  tone = 'plain',
  value,
}: {
  label: string
  sub: string
  tone?: 'warn' | 'plain'
  value: number
}) {
  return (
    <div className="rz-kpi p-3">
      <dt className="rz-kpi__label">{label}</dt>
      <dd className="m-0 grid gap-1.5">
        <span
          className={cn(
            'font-mono text-page tabular-nums',
            value === 0
              ? 'text-app-dim'
              : tone === 'warn'
                ? 'text-state-warn'
                : 'text-app-strong',
          )}
        >
          {value}
        </span>
        <span className="rz-kpi__meta text-pretty">{sub}</span>
      </dd>
    </div>
  )
}

/** A part belongs to one car or intake. */
const SOURCE_KINDS = [
  { value: 'car', label: 'kindCarLabel', hint: 'kindCarHint' },
  { value: 'batch', label: 'kindBatchLabel', hint: 'kindBatchHint' },
] as const

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
        'rz-choice-card w-full bg-transparent text-left',
        picked && 'border-brand bg-brand-soft',
      )}
      onClick={onPick}
      type="button"
    >
      <span
        aria-hidden
        className={cn('rz-radio mt-0.5 shrink-0', picked && 'border-brand')}
      >
        {picked ? <span className="bg-brand size-1.5 rounded-full" /> : null}
      </span>
      <span className="grid min-w-0 gap-1">
        <span className="font-semibold text-app-strong">{t(kind.label)}</span>
        <span className="rz-caption text-pretty">{t(kind.hint)}</span>
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
  /** Framed page sections or plain sections inside an existing surface. */
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
  const nextCompatibilityKey = useRef(0)
  const showCompatibility = !edit
  const step = (number: string, title: string) =>
    !edit ? (
      <span className="flex items-baseline gap-2.5">
        <span aria-hidden className="text-brand-text font-mono text-micro">
          {number}
        </span>
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
          {!edit ? (
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
            <SelectPicker
              label={t('sourceType')}
              searchable={false}
              hint={edit ? t('sourceTypeEditHint') : t('sourceTypeCreateHint')}
              disabled={edit ?? false}
              value={values.sourceType}
              options={[
                ...(canViewCars || values.sourceType === 'car'
                  ? [{ value: 'car', label: t('optionCar') }]
                  : []),
                ...(canViewIntakes || values.sourceType === 'batch'
                  ? [{ value: 'batch', label: t('optionBatch') }]
                  : []),
              ]}
              onValueChange={(value) =>
                setValues({ ...values, sourceType: value, sourceId: '' })
              }
              showLabel
            />
          )}
          {values.sourceType === 'car' && canViewCars ? (
            <SelectPicker
              label={t('sourceCar')}
              error={errors.sourceId}
              hint={edit ? t('carEditHint') : t('carCreateHint')}
              disabled={(edit ?? false) || sourceOptions.carsUnavailable}
              value={values.sourceId}
              options={[
                { value: '', label: t('chooseCarOption') },
                ...sourceOptions.cars.map((item) => ({
                  value: item.id,
                  label: carLabel(item),
                })),
                ...(values.sourceId &&
                !sourceOptions.cars.some((item) => item.id === values.sourceId)
                  ? [{ value: values.sourceId, label: t('carOutside') }]
                  : []),
              ]}
              onValueChange={(value) =>
                setValues({ ...values, sourceId: value })
              }
              required={!edit}
              showLabel
            />
          ) : values.sourceType === 'batch' && canViewIntakes ? (
            <SelectPicker
              label={t('sourceBatch')}
              error={errors.sourceId}
              hint={edit ? t('batchEditHint') : t('batchCreateHint')}
              disabled={(edit ?? false) || sourceOptions.intakesUnavailable}
              value={values.sourceId}
              options={[
                { value: '', label: t('chooseBatchOption') },
                ...sourceOptions.intakes.map((item) => ({
                  value: item.id,
                  label: intakeLabel(item, locale),
                })),
                ...(values.sourceId &&
                !sourceOptions.intakes.some(
                  (item) => item.id === values.sourceId,
                )
                  ? [{ value: values.sourceId, label: t('batchOutside') }]
                  : []),
              ]}
              onValueChange={(value) =>
                setValues({ ...values, sourceId: value })
              }
              required={!edit}
              showLabel
            />
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
            <p className="rz-caption m-0 text-pretty">
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
          <Field hint={t('oemHint')} label={t('oem')}>
            <TextInput
              aria-label={t('oem')}
              maxLength={100}
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
        {!edit ? (
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
            <p className="rz-caption m-0 text-pretty">
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
            <QuantityStepper
              label={t('quantityInStock')}
              min={1}
              onChange={(next) =>
                setValues({ ...values, quantity: String(next) })
              }
              value={Number(values.quantity) || 1}
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
            <div className="rz-inset flex items-center gap-3">
              <span aria-hidden className="rz-state__icon shrink-0">
                <Lock className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-app-strong">
                  {sourceCar.brand} {sourceCar.model}{' '}
                  <span className="text-app-dim">·</span>{' '}
                  <span className="text-app-ink font-mono font-medium">
                    {sourceCar.year}
                  </span>
                </span>
                <span className="rz-caption mt-0.5 block text-pretty">
                  {t('compatFromSource')}
                </span>
              </span>
            </div>
          )}
          {compatibility === undefined ? null : (
            <div className="grid gap-2.5">
              {compatibility.rows.map((row, index) => (
                <CompatibilityRowCard
                  index={index + (sourceCar === null ? 1 : 2)}
                  key={row.key}
                  onChange={(patch) =>
                    compatibility.setRows(
                      compatibility.rows.map((item) =>
                        item.key === row.key ? { ...item, ...patch } : item,
                      ),
                    )
                  }
                  onRemove={() =>
                    compatibility.setRows(
                      compatibility.rows.filter((item) => item.key !== row.key),
                    )
                  }
                  row={row}
                />
              ))}
              <Button
                className="w-full justify-center border-dashed"
                onClick={() => {
                  nextCompatibilityKey.current += 1
                  compatibility.setRows([
                    ...compatibility.rows,
                    emptyRow(
                      `row-${String(Date.now())}-${String(nextCompatibilityKey.current)}`,
                    ),
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
 * Other codes use the shared error translations; a failure without a code gets
 * the form's generic sentence.
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
    : localizeApiError(problem, locale)
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
  const tPlacement = useT(placementMessages)
  const tc = useT(commonMessages)
  const toast = useOptionalToast()
  const { locale } = useLocale()
  const base = `/app/${cabinet.targetTenant?.slug ?? ''}/parts`
  const canPlace =
    allowedToView(cabinetModules.inventory, cabinet) &&
    Boolean(cabinet.snapshot?.permissions.has('inventory.zones.manage'))
  const placementOptions = usePlacementOptions(
    canPlace,
    cabinet.targetTenant?.id,
  )
  // Coming back from creating a car or intake restores what was typed.
  const [draft] = useState(() =>
    searchParams.get(DRAFT_PARAM) === '1'
      ? readPartDraft<PartFormValues>(`/app/${cabinet.targetTenant!.slug}`)
      : null,
  )
  useEffect(() => {
    if (draft) clearPartDraft()
  }, [draft])
  const [compatRows, setCompatRows] = useState<CompatibilityRow[]>(
    () => draft?.compatibility.filter((row) => !isBlankRow(row)) ?? [],
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
      const placement = values.placement
      let placementFailed = false
      if (canPlace && placement?.zoneId) {
        try {
          await inventoryApi.replacePartZones(
            created.id,
            [placement.zoneId],
            { signal: scope.signal },
            placement.shelfId || undefined,
            placement.sectionId || undefined,
          )
        } catch {
          placementFailed = true
        }
      }
      guard.afterSave(pricing)
      toast?.show({
        tone: placementFailed ? 'danger' : 'ok',
        message: placementFailed ? tPlacement('saveFailed') : t('created'),
      })
      void navigate(
        cabinetPath(cabinet.targetTenant!.slug, 'parts', created.id),
        {
          replace: true,
        },
      )
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
    <FormPage
      backTo={base}
      busy={pending}
      footerNote={
        <div className="grid gap-2">
          {price.saveNotes}
          <p
            className={cn(
              'm-0 text-caption text-pretty',
              ready ? 'text-app-muted' : 'text-state-warn',
            )}
          >
            {footerNote}
          </p>
        </div>
      }
      actions={
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
      }
      context={t('sheetEyebrow')}
      title={title}
    >
      <form
        className="grid gap-4"
        id={CREATE_PART_FORM}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <p className="rz-caption m-0 text-pretty">
          {t('requiredFields')} <span className="text-brand-text">*</span>.{' '}
          {t('restLater')}
        </p>
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
          variant="panel"
        />
        {canPlace ? (
          <SectionPanel
            title={
              <span className="flex items-baseline gap-2.5">
                <span
                  aria-hidden
                  className="text-brand-text font-mono text-micro"
                >
                  06
                </span>
                {tPlacement('title')}
              </span>
            }
            description={tPlacement('hint')}
            variant="panel"
          >
            <PartPlacementPicker
              value={values.placement ?? emptyPartPlacement}
              onChange={(placement) => setValues({ ...values, placement })}
              options={placementOptions}
            />
          </SectionPanel>
        ) : null}
        <PartMediaFields
          deferUploads
          items={mediaItems}
          requireLatestMutation={requireLatestMutation}
          setItems={setMediaItems}
          title={
            <span className="flex items-baseline gap-2.5">
              <span
                aria-hidden
                className="text-brand-text font-mono text-micro"
              >
                {canPlace ? '07' : '06'}
              </span>
              {t('photos')}
            </span>
          }
          variant="panel"
        />
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </FormPage>
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
  const td = useT(partDetailMessages)
  const tl = useT(lostResponseMessages)
  const tc = useT(commonMessages)
  const toast = useOptionalToast()
  const mountedRef = useRef(true)
  const { locale } = useLocale()
  const [values, setValues] = useState<PartFormValues | null>(null)
  const [detail, setDetail] = useState<PartDetail | null>(null)
  const priceRestriction = partEditingRestriction(detail?.status, locale)
  const [compatState, setCompatState] = useState<{
    partId: string
    data: PartCompatibilities | null
    error: boolean
  } | null>(null)
  const compat = compatState?.partId === partId ? compatState : null
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
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void partsApi.compatibilities(partId, { signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted)
          setCompatState({ partId, data: result, error: false })
      },
      () => {
        if (!controller.signal.aborted)
          setCompatState({ partId, data: null, error: true })
      },
    )
    return () => controller.abort()
  }, [partId])
  useEffect(() => {
    const controller = new AbortController()
    void partsApi.get(partId, { signal: controller.signal }).then(
      (part) => {
        if (controller.signal.aborted) return
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
    const pricing =
      price.hasPrice && !price.disabled && priceRestriction === null
    const finishSave = () => {
      if (!mountedRef.current) return
      requireLatestMutation({ quota: false })
      guard.afterSave(pricing)
      toast?.show({ tone: 'ok', message: t('saved') })
      void navigate(backTo, { replace: true })
    }
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
          oemCode: optional(values.oemCode) ?? null,
          condition: optional(values.condition) ?? null,
          notes: optional(values.notes) ?? null,
          quantity: parsed.quantity,
          partType: optional(values.partType) ?? null,
          unit: PIECES_UNIT,
          photoKeys: committedPhotoKeys(mediaItems),
          // Without an accounting currency the price is left as it is.
          desiredSalePrice:
            price.disabled || priceRestriction !== null
              ? { isSet: false }
              : { isSet: true, value: parsed.price ?? null },
        },
        { signal: scope.signal },
      )
      if (scope.signal.aborted) return
      finishSave()
    } catch (failure) {
      if (!mountedRef.current) return
      if (!isLostResponse(failure)) {
        const problem = normalizeApiProblem(failure)
        const fieldMessage = Object.values(problem.fieldErrors ?? {}).flat()[0]
        setError(
          fieldMessage ??
            (problem.status !== undefined && problem.status < 500
              ? problem.message
              : t('saveFailed')),
        )
        return
      }
      // The PATCH may have landed: read the part back first. Saving the same
      // values again is safe, and the form keeps them meanwhile.
      setStatus(tl('checking'))
      try {
        const scope = requireLatestMutation({ quota: false })
        const fresh = await partsApi.get(partId, { signal: scope.signal })
        if (!mountedRef.current || scope.signal.aborted) return
        const photoKeys = committedPhotoKeys(mediaItems)
        const storedPhotoKeys = (fresh.photos ?? []).map(
          (photo) => photo.storageKey,
        )
        const landed =
          fresh.name === values.name.trim() &&
          (fresh.oemCode ?? null) === (optional(values.oemCode) ?? null) &&
          fresh.quantityTotal === parsed.quantity &&
          (fresh.notes ?? null) ===
            (optional(values.notes) ?? detail?.notes ?? null) &&
          (fresh.condition ?? null) ===
            (optional(values.condition) ?? detail?.condition ?? null) &&
          (fresh.partType ?? null) ===
            (optional(values.partType) ?? detail?.partType ?? null) &&
          storedPhotoKeys.length === photoKeys.length &&
          storedPhotoKeys.every((key, index) => key === photoKeys[index]) &&
          (price.disabled || fresh.desiredSalePrice === (parsed.price ?? null))
        if (landed) finishSave()
        else {
          setStatus(null)
          setError(tl('notSaved'))
        }
      } catch {
        if (!mountedRef.current) return
        setStatus(null)
        setError(tl('checkFailed'))
      }
    } finally {
      pendingRef.current = false
      if (mountedRef.current) setPending(false)
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

  const editStep = (number: string, title: string) => (
    <span className="flex items-baseline gap-2.5">
      <span aria-hidden className="text-brand-text font-mono text-micro">
        {number}
      </span>
      {title}
    </span>
  )

  return (
    <FormPage
      backTo={backTo}
      busy={pending || deleting}
      description={
        detail?.name ??
        (!error ? <Skeleton className="h-3 w-56 max-w-full" /> : undefined)
      }
      context={t('sheetEyebrow')}
      actions={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button
            disabled={pending || deleting}
            onClick={() => void navigate(backTo)}
            type="button"
          >
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending || mediaPending}
            disabled={pending || mediaPending || values === null}
            form="part-edit"
            type="submit"
            variant="primary"
          >
            {t('saveChanges')}
          </Button>
        </div>
      }
      title={t('editTitle')}
    >
      <div className="grid gap-5">
        {status ? <Notice tone="info">{status}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}

        {values ? (
          <form
            className="grid gap-4"
            id="part-edit"
            noValidate
            onSubmit={(event) => void save(event)}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-app-muted text-caption">
                {t('available')}{' '}
                <span className="text-app-ink font-mono tabular-nums">
                  {detail?.quantityAvailable ?? 0}{' '}
                  {unitLabel(values.unit, locale)}
                </span>
              </span>
              <span className="text-app-muted text-caption">
                {t('reserved')}{' '}
                <span className="text-app-ink font-mono tabular-nums">
                  {detail?.quantityReserved ?? 0}{' '}
                  {unitLabel(values.unit, locale)}
                </span>
              </span>
              {detail?.qrCode ? (
                <span className="rz-code max-w-full">
                  <span className="text-app-dim">{t('qrCode')}</span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {detail.qrCode}
                  </span>
                </span>
              ) : null}
              <Button asChild size="sm" className="sm:ml-auto">
                <Link to={`/app/${tenantSlug}/stickers?part=${partId}`}>
                  <Printer aria-hidden />
                  {t('printSticker')}
                </Link>
              </Button>
            </div>
            <div className="grid gap-4">
              <SectionPanel
                aside={
                  <span className="text-app-dim text-body">
                    {t('notEditable')}
                  </span>
                }
                title={editStep('01', t('sourceStep'))}
                variant="panel"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid min-w-0 gap-1">
                    <span className="font-semibold break-words text-app-strong">
                      {detail?.carId && detail.carCode
                        ? t('fromCar', { code: detail.carCode })
                        : detail?.intakeId
                          ? t('fromIntake')
                          : sourceLabel(values.sourceType, locale)}
                    </span>
                    {detail?.carId && detail.carBrand ? (
                      <span className="text-app-muted text-body">
                        {detail.carBrand} {detail.carModel}
                      </span>
                    ) : null}
                  </div>
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
              </SectionPanel>

              <SectionPanel
                title={editStep('02', t('describeStep'))}
                variant="panel"
              >
                <div className="grid gap-4">
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
                    <Field hint={t('oemHint')} label={t('oem')}>
                      <TextInput
                        className="font-mono"
                        maxLength={100}
                        name="oemCode"
                        onChange={(event) =>
                          setValues((current) =>
                            current
                              ? { ...current, oemCode: event.target.value }
                              : current,
                          )
                        }
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
              </SectionPanel>

              <SectionPanel
                title={editStep('03', t('conditionStep'))}
                variant="panel"
              >
                <div className="grid gap-4">
                  <p className="text-app-muted text-body">
                    {t('conditionDescription')}
                  </p>
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
                          setValues((current) =>
                            current
                              ? { ...current, condition: option.value }
                              : current,
                          )
                        }
                        picked={values.condition === option.value}
                        value={option.value}
                      />
                    ))}
                  </div>
                  <p className="rz-caption m-0 text-pretty">
                    {t('conditionVisible')}
                  </p>
                </div>
              </SectionPanel>

              <SectionPanel
                description={t('quantityDescription')}
                title={editStep('04', t('quantityStep'))}
                variant="panel"
              >
                <div className="grid gap-3">
                  <div className="grid items-start gap-3 sm:grid-cols-3">
                    <Field
                      error={errors.quantity}
                      label={t('quantity')}
                      required
                    >
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
                      hint={priceRestriction ?? price.hint}
                      label={t('desiredPrice')}
                    >
                      <MoneyInput
                        currency={price.currency}
                        disabled={price.disabled || priceRestriction !== null}
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
                </div>
              </SectionPanel>

              <SectionPanel
                aside={
                  <span className="text-app-dim text-body">
                    {t('readOnly')}
                  </span>
                }
                title={editStep('05', t('compatStep'))}
                variant="panel"
              >
                <p className="text-app-muted text-body">
                  {t('compatReadOnly')}
                </p>
                {compat?.error ? (
                  <Notice tone="danger">{t('compatLoadFailed')}</Notice>
                ) : compat === null ? (
                  <p className="text-app-muted text-body">
                    {td('loadingShort')}
                  </p>
                ) : compat.data?.items.length === 0 ? (
                  <p className="text-app-muted text-body">
                    {td('compatEmpty')}
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {compat.data?.items.map((item) => (
                      <SpecGrid
                        key={item.id}
                        specs={[
                          {
                            label: t('make'),
                            value: item.makeName ?? item.equipmentTypeName,
                          },
                          {
                            label: t('model'),
                            value: item.modelName ?? td('anyModel'),
                          },
                          {
                            label: t('year'),
                            value: yearSpan(item.yearFrom, item.yearTo, td),
                          },
                        ]}
                      />
                    ))}
                  </div>
                )}
              </SectionPanel>

              <PartMediaFields
                description={t('photosUploadNow')}
                title={editStep('06', t('photos'))}
                items={mediaItems}
                requireLatestMutation={requireLatestMutation}
                setItems={setMediaItems}
                variant="panel"
              />
            </div>

            <PanelFooter
              leading={
                detail && detail.quantityReserved > 0
                  ? t('deleteBlocked')
                  : t('deleteAllowed')
              }
            >
              <Button
                disabled={pending || deleting}
                onClick={() => setConfirmingDelete(true)}
                type="button"
                variant="danger"
              >
                <Trash2 aria-hidden />
                {t('deletePart')}
              </Button>
            </PanelFooter>
          </form>
        ) : !error ? (
          <div aria-busy="true">
            <p className="sr-only" role="status">
              {td('loading')}
            </p>
            <PartFormSkeleton edit footer={false} />
          </div>
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
    </FormPage>
  )
}
