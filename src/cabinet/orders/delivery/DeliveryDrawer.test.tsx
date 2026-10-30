/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi } from '@/api/integrations'
import type { DeliveryOrder } from '@/api/delivery'
import { shippingApi, type Shipment } from '@/api/shipping'
import { LocaleProvider } from '@/i18n'
import { DeliveryDrawer } from './DeliveryDrawer'
import { customersApi } from '@/api/customers'
import { deliveryApi } from '@/api/delivery'

vi.mock('@/api/customers', () => ({ customersApi: { search: vi.fn() } }))

vi.mock('@/api/integrations', () => ({
  integrationsApi: { settlements: vi.fn(), divisions: vi.fn() },
}))
vi.mock('@/api/shipping', () => ({
  shippingApi: { saveDraft: vi.fn() },
}))
vi.mock('@/api/delivery', () => ({ deliveryApi: { configure: vi.fn() } }))

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
    name: 'Олійник Ірина',
    phone: '+380503381172',
    warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
    settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
    warehouseName: 'Відділення №8: вул. Наукова, 45',
    settlementName: 'Львів',
    companyName: null,
    companyTin: null,
  },
  parcels: [{ lengthCm: 40, widthCm: 30, heightCm: 22, weightKg: 4.2 }],
  declaredValueUah: 4280,
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
  connectionId: null,
  version: 'v1',
  dispatchedAt: null,
  receivedAt: null,
  paymentState: null,
  syncProblem: null,
  trackingEnabled: true,
  events: [],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(customersApi.search).mockResolvedValue([])
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

const money = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
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
  workflowState: 'Open',
  refundDueUah: 0,
  refundAllocations: [],
  ...over,
})

const renderDrawer = (
  current: Shipment | null,
  {
    customerSearchAllowed = false,
    delivery = money(),
    onSaved = vi.fn(),
    onMoneyChanged = vi.fn(),
    customerPhone = '+380503381172',
    customerName = 'Олійник Ірина',
  }: {
    customerSearchAllowed?: boolean
    delivery?: DeliveryOrder
    onSaved?: (shipment: Shipment) => void
    onMoneyChanged?: (delivery: DeliveryOrder) => void
    customerPhone?: string | null
    customerName?: string | null
  } = {},
) =>
  render(
    <LocaleProvider locale="uk" syncDocumentLang={false}>
      <DeliveryDrawer
        customerName={customerName}
        customerPhone={customerPhone}
        customerSearchAllowed={customerSearchAllowed}
        delivery={delivery}
        dispatchPoints={[point]}
        integrationId="integration-1"
        onClose={vi.fn()}
        onMoneyChanged={onMoneyChanged}
        onSaved={onSaved}
        orderId="order-1"
        orderNumber={361}
        shipment={current}
      />
    </LocaleProvider>,
  )

it('opens with the saved draft filled in and saves only a draft (4.2)', async () => {
  const user = userEvent.setup()
  const onSaved = vi.fn()
  vi.mocked(shippingApi.saveDraft).mockResolvedValue(shipment())
  renderDrawer(shipment(), { onSaved })

  const sheet = await screen.findByRole('dialog', {
    name: 'Оформлення доставки',
  })
  expect(sheet).toHaveTextContent(
    'Замовлення #361 · Нова пошта. Дані замовлення підставлено — перевірте їх.',
  )
  expect(screen.getByLabelText('Прізвище')).toHaveValue('Олійник')
  expect(screen.getByLabelText('Ім’я')).toHaveValue('Ірина')
  expect(screen.getByLabelText(/Габарити/)).toHaveValue('40×30×22')
  expect(screen.getByLabelText(/Вага/)).toHaveValue('4,2')
  await waitFor(() =>
    expect(screen.getByLabelText(/Відділення/)).toHaveValue(
      draft.recipient.warehouseRef,
    ),
  )
  expect(sheet).toHaveTextContent('Відправник: Олена Коваль')
  expect(sheet).toHaveTextContent(
    'Післяплата в накладній має дорівнювати залишку.',
  )
  expect(
    screen.queryByRole('button', { name: 'Створити ТТН' }),
  ).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(shippingApi.saveDraft).toHaveBeenCalledWith(
    'integration-1',
    'order-1',
    expect.objectContaining({
      recipient: expect.objectContaining({
        name: 'Олійник Ірина',
        phone: '+380503381172',
        warehouseRef: draft.recipient.warehouseRef,
      }) as unknown,
      parcels: [{ lengthCm: 40, widthCm: 30, heightCm: 22, weightKg: 4.2 }],
      declaredValueUah: 4280,
      dispatchPointId: 'point-1',
    }),
  )
})

