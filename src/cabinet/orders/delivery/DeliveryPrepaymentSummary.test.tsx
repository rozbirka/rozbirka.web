import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import type { DeliveryOrder } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'
import { DeliveryPaymentBlock } from './DeliveryPaymentBlock'
import { WaybillCreateSheet } from './WaybillCreateSheet'

const money = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
  orderId: 'order-1',
  agreedTotalUah: 9600,
  appliedUah: 5400,
  outstandingUah: 4200,
  netReceivedUah: 5400,
  feesUah: 0,
  requiredDepositUah: 224,
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
  workflowState: 'Open',
  refundDueUah: 0,
  refundAllocations: [],
  ...over,
})

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'ship-1',
  integrationId: 'int-1',
  dispatchPointId: 'point-1',
  connectionId: null,
  orderId: 'order-1',
  version: 'v1',
  state: 'Draft',
  number: null,
  sender: {
    name: 'ФОП Коваль Олег Петрович',
    phone: '+380672147730',
    warehouseRef: 'w-12',
    settlementRef: 's-kyiv',
    warehouseName: 'Відділення №12 (до 30 кг): вул. Богатирська, 6',
    settlementName: 'Київ',
  },
  draft: {
    recipient: {
      name: 'Ірина Коваль',
      phone: '+380672145508',
      warehouseRef: 'w-5',
      settlementRef: 's-lviv',
      warehouseName: 'Відділення №5: вул. Городоцька, 120',
      settlementName: 'Львів',
    },
    parcels: [{ lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 4.2 }],
    declaredValueUah: 9600,
    payerType: 'Recipient',
    description: 'Автозапчастини',
    dispatchPointId: 'point-1',
  },
  quoteUah: 128,
  returnEstimateUah: 96,
  codUah: null,
  quoteAt: new Date().toISOString(),
  trackingCode: null,
  trackingStatus: null,
  lastTrackedAt: null,
  relatedNumbers: [],
  events: [],
  dispatchedAt: null,
  receivedAt: null,
  paymentState: null,
  syncProblem: null,
  trackingEnabled: true,
  ...over,
})

const showConfirmation = (delivery: DeliveryOrder, current = shipment()) => {
  render(
    <WaybillCreateSheet
      delivery={delivery}
      integrationId="int-1"
      onClose={vi.fn()}
      onCreated={vi.fn()}
      onReconcile={vi.fn()}
      onShipment={vi.fn()}
      orderId="order-1"
      orderNumber={361}
      shipment={current}
    />,
  )
  return screen.getByRole('dialog', { name: 'Створити ТТН' })
}

it('shows the required amount and actual customer payment even when the minimum is exceeded', () => {
  const delivery = money({
    requiredDepositUah: 186,
    appliedUah: 500,
    netReceivedUah: 500,
    outstandingUah: 9100,
  })
  render(
    <MemoryRouter>
      <DeliveryPaymentBlock
        actions={{ record: vi.fn(), refund: vi.fn(), late: vi.fn() }}
        busy={false}
        canPay
        financePath={null}
        codTill={undefined}
        delivery={delivery}
        shipment={shipment()}
        tillName={() => null}
      />
    </MemoryRouter>,
  )
  const payment = screen.getByRole('region', { name: 'Оплата' })
  expect(
    within(payment).getByText('Мінімальна передоплата').closest('div'),
  ).toHaveTextContent('186,00 UAH')
  expect(
    within(payment).getByText('Отримано від клієнта').closest('div'),
  ).toHaveTextContent('500,00 UAH')
  expect(payment).toHaveTextContent('Додаткова передоплата не потрібна')
})

it('shows received and required amounts in confirmation without treating the quote as payment', () => {
  const sheet = showConfirmation(
    money({
      requiredDepositUah: 186,
      appliedUah: 500,
      netReceivedUah: 500,
      outstandingUah: 9100,
    }),
  )
  expect(
    within(sheet).getByText('Мінімальна передоплата').closest('div'),
  ).toHaveTextContent('186 UAH')
  expect(
    within(sheet).getByText('Отримано від клієнта').closest('div'),
  ).toHaveTextContent('500 UAH')
  expect(sheet).toHaveTextContent('Додаткова передоплата не потрібна')
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeEnabled()
})

it('explains the unpaid shortfall visibly beside the blocked create action', () => {
  const sheet = showConfirmation(
    money({
      requiredDepositUah: 186,
      appliedUah: 0,
      netReceivedUah: 0,
      depositSatisfied: false,
      depositShortfallUah: 186,
    }),
  )
  expect(sheet).toHaveTextContent(
    'Спершу отримайте мінімальну передоплату, щоб створити ТТН.',
  )
  expect(sheet).toHaveTextContent('Залишилось внести: 186 UAH')
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeDisabled()
})

it('revokes the visible exception and blocks creation when customer trust is withdrawn', () => {
  const sheet = showConfirmation(
    money({
      depositWaived: true,
      customerTrusted: false,
      depositSatisfied: false,
      requiredDepositUah: 186,
      depositShortfallUah: 186,
      appliedUah: 0,
    }),
  )
  expect(
    within(sheet).queryByText('Без передоплати для довіреного клієнта'),
  ).not.toBeInTheDocument()
  expect(sheet).toHaveTextContent('Залишилось внести: 186 UAH')
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeDisabled()
})

it('keeps optional prepayment details behind a keyboard-operable disclosure', async () => {
  const user = userEvent.setup()
  const sheet = showConfirmation(money())
  const toggle = within(sheet).getByRole('button', { name: 'Докладніше' })
  const explanation = within(sheet).getByText(
    /Отримані кошти зараховуються в оплату замовлення/,
  )
  expect(explanation).not.toBeVisible()
  toggle.focus()
  await user.keyboard('{Enter}')
  expect(explanation).toBeVisible()
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
})

it('allows creation with a fresh quote whose amount is hidden by finance permissions', () => {
  const sheet = showConfirmation(money(), shipment({ quoteUah: null }))
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeEnabled()
})

it('shows the effective minimum capped at the agreed order total', () => {
  const sheet = showConfirmation(
    money({
      agreedTotalUah: 100,
      requiredDepositUah: 186,
      appliedUah: 100,
      outstandingUah: 0,
    }),
  )
  expect(
    within(sheet).getByText('Мінімальна передоплата').closest('div'),
  ).toHaveTextContent('100 UAH')
  expect(sheet).toHaveTextContent('Додаткова передоплата не потрібна')
})

it.each([
  {
    depositRequired: true,
    depositWaived: true,
    expected: 'Без передоплати для довіреного клієнта',
  },
  {
    depositRequired: false,
    depositWaived: false,
    expected: 'Розбірка відправляє без обов’язкової передоплати',
  },
])(
  'does not present an exception as received payment: $expected',
  ({ depositRequired, depositWaived, expected }) => {
    const sheet = showConfirmation(
      money({
        depositRequired,
        depositWaived,
        customerTrusted: depositWaived,
        appliedUah: 0,
        netReceivedUah: 0,
        outstandingUah: 9600,
        depositSatisfied: false,
        depositShortfallUah: 186,
      }),
    )
    expect(within(sheet).getByText(expected)).toBeVisible()
    expect(
      within(sheet).getByText('Отримано від клієнта').closest('div'),
    ).toHaveTextContent('0 UAH')
    expect(
      within(sheet).getByRole('button', { name: 'Створити ТТН' }),
    ).toBeEnabled()
  },
)
