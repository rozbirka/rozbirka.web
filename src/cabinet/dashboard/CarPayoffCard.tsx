import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import type { CarListItem } from '@/api/cars'
import { useFormat, useT } from '@/i18n'
import { CardEmpty, CardLink, CardRow, DashboardCard } from './dashboard-card'
import { dashboardMoneyMessages } from './money-messages'
const MS_PER_DAY = 86_400_000

const daysSince = (iso: string, now: Date): number | null => {
  const since = new Date(iso)
  if (Number.isNaN(since.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / MS_PER_DAY))
}

/**
 * Where every car on the yard stands against its own money. The bar is capped
 * at full: a car that has more than paid for itself reads as done rather than
 * as an overflowing track, and the percentage beside it keeps the real figure.
 */
export function CarPayoffCard({
  accountingCurrency = null,
  base,
  cars,
  now,
  total,
}: {
  /** What invested/recouped are counted in; `null` when unknown. */
  accountingCurrency?: string | null
  /** The cars module's own path, for the row links and the "all N" link. */
  base: string
  cars: readonly CarListItem[]
  now: Date
  total: number
}) {
  const t = useT(dashboardMoneyMessages)
  return (
    <DashboardCard
      aside={<CardLink to={base}>{t('allCount', { count: total })}</CardLink>}
      title={t('carPayoff')}
    >
      {cars.length === 0 ? (
        <CardEmpty>{t('noActiveCars')}</CardEmpty>
      ) : (
        cars.map((car) => (
          <PayoffRow
            accountingCurrency={accountingCurrency}
            base={base}
            car={car}
            key={car.id}
            now={now}
          />
        ))
      )}
    </DashboardCard>
  )
}

function PayoffRow({
  accountingCurrency,
  base,
  car,
  now,
}: {
  accountingCurrency: string | null
  base: string
  car: CarListItem
  now: Date
}) {
  const t = useT(dashboardMoneyMessages)
  const format = useFormat()
  const sum = (value: number) =>
    format.number(value, { maximumFractionDigits: 0 }) ?? String(value)
  const invested = car.profitability?.invested ?? null
  const recouped = car.profitability?.recouped ?? null
  const percent =
    invested === null || recouped === null || invested <= 0
      ? null
      : Math.round((recouped / invested) * 100)
  const done = percent === null ? 0 : Math.min(percent, 100)
  const days = daysSince(car.acquiredAt, now)

  return (
    <CardRow hover>
      <Link
        className="block outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        to={`${base}/${car.id}`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[15px] font-bold tracking-[-0.01em] text-white">
            {car.brand} {car.model} {car.year}
          </span>
          <span
            className={cn(
              'font-mono text-[14px] font-medium tabular-nums',
              percent === null
                ? 'text-app-dim'
                : percent >= 100
                  ? 'text-state-ok'
                  : percent >= 60
                    ? 'text-app-ink'
                    : 'text-state-warn',
            )}
          >
            {percent == null ? '—' : `${String(percent)}%`}
          </span>
        </span>
        <span aria-hidden className="mt-2.5 flex gap-0.5">
          <span
            className={cn(
              'h-[5px] rounded-l-full',
              percent !== null && percent >= 100
                ? 'bg-state-ok'
                : percent !== null && percent >= 60
                  ? 'bg-white/35'
                  : 'bg-state-warn',
            )}
            style={{ flex: done || 1 }}
          />
          <span
            className="bg-app-line h-[5px] rounded-r-full"
            style={{ flex: 100 - done }}
          />
        </span>
        <span className="text-app-dim mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-[12px]">
          <span className="min-w-0 truncate">
            {car.code} ·{' '}
            {t('soldOf', { sold: car.soldPartsCount, total: car.partsCount })}
            {days === null ? '' : ` · ${t('daysShort', { count: days })}`}
          </span>
          {invested === null || recouped === null ? null : (
            <span className="whitespace-nowrap tabular-nums">
              {sum(recouped)} / {sum(invested)}
              {accountingCurrency === null ? '' : ` ${accountingCurrency}`}
            </span>
          )}
        </span>
      </Link>
    </CardRow>
  )
}
