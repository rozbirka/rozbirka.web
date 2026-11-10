import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type { components } from './generated/core'
import type {
  NovaPoshtaDivision,
  NovaPoshtaPage,
  NovaPoshtaSettlement,
} from './integrations'

type ReturnWire = components['schemas']['ProviderReturnDetail']

export interface ProviderReturnDetail {
  trackingLastSuccessAt?: string | null
  trackingLastErrorAt?: string | null
  trackingLastError?: string | null
  nextTrackingAttemptAt?: string | null
  trackingEnabled?: boolean
  trackingPending?: boolean
  trackingCompleted?: boolean
  trackingPaused?: boolean
  trackingFailures?: number
  syncProblem?: string | null
  capability: {
    canCreate: boolean
    blockReason: string | null
    canFindExternal?: boolean
  }
  isExternal?: boolean
  sourceVersion: string
  version: string | null
  state: string | null
  requestRef: string | null
  requestNumber: string | null
  requestStatus: string | null
  reverse: {
    number: string
    status: string | null
    statusAt: string | null
  } | null
}
export interface ProviderReturnChoice {
  ref: string
  description: string
}
export type ProviderReturnOptions =
  components['schemas']['ProviderReturnOptions']
export interface ProviderReturnInput extends Omit<
  components['schemas']['ProviderReturnInput'],
  'paymentMethod' | 'note' | 'recipientWarehouseRef' | 'recipientSettlementRef'
> {
  sourceVersion: string
  returnAddressRef: string
  recipientWarehouseRef?: string | undefined
  recipientSettlementRef?: string | undefined
  paymentMethod: 'Cash' | 'NonCash'
  reasonRef: string
  subtypeReasonRef: string
  note: string
}
export interface ProviderReturnQuote {
  cost: number | null
  scheduledDeliveryDate: string | null
}
export interface ProviderReturnCandidate {
  ref: string
  number: string
  sourceNumber: string
  status: string | null
  addressRecipient: string | null
  contactPersonRecipient: string | null
  reverseNumber: string | null
}
const path = (integration: string, shipment: string) =>
  `/integrations/${encodeURIComponent(integration)}/shipping/shipments/${encodeURIComponent(shipment)}/return`
const normalize = (value: ReturnWire): ProviderReturnDetail => ({
  ...value,
  trackingPaused: value.trackingPaused ?? false,
  trackingFailures: value.trackingFailures ?? 0,
  syncProblem: value.syncProblem ?? null,
  version: value.version ?? null,
  state: value.state ?? null,
  requestRef: value.requestRef ?? null,
  requestNumber: value.requestNumber ?? null,
  requestStatus: value.requestStatus ?? null,
  reverse:
    value.reverse == null
      ? null
      : {
          ...value.reverse,
          status: value.reverse.status ?? null,
          statusAt: value.reverse.statusAt ?? null,
        },
  capability: {
    ...value.capability,
    blockReason: value.capability.blockReason ?? null,
  },
})
export const providerReturnApi = {
  async settlements(
    integration: string,
    shipment: string,
    query: string,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPage<NovaPoshtaSettlement>> {
    return (
      await apiClient.get<NovaPoshtaPage<NovaPoshtaSettlement>>(
        `${path(integration, shipment)}/settlements`,
        { ...options, params: { query } },
      )
    ).data
  },
  async divisions(
    integration: string,
    shipment: string,
    settlementRef: string,
    page = 1,
    options: RequestOptions = {},
  ): Promise<NovaPoshtaPage<NovaPoshtaDivision>> {
    return (
      await apiClient.get<NovaPoshtaPage<NovaPoshtaDivision>>(
        `${path(integration, shipment)}/divisions`,
        { ...options, params: { settlementRef, page } },
      )
    ).data
  },
  async get(
    integration: string,
    shipment: string,
    options: RequestOptions = {},
  ) {
    return normalize(
      (await apiClient.get<ReturnWire>(path(integration, shipment), options))
        .data,
    )
  },
  async options(
    integration: string,
    shipment: string,
    options: RequestOptions = {},
  ) {
    return (
      await apiClient.get<ProviderReturnOptions>(
        `${path(integration, shipment)}/options`,
        options,
      )
    ).data
  },
  async subtypes(
    integration: string,
    shipment: string,
    reasonRef: string,
    options: RequestOptions = {},
  ) {
    return (
      await apiClient.get<(ProviderReturnChoice & { reasonRef: string })[]>(
        `${path(integration, shipment)}/subtypes`,
        { ...options, params: { reasonRef } },
      )
    ).data
  },
  async quote(
    integration: string,
    shipment: string,
    input: ProviderReturnInput,
  ): Promise<ProviderReturnQuote> {
    const result = (
      await apiClient.post<components['schemas']['ProviderReturnQuote']>(
        `${path(integration, shipment)}/quote`,
        input,
      )
    ).data
    return {
      cost: result.cost ?? null,
      scheduledDeliveryDate: result.scheduledDeliveryDate ?? null,
    }
  },
  async create(
    integration: string,
    shipment: string,
    input: ProviderReturnInput,
  ) {
    return normalize(
      (
        await apiClient.post<ReturnWire>(
          `${path(integration, shipment)}/create`,
          input,
        )
      ).data,
    )
  },
  async refresh(integration: string, shipment: string) {
    return normalize(
      (
        await apiClient.post<ReturnWire>(
          `${path(integration, shipment)}/refresh`,
        )
      ).data,
    )
  },
  async candidates(
    integration: string,
    shipment: string,
  ): Promise<ProviderReturnCandidate[]> {
    const values = (
      await apiClient.get<components['schemas']['ProviderReturnCandidate'][]>(
        `${path(integration, shipment)}/candidates`,
      )
    ).data
    return (values ?? []).map((value) => ({
      ...value,
      status: value.status ?? null,
      reverseNumber: value.reverseNumber ?? null,
      addressRecipient: value.addressRecipient ?? null,
      contactPersonRecipient: value.contactPersonRecipient ?? null,
    }))
  },
  async confirm(
    integration: string,
    shipment: string,
    providerRef: string,
    version: string,
  ) {
    return normalize(
      (
        await apiClient.post<ReturnWire>(
          `${path(integration, shipment)}/candidates/confirm`,
          { providerRef, version },
        )
      ).data,
    )
  },
  async externalCandidates(
    integration: string,
    shipment: string,
  ): Promise<{ sourceVersion: string; candidates: ProviderReturnCandidate[] }> {
    const result = (
      await apiClient.get<
        components['schemas']['ProviderExternalReturnCandidates']
      >(`${path(integration, shipment)}/external/candidates`)
    ).data
    return {
      sourceVersion: result.sourceVersion,
      candidates: result.candidates.map((value) => ({
        ...value,
        status: value.status ?? null,
        reverseNumber: value.reverseNumber ?? null,
        addressRecipient: value.addressRecipient ?? null,
        contactPersonRecipient: value.contactPersonRecipient ?? null,
      })),
    }
  },
  async attachExternal(
    integration: string,
    shipment: string,
    sourceVersion: string,
    candidate: ProviderReturnCandidate,
  ) {
    return normalize(
      (
        await apiClient.post<ReturnWire>(
          `${path(integration, shipment)}/external/confirm`,
          { sourceVersion, candidate },
        )
      ).data,
    )
  },
}
