import { MemoryRouter } from 'react-router'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { OrderListItem } from '@/api/orders'
import { DashboardRecentOrders } from './DashboardRecentOrders'

const orders: OrderListItem[] = [
  {
    id: 'order-286',
    number: 286,
    status: 'confirmed',
    customerName: 'Марина Данилюк',
    itemCount: 2,
    partNames: ['Фара ліва', 'Крило'],
    paymentAccountNames: ['Сейф'],
    totalAmount: 5_500,
    createdAt: '2026-09-16T09:15:00Z',
  },
]

it('renders real recent orders with links, status, date, and total', () => {
  render(
    <MemoryRouter>
      <DashboardRecentOrders orders={orders} ordersPath="/app/garage/orders" />
    </MemoryRouter>,
  )

  expect(
    screen.getByRole('heading', { name: 'Останні замовлення' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /#286/ })).toHaveAttribute(
    'href',
    '/app/garage/orders/order-286',
  )
  expect(screen.getByText('Підтверджено')).toBeInTheDocument()
  expect(screen.getByText('16.09.2026')).toBeInTheDocument()
  expect(
    screen.getByText(
      (_content, element) =>
        element?.tagName === 'STRONG' && element.textContent === '5\u00a0500 $',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Усі' })).toHaveAttribute(
    'href',
    '/app/garage/orders',
  )
})

it('renders a calm empty state when there are no orders', () => {
  render(
    <MemoryRouter>
      <DashboardRecentOrders orders={[]} ordersPath="/app/garage/orders" />
    </MemoryRouter>,
  )

  expect(screen.getByText('Замовлень ще немає.')).toBeInTheDocument()
})
