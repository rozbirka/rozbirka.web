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

/**
 * The managed status feed: Core registers the subscription with the carrier,
 * enrols each waybill and watches for the callback, so the yard never types a URL
 * or a secret. Only Core's own view of that lifecycle is exposed.
 */
export interface NovaPoshtaTrackingSubscription {
  /**
   * Left as a string on purpose: a state this build has never heard of must
   * render as an unknown state, not crash the screen.
   */
  state: string
  reasonCode: string | null
  /** Waybills still waiting to be attached to the subscription. */
  pendingNumbers: number
  /** Waybills the carrier never confirmed; polling still covers them. */
  unconfirmedNumbers: number
  lastCallbackAt: string | null
  /** False where this environment has no public HTTPS address to be called at. */
  publicCallbackConfigured: boolean
  canRetry: boolean
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
  settlementRef: string
  warehouseRef: string
  counterpartyRef: string
  contactRef: string
  warehouseName: string | null
  settlementName: string | null
  companyTin: string | null
  companyName: string | null
  isActive: boolean
  isDefault: boolean
}

export interface NovaPoshtaDispatchPointInput {
  name: string
  senderName: string
  phone: string
  settlementRef: string
  warehouseRef: string
  counterpartyRef: string
  contactRef: string
  warehouseName?: string | null
  settlementName?: string | null
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
  ref: string
  name: string
  prohibitedSending: boolean | null
  prohibitedIssuance: boolean | null
}

export interface NovaPoshtaDivision {
  ref: string
  name: string
  settlementRef: string | null
  countryCode: string
  sendingAllowed: boolean
  receivingAllowed: boolean
}

/**
 * Delivery choices that belong to the integration rather than to one branch:
 * the sender every waybill goes out as, and the till a post-payment lands in.
 */
export interface NovaPoshtaPreferences {
  codCashRegisterId: string | null
  senderCounterpartyRef: string | null
  senderContactRef: string | null
}

/** A sender the tenant's API key is allowed to dispatch as. */
export interface NovaPoshtaCounterparty {
  ref: string
  name: string
  tin: string | null
  isOrganization: boolean
}

/** A contact person registered under a sender counterparty. */
export interface NovaPoshtaContact {
  ref: string
  name: string
  phone: string | null
}

export interface IntegrationDiagnostics {
  integrationId: string
  status: string
  healthy: boolean
  checkedAt: string
  lastErrorCode: string | null
  checks: IntegrationDiagnosticCheck[]
}

/**
 * Core leaves null properties out of its JSON, so a field that is merely empty
 * arrives as `undefined` and the screens read it as "not loaded yet" — an
 * integration that was never verified looked like one still loading.
 */
const withNulls = (integration: Integration): Integration => ({
  ...integration,
  verifiedAt: integration.verifiedAt ?? null,
  lastErrorCode: integration.lastErrorCode ?? null,
  settings: integration.settings ?? null,
})

