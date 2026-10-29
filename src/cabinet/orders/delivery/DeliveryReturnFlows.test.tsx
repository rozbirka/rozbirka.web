/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { integrationsApi } from '@/api/integrations'
import type { OrderDetail } from '@/api/orders'
import { shippingApi, type Shipment } from '@/api/shipping'
import { DeliveryOrderBody, type DeliveryIntent } from './DeliveryOrderBody'
import type {
  DeliveryOrderLoad,
  DeliveryOrderState,
} from './use-delivery-order'

vi.mock('@/api/cash', () => ({
  cashApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'till-1',
        name: 'Основна каса',
        type: 'cash',
        isActive: true,
        balances: {},
      },
    ]),
    transactions: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'tx-out',
          type: 'manual_out',
          direction: 'out',
          amount: 9600,
          currency: 'UAH',
          note: 'ОП-2291',
          createdAt: '2026-10-30T10:00:00Z',
          createdByName: 'Олег',
          referenceId: null,
        },
      ],
    }),
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
    preferences: vi.fn(),
  },
}))
vi.mock('@/api/shipping', () => ({
  shippingApi: { get: vi.fn(), cancel: vi.fn(), refresh: vi.fn() },
}))
vi.mock('@/api/nova-poshta-setup', () => ({
  novaPoshtaSetupApi: { connections: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/api/delivery', () => ({
  deliveryApi: {
    get: vi.fn(),
    recordPayment: vi.fn(),
    linkPayment: vi.fn(),
    dispatch: vi.fn(),
    receive: vi.fn(),
    acceptReturn: vi.fn(),
    startReturn: vi.fn(),
    cancel: vi.fn(),
    confirmFullRefund: vi.fn(),
    recordLateCarrierPayment: vi.fn(),
  },
}))

const payment = (over: Partial<DeliveryOrder['payments'][number]> = {}) => ({
  id: 'pay-1',
  accountId: 'till-1',
  amountUah: 5400,
  feeUah: 0,
  netUah: 5400,
  kind: 'prepayment',
  recordedBy: 'Олег',
  createdAt: '2026-10-25T10:00:00Z',
  refundedAt: null,
  ...over,
})

const delivery = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
  orderId: 'order-1',
  agreedTotalUah: 9600,
  appliedUah: 5400,
  outstandingUah: 4200,
  netReceivedUah: 5400,
  feesUah: 0,
  requiredDepositUah: 300,
  depositShortfallUah: 0,
  depositSatisfied: true,
  depositWaived: false,
  depositRequired: true,
  customerTrusted: false,
  dispatchedAt: '2026-10-25T21:05:00Z',
  receivedAt: '2026-10-26T14:22:00Z',
  returnedAt: null,
  awaitingCodReconciliation: true,
  payments: [payment()],
  workflowState: 'Open',
  refundDueUah: 5400,
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
  state: 'Created',
  number: '20451200987731',
  sender: {
    name: 'Склад',
    phone: '+380',
    warehouseRef: 'w',
    settlementRef: 's',
  },
  draft: {
    recipient: {
      name: 'Ірина Коваль',
      phone: '+380672145508',
      warehouseRef: 'w2',
      settlementRef: 's2',
    },
    parcels: [{ lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 4.2 }],
    declaredValueUah: 9600,
    payerType: 'Recipient',
    description: 'Запчастини',
  },
  quoteUah: 128,
  returnEstimateUah: 128,
  codUah: 4200,
  quoteAt: null,
  trackingCode: '9',
  trackingStatus: 'Відправлення отримано',
  lastTrackedAt: '2026-10-26T14:22:00Z',
  relatedNumbers: [],
  events: [],
  dispatchedAt: '2026-10-25T21:05:00Z',
  receivedAt: '2026-10-26T14:22:00Z',
  paymentState: null,
  syncProblem: null,
  trackingEnabled: true,
  ...over,
})

