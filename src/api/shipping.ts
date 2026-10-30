import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import { normalizeDeliveryOrder, type DeliveryOrder } from './delivery'

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
  /**
   * The carrier cabinet this waybill was created in. Null for waybills older
   * than connection tracking; they belong to the current cabinet.
   */
  connectionId: string | null
  orderId: string
  /** Optimistic version for edits, previews and reconciliation. */
  version: string
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
  dispatchedAt: string | null
  receivedAt: string | null
  /**
   * How the carrier's post-payment was booked (`Reconciled`,
   * `NeedsReconciliation`, `CashRegisterRequired`, …). Null without the
   * finance permission, so a missing value is not "nothing to book".
   */
  paymentState: string | null
  /** Why the last refresh did not land; the last known status still stands. */
  syncProblem: string | null
  /**
   * False while the integration is switched off: the status is the last one
   * known and nothing that reaches the carrier is allowed.
   */
  trackingEnabled: boolean
}

/** One row of the waybill list: the order it serves and its three signals. */
export interface ShipmentListItem {
  id: string
  version: string
  orderId: string
  orderNumber: number
  state: string
  number: string | null
  recipient: ShippingContact
  /** The carrier's own tracking code — what «Доставка» filters by. */
  deliveryCode: string | null
  createdAt: string
  receivedAt: string | null
  paymentState: string | null
  codUah: number | null
  syncProblem: string | null
  lastSuccessAt: string | null
  /** False while the integration is switched off. */
  trackingEnabled: boolean
}