it('names the missing details, marks the fields and keeps what was typed (4.3)', async () => {
  const user = userEvent.setup()
  renderDrawer(null, { customerPhone: '+380 67 214 55' })
  await screen.findByRole('dialog', { name: 'Оформлення доставки' })
  await user.type(screen.getByLabelText('Прізвище'), 'Олійник')
  await user.type(screen.getByLabelText('Ім’я'), 'Ірина')

  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))

  expect(
    screen.getByText(
      'Бракує даних: телефон отримувача, населений пункт, відділення отримання, вага посилки, габарити посилки. Введене збережено.',
    ),
  ).toBeVisible()
  const phone = screen.getByLabelText(/Телефон/)
  expect(phone).toHaveValue('+380 67 214 55')
  expect(phone).toHaveAccessibleDescription(
    'Телефон у форматі +380 XX XXX XX XX',
  )
  const summary = screen.getByRole('alert')
  await waitFor(() => expect(summary.parentElement).toHaveFocus())
  await user.click(screen.getByRole('button', { name: 'телефон отримувача' }))
  expect(phone).toHaveFocus()
  expect(shippingApi.saveDraft).not.toHaveBeenCalled()
})

it('asks what the goods cost when Core has no agreed total yet', async () => {
  const user = userEvent.setup()
  const configured = money({
    agreedTotalUah: 9600,
    outstandingUah: 9600,
    appliedUah: 0,
  })
  vi.mocked(deliveryApi.configure).mockResolvedValue(configured)
  vi.mocked(shippingApi.saveDraft).mockResolvedValue(shipment())
  const onMoneyChanged = vi.fn()
  renderDrawer(shipment(), {
    delivery: money({ agreedTotalUah: 0, appliedUah: 0, outstandingUah: 0 }),
    onMoneyChanged,
  })
  await screen.findByRole('dialog', { name: 'Оформлення доставки' })
  await waitFor(() =>
    expect(screen.getByLabelText(/Відділення/)).toHaveValue(
      draft.recipient.warehouseRef,
    ),
  )

  await user.type(screen.getByLabelText(/Погоджена сума замовлення/), '9600')
  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))

  await waitFor(() => expect(onMoneyChanged).toHaveBeenCalledWith(configured))
  expect(deliveryApi.configure).toHaveBeenCalledWith('order-1', 9600)
  expect(shippingApi.saveDraft).toHaveBeenCalledWith(
    'integration-1',
    'order-1',
    expect.objectContaining({ declaredValueUah: 9600 }),
  )
})

it('lets a trusted customer require prepayment for this order without inventing a payment', async () => {
  const user = userEvent.setup()
  const configured = money({ customerTrusted: true, depositWaived: false })
  vi.mocked(deliveryApi.configure).mockResolvedValue(configured)
  vi.mocked(shippingApi.saveDraft).mockResolvedValue(shipment())
  renderDrawer(shipment(), {
    delivery: money({ customerTrusted: true, depositWaived: true }),
  })
  await waitFor(() =>
    expect(screen.getByLabelText(/Відділення/)).toHaveValue(
      draft.recipient.warehouseRef,
    ),
  )
  const toggle = screen.getByRole('switch', {
    name: 'Вимагати мінімальну передоплату',
  })
  expect(toggle).not.toBeChecked()
  await user.click(toggle)
  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))
  await waitFor(() =>
    expect(deliveryApi.configure).toHaveBeenCalledWith(
      'order-1',
      undefined,
      false,
    ),
  )
  expect(shippingApi.saveDraft).toHaveBeenCalledOnce()
})

it('preserves an explicit prepayment requirement for an already configured trusted customer', async () => {
  renderDrawer(shipment(), {
    delivery: money({ customerTrusted: true, depositWaived: false }),
  })
  expect(
    await screen.findByRole('switch', {
      name: 'Вимагати мінімальну передоплату',
    }),
  ).toBeChecked()
})

it('fills only the phone from customer search', async () => {
  vi.mocked(customersApi.search).mockResolvedValue([
    {
      id: 'customer-2',
      name: 'Коваль Олена',
      phone: '+380671234567',
      ordersCount: 2,
    },
  ])
  const user = userEvent.setup()
  renderDrawer(null, { customerSearchAllowed: true })
  await screen.findByRole('dialog', { name: 'Оформлення доставки' })

  const name = screen.getByLabelText('Знайти клієнта')
  await user.clear(name)
  await user.type(name, 'Ковал')
  await user.click(
    await screen.findByRole('option', { name: 'Обрати клієнта Коваль Олена' }),
  )

  expect(name).toHaveValue('Коваль Олена')
  expect(screen.getByLabelText('Прізвище')).toHaveValue('')
  expect(screen.getByLabelText('Ім’я')).toHaveValue('')
  expect(screen.getByLabelText('Телефон')).toHaveValue('+380671234567')
})

