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
import { deliveryApi } from '@/api/delivery'
import { integrationsApi } from '@/api/integrations'
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
  deliveryApi: {
    get: vi.fn().mockReturnValue(new Promise(() => undefined)),
    configure: vi.fn(),
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
    label: vi.fn(),
    update: vi.fn(),
    reconcile: vi.fn(),
    searchRecoveryCandidates: vi.fn(),
    previewRecoveryCandidate: vi.fn(),
    confirmRecoveryCandidate: vi.fn(),
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
  expect(sheet).toHaveTextContent('Додаткова передоплата не потрібна')
  expect(shippingApi.estimate).not.toHaveBeenCalled()

  await user.click(within(sheet).getByRole('button', { name: 'Створити ТТН' }))

  expect(await screen.findByText(`ТТН ${TTN} створено.`)).toBeVisible()
  await waitFor(() => expect(screen.getByText(TTN)).toHaveFocus())
  expect(block()).toHaveTextContent('Статус НП: Створено, очікує відправлення')
  expect(
    within(block()).getByRole('button', { name: 'Скасувати ТТН' }),
  ).toBeVisible()
})

it.each([
  {
    scenario: 'fully paid goods',
    appliedUah: 4500,
    outstandingUah: 0,
    expected: 'Додаткова передоплата не потрібна',
  },
  {
    scenario: 'a partial payment covering the minimum',
    appliedUah: 300,
    outstandingUah: 4200,
    expected: 'Додаткова передоплата не потрібна',
  },
])(
  'describes deposit coverage without inventing a separate payment: $scenario',
  async ({ appliedUah, outstandingUah, expected }) => {
    const { user, block } = await renderFlow({
      initial: shipment(),
      delivery: money({
        agreedTotalUah: 4500,
        appliedUah,
        outstandingUah,
        netReceivedUah: appliedUah,
        requiredDepositUah: 185,
      }),
    })
    await user.click(
      within(block()).getByRole('button', {
        name: 'Перевірити й створити ТТН',
      }),
    )
    const checks = await screen.findByRole('dialog', {
      name: 'Перевірка перед створенням ТТН',
    })
    expect(checks).toHaveTextContent('Вимога передоплати')
    expect(checks).not.toHaveTextContent('Депозит за доставку внесено')
    if (outstandingUah === 0) expect(checks).toHaveTextContent(expected)
    await user.click(
      within(checks).getByRole('button', { name: 'Продовжити оформлення' }),
    )
    const confirmation = await screen.findByRole('dialog', {
      name: 'Створити ТТН',
    })
    expect(confirmation).toHaveTextContent('Мінімальна передоплата')
    expect(confirmation).toHaveTextContent(expected)
    expect(confirmation).not.toHaveTextContent('185 UAH · внесено')
    expect(
      within(confirmation).getByRole('button', { name: 'Створити ТТН' }),
    ).toBeEnabled()
    expect(shippingApi.create).not.toHaveBeenCalled()
  },
)

