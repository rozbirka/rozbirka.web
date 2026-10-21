import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type { components } from './generated/core'

export type Warehouse = components['schemas']['WarehouseDto']
export type WarehouseDetail = components['schemas']['WarehouseDetailDto']
export type InventoryZone = components['schemas']['InventoryZoneDto']
export interface InventorySection {
  id: string
  zoneId: string
  zoneName: string
  warehouseId: string
  warehouseName: string
  name: string
  code: string
  qrCode: string
  isActive: boolean
  partCount: number | null
}
export interface InventoryShelf {
  id: string
  zoneId: string
  zoneName: string
  warehouseId: string
  warehouseName: string
  name: string
  code: string
  qrCode: string
  isActive: boolean
  sectionId: string
  sectionName: string
  partCount: number | null
}
export type InventorySession = components['schemas']['InventorySessionDto']
export type InventorySessionResults =
  components['schemas']['InventorySessionResultsDto']
export type InventoryPartResult =
  components['schemas']['InventoryPartResultDto']
export type InventoryAuditEvent =
  components['schemas']['InventoryAuditEventDto']
export type InventoryScan = components['schemas']['InventoryScanDto']
export type InventoryAdjustment =
  components['schemas']['InventoryAdjustmentDto']
export type PartInventoryZone =
  components['schemas']['PartInventoryZoneDto'] & {
    shelfId?: string | null
    shelfName?: string | null
    shelfCode?: string | null
    sectionId?: string | null
    sectionName?: string | null
  }

export interface WarehouseInput {
  name: string
  code: string
}

export interface WarehouseUpdate extends WarehouseInput {
  isActive: boolean
}

export interface ZoneInput {
  warehouseId: string
  name: string
  code: string
}

export interface ZoneUpdate {
  name: string
  code: string
  isActive: boolean
}

export interface InventoryZoneQuery extends RequestOptions {
  warehouseId?: string
  activeOnly?: boolean
  archivedOnly?: boolean
}

type LocationListOptions = RequestOptions & { includePartCounts?: boolean }
export type SectionListOptions = LocationListOptions & {
  archivedOnly?: boolean
}

const config = ({ signal }: RequestOptions = {}) =>
  signal ? { signal } : undefined
const id = encodeURIComponent

