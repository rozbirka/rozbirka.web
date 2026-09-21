import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { useCabinet } from '../CabinetContext'
import { OrdersScreen } from './OrdersScreen'

const orderMocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  updateItems: vi.fn(),
}))
const partMocks = vi.hoisted(() => ({ list: vi.fn() }))
const customerMocks = vi.hoisted(() => ({
  search: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  activate: vi.fn(),
}))

vi.mock('@/api/orders', () => ({ ordersApi: orderMocks }))
vi.mock('@/api/parts', () => ({ partsApi: partMocks }))
vi.mock('@/api/customers', async (importOriginal) => ({
  ...(await importOriginal()),
  customersApi: customerMocks,
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const definition = {
  key: 'orders',
  routeSegment: '/orders',
  released: true,
  viewPermission: 'orders.view',
  mutationPermission: 'orders.manage',
  allowedSubscriptionStates: ['active'],
} as never

beforeEach(() => {
  vi.mocked(useCabinet).mockReturnValue({
    status: 'ready',
    targetTenant: { id: 'tenant-1', slug: 'garage' },
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation: 1,
      permissions: new Set([
        'orders.view',
        'orders.manage',
        'parts.view',
        'customers.view',
        'customers.manage',
      ]),
      features: new Set(),
      entitlement: { state: 'active', usage: {} },
    },
    error: null,
  } as never)
  orderMocks.getById.mockResolvedValue({ items: [] })
})

it('opens canonical creation as a four-step workflow without scanning', () => {
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(
    screen.getByRole('heading', { name: 'Нове замовлення' }),
  ).toBeVisible()
  expect(screen.getByText('1 / 4')).toBeVisible()
  expect(screen.getAllByText('Запчастини')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Далі' })).toBeDisabled()
  expect(screen.queryByText(/QR|Сканувати/i)).not.toBeInTheDocument()
})

it('keeps the existing add-item route separate from canonical creation', async () => {
  render(
    <MemoryRouter
      initialEntries={['/app/garage/orders/order-1/items/new']}
    >
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Додати позицію' }),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Додати позицію' }),
  ).toBeVisible()
})
