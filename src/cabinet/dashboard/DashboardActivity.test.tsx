import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { FEATURES } from '@/api/types'
import { intakesApi } from '@/api/intakes'
import { ordersApi } from '@/api/orders'
import type { TenantAccessSnapshot } from '../access-types'
import type * as ModuleRegistry from '../module-registry'
import { DashboardActivity } from './DashboardActivity'

/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are invoked only through their owning singleton. */

vi.mock('@/api/orders', () => ({ ordersApi: { list: vi.fn() } }))
vi.mock('@/api/intakes', () => ({ intakesApi: { list: vi.fn() } }))
vi.mock('../module-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof ModuleRegistry>()
  return {
    ...actual,
    cabinetModules: {
      ...actual.cabinetModules,
      orders: { ...actual.cabinetModules.orders, released: true },
      intakes: { ...actual.cabinetModules.intakes, released: true },
    },
  }
})

const snapshot = (permissions: string[]): TenantAccessSnapshot => ({
  userId: 'user-1',
  tenantId: 'tenant-1',
  generation: 1,
  role: 'owner',
  permissions: new Set(permissions),
  features: new Set([FEATURES.IntakeManagement]),
  entitlement: {
    state: 'active',
    usage: {
      cars: { used: 1, max: 10 },
      intakes: { used: 1, max: 10 },
      parts: { used: 1, max: 10 },
      users: { used: 1, max: 10 },
      cashRegisters: { used: 1, max: 10 },
    },
  },
  subscription: null,
})

const page = <T,>(items: T[]) => ({
  items,
  page: 1,
  pageSize: 4,
  total: items.length,
  totalPages: 1,
})

beforeEach(() => {
  vi.clearAllMocks()
})

const renderActivity = (permissions: string[]) =>
  render(
    <MemoryRouter>
      <DashboardActivity
        snapshot={snapshot(permissions)}
        tenant={{ slug: 'koval' }}
      />
    </MemoryRouter>,
  )

it('lists the latest orders and intakes with their own links', async () => {
  vi.mocked(ordersApi.list).mockResolvedValue(
    page([
      {
        id: 'order-1',
        number: 286,
        status: 'paid',
        customerName: 'Ірина Олійник',
        itemCount: 2,
        partNames: [],
        paymentAccountNames: [],
        totalAmount: 103,
        createdAt: '2026-09-16T12:19:00Z',
      },
    ]),
  )
  vi.mocked(intakesApi.list).mockResolvedValue(
    page([
      {
        id: 'intake-1',
        name: 'Rivian R1T 2022',
        supplier: null,
        purchasedAt: null,
        totalCost: null,
        partsCount: 26,
        soldCount: 0,
        createdAt: '2026-09-16T05:40:00Z',
        createdBy: { id: 'user-2', displayName: 'Дмитро' },
      },
    ]),
  )

  renderActivity(['orders.view', 'intakes.view'])

  const orders = await screen.findByRole('region', {
    name: 'Останні замовлення',
  })
  expect(
    within(orders).getByRole('link', { name: /Ірина Олійник/ }),
  ).toHaveAttribute('href', '/app/koval/orders/order-1')
  expect(within(orders).getByText('Оплачено')).toBeVisible()
  expect(within(orders).getByRole('link', { name: 'Усі' })).toHaveAttribute(
    'href',
    '/app/koval/orders',
  )

  const intakes = await screen.findByRole('region', { name: 'Приймання' })
  expect(
    within(intakes).getByRole('link', { name: /Rivian R1T 2022/ }),
  ).toHaveAttribute('href', '/app/koval/intakes/intake-1')
  expect(within(intakes).getByText(/26 поз\./)).toBeVisible()
})

it('asks only for the modules this person can open', async () => {
  vi.mocked(intakesApi.list).mockResolvedValue(page([]))

  renderActivity(['intakes.view'])

  expect(await screen.findByText('Приймань ще не було.')).toBeVisible()
  expect(ordersApi.list).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('region', { name: 'Останні замовлення' }),
  ).not.toBeInTheDocument()
})

it('keeps quiet when neither module is open', () => {
  const { container } = renderActivity([])

  expect(container).toBeEmptyDOMElement()
  expect(ordersApi.list).not.toHaveBeenCalled()
  expect(intakesApi.list).not.toHaveBeenCalled()
})

it('names the order status in Ukrainian instead of the raw code', async () => {
  vi.mocked(ordersApi.list).mockResolvedValue({
    items: [
      {
        id: 'order-1',
        number: 286,
        customerName: 'Ірина Олійник',
        status: 'confirmed',
        totalAmount: 103,
        currency: 'USD',
        createdAt: '2026-08-26T18:19:00Z',
      },
    ],
    page: 1,
    pageSize: 4,
    total: 1,
    totalPages: 1,
  } as never)
  vi.mocked(intakesApi.list).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 4,
    total: 0,
    totalPages: 0,
  })

  renderActivity(['orders.view'])

  expect(await screen.findByText('Підтверджено')).toBeVisible()
  expect(screen.queryByText('confirmed')).toBeNull()
})
