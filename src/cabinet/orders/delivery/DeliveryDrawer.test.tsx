/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi } from '@/api/integrations'
import type { DeliveryOrder } from '@/api/delivery'
import { shippingApi, type Shipment } from '@/api/shipping'
import { LocaleProvider } from '@/i18n'
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
  settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
  warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
  counterpartyRef: '5ace4a2e-13ee-11e5-add9-005056887b8d',
  contactRef: '5ace4a2e-13ee-11e5-add9-005056887b8e',
  warehouseName: 'Відділення №8: вул. Наукова, 45',
  settlementName: 'Львів',
  companyTin: null,
  companyName: null,
  isActive: true,
  isDefault: true,
}

const draft = {
  recipient: {
    name: 'Ірина Олійник',
    phone: '+380503381172',
    warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
    settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
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
    warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
    settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
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
        ref: '8d5a980d-391c-11dd-90d9-001a92567626',
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
        ref: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
        name: 'Відділення №8: вул. Наукова, 45',
        settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
        countryCode: 'UA',
        sendingAllowed: true,
        receivingAllowed: true,
      },
    ],
    page: 1,
    lastPage: 1,
  })
})

const money = (): DeliveryOrder => ({
  orderId: 'order-1',
  agreedTotalUah: 4280,
  appliedUah: 4280,
  outstandingUah: 0,
  netReceivedUah: 4280,
  feesUah: 0,
  requiredDepositUah: 360,
  depositShortfallUah: 0,
  depositSatisfied: true,
  depositWaived: false,
  depositRequired: true,
  customerTrusted: false,
  dispatchedAt: null,
  receivedAt: null,
  returnedAt: null,
  awaitingCodReconciliation: false,
  payments: [],
})

const renderDrawer = (current: Shipment | null) =>
  render(
    <DeliveryDrawer
      customerName="Ірина Олійник"
      customerPhone="+380503381172"
      declaredValue={4280}
      delivery={money()}
      paid={null}
      dispatchPoints={[point]}
      integrationId="integration-1"
      onChanged={vi.fn()}
      onClose={vi.fn()}
      onMoneyChanged={vi.fn()}
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

  const declared = await screen.findByLabelText(/Оголошена вартість/)
  await user.clear(declared)
  await user.type(declared, '4400')
  await user.click(screen.getByRole('button', { name: 'Розрахувати доставку' }))

  expect(shippingApi.saveDraft).toHaveBeenCalledWith(
    'integration-1',
    'order-1',
    expect.objectContaining({ declaredValueUah: 4400, payerType: 'Recipient' }),
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

it('shows the prepayment as both legs the carrier priced', async () => {
  renderDrawer(shipment({ quoteUah: 180, quoteAt: new Date().toISOString() }))

  expect(await screen.findByText('Розрахунок отримано')).toBeVisible()
  expect(screen.getByText('Необхідна передоплата')).toBeVisible()
  expect(screen.getByText(/^360\sUAH$/)).toBeVisible()
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

it('books in British English with a phone example from the business country', async () => {
  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <DeliveryDrawer
        countryCode="GB"
        customerName="Ірина Олійник"
        customerPhone={null}
        declaredValue={4280}
        delivery={money()}
        paid={null}
        dispatchPoints={[point]}
        integrationId="integration-1"
        onChanged={vi.fn()}
        onClose={vi.fn()}
        onMoneyChanged={vi.fn()}
        orderId="order-1"
        shipment={null}
      />
    </LocaleProvider>,
  )

  expect(
    await screen.findByRole('dialog', { name: 'Book shipment' }),
  ).toBeVisible()
  expect(screen.getByLabelText(/^Phone/)).toHaveAttribute(
    'placeholder',
    '+44 7700 900123',
  )
  expect(screen.getByText('Delivery cost')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Get delivery quote' }),
  ).toBeDisabled()
  expect(screen.getByLabelText(/Description of contents/)).toHaveValue(
    'Car parts',
  )
})