const order: OrderDetail = {
  id: 'order-1',
  number: 361,
  status: 'pending',
  customerId: null,
  customerName: 'Ірина Коваль',
  notes: null,
  items: [
    {
      id: 'i1',
      partId: 'p1',
      partName: 'Фара передня ліва',
      partType: null,
      coverPhotoUrl: null,
      carBrand: null,
      carModel: null,
      carCode: null,
      quantity: 1,
      unitPrice: 100,
      totalPrice: 100,
    },
    {
      id: 'i2',
      partId: 'p2',
      partName: 'Колісний диск R17',
      partType: null,
      coverPhotoUrl: null,
      carBrand: null,
      carModel: null,
      carCode: null,
      quantity: 2,
      unitPrice: 100,
      totalPrice: 200,
    },
  ],
  payments: [],
  history: [],
  totalAmount: 9600,
  totalPaid: 0,
  paymentCurrency: null,
  createdAt: '2026-10-25T10:00:00Z',
  createdByName: 'Олег',
  cancelledAt: '2026-10-30T10:00:00Z',
}

const load = (state: Partial<DeliveryOrderState>): DeliveryOrderLoad => ({
  state: {
    money: delivery(),
    integrationId: 'int-1',
    carrier: null,
    points: [],
    shipment: shipment(),
    customerPhone: null,
    ...state,
  },
  error: null,
  setMoney: vi.fn(),
  setShipment: vi.fn(),
  reload: vi.fn(),
})

const renderBody = (
  value: DeliveryOrderLoad,
  {
    finance = true,
    intent = null,
  }: { finance?: boolean; intent?: DeliveryIntent | null } = {},
) =>
  render(
    <MemoryRouter>
      <DeliveryOrderBody
        customerPath={null}
        delivery={value.state!.money!}
        financeAllowed={finance}
        financePath="/app/koval/cash"
        integrationsPath="/app/koval/settings/integrations"
        intent={intent}
        load={value}
        mutationsAllowed
        onIntentHandled={() => undefined}
        order={order}
        partsPath={null}
        waybillsPath="/app/koval/sales/waybills"
      />
    </MemoryRouter>,
    { wrapper: ToastProvider },
  )

const paymentBlock = () => screen.getByRole('region', { name: 'Оплата' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(integrationsApi.preferences).mockResolvedValue({
    codCashRegisterId: 'till-1',
    senderCounterpartyRef: null,
    senderContactRef: null,
  })
})

it('keeps «received» and «paid» apart while the post-payment travels (9.2)', async () => {
  const user = userEvent.setup()
  renderBody(load({}))

  const block = paymentBlock()
  expect(within(block).getByText('Очікуємо післяплату')).toBeVisible()
  expect(
    await within(block).findByText(
      'Нова пошта ще не переказала післяплату. Зазвичай це 1–2 робочі дні; зарахуємо автоматично в «Основна каса».',
    ),
  ).toBeVisible()
  expect(
    within(block).getByRole('button', { name: 'Внести оплату' }),
  ).toBeVisible()

  await user.click(screen.getByRole('tab', { name: /Доставка/ }))
  expect(
    within(
      screen.getByRole('region', { name: 'Доставка · Нова пошта' }),
    ).getByText('Доставлено · Очікуємо післяплату'),
  ).toBeVisible()
})

it('asks for the post-payment by hand without a till and books it as cod (9.4, 9.8, 9.10)', async () => {
  vi.mocked(integrationsApi.preferences).mockResolvedValue({
    codCashRegisterId: null,
    senderCounterpartyRef: null,
    senderContactRef: null,
  })
  vi.mocked(deliveryApi.recordPayment).mockResolvedValue(
    delivery({
      outstandingUah: 0,
      appliedUah: 9600,
      workflowState: 'Completed',
    }),
  )
  const user = userEvent.setup()
  const value = load({
    shipment: shipment({ paymentState: 'CashRegisterRequired' }),
  })
  renderBody(value)

  const block = paymentBlock()
  expect(within(block).getByText('Внесіть вручну')).toBeVisible()
  expect(
    await within(block).findByText(/Для Нової пошти не обрано касу/),
  ).toBeVisible()
  await user.click(within(block).getByRole('button', { name: 'Внести оплату' }))

  const sheet = await screen.findByRole('dialog', { name: 'Внести оплату' })
  expect(sheet).toHaveTextContent(
    'Замовлення #361 · післяплата за ТТН 20451200987731',
  )
  expect(sheet).toHaveTextContent('Операція з’явиться у «Фінансах»')
  await user.click(
    within(sheet).getByRole('button', { name: /^Внести 4\s200,00/ }),
  )

  expect(deliveryApi.recordPayment).toHaveBeenCalledWith(
    'order-1',
    expect.objectContaining({
      amountUah: 4200,
      kind: 'cod',
      accountId: 'till-1',
    }),
    { idempotencyKey: expect.stringMatching(/^delivery-payment-/) as string },
  )
  expect(
    await screen.findByText(
      /Оплату 4\s200,00 UAH внесено\. Замовлення завершено\./,
    ),
  ).toBeVisible()
})

