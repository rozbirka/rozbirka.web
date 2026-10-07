import { cn, plural } from '@/lib/utils'
import type {
  DashboardAnalytics,
  DashboardData,
} from '@/api/dashboard-contract'
import type { PartsSummary } from '@/api/parts'
import { useT } from '@/i18n'
import { dashboardMoneyMessages } from './money-messages'

const count = new Intl.NumberFormat('uk-UA')
const sum = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

type Tone = 'ink' | 'ok' | 'warn' | 'danger' | 'dim'

const VALUE_TONE: Record<Tone, string> = {
  ink: 'text-white',
  ok: 'text-state-ok',
  warn: 'text-state-warn',
  danger: 'text-state-danger',
  dim: 'text-app-muted',
}

const META_TONE: Record<Tone, string> = {
  ink: 'text-app-muted',
  ok: 'text-state-ok',
  warn: 'text-state-warn',
  danger: 'text-state-danger',
  dim: 'text-app-dim',
}

interface Kpi {
  label: string
  value: string
  /** What the figure is counted in, set beside it: `USD`, `%`, `поз.` */
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
  const tiles = [
    receiptsToday(data, t('receiptsToday')),
    stockPayoff(data, accountingCurrency),
    activeOrders(analytics),
    availableParts(data, parts),
  ].filter((tile): tile is Kpi => tile !== null)

  if (tiles.length === 0) return null

  return (
    <dl
      aria-label="Показники"
      className={cn(
        'border-app-line bg-app-line grid grid-cols-1 gap-px overflow-hidden rounded-[20px] border',
        tiles.length === 1
          ? 'sm:grid-cols-1'
          : tiles.length === 3
            ? 'sm:grid-cols-3'
            : 'sm:grid-cols-2',
      )}
    >
      {tiles.map((tile) => (
        <div
          className="bg-app-raised px-[22px] pt-5 pb-[22px]"
          key={tile.label}
        >
          <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
            {tile.label}
          </dt>
          <dd>
            <span className="mt-3 flex items-baseline gap-2">
              <span
                className={cn(
                  'text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums',
                  VALUE_TONE[tile.tone],
                )}
              >
                {tile.value}
              </span>
              {tile.unit === '' ? null : (
                <span className="text-app-muted font-mono text-[13px] font-medium">
                  {tile.unit}
                </span>
              )}
            </span>
            <span
              className={cn('mt-3 block text-[13px]', META_TONE[tile.metaTone])}
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
function receiptsToday(data: DashboardData, label: string): Kpi | null {
  const [entry, ...others] = data.revenue?.today ?? []
  if (entry === undefined) return null
  const sales = data.todaySalesCount
  return {
    label,
    value: sum.format(entry.amount),
    unit: entry.currency,
    meta: [
      ...others.map(
        (other) => `+ ${sum.format(other.amount)} ${other.currency}`,
      ),
      `${count.format(sales)} ${plural(sales, ['продаж', 'продажі', 'продажів'])}`,
    ].join(' · '),
    tone: 'ink',
    metaTone: 'ink',
  }
}

/** What the yard has earned back against everything it has put into cars. */
function stockPayoff(
  data: DashboardData,
  accountingCurrency: string | null,
): Kpi | null {
  const { totalRecouped: recouped, totalInvested: invested } = data
  if (recouped === null || invested === null || invested <= 0) return null
  const percent = Math.round((recouped / invested) * 100)
  return {
    label: 'Окупність складу',
    value: String(percent),
    unit: '%',
    meta: `${sum.format(recouped)} з ${sum.format(invested)}${accountingCurrency === null ? '' : ` ${accountingCurrency}`}`,
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
function activeOrders(analytics: DashboardAnalytics | null): Kpi | null {
  if (analytics === null) return null
  const { total, delta } = analytics.activeOrders
  return {
    label: 'Активні замовлення',
    value: count.format(total),
    unit: '',
    meta:
      delta === 0
        ? 'без змін за період'
        : `${delta > 0 ? '+' : '−'}${count.format(Math.abs(delta))} за період`,
    tone: 'ink',
    metaTone: delta > 0 ? 'ok' : delta < 0 ? 'warn' : 'dim',
  }
}

function availableParts(
  data: DashboardData,
  parts: PartsSummary | null,
): Kpi | null {
  const reserved = parts?.reserved ?? null
  return {
    label: 'Доступно на складі',
    value: count.format(data.availablePartsCount),
    unit: 'поз.',
    meta:
      reserved === null
        ? 'позицій у продажу'
        : `${count.format(reserved)} у резерві`,
    tone: 'ink',
    metaTone: 'dim',
  }
}
