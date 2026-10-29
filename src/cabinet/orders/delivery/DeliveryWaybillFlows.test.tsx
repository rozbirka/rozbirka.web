/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import type { DeliveryOrder } from '@/api/delivery'
import type { ApiProblem } from '@/api/contracts'
import type { OrderDetail } from '@/api/orders'
import { shippingApi, type Shipment } from '@/api/shipping'
import { ToastProvider } from '@/components/app'
import { DeliveryOrderBody } from './DeliveryOrderBody'
import type { DeliveryOrderState } from './use-delivery-order'

vi.mock('@/api/cash', () => ({
  cashApi: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/api/customers', () => ({
  customersApi: { getById: vi.fn(), search: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/api/integrations', () => ({
  integrationsApi: {
    settlements: vi.fn(),
    divisions: vi.fn().mockResolvedValue({ items: [], page: 1, lastPage: 1 }),
    preferences: vi.fn().mockResolvedValue({ codCashRegisterId: 'till-1' }),
  },
}))
vi.mock('@/api/nova-poshta-setup', () => ({
  novaPoshtaSetupApi: { connections: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/api/delivery', () => ({
  deliveryApi: { get: vi.fn().mockReturnValue(new Promise(() => undefined)) },
}))
vi.mock('@/api/shipping', () => ({
  shippingApi: {
    get: vi.fn(),
    saveDraft: vi.fn(),
    estimate: vi.fn(),
    create: vi.fn(),
    refresh: vi.fn(),
    cancel: vi.fn(),
    label: vi.fn(),
    update: vi.fn(),
    reconcile: vi.fn(),
    previewExternal: vi.fn(),
    confirmExternal: vi.fn(),
  },
}))

const problem = (
  code: string,
  kind: ApiProblem['kind'] = 'conflict',
  status = 409,
): ApiProblem => ({ kind, code, status, message: code })

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

const TTN = '20451200987731'

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

const created = (over: Partial<Shipment> = {}) =>
  shipment({
    state: 'Created',
    number: TTN,
    codUah: 4200,
    trackingStatus: 'Створено, очікує відправлення',
    ...over,
  })

const point = (id = 'point-1') => ({
  id,
  name: 'Головний склад',
  senderName: 'ФОП Коваль Олег Петрович',
  phone: '+380672147730',
  settlementRef: 's-kyiv',
  warehouseRef: 'w-12',
  counterpartyRef: 'c-1',
  contactRef: 'ct-1',
  warehouseName: 'Відділення №12',
  settlementName: 'Київ',
  companyTin: null,
  companyName: id === 'point-1' ? null : 'ТОВ «Розбірка Плюс»',
  isActive: true,
  isDefault: true,
})

const order: OrderDetail = {
  id: 'order-1',
  number: 361,
  status: 'pending',
  customerId: null,
  customerName: 'Ірина Коваль',
  notes: null,
  items: [],
  payments: [],
  history: [],
  totalAmount: 9600,
  totalPaid: 0,
  paymentCurrency: null,
  createdAt: '2026-10-25T10:00:00Z',
  createdByName: 'Олег',
}

/** The body over a live load, so a call that answers changes what is drawn. */
function Harness({
  initial,
  delivery = money(),
  mutationsAllowed = true,
  points = [point()],
}: {
  initial: Shipment | null
  delivery?: DeliveryOrder
  mutationsAllowed?: boolean
  points?: ReturnType<typeof point>[]
}) {
  const [state, setState] = useState<DeliveryOrderState>({
    money: delivery,
    integrationId: 'int-1',
    carrier: null,
    disconnected: null,
    points,
    shipment: initial,
    customerPhone: null,
  })
  return (
    <DeliveryOrderBody
      customerPath={null}
      delivery={state.money!}
      financeAllowed
      integrationsPath="/app/koval/settings/integrations"
      load={{
        state,
        error: null,
        setMoney: (next) =>
          setState((current) => ({ ...current, money: next })),
        setShipment: (next) =>
          setState((current) => ({ ...current, shipment: next })),
        reload: vi.fn(),
      }}
      mutationsAllowed={mutationsAllowed}
      order={order}
      partsPath={null}
    />
  )
}

const renderFlow = async (props: Parameters<typeof Harness>[0]) => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <Harness {...props} />
    </MemoryRouter>,
    { wrapper: ToastProvider },
  )
  await user.click(screen.getByRole('tab', { name: /Доставка/ }))
  return {
    user,
    block: () => screen.getByRole('region', { name: 'Доставка · Нова пошта' }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('starts with no delivery and offers the form or an external waybill (4.1)', async () => {
  const { block } = await renderFlow({ initial: null })
  expect(block()).toHaveTextContent(
    'Замовлення поки не їде поштою. Оформіть доставку — отримувача, посилку й післяплату вкажете на наступному кроці.',
  )
  expect(
    within(block()).getByRole('button', { name: 'Оформити доставку' }),
  ).toBeVisible()
  expect(
    within(block()).getByRole('button', {
      name: 'Прив’язати накладну з кабінету НП',
    }),
  ).toBeVisible()
})

it('hides create, edit, cancel and attach without the orders right', async () => {
  const { block } = await renderFlow({
    initial: created(),
    mutationsAllowed: false,
  })
  expect(
    within(block()).getByRole('button', { name: 'Друк етикетки' }),
  ).toBeVisible()
  expect(
    within(block()).queryByRole('button', { name: 'Редагувати' }),
  ).toBeNull()
  expect(
    within(block()).queryByRole('button', { name: 'Скасувати ТТН' }),
  ).toBeNull()
})

it('creates a waybill from a quoted draft and lands on its number (4.4–4.12)', async () => {
  vi.mocked(shippingApi.create).mockResolvedValue(created())
  const { user, block } = await renderFlow({ initial: shipment() })

  expect(block()).toHaveTextContent('Чернетка')
  expect(block()).toHaveTextContent('Київ №12 → Львів №5')
  expect(block()).toHaveTextContent(
    'У чернетки немає номера ТТН, друку й відстеження.',
  )
  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й створити ТТН' }),
  )
  await user.click(
    within(
      await screen.findByRole('dialog', {
        name: 'Перевірка перед створенням ТТН',
      }),
    ).getByRole('button', { name: 'Продовжити оформлення' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Створити ТТН' })
  expect(sheet).toHaveTextContent('Розрахунок отримано')
  expect(sheet).toHaveTextContent('224 UAH · внесено')
  expect(shippingApi.estimate).not.toHaveBeenCalled()

  await user.click(within(sheet).getByRole('button', { name: 'Створити ТТН' }))

  expect(await screen.findByText(`ТТН ${TTN} створено.`)).toBeVisible()
  await waitFor(() => expect(screen.getByText(TTN)).toHaveFocus())
  expect(block()).toHaveTextContent('Статус НП: Створено, очікує відправлення')
  expect(
    within(block()).getByRole('button', { name: 'Скасувати ТТН' }),
  ).toBeVisible()
})

it('blocks creation on a stale quote until it is taken again (4.8)', async () => {
  const old = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
  vi.mocked(shippingApi.estimate).mockResolvedValue(shipment())
  const { user, block } = await renderFlow({
    initial: shipment({ quoteAt: old }),
  })
  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й створити ТТН' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Продовжити оформлення' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Створити ТТН' })
  expect(sheet).toHaveTextContent('Розрахунок застарів')
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeDisabled()

  await user.click(within(sheet).getByRole('button', { name: 'Перерахувати' }))
  await waitFor(() =>
    expect(
      within(sheet).getByRole('button', { name: 'Створити ТТН' }),
    ).toBeEnabled(),
  )
})

it('keeps the draft after a known refusal (4.10)', async () => {
  vi.mocked(shippingApi.create).mockRejectedValue(
    problem('nova_poshta_rejected', 'validation', 422),
  )
  vi.mocked(shippingApi.get).mockResolvedValue(shipment())
  const { user, block } = await renderFlow({ initial: shipment() })
  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й створити ТТН' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Продовжити оформлення' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Створити ТТН' })
  await user.click(within(sheet).getByRole('button', { name: 'Створити ТТН' }))

  expect(await within(sheet).findByText('ТТН не створено')).toBeVisible()
  expect(sheet).toHaveTextContent('Дані збережено')
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeEnabled()
})

it('turns an unanswered create into a result check with a candidate (4.11, 5.14)', async () => {
  vi.mocked(shippingApi.create).mockRejectedValue(
    problem('nova_poshta_outcomeunknown'),
  )
  vi.mocked(shippingApi.get).mockResolvedValue(shipment({ state: 'Unknown' }))
  vi.mocked(shippingApi.reconcile)
    .mockRejectedValueOnce(problem('shipment_candidate_required'))
    .mockResolvedValueOnce(created())
  const { user, block } = await renderFlow({ initial: shipment() })
  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й створити ТТН' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Продовжити оформлення' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Створити ТТН' })
  await user.click(within(sheet).getByRole('button', { name: 'Створити ТТН' }))

  expect(
    await within(sheet).findByText('Не вдалося підтвердити результат'),
  ).toBeVisible()
  expect(sheet).toHaveTextContent('Повторне створення недоступне до перевірки')
  expect(
    within(sheet).queryByRole('button', { name: 'Створити ТТН' }),
  ).toBeNull()

  await user.click(
    within(sheet).getByRole('button', { name: 'Перевірити результат' }),
  )
  const check = await screen.findByRole('dialog', {
    name: 'Перевірка результату',
  })
  const input = await within(check).findByLabelText(/Номер/)
  expect(check).toHaveTextContent('Ірина Коваль · +380 67 214 55 08')
  await user.type(input, '2045 1200 9877 31')
  await user.click(
    within(check).getByRole('button', { name: 'Так, це накладна замовлення' }),
  )

  expect(await screen.findByText(`ТТН ${TTN} створено.`)).toBeVisible()
  expect(shippingApi.reconcile).toHaveBeenLastCalledWith(
    'int-1',
    'order-1',
    TTN,
  )
})

it('waits instead of claiming success when the check finds no proof (5.15)', async () => {
  vi.mocked(shippingApi.reconcile).mockRejectedValue(
    problem('shipment_operation_in_progress'),
  )
  const { user, block } = await renderFlow({
    initial: shipment({ state: 'Unknown' }),
  })
  expect(block()).toHaveTextContent('Результат невідомий')
  expect(
    within(block()).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeDisabled()

  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити результат' }),
  )

  await waitFor(() => expect(block()).toHaveTextContent('Очікуємо відповідь'))
  expect(
    within(block()).getByRole('button', { name: 'Перевірити зараз' }),
  ).toBeVisible()
  expect(
    within(block()).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeDisabled()
})

it('asks the sender to be checked after the settings changed (2.9)', async () => {
  const { user, block } = await renderFlow({
    initial: shipment({ quoteAt: null, quoteUah: null }),
    points: [point('point-2')],
  })
  expect(block()).toHaveTextContent('Перевірте відправника')
  expect(block()).toHaveTextContent('ТОВ «Розбірка Плюс»')
  expect(
    within(block()).getByRole('button', { name: 'Створити накладну' }),
  ).toBeDisabled()

  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й розрахувати' }),
  )
  expect(
    await screen.findByRole('dialog', { name: 'Оформлення доставки' }),
  ).toBeVisible()
})

it('cancels a waybill after the consequences and keeps it on screen (5.7–5.8)', async () => {
  vi.mocked(shippingApi.cancel).mockResolvedValue()
  const { user, block } = await renderFlow({ initial: created() })
  await user.click(
    within(block()).getByRole('button', { name: 'Скасувати ТТН' }),
  )

  const dialog = await screen
    .findByRole('alertdialog', {
      name: 'Скасувати накладну?',
    })
    .catch(() => screen.findByRole('dialog', { name: 'Скасувати накладну?' }))
  expect(dialog).toHaveTextContent(`ТТН ${TTN} буде скасовано в Новій пошті.`)
  expect(dialog).toHaveTextContent('Замовлення #361 залишиться відкритим.')
  await user.click(
    within(dialog).getByRole('button', { name: 'Скасувати ТТН' }),
  )

  expect(
    await screen.findByText('ТТН скасовано. Замовлення залишилося відкритим.'),
  ).toBeVisible()
  expect(block()).toHaveTextContent('ТТН скасована')
  expect(block()).toHaveTextContent(TTN)
  expect(
    within(block()).getByRole('button', { name: 'Створити нову ТТН' }),
  ).toBeVisible()
  expect(
    within(block()).getByRole('button', { name: 'Змінити доставку' }),
  ).toBeVisible()
})

it('replaces a waybill the carrier will not edit: cancel first, new one next (5.5–5.6)', async () => {
  vi.mocked(shippingApi.update).mockRejectedValue(
    problem('shipment_recreate_required'),
  )
  vi.mocked(shippingApi.cancel).mockResolvedValue()
  const { user, block } = await renderFlow({ initial: created() })
  await user.click(within(block()).getByRole('button', { name: 'Редагувати' }))
  const sheet = await screen.findByRole('dialog', { name: 'Редагувати ТТН' })
  const phone = within(sheet).getByLabelText('Телефон')
  await user.clear(phone)
  await user.type(phone, '+380672145509')
  expect(sheet).toHaveTextContent('Змінено · було …5508')
  await user.click(
    within(sheet).getByRole('button', { name: 'Зберегти зміни' }),
  )

  const dialog = await screen.findByRole('dialog', {
    name: 'Потрібна нова ТТН',
  })
  expect(dialog).toHaveTextContent(
    `Спершу скасуємо ТТН ${TTN} у Новій пошті й дочекаємося підтвердження.`,
  )
  await user.click(
    within(dialog).getByRole('button', {
      name: 'Скасувати стару й продовжити',
    }),
  )

  await waitFor(() => expect(block()).toHaveTextContent('Залишився один крок'))
  await user.click(
    within(block()).getByRole('button', { name: 'Створити нову ТТН' }),
  )
  const form = await screen.findByRole('dialog', {
    name: 'Оформлення доставки',
  })
  expect(within(form).getByLabelText(/Телефон/)).toHaveValue('+380672145509')
})

it('shows edited data only after Nova Poshta confirms it (5.2–5.4)', async () => {
  vi.mocked(shippingApi.update).mockResolvedValue(
    created({
      version: 'v2',
      draft: {
        ...created().draft,
        recipient: { ...created().draft.recipient, phone: '+380672145509' },
      },
    }),
  )
  const { user, block } = await renderFlow({ initial: created() })
  await user.click(within(block()).getByRole('button', { name: 'Редагувати' }))
  const sheet = await screen.findByRole('dialog', { name: 'Редагувати ТТН' })
  const phone = within(sheet).getByLabelText('Телефон')
  await user.clear(phone)
  await user.type(phone, '+380672145509')
  await user.click(
    within(sheet).getByRole('button', { name: 'Зберегти зміни' }),
  )

  expect(
    await screen.findByText('Зміни підтверджено Новою поштою.'),
  ).toBeVisible()
  expect(block()).toHaveTextContent('+380 67 214 55 09')
  expect(shippingApi.update).toHaveBeenCalledWith(
    'int-1',
    'order-1',
    'v1',
    expect.objectContaining({
      recipient: expect.objectContaining({
        phone: '+380672145509',
      }) as unknown,
    }),
  )
})

it('keeps recipient, address and COD out of reach once the parcel is sent (5.9)', async () => {
  const { block } = await renderFlow({
    initial: created({ dispatchedAt: '2026-10-26T08:10:00Z' }),
  })
  expect(block()).toHaveTextContent('Відправлено')
  expect(block()).toHaveTextContent('Посилку вже відправлено.')
  expect(
    within(block()).queryByRole('button', { name: 'Редагувати' }),
  ).toBeNull()
  expect(
    within(block()).queryByRole('button', { name: 'Скасувати ТТН' }),
  ).toBeNull()
})

it('settles an unknown cancel through the result check (5.12–5.13)', async () => {
  vi.mocked(shippingApi.reconcile).mockResolvedValue(
    created({ state: 'Cancelled' }),
  )
  const { user, block } = await renderFlow({
    initial: created({ state: 'CancelUnknown' }),
  })
  expect(block()).toHaveTextContent('Скасування невідоме')
  expect(
    within(block()).getByRole('button', { name: 'Редагувати' }),
  ).toBeDisabled()
  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити результат' }),
  )
  expect(
    await screen.findByText('ТТН скасовано. Замовлення залишилося відкритим.'),
  ).toBeVisible()
  expect(block()).toHaveTextContent('ТТН скасована')
})

it('attaches an external waybill after its preview (6.1–6.3, 6.12)', async () => {
  vi.mocked(shippingApi.previewExternal).mockResolvedValue({
    number: TTN,
    fingerprint: 'fp',
    shipmentVersion: 'v1',
    providerStatus: '1',
    sender: shipment().sender,
    recipient: { ...shipment().draft.recipient, warehouseName: null },
    codAmountUah: 4200,
    recordsDispatch: false,
    recordsReceipt: false,
  })
  vi.mocked(shippingApi.confirmExternal).mockResolvedValue(money())
  vi.mocked(shippingApi.get).mockResolvedValue(created())
  const { user, block } = await renderFlow({ initial: shipment() })
  await user.click(
    within(block()).getByRole('button', {
      name: 'Прив’язати накладну з кабінету НП',
    }),
  )
  const sheet = await screen.findByRole('dialog', {
    name: 'Прив’язати наявну ТТН',
  })
  expect(sheet).toHaveTextContent('Прив’язка пройде, якщо')
  await user.type(
    within(sheet).getByLabelText(/Номер накладної/),
    '2045 1200 9877 31',
  )
  await user.click(
    within(sheet).getByRole('button', { name: 'Перевірити накладну' }),
  )

  expect(await within(sheet).findByText('Попередній перегляд')).toBeVisible()
  expect(sheet).toHaveTextContent('Київ №12 → Львів №5')
  expect(sheet).toHaveTextContent('Створено, не відправлено')
  expect(sheet).toHaveTextContent('Оплата не змінюється.')
  await user.click(
    within(sheet).getByRole('button', { name: 'Прив’язати до замовлення' }),
  )

  expect(
    await screen.findByText('ТТН прив’язано до замовлення #361.'),
  ).toBeVisible()
  await waitFor(() => expect(block()).toHaveTextContent('Прив’язана'))
  expect(shippingApi.confirmExternal).toHaveBeenCalledWith(
    'int-1',
    'order-1',
    expect.objectContaining({ fingerprint: 'fp', shipmentVersion: 'v1' }),
  )
})

it('explains external waybill refusals next to the number (6.6, 6.9, 6.10)', async () => {
  vi.mocked(shippingApi.previewExternal)
    .mockRejectedValueOnce(problem('NOT_FOUND', 'not-found', 404))
    .mockRejectedValueOnce(problem('shipment_already_linked'))
    .mockResolvedValueOnce({
      number: TTN,
      fingerprint: 'fp',
      shipmentVersion: 'v1',
      providerStatus: '1',
      sender: shipment().sender,
      recipient: { ...shipment().draft.recipient, name: 'Ірина Ковальчук' },
      codAmountUah: 4000,
      recordsDispatch: false,
      recordsReceipt: false,
    })
  const { user, block } = await renderFlow({ initial: shipment() })
  await user.click(
    within(block()).getByRole('button', {
      name: 'Прив’язати накладну з кабінету НП',
    }),
  )
  const sheet = await screen.findByRole('dialog', {
    name: 'Прив’язати наявну ТТН',
  })
  const input = within(sheet).getByLabelText(/Номер накладної/)
  await user.type(input, TTN)
  const check = within(sheet).getByRole('button', {
    name: 'Перевірити накладну',
  })

  await user.click(check)
  expect(
    await within(sheet).findByText(
      'Накладну з таким номером не знайдено в кабінеті Нової пошти. Перевірте цифри.',
    ),
  ).toBeVisible()

  await user.click(check)
  expect(
    await within(sheet).findByText(
      'Ця ТТН уже прив’язана до іншого замовлення. Одна накладна — одне замовлення.',
    ),
  ).toBeVisible()

  await user.click(check)
  expect(await within(sheet).findByText('Розбіжності')).toBeVisible()
  expect(sheet).toHaveTextContent('Ірина Ковальчук')
  expect(sheet).toHaveTextContent('Прив’язати не можна')
  expect(
    within(sheet).getByRole('button', { name: 'Прив’язати до замовлення' }),
  ).toBeDisabled()
})

it('checks an external waybill again when it changed meanwhile (6.11)', async () => {
  const base = {
    number: TTN,
    fingerprint: 'fp',
    shipmentVersion: 'v1',
    providerStatus: '1',
    sender: shipment().sender,
    recipient: shipment().draft.recipient,
    codAmountUah: 4200,
    recordsDispatch: false,
    recordsReceipt: false,
  }
  vi.mocked(shippingApi.previewExternal)
    .mockResolvedValueOnce(base)
    .mockResolvedValueOnce({
      ...base,
      fingerprint: 'fp2',
      providerStatus: '9',
      recordsDispatch: true,
      recordsReceipt: true,
    })
  vi.mocked(shippingApi.confirmExternal).mockRejectedValueOnce(
    problem('shipment_preview_stale'),
  )
  const { user, block } = await renderFlow({ initial: shipment() })
  await user.click(
    within(block()).getByRole('button', {
      name: 'Прив’язати накладну з кабінету НП',
    }),
  )
  const sheet = await screen.findByRole('dialog', {
    name: 'Прив’язати наявну ТТН',
  })
  await user.type(within(sheet).getByLabelText(/Номер накладної/), TTN)
  await user.click(
    within(sheet).getByRole('button', { name: 'Перевірити накладну' }),
  )
  await user.click(
    await within(sheet).findByRole('button', {
      name: 'Прив’язати до замовлення',
    }),
  )

  expect(await within(sheet).findByText('Стан ТТН змінився')).toBeVisible()
  expect(sheet).toHaveTextContent('змінився на «Отримано»')
  expect(sheet).toHaveTextContent('Прив’язування не підтверджує оплату.')
})

it('explains a missing deposit in words and keeps creation out of reach (4.13)', async () => {
  const { user, block } = await renderFlow({
    initial: shipment(),
    delivery: money({ depositSatisfied: false, depositShortfallUah: 224 }),
  })
  expect(block()).toHaveTextContent('Депозит ще не внесено')
  expect(block()).toHaveTextContent(
    'Розбірка вимагає депозит 224,00 UAH перед відправленням. Внесено 0,00 UAH.',
  )
  expect(
    within(block()).getByRole('button', { name: 'Внести депозит' }),
  ).toBeVisible()

  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й створити ТТН' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Продовжити оформлення' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Створити ТТН' })
  expect(sheet).toHaveTextContent('бракує 224 UAH')
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeDisabled()
})
