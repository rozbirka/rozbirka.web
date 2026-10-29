import type { StatusTone } from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'
import {
  DEFAULT_TIME_ZONE,
  formatDateWith,
  formatTime,
  translate,
  type Locale,
  type MessageKey,
  type MessageParams,
} from '@/i18n'
import { deliveryStage, isFullyPaid, uah } from './delivery-money'
import { orderChipKey } from './delivery-flow'
import { deliveryFlowMessages } from './flow-messages'
import { deliveryMessages } from './messages'

const tr = (
  locale: Locale,
  key: MessageKey<typeof deliveryMessages>,
  params?: MessageParams,
) => translate(deliveryMessages, locale, key, params)

/**
 * The shape of a delivery order on screen, read from the two records Core
 * keeps for it: the money (`/orders/{id}/delivery`) and the waybill
 * (`/shipping/orders/{id}`). Everything here is derived — nothing is stored
 * twice — so the card and its drawers cannot disagree about where the order
 * stands.
 */

/** A waybill exists once the carrier has given it a number. */
export const hasWaybill = (shipment: Shipment | null): boolean =>
  shipment !== null && shipment.number !== null && shipment.number !== ''

export interface LifecycleStep {
  key: string
  label: string
  /** When it happened; empty for a step still ahead. */
  meta: string
  done: boolean
  /** The furthest step reached — the one the eye should land on. */
  current: boolean
}

/** Day, month and time in the business time zone: `21.09 · 14:02`. */
const stamp = (
  value: string | null,
  locale: Locale,
  timeZone: string,
): string => {
  if (value === null) return ''
  const date = formatDateWith(
    value,
    locale,
    { day: '2-digit', month: '2-digit' },
    timeZone,
  )
  const time = formatTime(value, locale, timeZone)
  return date === null || time === null
    ? value
    : tr(locale, 'stamp', { date, time })
}

/**
 * The four moments a delivery order passes through. Payment sits first because
 * that is the order a prepaid sale runs in, not because it gates anything: an
 * unpaid order reaches every later step just the same, and settles when the
 * carrier hands the post-payment back.
 */
export function lifecycle(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
  locale: Locale,
  timeZone: string = DEFAULT_TIME_ZONE,
): LifecycleStep[] {
  const paidAt = isFullyPaid(delivery)
    ? (delivery.payments
        .filter((payment) => payment.refundedAt === null)
        .map((payment) => payment.createdAt)
        .sort()
        .at(-1) ?? null)
    : null
  const waybillAt =
    shipment?.events.find((event) => event.code === 'Created')?.recordedAt ??
    (hasWaybill(shipment) ? (shipment?.quoteAt ?? null) : null)

  const steps: {
    key: string
    label: string
    done: boolean
    at: string | null
  }[] = [
    {
      key: 'paid',
      label: tr(locale, 'stepPaid'),
      done: isFullyPaid(delivery),
      at: paidAt,
    },
    {
      key: 'waybill',
      label: tr(locale, 'stepWaybill'),
      done: hasWaybill(shipment),
      at: waybillAt,
    },
    {
      key: 'dispatched',
      label: tr(locale, 'stepDispatched'),
      done: delivery.dispatchedAt !== null,
      at: delivery.dispatchedAt,
    },
    {
      key: 'received',
      label: tr(locale, 'stepReceived'),
      done: delivery.receivedAt !== null,
      at: delivery.receivedAt,
    },
  ]

  return steps.map((step, index) => ({
    key: step.key,
    label: step.label,
    meta: step.done ? stamp(step.at, locale, timeZone) : '',
    done: step.done,
    current: step.done && steps[index + 1]?.done !== true,
  }))
}

/**
 * The order's own pill, in module 46's words: «Відкрите», «Завершене»,
 * «Повернення» or «Скасоване», from Core's workflow state.
 */
export function orderChip(
  delivery: DeliveryOrder,
  locale: Locale,
): {
  label: string
  tone: StatusTone
} {
  const chip = orderChipKey(delivery)
  return {
    label: translate(deliveryFlowMessages, locale, chip.key),
    tone: chip.tone,
  }
}

/** Where the parcel is, as the carrier record shows it. */
export function shipmentChip(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
  locale: Locale,
): { label: string; tone: StatusTone } {
  if (delivery.receivedAt !== null)
    return { label: tr(locale, 'shipReceived'), tone: 'ok' }
  if (delivery.dispatchedAt !== null)
    return { label: tr(locale, 'stepDispatched'), tone: 'info' }
  if (hasWaybill(shipment))
    return { label: tr(locale, 'shipCreated'), tone: 'neutral' }
  if (shipment?.state === 'Creating')
    return { label: tr(locale, 'shipCreating'), tone: 'warn' }
  if (shipment?.state === 'Unknown')
    return { label: tr(locale, 'shipUnknown'), tone: 'danger' }
  if (shipment?.state === 'Cancelled')
    return { label: tr(locale, 'shipCancelled'), tone: 'neutral' }
  return { label: tr(locale, 'shipNone'), tone: 'warn' }
}

/**
 * How far the money has got. «Частково» has to mean what it says: an order
 * nobody has paid anything against is not partly paid, and calling it that
 * hides the difference between a deposit taken and a deposit never asked for.
 */
export function paymentStanding(
  delivery: DeliveryOrder,
  locale: Locale,
): {
  label: string
  tone: 'ok' | 'warn' | 'dim'
} {
  if (delivery.agreedTotalUah <= 0)
    return { label: tr(locale, 'standingUnknown'), tone: 'dim' }
  if (isFullyPaid(delivery))
    return { label: tr(locale, 'standingFull'), tone: 'ok' }
  return delivery.appliedUah > 0
    ? { label: tr(locale, 'standingPartial'), tone: 'warn' }
    : { label: tr(locale, 'standingNone'), tone: 'dim' }
}

