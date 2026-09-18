import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from 'react-router'
import { Amount, Panel, Skeleton, Thumbnail } from '@/components/app'
import { cn } from '@/lib/utils'
import { Sparkline, type SparkTone } from './Sparkline'
import type {
  DashboardAnalytics as DashboardAnalyticsData,
  DashboardPeriod,
} from '@/api/dashboard-contract'
import type { DashboardLoadable } from './use-dashboard-data'
import { DashboardErrorState } from './DashboardErrorState'

const periodLabels: Readonly<Record<DashboardPeriod, string>> = {
  day: 'День',
  week: 'Тиждень',
  month: 'Місяць',
}

const numberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 1,
})

interface DashboardAnalyticsProps {
  loadable: DashboardLoadable<DashboardAnalyticsData>
  period: DashboardPeriod
  onPeriodChange: (period: DashboardPeriod) => void
  retry: () => Promise<void>
  billingPath?: string | null
  /** Where the best part's own card lives, when the parts module is open. */
  partsPath?: string | null
}

export function DashboardAnalytics({
  loadable,
  period,
  onPeriodChange,
  retry,
  billingPath = null,
  partsPath = null,
}: DashboardAnalyticsProps) {
  return (
    <section aria-label="Аналітика" className="grid min-w-0 gap-4.5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_240px] items-baseline gap-3.5">
          <h2 className="text-app-muted font-mono text-[11px] tracking-[0.16em] uppercase">
            Аналітика
          </h2>
          <span aria-hidden className="bg-app-line h-px flex-1" />
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <p className="text-app-dim text-[13px]">
            порівняння з попереднім періодом
          </p>
          <PeriodSwitch onPeriodChange={onPeriodChange} period={period} />
        </div>
      </div>
      {loadable.status === 'ready' ? (
        <AnalyticsContent data={loadable.data} partsPath={partsPath} />
      ) : null}
      {loadable.status === 'loading' ? <AnalyticsLoading /> : null}
      {loadable.status === 'error' ? (
        <DashboardErrorState
          ariaLabel="Аналітика"
          billingPath={billingPath}
          genericMessage="Не вдалося завантажити аналітику. Перевірте з’єднання та спробуйте ще раз."
          problem={loadable.error}
          retry={retry}
        />
      ) : null}
    </section>
  )
}

/**
 * An exclusive choice of period. Kept as toggle buttons rather than the kit
 * `Segmented` radios because the shell and browser suites pin `aria-pressed`
 * and Tab reachability of every option; arrow keys move focus here so the
 * group still behaves like one control.
 */
function PeriodSwitch({
  period,
  onPeriodChange,
}: {
  period: DashboardPeriod
  onPeriodChange: (period: DashboardPeriod) => void
}) {
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0) return

    const options = [...event.currentTarget.querySelectorAll('button')]
    const current = options.indexOf(document.activeElement as HTMLButtonElement)
    if (current === -1) return

    event.preventDefault()
    options[(current + step + options.length) % options.length]?.focus()
  }

  return (
    <div
      aria-label="Період аналітики"
      className="bg-app-input border-app-line-2 rounded-control flex min-w-0 flex-wrap gap-1 border p-1"
      onKeyDown={moveFocus}
      role="group"
    >
      {(Object.keys(periodLabels) as DashboardPeriod[]).map((value) => (
        <button
          aria-pressed={period === value}
          className={cn(
            'rounded-control flex min-h-11 flex-1 items-center justify-center px-3 text-[13.5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40',
            period === value
              ? 'bg-white/[0.09] font-medium text-white'
              : 'text-app-muted hover:bg-white/[0.04]',
          )}
          key={value}
          onClick={() => onPeriodChange(value)}
          type="button"
        >
          {periodLabels[value]}
        </button>
      ))}
    </div>
  )
}

function AnalyticsContent({
  data,
  partsPath,
}: {
  data: DashboardAnalyticsData
  partsPath: string | null
}) {
  const totals = Object.entries(data.revenue.totals)
  const first = data.labels[0] ?? ''
  const last = data.labels.at(-1) ?? ''

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AnalyticsCard
        delta={data.revenue.trendPercent}
        deltaSuffix="%"
        first={first}
        label="Виручка"
        last={last}
        series={data.revenue.series}
        tone="ok"
      >
        {totals.length === 0 ? (
          <p className="text-app-muted text-sm">
            За обраний період продажів не було.
          </p>
        ) : (
          totals.map(([currency, total]) => (
            <Figure
              key={currency}
              label={`Виручка, ${currency}`}
              unit={currency}
              value={<Amount currency={null} value={total} />}
            />
          ))
        )}
      </AnalyticsCard>
      <AnalyticsCard
        delta={data.partsSold.delta}
        first={first}
        label="Продано запчастин"
        last={last}
        series={data.partsSold.series}
        tone="info"
      >
        <Figure
          label="Продано запчастин"
          unit="шт"
          value={<Amount currency={null} value={data.partsSold.total} />}
        />
      </AnalyticsCard>
      <AnalyticsCard
        delta={data.activeOrders.delta}
        first={first}
        label="Активні замовлення"
        last={last}
        series={data.activeOrders.series}
        tone="warn"
      >
        <Figure
          label="Активні замовлення"
          value={<Amount currency={null} value={data.activeOrders.total} />}
        />
      </AnalyticsCard>
      {data.topPart === null ? null : (
        <TopPart data={data.topPart} partsPath={partsPath} />
      )}
    </div>
  )
}

