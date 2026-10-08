import { byCatalog, tillCurrencies } from '../currency/catalog-order'

/**
 * Multi-currency order payments (REQ-SINGLE-BUSINESS-CURRENCY r9, R-8–R-10):
 * a payment is an actual sum in a currency its till keeps. There is no rate,
 * no converted amount and no comparison with the order value.
 */

export { tillCurrencies }

export interface PaymentCurrencyChoice {
  currency: string | null
  /** The currency the previous till took and the new one does not. */
  reselectFrom: string | null
}

/**
 * The payment currency after switching to a till that keeps `available`.
 * A till with one currency fixes it; a dropped currency is reset with an
 * explanation instead of silently re-labelling the typed amount.
 */
export function choosePaymentCurrency(
  current: string | null,
  available: readonly string[],
): PaymentCurrencyChoice {
  if (current !== null && available.includes(current))
    return { currency: current, reselectFrom: null }
  if (current !== null) return { currency: null, reselectFrom: current }
  return {
    currency: available.length === 1 ? (available[0] ?? null) : null,
    reselectFrom: null,
  }
}

/** A typed payment amount: comma or dot decimals, spaces ignored. */
export function parseAmount(value: string): number | null {
  const text = value.replace(/\s/g, '').replace(',', '.')
  if (text === '') return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

/** Actual payments summed per currency; different currencies never add up. */
export function sumByCurrency(
  payments: readonly { amount: number; currency: string }[],
): { currency: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const payment of payments) {
    const code = payment.currency.toUpperCase()
    totals.set(code, (totals.get(code) ?? 0) + payment.amount)
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => byCatalog(left.currency, right.currency))
}

interface PaymentKey {
  accountId: string
  amount: number
  currency: string
}

/**
 * Whether `after` holds one more `payment` than `before` — how an unknown
 * outcome is settled by re-reading the order instead of writing twice.
 */
export function paymentRecorded(
  before: readonly PaymentKey[],
  after: readonly PaymentKey[],
  payment: PaymentKey,
): boolean {
  const same = (item: PaymentKey) =>
    item.accountId === payment.accountId &&
    item.amount === payment.amount &&
    item.currency.toUpperCase() === payment.currency.toUpperCase()
  return after.filter(same).length > before.filter(same).length
}
