import { Link } from 'react-router'
import { StatusPill } from '@/components/app'
import type { OrderListItem } from '@/api/orders'
import { orderStatusPresentation } from '../orders/order-labels'
import { CardEmpty, CardLink, CardRow, DashboardCard } from './dashboard-card'

const sum = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

const when = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})

/** The last orders through the yard, newest first, as the list screen sorts them. */
export function RecentOrdersCard({
  base,
  orders,
}: {
  base: string
  orders: readonly OrderListItem[]
}) {
  return (
    <DashboardCard
      aside={<CardLink to={base}>Усі</CardLink>}
      title="Замовлення"
    >
      {orders.length === 0 ? (
        <CardEmpty>Замовлень ще немає.</CardEmpty>
      ) : (
        orders.map((order) => {
          const status = orderStatusPresentation(order.status)
          return (
            <CardRow hover key={order.id}>
              <Link
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:grid-cols-[44px_minmax(0,1fr)_auto_minmax(64px,auto)]"
                to={`${base}/${order.id}`}
              >
                <span className="text-app-dim font-mono text-[13px]">
                  #{String(order.number)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold tracking-[-0.01em] text-white">
                    {order.customerName ?? 'Без клієнта'}
                  </span>
                  <span className="text-app-dim mt-[3px] block font-mono text-[12px]">
                    {date(order.createdAt)}
                  </span>
                </span>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                <span className="col-start-2 font-mono text-[15px] font-medium whitespace-nowrap tabular-nums text-white sm:col-start-auto sm:text-right">
                  {order.totalAmount === null
                    ? '—'
                    : `${sum.format(order.totalAmount)} $`}
                </span>
              </Link>
            </CardRow>
          )
        })
      )}
    </DashboardCard>
  )
}

const date = (iso: string) => {
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime())
    ? iso
    : when.format(parsed).replace(', ', ' · ')
}
