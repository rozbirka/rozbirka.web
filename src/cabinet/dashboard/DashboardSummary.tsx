import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/app'
import type { DashboardData, LastActivity } from '@/api/dashboard-contract'

const CAR_CURRENCY = 'USD'
const numberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})
const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Kyiv',
})
const activityDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})

export function DashboardSummary({
  cashBalances,
  data,
  partsPath,
}: {
  cashBalances?: Record<string, number> | undefined
  data: DashboardData
  partsPath?: string | undefined
}) {
  const recoupment = getRecoupment(data.totalInvested, data.totalRecouped)
  const date = latestActivityDate(data)

  return (
    <section aria-label="Зведення" className="dashboard-overview">
      {data.isYardEmpty ? <DashboardEmptyState /> : null}

      <OverviewSection date={date} title="Гроші">
        <Metric label="Виручка">
          {data.revenue?.today.length ? (
            <>
              <div className="dashboard-revenue-values">
                {data.revenue.today.map((entry) => (
                  <MetricValue
                    key={entry.currency}
                    unit={entry.currency}
                    value={entry.amount}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="dashboard-metric-value">
              <strong>—</strong>
            </div>
          )}
          <MetricCaption>{salesCaption(data.todaySalesCount)}</MetricCaption>
        </Metric>
        {cashBalances === undefined && data.totalBalanceUah === null ? null : (
          <Metric label="Баланс кас">
            <div className="dashboard-revenue-values">
              {cashBalances === undefined ? (
                <MetricValue unit="UAH" value={data.totalBalanceUah!} />
              ) : cashBalanceEntries(cashBalances).length === 0 ? (
                <div className="dashboard-metric-value">
                  <strong>—</strong>
                </div>
              ) : (
                cashBalanceEntries(cashBalances).map(([currency, balance]) => (
                  <MetricValue key={currency} unit={currency} value={balance} />
                ))
              )}
            </div>
          </Metric>
        )}
        {data.totalInvested === null ? null : (
          <Metric label="Інвестовано всього">
            <MetricValue unit={CAR_CURRENCY} value={data.totalInvested} />
            {data.activeCarsCount === null ? null : (
              <MetricCaption>
                {carsCaption(data.activeCarsCount)} · закупка і розбирання
              </MetricCaption>
            )}
          </Metric>
        )}
        {data.totalRecouped === null ? null : (
          <Metric accent="success" label="Повернено всього">
            <MetricValue unit={CAR_CURRENCY} value={data.totalRecouped} />
            {recoupment === null ? null : (
              <>
                <div
                  aria-label={`Окупність складу ${recoupment.percent}%`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={recoupment.percent}
                  className="dashboard-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${recoupment.percent}%` }} />
                </div>
                <MetricCaption>
                  <span>Окупність складу {recoupment.percent}%</span>
                  <span> · </span>
                  <span>
                    лишилось {formatNumber(recoupment.remaining)} {CAR_CURRENCY}
                  </span>
                </MetricCaption>
              </>
            )}
          </Metric>
        )}
      </OverviewSection>

      <OverviewSection
        action={
          partsPath === undefined ? null : (
            <Link className="dashboard-section-link" to={partsPath}>
              Усі запчастини
            </Link>
          )
        }
        title="Склад"
      >
        <Metric label="Доступних запчастин">
          <MetricValue unit="шт" value={data.availablePartsCount} />
        </Metric>
        {data.totalPartsSold === null ? null : (
          <Metric label="Продано всього">
            <MetricValue unit="шт" value={data.totalPartsSold} />
            <MetricCaption>за весь час</MetricCaption>
          </Metric>
        )}
        {data.todayNewPartsCount === null ? null : (
          <Metric label="Нових сьогодні">
            <MetricValue unit="шт" value={data.todayNewPartsCount} />
            <MetricCaption>{intakesCaption(data.intakesCount)}</MetricCaption>
          </Metric>
        )}
        {data.outOfStockPartsCount === null ? null : (
          <Metric accent="warning" label="Немає в наявності">
            <MetricValue unit="шт" value={data.outOfStockPartsCount} />
            <MetricCaption>нульовий залишок</MetricCaption>
          </Metric>
        )}
      </OverviewSection>

      <div className="dashboard-activity-grid">
        <Activity activity={data.lastActivity} title="Остання активність" />
        <Activity
          activity={data.lastMyActivity}
          title="Моя остання активність"
        />
      </div>
    </section>
  )
}

function OverviewSection({
  action,
  children,
  date,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  date?: string | null
  title: string
}) {
  return (
    <section className="dashboard-overview-section">
      <header className="dashboard-section-heading">
        <h2>{title}</h2>
        <span className="dashboard-section-rule" />
        {date ? <time>{date}</time> : null}
        {action}
      </header>
      <div className="dashboard-metric-grid">{children}</div>
    </section>
  )
}

function Metric({
  accent,
  children,
  label,
}: {
  accent?: 'success' | 'warning'
  children: ReactNode
  label: string
}) {
  return (
    <article className="dashboard-metric" data-accent={accent}>
      <h3>{label}</h3>
      {children}
    </article>
  )
}

function MetricValue({ unit, value }: { unit: string; value: number }) {
  return (
    <div className="dashboard-metric-value">
      <strong>{formatNumber(value)}</strong>
      <span>{unit}</span>
    </div>
  )
}

function MetricCaption({ children }: { children: ReactNode }) {
  return <p className="dashboard-metric-caption">{children}</p>
}

function DashboardEmptyState() {
  return (
    <EmptyState
      description="Додайте перше авто або запчастину, щоб побачити робоче зведення."
      title="Почніть наповнювати розбірку"
    />
  )
}

function Activity({
  activity,
  title,
}: {
  activity: LastActivity | null
  title: string
}) {
  if (activity === null) return null

  return (
    <section aria-label={title} className="dashboard-activity-card">
      <h2>{title}</h2>
      <p>
        {activity.type} · {activity.userName} ·{' '}
        {formatActivityDate(activity.timestamp)}
      </p>
    </section>
  )
}

function getRecoupment(invested: number | null, recouped: number | null) {
  if (invested === null || recouped === null || invested <= 0) return null
  const percent = Math.min(
    100,
    Math.max(0, Math.round((recouped / invested) * 100)),
  )
  return { percent, remaining: Math.max(0, invested - recouped) }
}

function latestActivityDate(data: DashboardData): string | null {
  const dates = [data.lastActivity?.timestamp, data.lastMyActivity?.timestamp]
    .filter((value): value is string => value !== undefined)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.valueOf()))
  const date =
    dates.length === 0 ? new Date() : new Date(Math.max(...dates.map(Number)))
  return dateFormatter.format(date)
}

function salesCaption(value: number): string {
  return `${formatNumber(value)} ${plural(value, ['замовлення', 'замовлення', 'замовлень'])}`
}

function carsCaption(value: number): string {
  return `${formatNumber(value)} ${plural(value, ['автомобіль', 'автомобілі', 'автомобілів'])}`
}

function intakesCaption(value: number): string {
  return `${formatNumber(value)} ${plural(value, ['приймання', 'приймання', 'приймань'])}`
}

function plural(value: number, forms: [string, string, string]): string {
  const integer = Math.abs(Math.trunc(value))
  const lastTwo = integer % 100
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2]
  const last = integer % 10
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}

function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

function formatActivityDate(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.valueOf()) ? '—' : activityDateFormatter.format(date)
}

function cashBalanceEntries(
  balances: Record<string, number>,
): [string, number][] {
  const priority: Record<string, number> = { USD: 0, UAH: 1, EUR: 2 }
  return Object.entries(balances).sort(
    ([left], [right]) =>
      (priority[left] ?? 10) - (priority[right] ?? 10) ||
      left.localeCompare(right),
  )
}
