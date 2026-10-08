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

  return (
    <section
      aria-label={t('receipts')}
      className="border-app-line bg-app-raised rounded-[20px] border px-6 py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
          {t('period', { period: periodLabel })}
        </h2>
        {average === null || currency === null ? null : (
          <span className="text-app-muted text-[13px]">
            {t('perDay', { amount: money(average, currency) })}
          </span>
        )}
      </div>
      {received.length === 0 ? null : (
        <ul
          aria-label={t('byCurrency')}
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1"
        >
          {received.map(([code, amount]) => (
            <li
              className="font-mono text-[17px] font-medium text-white tabular-nums"
              key={code}
            >
              {money(amount, code)}
            </li>
          ))}
        </ul>
      )}
      {days === 0 ? (
        <p className="text-app-dim mt-5 text-[13px]">{t('noReceipts')}</p>
      ) : (
        <>
          <div
            className={cn(
              'mt-5 flex h-[132px] items-end',
              days > 14 ? 'gap-[3px]' : 'gap-1.5',
            )}
          >
            {series.map((value, index) => (
              <div
                className={cn(
                  'min-w-0 flex-1 rounded-t-[4px] rounded-b-[1px]',
                  index === series.length - 1
                    ? 'bg-brand'
                    : value === 0
                      ? 'bg-white/[0.06]'
                      : 'bg-white/[0.22]',
                )}
                key={data.labels[index] ?? index}
                style={{
                  height: `${String(max === 0 ? 2 : Math.max((value / max) * 100, 2))}%`,
                }}
                title={`${data.labels[index] ?? ''} · ${money(value, currency)}`}
              />
            ))}
          </div>
          <p className="text-app-dim mt-2.5 flex justify-between gap-2 font-mono text-[11px]">
            <span>{first}</span>
            <span>{last}</span>
          </p>
        </>
      )}
    </section>
  )
}

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
