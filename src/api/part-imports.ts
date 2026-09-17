import { apiClient } from './client'
import type { RequestOptions } from './contracts'

export interface ImportSelection {
  sheet?: string
  headerRow?: number | null
  startRow?: number
  endRow?: number | null
  delimiter: string
  encoding: string
  acceptHiddenRows?: boolean
  acceptHiddenColumns?: boolean
}
export interface ImportField {
  id: string
  type: string
  required: boolean
  allowed?: string[] | null
}
export interface ImportCapabilities {
  enabled: boolean
  schemaVersion: number
  formats: string[]
  encodings: string[]
  fields: ImportField[]
  transforms: string[]
  limits: {
    maxBytes: number
    maxRows: number
    /** Absent on servers older than the adaptive-import work. */
    maxColumns?: number
  }
  maxOrderGroupSize: number
  /** How many photos one part may carry. Absent before the media work landed. */
  maxPhotosPerEntity?: number
  /** Photos one import may prepare in total. */
  maxPreparedPhotos?: number
}
export interface ImportTransform {
  operation: string
  argument?: string | null
  position?: number
  values?: Record<string, string | null> | null
}
export interface ImportRule {
  target: string
  sources: string[]
  constant?: string | null
  transforms?: ImportTransform[] | null
  separator?: string
  useDisplay?: boolean
  acceptNumericText?: boolean
}
export interface ImportMapping {
  version: number
  schemaVersion: number
  rules: ImportRule[]
  skippedFields: string[]
  transformVersion?: number
}
export interface SourceRow {
  id: string
  row: number
  cells: { column: number; raw: string | null; display?: string | null }[]
}
export interface ImportSource {
  fields: { id: string; column: number; header: string; type: string }[]
  tables: { id: string; name: string; hidden: boolean }[]
  selection: ImportSelection
  warnings: string[]
  rows: SourceRow[]
}
export interface ImportRow {
  rowId: string
  sourceRow: number
  source: SourceRow
  draft: {
    values: Record<string, string | null>
    issues: { code: string; field: string; severity: string }[]
  } | null
  executionStatus?: string | null
  executionErrorCode?: string | null
  partId?: string | null
}
export interface ImportExecution {
  id: string
  status: string
  selected: number
  committed: number
  failed: number
  digest: string
}
export interface ImportStatus {
  id: string
  status: string
  revision: number
  previewVersion: number
  rowCount: number
  createdAt: string
  retentionExpiresAt: string | null
  errorCode: string | null
  digest: string | null
  source: ImportSource | null
  execution: ImportExecution | null
  mapping: ImportMapping | null
  report: {
    version: number
    status: string
    errorCode?: string | null
  } | null
}
export interface ImportPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  revision?: number | null
  previewVersion?: number | null
}
export interface ImportPreparation {
  revision: number
  previewVersion: number
  rowCount: number
  needsDecisionRows: number
}
export interface ImportValidation {
  revision: number
  previewVersion: number
  digest: string | null
  selectedCount: number
  invalidCount: number
  plannedParts: number
  plannedOrders: number
  reservedUnits: number
  plannedCustomers: number
  plannedCars: number
  plannedIntakes: number
  plannedWarehouses: number
  plannedZones: number
  plannedPhotos: number
  /** How reserved rows become orders. Absent before the adaptive-import work. */
  orderGrouping?: string
  maxOrderGroupSize?: number
}
export interface ImportProfile {
  id: string
  name: string
  revision: number
}
const base = '/parts/imports'
const path = (id: string) => `${base}/${encodeURIComponent(id)}`
const get = async <T>(url: string, options: RequestOptions = {}) =>
  (await apiClient.get<T>(url, options)).data
const post = async <T>(
  url: string,
  data: unknown,
  options: RequestOptions = {},
) => (await apiClient.post<T>(url, data, options)).data
export const partImportsApi = {
  capabilities: (options?: RequestOptions) =>
    get<ImportCapabilities>(`${base}/capabilities`, options),
  list: (page = 1, options?: RequestOptions) =>
    get<ImportPage<ImportStatus>>(`${base}?page=${page}&pageSize=50`, options),
  status: (id: string, options?: RequestOptions) =>
    get<ImportStatus>(path(id), options),
  rows: (id: string, page = 1, errors = false, options?: RequestOptions) =>
    get<ImportPage<ImportRow>>(
      `${path(id)}/${errors ? 'errors' : 'rows'}?page=${page}&pageSize=100`,
      options,
    ),
  async upload(
    file: File,
    key: string,
    selection: ImportSelection,
    options: RequestOptions = {},
  ) {
    const form = new FormData()
    form.append('file', file)
    form.append('key', key)
    form.append('delimiter', selection.delimiter)
    form.append('encoding', selection.encoding)
    return (
      await apiClient.post<{ id: string }>(base, form, {
        ...options,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ).data
  },
  analyze: (
    id: string,
    revision: number,
    selection: ImportSelection,
    options?: RequestOptions,
  ) =>
    post<ImportPreparation>(
      `${path(id)}/analysis`,
      { revision, selection },
      options,
    ),
  async map(
    id: string,
    revision: number,
    mapping: ImportMapping,
    options: RequestOptions = {},
  ) {
    return (
      await apiClient.put<ImportPreparation>(
        `${path(id)}/mapping`,
        { revision, mapping },
        options,
      )
    ).data
  },
  validate: (
    id: string,
    input: {
      revision: number
      previewVersion: number
      rowIds: string[]
      duplicateDecisions: Record<string, string>
    },
    options?: RequestOptions,
  ) => post<ImportValidation>(`${path(id)}/validate`, input, options),
  commit: (
    id: string,
    input: {
      revision: number
      previewVersion: number
      digest: string
      key: string
    },
    options?: RequestOptions,
  ) => post<ImportExecution>(`${path(id)}/commit`, input, options),
  cancel: (id: string, revision: number, options?: RequestOptions) =>
    post<ImportStatus>(`${path(id)}/cancel`, { revision }, options),
  retry: (
    id: string,
    revision: number,
    executionId: string | undefined,
    options?: RequestOptions,
  ) =>
    post<ImportStatus>(`${path(id)}/retry`, { revision, executionId }, options),
  profiles: (options?: RequestOptions) =>
    get<ImportProfile[]>(`${base}/profiles`, options),
  matchProfile: (id: string, profileId: string, options?: RequestOptions) =>
    post<{ plan: ImportMapping | null; conflicts: string[] }>(
      `${path(id)}/profiles/${encodeURIComponent(profileId)}/match`,
      {},
      options,
    ),
  saveProfile: (id: string, name: string, options?: RequestOptions) =>
    post<ImportProfile>(`${path(id)}/profiles`, { name }, options),
  async report(id: string, options: RequestOptions = {}) {
    return (
      await apiClient.get<Blob>(`${path(id)}/report`, {
        ...options,
        responseType: 'blob',
      })
    ).data
  },
  retryReport: (id: string, revision: number, options?: RequestOptions) =>
    post<void>(`${path(id)}/report/retry`, { revision }, options),
}