export interface ReadinessCheck {
  key: string
  label: string
  /** What the check found: a number, a code, a plain word. */
  state: string
  ok: boolean
  /** True when the cabinet cannot know and the carrier decides at creation. */
  deferred?: boolean
  /**
   * Not done yet, and the booking drawer is where it gets done. Such a row is
   * a step ahead rather than a fault, and it must never bar the way to the
   * screen that resolves it: the delivery quote is calculated there and the
   * deposit is derived from that quote, so gating entry on either of them
   * locks a fresh order out of its own first step.
   */
  pending?: boolean
}

/**
 * What stands between this order and a waybill. The cabinet can only check
 * what Core tells it — the route and the parcel are verified by the carrier
 * during creation, and those rows say so rather than claiming a pass.
 */
export function readiness(
  delivery: DeliveryOrder,
  shipment: Shipment | null,
  dispatchPointActive: boolean,
  locale: Locale,
): ReadinessCheck[] {
  const quoteFresh =
    shipment?.quoteAt != null &&
    Date.now() - new Date(shipment.quoteAt).getTime() < 24 * 60 * 60 * 1000

  return [
    {
      // Not a gate any more, and saying otherwise sends a manager to collect
      // money the carrier is about to collect for them.
      key: 'outstanding',
      label:
        delivery.outstandingUah > 0
          ? tr(locale, 'checkOutstandingCod')
          : tr(locale, 'checkOutstandingNone'),
      state: uah(delivery.outstandingUah, locale),
      ok: true,
    },
    {
      key: 'deposit',
      label: tr(locale, 'checkDeposit'),
      // A required deposit of zero is not a deposit that is covered: it is a
      // deposit nobody has worked out yet, because it equals the carrier quote
      // plus the return estimate and neither exists before the calculation.
      // Said as a shortfall it reads «бракує 0,00 ₴», which is not a fact.
      state: !delivery.depositRequired
        ? tr(locale, 'depositStateNotRequired')
        : delivery.depositWaived
          ? tr(locale, 'depositStateWaived')
          : delivery.requiredDepositUah <= 0
            ? tr(locale, 'depositAfterQuote')
            : delivery.depositSatisfied
              ? uah(delivery.requiredDepositUah, locale)
              : tr(locale, 'depositShort', {
                  amount: uah(delivery.depositShortfallUah, locale),
                }),
      ok:
        !delivery.depositRequired ||
        delivery.depositWaived ||
        (delivery.requiredDepositUah > 0 && delivery.depositSatisfied),
      // Before the quote there is no figure to pay at all, and a deposit
      // still owed is paid in the order, not in the integration's settings:
      // neither keeps the order off the confirmation, which says why it
      // cannot create the waybill yet.
      pending:
        delivery.depositRequired &&
        !delivery.depositWaived &&
        (delivery.requiredDepositUah <= 0 || !delivery.depositSatisfied),
    },
    {
      key: 'quote',
      label: tr(locale, 'checkQuote'),
      state:
        shipment?.quoteAt == null
          ? tr(locale, 'quoteNextStep')
          : quoteFresh
            ? tr(locale, 'quoteUpdated')
            : tr(locale, 'quoteStaleNext'),
      ok: quoteFresh,
      pending: true,
    },
    {
      key: 'dispatch-point',
      label: tr(locale, 'checkDispatchPoint'),
      state: dispatchPointActive
        ? tr(locale, 'pointActive')
        : tr(locale, 'pointNone'),
      ok: dispatchPointActive,
    },
    {
      key: 'carrier',
      label: tr(locale, 'checkCarrier'),
      state: tr(locale, 'carrierChecks'),
      ok: true,
      deferred: true,
    },
  ]
}

/** Whether every check the cabinet can make has passed. */
export const readinessPassed = (checks: readonly ReadinessCheck[]): boolean =>
  checks.every((check) => check.ok)

/**
 * What actually stands between this order and the booking drawer. A step that
 * drawer performs itself is not in the way of reaching it; only something that
 * has to be fixed somewhere else — an inactive dispatch point lives in
 * settings — can keep the order out.
 */
export const readinessBlocks = (
  checks: readonly ReadinessCheck[],
): ReadinessCheck[] =>
  checks.filter(
    (check) => !check.ok && check.deferred !== true && check.pending !== true,
  )

/** The one move that gets this order closer to a waybill, said plainly. */
export function readinessNextStep(
  checks: readonly ReadinessCheck[],
  locale: Locale,
): {
  title: string
  note: string
} {
  const blocking = readinessBlocks(checks)
  const first = blocking[0]
  if (first !== undefined)
    return {
      title: tr(locale, 'nextFixTitle'),
      note: tr(locale, 'nextFixNote', {
        label: first.label,
        state: first.state,
      }),
    }
  if (checks.find((check) => check.key === 'quote')?.ok !== true)
    return {
      title: tr(locale, 'nextQuoteTitle'),
      note: tr(locale, 'nextQuoteNote'),
    }
  if (checks.find((check) => check.key === 'deposit')?.ok !== true)
    return {
      title: tr(locale, 'nextDepositTitle'),
      note: tr(locale, 'nextDepositNote'),
    }
  return {
    title: tr(locale, 'nextClearTitle'),
    note: tr(locale, 'nextClearNote'),
  }
}

/** What the yard calls a payment Core tagged with its kind. */
export const paymentKindLabel = (kind: string | null, locale: Locale): string =>
  tr(
    locale,
    kind === 'prepayment'
      ? 'kindPrepayment'
      : kind === 'cod'
        ? 'factCod'
        : 'kindOther',
  )

export { deliveryStage }
