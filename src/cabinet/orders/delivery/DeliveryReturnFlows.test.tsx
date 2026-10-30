/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import type * as DeliveryModule from '@/api/delivery'
import { cashApi } from '@/api/cash'
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
        balances: { UAH: 0 },
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
  retainedDeliveryCostUah: 0,
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
    disconnected: null,
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
  expect(
    within(
      screen.getByRole('region', { name: 'Доставка · Нова пошта' }),
    ).getByText('дорівнює залишку'),
  ).toBeVisible()
})

it.each(['9', '11'])(
  'keeps the historical COD amount without comparing it to the settled balance at carrier status %s',
  async (trackingCode) => {
    const user = userEvent.setup()
    renderBody(
      load({
        money: delivery({
          appliedUah: 9600,
          outstandingUah: 0,
          netReceivedUah: 9600,
          awaitingCodReconciliation: false,
          workflowState: 'Completed',
          payments: [
            payment(),
            payment({
              id: 'pay-cod',
              kind: 'cod',
              amountUah: 4200,
              netUah: 4200,
            }),
          ],
        }),
        shipment: shipment({ trackingCode, paymentState: 'Reconciled' }),
      }),
    )

    await user.click(screen.getByRole('tab', { name: /Доставка/ }))
    const block = screen.getByRole('region', { name: 'Доставка · Нова пошта' })
    const codRow = within(block).getByText('Післяплата').closest('div')!
    expect(codRow).toHaveTextContent(/4\s200,00 UAH/)
    expect(codRow).not.toHaveTextContent('залишку')
  },
)

