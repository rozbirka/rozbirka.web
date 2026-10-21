import { Link } from 'react-router'
import type { DashboardTopPart } from '@/api/dashboard-contract'
import { useT } from '@/i18n'
import { useWholeMoney } from '../currency/money'
import { CardEmpty, CardNote, CardRow, DashboardCard } from './dashboard-card'
import { dashboardMoneyMessages } from './money-messages'

/**
 * The part's revenue and the currency it is in. The pending contract sends
 * `revenue` in the accounting currency; the pinned one only `revenueUsd`,
 * which is USD by its own name — not a guess.
 */
const topRevenue = (
  topPart: DashboardTopPart,
  accountingCurrency: string | null,
): { amount: number; currency: string | null } | null =>
  topPart.revenue !== undefined
    ? {
        amount: topPart.revenue,
        currency: topPart.accountingCurrency ?? accountingCurrency,
      }
    : topPart.revenueUsd === null
      ? null
      : { amount: topPart.revenueUsd, currency: 'USD' }

/**
 * The period's best-selling part. The design ranks five; `/dashboard/analytics`
 * reports exactly one — `topPart` — and there is no endpoint that ranks parts
 * by revenue, so the card carries the one the server names instead of five
 * rows built from a list that does not exist.
 */
export function TopSalesCard({
  accountingCurrency,
  partsPath,
  periodLabel,
  topPart,
}: {
  accountingCurrency: string | null
  /** The part's own card, when the parts module is open to this account. */
  partsPath: string | null
  periodLabel: string
  topPart: DashboardTopPart | null
}) {
  const t = useT(dashboardMoneyMessages)
  return (
    <DashboardCard
      aside={<CardNote>{periodLabel}</CardNote>}
      title={t('topSales')}
    >
      {topPart === null ? (
        <CardEmpty>{t('noSales')}</CardEmpty>
      ) : (
        <CardRow hover={partsPath !== null}>
          <Row
            partsPath={partsPath}
            revenue={topRevenue(topPart, accountingCurrency)}
            topPart={topPart}
          />
        </CardRow>
      )}
    </DashboardCard>
  )
}

function Row({
  partsPath,
  revenue,
  topPart,
}: {
  partsPath: string | null
  revenue: { amount: number; currency: string | null } | null
  topPart: DashboardTopPart
}) {
  const t = useT(dashboardMoneyMessages)
  const money = useWholeMoney(revenue?.currency ?? null)
  const body = (
    <>
      <span className="min-w-0">
        <span className="rz-strong block truncate font-medium">
          {topPart.name}
        </span>
        <span className="rz-caption rz-mono mt-0.5 block">
          {t('salesInPeriod', { count: topPart.salesCount })}
        </span>
      </span>
      <span className="rz-num rz-strong whitespace-nowrap">
        {revenue === null ? '—' : money(revenue.amount)}
      </span>
    </>
  )
  const className =
    'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 outline-none'

  return partsPath === null ? (
    <div className={className}>{body}</div>
  ) : (
    <Link className={className} to={`${partsPath}/${topPart.id}`}>
      {body}
    </Link>
  )
}
