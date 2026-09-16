import { Link } from 'react-router'
import type { OrderListItem } from '@/api/orders'
import { orderStatusPresentation } from '../orders/order-status'

const numberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})
const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Kyiv',
})

export function DashboardRecentOrders({
  orders,
  ordersPath,
}: {
  orders: OrderListItem[]
  ordersPath: string
}) {
  return (
    <section
      aria-labelledby="dashboard-recent-orders"
      className="dashboard-recent-card dashboard-recent-orders"
    >
      <header>
        <h2 id="dashboard-recent-orders">Останні замовлення</h2>
        <Link to={ordersPath}>Усі</Link>
      </header>

      {orders.length === 0 ? (
        <p className="dashboard-recent-empty">Замовлень ще немає.</p>
      ) : (
        <div className="dashboard-orders-table" role="table">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} ordersPath={ordersPath} />
          ))}
        </div>
      )}
    </section>
  )
}

function OrderRow({
  order,
  ordersPath,
}: {
  order: OrderListItem
  ordersPath: string
}) {
  const status = orderStatusPresentation(order.status)
  const createdAt = new Date(order.createdAt)
  const customerName = order.customerName?.trim()
  const description =
    customerName && customerName.length > 0
      ? customerName
      : order.partNames.length > 0
        ? order.partNames.join(', ')
        : `${order.itemCount} позицій`

  return (
    <div className="dashboard-order-row" role="row">
      <div role="cell">
        <Link to={`${ordersPath}/${encodeURIComponent(order.id)}`}>
          #{order.number}
        </Link>
        <span>{description}</span>
      </div>
      <time dateTime={order.createdAt} role="cell">
        {Number.isNaN(createdAt.valueOf())
          ? '—'
          : dateFormatter.format(createdAt)}
      </time>
      <span
        className="dashboard-order-status"
        data-tone={status.tone}
        role="cell"
      >
        <i aria-hidden />
        {status.label}
      </span>
      <strong role="cell">
        {order.totalAmount === null
          ? '—'
          : `${numberFormatter.format(order.totalAmount)} $`}
      </strong>
    </div>
  )
}