export const inventoryApi = {
  async getWarehouses(options: RequestOptions = {}): Promise<Warehouse[]> {
    return (await apiClient.get<Warehouse[]>('/warehouses', config(options)))
      .data
  },
  async getWarehouse(
    warehouseId: string,
    options: RequestOptions = {},
  ): Promise<WarehouseDetail> {
    return (
      await apiClient.get<WarehouseDetail>(
        `/warehouses/${id(warehouseId)}`,
        config(options),
      )
    ).data
  },
  async getZones(options: InventoryZoneQuery = {}): Promise<InventoryZone[]> {
    const { warehouseId, activeOnly, archivedOnly, ...requestOptions } = options
    return (
      await apiClient.get<InventoryZone[]>('/inventory/zones', {
        ...config(requestOptions),
        params: {
          ...(warehouseId ? { warehouseId } : {}),
          ...(activeOnly !== undefined ? { activeOnly } : {}),
          ...(archivedOnly !== undefined ? { archivedOnly } : {}),
        },
      })
    ).data
  },
  async getZone(
    zoneId: string,
    options: RequestOptions = {},
  ): Promise<InventoryZone> {
    return (
      await apiClient.get<InventoryZone>(
        `/inventory/zones/${id(zoneId)}`,
        config(options),
      )
    ).data
  },
  async createWarehouse(
    input: WarehouseInput,
    options: RequestOptions = {},
  ): Promise<Warehouse> {
    return (
      await apiClient.post<Warehouse>('/warehouses', input, config(options))
    ).data
  },
  async updateWarehouse(
    warehouseId: string,
    input: WarehouseUpdate,
    options: RequestOptions = {},
  ): Promise<Warehouse> {
    return (
      await apiClient.put<Warehouse>(
        `/warehouses/${id(warehouseId)}`,
        input,
        config(options),
      )
    ).data
  },
  async archiveWarehouse(
    warehouseId: string,
    options: RequestOptions = {},
  ): Promise<void> {
    await apiClient.delete(`/warehouses/${id(warehouseId)}`, config(options))
  },
  async createZone(
    input: ZoneInput,
    options: RequestOptions = {},
  ): Promise<InventoryZone> {
    return (
      await apiClient.post<InventoryZone>(
        '/inventory/zones',
        input,
        config(options),
      )
    ).data
  },
  async updateZone(
    zoneId: string,
    input: ZoneUpdate,
    options: RequestOptions = {},
  ): Promise<InventoryZone> {
    return (
      await apiClient.put<InventoryZone>(
        `/inventory/zones/${id(zoneId)}`,
        input,
        config(options),
      )
    ).data
  },
  /** Requires the local Core restore contract until its published pin is updated. */
  async restoreZone(
    locationId: string,
    options: RequestOptions = {},
  ): Promise<InventoryZone> {
    return (
      await apiClient.post<InventoryZone>(
        `/inventory/zones/${id(locationId)}/restore`,
        undefined,
        config(options),
      )
    ).data
  },
  async archiveZone(
    zoneId: string,
    options: RequestOptions = {},
  ): Promise<void> {
    await apiClient.delete(`/inventory/zones/${id(zoneId)}`, config(options))
  },
  async getShelves(
    zoneId?: string,
    options: LocationListOptions = {},
    sectionId?: string,
  ): Promise<InventoryShelf[]> {
    return (
      await apiClient.get<InventoryShelf[]>('/inventory/shelves', {
        ...config(options),
        params: {
          ...(zoneId ? { zoneId } : {}),
          ...(sectionId ? { sectionId } : {}),
          includePartCounts: options.includePartCounts ?? false,
        },
      })
    ).data
  },
  async getSection(
    sectionId: string,
    options: RequestOptions = {},
  ): Promise<InventorySection> {
    return (
      await apiClient.get<InventorySection>(
        `/inventory/sections/${id(sectionId)}`,
        config(options),
      )
    ).data
  },
  async getShelf(
    shelfId: string,
    options: RequestOptions = {},
  ): Promise<InventoryShelf> {
    return (
      await apiClient.get<InventoryShelf>(
        `/inventory/shelves/${id(shelfId)}`,
        config(options),
      )
    ).data
  },
  async getSections(
    zoneId?: string,
    options: SectionListOptions = {},
  ): Promise<InventorySection[]> {
    return (
      await apiClient.get<InventorySection[]>('/inventory/sections', {
        ...config(options),
        params: {
          ...(zoneId ? { zoneId } : {}),
          includePartCounts: options.includePartCounts ?? false,
          ...(options.archivedOnly !== undefined
            ? { archivedOnly: options.archivedOnly }
            : {}),
        },
      })
    ).data
  },
  async createSection(
    input: { zoneId: string; name: string; code: string },
    options: RequestOptions = {},
  ): Promise<InventorySection> {
    return (
      await apiClient.post<InventorySection>(
        '/inventory/sections',
        input,
        config(options),
      )
    ).data
  },
  async updateSection(
    sectionId: string,
    input: { name: string; code: string; isActive: boolean },
    options: RequestOptions = {},
  ): Promise<InventorySection> {
    return (
      await apiClient.put<InventorySection>(
        `/inventory/sections/${id(sectionId)}`,
        input,
        config(options),
      )
    ).data
  },
  /** Requires the local Core restore contract until its published pin is updated. */
  async restoreSection(
    locationId: string,
    options: RequestOptions = {},
  ): Promise<InventorySection> {
    return (
      await apiClient.post<InventorySection>(
        `/inventory/sections/${id(locationId)}/restore`,
        undefined,
        config(options),
      )
    ).data
  },
  async archiveSection(
    sectionId: string,
    options: RequestOptions = {},
  ): Promise<void> {
    await apiClient.delete(
      `/inventory/sections/${id(sectionId)}`,
      config(options),
    )
  },
  async createShelf(
    input: { zoneId: string; sectionId: string; name: string; code: string },
    options: RequestOptions = {},
  ): Promise<InventoryShelf> {
    return (
      await apiClient.post<InventoryShelf>(
        '/inventory/shelves',
        input,
        config(options),
      )
    ).data
  },
  async updateShelf(
    shelfId: string,
    input: { name: string; code: string; isActive: boolean },
    options: RequestOptions = {},
  ): Promise<InventoryShelf> {
    return (
      await apiClient.put<InventoryShelf>(
        `/inventory/shelves/${id(shelfId)}`,
        input,
        config(options),
      )
    ).data
  },
  async archiveShelf(
    shelfId: string,
    options: RequestOptions = {},
  ): Promise<void> {
    await apiClient.delete(`/inventory/shelves/${id(shelfId)}`, config(options))
  },
  async getPartZones(
    partId: string,
    options: RequestOptions = {},
  ): Promise<PartInventoryZone[]> {
    return (
      await apiClient.get<PartInventoryZone[]>(
        `/parts/${id(partId)}/inventory-zones`,
        config(options),
      )
    ).data
  },
  async replacePartZones(
    partId: string,
    zoneIds: string[],
    options: RequestOptions = {},
    shelfId?: string,
    sectionId?: string,
  ): Promise<PartInventoryZone[]> {
    return (
      await apiClient.put<PartInventoryZone[]>(
        `/parts/${id(partId)}/inventory-zones`,
        {
          zoneIds,
          ...(shelfId ? { shelfId } : {}),
          ...(sectionId ? { sectionId } : {}),
        },
        config(options),
      )
    ).data
  },
  async getSessions(options: RequestOptions = {}): Promise<InventorySession[]> {
    return (
      await apiClient.get<InventorySession[]>(
        '/inventory/sessions',
        config(options),
      )
    ).data
  },
  async getSession(
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<InventorySession> {
    return (
      await apiClient.get<InventorySession>(
        `/inventory/sessions/${id(sessionId)}`,
        config(options),
      )
    ).data
  },
  async createSession(
    zoneIds: string[],
    options: RequestOptions = {},
  ): Promise<InventorySession> {
    return (
      await apiClient.post<InventorySession>(
        '/inventory/sessions',
        { zoneIds },
        config(options),
      )
    ).data
  },
  async startSession(
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<InventorySession> {
    return (
      await apiClient.post<InventorySession>(
        `/inventory/sessions/${id(sessionId)}/start`,
        undefined,
        config(options),
      )
    ).data
  },
  async reopenSession(
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<InventorySession> {
    return (
      await apiClient.post<InventorySession>(
        `/inventory/sessions/${id(sessionId)}/reopen`,
        undefined,
        config(options),
      )
    ).data
  },
  async completeSession(
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<InventorySession> {
    return (
      await apiClient.post<InventorySession>(
        `/inventory/sessions/${id(sessionId)}/complete`,
        undefined,
        config(options),
      )
    ).data
  },
  async cancelSession(
    sessionId: string,
    reason: string,
    options: RequestOptions = {},
  ): Promise<InventorySession> {
    return (
      await apiClient.post<InventorySession>(
        `/inventory/sessions/${id(sessionId)}/cancel`,
        { reason },
        config(options),
      )
    ).data
  },
  async getResults(
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<InventorySessionResults> {
    return (
      await apiClient.get<InventorySessionResults>(
        `/inventory/sessions/${id(sessionId)}/results`,
        config(options),
      )
    ).data
  },
  async getAudit(
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<InventoryAuditEvent[]> {
    return (
      await apiClient.get<InventoryAuditEvent[]>(
        `/inventory/sessions/${id(sessionId)}/audit`,
        config(options),
      )
    ).data
  },
  async getScans(
    sessionId: string,
    zoneId: string,
    options: RequestOptions = {},
  ): Promise<InventoryScan[]> {
    return (
      await apiClient.get<InventoryScan[]>(
        `/inventory/sessions/${id(sessionId)}/zones/${id(zoneId)}/scans`,
        config(options),
      )
    ).data
  },
  async applyAdjustment(
    sessionId: string,
    partId: string,
    reason: string,
    options: RequestOptions = {},
  ): Promise<InventoryAdjustment> {
    return (
      await apiClient.post<InventoryAdjustment>(
        `/inventory/sessions/${id(sessionId)}/adjustments/${id(partId)}`,
        { reason },
        config(options),
      )
    ).data
  },
}
