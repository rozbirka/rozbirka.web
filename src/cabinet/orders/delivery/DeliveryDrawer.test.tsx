/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi } from '@/api/integrations'
import { shippingApi, type Shipment } from '@/api/shipping'
import { DeliveryDrawer } from './DeliveryDrawer'

vi.mock('@/api/integrations', () => ({
  integrationsApi: { settlements: vi.fn(), divisions: vi.fn() },
}))
vi.mock('@/api/shipping', () => ({
  shippingApi: {
    saveDraft: vi.fn(),
    estimate: vi.fn(),
    create: vi.fn(),
  },
}))

const point = {
  id: 'point-1',
  name: 'Головний склад',
  senderName: 'Олена Коваль',
  phone: '+380672147730',
  settlementId: 10,
  divisionId: 12,
  companyTin: null,
  companyName: null,
  isActive: true,
  isDefault: true,
}

const draft = {
  recipient: {
    name: 'Ірина Олійник',
    phone: '+380503381172',
    divisionId: 8,
    settlementId: 20,
    companyName: null,
    companyTin: null,
  },
  parcels: [{ lengthCm: 40, widthCm: 30, heightCm: 22, weightKg: 4.2 }],
  declaredValueUah: 4280,
  returnEstimateUah: 180,
  payerType: 'Recipient' as const,
  description: 'Автозапчастини',
  dispatchPointId: 'point-1',
}

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'shipment-1',
  integrationId: 'integration-1',
  dispatchPointId: 'point-1',
  orderId: 'order-1',
  state: 'Draft',
  number: null,
  sender: {
    name: 'Олена Коваль',
    phone: '+380672147730',
    divisionId: 12,
    settlementId: 10,
  },
  draft,
  quoteUah: null,
  returnEstimateUah: 180,
  codUah: null,
  quoteAt: null,
  trackingCode: null,
  trackingStatus: null,
  lastTrackedAt: null,
  relatedNumbers: [],
  events: [],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(integrationsApi.settlements).mockResolvedValue({
    items: [
      {
        id: 20,
        name: 'Львів',
        prohibitedSending: null,
        prohibitedIssuance: null,
      },
    ],
    page: 1,
    lastPage: 1,
  })
  vi.mocked(integrationsApi.divisions).mockResolvedValue({
    items: [
      {
        id: 8,
        name: 'Відділення №8: вул. Наукова, 45',
        settlementId: 20,
        countryCode: 'UA',
        sendingAllowed: true,
        receivingAllowed: true,
      },
    ],
    page: 1,
    lastPage: 1,
  })
})

const renderDrawer = (current: Shipment | null) =>
  render(
    <DeliveryDrawer
      customerName="Ірина Олійник"
      customerPhone="+380503381172"
      declaredValue={4280}
      dispatchPoints={[point]}
      integrationId="integration-1"
      onChanged={vi.fn()}
      onClose={vi.fn()}
      orderId="order-1"
      shipment={current}
    />,
  )

it('will not create a waybill before the carrier has quoted the form', async () => {
  renderDrawer(shipment())

  const create = await screen.findByRole('button', { name: 'Створити ТТН' })
  expect(create).toBeDisabled()
  expect(create).toHaveAccessibleDescription(/лише за свіжим розрахунком/)
  expect(
    screen.getByRole('button', { name: 'Розрахувати доставку' }),
  ).toBeEnabled()
})

it('saves an edited form before asking the carrier for a price', async () => {
  vi.mocked(shippingApi.saveDraft).mockResolvedValue(shipment())
  vi.mocked(shippingApi.estimate).mockResolvedValue(
    shipment({ quoteUah: 180, quoteAt: new Date().toISOString() }),
  )
  const user = userEvent.setup()

  renderDrawer(shipment())

  const estimateField = await screen.findByLabelText(/Оцінка повернення/)
  await user.clear(estimateField)
  await user.type(estimateField, '240')
  await user.click(screen.getByRole('button', { name: 'Розрахувати доставку' }))

  expect(shippingApi.saveDraft).toHaveBeenCalledWith(
    'integration-1',
    'order-1',
    expect.objectContaining({ returnEstimateUah: 240, payerType: 'Recipient' }),
  )
  expect(shippingApi.estimate).toHaveBeenCalledWith('integration-1', 'order-1')
})

it('does not re-save a form nobody touched', async () => {
  vi.mocked(shippingApi.estimate).mockResolvedValue(
    shipment({ quoteUah: 180, quoteAt: new Date().toISOString() }),
  )
  const user = userEvent.setup()

  renderDrawer(shipment())

  await user.click(
    await screen.findByRole('button', { name: 'Розрахувати доставку' }),
  )

  expect(shippingApi.saveDraft).not.toHaveBeenCalled()
  expect(shippingApi.estimate).toHaveBeenCalledWith('integration-1', 'order-1')
})

it('shows the prepayment as delivery plus the return the manager entered', async () => {
  renderDrawer(shipment({ quoteUah: 180, quoteAt: new Date().toISOString() }))

  expect(await screen.findByText('Розрахунок отримано')).toBeVisible()
  expect(screen.getByText('Необхідна передоплата')).toBeVisible()
  expect(screen.getByText('360 ₴')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Створити ТТН' })).toBeEnabled()
})

it('stops offering a waybill on a quote that is a day old', async () => {
  renderDrawer(
    shipment({
      quoteUah: 180,
      quoteAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    }),
  )

  expect(await screen.findByText('Розрахунок застарів')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Створити ТТН' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Перерахувати' })).toBeEnabled()
})
