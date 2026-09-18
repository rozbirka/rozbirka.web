import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { Button, Panel, Skeleton } from '@/components/app'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { cabinetModules } from '../module-registry'
import { evaluateModuleAccess } from '../policy'
import { DashboardActivity } from './DashboardActivity'
import { readDashboardPeriod, writeDashboardPeriod } from './dashboard-period'
import { useDashboardData, type DashboardLoadable } from './use-dashboard-data'
import type { DashboardData, DashboardPeriod } from '@/api/dashboard-contract'
import { DashboardAnalytics } from './DashboardAnalytics'
import { DashboardBillingBanner } from './DashboardBillingBanner'
import { DashboardErrorState } from './DashboardErrorState'
import { DashboardSummary } from './DashboardSummary'
import { useCashBalances } from './use-cash-balances'
import { getDashboardBillingPath } from './dashboard-billing-access'

export function DashboardScreen() {
  const { targetTenant, snapshot } = useCabinet()
  const [searchParams, setSearchParams] = useSearchParams()
  const selection = readDashboardPeriod(searchParams)
  const dashboard = useDashboardData(selection.period)
  const tenantName = targetTenant?.name ?? 'вашій розбірці'
  const billingPath =
    snapshot !== null && targetTenant !== null
      ? getDashboardBillingPath(snapshot, targetTenant)
      : null

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

  const access =
    snapshot === null
      ? null
      : { status: 'ready' as const, snapshot, error: null }
  const canOpen = (module: 'orders' | 'parts') =>
    access !== null &&
    targetTenant !== null &&
    evaluateModuleAccess(cabinetModules[module], access, 'view').kind ===
      'allowed'
  const slug = targetTenant?.slug ?? null

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="border-app-line bg-app-canvas/80 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 backdrop-blur-[14px] sm:px-6 md:px-8 lg:px-12">
        <p className="text-app-dim flex items-center gap-2.5 font-mono text-[12px] tracking-[0.14em] uppercase">
          <span>Склад</span>
          <span aria-hidden className="text-white/20">
            /
          </span>
          <span className="text-app-muted">Головна</span>
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            aria-busy={dashboard.refreshing}
            className="min-w-11 px-0"
            aria-label={
              dashboard.refreshing ? 'Оновлюємо дані' : 'Оновити дані'
            }
            disabled={dashboard.refreshing}
            onClick={() => void dashboard.refresh()}
          >
            <RefreshCw aria-hidden />
          </Button>
          {/* The scan screen lives under the parts module, so it opens for
              anyone who can see parts at all. */}
          {slug !== null && canOpen('parts') ? (
            <Button asChild className="px-[18px] text-sm font-semibold">
              <Link to={`/app/${slug}/scan`}>Сканувати</Link>
            </Button>
          ) : null}
          {slug !== null && canOpen('orders') ? (
            <Button
              asChild
              className="px-5 text-sm font-bold"
              variant="primary"
            >
              <Link to={cabinetPath(slug, 'orders', 'new')}>
                Нове замовлення
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 pt-8 pb-16 sm:px-6 md:px-8 md:pt-10 lg:px-12">
        <div className="min-w-0">
          <h1 className="text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
            Зведення
          </h1>
          <p className="text-app-muted mt-2.5 text-[15px]">
            Зріз «зараз» · {tenantName}
            {dashboard.refreshing ? ' · оновлюємо…' : null}
          </p>
        </div>
        <div
          aria-busy={dashboard.refreshing}
          aria-label="Панель зведення"
          className="grid min-w-0 gap-8"
          role="region"
        >
          {snapshot !== null && targetTenant !== null ? (
            <DashboardBillingBanner snapshot={snapshot} tenant={targetTenant} />
          ) : null}
          <DashboardSummaryState
            billingPath={billingPath}
            loadable={dashboard.summary}
            retry={() => dashboard.retrySummary()}
          />
          <DashboardAnalytics
            billingPath={billingPath}
            loadable={dashboard.analytics}
            onPeriodChange={selectPeriod}
            partsPath={
              slug !== null && canOpen('parts')
                ? cabinetPath(slug, 'parts')
                : null
            }
            period={selection.period}
            retry={() => dashboard.retryAnalytics()}
          />
          {snapshot !== null && targetTenant !== null ? (
            <DashboardActivity snapshot={snapshot} tenant={targetTenant} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DashboardSummaryState({
  billingPath,
  loadable,
  retry,
}: {
  billingPath: string | null
  loadable: DashboardLoadable<DashboardData>
  retry: () => Promise<void>
}) {
  const cashBalances = useCashBalances()

  if (loadable.status === 'ready') {
    return <DashboardSummary cashBalances={cashBalances} data={loadable.data} />
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
        <Skeleton className="mt-3 h-16" />
      </div>
    </Panel>
  )
}