it('sends an ambiguous payout to Finance instead of marking it paid (9.6)', () => {
  renderBody(
    load({ shipment: shipment({ paymentState: 'NeedsReconciliation' }) }),
  )

  const block = paymentBlock()
  expect(within(block).getByText('Потрібна звірка')).toBeVisible()
  expect(within(block).getByText('Суми не збігаються')).toBeVisible()
  expect(
    within(block).getByRole('link', { name: 'Звірити у «Фінансах»' }),
  ).toHaveAttribute('href', '/app/koval/cash')
})

it('shows the money without buttons to a user without «Фінанси»', () => {
  renderBody(load({ shipment: shipment({ paymentState: null }) }), {
    finance: false,
  })

  const block = paymentBlock()
  expect(within(block).queryByRole('button')).toBeNull()
  expect(block).toHaveTextContent(
    'Вносити оплату й повертати кошти може користувач із правом «Фінанси».',
  )
})

it('starts a return only after the consequences are confirmed (10.2)', async () => {
  vi.mocked(deliveryApi.startReturn).mockResolvedValue(
    delivery({ workflowState: 'AwaitingGoods' }),
  )
  const user = userEvent.setup()
  const value = load({
    money: delivery({ outstandingUah: 0, workflowState: 'Completed' }),
  })
  renderBody(value, { intent: 'startReturn' })

  const dialog = await screen.findByRole('dialog', {
    name: 'Почати повернення?',
  })
  expect(dialog).toHaveTextContent('Замовлення #361 повернеться в роботу.')
  expect(dialog).toHaveTextContent(
    'Товар не повернеться в залишок, доки ви не підтвердите приймання.',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Почати повернення' }),
  )
  expect(deliveryApi.startReturn).toHaveBeenCalledWith('order-1')
  expect(value.setMoney).toHaveBeenCalledWith(
    expect.objectContaining({ workflowState: 'AwaitingGoods' }),
  )
})

it('waits for the goods and accepts only a full return (10.3–10.5)', async () => {
  vi.mocked(deliveryApi.acceptReturn).mockResolvedValue(
    delivery({ workflowState: 'AwaitingRefund', returnedAt: 'x' }),
  )
  const user = userEvent.setup()
  renderBody(
    load({
      money: delivery({ outstandingUah: 0, workflowState: 'AwaitingGoods' }),
      shipment: shipment({ relatedNumbers: ['20451201020045'] }),
    }),
  )

  const card = screen.getByRole('region', { name: 'Повернення' })
  const steps = within(card).getByRole('list', { name: 'Повернення' })
  expect(within(steps).getAllByRole('listitem')[0]).toHaveTextContent(
    'Повернення розпочатовиконано',
  )
  expect(within(steps).getAllByRole('listitem')[1]).toHaveAttribute(
    'aria-current',
    'step',
  )
  expect(card).toHaveTextContent(
    'Чекаємо посилку. ТТН повернення: 20451201020045.',
  )
  await user.click(within(card).getByRole('button', { name: 'Прийняти товар' }))

  const sheet = await screen.findByRole('dialog', {
    name: 'Прийняти повернення',
  })
  const confirm = within(sheet).getByRole('button', {
    name: 'Підтвердити повернення в наявність',
  })
  await user.click(
    within(sheet).getByRole('checkbox', { name: 'Фара передня ліва' }),
  )
  expect(confirm).toBeDisabled()
  expect(sheet).toHaveTextContent('Повернення неповне')
  expect(sheet).toHaveTextContent('Отримано 2 з 3 одиниць')

  await user.click(
    within(sheet).getByRole('checkbox', { name: 'Фара передня ліва' }),
  )
  expect(sheet).toHaveTextContent('3 з 3 одиниць')
  await user.click(confirm)
  expect(deliveryApi.acceptReturn).toHaveBeenCalledWith('order-1', {
    damaged: false,
    notes: '',
  })
})

