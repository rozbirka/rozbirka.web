import { apiClient } from './client'
import type { Page, RequestOptions } from './contracts'

export interface PartListItem {
  id: string
  name: string
  externalCode?: string | null
  photos: string[]
  quantityTotal: number
  quantityReserved: number
  quantityAvailable: number
  quantitySoldTotal: number
  status: string
  car: {
    id: string
    make: string
    model: string
    year: number
    vin: string | null
  } | null
  order: { id: string; number: number } | null
}

export interface PartDetail {
  id: string
  name: string
  condition: string
  notes: string | null
  qrCode: string
  unit: string
  source: string
  oemCode: string | null
  carId: string | null
  carCode: string | null
  carBrand: string | null
  carModel: string | null
  carYear: number | null
  intakeId: string | null
  createdAt: string
  createdById: string
  createdByName: string
  desiredSalePrice: number | null
  salePrice: number | null
  effectiveSalePrice: number | null
  soldAt: string | null
  partType: string | null
  photos: {
    id: string
    storageKey: string
    url: string
    thumbnailUrl: string
    sortOrder: number
  }[]
  quantityTotal: number
  quantityReserved: number
  quantityAvailable: number
  quantitySoldTotal: number
  status: string
  compatCarBrand: string | null
  compatCarModel: string | null
  compatCarYear: number | null
  order: {
    id: string
    number: number
    status: string
    customerName: string | null
    createdAt: string
    confirmedAt: string | null
    payments: { amount: number; currency: string; accountName: string }[] | null
  } | null
  reservations:
    | {
        orderId: string
        orderNumber: number
        quantity: number
        customerName: string | null
      }[]
    | null
  soldOrders:
    | {
        orderId: string
        orderNumber: number
        quantitySold: number
        unitPrice: number
        confirmedAt: string | null
        customerName: string | null
      }[]
    | null
}

/** Sort keys the search endpoint accepts. */
export type PartSort = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'
export type PartCondition = 'good' | 'fair' | 'scrap' | 'new' | 'refurbished'
export type PartOrigin = 'car' | 'batch' | 'free'

/** Every dimension the facet endpoint can count. */
export type PartFacetDimension =
  | 'status'
  | 'warehouse'
  | 'zone'
  | 'condition'
  | 'equipmentType'
  | 'make'
  | 'model'
  | 'generation'
  | 'origin'
  | 'quality'
  | 'inventoryLock'
  | 'discrepancy'

export interface PartCompatibilityFilter {
  equipmentTypeIds?: string[]
  makeIds?: string[]
  modelIds?: string[]
  generationIds?: string[]
  year?: number | null
  catalogVerifiedOnly?: boolean
}

/**
 * The whole filter of the parts screen in one object. Empty arrays mean "no
 * restriction on this dimension" — the server reads a missing filter and an
 * empty one the same way.
 */
export interface PartSearchRequest {
  query?: string | null
  statuses?: string[]
  carIds?: string[]
  warehouseIds?: string[]
  zoneIds?: string[]
  conditions?: PartCondition[]
  originTypes?: PartOrigin[]
  compatibility?: PartCompatibilityFilter
  missingCompatibility?: boolean | null
  missingPlacement?: boolean | null
  missingOem?: boolean | null
  inventoryLocked?: boolean | null
  hasDiscrepancy?: boolean | null
  sort?: PartSort
  page?: number
  pageSize?: number
}

export interface PartSearchItem {
  id: string
  name: string
  oemCode: string | null
  quantity: number
  quantityAvailable: number
  quantityReserved: number
  unit: string
  condition: PartCondition
  sourceType: PartOrigin
  status: string
  createdAt: string
  isInventoryLocked: boolean
  hasDiscrepancy: boolean
  thumbnailUrl: string | null
  car: {
    id: string
    make: string
    model: string
    year: number
    vin: string | null
  } | null
}

/** One value of a filter with how many parts carry it under the current filter. */
export interface PartFacetValue {
  id: string
  name: string
  count: number
}

export interface PartFacets {
  statuses: PartFacetValue[]
  warehouses: PartFacetValue[]
  zones: PartFacetValue[]
  conditions: PartFacetValue[]
  equipmentTypes: PartFacetValue[]
  makes: PartFacetValue[]
  models: PartFacetValue[]
  generations: PartFacetValue[]
  origins: PartFacetValue[]
  qualityFlags: PartFacetValue[]
  inventoryLocks: PartFacetValue[]
  discrepancies: PartFacetValue[]
}

export interface PartsSummary {
  total: number
  available: number
  reserved: number
  sold: number
}
export interface PartHistory {
  partId: string
  events: {
    id: string
    eventType: string
    data: string | null
    createdAt: string
    user: { id: string; name: string }
    order: { id: string; number: number } | null
  }[]
}
export interface PartListOptions {
  q?: string
  status?: string
  make?: string
  page?: number
  pageSize?: number
  carIds?: string[]
  intakeIds?: string[]
  signal?: AbortSignal
}
/**
 * One line of "this part fits that vehicle", as Core stores it: against the
 * yard's equipment catalogue, by identifier.
 */
export interface PartCompatibilityInput {
  equipmentTypeId: string
  makeId?: string | null
  modelId?: string | null
  yearFrom?: number | null
  yearTo?: number | null
}

export interface PartCompatibilityItem {
  id: string
  equipmentTypeId: string
  equipmentTypeName: string
  makeId: string | null
  makeName: string | null
  modelId: string | null
  modelName: string | null
  yearFrom: number | null
  yearTo: number | null
  /** `DonorObservation` is the row Core took from the part's own car. */
  evidenceType: string
}

export interface PartCompatibilities {
  partId: string
  /** Guards a replace against someone else's edit; send it back unchanged. */
  version: string
  items: PartCompatibilityItem[]
}

