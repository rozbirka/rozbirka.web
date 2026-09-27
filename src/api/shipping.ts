import { apiClient } from './client'
import type { RequestOptions } from './contracts'

/**
 * Nova Poshta delivery for one order. Everything here hangs off an
 * integration: the carrier account decides what a valid branch is, so the
 * shipment cannot exist without one. The order's own money lives next door in
 * `delivery.ts`, which settles it before any carrier is involved.
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
  /** The carrier's own branch reference — a GUID, not a branch number. */
  warehouseRef: string
  /** The carrier's own city reference. */
  settlementRef: string
  /**
   * Who the waybill dispatches as. Nova Poshta creates a recipient from a name
   * and a phone, but never a sender: that one is registered in the carrier's
   * cabinet, so only a dispatch point carries these.
   */
  counterpartyRef?: string | null
  contactRef?: string | null
  companyTin?: string | null
  companyName?: string | null
  /** Display only: a reference is a GUID, and a counter clerk reads names. */
  warehouseName?: string | null
  settlementName?: string | null
}

export interface ParcelInput {
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
}

export type PayerType = 'Sender' | 'Recipient'

/**
 * What is being sent and to whom. Neither leg's price is in here: the carrier
 * quotes both during the estimate, so neither is a number anyone types.
 */
export interface ShipmentDraft {
  recipient: ShippingContact
  parcels: ParcelInput[]
  declaredValueUah: number
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
/**
 * Core serialises with `JsonIgnoreCondition.WhenWritingNull`: a null field is
 * absent rather than null, and `number !== null` would then be true for a
 * shipment that has no waybill at all. Collections and every nullable field
 * are restored here so the rest of the cabinet can compare against null.
 */
const withCollections = (shipment: Shipment): Shipment => ({
  ...shipment,
  number: shipment.number ?? null,
  quoteUah: shipment.quoteUah ?? null,
  codUah: shipment.codUah ?? null,
  quoteAt: shipment.quoteAt ?? null,
  trackingCode: shipment.trackingCode ?? null,
  trackingStatus: shipment.trackingStatus ?? null,
  lastTrackedAt: shipment.lastTrackedAt ?? null,
  relatedNumbers: shipment.relatedNumbers ?? [],
  events: (shipment.events ?? []).map((event) => ({
    ...event,
    occurredAt: event.occurredAt ?? null,
  })),
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
    // An order with no delivery answers with an empty object, not null.
    return shipment == null || Object.keys(shipment).length === 0
      ? null
      : withCollections(shipment)
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
  /**
   * The carrier's own label, as a PDF. Core proxies it so the browser never
   * holds an API key; the caller owns the blob URL it makes from this.
   */
  async label(
    integrationId: string,
    orderId: string,
    options: RequestOptions = {},
  ): Promise<Blob> {
    return (
      await apiClient.get<Blob>(`${orders(integrationId, orderId)}/label`, {
        responseType: 'blob',
        ...(options.signal ? { signal: options.signal } : {}),
      })
    ).data
  },
  async cancel(integrationId: string, orderId: string): Promise<void> {
    await apiClient.delete(orders(integrationId, orderId))
  },
}
