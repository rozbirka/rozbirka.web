import { cn } from '@/lib/utils'
import type { DashboardAnalytics } from '@/api/dashboard-contract'
import { useLocale, useT } from '@/i18n'
import { byCatalog } from '../currency/catalog-order'
import { wholeMoney } from '../currency/money'
import { dashboardMoneyMessages } from './money-messages'

/**
 * The period's actual cash receipts, one bar per bucket, the latest in the
 * yard's accent. Receipts stay per currency: the totals are listed side by
 * side, never added, and the bars carry the one currency the server says the
 * series is in (or the only currency received) — never a «preferred» guess.
 */
export function RevenueChart({
  data,
  periodLabel,
}: {
  data: DashboardAnalytics
  /** What the range is called in the title: «Тиждень», «Місяць». */
  periodLabel: string
}) {
  const t = useT(dashboardMoneyMessages)
  const { locale } = useLocale()
  const { series, totals } = data.revenue
  const received = Object.entries(totals)
    .filter(([, amount]) => amount !== 0)
    .sort(([left], [right]) => byCatalog(left, right))
  const currency = seriesCurrency(data, received)
  const max = Math.max(...series, 0)
  const days = series.length
  const total = currency === null ? null : (totals[currency] ?? 0)
  const average = total === null || days === 0 ? null : total / days
  const first = data.labels[0] ?? ''
  const last = data.labels.at(-1) ?? ''
  const money = (amount: number, code: string | null) =>
    wholeMoney(amount, code, locale)

  // Bars follow the design system's chart: every bucket in the brand's soft
  // fill under a 2px brand edge, its amount above it and its label under it;
  // an empty bucket stays a hairline in the hover fill. A month is too dense
  // to label each bar, so it keeps only the first and last label. Tokens only.
  const labelled = days <= LABELLED_BARS
  return (
    <section aria-label={t('receipts')} className="rz-card">
      <header className="rz-card__head">
        <h2 className="rz-h-card">{t('period', { period: periodLabel })}</h2>
        {average === null || currency === null ? null : (
          <span className="rz-muted text-caption">
            {t('perDay', { amount: money(average, currency) })}
          </span>
        )}
      </header>
      <div className="rz-card__body grid gap-4">
        {received.length === 0 ? null : (
          <ul
            aria-label={t('byCurrency')}
            className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0"
          >
            {received.map(([code, amount]) => (
              <li
                className="rz-mono rz-strong text-title font-medium"
                key={code}
              >
                {money(amount, code)}
              </li>
            ))}
          </ul>
        )}
        {days === 0 ? (
          <p className="rz-dim m-0">{t('noReceipts')}</p>
        ) : (
          <div className="grid gap-1.5">
            <div
              className={cn(
                'flex h-[160px] items-end',
                days > 14 ? 'gap-0.5' : 'gap-2.5',
              )}
            >
              {series.map((value, index) => (
                <div
                  className="flex h-full min-w-0 flex-1 flex-col items-stretch justify-end gap-1"
                  key={data.labels[index] ?? index}
                  title={`${data.labels[index] ?? ''} · ${money(value, currency)}`}
                >
                  {labelled && value > 0 ? (
                    <span className="rz-mono rz-dim truncate text-center text-micro">
                      {wholeMoney(value, null, locale)}
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'rounded-t-rz-xs',
                      value === 0
                        ? 'bg-app-hover'
                        : 'bg-brand-soft border-brand border-t-2',
                    )}
                    style={{
                      height: `${String(max === 0 ? 2 : Math.max((value / max) * BAR_MAX, 2))}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            {labelled ? (
              <p
                className={cn(
                  'rz-muted m-0 flex text-caption',
                  days > 14 ? 'gap-0.5' : 'gap-2.5',
                )}
              >
                {series.map((_, index) => (
                  <span
                    className="min-w-0 flex-1 truncate text-center"
                    key={data.labels[index] ?? index}
                  >
                    {data.labels[index] ?? ''}
                  </span>
                ))}
              </p>
            ) : (
              <p className="rz-mono rz-dim m-0 flex justify-between gap-2 text-micro">
                <span>{first}</span>
                <span>{last}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/** Up to a fortnight of buckets each carry their amount and label. */
const LABELLED_BARS = 14
/** The tallest bar's share of the plot, leaving room for its amount above. */
const BAR_MAX = 85

/**
 * The currency the bars are in: the one the server names (pending contract),
 * else the only currency anything was received in. With several currencies
 * and no word from the server the bars stay unlabelled rather than guessed.
 */
function seriesCurrency(
  data: DashboardAnalytics,
  received: readonly (readonly [string, number])[],
): string | null {
  if (data.revenue.seriesCurrency !== undefined)
    return data.revenue.seriesCurrency
  return received.length === 1 ? (received[0]?.[0] ?? null) : null
}
