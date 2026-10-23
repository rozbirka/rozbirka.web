import { cn } from '@/lib/utils'
import type {
  DashboardAnalytics,
  DashboardData,
} from '@/api/dashboard-contract'
import type { PartsSummary } from '@/api/parts'
import { useFormat, useT, type Translate } from '@/i18n'
import { dashboardMoneyMessages } from './money-messages'

type T = Translate<(typeof dashboardMoneyMessages)['uk']>

/** Locale-bound number writers: whole counts and sums without decimals. */
interface Numbers {
  count: (value: number) => string
  sum: (value: number) => string
}

type Tone = 'ink' | 'ok' | 'warn' | 'danger' | 'dim'

/** The figure's colour: the kit's `.rz-kpi--warn/--dim`, or a state token. */
const KPI_TONE: Record<Tone, string> = {
  ink: '',
  ok: '[&_.rz-display]:text-state-ok',
  warn: 'rz-kpi--warn',
  danger: '[&_.rz-display]:text-state-danger',
  dim: 'rz-kpi--dim',
}

const META_TONE: Record<Tone, string> = {
  ink: 'text-app-muted',
  ok: 'text-state-ok',
  warn: 'text-state-warn',
  danger: 'text-state-danger',
  dim: '',
}

interface Kpi {
  label: string
  value: string
  /** What the figure is counted in, set beside it: `USD`, `%`, items. */
  unit: string
  meta: string
  tone: Tone
  metaTone: Tone
}

/**
 * The four figures the board opens with. A figure the account may not see
 * arrives as `null` and its tile is absent — a role-restricted dashboard
 * shows fewer measures, never a dash where money should be.
 */
export function DashboardKpis({
  accountingCurrency = null,
  analytics,
  data,
  parts,
}: {
  /** What invested/recouped are counted in; `null` when unknown. */
  accountingCurrency?: string | null
  analytics: DashboardAnalytics | null
  data: DashboardData
  parts: PartsSummary | null
}) {
  const t = useT(dashboardMoneyMessages)
  const format = useFormat()
  const numbers: Numbers = {
    count: (value) => format.number(value) ?? String(value),
    sum: (value) =>
      format.number(value, { maximumFractionDigits: 0 }) ?? String(value),
  }
  const tiles = [
    receiptsToday(data, t, numbers),
    stockPayoff(data, accountingCurrency, t, numbers),
    activeOrders(analytics, t, numbers),
    availableParts(data, parts, t, numbers),
  ].filter((tile): tile is Kpi => tile !== null)

  if (tiles.length === 0) return null

  // `.rz-kpis` lays the tiles out itself (auto-fit, one column on a phone).
  // A `dl` rather than the shared `KpiStrip`, so every figure stays a
  // term/definition pair under one named list.
  return (
    <dl aria-label={t('kpis')} className="rz-kpis m-0">
      {tiles.map((tile) => (
        <div className={cn('rz-kpi', KPI_TONE[tile.tone])} key={tile.label}>
          <dt className="rz-kpi__label">{tile.label}</dt>
          <dd className="m-0 grid gap-1.5">
            <span className="rz-kpi__value">
              <span className="rz-display">{tile.value}</span>
              {tile.unit === '' ? null : (
                <span className="rz-kpi__unit">{tile.unit}</span>
              )}
            </span>
            <span
              className={cn(
                'rz-kpi__meta text-pretty',
                META_TONE[tile.metaTone],
              )}
            >
              {tile.meta}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Today's actual receipts, each in its own currency. The largest one (the
 * server sorts them) is the headline with its ISO code as the unit; any other
 * currency is listed beside it, never converted or added.
 */
function receiptsToday(
  data: DashboardData,
  t: T,
  { sum }: Numbers,
): Kpi | null {
  const [entry, ...others] = data.revenue?.today ?? []
  if (entry === undefined) return null
  const sales = data.todaySalesCount
  return {
    label: t('receiptsToday'),
    value: sum(entry.amount),
    unit: entry.currency,
    meta: [
      ...others.map((other) => `+ ${sum(other.amount)} ${other.currency}`),
      t('salesCount', { count: sales }),
    ].join(' · '),
    tone: 'ink',
    metaTone: 'ink',
  }
}

/** What the yard has earned back against everything it has put into cars. */
function stockPayoff(
  data: DashboardData,
  accountingCurrency: string | null,
  t: T,
  { sum }: Numbers,
): Kpi | null {
  const { totalRecouped: recouped, totalInvested: invested } = data
  if (recouped === null || invested === null || invested <= 0) return null
  const percent = Math.round((recouped / invested) * 100)
  return {
    label: t('stockPayoff'),
    value: String(percent),
    unit: '%',
    meta: `${t('recoupedOf', { recouped: sum(recouped), invested: sum(invested) })}${accountingCurrency === null ? '' : ` ${accountingCurrency}`}`,
    // Green once most of the money is back; amber while the yard is still
    // deep in what it spent, on the same scale the car rows use.
    tone: percent >= 60 ? 'ok' : 'warn',
    metaTone: percent >= 60 ? 'ok' : 'ink',
  }
}

/**
 * The period's own change is the only comparison the contract carries — there
 * is no "yesterday" anywhere in the payload, so the design's «−88% до вчора»
 * becomes the delta the server does report.
 */
function activeOrders(
  analytics: DashboardAnalytics | null,
  t: T,
  { count }: Numbers,
): Kpi | null {
  if (analytics === null) return null
  const { total, delta } = analytics.activeOrders
  return {
    label: t('activeOrders'),
    value: count(total),
    unit: '',
    meta:
      delta === 0
        ? t('noChange')
        : t('deltaPeriod', {
            delta: `${delta > 0 ? '+' : '−'}${count(Math.abs(delta))}`,
          }),
    tone: 'ink',
    metaTone: delta > 0 ? 'ok' : delta < 0 ? 'warn' : 'dim',
  }
}

function availableParts(
  data: DashboardData,
  parts: PartsSummary | null,
  t: T,
  { count }: Numbers,
): Kpi | null {
  const reserved = parts?.reserved ?? null
  return {
    label: t('availableStock'),
    value: count(data.availablePartsCount),
    unit: t('unitItems'),
    meta:
      reserved === null
        ? t('itemsForSale')
        : t('reserved', { count: count(reserved) }),
    tone: 'ink',
    metaTone: 'dim',
  }
}
