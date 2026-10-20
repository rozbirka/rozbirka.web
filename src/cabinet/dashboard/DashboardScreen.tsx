import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronRight, RefreshCw, Search } from 'lucide-react'
import { Button, Segmented, Skeleton } from '@/components/app'
import { useFormat, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { commandPaletteHint, openCommandPalette } from '../command-palette-open'
import { moduleLabel } from '../module-messages'
import { cabinetModules, type CabinetModuleKey } from '../module-registry'
import { OnboardingChecklist } from '../onboarding/OnboardingChecklist'
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
import { dashboardMessages } from './dashboard-messages'
import { OrderValueCard } from './OrderValueCard'
import { useAccountingCurrency } from '../currency/use-accounting-currency'
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

const PERIODS = {
  day: 'period.day',
  week: 'period.week',
  month: 'period.month',
} as const satisfies Record<DashboardPeriod, string>

const PERIOD_OPTIONS = Object.keys(PERIODS) as DashboardPeriod[]

/** One placeholder tile per KPI while the summary loads. */
const KPI_SKELETON = ['a', 'b', 'c', 'd'] as const

const DAY_NAME: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}

export function DashboardScreen() {
  const { targetTenant, snapshot } = useCabinet()
  const accounting = useAccountingCurrency()
  const [searchParams, setSearchParams] = useSearchParams()
  const selection = readDashboardPeriod(searchParams)
  const dashboard = useDashboardData(selection.period)
  const now = useMemo(() => new Date(), [])
  const { locale, timeZone } = useLocale()
  const t = useT(dashboardMessages)
  const format = useFormat()

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
  const periodLabel = t(PERIODS[selection.period])

  // The board is the design system's record layout: a full-width KPI strip,
  // then a main column and a narrower aside. Each column stacks its own cards,
  // so a card the account may not see closes up instead of leaving a hole
  // beside its neighbour. With nothing in the main column the aside takes the
  // whole width rather than sitting alone in 380px.
  const main = [
    analytics === null ? null : (
      <RevenueChart data={analytics} key="revenue" periodLabel={periodLabel} />
    ),
    orders === null || ordersPath === null ? null : (
      <RecentOrdersCard
        accountingCurrency={accounting.currency}
        base={ordersPath}
        key="orders"
        orders={orders}
      />
    ),
    summary === null ? null : (
      <ActivityCard
        key="activity"
        lastActivity={summary.lastActivity}
        lastMyActivity={summary.lastMyActivity}
      />
    ),
  ].filter((card) => card !== null)
  const aside = [
    summary === null ? null : (
      <OrderValueCard
        analyticsValue={analytics?.confirmedOrdersValue}
        key="order-value"
        period={selection.period}
        periodLabel={periodLabel}
        settingsPath={accounting.owner ? accounting.settingsPath : null}
        status={accounting.status}
        summaryValue={summary.confirmedOrdersValue}
      />
    ),
    analytics === null ? null : (
      <TopSalesCard
        accountingCurrency={accounting.currency}
        key="top-sales"
        partsPath={partsPath}
        periodLabel={periodLabel}
        topPart={analytics.topPart}
      />
    ),
    cars === null || slug === null ? null : (
      <CarPayoffCard
        accountingCurrency={accounting.currency}
        base={cabinetPath(slug, 'cars')}
        cars={cars.items}
        key="cars"
        now={now}
        total={cars.total}
      />
    ),
    registers === null || cashPath === null ? null : (
      <TillsCard base={cashPath} key="tills" registers={registers} />
    ),
  ].filter((card) => card !== null)

  return (
    <div className="grid content-start">
      <header className="rz-topbar min-h-topbar h-auto flex-wrap gap-y-1.5 py-1.5">
        <p aria-label={t('crumbLabel')} className="rz-crumbs m-0">
          <span className="min-w-0 truncate">
            {targetTenant?.name ?? t('businessFallback')}
          </span>
          <ChevronRight aria-hidden className="size-3 shrink-0" />
          <span aria-current="page">{moduleLabel('dashboard', locale)}</span>
        </p>
        <div className="rz-topbar__actions min-w-0 flex-1 flex-wrap items-center justify-end">
          <Button
            className="text-app-dim min-w-0 flex-1 shrink justify-start sm:w-[300px] sm:flex-none"
            onClick={() => openCommandPalette()}
          >
            <Search aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">
              {t('searchPlaceholder')}
            </span>
            <kbd className="rz-kbd hidden sm:inline-grid">
              {commandPaletteHint()}
            </kbd>
          </Button>
          <Button
            aria-busy={dashboard.refreshing}
            aria-label={dashboard.refreshing ? t('refreshing') : t('refresh')}
            disabled={dashboard.refreshing}
            onClick={() => void dashboard.refresh()}
            size="icon"
          >
            <RefreshCw aria-hidden />
          </Button>
          {ordersPath === null ? null : (
            <Button asChild variant="primary">
              <Link to={`${ordersPath}/new`}>{t('newOrder')}</Link>
            </Button>
          )}
        </div>
      </header>

      {snapshot !== null && targetTenant !== null ? (
        <DashboardBillingBanner snapshot={snapshot} tenant={targetTenant} />
      ) : null}

      <div className="rz-page max-w-[1240px]">
        <div className="rz-page-head items-end justify-between">
          <div className="grid min-w-0 gap-1">
            <h1 className="rz-h-page text-balance">
              {summary === null
                ? t(greeting(now, timeZone))
                : t('greetingNamed', {
                    greeting: t(greeting(now, timeZone)),
                    name: summary.userName,
                  })}
            </h1>
            <p className="rz-muted m-0">
              {capitalize(format.dateWith(now, DAY_NAME) ?? '')}
              {dashboard.refreshing ? ` · ${t('refreshingNote')}` : ''}
            </p>
          </div>
          <Segmented
            as="toggle"
            className="shrink-0"
            label={t('periodGroup')}
            name="dashboard-period"
            onChange={(period) => {
              setSearchParams(writeDashboardPeriod(searchParams, period), {
                replace: false,
              })
            }}
            options={PERIOD_OPTIONS.map((value) => ({
              value,
              label: t(PERIODS[value]),
            }))}
            value={selection.period}
          />
        </div>

        {/* Owner onboarding of a new yard; renders nothing for anyone else. */}
        {snapshot !== null && targetTenant !== null ? (
          <OnboardingChecklist snapshot={snapshot} tenant={targetTenant} />
        ) : null}

        <div
          aria-busy={dashboard.refreshing}
          aria-label={t('summaryPanel')}
          className="grid min-w-0 gap-4"
          role="region"
        >
          {dashboard.summary.status === 'error' ? (
            <DashboardErrorState
              ariaLabel={t('summary')}
              billingPath={billingPath}
              genericMessage={t('summaryError')}
              problem={dashboard.summary.error}
              retry={() => dashboard.retrySummary()}
            />
          ) : null}
          {dashboard.analytics.status === 'error' ? (
            <DashboardErrorState
              ariaLabel={t('analytics')}
              billingPath={billingPath}
              genericMessage={t('analyticsError')}
              problem={dashboard.analytics.error}
              retry={() => dashboard.retryAnalytics()}
            />
          ) : null}
          {summary === null && dashboard.summary.status === 'loading' ? (
            <div
              aria-label={t('summaryLoading')}
              className="grid gap-4"
              role="status"
            >
              <div className="rz-kpis">
                {KPI_SKELETON.map((key) => (
                  <div className="rz-kpi" key={key}>
                    <Skeleton className="w-1/2" />
                    <Skeleton className="h-7 w-2/3" />
                  </div>
                ))}
              </div>
              <div className="rz-card h-[260px]" />
            </div>
          ) : null}

          {summary === null ? null : (
            <DashboardKpis
              accountingCurrency={accounting.currency}
              analytics={analytics}
              data={summary}
              parts={parts}
            />
          )}

          {main.length === 0 && aside.length === 0 ? null : (
            <div className="flex flex-wrap items-start gap-4">
              {main.length === 0 ? null : (
                <div className="grid min-w-0 flex-[1_1_480px] gap-4">
                  {main}
                </div>
              )}
              {aside.length === 0 ? null : (
                <aside
                  className={cn(
                    'grid min-w-0 flex-[1_1_280px] gap-4 empty:hidden',
                    main.length > 0 && 'xl:max-w-[380px]',
                  )}
                >
                  {aside}
                </aside>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The hour the yard opens is the hour this greeting has to get right, so it
 * is read on the business's own clock. The digits come from a fixed tag: they
 * are parsed, never shown.
 */
function greeting(
  now: Date,
  timeZone: string,
): 'greeting.night' | 'greeting.morning' | 'greeting.day' | 'greeting.evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone,
    }).format(now),
  )
  if (hour < 5) return 'greeting.night'
  if (hour < 12) return 'greeting.morning'
  if (hour < 18) return 'greeting.day'
  return 'greeting.evening'
}

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)
