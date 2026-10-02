import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import type { DeliveryOrder } from '@/api/delivery'
import type { OrderDetail } from '@/api/orders'
import type { Shipment } from '@/api/shipping'
import { DeliveryOrderBody } from './DeliveryOrderBody'
import type {
  DeliveryOrderLoad,
  DeliveryOrderState,
} from './use-delivery-order'

vi.mock('@/api/cash', () => ({
  cashApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'till-1',
        name: 'ФОП Nova Pay',
        type: 'bank',
        isActive: true,
        balances: {},
      },
    ]),
    transactions: vi.fn().mockResolvedValue({ items: [] }),
  },
}))
vi.mock('@/api/customers', () => ({
  customersApi: { getById: vi.fn().mockResolvedValue({ phone: null }) },
}))
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
    attach: vi.fn(),
    cancel: vi.fn(),
    label: vi.fn(),
  },
}))
const recordPayment = vi.hoisted(() => vi.fn())

vi.mock('@/api/delivery', () => ({
  deliveryApi: {
    get: vi.fn(),
    configure: vi.fn(),
    recordPayment,
    linkPayment: vi.fn(),
    dispatch: vi.fn(),
    receive: vi.fn(),
    acceptReturn: vi.fn(),
  },
}))

const delivery = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
  orderId: 'order-1',
  agreedTotalUah: 4600,
  appliedUah: 4600,
  outstandingUah: 0,
  netReceivedUah: 4600,
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
  payments: [
    {
      id: 'pay-1',
      accountId: 'till-1',
      amountUah: 4600,
      feeUah: 0,
      netUah: 4600,
      kind: 'prepayment',
      recordedBy: 'Дмитро',
      createdAt: '2026-09-21T11:02:00Z',
      refundedAt: null,
    },
  ],
  ...over,
})

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'ship-1',
  integrationId: 'int-1',
  dispatchPointId: 'point-1',
  orderId: 'order-1',
  state: 'Created',
  number: '20451931 5540',
  sender: {
    name: 'Склад',
    phone: '+380',
    warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
    settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
  },
  draft: {
    recipient: {
      name: 'Ірина Олійник',
      phone: '+380503381172',
      warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
      settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
    },
    parcels: [{ lengthCm: 60, widthCm: 40, heightCm: 35, weightKg: 42 }],
    declaredValueUah: 4600,
    payerType: 'Recipient',
    description: 'Запчастини',
  },
  quoteUah: 180,
  returnEstimateUah: 180,
  codUah: 0,
  quoteAt: new Date().toISOString(),
  trackingCode: null,
  trackingStatus: null,
  lastTrackedAt: null,
  relatedNumbers: [],
  events: [],
  ...over,
})

const order: OrderDetail = {
  id: 'order-1',
  number: 355,
  status: 'pending',
  customerId: 'cust-1',
  customerName: 'Ірина Олійник',
  notes: null,
  items: [
    {
      id: 'i1',
      partId: 'p1',
      partName: 'Двигун 1.9 TDI AXR',
      partType: 'Двигун',
      coverPhotoUrl: null,
      carBrand: 'VW',
      carModel: 'Passat B5',
      carCode: 'AA 1234 BB',
      quantity: 1,
      unitPrice: 3200,
      totalPrice: 3200,
    },
  ],
  payments: [],
  history: [],
  totalAmount: 4600,
  totalPaid: 0,
  paymentCurrency: null,
  createdAt: '2026-09-21T11:04:00Z',
  createdByName: 'Дмитро',
}

/** An active dispatch point, so the settings half of readiness passes. */
const point = () => ({
  id: 'point-1',
  name: 'Головний склад',
  senderName: 'Олена Коваль',
  phone: '+380672147730',
  settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
  warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002cf',
  counterpartyRef: '5ace4a2e-13ee-11e5-add9-005056887b8d',
  contactRef: '5ace4a2e-13ee-11e5-add9-005056887b8e',
  warehouseName: 'Відділення №12',
  settlementName: 'Житомир',
  companyTin: null,
  companyName: null,
  isActive: true,
  isDefault: true,
})

const load = (state: Partial<DeliveryOrderState>): DeliveryOrderLoad => ({
  state: {
    money: delivery(),
    integrationId: 'int-1',
    carrier: null,
    points: [],
    shipment: null,
    customerPhone: null,
    ...state,
  },
  error: null,
  setMoney: vi.fn(),
  setShipment: vi.fn(),
  reload: vi.fn(),
})

