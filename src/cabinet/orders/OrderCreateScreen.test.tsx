import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const carMocks = vi.hoisted(() => ({ list: vi.fn() }))
const intakeMocks = vi.hoisted(() => ({ list: vi.fn() }))
const customerMocks = vi.hoisted(() => ({
  search: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  activate: vi.fn(),
}))

vi.mock('@/api/orders', () => ({ ordersApi: orderMocks }))
vi.mock('@/api/parts', () => ({ partsApi: partMocks }))
vi.mock('@/api/cars', () => ({ carsApi: carMocks }))
vi.mock('@/api/intakes', () => ({ intakesApi: intakeMocks }))
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
  partMocks.list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  carMocks.list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 100,
    total: 0,
    totalPages: 0,
  })
  intakeMocks.list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 100,
    total: 0,
    totalPages: 0,
  })
})

it('searches available parts and adds one with the quantity stepper', async () => {
  partMocks.list.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Ліхтар',
        photos: [],
        quantityTotal: 3,
        quantityReserved: 0,
        quantityAvailable: 3,
        quantitySoldTotal: 0,
        status: 'available',
        car: { id: 'car-1', make: 'BMW', model: 'X5', year: 2019 },
        order: null,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await waitFor(() =>
    expect(partMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'available', page: 1, pageSize: 20 }),
    ),
  )
  await user.type(screen.getByLabelText('Пошук запчастини'), 'ліхтар')
  await user.click(await screen.findByRole('button', { name: /Ліхтар/ }))

  expect(
    screen.getByRole('dialog', { name: 'Додати запчастину' }),
  ).toBeVisible()
  expect(screen.getByLabelText('Кількість')).toHaveValue('1')
  expect(screen.getByRole('button', { name: 'Менше' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Більше' }))
  expect(screen.getByLabelText('Кількість')).toHaveValue('2')
  await user.type(screen.getByLabelText('Ціна за шт.'), '120,50')
  await user.click(screen.getByRole('button', { name: 'Додати' }))

  expect(screen.getByText('Ліхтар ×2')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Далі' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Далі' }))
  expect(screen.getByRole('heading', { name: 'Ціна' })).toBeVisible()
  expect(screen.getByText('2 шт.')).toBeVisible()
  expect(screen.getByLabelText('Ціна за одиницю Ліхтар')).toHaveValue('120.50')
  expect(screen.getByText('Разом: 241 $')).toBeVisible()
  await user.clear(screen.getByLabelText('Ціна за одиницю Ліхтар'))
  expect(screen.getByRole('button', { name: 'Далі' })).toBeDisabled()
  await user.type(screen.getByLabelText('Ціна за одиницю Ліхтар'), '0')
  expect(screen.getByRole('button', { name: 'Далі' })).toBeEnabled()
  customerMocks.search.mockResolvedValue([
    { id: 'customer-1', name: 'Ірина', phone: '+380501112233', ordersCount: 2 },
  ])
  await user.click(screen.getByRole('button', { name: 'Далі' }))
  expect(screen.getByRole('heading', { name: 'Клієнт' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Далі' })).toBeEnabled()
  await user.type(screen.getByLabelText('Пошук клієнта'), 'Ірина')
  await user.click(
    await screen.findByRole('button', { name: 'Обрати клієнта Ірина' }),
  )
  expect(screen.getByText('+380501112233')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Обрати клієнта Ірина' }),
  ).not.toBeInTheDocument()
})

it('opens canonical creation as a four-step workflow without scanning', () => {
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Нове замовлення' })).toBeVisible()
  expect(screen.getByText('1 / 4')).toBeVisible()
  expect(screen.getAllByText('Запчастини')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Далі' })).toBeDisabled()
  expect(screen.queryByText(/QR|Сканувати/i)).not.toBeInTheDocument()
})

it('keeps the existing add-item route separate from canonical creation', async () => {
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1/items/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Додати позицію' }),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Додати позицію' })).toBeVisible()
})