it('refunds the whole amount after a final confirmation (10.6–10.8, 10.11)', async () => {
  vi.mocked(deliveryApi.confirmFullRefund).mockResolvedValue(
    delivery({ workflowState: 'Cancelled', refundDueUah: 0 }),
  )
  const user = userEvent.setup()
  renderBody(
    load({
      money: delivery({
        outstandingUah: 0,
        appliedUah: 9600,
        payments: [payment({ amountUah: 9600 })],
        refundDueUah: 9600,
        returnedAt: '2026-10-29T10:00:00Z',
        workflowState: 'AwaitingRefund',
      }),
    }),
  )

  const card = screen.getByRole('region', { name: 'Повернення' })
  expect(card).toHaveTextContent('3 одиниці в наявності')
  expect(card).toHaveTextContent(
    /Товар повернено в наявність\. Залишилось повернути клієнту 9\s600,00 UAH\./,
  )
  expect(
    within(paymentBlock()).getByText('Очікуємо повернення коштів'),
  ).toBeVisible()
  await user.click(
    within(card).getByRole('button', { name: 'Повернути кошти' }),
  )

  const sheet = await screen.findByRole('dialog', { name: 'Повернути кошти' })
  const amount = within(sheet).getByRole('textbox', { name: 'Сума' })
  await user.clear(amount)
  await user.type(amount, '9800')
  expect(amount).toHaveAccessibleDescription(/^Більше за залишок до повернення/)
  await user.clear(amount)
  await user.type(amount, '9600')
  await user.click(
    within(sheet).getByRole('button', { name: /^Зафіксувати повернення/ }),
  )

  const confirm = await screen.findByRole('dialog', {
    name: /^Зафіксувати повернення .+\?$/,
  })
  expect(confirm).toHaveTextContent('Rozbirka не переказує гроші')
  await user.click(
    within(confirm).getByRole('button', { name: /^Зафіксувати 9/ }),
  )
  expect(deliveryApi.confirmFullRefund).toHaveBeenCalledWith(
    'order-1',
    { accountId: 'till-1' },
    { idempotencyKey: expect.stringMatching(/^delivery-refund-/) as string },
  )
})

it('says when a linked expense already belongs to another order (10.9)', async () => {
  vi.mocked(deliveryApi.confirmFullRefund).mockRejectedValue({
    kind: 'conflict',
    code: 'refund_transaction_already_allocated',
    message: 'Цю операцію вже використано.',
  })
  const user = userEvent.setup()
  renderBody(
    load({
      money: delivery({
        outstandingUah: 0,
        payments: [payment({ amountUah: 9600 })],
        refundDueUah: 9600,
        returnedAt: 'x',
        workflowState: 'AwaitingRefund',
      }),
    }),
  )

  await user.click(screen.getByRole('button', { name: 'Повернути кошти' }))
  const sheet = await screen.findByRole('dialog', { name: 'Повернути кошти' })
  await user.click(
    within(sheet).getByRole('button', { name: 'Прив’язати наявну' }),
  )
  await user.click(
    await within(sheet).findByRole('button', { name: /ОП-2291/ }),
  )
  await user.click(
    within(sheet).getByRole('button', { name: 'Прив’язати операцію' }),
  )

  expect(deliveryApi.confirmFullRefund).toHaveBeenCalledWith(
    'order-1',
    { existingCashTransactionId: 'tx-out' },
    expect.any(Object),
  )
  expect(
    await within(sheet).findByText(
      'Операцію вже прив’язано до іншого замовлення.',
    ),
  ).toBeVisible()
})