/** The same for a diagnostics run, whose checks Core omits when it made none. */
const withDiagnosticNulls = (
  diagnostics: IntegrationDiagnostics,
): IntegrationDiagnostics => ({
  ...diagnostics,
  lastErrorCode: diagnostics.lastErrorCode ?? null,
  checks: (diagnostics.checks ?? []).map((check) => ({
    ...check,
    errorCode: check.errorCode ?? null,
  })),
})

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
    ).data.map(withNulls)
  },
  async getById(
    id: string,
    options: RequestOptions = {},
  ): Promise<Integration> {
    return withNulls(
      (await apiClient.get<Integration>(endpoint(id), requestConfig(options)))
        .data,
    )
  },
  async create(definitionId: string): Promise<Integration> {
    return withNulls(
      (await apiClient.post<Integration>('/integrations', { definitionId }))
        .data,
    )
  },
  /** The key itself goes one way only — Core stores it encrypted and never returns it. */
  async saveNovaPoshtaKey(id: string, apiKey: string): Promise<Integration> {
    return withNulls(
      (
        await apiClient.put<Integration>(`${endpoint(id)}/settings`, {
          settings: { apiKey },
        })
      ).data,
    )
  },
  async verify(id: string): Promise<Integration> {
    return withNulls(
      (await apiClient.post<Integration>(`${endpoint(id)}/verify`)).data,
    )
  },
  async activate(id: string): Promise<Integration> {
    return withNulls(
      (await apiClient.post<Integration>(`${endpoint(id)}/activate`)).data,
    )
  },
  async deactivate(id: string): Promise<Integration> {
    return withNulls(
      (await apiClient.post<Integration>(`${endpoint(id)}/deactivate`)).data,
    )
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
  /** The senders this tenant's key may dispatch as, from the carrier's cabinet. */
  /** What the yard chose for delivery, apart from the key. */
  async preferences(
    id: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPreferences> {
    const data = (
      await apiClient.get<NovaPoshtaPreferences>(
        `${endpoint(id)}/shipping/preferences`,
        requestConfig(options),
      )
    ).data
    return {
      codCashRegisterId: data.codCashRegisterId ?? null,
      senderCounterpartyRef: data.senderCounterpartyRef ?? null,
      senderContactRef: data.senderContactRef ?? null,
    }
  },
  async savePreferences(
    id: string,
    request: NovaPoshtaPreferences,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPreferences> {
    const data = (
      await apiClient.put<NovaPoshtaPreferences>(
        `${endpoint(id)}/shipping/preferences`,
        request,
        requestConfig(options),
      )
    ).data
    return {
      codCashRegisterId: data.codCashRegisterId ?? null,
      senderCounterpartyRef: data.senderCounterpartyRef ?? null,
      senderContactRef: data.senderContactRef ?? null,
    }
  },
  async senders(
    id: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaCounterparty[]> {
    const data = (
      await apiClient.get<NovaPoshtaCounterparty[]>(
        `${endpoint(id)}/shipping/senders`,
        requestConfig(options),
      )
    ).data
    // Core omits a null rather than sending it, so a sender with no tax code
    // arrives without the property. Left as `undefined`, a `=== null` guard
    // downstream lets it through and the screen prints the word "undefined".
    return data.map((item) => ({ ...item, tin: item.tin ?? null }))
  },
  async senderContacts(
    id: string,
    counterpartyRef: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaContact[]> {
    const data = (
      await apiClient.get<NovaPoshtaContact[]>(
        `${endpoint(id)}/shipping/senders/${encodeURIComponent(counterpartyRef)}/contacts`,
        requestConfig(options),
      )
    ).data
    return data.map((item) => ({ ...item, phone: item.phone ?? null }))
  },
  async divisions(
    id: string,
    settlementRef: string,
    page = 1,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPage<NovaPoshtaDivision>> {
    return (
      await apiClient.get<NovaPoshtaPage<NovaPoshtaDivision>>(
        `${endpoint(id)}/shipping/divisions`,
        { params: { settlementRef, page }, ...requestConfig(options) },
      )
    ).data
  },
  /**
   * The managed subscription's own state. Core omits nulls, so a reason that is
   * simply absent arrives as `undefined` — read as "not loaded", it turns an
   * untroubled subscription into a screen waiting forever for an explanation.
   */
  async trackingSubscription(
    id: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaTrackingSubscription> {
    const data = (
      await apiClient.get<NovaPoshtaTrackingSubscription>(
        `${endpoint(id)}/tracking-subscription`,
        requestConfig(options),
      )
    ).data
    return {
      ...data,
      reasonCode: data.reasonCode ?? null,
      lastCallbackAt: data.lastCallbackAt ?? null,
    }
  },
  /**
   * Asks Core to connect. The key travels in the body and only when the yard
   * has just typed one — Core reuses the stored key otherwise, and a key must
   * never reach a URL, where it would be logged by every hop on the way.
   *
   * Answered with 202: the work has been accepted, not finished. The caller
   * reads the outcome from `trackingSubscription`, never from this call.
   */
  async connectTracking(id: string, apiKey: string | null): Promise<void> {
    await apiClient.post(
      `${endpoint(id)}/tracking-subscription/connect`,
      apiKey === null ? {} : { apiKey },
    )
  },
  async disconnectTracking(id: string): Promise<void> {
    await apiClient.post(`${endpoint(id)}/tracking-subscription/disconnect`)
  },
  async retryTracking(id: string): Promise<void> {
    await apiClient.post(`${endpoint(id)}/tracking-subscription/retry`)
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
    return withDiagnosticNulls(
      (
        await apiClient.post<IntegrationDiagnostics>(
          `${endpoint(id)}/diagnostics`,
          undefined,
          requestConfig(options),
        )
      ).data,
    )
  },
}
