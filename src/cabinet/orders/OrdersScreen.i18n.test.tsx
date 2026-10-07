import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tenantSettings } from '@/api/tenant-settings'
import { LocaleProvider, type Locale } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { OrdersScreen } from './OrdersScreen'
import { orderEventTitle, orderStatusPresentation } from './order-labels'
import {
  deliveryProblemMessage,
  novaPoshtaAvailableIn,
  phoneExample,
} from './delivery/nova-poshta-availability'

const country = vi.hoisted(() => ({ code: null as string | null }))
const orderMocks = vi.hoisted(() => ({ list: vi.fn(), getById: vi.fn() }))
const integrationMocks = vi.hoisted(() => ({ list: vi.fn() }))
const deliveryMocks = vi.hoisted(() => ({ get: vi.fn(), configure: vi.fn() }))

vi.mock('@/auth/useTenantSettings', () => ({
  useTenantSettings: () =>
    tenantSettings(
      country.code === null ? null : ({ countryCode: country.code } as never),
    ),
}))
vi.mock('@/api/orders', () => ({ ordersApi: orderMocks }))
vi.mock('@/api/integrations', () => ({
  integrationsApi: { list: integrationMocks.list },
}))
vi.mock('@/api/delivery', () => ({ deliveryApi: deliveryMocks }))
vi.mock('@/api/customers', async (importOriginal) => ({
  ...(await importOriginal()),
  customersApi: { getById: vi.fn().mockResolvedValue(null), search: vi.fn() },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const definition = {
  key: 'orders',
  routeSegment: '/orders',
  viewPermission: 'orders.view',
  mutationPermission: 'orders.manage',
  allowedSubscriptionStates: ['active'],
} as never

const cabinet = () =>
  ({
    status: 'ready',
    targetTenant: { id: 'tenant-1', slug: 'garage' },
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation: 1,
      permissions: new Set([
        'orders.view',
        'orders.manage',
        'finance.manage',
        'parts.view',
        'customers.view',
      ]),
      features: new Set(),
      entitlement: { state: 'active', usage: {} },
    },
    error: null,
  }) as unknown as ReturnType<typeof useCabinet>

const listItem = {
  id: 'order-1',
  number: 41,
  status: 'pending',
  customerId: null,
  customerName: null,
  itemCount: 2,
  partNames: [],
  paymentAccountNames: [],
  totalAmount: null,
  createdAt: '2026-09-21T22:30:00Z',
}

const detail = {
  id: 'order-1',
  number: 41,
  status: 'pending',
  customerId: null,
  customerName: null,
  notes: null,
  items: [],
  payments: [],
  history: [
    {
      eventType: 'Created',
      userName: 'Olena',
      createdAt: '2026-09-21T22:30:00Z',
    },
  ],
  totalAmount: 0,
  totalPaid: 0,
  paymentCurrency: 'USD',
  createdAt: '2026-09-21T22:30:00Z',
  createdByName: 'Olena',
}

const renderAt = (path: string, locale?: Locale) => {
  const screenTree = (
    <MemoryRouter initialEntries={[path]}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>
  )
  return render(
    locale === undefined ? (
      screenTree
    ) : (
      <LocaleProvider locale={locale} syncDocumentLang={false}>
        {screenTree}
      </LocaleProvider>
    ),
  )
}

beforeEach(() => {
  country.code = null
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  orderMocks.list.mockResolvedValue({
    items: [listItem],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  })
  orderMocks.getById.mockResolvedValue(detail)
  integrationMocks.list.mockResolvedValue([])
  deliveryMocks.get.mockRejectedValue({
    kind: 'conflict',
    code: 'ORDER_INVALID_STATUS',
    message: 'Order is not a delivery order.',
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('in British English', () => {
  it('renders the order list', async () => {
    renderAt('/app/garage/orders', 'en-GB')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Orders' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'New order' })).toBeVisible()
    expect(
      screen.getByPlaceholderText('Order number or buyer'),
    ).toBeInTheDocument()
    const filters = screen.getByRole('radiogroup', { name: 'Order status' })
    expect(within(filters).getByRole('radio', { name: /All/ })).toBeVisible()
    expect(
      within(filters).getByRole('radio', { name: /Refunded/ }),
    ).toBeVisible()

    const list = screen.getByRole('region', { name: 'Order list' })
    expect(await within(list).findByText('No buyer')).toBeVisible()
    expect(within(list).getByText('2 items')).toBeVisible()
    expect(within(list).getByText('no payments yet')).toBeVisible()
    expect(within(list).getByText('Pending')).toBeVisible()
    // 22:30 UTC is already the next day in Kyiv, the business's own zone.
    expect(within(list).getByText('22/09/2026')).toBeVisible()
    expect(within(list).getByText('1 order')).toBeVisible()
  })

  it('renders the order page with its history in the business time zone', async () => {
    renderAt('/app/garage/orders/order-1', 'en-GB')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Order #41' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to orders' })).toBeVisible()
    expect(screen.getByText('Created 22/09/2026, 01:30 · Olena')).toBeVisible()
    const history = screen.getByRole('list', { name: 'Order history' })
    expect(within(history).getByText('Order created')).toBeVisible()
    expect(
      await screen.findByRole('button', { name: 'Arrange delivery' }),
    ).toBeVisible()
  })
})

describe('Nova Poshta by business country', () => {
  it('offers delivery to a Ukrainian business', async () => {
    country.code = 'UA'
    renderAt('/app/garage/orders/order-1')

    expect(
      await screen.findByRole('button', { name: 'Оформити доставку' }),
    ).toBeVisible()
    expect(integrationMocks.list).toHaveBeenCalled()
  })

  it('treats an unknown country as the Ukrainian default', async () => {
    renderAt('/app/garage/orders/order-1')

    expect(
      await screen.findByRole('button', { name: 'Оформити доставку' }),
    ).toBeVisible()
  })

  it('says why delivery is missing for a British business', async () => {
    country.code = 'GB'
    renderAt('/app/garage/orders/order-1', 'en-GB')

    expect(
      await screen.findByText(
        'Nova Poshta delivery is only available for businesses in Ukraine.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Arrange delivery' }),
    ).toBeNull()
    // The carrier is not even asked about.
    expect(integrationMocks.list).not.toHaveBeenCalled()
    expect(deliveryMocks.configure).not.toHaveBeenCalled()
  })

  it('says it in Polish for a Polish business', async () => {
    country.code = 'PL'
    renderAt('/app/garage/orders/order-1', 'pl')

    expect(
      await screen.findByText(
        'Dostawa Nova Poshta jest dostępna tylko dla firm na Ukrainie.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Zorganizuj dostawę' }),
    ).toBeNull()
  })
})

describe('pure helpers', () => {
  it('limits Nova Poshta to Ukraine and unknown tenants', () => {
    expect(novaPoshtaAvailableIn(null)).toBe(true)
    expect(novaPoshtaAvailableIn('UA')).toBe(true)
    expect(novaPoshtaAvailableIn('GB')).toBe(false)
    expect(novaPoshtaAvailableIn('PL')).toBe(false)
  })

  it('suggests a phone example from the business country', () => {
    expect(phoneExample('GB')).toBe('+44 7700 900123')
    expect(phoneExample('PL')).toBe('+48 512 345 678')
    expect(phoneExample('UA')).toBe('+380 67 123 45 67')
    expect(phoneExample(null)).toBe('+380 67 123 45 67')
  })

  it('maps the country refusal and passes other messages through', () => {
    const refusal = {
      kind: 'conflict',
      status: 409,
      code: 'integration_country_unavailable',
      message: 'Integration is not available in this country.',
    }
    expect(deliveryProblemMessage(refusal, 'en-GB')).toBe(
      'Nova Poshta delivery is only available for businesses in Ukraine.',
    )
    expect(deliveryProblemMessage(refusal, 'uk')).toBe(
      'Доставка Новою поштою доступна лише для бізнесів в Україні.',
    )
    expect(
      deliveryProblemMessage(
        { kind: 'conflict', code: 'other', message: 'Server says no.' },
        'pl',
      ),
    ).toBe('Server says no.')
  })

  it('names statuses and events in each locale, Ukrainian by default', () => {
    expect(orderStatusPresentation('refunded').label).toBe('Повернено')
    expect(orderStatusPresentation('refunded', 'en-GB')).toEqual({
      label: 'Refunded',
      tone: 'info',
    })
    expect(orderStatusPresentation('confirmed', 'pl').label).toBe(
      'Potwierdzone',
    )
    expect(orderStatusPresentation('mystery', 'en-GB').label).toBe('mystery')
    expect(orderEventTitle('PaymentAccepted', 'en-GB')).toBe('Payment accepted')
    expect(orderEventTitle('Unheard', 'pl')).toBe('Zamówienie zaktualizowane')
  })
})
