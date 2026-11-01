import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type {
  NovaPoshtaContact,
  NovaPoshtaCounterparty,
  NovaPoshtaDivision,
  NovaPoshtaPage,
  NovaPoshtaSettlement,
} from './integrations'
import type { ShippingContact } from './shipping'

/**
 * A verified-but-not-yet-applied Nova Poshta connection. Core checks the key
 * first and keeps it encrypted on its side for an hour; every later step reads
 * the carrier's catalogues through that key, so the browser never holds it
 * again and the active integration stays untouched until `complete`.
 */
export interface NovaPoshtaSetupConfiguration {
  sender: ShippingContact
  codCashRegisterId: string | null
}

export interface NovaPoshtaSetupSession {
  id: string
  /** Optimistic version: every write sends the one it last read. */
  version: string
  /** `Pending`, `Completed` or `Cancelled`; kept open for states added later. */
  state: string
  expiresAt: string
  configuration: NovaPoshtaSetupConfiguration | null
}

export interface NovaPoshtaSetupCompleted {
  connectionId: string
  dispatchPointId: string
  integrationVersion: string
}

/**
 * One carrier cabinet this integration has ever been connected to. Waybills
 * stay bound to the cabinet that created them, so a replaced key leaves the
 * older ones readable but no longer refreshed until access is recovered.
 */
export interface NovaPoshtaConnection {
  id: string
  version: string
  isCurrent: boolean
  hasVerifiedAccess: boolean
  waybillCount: number
  createdAt: string
}

export interface NovaPoshtaRecoveredAccess {
  connectionId: string
  version: string
  credentialVersionId: string
}

const withSessionNulls = (
  session: NovaPoshtaSetupSession,
): NovaPoshtaSetupSession => ({
  ...session,
  configuration:
    session.configuration == null
      ? null
      : {
          ...session.configuration,
          codCashRegisterId: session.configuration.codCashRegisterId ?? null,
        },
})

const sessions = (integrationId: string) =>
  `/integrations/${encodeURIComponent(integrationId)}/shipping/setup-sessions`
const session = (integrationId: string, sessionId: string) =>
  `${sessions(integrationId)}/${encodeURIComponent(sessionId)}`
const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

export const novaPoshtaSetupApi = {
  /** Verifies the key with the carrier; a rejected key changes nothing. */
  async begin(
    integrationId: string,
    apiKey: string,
  ): Promise<NovaPoshtaSetupSession> {
    return withSessionNulls(
      (
        await apiClient.post<NovaPoshtaSetupSession>(sessions(integrationId), {
          apiKey,
        })
      ).data,
    )
  },
  async get(
    integrationId: string,
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaSetupSession> {
    return withSessionNulls(
      (
        await apiClient.get<NovaPoshtaSetupSession>(
          session(integrationId, sessionId),
          requestConfig(options),
        )
      ).data,
    )
  },
  /** Core re-checks the sender, contact and branch against the carrier. */
  async configure(
    integrationId: string,
    sessionId: string,
    version: string,
    configuration: NovaPoshtaSetupConfiguration,
  ): Promise<NovaPoshtaSetupSession> {
    return withSessionNulls(
      (
        await apiClient.put<NovaPoshtaSetupSession>(
          `${session(integrationId, sessionId)}/configuration`,
          { version, configuration },
        )
      ).data,
    )
  },
  async complete(
    integrationId: string,
    sessionId: string,
    version: string,
  ): Promise<NovaPoshtaSetupCompleted> {
    return (
      await apiClient.post<NovaPoshtaSetupCompleted>(
        `${session(integrationId, sessionId)}/complete`,
        { version },
      )
    ).data
  },
  async cancel(
    integrationId: string,
    sessionId: string,
    version: string,
  ): Promise<void> {
    await apiClient.post(`${session(integrationId, sessionId)}/cancel`, {
      version,
    })
  },
  async senders(
    integrationId: string,
    sessionId: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaCounterparty[]> {
    const data = (
      await apiClient.get<NovaPoshtaCounterparty[]>(
        `${session(integrationId, sessionId)}/senders`,
        requestConfig(options),
      )
    ).data
    return data.map((item) => ({ ...item, tin: item.tin ?? null }))
  },
  async senderContacts(
    integrationId: string,
    sessionId: string,
    senderRef: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaContact[]> {
    const data = (
      await apiClient.get<NovaPoshtaContact[]>(
        `${session(integrationId, sessionId)}/senders/${encodeURIComponent(senderRef)}/contacts`,
        requestConfig(options),
      )
    ).data
    return data.map((item) => ({ ...item, phone: item.phone ?? null }))
  },
  async settlements(
    integrationId: string,
    sessionId: string,
    query: string,
    page = 1,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPage<NovaPoshtaSettlement>> {
    const data = (
      await apiClient.get<NovaPoshtaPage<NovaPoshtaSettlement>>(
        `${session(integrationId, sessionId)}/settlements`,
        { params: { query, page }, ...requestConfig(options) },
      )
    ).data
    return {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        prohibitedSending: item.prohibitedSending ?? null,
        prohibitedIssuance: item.prohibitedIssuance ?? null,
      })),
    }
  },
  async divisions(
    integrationId: string,
    sessionId: string,
    settlementRef: string,
    page = 1,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPage<NovaPoshtaDivision>> {
    const data = (
      await apiClient.get<NovaPoshtaPage<NovaPoshtaDivision>>(
        `${session(integrationId, sessionId)}/divisions`,
        { params: { settlementRef, page }, ...requestConfig(options) },
      )
    ).data
    return {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        settlementRef: item.settlementRef ?? null,
      })),
    }
  },
  async connections(
    integrationId: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaConnection[]> {
    return (
      await apiClient.get<NovaPoshtaConnection[]>(
        `/integrations/${encodeURIComponent(integrationId)}/shipping/connections`,
        requestConfig(options),
      )
    ).data
  },
  /**
   * Re-keys an older cabinet so its waybills refresh again. Core proves the
   * key reaches every waybill and sender of that cabinet before saving it.
   */
  async recover(
    integrationId: string,
    connectionId: string,
    version: string,
    apiKey: string,
  ): Promise<NovaPoshtaRecoveredAccess> {
    return (
      await apiClient.post<NovaPoshtaRecoveredAccess>(
        `/integrations/${encodeURIComponent(integrationId)}/shipping/connections/${encodeURIComponent(connectionId)}/recover`,
        { version, apiKey },
      )
    ).data
  },
}
