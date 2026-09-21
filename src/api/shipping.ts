import { apiClient } from './client'
import type { RequestOptions } from './contracts'

/**
 * Nova Poshta delivery for one order. Everything here hangs off an
 * integration: the carrier account decides what a valid branch is, so the
 * shipment cannot exist without one.
 */
export type ShipmentState =
  | 'Draft'
  | 'Creating'
  | 'Created'
  | 'Unknown'
  | 'Cancelling'
  | 'Cancelled'
  | 'CancelUnknown'

export interface ShippingContact {
  name: string
  phone: string
  divisionId: number
  settlementId: number
  companyTin?: string | null
  companyName?: string | null
}

export interface ParcelInput {
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
}

export type PayerType = 'Sender' | 'Recipient'

export interface ShipmentDraft {
  recipient: ShippingContact
  parcels: ParcelInput[]
  declaredValueUah: number
  returnEstimateUah: number
  payerType: PayerType
  description: string
  dispatchPointId?: string | null
}

export interface ShipmentEvent {
  code: string
  name: string
  occurredAt: string | null
  recordedAt: string
}

export interface Shipment {
  id: string
  integrationId: string
  dispatchPointId: string
  orderId: string
  state: string
  number: string | null
  sender: ShippingContact
  draft: ShipmentDraft
  quoteUah: number | null
  returnEstimateUah: number
  codUah: number | null
  quoteAt: string | null
  trackingCode: string | null
  trackingStatus: string | null
  lastTrackedAt: string | null
  relatedNumbers: string[]
  events: ShipmentEvent[]
}

/** Core omits empty collections; a shipment without events must still render. */
const withCollections = (shipment: Shipment): Shipment => ({
  ...shipment,
  relatedNumbers: shipment.relatedNumbers ?? [],
  events: shipment.events ?? [],
  draft: { ...shipment.draft, parcels: shipment.draft?.parcels ?? [] },
})

const orders = (integrationId: string, orderId: string) =>
  `/integrations/${encodeURIComponent(integrationId)}/shipping/orders/${encodeURIComponent(orderId)}`

const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

export const shippingApi = {
  /** Null when this order has no delivery yet. */
  async get(
    integrationId: string,
    orderId: string,
    options: RequestOptions = {},
  ): Promise<Shipment | null> {
    const shipment = (
      await apiClient.get<Shipment | null>(
        orders(integrationId, orderId),
        requestConfig(options),
      )
    ).data
    return shipment === null ? null : withCollections(shipment)
  },
  async saveDraft(
    integrationId: string,
    orderId: string,
    draft: ShipmentDraft,
  ): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.put<Shipment>(
          `${orders(integrationId, orderId)}/draft`,
          draft,
        )
      ).data,
    )
  },
  /** Asks the carrier what the delivery costs; the answer goes stale in 24 hours. */
  async estimate(integrationId: string, orderId: string): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.post<Shipment>(
          `${orders(integrationId, orderId)}/estimate`,
        )
      ).data,
    )
  },
  async create(integrationId: string, orderId: string): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.post<Shipment>(
          `${orders(integrationId, orderId)}/create`,
        )
      ).data,
    )
  },
  /** Resolves an unknown result and pulls the latest tracking status. */
  async refresh(integrationId: string, orderId: string): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.post<Shipment>(
          `${orders(integrationId, orderId)}/refresh`,
        )
      ).data,
    )
  },
  async attach(
    integrationId: string,
    orderId: string,
    number: string,
  ): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.post<Shipment>(
          `${orders(integrationId, orderId)}/attach`,
          { number },
        )
      ).data,
    )
  },
  async cancel(integrationId: string, orderId: string): Promise<void> {
    await apiClient.delete(orders(integrationId, orderId))
  },
}