export interface CreatePartRequest {
  sourceType: string
  carId?: string | null
  intakeId?: string | null
  name: string
  partType?: string | null
  oemCode?: string | null
  condition?: string | null
  notes?: string | null
  quantity: number
  unit?: string | null
  photoKeys: string[]
  carBrand?: string | null
  carModel?: string | null
  carYear?: number | null
  /**
   * Sending this makes Core take it as the whole truth: for a part off a car
   * the donor row it would otherwise observe is *not* created. Leave it out
   * there and replace afterwards instead.
   */
  compatibilities?: PartCompatibilityInput[]
  desiredSalePrice?: number | null
}
export interface UpdatePartRequest {
  name?: string | null
  condition?: string | null
  notes?: string | null
  quantity?: number | null
  partType?: string | null
  unit?: string | null
  photoKeys?: string[] | null
  desiredSalePrice: { isSet: boolean; value?: number | null }
}

const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

/**
 * Core serialises with `JsonIgnoreCondition.WhenWritingNull`, so a part with
 * no car or no order does not arrive carrying nulls — those properties are
 * simply absent. Read straight off the response, `part.car === null` is then
 * false for a part that has no car at all, and the next line reaches into
 * undefined. Every optional relation is put back as an explicit null here,
 * once, so nothing downstream has to know.
 */
const normalizeItem = (item: PartListItem): PartListItem => ({
  ...item,
  externalCode: item.externalCode ?? null,
  photos: item.photos ?? [],
  car: item.car ?? null,
  order: item.order ?? null,
})

export const partsApi = {
  async list(options: PartListOptions = {}): Promise<Page<PartListItem>> {
    const { signal, pageSize = 30, carIds, intakeIds, ...params } = options
    const response = await apiClient.get<Page<PartListItem>>('/parts', {
      params: {
        ...params,
        per_page: pageSize,
        ...(carIds?.length ? { car_ids: carIds } : {}),
        ...(intakeIds?.length ? { intake_ids: intakeIds } : {}),
      },
      ...(signal ? { signal } : {}),
    })
    return { ...response.data, items: response.data.items.map(normalizeItem) }
  },
  /**
   * The filtered list. Unlike `list`, this one carries every dimension the
   * screen filters by — condition, origin, placement, compatibility.
   */
  async search(
    request: PartSearchRequest,
    options: RequestOptions = {},
  ): Promise<Page<PartSearchItem>> {
    const page = (
      await apiClient.post<Page<PartSearchItem>>(
        '/parts/search',
        request,
        requestConfig(options),
      )
    ).data
    // The same omission as the list: a part with no car arrives without the
    // property rather than with a null one.
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        oemCode: item.oemCode ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        car: item.car ?? null,
      })),
    }
  },
  /**
   * How many parts sit behind each filter value, counted under the *rest* of
   * the filter — so a count never promises a result the click cannot deliver.
   */
  async facets(
    filter: PartSearchRequest,
    requested: readonly PartFacetDimension[],
    options: RequestOptions = {},
  ): Promise<PartFacets> {
    return (
      await apiClient.post<PartFacets>(
        '/parts/search/facets',
        { filter, requested },
        requestConfig(options),
      )
    ).data
  },
  async summary(options: RequestOptions = {}): Promise<PartsSummary> {
    return (
      await apiClient.get<PartsSummary>(
        '/parts/summary',
        requestConfig(options),
      )
    ).data
  },
  async makes(options: RequestOptions = {}): Promise<string[]> {
    return (
      await apiClient.get<{ makes: string[] }>(
        '/parts/makes',
        requestConfig(options),
      )
    ).data.makes
  },
  async get(id: string, options: RequestOptions = {}): Promise<PartDetail> {
    return (
      await apiClient.get<PartDetail>(
        `/parts/${encodeURIComponent(id)}`,
        requestConfig(options),
      )
    ).data
  },
  async history(
    id: string,
    options: RequestOptions = {},
  ): Promise<PartHistory> {
    return (
      await apiClient.get<PartHistory>(
        `/parts/${encodeURIComponent(id)}/history`,
        requestConfig(options),
      )
    ).data
  },
  async create(
    request: CreatePartRequest,
    options: RequestOptions = {},
  ): Promise<PartDetail> {
    return (
      await apiClient.post<PartDetail>(
        '/parts',
        request,
        requestConfig(options),
      )
    ).data
  },
  async compatibilities(
    partId: string,
    options: RequestOptions = {},
  ): Promise<PartCompatibilities> {
    const result = (
      await apiClient.get<PartCompatibilities>(
        `/parts/${encodeURIComponent(partId)}/compatibilities`,
        requestConfig(options),
      )
    ).data
    return { ...result, items: result.items ?? [] }
  },
  /**
   * Replaces the manual rows only: what Core observed from the donor car
   * stays, which is the one way to have both on a single part.
   */
  async replaceCompatibilities(
    partId: string,
    expectedVersion: string,
    items: PartCompatibilityInput[],
  ): Promise<PartCompatibilities> {
    const result = (
      await apiClient.put<PartCompatibilities>(
        `/parts/${encodeURIComponent(partId)}/compatibilities`,
        { expectedVersion, items },
      )
    ).data
    return { ...result, items: result.items ?? [] }
  },
  async update(
    id: string,
    request: UpdatePartRequest,
    options: RequestOptions = {},
  ): Promise<PartDetail> {
    return (
      await apiClient.put<PartDetail>(
        `/parts/${encodeURIComponent(id)}`,
        request,
        requestConfig(options),
      )
    ).data
  },
  async delete(id: string, options: RequestOptions = {}): Promise<void> {
    await apiClient.delete(
      `/parts/${encodeURIComponent(id)}`,
      requestConfig(options),
    )
  },
}
