import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { RefreshCw, Search } from 'lucide-react'
import { Button, Skeleton } from '@/components/app'
import { cn } from '@/lib/utils'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { commandPaletteHint, openCommandPalette } from '../command-palette-open'
import { cabinetModules, type CabinetModuleKey } from '../module-registry'
import { evaluateModuleAccess } from '../policy'
import { ActivityCard } from './ActivityCard'
import { CarPayoffCard } from './CarPayoffCard'
import { DashboardBillingBanner } from './DashboardBillingBanner'
import { DashboardErrorState } from './DashboardErrorState'
import { DashboardKpis } from './DashboardKpis'
import { RecentOrdersCard } from './RecentOrdersCard'
import { RevenueChart } from './RevenueChart'
import { TillsCard } from './TillsCard'
import { TopSalesCard } from './TopSalesCard'
import { readDashboardPeriod, writeDashboardPeriod } from './dashboard-period'
import { useDashboardData } from './use-dashboard-data'
import { getDashboardBillingPath } from './dashboard-billing-access'
import {
  useCashRegisters,
  usePartsSummary,
  usePayoffCars,
  useRecentOrders,
} from './use-dashboard-panels'
import type { DashboardPeriod } from '@/api/dashboard-contract'

/** How many rows each list card carries before it defers to its own screen. */
const CARS_SHOWN = 5
const ORDERS_SHOWN = 5

const PERIOD_LABELS: Readonly<Record<DashboardPeriod, string>> = {
  day: 'День',
  week: 'Тиждень',
  month: 'Місяць',
}

const dayName = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Kyiv',
})