it('still warns when a live waybill COD no longer matches the balance before receipt', async () => {
  const user = userEvent.setup()
  renderBody(
    load({
      money: delivery({
        receivedAt: null,
        outstandingUah: 0,
        appliedUah: 9600,
      }),
      shipment: shipment({ trackingCode: '5', receivedAt: null }),
    }),
  )

  await user.click(screen.getByRole('tab', { name: /Доставка/ }))
  expect(
    within(
      screen.getByRole('region', { name: 'Доставка · Нова пошта' }),
    ).getByText('не дорівнює залишку'),
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

  const sheet = await screen.findByRole('dialog', { name: 'Додати платіж' })
  expect(sheet).toHaveTextContent('Фактична оплата')
  expect(sheet).toHaveTextContent('Валюту обліку ще не обрано')
  await user.type(await within(sheet).findByLabelText('Сума'), '4200')
  await user.click(
    within(sheet).getByRole('button', { name: 'Записати оплату' }),
  )

  expect(deliveryApi.recordPayment).toHaveBeenCalledWith(
    'order-1',
    expect.objectContaining({
      amountUah: 4200,
      feeUah: 0,
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
    /Товар уже на складі\. У нас залишилося 9\s600,00 UAH коштів клієнта\./,
  )
  expect(within(paymentBlock()).getByText('Потрібен розрахунок')).toBeVisible()
  await user.click(
    within(card).getByRole('button', { name: 'Завершити розрахунок' }),
  )

  const sheet = await screen.findByRole('dialog', {
    name: 'Завершити розрахунок',
  })
  expect(
    within(sheet).queryByRole('textbox', { name: 'Сума' }),
  ).not.toBeInTheDocument()
  expect(sheet).toHaveTextContent(/Клієнту повертаємо всі 9\s600,00 UAH/)
  await user.click(
    within(sheet).getByRole('button', { name: /^Підтвердити повернення/ }),
  )

  const confirm = await screen.findByRole('dialog', {
    name: /^Повернути клієнту .+\?$/,
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

  await user.click(screen.getByRole('button', { name: 'Завершити розрахунок' }))
  const sheet = await screen.findByRole('dialog', {
    name: 'Завершити розрахунок',
  })
  await user.click(
    within(sheet).getByRole('button', {
      name: 'Повернення вже є у «Фінансах»',
    }),
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

const openRetentionRefund = async (amountUah: number) => {
  const user = userEvent.setup()
  renderBody(
    load({
      money: delivery({
        payments: [payment({ amountUah })],
        appliedUah: amountUah,
        refundDueUah: amountUah,
        outstandingUah: 0,
        returnedAt: '2026-10-30T10:00:00Z',
        workflowState: 'AwaitingRefund',
      }),
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Завершити розрахунок' }))
  const sheet = await screen.findByRole('dialog', {
    name: 'Завершити розрахунок',
  })
  return { user, sheet }
}

it('settles a 186 prepayment with actual delivery retention and no cash source', async () => {
  vi.mocked(deliveryApi.confirmFullRefund).mockResolvedValue(
    delivery({ workflowState: 'Cancelled', refundDueUah: 0 }),
  )
  const { user, sheet } = await openRetentionRefund(186)
  const retained = within(sheet).getByRole('textbox', {
    name: 'Залишаємо за доставку',
  })
  expect(retained).toHaveValue('0')
  await user.clear(retained)
  await user.type(retained, '186')
  expect(sheet).toHaveTextContent(
    /Усі 186,00 UAH, що залишилися у нас, покривають доставку\. Клієнту нічого повертати не потрібно\./,
  )
  await user.type(
    within(sheet).getByRole('textbox', { name: 'За що залишаємо ці гроші' }),
    'Доставка в обидва боки за квитанціями',
  )
  expect(
    within(sheet).queryByRole('combobox', { name: 'Каса' }),
  ).not.toBeInTheDocument()
  const submit = within(sheet).getByRole('button', {
    name: 'Завершити без виплати клієнту',
  })
  await user.click(submit)
  expect(deliveryApi.confirmFullRefund).not.toHaveBeenCalled()
  const confirm = await screen.findByRole('dialog', {
    name: 'Завершити розрахунок без виплати?',
  })
  expect(confirm).toHaveTextContent('186,00 UAH')
  await user.click(
    within(confirm).getByRole('button', {
      name: 'Завершити без виплати клієнту',
    }),
  )
  expect(deliveryApi.confirmFullRefund).toHaveBeenCalledWith(
    'order-1',
    {
      retainedDeliveryCostUah: 186,
      retentionNote: 'Доставка в обидва боки за квитанціями',
    },
    expect.any(Object),
  )
})

it('refunds only 314 after explicitly retaining 186 from 500', async () => {
  vi.mocked(deliveryApi.confirmFullRefund).mockResolvedValue(
    delivery({ workflowState: 'Cancelled', refundDueUah: 0 }),
  )
  const { user, sheet } = await openRetentionRefund(500)
  const retained = within(sheet).getByRole('textbox', {
    name: 'Залишаємо за доставку',
  })
  await user.clear(retained)
  await user.type(retained, '186')
  await user.type(
    within(sheet).getByRole('textbox', { name: 'За що залишаємо ці гроші' }),
    'Фактичні витрати',
  )
  expect(sheet).toHaveTextContent(
    /Із 500,00 UAH залишаємо 186,00 UAH за доставку, а 314,00 UAH повертаємо клієнту\./,
  )
  expect(
    within(sheet).queryByRole('textbox', { name: 'Сума' }),
  ).not.toBeInTheDocument()
  await user.click(
    within(sheet).getByRole('button', {
      name: /Підтвердити повернення 314,00\sUAH/,
    }),
  )
  const confirm = await screen.findByRole('dialog', {
    name: /Повернути клієнту 314,00\sUAH\?/,
  })
  await user.click(
    within(confirm).getByRole('button', { name: /Зафіксувати 314,00\sUAH/ }),
  )
  expect(deliveryApi.confirmFullRefund).toHaveBeenCalledWith(
    'order-1',
    {
      accountId: 'till-1',
      retainedDeliveryCostUah: 186,
      retentionNote: 'Фактичні витрати',
    },
    expect.any(Object),
  )
})

it('rejects invalid retention and requires a reason for positive actual costs', async () => {
  const { user, sheet } = await openRetentionRefund(186)
  const retained = within(sheet).getByRole('textbox', {
    name: 'Залишаємо за доставку',
  })
  for (const value of ['-1', '187', '1.001', 'abc']) {
    await user.clear(retained)
    await user.type(retained, value)
    expect(
      within(sheet).getByRole('button', { name: /^Підтвердити повернення/ }),
    ).toBeDisabled()
  }
  await user.clear(retained)
  await user.type(retained, '100')
  expect(
    within(sheet).getByRole('textbox', { name: 'За що залишаємо ці гроші' }),
  ).toHaveAttribute('maxlength', '500')
  expect(
    within(sheet).getByRole('button', { name: /^Підтвердити повернення/ }),
  ).toBeDisabled()
  await user.type(
    within(sheet).getByRole('textbox', { name: 'За що залишаємо ці гроші' }),
    'Квитанція',
  )
  expect(
    within(sheet).getByRole('button', { name: /^Підтвердити повернення/ }),
  ).toBeEnabled()
  expect(deliveryApi.confirmFullRefund).not.toHaveBeenCalled()
})

it('shows retained delivery costs on a cancelled return without claiming a cash refund', async () => {
  renderBody(
    load({
      money: delivery({
        workflowState: 'Cancelled',
        returnedAt: 'x',
        refundDueUah: 0,
        retainedDeliveryCostUah: 186,
        deliveryRetentionNote: 'Обидва напрямки',
        payments: [payment({ amountUah: 186, retainedDeliveryCostUah: 186 })],
      }),
    }),
  )
  const card = screen.getByRole('region', { name: 'Повернення' })
  expect(card).not.toHaveTextContent('Кошти повернено')
  expect(card).toHaveTextContent('Розрахунок завершено')
  expect(card).toHaveTextContent('186,00 UAH')
  expect(card).toHaveTextContent('Обидва напрямки')
  expect(paymentBlock()).toHaveTextContent('Утримано за доставку')
  expect(paymentBlock()).not.toHaveTextContent('Не застосовується')
  expect(
    screen.getByRole('list', { name: 'Платежі замовлення' }),
  ).toHaveTextContent('Утримано за фактичну доставку: 186,00 UAH.')
  await screen.findByRole('tab', { name: /Доставка/ })
})

it('links only the net refund expense while retaining confirmed actual delivery costs', async () => {
  vi.mocked(cashApi.transactions).mockResolvedValueOnce({
    items: [
      {
        id: 'tx-net',
        amount: 314,
        direction: 'out',
        type: 'manual_out',
        currency: 'UAH',
        note: 'Повернення 314',
        referenceId: null,
        createdAt: '2026-10-30T10:00:00Z',
        createdByName: 'Олег',
      },
      {
        id: 'tx-gross',
        amount: 500,
        direction: 'out',
        type: 'manual_out',
        currency: 'UAH',
        note: 'Повернення 500',
        referenceId: null,
        createdAt: '2026-10-30T10:00:00Z',
        createdByName: 'Олег',
      },
    ],
  } as Awaited<ReturnType<typeof cashApi.transactions>>)
  vi.mocked(deliveryApi.confirmFullRefund).mockResolvedValue(
    delivery({ workflowState: 'Cancelled', refundDueUah: 0 }),
  )
  const { user, sheet } = await openRetentionRefund(500)
  const retained = within(sheet).getByRole('textbox', {
    name: 'Залишаємо за доставку',
  })
  await user.clear(retained)
  await user.type(retained, '186')
  await user.type(
    within(sheet).getByRole('textbox', { name: 'За що залишаємо ці гроші' }),
    'Фактична доставка',
  )
  await user.click(
    within(sheet).getByRole('button', {
      name: 'Повернення вже є у «Фінансах»',
    }),
  )
  await user.click(
    await within(sheet).findByRole('button', { name: /Повернення 500/ }),
  )
  expect(
    within(sheet).getByRole('button', { name: 'Прив’язати операцію' }),
  ).toBeDisabled()
  expect(sheet).toHaveTextContent(/Сума операції має дорівнювати.+314,00/)
  await user.click(
    within(sheet).getByRole('button', { name: /Повернення 314/ }),
  )
  await user.click(
    within(sheet).getByRole('button', { name: 'Прив’язати операцію' }),
  )
  expect(deliveryApi.confirmFullRefund).toHaveBeenCalledWith(
    'order-1',
    {
      existingCashTransactionId: 'tx-net',
      retainedDeliveryCostUah: 186,
      retentionNote: 'Фактична доставка',
    },
    expect.any(Object),
  )
})

it('preserves retention and reuses the replay key after an ambiguous no-cash settlement', async () => {
  vi.mocked(deliveryApi.confirmFullRefund)
    .mockRejectedValueOnce({ kind: 'network', message: 'Timeout' })
    .mockResolvedValueOnce(
      delivery({ workflowState: 'Cancelled', refundDueUah: 0 }),
    )
  const { user, sheet } = await openRetentionRefund(186)
  const retained = within(sheet).getByRole('textbox', {
    name: 'Залишаємо за доставку',
  })
  await user.clear(retained)
  await user.type(retained, '186')
  await user.type(
    within(sheet).getByRole('textbox', { name: 'За що залишаємо ці гроші' }),
    'Квитанції',
  )
  for (let attempt = 0; attempt < 2; attempt++) {
    await user.click(
      within(sheet).getByRole('button', {
        name: 'Завершити без виплати клієнту',
      }),
    )
    const confirm = await screen.findByRole('dialog', {
      name: 'Завершити розрахунок без виплати?',
    })
    await user.click(
      within(confirm).getByRole('button', {
        name: 'Завершити без виплати клієнту',
      }),
    )
    if (attempt === 0) {
      expect(
        await within(sheet).findByText(
          'Не вдалося зберегти. Дані збережено — спробуйте ще раз.',
        ),
      ).toBeVisible()
      expect(retained).toHaveValue('186')
    }
  }
  const calls = vi.mocked(deliveryApi.confirmFullRefund).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[0]).toEqual(calls[1])
})

it('does not offer retention before physical goods acceptance or on a cancelled order', async () => {
  const user = userEvent.setup()
  const view = renderBody(
    load({
      money: delivery({ workflowState: 'AwaitingRefund', returnedAt: null }),
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Завершити розрахунок' }))
  let sheet = await screen.findByRole('dialog', {
    name: 'Завершити розрахунок',
  })
  expect(
    within(sheet).queryByRole('textbox', {
      name: 'Залишаємо за доставку',
    }),
  ).not.toBeInTheDocument()
  view.unmount()
  renderBody(
    load({
      money: delivery({
        workflowState: 'Cancelled',
        returnedAt: 'x',
        refundDueUah: 500,
      }),
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Завершити розрахунок' }))
  sheet = await screen.findByRole('dialog', { name: 'Завершити розрахунок' })
  expect(
    within(sheet).queryByRole('textbox', {
      name: 'Залишаємо за доставку',
    }),
  ).not.toBeInTheDocument()
})

it('needs no active till to settle a fully retained prepayment', async () => {
  vi.mocked(cashApi.list).mockResolvedValueOnce([])
  const { user, sheet } = await openRetentionRefund(186)
  const retained = within(sheet).getByRole('textbox', {
    name: 'Залишаємо за доставку',
  })
  await user.clear(retained)
  await user.type(retained, '186')
  const submit = within(sheet).getByRole('button', {
    name: 'Завершити без виплати клієнту',
  })
  expect(submit).toBeDisabled()
  expect(
    within(sheet).queryByRole('combobox', { name: 'Каса' }),
  ).not.toBeInTheDocument()
  await user.type(
    within(sheet).getByRole('textbox', { name: 'За що залишаємо ці гроші' }),
    '  ',
  )
  expect(submit).toBeDisabled()
  await user.type(
    within(sheet).getByRole('textbox', { name: 'За що залишаємо ці гроші' }),
    'Квитанція',
  )
  expect(submit).toBeEnabled()
  expect(sheet).not.toHaveTextContent('Активних кас немає')
})

it.each([false, true])(
  'offers retention only for a supporting Core response and preserves a default full refund (supported=%s)',
  async (supported) => {
    const { normalizeDeliveryOrder } =
      await vi.importActual<typeof DeliveryModule>('@/api/delivery')
    const raw = delivery({
      workflowState: 'AwaitingRefund',
      returnedAt: '2026-10-30T10:00:00Z',
      payments: [payment({ amountUah: 500 })],
      refundDueUah: 500,
    })
    if (!supported) delete raw.retainedDeliveryCostUah
    // Repeated normalization must not turn its own default zero into support.
    const summary = normalizeDeliveryOrder(normalizeDeliveryOrder(raw))
    vi.mocked(deliveryApi.confirmFullRefund).mockResolvedValue(
      delivery({ workflowState: 'Cancelled', refundDueUah: 0 }),
    )
    const user = userEvent.setup()
    renderBody(load({ money: summary }))
    await user.click(
      screen.getByRole('button', { name: 'Завершити розрахунок' }),
    )
    const sheet = await screen.findByRole('dialog', {
      name: 'Завершити розрахунок',
    })
    const retention = within(sheet).queryByRole('textbox', {
      name: 'Залишаємо за доставку',
    })
    if (supported) expect(retention).toHaveValue('0')
    else expect(retention).not.toBeInTheDocument()
    expect(
      within(sheet).queryByRole('textbox', { name: 'Сума' }),
    ).not.toBeInTheDocument()
    expect(sheet).toHaveTextContent(/Клієнту повертаємо всі 500,00 UAH/)
    await user.click(
      within(sheet).getByRole('button', {
        name: /Підтвердити повернення 500,00\sUAH/,
      }),
    )
    const confirm = await screen.findByRole('dialog', {
      name: /Повернути клієнту 500,00\sUAH\?/,
    })
    await user.click(
      within(confirm).getByRole('button', { name: /Зафіксувати 500,00\sUAH/ }),
    )
    expect(deliveryApi.confirmFullRefund).toHaveBeenCalledWith(
      'order-1',
      { accountId: 'till-1' },
      expect.any(Object),
    )
  },
)
