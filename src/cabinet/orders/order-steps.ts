import type { OrderDetail } from '@/api/orders'
import { translate, type Locale } from '@/i18n'
import { orderMessages } from './messages'

/**
 * The life of an order as a row of steps. Only the steps Core actually knows
 * are drawn: the design's «Завершено · видано клієнту» is a handover the
 * server has no operation and no timestamp for, so an order that is confirmed
 * is as far as the row goes. A cancelled or refunded order ends on the step
 * that says so rather than on a greyed-out promise.
 */
export type OrderStepState = 'done' | 'current' | 'upcoming'

export interface OrderStep {
  key: string
  label: string
  /** When it happened and who did it; empty for a step still ahead. */
  meta: string
  state: OrderStepState
}

type Stamp = (value: string) => string

const at = (stamp: Stamp, when?: string | null, who?: string | null) =>
  when == null ? '' : who == null ? stamp(when) : `${stamp(when)} · ${who}`

export function orderSteps(
  order: OrderDetail,
  stamp: Stamp,
  locale: Locale,
): OrderStep[] {
  const created: OrderStep = {
    key: 'created',
    label: translate(orderMessages, locale, 'stepCreated'),
    meta: at(stamp, order.createdAt, order.createdByName),
    state: 'done',
  }

  if (order.status === 'cancelled') {
    return [
      created,
      {
        key: 'cancelled',
        label: translate(orderMessages, locale, 'statusCancelled'),
        meta: at(stamp, order.cancelledAt, order.cancelledByName),
        state: 'current',
      },
    ]
  }

  // Confirmation, not payment. Core takes the stock and fixes the payments
  // here, and it accepts a single payment against a larger total — so calling
  // this step «Оплачено» would claim a debt is settled on an order that still
  // owes most of it. What is paid is a running figure, and the money card
  // already shows it as one.
  //
  // An open order has not reached this step either. `current` means the
  // furthest step reached and is drawn like a step that happened, so a pending
  // order leaves it ahead.
  const paid: OrderStep = {
    key: 'confirmed',
    label: translate(orderMessages, locale, 'statusConfirmed'),
    meta: at(stamp, order.confirmedAt, order.confirmedByName),
    state: order.status === 'pending' ? 'upcoming' : 'current',
  }

  if (order.status === 'refunded') paid.state = 'done'

  if (order.status === 'refunded') {
    return [
      created,
      paid,
      {
        key: 'refunded',
        label: translate(orderMessages, locale, 'statusRefunded'),
        meta: at(stamp, order.refundedAt, order.refundedByName),
        state: 'current',
      },
    ]
  }

  return [created, paid]
}