it('shows a failed estimate instead of a received quote and lets it be retried', async () => {
  vi.mocked(shippingApi.estimate).mockRejectedValueOnce(
    problem('shipment_sender_revalidation_required'),
  )
  const { user, block } = await renderFlow({
    initial: shipment({ quoteAt: null, quoteUah: null }),
  })
  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й створити ТТН' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Продовжити оформлення' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Створити ТТН' })
  expect(
    await within(sheet).findByText(
      /Відправника в налаштуваннях Нової пошти змінено/,
    ),
  ).toBeVisible()
  expect(within(sheet).getByText('Помилка розрахунку')).toBeVisible()
  expect(within(sheet).queryByText('Розрахунок отримано')).toBeNull()
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeDisabled()

  vi.mocked(shippingApi.estimate).mockResolvedValue(shipment())
  await user.click(
    within(sheet).getByRole('button', { name: 'Повторити розрахунок' }),
  )
  expect(await within(sheet).findByText('Розрахунок отримано')).toBeVisible()
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeEnabled()
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
  vi.mocked(shippingApi.searchRecoveryCandidates).mockResolvedValue({
    shipmentVersion: 'v1',
    status: 'NotFound',
    candidates: [],
  })
  vi.mocked(shippingApi.previewRecoveryCandidate).mockResolvedValue({
    shipmentVersion: 'v1',
    status: 'Found',
    candidates: [
      {
        number: TTN,
        createdAt: null,
        sender: shipment().sender,
        recipient: shipment().draft.recipient,
        codUah: 4200,
        fingerprint: 'fp',
        canConfirm: true,
      },
    ],
  })
  vi.mocked(shippingApi.confirmRecoveryCandidate).mockResolvedValue(created())
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
    name: 'Перевірити створення ТТН',
  })
  const input = await within(check).findByLabelText(/Номер/)
  await user.type(input, '2045 1200 9877 31')
  await user.click(
    within(check).getByRole('button', { name: 'Перевірити номер' }),
  )
  expect(
    await within(check).findByText('Ірина Коваль · +380 67 214 55 08'),
  ).toBeVisible()
  await user.click(
    within(check).getByRole('button', { name: 'Підтвердити цю ТТН' }),
  )

  expect(await screen.findByText(`ТТН ${TTN} створено.`)).toBeVisible()
  expect(shippingApi.confirmRecoveryCandidate).toHaveBeenLastCalledWith(
    'int-1',
    'order-1',
    { number: TTN, shipmentVersion: 'v1', fingerprint: 'fp' },
  )
})

it('waits instead of claiming success when the check finds no proof (5.15)', async () => {
  vi.mocked(shippingApi.searchRecoveryCandidates).mockRejectedValue(
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
    delivery: money({
      appliedUah: 0,
      netReceivedUah: 0,
      outstandingUah: 9600,
      depositSatisfied: false,
      depositShortfallUah: 224,
    }),
  })
  expect(
    within(screen.getByRole('region', { name: 'Оплата' })).getByText(
      'Мінімальна передоплата',
    ),
  ).toBeVisible()
  expect(block()).toHaveTextContent('Потрібна мінімальна передоплата')
  expect(block()).toHaveTextContent(
    'Мінімальна передоплата: 224,00 UAH. Отримано від клієнта: 0,00 UAH.',
  )
  expect(
    within(block()).getByRole('button', { name: 'Внести передоплату' }),
  ).toBeVisible()

  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й створити ТТН' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Продовжити оформлення' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Створити ТТН' })
  expect(sheet).toHaveTextContent('Залишилось внести: 224 UAH')
  expect(
    within(sheet).getByRole('button', { name: 'Створити ТТН' }),
  ).toBeDisabled()
})

it('keeps editing reachable to waive prepayment for a newly trusted customer on an existing draft', async () => {
  const current = shipment()
  vi.mocked(integrationsApi.divisions).mockResolvedValueOnce({
    items: [
      {
        ref: current.draft.recipient.warehouseRef,
        name: 'Відділення №5',
        receivingAllowed: true,
      },
    ],
    page: 1,
    lastPage: 1,
  } as never)
  vi.mocked(deliveryApi.configure).mockResolvedValueOnce(
    money({
      customerTrusted: true,
      depositWaived: true,
      appliedUah: 0,
      netReceivedUah: 0,
      outstandingUah: 9600,
      depositSatisfied: true,
      depositShortfallUah: 0,
    }),
  )
  vi.mocked(shippingApi.saveDraft).mockResolvedValueOnce(current)
  const { user, block } = await renderFlow({
    initial: current,
    delivery: money({
      customerTrusted: true,
      depositWaived: false,
      appliedUah: 0,
      netReceivedUah: 0,
      outstandingUah: 9600,
      depositSatisfied: false,
      depositShortfallUah: 224,
    }),
  })
  expect(block()).toHaveTextContent(
    'Довірений клієнт: можна вимкнути передоплату в «Редагувати».',
  )
  expect(
    within(block()).getByRole('button', { name: 'Внести передоплату' }),
  ).toBeVisible()
  await user.click(within(block()).getByRole('button', { name: 'Редагувати' }))
  const drawer = await screen.findByRole('dialog', {
    name: 'Оформлення доставки',
  })
  const requirePrepayment = within(drawer).getByRole('switch', {
    name: 'Вимагати мінімальну передоплату',
  })
  expect(requirePrepayment).toBeChecked()
  await user.click(requirePrepayment)
  expect(requirePrepayment).not.toBeChecked()
  await user.click(
    within(drawer).getByRole('button', { name: 'Зберегти чернетку' }),
  )
  await waitFor(() =>
    expect(deliveryApi.configure).toHaveBeenCalledWith(
      'order-1',
      undefined,
      true,
    ),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Оформлення доставки' }),
    ).not.toBeInTheDocument(),
  )
  expect(block()).not.toHaveTextContent('Потрібна мінімальна передоплата')
  expect(shippingApi.create).not.toHaveBeenCalled()
})

