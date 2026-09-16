import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageBody, Panel, Skeleton } from '@/components/app'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { cabinetModules } from '../module-registry'
import { evaluateModuleAccess } from '../policy'
import { readDashboardPeriod, writeDashboardPeriod } from './dashboard-period'
import { useDashboardData, type DashboardLoadable } from './use-dashboard-data'
import type { DashboardData, DashboardPeriod } from '@/api/dashboard-contract'
import { DashboardAnalytics, DashboardPeriodSwitch } from './DashboardAnalytics'
import { DashboardBillingBanner } from './DashboardBillingBanner'
import { DashboardErrorState } from './DashboardErrorState'
import { DashboardRecentOrders } from './DashboardRecentOrders'
import { DashboardSummary } from './DashboardSummary'
import { getDashboardBillingPath } from './dashboard-billing-access'
import {
  useDashboardExtras,
  type DashboardExtraLoadable,
} from './use-dashboard-extras'
import type { OrderListItem } from '@/api/orders'
import './dashboard-redesign.css'

const updatedAtFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})

export function DashboardScreen() {
  const { targetTenant, snapshot } = useCabinet()
  const [searchParams, setSearchParams] = useSearchParams()
  const selection = readDashboardPeriod(searchParams)
  const dashboard = useDashboardData(selection.period)
  const billingPath =
    snapshot !== null && targetTenant !== null
      ? getDashboardBillingPath(snapshot, targetTenant)
      : null
  const destinations = getHeaderDestinations(snapshot, targetTenant?.slug)
  const extras = useDashboardExtras({
    cashEnabled: destinations.cashEnabled,
    ordersEnabled: destinations.ordersPath !== null,
  })

  useEffect(() => {
    if (!selection.normalize) return
    setSearchParams(writeDashboardPeriod(searchParams, selection.period), {
      replace: true,
    })
  }, [searchParams, selection, setSearchParams])

  const selectPeriod = (period: DashboardPeriod) => {
    setSearchParams(writeDashboardPeriod(searchParams, period), {
      replace: false,
    })
  }

  return (
    <PageBody className="dashboard-page type-redesign">
      <header className="dashboard-topbar">
        <p>Склад · Головна</p>
        <nav aria-label="Швидкі дії Dashboard">
          {destinations.scan === null ? null : (
            <Link className="dashboard-action-secondary" to={destinations.scan}>
              Сканувати
            </Link>
          )}
          {destinations.newOrder === null ? null : (
            <Link
              className="dashboard-action-primary"
              to={destinations.newOrder}
            >
              Нове замовлення
            </Link>
          )}
        </nav>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-title-row">
          <div>
            <h1>Зведення</h1>
            <p>{updatedSubtitle(dashboard.summary)}</p>
          </div>
          <DashboardPeriodSwitch
            onPeriodChange={selectPeriod}
            period={selection.period}
          />
        </div>

        <div
          aria-busy={dashboard.refreshing}
          aria-label="Панель зведення"
          className="dashboard-data"
          role="region"
        >
          {snapshot !== null && targetTenant !== null ? (
            <DashboardBillingBanner snapshot={snapshot} tenant={targetTenant} />
          ) : null}
          <DashboardSummaryState
            billingPath={billingPath}
            cashBalances={
              extras.cashBalances.status === 'ready'
                ? extras.cashBalances.data
                : undefined
            }
            loadable={dashboard.summary}
            partsPath={destinations.parts}
            retry={() => dashboard.retrySummary()}
          />
          {destinations.ordersPath === null ? null : (
            <DashboardRecentOrdersState
              loadable={extras.recentOrders}
              ordersPath={destinations.ordersPath}
            />
          )}
          <div className="dashboard-below-fold">
            <DashboardAnalytics
              billingPath={billingPath}
              loadable={dashboard.analytics}
              onPeriodChange={selectPeriod}
              period={selection.period}
              retry={() => dashboard.retryAnalytics()}
              showPeriodSwitch={false}
            />
          </div>
        </div>
      </div>
    </PageBody>
  )
}

function DashboardSummaryState({
  billingPath,
  cashBalances,
  loadable,
  partsPath,
  retry,
}: {
  billingPath: string | null
  cashBalances: Record<string, number> | undefined
  loadable: DashboardLoadable<DashboardData>
  partsPath: string | null
  retry: () => Promise<void>
}) {
  if (loadable.status === 'ready') {
    return (
      <DashboardSummary
        data={loadable.data}
        cashBalances={cashBalances}
        partsPath={partsPath ?? undefined}
      />
    )
  }

  if (loadable.status === 'error') {
    return (
      <DashboardErrorState
        ariaLabel="Зведення"
        billingPath={billingPath}
        genericMessage="Не вдалося завантажити зведення."
        problem={loadable.error}
        retry={retry}
      />
    )
  }

  return (
    <Panel aria-label="Зведення">
      <div aria-label="Завантаження зведення" role="status">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-3 h-44" />
      </div>
    </Panel>
  )
}

function getHeaderDestinations(
  snapshot: ReturnType<typeof useCabinet>['snapshot'],
  slug: string | undefined,
) {
  if (snapshot === null || slug === undefined) {
    return {
      scan: null,
      newOrder: null,
      parts: null,
      ordersPath: null,
      cashEnabled: false,
    }
  }

  const access = { status: 'ready' as const, snapshot, error: null }
  const canViewParts =
    evaluateModuleAccess(cabinetModules.parts, access, 'view').kind ===
    'allowed'
  const canCreateOrder =
    evaluateModuleAccess(cabinetModules.orders, access, 'mutation').kind ===
    'allowed'
  const canViewOrders =
    evaluateModuleAccess(cabinetModules.orders, access, 'view').kind ===
    'allowed'
  const canViewCash =
    evaluateModuleAccess(cabinetModules.cash, access, 'view').kind === 'allowed'

  return {
    scan: canViewParts ? cabinetPath(slug, 'parts', 'scan') : null,
    newOrder: canCreateOrder ? cabinetPath(slug, 'orders', 'new') : null,
    parts: canViewParts ? cabinetPath(slug, 'parts') : null,
    ordersPath: canViewOrders ? cabinetPath(slug, 'orders') : null,
    cashEnabled: canViewCash,
  }
}

function DashboardRecentOrdersState({
  loadable,
  ordersPath,
}: {
  loadable: DashboardExtraLoadable<OrderListItem[]>
  ordersPath: string
}) {
  if (loadable.status === 'ready') {
    return (
      <DashboardRecentOrders orders={loadable.data} ordersPath={ordersPath} />
    )
  }

  if (loadable.status === 'error') {
    return (
      <Panel aria-label="Останні замовлення">
        <p className="text-app-muted text-sm">
          Не вдалося завантажити останні замовлення.
        </p>
      </Panel>
    )
  }

  return (
    <Panel aria-label="Останні замовлення">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-4 h-24" />
    </Panel>
  )
}

function updatedSubtitle(loadable: DashboardLoadable<DashboardData>): string {
  if (loadable.status !== 'ready') return 'Зріз «зараз»'

  const timestamps = [
    loadable.data.lastActivity?.timestamp,
    loadable.data.lastMyActivity?.timestamp,
  ]
    .filter((value): value is string => value !== undefined)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.valueOf()))

  const latest =
    timestamps.length === 0
      ? new Date()
      : new Date(Math.max(...timestamps.map(Number)))
  return `Зріз «зараз» · оновлено ${updatedAtFormatter.format(latest)}`
}