export function DashboardScreen() {
  const { targetTenant, snapshot } = useCabinet()
  const [searchParams, setSearchParams] = useSearchParams()
  const selection = readDashboardPeriod(searchParams)
  const dashboard = useDashboardData(selection.period)
  const now = useMemo(() => new Date(), [])

  useEffect(() => {
    if (!selection.normalize) return
    setSearchParams(writeDashboardPeriod(searchParams, selection.period), {
      replace: true,
    })
  }, [searchParams, selection, setSearchParams])

  const allowed = useMemo(() => {
    const modules = new Set<CabinetModuleKey>()
    if (snapshot === null) return modules
    const access = { status: 'ready' as const, snapshot, error: null }
    for (const definition of Object.values(cabinetModules))
      if (evaluateModuleAccess(definition, access, 'view').kind === 'allowed')
        modules.add(definition.key)
    return modules
  }, [snapshot])

  const slug = targetTenant?.slug ?? null
  const path = (module: CabinetModuleKey) =>
    slug !== null && allowed.has(module) ? cabinetPath(slug, module) : null

  const cars = usePayoffCars(allowed.has('cars'), CARS_SHOWN)
  const orders = useRecentOrders(allowed.has('orders'), ORDERS_SHOWN)
  const registers = useCashRegisters(
    allowed.has('cash') && snapshot?.permissions.has('finance.view') === true,
  )
  const parts = usePartsSummary(allowed.has('parts'))

  const summary =
    dashboard.summary.status === 'ready' ? dashboard.summary.data : null
  const analytics =
    dashboard.analytics.status === 'ready' ? dashboard.analytics.data : null

  const billingPath =
    snapshot !== null && targetTenant !== null
      ? getDashboardBillingPath(snapshot, targetTenant)
      : null
  const ordersPath = path('orders')
  const partsPath = path('parts')
  const cashPath = path('cash')
  const periodLabel = PERIOD_LABELS[selection.period]

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <p
          aria-label="Розбірка і розділ"
          className="text-app-dim flex items-center gap-2.5 font-mono text-[11px] tracking-[0.14em] whitespace-nowrap uppercase"
        >
          <span>{targetTenant?.name ?? 'Розбірка'}</span>
          <span aria-hidden className="text-white/20">
            ·
          </span>
          <span className="text-app-muted">Головна</span>
        </p>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
          <button
            className="border-app-line text-app-dim hover:text-app-muted bg-app-raised flex h-10 min-w-0 flex-1 items-center sm:max-w-[340px] gap-2.5 rounded-[10px] border px-3.5 text-left text-[14px] transition-colors hover:bg-white/[0.04]"
            onClick={() => openCommandPalette()}
            type="button"
          >
            <Search aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              Деталь, OEM, номер авто, клієнт
            </span>
            <kbd className="border-app-line-2 hidden shrink-0 rounded-[5px] border px-1.5 py-0.5 font-mono text-[11px] sm:block">
              {commandPaletteHint()}
            </kbd>
          </button>
          <Button
            aria-busy={dashboard.refreshing}
            aria-label={
              dashboard.refreshing ? 'Оновлюємо дані' : 'Оновити дані'
            }
            className="min-w-11 px-0"
            disabled={dashboard.refreshing}
            onClick={() => void dashboard.refresh()}
          >
            <RefreshCw aria-hidden />
          </Button>
          {ordersPath === null ? null : (
            <Button
              asChild
              className="px-5 text-sm font-bold"
              variant="primary"
            >
              <Link to={`${ordersPath}/new`}>Нове замовлення</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1320px] gap-3.5 px-4 pt-9 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[34px] leading-none font-extrabold tracking-[-0.03em] text-balance text-white sm:text-[46px]">
              {greeting(now)}
              {summary === null ? '' : `, ${summary.userName}`}
            </h1>
            <p className="text-app-muted mt-3 text-[15px]">
              {capitalize(dayName.format(now))}
              {dashboard.refreshing ? ' · оновлюємо…' : ''}
            </p>
          </div>
          <PeriodSwitch
            onPeriodChange={(period) => {
              setSearchParams(writeDashboardPeriod(searchParams, period), {
                replace: false,
              })
            }}
            period={selection.period}
          />
        </div>

        {snapshot !== null && targetTenant !== null ? (
          <DashboardBillingBanner snapshot={snapshot} tenant={targetTenant} />
        ) : null}

        <div
          aria-busy={dashboard.refreshing}
          aria-label="Панель зведення"
          className="grid min-w-0 gap-3.5"
          role="region"
        >
          {dashboard.summary.status === 'error' ? (
            <DashboardErrorState
              ariaLabel="Зведення"
              billingPath={billingPath}
              genericMessage="Не вдалося завантажити зведення."
              problem={dashboard.summary.error}
              retry={() => dashboard.retrySummary()}
            />
          ) : null}
          {dashboard.analytics.status === 'error' ? (
            <DashboardErrorState
              ariaLabel="Аналітика"
              billingPath={billingPath}
              genericMessage="Не вдалося завантажити аналітику."
              problem={dashboard.analytics.error}
              retry={() => dashboard.retryAnalytics()}
            />
          ) : null}
          {summary === null && dashboard.summary.status === 'loading' ? (
            <div aria-label="Завантаження зведення" role="status">
              <Skeleton className="h-[220px] rounded-[20px]" />
            </div>
          ) : null}

          {/* The board flows rather than lines up in rows. Paired rows only
              look right when both halves happen to be the same height, and
              here they never are: a yard with one task, or without the cash
              module, left a hole the size of the card beside it. In a column
              flow every card follows the one above it in its own column, so
              the board closes up whatever this account is allowed to see. */}
          <div className="gap-x-3.5 xl:columns-2 [&>*]:mb-3.5 [&>*]:break-inside-avoid">
            {summary === null ? null : (
              <DashboardKpis
                analytics={analytics}
                data={summary}
                parts={parts}
              />
            )}
            {analytics === null ? null : (
              <RevenueChart data={analytics} periodLabel={periodLabel} />
            )}
            {cars === null || slug === null ? null : (
              <CarPayoffCard
                base={cabinetPath(slug, 'cars')}
                cars={cars.items}
                now={now}
                total={cars.total}
              />
            )}
            {orders === null || ordersPath === null ? null : (
              <RecentOrdersCard base={ordersPath} orders={orders} />
            )}
            {registers === null || cashPath === null ? null : (
              <TillsCard base={cashPath} registers={registers} />
            )}
            {analytics === null ? null : (
              <TopSalesCard
                partsPath={partsPath}
                periodLabel={periodLabel}
                topPart={analytics.topPart}
              />
            )}
            {summary === null ? null : (
              <ActivityCard
                lastActivity={summary.lastActivity}
                lastMyActivity={summary.lastMyActivity}
              />
            )}
          </div>
        </div>
      </div>
    </div>
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
  return (
    <div
      aria-label="Період аналітики"
      className="border-app-line bg-app-raised flex shrink-0 gap-0.5 rounded-[11px] border p-[3px]"
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0
        if (step === 0) return
        const options = [...event.currentTarget.querySelectorAll('button')]
        const current = options.indexOf(
          document.activeElement as HTMLButtonElement,
        )
        if (current === -1) return
        event.preventDefault()
        options[(current + step + options.length) % options.length]?.focus()
      }}
      role="group"
    >
      {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((value) => (
        <button
          aria-pressed={period === value}
          className={cn(
            'relative h-[34px] rounded-[8px] px-3.5 text-[14px] font-semibold transition-colors outline-none after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[""] focus-visible:ring-2 focus-visible:ring-white/40',
            period === value
              ? 'bg-white/10 text-white'
              : 'text-app-muted hover:bg-white/[0.04]',
          )}
          key={value}
          onClick={() => onPeriodChange(value)}
          type="button"
        >
          {PERIOD_LABELS[value]}
        </button>
      ))}
    </div>
  )
}

/** The hour the yard opens is the hour this greeting has to get right. */
function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat('uk-UA', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Europe/Kyiv',
    }).format(now),
  )
  if (hour < 5) return 'Доброї ночі'
  if (hour < 12) return 'Добрий ранок'
  if (hour < 18) return 'Добрий день'
  return 'Добрий вечір'
}

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)
