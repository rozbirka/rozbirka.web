import { plural } from '@/lib/utils'
import type { OrderDetail } from '@/api/orders'

/** One money figure as text: the digits stay bare so columns line up. */
export const money = (
  value: number | null | undefined,
  currency?: string | null,
) => {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  if (!currency) return String(value)
  try {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value} ${currency}`
  }
}

/**
 * What an order is worth and what has been paid against it.
 *
 * The two figures are not always in the same money: the order total is kept in
 * dollars while a till may have taken hryvnia, and there is no rate anywhere
 * in the cabinet. So "what is left" is only ever computed when both sides are
 * the same currency — otherwise the card shows both sums and says nothing
 * about the difference.
 */
export interface OrderMoney {
  totalUsd: number | null
  paid: number | null
  paidCurrency: string | null
  /** Null when the two sums cannot be compared, or the total is unknown. */
  remaining: number | null
  /** Share of the total already covered, 0–100. */
  paidPercent: number
  label: string
  tone: 'ok' | 'warn' | 'info' | 'dim'
}

const ORDER_CURRENCY = 'USD'

const finite = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export function orderMoney(order: OrderDetail): OrderMoney {
  const itemsTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0)
  const totalUsd =
    finite(order.itemsTotalUsd) ??
    (order.items.length > 0 ? itemsTotal : finite(order.totalAmount))

  // Core reports a total only when every payment is in one currency. With two
  // currencies on one order there is nothing to report and nothing to add:
  // `paid` stays null and the card says so rather than printing a false zero.
  const paid =
    finite(order.totalPaid) ?? (order.payments.length === 0 ? 0 : null)
  const paidCurrency = order.paymentCurrency
  const comparable =
    paid !== null && (paidCurrency === null || paidCurrency === ORDER_CURRENCY)

  const remaining =
    totalUsd === null
      ? null
      : comparable
        ? Math.max(0, totalUsd - (paid ?? 0))
        : order.payments.length === 0
          ? totalUsd
          : null

  const paidPercent =
    totalUsd === null || totalUsd <= 0 || !comparable || paid === null
      ? order.status === 'pending'
        ? 0
        : 100
      : Math.min(100, Math.round((paid / totalUsd) * 100))

  return {
    totalUsd,
    paid,
    paidCurrency,
    remaining,
    paidPercent,
    ...state(order, remaining),
  }
}

function state(
  order: OrderDetail,
  remaining: number | null,
): { label: string; tone: OrderMoney['tone'] } {
  if (order.status === 'refunded')
    return { label: 'Кошти повернено', tone: 'info' }
  if (order.status === 'cancelled')
    return { label: 'Замовлення скасовано', tone: 'dim' }
  if (order.status === 'confirmed')
    return { label: 'Оплачено повністю', tone: 'ok' }
  if (remaining !== null && remaining <= 0 && order.payments.length > 0)
    return { label: 'Внесено повністю', tone: 'ok' }
  return { label: 'Очікує оплати', tone: 'warn' }
}

/**
 * What a refund will actually do, line by line. Everything here is read from
 * the order: the sum that goes back and the till it leaves, how many positions
 * return to the shelf, and the state the order ends in. Where the parts sat on
 * the shelf is not on an order item, so the design's list of places is absent.
 */
export function refundEffects(
  order: OrderDetail,
  summary: OrderMoney,
): string[] {
  const tills = [
    ...new Set(order.payments.map((payment) => payment.accountName)),
  ]
  const positions = order.items.length
  const returning = summary.paid ?? summary.totalUsd

  return [
    tills.length === 0
      ? 'Платежів за замовленням немає — з каси нічого не списується'
      : `${money(returning, summary.paidCurrency ?? 'USD')} повернеться клієнту з ${tills.length === 1 ? 'каси' : 'кас'}: ${tills.join(', ')}`,
    `${String(positions)} ${plural(positions, ['позиція повернеться', 'позиції повернуться', 'позицій повернеться'])} на склад`,
    'Статус замовлення зміниться на «Повернено»',
  ]
}