export interface ShipmentListQuery {
  search?: string
  deliveryCode?: string
  hasCod?: boolean
  hasProblem?: boolean
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface ShipmentPage {
  items: ShipmentListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * What the carrier holds under a waybill number typed in by hand, before it
 * is tied to the order. Confirming sends the fingerprint back, so a waybill
 * that changed in between is refused rather than attached as seen.
 */
export interface ExternalShipmentPreview {
  number: string
  fingerprint: string
  shipmentVersion: string
  providerStatus: string
  sender: ShippingContact
  recipient: ShippingContact
  codAmountUah: number | null
  /** Attaching moves the order to «sent». */
  recordsDispatch: boolean
  /** Attaching moves the order to «received» — but never marks it paid. */
  recordsReceipt: boolean
}

/** Provider facts reviewed before an unknown creation can be resolved. */
export interface ShipmentRecoveryCandidate {
  number: string
  createdAt: string | null
  sender: ShippingContact | null
  recipient: ShippingContact | null
  codUah: number | null
  fingerprint: string
  canConfirm: boolean
}

export interface ShipmentRecoveryCandidates {
  shipmentVersion: string
  status: 'Found' | 'NotFound' | 'Incomplete' | 'Limited'
  candidates: ShipmentRecoveryCandidate[]
}

const withRecoveryNulls = (
  data: ShipmentRecoveryCandidates,
): ShipmentRecoveryCandidates => ({
  ...data,
  candidates: (data.candidates ?? []).map((candidate) => ({
    ...candidate,
    createdAt: candidate.createdAt ?? null,
    sender: candidate.sender ?? null,
    recipient: candidate.recipient ?? null,
    codUah: candidate.codUah ?? null,
    canConfirm: candidate.canConfirm === true,
  })),
})

/** Core omits empty collections; a shipment without events must still render. */
/**
 * Core serialises with `JsonIgnoreCondition.WhenWritingNull`: a null field is
 * absent rather than null, and `number !== null` would then be true for a
 * shipment that has no waybill at all. Collections and every nullable field
 * are restored here so the rest of the cabinet can compare against null.
 */
const withCollections = (shipment: Shipment): Shipment => ({
  ...shipment,
  connectionId: shipment.connectionId ?? null,
  dispatchedAt: shipment.dispatchedAt ?? null,
  receivedAt: shipment.receivedAt ?? null,
  paymentState: shipment.paymentState ?? null,
  syncProblem: shipment.syncProblem ?? null,
  trackingEnabled: shipment.trackingEnabled ?? true,
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

const withListNulls = (item: ShipmentListItem): ShipmentListItem => ({
  ...item,
  number: item.number ?? null,
  deliveryCode: item.deliveryCode ?? null,
  receivedAt: item.receivedAt ?? null,
  paymentState: item.paymentState ?? null,
  codUah: item.codUah ?? null,
  syncProblem: item.syncProblem ?? null,
  lastSuccessAt: item.lastSuccessAt ?? null,
  trackingEnabled: item.trackingEnabled ?? true,
})

const shipments = (integrationId: string) =>
  `/integrations/${encodeURIComponent(integrationId)}/shipping/shipments`

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
  /**
   * Edits a created waybill before it is handed over. The carrier must accept
   * the change; one it can only take as a new waybill is refused with
   * `shipment_recreate_required`.
   */
  async update(
    integrationId: string,
    orderId: string,
    version: string,
    draft: ShipmentDraft,
  ): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.put<Shipment>(orders(integrationId, orderId), {
          version,
          draft,
        })
      ).data,
    )
  },
  /**
   * Settles an unknown result. Without a number Core searches the carrier
   * itself; with one it checks that exact candidate.
   */
  async reconcile(
    integrationId: string,
    orderId: string,
    number: string | null = null,
  ): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.post<Shipment>(
          `${orders(integrationId, orderId)}/reconcile`,
          number === null ? {} : { number },
        )
      ).data,
    )
  },
  /** Read-only search in the carrier account used by the original creation. */
  async searchRecoveryCandidates(
    integrationId: string,
    orderId: string,
    options: RequestOptions = {},
  ): Promise<ShipmentRecoveryCandidates> {
    return withRecoveryNulls(
      (
        await apiClient.get<ShipmentRecoveryCandidates>(
          `${orders(integrationId, orderId)}/recovery-candidates`,
          requestConfig(options),
        )
      ).data,
    )
  },
  /** Checking a manually entered number does not attach it. */
  async previewRecoveryCandidate(
    integrationId: string,
    orderId: string,
    number: string,
  ): Promise<ShipmentRecoveryCandidates> {
    return withRecoveryNulls(
      (
        await apiClient.post<ShipmentRecoveryCandidates>(
          `${orders(integrationId, orderId)}/recovery-candidates/preview`,
          { number },
        )
      ).data,
    )
  },
  async confirmRecoveryCandidate(
    integrationId: string,
    orderId: string,
    candidate: Pick<ShipmentRecoveryCandidate, 'number' | 'fingerprint'> & {
      shipmentVersion: string
    },
  ): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.post<Shipment>(
          `${orders(integrationId, orderId)}/recovery-candidates/confirm`,
          {
            number: candidate.number,
            shipmentVersion: candidate.shipmentVersion,
            fingerprint: candidate.fingerprint,
          },
        )
      ).data,
    )
  },
  async previewExternal(
    integrationId: string,
    orderId: string,
    number: string,
  ): Promise<ExternalShipmentPreview> {
    const data = (
      await apiClient.post<ExternalShipmentPreview>(
        `${orders(integrationId, orderId)}/external/preview`,
        { number },
      )
    ).data
    return { ...data, codAmountUah: data.codAmountUah ?? null }
  },
  /** Answers with the order's delivery summary, which attaching may advance. */
  async confirmExternal(
    integrationId: string,
    orderId: string,
    preview: Pick<
      ExternalShipmentPreview,
      'number' | 'fingerprint' | 'shipmentVersion'
    >,
  ): Promise<DeliveryOrder> {
    return normalizeDeliveryOrder(
      (
        await apiClient.post<DeliveryOrder>(
          `${orders(integrationId, orderId)}/external/confirm`,
          {
            number: preview.number,
            fingerprint: preview.fingerprint,
            shipmentVersion: preview.shipmentVersion,
          },
        )
      ).data,
    )
  },
  /** Only waybills created or attached in Rozbirka, drafts included. */
  async list(
    integrationId: string,
    query: ShipmentListQuery = {},
    options: RequestOptions = {},
  ): Promise<ShipmentPage> {
    const params: Record<string, string | number | boolean> = {}
    if (query.search) params['Search'] = query.search
    if (query.deliveryCode) params['DeliveryCode'] = query.deliveryCode
    if (query.hasCod !== undefined) params['HasCod'] = query.hasCod
    if (query.hasProblem !== undefined) params['HasProblem'] = query.hasProblem
    if (query.from) params['From'] = query.from
    if (query.to) params['To'] = query.to
    if (query.page) params['Page'] = query.page
    if (query.pageSize) params['PageSize'] = query.pageSize
    const data = (
      await apiClient.get<ShipmentPage>(shipments(integrationId), {
        params,
        ...requestConfig(options),
      })
    ).data
    return { ...data, items: (data.items ?? []).map(withListNulls) }
  },
  async byId(
    integrationId: string,
    shipmentId: string,
    options: RequestOptions = {},
  ): Promise<Shipment> {
    return withCollections(
      (
        await apiClient.get<Shipment>(
          `${shipments(integrationId)}/${encodeURIComponent(shipmentId)}`,
          requestConfig(options),
        )
      ).data,
    )
  },
}
