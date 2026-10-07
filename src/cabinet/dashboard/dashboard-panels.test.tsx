import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import type { CarListItem } from '@/api/cars'
import type { CashRegister } from '@/api/cash'
import type { OrderListItem } from '@/api/orders'
import { ActivityCard } from './ActivityCard'
import { CarPayoffCard } from './CarPayoffCard'
import { RecentOrdersCard } from './RecentOrdersCard'
import { RevenueChart } from './RevenueChart'
import { TillsCard } from './TillsCard'
import { TopSalesCard } from './TopSalesCard'

const NOW = new Date('2026-09-19T09:00:00Z')

const routed = (node: React.ReactNode) =>
  render(<MemoryRouter>{node}</MemoryRouter>)

const car = (overrides: Partial<CarListItem> = {}): CarListItem => ({
  id: 'car-1',
  code: 'BC 9102 TX',
  brand: 'Ford',
  model: 'F-150',
  year: 2022,
  color: null,
  status: 'active',
  acquiredAt: '2026-07-19T09:00:00Z',
  partsCount: 120,
  soldPartsCount: 8,
  coverPhotoUrl: null,
  profitability: {
    invested: 14_600,
    recouped: 9_120,
    recoupedPercent: 62,
    partsAvailable: 112,
  },
  ...overrides,
})

it('puts a car’s payback, its age and both sums on one row', () => {
  routed(
    <CarPayoffCard
      base="/app/koval/cars"
      cars={[car()]}
      now={NOW}
      total={24}
    />,
  )

  const card = screen.getByRole('region', { name: 'Окупність авто' })
  expect(within(card).getByRole('link', { name: 'Усі 24' })).toHaveAttribute(
    'href',
    '/app/koval/cars',
  )
  const row = within(card).getByRole('link', { name: /Ford F-150/ })
  expect(row).toHaveAttribute('href', '/app/koval/cars/car-1')
  expect(row).toHaveTextContent('62%')
  expect(row).toHaveTextContent('BC 9102 TX · 8/120 продано · 62 дн')
  expect(row).toHaveTextContent('9 120 / 14 600 $')
})

it('shows a dash for a car whose money the account may not see', () => {
  routed(
    <CarPayoffCard
      base="/app/koval/cars"
      cars={[car({ profitability: null })]}
      now={NOW}
      total={1}
    />,
  )

  expect(
    within(screen.getByRole('region', { name: 'Окупність авто' })).getByText(
      '—',
    ),
  ).toBeVisible()
})

const order = (overrides: Partial<OrderListItem> = {}): OrderListItem => ({
  id: 'order-1',
  number: 286,
  status: 'paid',
  customerName: 'Ірина Олійник',
  itemCount: 2,
  partNames: [],
  paymentAccountNames: [],
  totalAmount: 103,
  createdAt: '2026-09-18T12:19:00Z',
  ...overrides,
})

it('names an order, its state and its sum, and links the row', () => {
  routed(<RecentOrdersCard base="/app/koval/orders" orders={[order()]} />)

  const row = screen.getByRole('link', { name: /Ірина Олійник/ })
  expect(row).toHaveAttribute('href', '/app/koval/orders/order-1')
  expect(row).toHaveTextContent('#286')
  expect(row).toHaveTextContent('Оплачено')
  expect(row).toHaveTextContent('103 $')
})

it('says an order has no customer instead of leaving the row blank', () => {
  routed(
    <RecentOrdersCard
      base="/app/koval/orders"
      orders={[order({ customerName: null, totalAmount: null })]}
    />,
  )

  const row = screen.getByRole('link', { name: /Без клієнта/ })
  expect(row).toHaveTextContent('—')
})

const register = (overrides: Partial<CashRegister> = {}): CashRegister => ({
  id: 'till-1',
  name: 'Основна каса',
  type: 'cash',
  isActive: true,
  balances: { UAH: 125_498, USD: 9_801 },
  ...overrides,
})

it('keeps every till currency on its own line and never adds them up', () => {
  routed(<TillsCard base="/app/koval/cash" registers={[register()]} />)

  const card = screen.getByRole('region', { name: 'Каси' })
  expect(within(card).getAllByText('Основна каса')).toHaveLength(2)
  expect(card).toHaveTextContent('9 801')
  expect(card).toHaveTextContent('125 498')
  // Dollars are read first, whatever order the server listed them in.
  expect(
    within(card)
      .getAllByText(/^(USD|UAH)$/)
      .map((node) => node.textContent),
  ).toEqual(['USD', 'UAH'])
})

it('draws the period’s takings with today in the accent and its axis under it', () => {
  render(
    <RevenueChart
      data={{
        period: 'week',
        labels: ['13.09', '14.09', '15.09'],
        revenue: {
          totals: { USD: 900 },
          trendPercent: 4,
          series: [400, 0, 500],
        },
        partsSold: { total: 1, delta: 0, series: [0, 0, 1] },
        activeOrders: { total: 1, delta: 0, series: [1, 1, 1] },
        topPart: null,
      }}
      periodLabel="Тиждень"
    />,
  )

  const card = screen.getByRole('region', { name: 'Виручка за період' })
  expect(card).toHaveTextContent('Виручка · Тиждень')
  expect(card).toHaveTextContent('900 USD')
  expect(card).toHaveTextContent('сер. 300 USD/день')
  expect(card).toHaveTextContent('13.09')
  expect(card).toHaveTextContent('15.09')
  expect(within(card).getByTitle('15.09 · 500 USD')).toBeInTheDocument()
})

it('says there were no sales rather than drawing an empty chart', () => {
  render(
    <RevenueChart
      data={{
        period: 'week',
        labels: [],
        revenue: { totals: {}, trendPercent: 0, series: [] },
        partsSold: { total: 0, delta: 0, series: [] },
        activeOrders: { total: 0, delta: 0, series: [] },
        topPart: null,
      }}
      periodLabel="Тиждень"
    />,
  )

  expect(
    screen.getByRole('region', { name: 'Виручка за період' }),
  ).toHaveTextContent('За обраний період продажів не було.')
})

it('links the best-selling part to its own card when parts are open', () => {
  routed(
    <TopSalesCard
      partsPath="/app/koval/parts"
      periodLabel="Тиждень"
      topPart={{
        id: 'part-1',
        name: 'Фара ліва LED',
        photoUrl: null,
        revenueUsd: 1_140,
        salesCount: 3,
        salesSeries: [1, 1, 1],
      }}
    />,
  )

  const row = screen.getByRole('link', { name: /Фара ліва LED/ })
  expect(row).toHaveAttribute('href', '/app/koval/parts/part-1')
  expect(row).toHaveTextContent('3 продажі за період')
  expect(row).toHaveTextContent('1 140 $')
})

it('carries the two activity events the payload has and nothing more', () => {
  render(
    <ActivityCard
      lastActivity={{
        type: 'part_created',
        userName: 'Дмитро',
        timestamp: '2026-09-18T11:36:00Z',
      }}
      lastMyActivity={null}
    />,
  )

  const card = screen.getByRole('region', { name: 'Активність' })
  expect(card).toHaveTextContent('Додано запчастину')
  expect(card).toHaveTextContent('Дмитро · у розбірці')
})

it('shows an unknown event code as it came instead of blanking the row', () => {
  render(
    <ActivityCard
      lastActivity={{
        type: 'inventory_started',
        userName: 'Андрій',
        timestamp: '2026-09-18T11:36:00Z',
      }}
      lastMyActivity={null}
    />,
  )

  expect(screen.getByRole('region', { name: 'Активність' })).toHaveTextContent(
    'inventory_started',
  )
})
