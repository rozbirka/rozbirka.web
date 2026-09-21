/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi } from '@/api/integrations'
import { shippingApi, type Shipment } from '@/api/shipping'
import { DeliverySection } from './DeliverySection'

vi.mock('@/api/integrations', () => ({
  integrationsApi: {
    list: vi.fn(),
    dispatchPoints: vi.fn(),
    settlements: vi.fn(),
    divisions: vi.fn(),
  },
}))
vi.mock('@/api/shipping', () => ({
  shippingApi: {
    get: vi.fn(),
    saveDraft: vi.fn(),
    estimate: vi.fn(),
    create: vi.fn(),
    refresh: vi.fn(),
    cancel: vi.fn(),
  },
}))
vi.mock('@/api/customers', () => ({
  customersApi: { getById: vi.fn(() => Promise.resolve({ phone: null })) },
}))

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'shipment-1',
  integrationId: 'integration-1',
  dispatchPointId: 'point-1',
  orderId: 'order-1',
  state: 'Created',
  number: '2045 1938 4471',
  sender: {
    name: 'Олена Коваль',
    phone: '+380672147730',
    divisionId: 12,
    settlementId: 10,
  },
  draft: {
    recipient: {
      name: 'Ірина Олійник',
      phone: '+380503381172',
      divisionId: 8,
      settlementId: 20,
    },
    parcels: [{ lengthCm: 40, widthCm: 30, heightCm: 22, weightKg: 4.2 }],
    declaredValueUah: 4280,
    returnEstimateUah: 180,
    payerType: 'Recipient',
    description: 'Автозапчастини',
  },
  quoteUah: 180,
  returnEstimateUah: 180,
  codUah: null,
  quoteAt: new Date().toISOString(),
  trackingCode: null,
  trackingStatus: 'В дорозі',
  lastTrackedAt: null,
  relatedNumbers: [],
  events: [
    {
      code: 'in_transit',
      name: 'Прямує до відділення отримувача',
      occurredAt: '2026-09-21T09:31:00Z',
      recordedAt: '2026-09-21T09:31:05Z',
    },
  ],
  ...over,
})

const activeIntegration = {
  id: 'integration-1',
  definitionId: 'definition-np',
  code: 'nova_poshta',
  displayName: 'Нова пошта',
  status: 'active',
  configured: true,
  verifiedAt: '2026-09-21T09:00:00Z',
  lastErrorCode: null,
  settings: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(integrationsApi.list).mockResolvedValue([activeIntegration])
  vi.mocked(integrationsApi.dispatchPoints).mockResolvedValue([])
  vi.mocked(shippingApi.get).mockResolvedValue(null)
})

const renderSection = (mutationsAllowed = true) =>
  render(
    <DeliverySection
      customerId="customer-1"
      customerName="Ірина Олійник"
      mutationsAllowed={mutationsAllowed}
      orderId="order-1"
      totalAmount={4280}
    />,
  )

it('stays out of the order card when the yard has no active carrier', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([
    { ...activeIntegration, status: 'inactive' },
  ])

  const { container } = renderSection()

  await vi.waitFor(() => expect(integrationsApi.list).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
  expect(shippingApi.get).not.toHaveBeenCalled()
})

it('shows the waybill with the carrier status once delivery exists', async () => {
  vi.mocked(shippingApi.get).mockResolvedValue(shipment())

  renderSection()

  expect(await screen.findByText('2045 1938 4471')).toBeVisible()
  expect(screen.getByText('ТТН створено')).toBeVisible()
  expect(screen.getByText('В дорозі')).toBeVisible()
  expect(screen.getByText('Прямує до відділення отримувача')).toBeVisible()
  expect(
    screen.getByText(/Статус доставки й статус оплати не повʼязані/),
  ).toBeVisible()
})

it('keeps an unknown creation result from being repeated', async () => {
  vi.mocked(shippingApi.get).mockResolvedValue(
    shipment({ state: 'Unknown', number: null }),
  )
  vi.mocked(shippingApi.refresh).mockResolvedValue(shipment())
  const user = userEvent.setup()

  renderSection()

  expect(await screen.findByText(/Накладна могла створитися/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Оформити доставку' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Перевірити результат' }))

  expect(shippingApi.refresh).toHaveBeenCalledWith('integration-1', 'order-1')
  expect(await screen.findByText('2045 1938 4471')).toBeVisible()
})

it('offers booking only to someone who may change the order', async () => {
  renderSection(false)

  expect(await screen.findByText('Доставка ще не оформлена.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Оформити доставку' })).toBeNull()
})
