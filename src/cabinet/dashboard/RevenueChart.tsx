import { cn } from '@/lib/utils'
import type { DashboardAnalytics } from '@/api/dashboard-contract'

const sum = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

/** Currencies the yard is likeliest to headline, in the order it reads them. */
const PREFERRED = ['USD', 'UAH']

/**
 * The period's takings, one bar a day, today's in the yard's accent. The
 * series is a plain list of numbers: the contract guarantees it lines up with
 * `labels`, which is what the axis underneath and every bar's tooltip use.
 */
export function RevenueChart({
  data,
  periodLabel,
}: {
  data: DashboardAnalytics
  /** What the range is called in the title: «Тиждень», «Місяць». */
  periodLabel: string
}) {
  const { series, totals } = data.revenue
  const currency = headlineCurrency(totals)
  const total = currency === null ? null : (totals[currency] ?? 0)
  const max = Math.max(...series, 0)
  const days = series.length
  const average = total === null || days === 0 ? null : total / days
  const first = data.labels[0] ?? ''
  const last = data.labels.at(-1) ?? ''

  return (
    <section
      aria-label="Виручка за період"
      className="border-app-line bg-app-raised rounded-[20px] border px-6 py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] whitespace-nowrap text-white">
          Виручка · {periodLabel}
        </h2>
        {total === null || currency === null ? null : (
          <p className="flex items-baseline gap-2">
            <span className="font-mono text-[17px] font-medium text-white tabular-nums">
              {sum.format(total)} {currency}
            </span>
            {average === null ? null : (
              <span className="text-app-muted text-[13px]">
                сер. {sum.format(average)} {currency}/день
              </span>
            )}
          </p>
        )}
      </div>
      {days === 0 ? (
        <p className="text-app-dim mt-5 text-[13px]">
          За обраний період продажів не було.
        </p>
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
                title={`${data.labels[index] ?? ''} · ${sum.format(value)}${currency === null ? '' : ` ${currency}`}`}
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
 * The series carries no currency of its own, only the totals do. A yard that
 * takes both dollars and hryvnia gets the one it trades cars in; the bars are
 * then labelled with it rather than left unsaid.
 */
function headlineCurrency(totals: Record<string, number>): string | null {
  const codes = Object.keys(totals)
  if (codes.length === 0) return null
  for (const preferred of PREFERRED)
    if (codes.includes(preferred)) return preferred
  return codes.sort()[0] ?? null
}
