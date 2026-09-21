import { apiClient } from './client'
import type { RequestOptions } from './contracts'

/** What the tenant integration is doing right now, as Core reports it. */
export type IntegrationStatus = 'draft' | 'active' | 'inactive' | 'error'

export interface IntegrationDefinition {
  id: string
  code: string
  displayName: string
}

/**
 * Settings are provider-shaped and never carry a secret: Nova Poshta reports
 * only whether a key is stored, when it was verified and how many dispatch
 * points are active.
 */
export interface NovaPoshtaPublicSettings {
  configured?: boolean
  verifiedAt?: string | null
  activeDispatchPoints?: number
}

export interface Integration {
  id: string
  definitionId: string
  code: string
  displayName: string
  status: string
  configured: boolean
  verifiedAt: string | null
  lastErrorCode: string | null
  settings: NovaPoshtaPublicSettings | null
}

/**
 * What Core knows about the carrier's status feed. Only counters and ids —
 * the events themselves are not exposed, so nothing here can name a waybill.
 */
export interface NovaPoshtaWebhookStatus {
  enabled: boolean
  pending: number
  deadLetters: number
  oldestPendingAt: string | null
  deadLetterIds: string[]
}

export interface IntegrationDiagnosticCheck {
  code: string
  status: string
  errorCode: string | null
}

export interface NovaPoshtaDispatchPoint {
  id: string
  name: string
  senderName: string
  phone: string
  settlementId: number
  divisionId: number
  companyTin: string | null
  companyName: string | null
  isActive: boolean
  isDefault: boolean
}

export interface NovaPoshtaDispatchPointInput {
  name: string
  senderName: string
  phone: string
  settlementId: number
  divisionId: number
  companyTin?: string | null
  companyName?: string | null
  isActive: boolean
}

/** Nova Poshta's own catalogue, paged the way the carrier pages it. */
export interface NovaPoshtaPage<T> {
  items: T[]
  page: number
  lastPage: number
}

export interface NovaPoshtaSettlement {
  id: number
  name: string
  prohibitedSending: boolean | null
  prohibitedIssuance: boolean | null
}

export interface NovaPoshtaDivision {
  id: number
  name: string
  settlementId: number | null
  countryCode: string
  sendingAllowed: boolean
  receivingAllowed: boolean
}

export interface IntegrationDiagnostics {
  integrationId: string
  status: string
  healthy: boolean
  checkedAt: string
  lastErrorCode: string | null
  checks: IntegrationDiagnosticCheck[]
}

const endpoint = (id: string) => `/integrations/${encodeURIComponent(id)}`
const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

export const integrationsApi = {
  async definitions(
    options: RequestOptions = {},
  ): Promise<IntegrationDefinition[]> {
    return (
      await apiClient.get<IntegrationDefinition[]>(
        '/integrations/definitions',
        requestConfig(options),
      )
    ).data
  },
  async list(options: RequestOptions = {}): Promise<Integration[]> {
    return (
      await apiClient.get<Integration[]>(
        '/integrations',
        requestConfig(options),
      )
    ).data
  },
  async getById(
    id: string,
    options: RequestOptions = {},
  ): Promise<Integration> {
    return (
      await apiClient.get<Integration>(endpoint(id), requestConfig(options))
    ).data
  },
  async create(definitionId: string): Promise<Integration> {
    return (
      await apiClient.post<Integration>('/integrations', { definitionId })
    ).data
  },
  /** The key itself goes one way only — Core stores it encrypted and never returns it. */
  async saveNovaPoshtaKey(id: string, apiKey: string): Promise<Integration> {
    return (
      await apiClient.put<Integration>(`${endpoint(id)}/settings`, {
        settings: { apiKey },
      })
    ).data
  },
  async verify(id: string): Promise<Integration> {
    return (await apiClient.post<Integration>(`${endpoint(id)}/verify`)).data
  },
  async activate(id: string): Promise<Integration> {
    return (await apiClient.post<Integration>(`${endpoint(id)}/activate`)).data
  },
  async deactivate(id: string): Promise<Integration> {
    return (await apiClient.post<Integration>(`${endpoint(id)}/deactivate`))
      .data
  },
  async dispatchPoints(
    id: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaDispatchPoint[]> {
    return (
      await apiClient.get<NovaPoshtaDispatchPoint[]>(
        `${endpoint(id)}/dispatch-points`,
        requestConfig(options),
      )
    ).data
  },
  async createDispatchPoint(
    id: string,
    input: NovaPoshtaDispatchPointInput,
  ): Promise<NovaPoshtaDispatchPoint> {
    return (
      await apiClient.post<NovaPoshtaDispatchPoint>(
        `${endpoint(id)}/dispatch-points`,
        input,
      )
    ).data
  },
  async updateDispatchPoint(
    id: string,
    pointId: string,
    input: NovaPoshtaDispatchPointInput,
  ): Promise<NovaPoshtaDispatchPoint> {
    return (
      await apiClient.put<NovaPoshtaDispatchPoint>(
        `${endpoint(id)}/dispatch-points/${encodeURIComponent(pointId)}`,
        input,
      )
    ).data
  },
  async makeDispatchPointDefault(
    id: string,
    pointId: string,
  ): Promise<NovaPoshtaDispatchPoint> {
    return (
      await apiClient.post<NovaPoshtaDispatchPoint>(
        `${endpoint(id)}/dispatch-points/${encodeURIComponent(pointId)}/default`,
      )
    ).data
  },
  /** Core deactivates the point rather than erasing it — shipments keep their sender. */
  async deactivateDispatchPoint(id: string, pointId: string): Promise<void> {
    await apiClient.delete(
      `${endpoint(id)}/dispatch-points/${encodeURIComponent(pointId)}`,
    )
  },
  async settlements(
    id: string,
    query: string,
    page = 1,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPage<NovaPoshtaSettlement>> {
    return (
      await apiClient.get<NovaPoshtaPage<NovaPoshtaSettlement>>(
        `${endpoint(id)}/shipping/settlements`,
        { params: { query, page }, ...requestConfig(options) },
      )
    ).data
  },
  async divisions(
    id: string,
    settlementId: number,
    page = 1,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPage<NovaPoshtaDivision>> {
    return (
      await apiClient.get<NovaPoshtaPage<NovaPoshtaDivision>>(
        `${endpoint(id)}/shipping/divisions`,
        { params: { settlementId, page }, ...requestConfig(options) },
      )
    ).data
  },
  async webhookStatus(
    id: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaWebhookStatus> {
    return (
      await apiClient.get<NovaPoshtaWebhookStatus>(
        `${endpoint(id)}/webhook`,
        requestConfig(options),
      )
    ).data
  },
  /** A null secret turns the feed off; Core never returns a stored one. */
  async configureWebhook(id: string, secret: string | null): Promise<void> {
    await apiClient.put(`${endpoint(id)}/webhook`, { secret })
  },
  async retryWebhookEvent(id: string, eventId: string): Promise<void> {
    await apiClient.post(
      `${endpoint(id)}/webhook/events/${encodeURIComponent(eventId)}/retry`,
    )
  },
  async diagnose(
    id: string,
    options: RequestOptions = {},
  ): Promise<IntegrationDiagnostics> {
    return (
      await apiClient.post<IntegrationDiagnostics>(
        `${endpoint(id)}/diagnostics`,
        undefined,
        requestConfig(options),
      )
    ).data
  },
}