it('cancels an unsent order through the waybill and the refund step (10.13)', async () => {
  vi.mocked(deliveryApi.cancel).mockResolvedValue(
    delivery({
      dispatchedAt: null,
      receivedAt: null,
      workflowState: 'AwaitingRefund',
    }),
  )
  const user = userEvent.setup()
  const value = load({
    money: delivery({ dispatchedAt: null, receivedAt: null }),
    shipment: shipment({
      dispatchedAt: null,
      receivedAt: null,
      trackingCode: '1',
    }),
  })
  renderBody(value, { intent: 'cancelOrder' })

  const dialog = await screen.findByRole('dialog', {
    name: 'Скасувати замовлення?',
  })
  expect(dialog).toHaveTextContent(
    'Спершу скасуємо ТТН 20451200987731 у Новій пошті.',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Скасувати замовлення' }),
  )
  expect(deliveryApi.cancel).toHaveBeenCalledWith('order-1')
  expect(value.setMoney).toHaveBeenCalledWith(
    expect.objectContaining({ workflowState: 'AwaitingRefund' }),
  )
})

it('keeps the order open when Nova Poshta did not confirm the cancel (10.14)', async () => {
  vi.mocked(deliveryApi.cancel).mockRejectedValue({
    kind: 'network',
    message: 'timeout',
  })
  vi.mocked(shippingApi.get).mockResolvedValue(
    shipment({ state: 'CancelUnknown', dispatchedAt: null, receivedAt: null }),
  )
  const user = userEvent.setup()
  const value = load({
    money: delivery({ dispatchedAt: null, receivedAt: null }),
    shipment: shipment({ dispatchedAt: null, receivedAt: null }),
  })
  renderBody(value, { intent: 'cancelOrder' })

  const dialog = await screen.findByRole('dialog', {
    name: 'Скасувати замовлення?',
  })
  await user.click(
    within(dialog).getByRole('button', { name: 'Скасувати замовлення' }),
  )
  expect(value.setShipment).toHaveBeenCalledWith(
    expect.objectContaining({ state: 'CancelUnknown' }),
  )
})

it('asks to book and refund money the carrier paid after cancellation (10.16)', async () => {
  vi.mocked(deliveryApi.recordLateCarrierPayment).mockResolvedValue(
    delivery({ workflowState: 'Cancelled' }),
  )
  vi.mocked(shippingApi.get).mockResolvedValue(shipment())
  const user = userEvent.setup()
  renderBody(
    load({
      money: delivery({
        outstandingUah: 9600,
        appliedUah: 0,
        payments: [payment({ refundedAt: '2026-10-30T10:00:00Z' })],
        refundDueUah: 0,
        returnedAt: '2026-10-29T10:00:00Z',
        workflowState: 'Cancelled',
      }),
      shipment: shipment({ paymentState: 'LatePaymentNeedsRefund' }),
    }),
  )

  const card = screen.getByRole('region', { name: 'Повернення' })
  expect(card).toHaveTextContent('Замовлення скасованоз 30.10.2026')
  const block = paymentBlock()
  expect(
    within(block).getByText('Потрібно повернути отримані кошти'),
  ).toBeVisible()
  await user.click(
    within(block).getByRole('button', { name: 'Зафіксувати надходження' }),
  )

  const sheet = await screen.findByRole('dialog', {
    name: 'Зафіксувати надходження',
  })
  await user.click(
    within(sheet).getByRole('button', { name: 'Зафіксувати надходження' }),
  )
  expect(deliveryApi.recordLateCarrierPayment).toHaveBeenCalledWith(
    'order-1',
    { shipmentId: 'ship-1', amountUah: 4200, feeUah: 0, accountId: 'till-1' },
    { idempotencyKey: expect.stringMatching(/^delivery-late-/) as string },
  )
})
