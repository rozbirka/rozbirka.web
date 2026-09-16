import type { KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { Amount, Panel, Skeleton } from '@/components/app'
import { cn } from '@/lib/utils'
import type {
  DashboardAnalytics as DashboardAnalyticsData,
  DashboardPeriod,
} from '@/api/dashboard-contract'
import type { DashboardLoadable } from './use-dashboard-data'
import { DashboardErrorState } from './DashboardErrorState'

const periodLabels: Readonly<Record<DashboardPeriod, string>> = {
  day: 'Сьогодні',
  week: 'Тиждень',
  month: 'Місяць',
}

const comparisonLabels: Readonly<Record<DashboardPeriod, string>> = {
  day: 'порівняння з вчора',
  week: 'порівняння з минулим тижнем',
  month: 'порівняння з минулим місяцем',
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
  partsPath?: string | null
  showPeriodSwitch?: boolean
}

export function DashboardAnalytics({
  loadable,
  period,
  onPeriodChange,
  retry,
  billingPath = null,
  partsPath = null,
  showPeriodSwitch = true,
}: DashboardAnalyticsProps) {
  return (
    <section aria-label="Аналітика" className="dashboard-analytics">
      <header className="dashboard-section-heading">
        <h2>Аналітика</h2>
        <span className="dashboard-section-rule" />
      </header>
      <div className="dashboard-analytics-toolbar">
        <p>{comparisonLabels[period]}</p>
        {showPeriodSwitch ? (
          <DashboardPeriodSwitch
            onPeriodChange={onPeriodChange}
            period={period}
          />
        ) : null}
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

export function DashboardPeriodSwitch({
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
      className="dashboard-period-switch"
      onKeyDown={moveFocus}
      role="group"
    >
      {(Object.keys(periodLabels) as DashboardPeriod[]).map((value) => (
        <button
          aria-pressed={period === value}
          className="min-h-11"
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
  return (
    <div className="dashboard-analytics-grid">
      <RevenueCard data={data} />
      <CounterCard
        delta={data.partsSold.delta}
        labels={data.labels}
        series={data.partsSold.series}
        title="Продано запчастин"
        total={data.partsSold.total}
        unit="шт"
      />
      <CounterCard
        delta={data.activeOrders.delta}
        labels={data.labels}
        series={data.activeOrders.series}
        title="Активні замовлення"
        total={data.activeOrders.total}
      />
      {data.topPart === null ? null : (
        <TopPart
          data={data.topPart}
          labels={data.labels}
          partsPath={partsPath}
        />
      )}
    </div>
  )
}

function RevenueCard({ data }: { data: DashboardAnalyticsData }) {
  const totals = Object.entries(data.revenue.totals)
  return (
    <article aria-label="Виручка" className="dashboard-analytics-card">
      <CardHeader delta={data.revenue.trendPercent} title="Виручка" />
      <div className="dashboard-analytics-values">
        {totals.length === 0 ? (
          <strong>—</strong>
        ) : (
          totals.map(([currency, total]) => (
            <Amount currency={currency} key={currency} value={total} />
          ))
        )}
      </div>
      <LineChart labels={data.labels} series={data.revenue.series} />
    </article>
  )
}

function CounterCard({
  delta,
  labels,
  series,
  title,
  total,
  unit,
}: {
  delta: number
  labels: string[]
  series: number[]
  title: string
  total: number
  unit?: string
}) {
  return (
    <article aria-label={title} className="dashboard-analytics-card">
      <CardHeader delta={delta} title={title} />
      <div className="dashboard-analytics-total">
        <strong>{numberFormatter.format(total)}</strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      <LineChart labels={labels} series={series} />
    </article>
  )
}

function CardHeader({ delta, title }: { delta: number; title: string }) {
  return (
    <header>
      <h3>{title}</h3>
      <Delta value={delta} />
    </header>
  )
}

function TopPart({
  data,
  labels,
  partsPath,
}: {
  data: NonNullable<DashboardAnalyticsData['topPart']>
  labels: string[]
  partsPath: string | null
}) {
  const content = (
    <>
      <div className="dashboard-top-part-media">
        {data.photoUrl ? <img alt="" src={data.photoUrl} /> : <span>Фото</span>}
      </div>
      <div className="dashboard-top-part-copy">
        <strong>{data.name}</strong>
        <p>Найкраща за обраний період</p>
      </div>
    </>
  )

  return (
    <article
      aria-label="Найкраща запчастина"
      className="dashboard-analytics-card dashboard-top-part"
    >
      <header>
        <h3>Найкраща запчастина</h3>
        {partsPath ? (
          <Link to={`${partsPath}/${encodeURIComponent(data.id)}`}>Картка</Link>
        ) : null}
      </header>
      <div className="dashboard-top-part-info">{content}</div>
      <div className="dashboard-top-part-stats">
        <p>
          <Amount currency="USD" value={data.revenueUsd} />
          <span>виручка</span>
        </p>
        <p>
          <strong>{numberFormatter.format(data.salesCount)}</strong>
          <span>продажів</span>
        </p>
      </div>
      <LineChart labels={labels} series={data.salesSeries} />
    </article>
  )
}

function Delta({ value }: { value: number }) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const figure = `${sign}${numberFormatter.format(Math.abs(value))}${value === 0 ? '' : '%'} `
  const wording =
    value > 0
      ? 'більше, ніж у попередній період'
      : value < 0
        ? 'менше, ніж у попередній період'
        : 'без змін проти попереднього періоду'

  return (
    <p
      className={cn(
        'dashboard-analytics-delta',
        value > 0 && 'text-state-ok',
        value < 0 && 'text-state-danger',
        value === 0 && 'text-app-muted',
      )}
    >
      {figure.trim()}
      <span className="sr-only"> {wording}</span>
    </p>
  )
}

function LineChart({ series, labels }: { series: number[]; labels: string[] }) {
  const values = series.length > 0 ? series : [0, 0]
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 150 : (index / (values.length - 1)) * 300
    const y = range === 0 ? 36 : 62 - ((value - minimum) / range) * 48
    return [x, y] as const
  })
  const line = points.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `M 0 70 L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L 300 70 Z`

  return (
    <div className="dashboard-line-chart">
      <svg
        aria-hidden="true"
        data-testid="analytics-line-chart"
        preserveAspectRatio="none"
        viewBox="0 0 300 72"
      >
        <path d={area} fill="currentColor" opacity="0.12" />
        <polyline
          fill="none"
          points={line}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div aria-hidden="true">
        <span>{labels.at(0) ?? '00:00'}</span>
        <span>{labels.at(-1) ?? '23:00'}</span>
      </div>
    </div>
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
