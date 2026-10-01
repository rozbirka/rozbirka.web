import { apiClient, withIdempotency } from './client'
import type { IdempotentMutation, RequestOptions } from './contracts'

/**
 * The money side of an order that ships. Core keeps it apart from ordinary
 * order payments on purpose: a delivery order is settled against an agreed
 * total, and the generic order endpoints refuse to touch one at all.
 *
 * Every call answers with the whole summary, so the screen never has to add
 * up what it just sent.
 */
export interface DeliveryPayment {
  id: string
  accountId: string
  amountUah: number
  feeUah: number
  netUah: number
  kind: string | null
  recordedBy: string | null
  createdAt: string
  refundedAt: string | null
}

export interface DeliveryOrder {
  orderId: string
  /** What the customer agreed to pay for the goods. Delivery is not in it. */
  agreedTotalUah: number
  appliedUah: number
  outstandingUah: number
  netReceivedUah: number
  feesUah: number
  /** Carrier quote plus the return estimate — not a share of the total. */
  requiredDepositUah: number
  depositShortfallUah: number
  depositSatisfied: boolean
  depositWaived: boolean
  /** Whether this yard asks for a deposit at all; off, it never gates. */
  depositRequired: boolean
  customerTrusted: boolean
  dispatchedAt: string | null
  receivedAt: string | null
  returnedAt: string | null
  awaitingCodReconciliation: boolean
  payments: DeliveryPayment[]
}

/** A payment either goes in up front or settles the post-payment afterwards. */
export type DeliveryPaymentKind = 'prepayment' | 'cod'

export interface RecordDeliveryPayment {
  accountId: string
  /** Gross: what the order is credited. The till receives it minus the fee. */
  amountUah: number
  feeUah: number
  kind: DeliveryPaymentKind
}

export interface LinkDeliveryPayment {
  cashTransactionId: string
  /** Added on top of the transaction — the opposite of a recorded payment. */
  feeUah: number
  kind: DeliveryPaymentKind
}

const endpoint = (orderId: string) =>
  `/orders/${encodeURIComponent(orderId)}/delivery`

const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

/**
 * Core serialises with `JsonIgnoreCondition.WhenWritingNull`, so a null date
 * is not sent as `null` — the property is simply absent. Read straight off the
 * response, `receivedAt !== null` is then true for an order nobody has
 * received, and the whole lifecycle reads as finished. Every optional field is
 * put back as an explicit null here, once, so nothing downstream has to know.
 */
const normalize = (delivery: DeliveryOrder): DeliveryOrder => ({
  ...delivery,
  dispatchedAt: delivery.dispatchedAt ?? null,
  receivedAt: delivery.receivedAt ?? null,
  returnedAt: delivery.returnedAt ?? null,
  payments: (delivery.payments ?? []).map((payment) => ({
    ...payment,
    kind: payment.kind ?? null,
    recordedBy: payment.recordedBy ?? null,
    refundedAt: payment.refundedAt ?? null,
  })),
})

export const deliveryApi = {
  async get(
    orderId: string,
    options: RequestOptions = {},
  ): Promise<DeliveryOrder> {
    return normalize(
      (
        await apiClient.get<DeliveryOrder>(
          endpoint(orderId),
          requestConfig(options),
        )
      ).data,
    )
  },
  /**
   * Says this order ships — and nothing else. What the recipient still owes is
   * a separate decision, made when the waybill is booked, because goods that
   * are already paid for have nothing to hold at all. The deposit exception
   * for a trusted customer is not offered here: the cabinet has nowhere to
   * mark that trust yet.
   */
  async configure(
    orderId: string,
    agreedTotalUah?: number,
  ): Promise<DeliveryOrder> {
    return normalize(
      (
        await apiClient.put<DeliveryOrder>(endpoint(orderId), {
          ...(agreedTotalUah === undefined ? {} : { agreedTotalUah }),
          waiveDeposit: false,
        })
      ).data,
    )
  },
  async recordPayment(
    orderId: string,
    input: RecordDeliveryPayment,
    replay: IdempotentMutation,
  ): Promise<DeliveryOrder> {
    return normalize(
      (
        await apiClient.post<DeliveryOrder>(
          `${endpoint(orderId)}/payments`,
          input,
          withIdempotency({}, replay),
        )
      ).data,
    )
  },
  /** Ties an existing till receipt to the order; no new money is recorded. */
  async linkPayment(
    orderId: string,
    input: LinkDeliveryPayment,
    replay: IdempotentMutation,
  ): Promise<DeliveryOrder> {
    return normalize(
      (
        await apiClient.post<DeliveryOrder>(
          `${endpoint(orderId)}/payments/link`,
          input,
          withIdempotency({}, replay),
        )
      ).data,
    )
  },
  async refundPayment(
    orderId: string,
    paymentId: string,
    replay: IdempotentMutation,
  ): Promise<DeliveryOrder> {
    return normalize(
      (
        await apiClient.post<DeliveryOrder>(
          `${endpoint(orderId)}/payments/${encodeURIComponent(paymentId)}/refund`,
          undefined,
          withIdempotency({}, replay),
        )
      ).data,
    )
  },
  /** Writes the goods off the shelf. Core reruns the full readiness check. */
  async dispatch(orderId: string): Promise<DeliveryOrder> {
    return normalize(
      (await apiClient.post<DeliveryOrder>(`${endpoint(orderId)}/dispatch`))
        .data,
    )
  },
  /** The step that confirms the order and opens post-payment reconciliation. */
  async receive(orderId: string): Promise<DeliveryOrder> {
    return normalize(
      (await apiClient.post<DeliveryOrder>(`${endpoint(orderId)}/received`))
        .data,
    )
  },
  /**
   * Puts the goods back on the shelf and marks the order refunded. Core takes
   * the intact flag only as true — a damaged or partial return is a manual
   * matter and restores no stock.
   */
  async acceptReturn(orderId: string): Promise<DeliveryOrder> {
    return normalize(
      (
        await apiClient.post<DeliveryOrder>(
          `${endpoint(orderId)}/return-received`,
          { allItemsReceivedUndamaged: true },
        )
      ).data,
    )
  },
}