/** One measure of the period: its figure, its change, and its shape. */
function AnalyticsCard({
  label,
  delta,
  deltaSuffix = '',
  series,
  tone,
  first,
  last,
  children,
}: {
  label: string
  delta: number
  deltaSuffix?: string
  series: number[]
  tone: SparkTone
  first: string
  last: string
  children: ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="border-app-line bg-app-raised grid content-start rounded-[20px] border px-6 pt-[22px] pb-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
          {label}
        </h3>
        <Delta suffix={deltaSuffix} value={delta} />
      </div>
      <div className="mt-3.5 grid gap-2">{children}</div>
      <Sparkline className="mt-4.5" series={series} tone={tone} />
      <p className="text-app-dim mt-2 flex justify-between gap-2.5 font-mono text-[10px] tracking-[0.1em] uppercase">
        <span>{first}</span>
        <span>{last}</span>
      </p>
    </section>
  )
}

function Figure({
  label,
  value,
  unit,
}: {
  label: string
  value: ReactNode
  unit?: string
}) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="sr-only">{label}</span>
      <span className="text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums text-white">
        {value}
      </span>
      {unit === undefined ? null : (
        <span className="text-app-muted font-mono text-[13px] font-medium">
          {unit}
        </span>
      )}
    </p>
  )
}

function TopPart({
  data,
  partsPath,
}: {
  data: NonNullable<DashboardAnalyticsData['topPart']>
  partsPath: string | null
}) {
  return (
    <section
      aria-label="Найкраща запчастина"
      className="border-app-line bg-app-raised grid content-start rounded-[20px] border px-6 pt-[22px] pb-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
          Найкраща запчастина
        </h3>
        {partsPath === null ? null : (
          <Link
            className="text-brand text-[13px] font-semibold hover:underline"
            to={`${partsPath}/${data.id}`}
          >
            Картка
          </Link>
        )}
      </div>
      <div className="mt-3.5 flex items-center gap-3.5">
        {data.photoUrl === null ? null : (
          <Thumbnail
            alt=""
            className="size-[92px] shrink-0 rounded-[14px]"
            photo={{ url: data.photoUrl, thumbnailUrl: data.photoUrl }}
          />
        )}
        <p className="min-w-0 text-[17px] font-bold tracking-[-0.015em] break-words text-white">
          {data.name}
        </p>
      </div>
      <div className="mt-4 flex items-baseline gap-5">
        <p>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[26px] leading-none font-extrabold tracking-[-0.03em] tabular-nums text-white">
              <Amount currency={null} value={data.revenueUsd} />
            </span>
            <span className="text-app-muted font-mono text-xs">USD</span>
          </span>
          <span className="text-app-dim mt-1.5 block text-xs">виручка</span>
        </p>
        <p>
          <span className="block text-[26px] leading-none font-extrabold tracking-[-0.03em] tabular-nums text-white">
            {data.salesCount}
          </span>
          <span className="text-app-dim mt-1.5 block text-xs">продажів</span>
        </p>
      </div>
      <Sparkline className="mt-4" series={data.salesSeries} tone="brand" />
    </section>
  )
}

/**
 * A change against the previous period. Direction is carried by the sign and
 * by the sentence, so the colour is confirmation and never the only cue.
 */
function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const figure = `${sign}${numberFormatter.format(Math.abs(value))}${suffix}`
  const wording =
    value > 0
      ? 'більше, ніж у попередній період'
      : value < 0
        ? 'менше, ніж у попередній період'
        : '— без змін проти попереднього періоду'

  return (
    <p
      className={cn(
        'text-[13px] font-bold tabular-nums',
        value > 0 && 'text-state-ok',
        value < 0 && 'text-state-danger',
        value === 0 && 'text-app-muted',
      )}
    >
      {figure}
      {/* The sign already carries the direction; the sentence spells it out
          for anyone who cannot see the colour it is drawn in. */}
      <span className="sr-only"> {wording}</span>
    </p>
  )
}

function AnalyticsLoading() {
  return (
    <Panel aria-label="Аналітика" role="status">
      <p className="text-app-muted text-sm">Завантажуємо аналітику…</p>
      <Skeleton className="mt-3 h-6 w-32" />
      <Skeleton className="mt-2 h-20" />
    </Panel>
  )
}
