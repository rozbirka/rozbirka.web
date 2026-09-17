import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Tenant } from '../api/types'
import type { TenantAccessSnapshot } from './access-types'
import { CommandPalette } from './CommandPalette'

const partsMock = vi.hoisted(() => ({ search: vi.fn() }))
const carsMock = vi.hoisted(() => ({ list: vi.fn() }))
const customersMock = vi.hoisted(() => ({ search: vi.fn() }))
const ordersMock = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('@/api/parts', () => ({ partsApi: partsMock }))
vi.mock('@/api/cars', () => ({ carsApi: carsMock }))
vi.mock('@/api/customers', () => ({ customersApi: customersMock }))
vi.mock('@/api/orders', () => ({ ordersApi: ordersMock }))

const tenant: Tenant = {
  id: 'tenant-1',
  name: 'Koval Auto',
  slug: 'koval',
  plan: 'active',
  planTier: 'pro',
  city: 'Київ',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'owner',
}

const snapshotWith = (permissions: string[]): TenantAccessSnapshot => ({
  userId: 'user-1',
  tenantId: tenant.id,
  generation: 1,
  role: 'owner',
  permissions: new Set(permissions),
  features: new Set(),
  entitlement: {
    state: 'active',
    usage: {
      cars: { used: 1, max: 100 },
      intakes: { used: 1, max: 100 },
      parts: { used: 1, max: 1000 },
      users: { used: 1, max: 10 },
      cashRegisters: { used: 1, max: 10 },
    },
  },
  subscription: null,
})

function Probe() {
  const location = useLocation()
  return <output aria-label="Поточний маршрут">{location.pathname}</output>
}

const renderPalette = (permissions: string[]) =>
  render(
    <MemoryRouter initialEntries={['/app/koval/dashboard']}>
      <Routes>
        <Route
          element={
            <>
              <CommandPalette
                snapshot={snapshotWith(permissions)}
                tenant={tenant}
              />
              <Probe />
            </>
          }
          path="*"
        />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  partsMock.search.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 0,
  })
  carsMock.list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 0,
  })
  customersMock.search.mockResolvedValue([])
  ordersMock.list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 0,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

it('stays shut until the shortcut, and opens on it', async () => {
  const user = userEvent.setup()
  renderPalette(['parts.view'])

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.keyboard('{Control>}k{/Control}')

  expect(
    screen.getByRole('combobox', { name: 'Пошук по кабінету' }),
  ).toBeVisible()
})

it('offers only the sections this account may open', async () => {
  const user = userEvent.setup()
  renderPalette(['parts.view'])
  await user.keyboard('{Control>}k{/Control}')
  await user.type(
    screen.getByRole('combobox', { name: 'Пошук по кабінету' }),
    'а',
  )

  const list = screen.getByRole('listbox')
  expect(within(list).getByRole('option', { name: /Запчастини/ })).toBeVisible()
  expect(
    within(list).queryByRole('option', { name: /Клієнти/ }),
  ).not.toBeInTheDocument()
})

it('asks only the endpoints behind permissions the account holds', async () => {
  const user = userEvent.setup()
  renderPalette(['parts.view', 'orders.view'])
  await user.keyboard('{Control>}k{/Control}')
  await user.type(
    screen.getByRole('combobox', { name: 'Пошук по кабінету' }),
    'фара',
  )

  await vi.waitFor(() => expect(partsMock.search).toHaveBeenCalled())
  expect(ordersMock.list).toHaveBeenCalled()
  expect(carsMock.list).not.toHaveBeenCalled()
  expect(customersMock.search).not.toHaveBeenCalled()
})

it('opens what Enter lands on', async () => {
  const user = userEvent.setup()
  partsMock.search.mockResolvedValue({
    items: [
      {
        id: 'part-7',
        name: 'Фара ліва',
        oemCode: 'OEM-1',
        car: { id: 'c1', make: 'Ford', model: 'Focus', year: 2016, vin: null },
      },
    ],
    page: 1,
    pageSize: 5,
    total: 1,
    totalPages: 1,
  })
  renderPalette(['parts.view'])
  await user.keyboard('{Control>}k{/Control}')
  await user.type(
    screen.getByRole('combobox', { name: 'Пошук по кабінету' }),
    'фара',
  )

  const option = await screen.findByRole('option', { name: /Фара ліва/ })
  await user.click(option)

  expect(screen.getByLabelText('Поточний маршрут')).toHaveTextContent(
    '/app/koval/parts/part-7',
  )
})

it('still shows the sources that answered when one of them fails', async () => {
  const user = userEvent.setup()
  partsMock.search.mockRejectedValue(new Error('down'))
  ordersMock.list.mockResolvedValue({
    items: [{ id: 'order-3', number: 12, customerName: 'Петро' }],
    page: 1,
    pageSize: 5,
    total: 1,
    totalPages: 1,
  })
  renderPalette(['parts.view', 'orders.view'])
  await user.keyboard('{Control>}k{/Control}')
  await user.type(
    screen.getByRole('combobox', { name: 'Пошук по кабінету' }),
    'петро',
  )

  expect(
    await screen.findByRole('option', { name: /Замовлення №12/ }),
  ).toBeVisible()
})
