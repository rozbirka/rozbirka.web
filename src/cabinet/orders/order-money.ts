import { formatMoney, SOURCE_LOCALE, type Locale } from '@/i18n'
import { plural } from '@/lib/utils'
import type { OrderDetail } from '@/api/orders'
import { sumByCurrency } from './payment-policy'

/**
 * One money figure as text, with the ISO code after the number («100,00 USD»)
 * and the currency's precision. Without a currency the bare number stands —
 * never a guessed one.
 */
export const money = (
  value: number | null | undefined,
  currency?: string | null,
  locale: Locale = SOURCE_LOCALE,
) => {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  return formatMoney(value, currency ?? null, locale) ?? '—'
}

/** Several sums in different currencies, side by side and never added up. */
export const moneyList = (
  sums: readonly { amount: number; currency: string }[],
  separator: string,
  locale: Locale = SOURCE_LOCALE,
) => sums.map((sum) => money(sum.amount, sum.currency, locale)).join(separator)

/**
 * What an order is worth and what has actually been paid for it.
 *
 * The value is in the accounting currency; payments are actual sums in their
 * tills' currencies. There is no rate, so the two are shown next to each
 * other and never compared: no remaining sum, no debt, no overpayment, no
 * share paid. Whether the order is paid in full is the operator's call when
 * confirming it (R-10).
 */
export interface OrderMoney {
  /** Sum of the lines, in the accounting currency. */
  value: number | null
  /** Actual payments per currency. */
  paid: { currency: string; amount: number }[]
  status: 'pending' | 'confirmed' | 'refunded' | 'cancelled' | 'other'
  tone: 'ok' | 'warn' | 'info' | 'dim'
}

const finite = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const TONE: Record<OrderMoney['status'], OrderMoney['tone']> = {
  pending: 'warn',
  confirmed: 'ok',
  refunded: 'info',
  cancelled: 'dim',
  other: 'dim',
}

export function orderMoney(order: OrderDetail): OrderMoney {
  const itemsTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0)
  const value =
    finite(order.itemsTotalUsd) ??
    (order.items.length > 0 ? itemsTotal : finite(order.totalAmount))
  const status =
    order.status === 'pending' ||
    order.status === 'confirmed' ||
    order.status === 'refunded' ||
    order.status === 'cancelled'
      ? order.status
      : 'other'
  return {
    value,
    paid: sumByCurrency(order.payments),
    status,
    tone: TONE[status],
  }
}

/**
 * What a refund will actually do, line by line. Everything here is read from
 * the order: the sums that go back (each in its own currency) and the tills
 * they leave, how many positions return to the shelf, and the state the
 * order ends in. Where the parts sat on the shelf is not on an order item,
 * so the design's list of places is absent.
 */
export function refundEffects(
  order: OrderDetail,
  summary: OrderMoney,
): string[] {
  const tills = [
    ...new Set(order.payments.map((payment) => payment.accountName)),
  ]
  const positions = order.items.length

  return [
    tills.length === 0
      ? 'Платежів за замовленням немає — з каси нічого не списується'
      : `${moneyList(summary.paid, ' і ')} повернеться клієнту з ${tills.length === 1 ? 'каси' : 'кас'}: ${tills.join(', ')}`,
    `${String(positions)} ${plural(positions, ['позиція повернеться', 'позиції повернуться', 'позицій повернеться'])} на склад`,
    'Статус замовлення зміниться на «Повернено»',
  ]
}
