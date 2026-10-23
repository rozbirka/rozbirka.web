import type { CashTransaction } from '@/api/cash'

/**
 * Sale/refund references point to orders. Delivery can also allocate a manual
 * incoming payment to an order. Transfer references identify transfers, not orders.
 */
export function cashOrderHref(
  entry: CashTransaction,
  ordersPath: string | null,
): string | null {
  if (
    !ordersPath ||
    !entry.referenceId ||
    !['sale_in', 'refund_out', 'manual_in'].includes(entry.type)
  )
    return null
  return `${ordersPath}/${encodeURIComponent(entry.referenceId)}`
}