it('requires a separate surname when the recipient only has a given name and sends surname first', async () => {
  const user = userEvent.setup()
  const current = shipment()
  renderDrawer({
    ...current,
    draft: {
      ...current.draft,
      recipient: { ...current.draft.recipient, name: 'Владислав' },
    },
  })
  expect(screen.getByLabelText('Ім’я')).toHaveValue('Владислав')
  const surname = screen.getByLabelText('Прізвище')
  expect(surname).toHaveValue('')
  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))
  expect(shippingApi.saveDraft).not.toHaveBeenCalled()
  expect(screen.getByText('Вкажіть прізвище отримувача')).toBeVisible()
  await waitFor(() =>
    expect(screen.getByRole('alert').parentElement).toHaveFocus(),
  )
  await user.click(screen.getByRole('button', { name: 'прізвище отримувача' }))
  expect(surname).toHaveFocus()
  await user.type(surname, 'Соболь')
  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))
  expect(shippingApi.saveDraft).toHaveBeenCalledWith(
    'integration-1',
    'order-1',
    expect.objectContaining({
      recipient: expect.objectContaining({
        name: 'Соболь Владислав',
      }) as unknown,
    }),
  )
})

it('preserves an optional patronymic and validates the given name separately', async () => {
  const user = userEvent.setup()
  const current = shipment()
  renderDrawer({
    ...current,
    draft: {
      ...current.draft,
      recipient: {
        ...current.draft.recipient,
        name: 'Соболь Владислав Ігорович',
      },
    },
  })
  expect(screen.getByLabelText('Прізвище')).toHaveValue('Соболь')
  const given = screen.getByLabelText('Ім’я')
  expect(given).toHaveValue('Владислав')
  expect(screen.getByLabelText('По батькові')).toHaveValue('Ігорович')
  await user.clear(given)
  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))
  expect(screen.getByText('Вкажіть ім’я отримувача')).toBeVisible()
  expect(shippingApi.saveDraft).not.toHaveBeenCalled()
  await waitFor(() =>
    expect(screen.getByRole('alert').parentElement).toHaveFocus(),
  )
  await user.click(screen.getByRole('button', { name: 'ім’я отримувача' }))
  await user.type(given, 'Владислав')
  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))
  expect(shippingApi.saveDraft).toHaveBeenCalledWith(
    'integration-1',
    'order-1',
    expect.objectContaining({
      recipient: expect.objectContaining({
        name: 'Соболь Владислав Ігорович',
      }) as unknown,
    }),
  )
})

it('never derives postal recipient names from an arbitrary customer label', () => {
  renderDrawer(null, { customerName: 'Перекуп на білому Джуніпері' })
  expect(screen.getByLabelText('Прізвище')).toHaveValue('')
  expect(screen.getByLabelText('Ім’я')).toHaveValue('')
  expect(screen.getByLabelText('По батькові')).toHaveValue('')
  expect(screen.getByLabelText('Телефон')).toHaveValue('+380503381172')
})

it('preserves manually entered recipient names when a customer is selected', async () => {
  vi.mocked(customersApi.search).mockResolvedValue([
    {
      id: 'customer-nickname',
      name: 'Перекуп на білому Джуніпері',
      phone: '+380634181690',
      ordersCount: 1,
    },
  ])
  const user = userEvent.setup()
  renderDrawer(null, { customerSearchAllowed: true })
  await user.clear(screen.getByLabelText('Прізвище'))
  await user.type(screen.getByLabelText('Прізвище'), 'Соболь')
  await user.clear(screen.getByLabelText('Ім’я'))
  await user.type(screen.getByLabelText('Ім’я'), 'Владислав')
  await user.clear(screen.getByLabelText('По батькові'))
  await user.type(screen.getByLabelText('По батькові'), 'Ігорович')
  await user.type(screen.getByLabelText('Знайти клієнта'), 'Перекуп')
  await user.click(
    await screen.findByRole('option', {
      name: 'Обрати клієнта Перекуп на білому Джуніпері',
    }),
  )
  expect(screen.getByLabelText('Прізвище')).toHaveValue('Соболь')
  expect(screen.getByLabelText('Ім’я')).toHaveValue('Владислав')
  expect(screen.getByLabelText('По батькові')).toHaveValue('Ігорович')
  expect(screen.getByLabelText('Телефон')).toHaveValue('+380634181690')
})
