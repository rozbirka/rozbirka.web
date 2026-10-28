import type { StatusTone } from '@/components/app'
import type { DeliveryOrder, DeliveryPayment } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'

/**
 * Where the money and the return of a delivery order stand (module 46
 * §9–10), read from Core's two records once. The «Оплата» block, the
 * «Повернення» / «Скасування» card and the header actions are all chosen
 * from these values, so a step that is done can never offer itself again.
 */

/** Payments not yet given back; what a full refund would return. */
export const livePayments = (delivery: DeliveryOrder): DeliveryPayment[] =>
  delivery.payments.filter((payment) => payment.refundedAt === null)

/** Everything booked against the order, refunded or not. */
export interface RefundTotals {
  booked: number
  refunded: number
  due: number
}

export function refundTotals(delivery: DeliveryOrder): RefundTotals {
  const refunded = delivery.payments
    .filter((payment) => payment.refundedAt !== null)
    .reduce((sum, payment) => sum + payment.amountUah, 0)
  const due = delivery.refundDueUah
  return { booked: refunded + due, refunded, due }
}

const LATE_PAYOUT = new Set(['LatePaymentNeedsRefund', 'NeedsReconciliation'])

/**
 * The carrier paid out after the order was cancelled and Core has not booked
 * it yet (10.16). Only Core's own payout state says so; without the finance
 * right it is null and the case cannot be told — nor acted on.
 */
export const latePayout = (
  delivery: DeliveryOrder,
  shipment: Shipment | null,
): boolean =>
  delivery.workflowState === 'Cancelled' &&
  LATE_PAYOUT.has(shipment?.paymentState ?? '')

/** A cancellation requested before the parcel left (10.13). */
export const cancellationPending = (delivery: DeliveryOrder): boolean =>
  delivery.workflowState === 'AwaitingRefund' && delivery.dispatchedAt === null

/** The order is in a return or a cancellation: its ordinary steps stop. */
export const orderClosing = (delivery: DeliveryOrder): boolean =>
  delivery.workflowState === 'AwaitingGoods' ||
  delivery.workflowState === 'AwaitingRefund' ||
  delivery.workflowState === 'Cancelled'

/** The order's own pill, in the design's words (module 46, `orderFrame`). */
export type OrderChipKey =
  | 'chipOpen'
  | 'chipCompleted'
  | 'chipReturn'
  | 'chipCancelled'

export function orderChipKey(delivery: DeliveryOrder): {
  key: OrderChipKey
  tone: StatusTone
} {
  switch (delivery.workflowState) {
    case 'Completed':
      return { key: 'chipCompleted', tone: 'ok' }
    case 'Cancelled':
      return { key: 'chipCancelled', tone: 'neutral' }
    case 'AwaitingGoods':
      return { key: 'chipReturn', tone: 'warn' }
    case 'AwaitingRefund':
      // Cancelling an order that never left is not a return (10.13).
      return delivery.dispatchedAt === null
        ? { key: 'chipOpen', tone: 'info' }
        : { key: 'chipReturn', tone: 'warn' }
    default:
      return { key: 'chipOpen', tone: 'info' }
  }
}

/**
 * The «Оплата» block's state (9.1–9.10, 10.x). Each value names one design
 * frame group; the block draws its pill, notice and buttons from it.
 */
export type PaymentState =
  /** Nothing owed; the order also waits for the parcel when not received (9.7). */
  | 'paid'
  /** Received, the post-payment is on its way (9.2). */
  | 'awaitingCod'
  /** The carrier paid out, but there was no till to book it into (9.4–9.5). */
  | 'manual'
  /** The payout does not match what is owed (9.6). */
  | 'reconcile'
  /** Before delivery, still owing: an ordinary partial or empty balance. */
  | 'due'
  /** A return or cancellation still holds money to give back (10.6). */
  | 'refundDue'
  /** Some of it given back already (10.10). */
  | 'refundPartial'
  /** Cancelled with everything given back (10.12). */
  | 'refunded'
  /** Cancelled, nothing was ever paid. */
  | 'notApplicable'
  /** Cancelled, and the carrier paid out afterwards (10.16). */
  | 'late'

const MANUAL = new Set(['CashRegisterRequired', 'PermissionRequired'])

export function paymentState(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
): PaymentState {
  const totals = refundTotals(delivery)
  if (delivery.workflowState === 'Cancelled') {
    if (latePayout(delivery, shipment)) return 'late'
    if (totals.due > 0)
      return totals.refunded > 0 ? 'refundPartial' : 'refundDue'
    return totals.refunded > 0 ? 'refunded' : 'notApplicable'
  }
  if (delivery.workflowState === 'AwaitingRefund')
    return totals.refunded > 0 ? 'refundPartial' : 'refundDue'
  if (delivery.outstandingUah <= 0) return 'paid'
  const payout = shipment?.paymentState ?? null
  if (payout === 'NeedsReconciliation') return 'reconcile'
  if (payout !== null && MANUAL.has(payout)) return 'manual'
  if (delivery.receivedAt !== null) return 'awaitingCod'
  return 'due'
}

/**
 * The return, step by step (10.3–10.12). `current` is the step the order
 * waits on; every step before it is done and offers nothing again.
 */
export const RETURN_STEPS = [
  'started',
  'awaitGoods',
  'accepted',
  'refunded',
  'cancelled',
] as const

export type ReturnStep = (typeof RETURN_STEPS)[number]

/** Null when the order is not in a return (sent and then brought back). */
export function returnProgress(delivery: DeliveryOrder): number | null {
  if (delivery.dispatchedAt === null) return null
  switch (delivery.workflowState) {
    case 'AwaitingGoods':
      return 1
    case 'AwaitingRefund':
      return 3
    case 'Cancelled':
      return RETURN_STEPS.length
    default:
      return null
  }
}

/**
 * The header's own actions (10.1, 10.13, 10.15). Before the parcel leaves an
 * order is cancelled; after, it can only come back as a return. An order
 * already in a return, a cancellation or cancelled offers neither.
 */
export interface OrderActions {
  startReturn: 'button' | 'menu' | null
  cancel: 'enabled' | 'disabled' | null
  /** «Скасування після відправлення» (10.15). */
  sentNotice: boolean
}

export function orderActions(
  delivery: DeliveryOrder,
  canManage: boolean,
): OrderActions {
  const none: OrderActions = {
    startReturn: null,
    cancel: null,
    sentNotice: false,
  }
  if (!canManage || orderClosing(delivery) || delivery.returnedAt !== null)
    return none
  if (delivery.dispatchedAt === null)
    return { startReturn: null, cancel: 'enabled', sentNotice: false }
  if (delivery.receivedAt !== null)
    return { startReturn: 'button', cancel: null, sentNotice: false }
  return { startReturn: 'menu', cancel: 'disabled', sentNotice: true }
}

/** How many units the order holds: what a full return brings back. */
export const unitCount = (items: readonly { quantity: number }[]): number =>
  items.reduce((sum, item) => sum + item.quantity, 0)
