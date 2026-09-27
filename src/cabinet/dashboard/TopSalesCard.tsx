import { Link } from 'react-router'
import { plural } from '@/lib/utils'
import type { DashboardTopPart } from '@/api/dashboard-contract'
import { CardEmpty, CardNote, CardRow, DashboardCard } from './dashboard-card'

const sum = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

/**
 * The period's best-selling part. The design ranks five; `/dashboard/analytics`
 * reports exactly one — `topPart` — and there is no endpoint that ranks parts
 * by revenue, so the card carries the one the server names instead of five
 * rows built from a list that does not exist.
 */
export function TopSalesCard({
  partsPath,
  periodLabel,
  topPart,
}: {
  /** The part's own card, when the parts module is open to this account. */
  partsPath: string | null
  periodLabel: string
  topPart: DashboardTopPart | null
}) {
  return (
    <DashboardCard
      aside={<CardNote>{periodLabel}</CardNote>}
      title="Топ продажів"
    >
      {topPart === null ? (
        <CardEmpty>За обраний період продажів не було.</CardEmpty>
      ) : (
        <CardRow hover={partsPath !== null}>
          <Row partsPath={partsPath} topPart={topPart} />
        </CardRow>
      )}
    </DashboardCard>
  )
}

function Row({
  partsPath,
  topPart,
}: {
  partsPath: string | null
  topPart: DashboardTopPart
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-bold text-white">
          {topPart.name}
        </span>
        <span className="text-app-dim mt-[3px] block font-mono text-[12px]">
          {String(topPart.salesCount)}{' '}
          {plural(topPart.salesCount, ['продаж', 'продажі', 'продажів'])} за
          період
        </span>
      </span>
      <span className="font-mono text-[15px] font-medium whitespace-nowrap tabular-nums text-white">
        {sum.format(topPart.revenueUsd)} $
      </span>
    </>
  )
  const className =
    'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 outline-none focus-visible:ring-2 focus-visible:ring-white/40'

  return partsPath === null ? (
    <div className={className}>{body}</div>
  ) : (
    <Link className={className} to={`${partsPath}/${topPart.id}`}>
      {body}
    </Link>
  )
}
