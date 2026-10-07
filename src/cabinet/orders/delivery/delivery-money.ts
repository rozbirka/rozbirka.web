import type { DeliveryOrder } from '@/api/delivery'
import type { CashTransaction } from '@/api/cash'

const hryvniaFormat = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 2,
})

/** Delivery money is hryvnia only — Core refuses any other currency here. */
export const uah = (value: number): string => hryvniaFormat.format(value)

/**
 * A hryvnia figure the way the cabinet is typed: a comma is a decimal
 * separator, and Core takes at most two decimals. Null when what was typed
 * would be refused, so a caller never has to repeat the rule.
 */
export function hryvnia(
  input: string,
  { allowZero = false }: { allowZero?: boolean } = {},
): number | null {
  const text = input.trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null
  const value = Number(text.replace(',', '.'))
  return value > 0 || allowZero ? value : null
}

/** Where the order stands in the shipping lifecycle, as Core records it. */
export type DeliveryStage = 'open' | 'dispatched' | 'received' | 'returned'

export function deliveryStage(delivery: DeliveryOrder): DeliveryStage {
  if (delivery.returnedAt !== null) return 'returned'
  if (delivery.receivedAt !== null) return 'received'
  return delivery.dispatchedAt === null ? 'open' : 'dispatched'
}

/**
 * A recorded payment's own amount is the gross, and the till receives it minus
 * the fee. A linked transaction works the other way round: the receipt already
 * sits in the till, so the fee is added on top to reach the gross. The two
 * formulas are opposite and they sit behind one drawer, which is exactly how
 * the wrong one gets used.
 */
export function linkedGross(transaction: number, fee: number): number {
  return transaction + fee
}

export interface PaymentOutcome {
  gross: number
  /** More than the order still owes: Core refuses the record and the link. */
  over: boolean
  remaining: number
}

export function paymentOutcome(
  gross: number,
  outstanding: number,
): PaymentOutcome {
  if (gross > outstanding) return { gross, over: true, remaining: 0 }
  return { gross, over: false, remaining: outstanding - gross }
}

/**
 * Receipts Core will accept for linking. It takes an incoming UAH transaction
 * that no order has claimed; `referenceId` is how a claimed one shows, and
 * cash summaries and withdrawals are not receipts at all.
 */
export function linkableTransactions(
  transactions: CashTransaction[],
): CashTransaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.direction === 'in' &&
      transaction.currency === 'UAH' &&
      transaction.amount > 0 &&
      transaction.referenceId === null &&
      (transaction.type === 'manual_in' || transaction.type === 'sale_in'),
  )
}
