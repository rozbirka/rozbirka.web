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
  /** Multiple independent figures that belong to the same summary tile. */
  values?: readonly string[]
  /** Sits under the figure: what the figure is counting. */
  meta?: string
  tone?: 'ok' | 'warn'
  /** Drawn under the meta line — the payback bar. */
  bar?: { filled: number; tone: 'ok' } | undefined
}

export function DashboardSummary({
  cashBalances,
  data,
}: {
  /** Per-currency till totals, when the reader may see the money. */
  cashBalances?: Record<string, number> | null
  data: DashboardData
}) {
  const money = compact([
    cashItem(cashBalances, data.totalBalanceUah),
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
        <SummaryStrip
          aside="станом на зараз"
          columns={3}
          items={money}
          title="Гроші"
        />
      ) : null}
      {stock.length > 0 ? <SummaryStrip items={stock} title="Склад" /> : null}
      {work.length > 0 ? (
        <SummaryStrip balanced items={work} title="Робота" />
      ) : null}
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
  balanced = false,
  columns,
  items,
}: {
  title: string
  aside?: string
  balanced?: boolean
  columns?: 3
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
      <dl
        className={cn(
          'bg-app-line border-app-line gap-px overflow-hidden rounded-[20px] border',
          balanced
            ? 'flex flex-wrap'
            : cn(
                'grid',
                columns === 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]',
              ),
        )}
      >
        {items.map(({ label, value, values, meta, tone, bar }) => (
          <div
            className={cn(
              'bg-app-raised px-6 pt-[22px] pb-6',
              balanced && 'min-w-0 grow basis-[260px]',
            )}
            key={label}
          >
            <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              {label}
            </dt>
            {/* The bar and the note live inside the value: a definition list
                allows nothing but dt/dd pairs between its terms. */}
            <dd className="mt-3.5">
              <span className="grid grid-cols-1 gap-3">
                {(values ?? [value]).map((displayValue) => (
                  <span
                    className={cn(
                      'block text-[30px] leading-none font-extrabold tracking-[-0.03em] tabular-nums',
                      tone === 'ok'
                        ? 'text-state-ok'
                        : tone === 'warn'
                          ? 'text-state-warn'
                          : 'text-white',
                    )}
                    key={displayValue}
                  >
                    {displayValue}
                  </span>
                ))}
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

/**
 * Till currencies share one tile but remain separate figures, so the dashboard
 * never invents a converted total. Without the till list its own UAH figure
 * remains as the fallback.
 */
function cashItem(
  balances: Record<string, number> | null | undefined,
  fallbackUah: number | null,
): SummaryItem | null {
  const preferredOrder = ['USD', 'UAH']
  const entries = Object.entries(balances ?? {}).sort(([a], [b]) => {
    const aIndex = preferredOrder.indexOf(a)
    const bIndex = preferredOrder.indexOf(b)
    if (aIndex !== -1 || bIndex !== -1) {
      return (
        (aIndex === -1 ? preferredOrder.length : aIndex) -
        (bIndex === -1 ? preferredOrder.length : bIndex)
      )
    }
    return a.localeCompare(b)
  })
  if (entries.length === 0) return moneyItem('Баланс кас', fallbackUah, 'UAH')
  if (entries.length === 1) {
    const [currency, amount] = entries[0]!
    return moneyItem('Баланс кас', amount, currency)
  }
  const values = entries.map(([currency, amount]) =>
    currencyFormatter(currency).format(amount),
  )
  return { label: 'Баланс кас', value: values[0]!, values }
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
