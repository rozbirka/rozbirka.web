import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { StatusPill, type StatusTone } from '@/components/app'
import { intakesApi, type IntakeListItem } from '@/api/intakes'
import { ordersApi, type OrderListItem } from '@/api/orders'
import type { Tenant } from '@/api/types'
import type { TenantAccessSnapshot } from '../access-types'
import { cabinetPath } from '../cabinet-paths'
import { cabinetModules } from '../module-registry'
import { evaluateModuleAccess } from '../policy'
import { plural } from '@/lib/utils'

const RECENT = 4

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})

const money = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

const orderStatus = (status: string): { label: string; tone: StatusTone } => {
  if (status === 'pending') return { label: 'Очікує', tone: 'warn' }
  if (status === 'confirmed') return { label: 'Підтверджено', tone: 'info' }
  if (status === 'paid') return { label: 'Оплачено', tone: 'ok' }
  if (status === 'reserved') return { label: 'Резерв', tone: 'warn' }
  if (status === 'refunded') return { label: 'Повернено', tone: 'info' }
  if (status === 'cancelled') return { label: 'Скасовано', tone: 'neutral' }
  return { label: status, tone: 'neutral' }
}

const when = (timestamp: string) => {
  const date = new Date(timestamp)
  return Number.isNaN(date.valueOf()) ? timestamp : dateFormatter.format(date)
}

/**
 * The last things that happened in the yard, each read from the module it
 * belongs to. A panel appears only for a module this person can open — an
 * order list is not a summary figure, it is the orders module in miniature.
 */
export function DashboardActivity({
  snapshot,
  tenant,
}: {
  snapshot: TenantAccessSnapshot
  tenant: Pick<Tenant, 'slug'>
}) {
  const access = { status: 'ready' as const, snapshot, error: null }
  const canSee = (module: 'orders' | 'intakes') =>
    evaluateModuleAccess(cabinetModules[module], access, 'view').kind ===
    'allowed'
  const showOrders = canSee('orders')
  const showIntakes = canSee('intakes')
  const [orders, setOrders] = useState<OrderListItem[] | null>(null)
  const [intakes, setIntakes] = useState<IntakeListItem[] | null>(null)

  useEffect(() => {
    if (!showOrders) return
    const controller = new AbortController()
    void ordersApi
      .list({ pageSize: RECENT }, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted) setOrders(page.items)
        },
        () => {
          // The summary above still stands; a missing panel is not an error.
        },
      )
    return () => controller.abort()
  }, [showOrders])

  useEffect(() => {
    if (!showIntakes) return
    const controller = new AbortController()
    void intakesApi
      .list({ pageSize: RECENT }, { signal: controller.signal })
      .then(
        (page) => {
          if (!controller.signal.aborted) setIntakes(page.items)
        },
        () => undefined,
      )
    return () => controller.abort()
  }, [showIntakes])

  if (!showOrders && !showIntakes) return null

  const ordersPath = cabinetPath(tenant.slug, 'orders')
  const intakesPath = cabinetPath(tenant.slug, 'intakes')

  return (
    <div className="flex flex-wrap items-start gap-5">
      {showOrders ? (
        <ActivityPanel
          allTo={ordersPath}
          className="min-w-[320px] flex-[1_1_420px]"
          empty="Замовлень ще не було."
          loading={orders === null}
          title="Останні замовлення"
        >
          {(orders ?? []).map((order) => {
            const status = orderStatus(order.status)
            return (
              <li key={order.id}>
                <Link
                  className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-white/[0.03]"
                  to={`${ordersPath}/${order.id}`}
                >
                  <span className="text-app-dim w-12 shrink-0 font-mono text-[13px]">
                    №{order.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-white">
                      {order.customerName ?? 'Без клієнта'}
                    </span>
                    <span className="text-app-muted mt-0.5 block text-xs">
                      {when(order.createdAt)}
                    </span>
                  </span>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  <span className="min-w-[84px] text-right text-[15px] font-bold whitespace-nowrap text-white tabular-nums">
                    {order.totalAmount === null
                      ? '—'
                      : money.format(order.totalAmount)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ActivityPanel>
      ) : null}
      {showIntakes ? (
        <ActivityPanel
          allTo={intakesPath}
          className="min-w-[280px] flex-[1_1_300px]"
          empty="Приймань ще не було."
          loading={intakes === null}
          title="Приймання"
        >
          {(intakes ?? []).map((intake) => (
            <li key={intake.id}>
              <Link
                className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-white/[0.03]"
                to={`${intakesPath}/${intake.id}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-white">
                    {intake.name ?? 'Приймання без назви'}
                  </span>
                  <span className="text-app-muted mt-0.5 block text-xs">
                    {when(intake.createdAt)} · {intake.createdBy.displayName}
                  </span>
                </span>
                <span className="text-app-muted font-mono text-sm whitespace-nowrap">
                  {intake.partsCount}{' '}
                  {plural(intake.partsCount, ['поз.', 'поз.', 'поз.'])}
                </span>
              </Link>
            </li>
          ))}
        </ActivityPanel>
      ) : null}
    </div>
  )
}

function ActivityPanel({
  title,
  allTo,
  loading,
  empty,
  className,
  children,
}: {
  title: string
  allTo: string
  loading: boolean
  empty: string
  className?: string
  children: React.ReactNode
}) {
  const rows = Array.isArray(children) ? children : [children]
  const filled = rows.flat().filter(Boolean).length > 0

  return (
    <section
      aria-label={title}
      className={`border-app-line bg-app-raised overflow-hidden rounded-[20px] border ${className ?? ''}`}
    >
      <div className="flex items-baseline justify-between gap-4 px-6 pt-5 pb-4">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
          {title}
        </h2>
        <Link
          className="text-brand text-[13px] font-semibold hover:underline"
          to={allTo}
        >
          Усі
        </Link>
      </div>
      {loading ? (
        <p className="text-app-muted border-app-line border-t px-6 py-4 text-sm">
          Завантажуємо…
        </p>
      ) : filled ? (
        <ul className="divide-app-line border-app-line grid divide-y border-t">
          {children}
        </ul>
      ) : (
        <p className="text-app-muted border-app-line border-t px-6 py-4 text-sm">
          {empty}
        </p>
      )}
    </section>
  )
}
