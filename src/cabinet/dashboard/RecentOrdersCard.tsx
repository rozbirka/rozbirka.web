import { Link } from 'react-router'
import { StatusPill } from '@/components/app'
import type { OrderListItem } from '@/api/orders'
import { useFormat, useLocale, useT } from '@/i18n'
import { orderStatusPresentation } from '../orders/order-labels'
import { CardEmpty, CardLink, CardRow, DashboardCard } from './dashboard-card'
import { dashboardMoneyMessages } from './money-messages'

const WHEN: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}

/** The last orders through the yard, newest first, as the list screen sorts them. */
export function RecentOrdersCard({
  accountingCurrency = null,
  base,
  orders,
}: {
  /** The order value's currency; `null` when unknown. */
  accountingCurrency?: string | null
  base: string
  orders: readonly OrderListItem[]
}) {
  const t = useT(dashboardMoneyMessages)
  const { locale } = useLocale()
  const format = useFormat()
  // The business time zone; «20.09, 14:05» reads as «20.09 · 14:05».
  const date = (iso: string) =>
    format.dateWith(iso, WHEN)?.replace(', ', ' · ') ?? iso
  const sum = (value: number) =>
    format.number(value, { maximumFractionDigits: 0 }) ?? String(value)
  return (
    <DashboardCard
      aside={<CardLink to={base}>{t('all')}</CardLink>}
      title={t('orders')}
    >
      {orders.length === 0 ? (
        <CardEmpty>{t('noOrders')}</CardEmpty>
      ) : (
        orders.map((order) => {
          const status = orderStatusPresentation(order.status, locale)
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
                    {order.customerName ?? t('noCustomer')}
                  </span>
                  <span className="text-app-dim mt-[3px] block font-mono text-[12px]">
                    {date(order.createdAt)}
                  </span>
                </span>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                <span className="col-start-2 font-mono text-[15px] font-medium whitespace-nowrap tabular-nums text-white sm:col-start-auto sm:text-right">
                  {order.totalAmount === null
                    ? '—'
                    : `${sum(order.totalAmount)}${accountingCurrency === null ? '' : ` ${accountingCurrency}`}`}
                </span>
              </Link>
            </CardRow>
          )
        })
      )}
    </DashboardCard>
  )
}