it('edits recipient surname and given name separately before the parcel is dispatched', async () => {
  const original = created()
  vi.mocked(shippingApi.update).mockResolvedValue(original)
  const { user, block } = await renderFlow({
    initial: {
      ...original,
      draft: {
        ...original.draft,
        recipient: { ...original.draft.recipient, name: 'Соболь Владислав' },
      },
    },
  })
  await user.click(within(block()).getByRole('button', { name: 'Редагувати' }))
  const sheet = await screen.findByRole('dialog', { name: 'Редагувати ТТН' })
  const surname = within(sheet).getByLabelText('Прізвище')
  expect(surname).toHaveValue('Соболь')
  expect(within(sheet).getByLabelText('Ім’я')).toHaveValue('Владислав')
  await user.clear(surname)
  expect(
    within(sheet).getByRole('button', { name: 'Зберегти зміни' }),
  ).toBeDisabled()
  await user.type(surname, 'Коваль')
  await user.click(
    within(sheet).getByRole('button', { name: 'Зберегти зміни' }),
  )
  expect(shippingApi.update).toHaveBeenCalledWith(
    'int-1',
    'order-1',
    'v1',
    expect.objectContaining({
      recipient: expect.objectContaining({
        name: 'Коваль Владислав',
      }) as unknown,
    }),
  )
})

it('blocks recreation with a missing given name instead of promoting the patronymic into it', async () => {
  const original = created()
  const { user, block } = await renderFlow({
    initial: {
      ...original,
      draft: {
        ...original.draft,
        recipient: {
          ...original.draft.recipient,
          name: 'Соболь Владислав Ігорович',
        },
      },
    },
  })
  await user.click(within(block()).getByRole('button', { name: 'Редагувати' }))
  const sheet = await screen.findByRole('dialog', { name: 'Редагувати ТТН' })
  const given = within(sheet).getByLabelText('Ім’я')
  await user.clear(given)
  expect(
    within(sheet).getByRole('button', { name: 'Потрібна нова ТТН' }),
  ).toBeDisabled()
  expect(within(sheet).getByLabelText('По батькові')).toHaveValue('Ігорович')
  expect(shippingApi.cancel).not.toHaveBeenCalled()
  await user.type(given, 'Владислав')
  expect(
    within(sheet).getByRole('button', { name: 'Потрібна нова ТТН' }),
  ).toBeEnabled()
})

it('locks every close control while Nova Poshta creates the waybill (4.9)', async () => {
  let finish!: (value: Shipment) => void
  vi.mocked(shippingApi.create).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { user, block } = await renderFlow({ initial: shipment() })
  await user.click(
    within(block()).getByRole('button', { name: 'Перевірити й створити ТТН' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Продовжити оформлення' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'Створити ТТН' })
  await user.click(within(sheet).getByRole('button', { name: 'Створити ТТН' }))
  expect(sheet).toHaveAttribute('aria-busy', 'true')
  expect(within(sheet).getByRole('button', { name: 'Закрити' })).toBeDisabled()
  expect(within(sheet).getByRole('button', { name: 'Назад' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(sheet).toBeVisible()
  finish(created())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