const renderBody = (value: DeliveryOrderLoad) =>
  render(
    <MemoryRouter>
      <DeliveryOrderBody
        customerPath="/app/koval/customers/cust-1"
        delivery={value.state!.money!}
        financeAllowed
        integrationsPath="/app/koval/settings/integrations"
        load={value}
        mutationsAllowed
        order={order}
        partsPath="/app/koval/parts"
      />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

it('opens on what was sold and keeps the parcel behind its own tab', async () => {
  const user = userEvent.setup()
  renderBody(load({ shipment: shipment() }))

  expect(screen.getByRole('region', { name: 'Позиції' })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Нова пошта' })).toBeNull()

  await user.click(screen.getByRole('tab', { name: /Доставка/ }))
  expect(screen.getByRole('region', { name: 'Нова пошта' })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Позиції' })).toBeNull()
})

it('names the till behind a payment once the cash module answers', async () => {
  renderBody(load({}))

  const payments = screen.getByRole('region', { name: 'Платежі' })
  // The payment record carries only an account id; the name is looked up.
  expect(await within(payments).findByText(/ФОП Nova Pay/)).toBeVisible()
})

it('sums an order from its parts and keeps the hryvnia figure out of it', () => {
  renderBody(load({}))

  const items = screen.getByRole('region', { name: 'Позиції' })
  // The line's own sum and the card total — both in the order's currency.
  expect(within(items).getAllByText('3 200,00 $')).toHaveLength(2)
  // What the carrier collects is a different number about a different thing,
  // and it does not belong beside the price of the goods.
  expect(items).not.toHaveTextContent('₴')
})

it('offers only the step the order is waiting for', () => {
  renderBody(load({ shipment: shipment() }))

  expect(
    screen.getByRole('button', { name: 'Передати перевізнику' }),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Створити ТТН' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Внести оплату' })).toBeNull()
})

it('offers payment without pretending it is required before a waybill', () => {
  renderBody(
    load({ money: delivery({ outstandingUah: 1200, appliedUah: 3400 }) }),
  )

  const due = screen.getByRole('region', { name: 'До сплати' })
  expect(
    within(due).getByRole('button', { name: 'Внести оплату' }),
  ).toBeVisible()
  expect(due).toHaveTextContent(/післяплат/i)
})

it('reuses a delivery payment key after an ambiguous failure and rotates it after success', async () => {
  const randomUUID = vi
    .spyOn(globalThis.crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
  recordPayment
    .mockRejectedValueOnce({ kind: 'network', message: 'Мережа зникла.' })
    .mockResolvedValue(delivery({ outstandingUah: 0, appliedUah: 4600 }))
  const user = userEvent.setup()
  renderBody(
    load({ money: delivery({ outstandingUah: 1200, appliedUah: 3400 }) }),
  )

  await user.click(
    within(screen.getByRole('region', { name: 'До сплати' })).getByRole(
      'button',
      { name: 'Внести оплату' },
    ),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Зберегти платіж' }),
  )
  expect(await screen.findAllByText('Мережа зникла.')).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Зберегти платіж' }))
  expect(recordPayment).toHaveBeenNthCalledWith(
    1,
    'order-1',
    expect.any(Object),
    {
      idempotencyKey: 'delivery-payment-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(recordPayment).toHaveBeenNthCalledWith(
    2,
    'order-1',
    expect.any(Object),
    {
      idempotencyKey: 'delivery-payment-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(randomUUID).toHaveBeenCalledOnce()

  await user.click(
    within(screen.getByRole('region', { name: 'До сплати' })).getByRole(
      'button',
      { name: 'Внести оплату' },
    ),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Зберегти платіж' }),
  )
  expect(recordPayment).toHaveBeenNthCalledWith(
    3,
    'order-1',
    expect.any(Object),
    {
      idempotencyKey: 'delivery-payment-00000000-0000-4000-8000-000000000002',
    },
  )
  expect(randomUUID).toHaveBeenCalledTimes(2)
  randomUUID.mockRestore()
})

it('keeps the money half working while the carrier is out of reach', async () => {
  const user = userEvent.setup()
  renderBody(
    load({
      integrationId: null,
      carrier: { status: 'error', errorCode: 'integration_account_unverified' },
    }),
  )

  // The order is still a delivery order: its money and steps are Core's.
  expect(screen.getByRole('region', { name: 'Платежі' })).toBeVisible()

  await user.click(screen.getByRole('tab', { name: /Доставка/ }))
  expect(screen.getByText(/Нова пошта недоступна/)).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Відкрити інтеграції' }),
  ).toHaveAttribute('href', '/app/koval/settings/integrations')
  expect(
    screen.queryByRole('button', { name: 'Оформити доставку' }),
  ).not.toBeInTheDocument()
})

it('lets an unpaid, uncalculated order reach the booking drawer', async () => {
  const user = userEvent.setup()
  // Nothing paid and nothing calculated — which used to be two red crosses and
  // a disabled button, locking the order out of the screen that fixes both.
  renderBody(
    load({
      money: delivery({ outstandingUah: 1200, requiredDepositUah: 0 }),
      points: [point()],
    }),
  )

  await user.click(screen.getByRole('tab', { name: /Доставка/ }))
  await user.click(screen.getByRole('button', { name: 'Оформити доставку' }))

  const drawer = await screen.findByRole('dialog', {
    name: 'Перевірка перед створенням ТТН',
  })
  expect(drawer).toHaveTextContent('Наступний крок — розрахувати доставку')
  expect(
    within(drawer).getByRole('button', { name: 'Продовжити оформлення' }),
  ).toBeEnabled()
})

it('stops only at what the booking drawer cannot fix', async () => {
  const user = userEvent.setup()
  // No active dispatch point: that one lives in settings, not on the next step.
  renderBody(load({ money: delivery({ outstandingUah: 1200 }), points: [] }))

  await user.click(screen.getByRole('tab', { name: /Доставка/ }))
  await user.click(screen.getByRole('button', { name: 'Оформити доставку' }))

  const drawer = await screen.findByRole('dialog', {
    name: 'Перевірка перед створенням ТТН',
  })
  expect(drawer).toHaveTextContent('Спершу треба виправити налаштування')
  expect(
    within(drawer).getByRole('button', { name: 'Продовжити оформлення' }),
  ).toBeDisabled()
})
