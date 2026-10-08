import type {
  AnalyticsConfirmedOrdersValue,
  ConfirmedOrdersValue,
  DashboardPeriod,
} from '@/api/dashboard-contract'

const SUMMARY_FIELD = {
  day: 'today',
  week: 'week',
  month: 'month',
} as const satisfies Record<DashboardPeriod, keyof ConfirmedOrdersValue>

/**
 * The confirmed-order value of the selected period. The analytics figure
 * follows the same buckets as the receipts chart beside it, so it wins; the
 * summary (today / calendar week / calendar month) covers the moment before
 * analytics arrives or a role analytics withholds it from.
 */
export function pickConfirmedOrdersValue(
  period: DashboardPeriod,
  analytics: AnalyticsConfirmedOrdersValue | null | undefined,
  summary: ConfirmedOrdersValue | null | undefined,
): { amount: number; currency: string } | null {
  if (analytics)
    return { amount: analytics.total, currency: analytics.accountingCurrency }
  if (summary)
    return {
      amount: summary[SUMMARY_FIELD[period]],
      currency: summary.accountingCurrency,
    }
  return null
}
