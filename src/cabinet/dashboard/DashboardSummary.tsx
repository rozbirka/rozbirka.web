import { EmptyState } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type { DashboardData, LastActivity } from '@/api/dashboard-contract'

/**
 * Parts trade in dollars — the analytics contract names the same figure
 * `revenueUsd`; only the till (`totalBalanceUah`) is hryvnia.
 */
const CAR_CURRENCY = 'USD'

const numberFormatter = new Intl.NumberFormat('uk-UA')
const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  })
const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})

interface SummaryItem {
  label: string
  value: string
  /** Sits under the figure: what the figure is counting. */
  meta?: string
  tone?: 'ok' | 'warn'
  /** Drawn under the meta line — the payback bar. */
  bar?: { filled: number; tone: 'ok' } | undefined
}

export function DashboardSummary({ data }: { data: DashboardData }) {
  const money = compact([
    moneyItem('Баланс кас', data.totalBalanceUah, 'UAH'),
    moneyItem('Інвестовано всього', data.totalInvested, CAR_CURRENCY, {
      ...(data.activeCarsCount === null
        ? {}
        : {
            meta: `${numberFormatter.format(data.activeCarsCount)} ${plural(data.activeCarsCount, ['авто', 'авто', 'авто'])} · закупка і розбирання`,
          }),
    }),
    recoupedItem(data),
  ])
  const stock = compact([
    item('Доступних запчастин', data.availablePartsCount, {
      meta: 'на складі',
    }),
    item('Продано всього', data.totalPartsSold, { meta: 'за весь час' }),
    item('Нових сьогодні', data.todayNewPartsCount, {
      meta:
        data.intakesCount > 0
          ? `${numberFormatter.format(data.intakesCount)} ${plural(data.intakesCount, ['приймання', 'приймання', 'приймань'])}`
          : 'приймань ще немає',
    }),
    item('Немає в наявності', data.outOfStockPartsCount, {
      meta: 'нульовий залишок',
      tone: 'warn',
    }),
  ])
  const work = compact([
    revenueItem(data),
    item('Продажів сьогодні', data.todaySalesCount),
    item('Активних авто', data.activeCarsCount),
    item('Авто в роботі', data.carsInWork),
    item('Клієнтів', data.customersCount),
    item('Учасників команди', data.teamMembersCount),
    item('Продано мною сьогодні', data.myPartsToday),
  ])

  return (
    <section aria-label="Зведення" className="grid gap-4">
      {data.isYardEmpty ? <DashboardEmptyState /> : null}
      {money.length > 0 ? (
        <SummaryStrip aside="станом на зараз" items={money} title="Гроші" />
      ) : null}
      {stock.length > 0 ? <SummaryStrip items={stock} title="Склад" /> : null}
      {work.length > 0 ? <SummaryStrip items={work} title="Робота" /> : null}
      <Activity activity={data.lastActivity} title="Остання активність" />
      <Activity activity={data.lastMyActivity} title="Моя остання активність" />
    </section>
  )
}

function DashboardEmptyState() {
  return (
    <EmptyState
      description="Додайте перше авто або запчастину, щоб побачити робоче зведення."
      title="Почніть наповнювати розбірку"
    />
  )
}

/**
 * A row of figures under one rule. The cells share a hairline grid rather than
 * standing as separate boxes, so a strip reads as one measure of the yard.
 */
function SummaryStrip({
  title,
  aside,
  items,
}: {
  title: string
  aside?: string
  items: readonly SummaryItem[]
}) {
  return (
    <section aria-label={title} className="grid gap-4.5">
      <div className="flex items-baseline gap-3.5">
        <h2 className="text-app-muted font-mono text-[11px] tracking-[0.16em] uppercase">
          {title}
        </h2>
        <span aria-hidden className="bg-app-line h-px flex-1" />
        {aside === undefined ? null : (
          <span className="text-app-dim text-[13px]">{aside}</span>
        )}
      </div>
      <dl className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-px overflow-hidden rounded-[20px] border">
        {items.map(({ label, value, meta, tone, bar }) => (
          <div className="bg-app-raised px-6 pt-[22px] pb-6" key={label}>
            <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              {label}
            </dt>
            {/* The bar and the note live inside the value: a definition list
                allows nothing but dt/dd pairs between its terms. */}
            <dd className="mt-3.5">
              <span
                className={cn(
                  'block text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums',
                  tone === 'ok'
                    ? 'text-state-ok'
                    : tone === 'warn'
                      ? 'text-state-warn'
                      : 'text-white',
                )}
              >
                {value}
              </span>
              {bar === undefined ? null : (
                <span className="bg-app-line-2 mt-4 block h-1.5 overflow-hidden rounded-full">
                  <span
                    className="bg-state-ok block h-full rounded-full"
                    style={{ width: `${String(bar.filled)}%` }}
                  />
                </span>
              )}
              {meta === undefined ? null : (
                <span className="text-app-dim mt-3 block text-[13px]">
                  {meta}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
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
    <section
      aria-label={title}
      className="border-app-line rounded-panel bg-app-raised border p-4"
    >
      <h2 className="text-sm font-medium text-white">{title}</h2>
      <p className="text-app-muted mt-2 text-sm">
        {activity.type} · {activity.userName} · {formatDate(activity.timestamp)}
      </p>
    </section>
  )
}

function item(
  label: string,
  value: number | null,
  extra: Omit<SummaryItem, 'label' | 'value'> = {},
): SummaryItem | null {
  return value === null
    ? null
    : { label, value: numberFormatter.format(value), ...extra }
}

function moneyItem(
  label: string,
  value: number | null,
  currency: string,
  extra: Omit<SummaryItem, 'label' | 'value'> = {},
): SummaryItem | null {
  return value === null
    ? null
    : { label, value: currencyFormatter(currency).format(value), ...extra }
}

/**
 * What the yard has earned back against what it put in. The bar is capped at
 * full and the sentence underneath keeps the real numbers, so a yard that has
 * more than paid itself back reads as done rather than as an overflowing bar.
 */
function recoupedItem(data: DashboardData): SummaryItem | null {
  const recouped = data.totalRecouped
  if (recouped === null) return null
  const invested = data.totalInvested
  const base: SummaryItem = {
    label: 'Повернено всього',
    value: currencyFormatter(CAR_CURRENCY).format(recouped),
    tone: 'ok',
  }
  if (invested === null || invested <= 0) return base
  const percent = Math.round((recouped / invested) * 100)
  const left = invested - recouped
  return {
    ...base,
    bar: { filled: Math.min(100, Math.max(0, percent)), tone: 'ok' },
    meta:
      left > 0
        ? `Окупність складу ${String(percent)}% · лишилось ${currencyFormatter(CAR_CURRENCY).format(left)}`
        : `Окупність складу ${String(percent)}% · вкладене повернулося`,
  }
}

/**
 * The server tags today's revenue with its own currency, so take what it sent
 * rather than looking for one code: a yard trading in dollars used to see this
 * figure disappear entirely.
 */
function revenueItem(data: DashboardData): SummaryItem | null {
  const entry = data.revenue?.today[0]
  if (entry === undefined) return null
  return moneyItem('Виручка сьогодні', entry.amount, entry.currency)
}

function compact(items: readonly (SummaryItem | null)[]): SummaryItem[] {
  return items.filter((item): item is SummaryItem => item !== null)
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.valueOf()) ? '—' : dateFormatter.format(date)
}
