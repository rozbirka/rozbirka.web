/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { novaPoshtaSetupApi } from '@/api/nova-poshta-setup'
import { ordersApi, type OrderDetail } from '@/api/orders'
import { shippingApi, type Shipment } from '@/api/shipping'
import { providerReturnApi } from '@/api/provider-return'
import type { SwitchedOff } from './use-np-integration'
import { WaybillCard } from './WaybillCard'
import type { WaybillRights } from './WaybillsScreen'

vi.mock('@/api/shipping', () => ({
  shippingApi: {
    byId: vi.fn(),
    refresh: vi.fn(),
    cancel: vi.fn(),
    label: vi.fn().mockReturnValue(new Promise(() => undefined)),
    update: vi.fn(),
    reconcile: vi.fn().mockReturnValue(new Promise(() => undefined)),
  },
}))
vi.mock('@/api/provider-return', () => ({
  providerReturnApi: { get: vi.fn(), refresh: vi.fn() },
}))
vi.mock('@/api/orders', () => ({ ordersApi: { getById: vi.fn() } }))
vi.mock('@/api/delivery', () => ({ deliveryApi: { get: vi.fn() } }))
vi.mock('@/api/nova-poshta-setup', () => ({
  novaPoshtaSetupApi: { connections: vi.fn(), recover: vi.fn() },
}))

const TTN = '20 4512 0098 7731'

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'ship-1',
  integrationId: 'int-1',
  dispatchPointId: 'point-1',
  orderId: 'order-1',
  state: 'Created',
  number: TTN,
  sender: {
    name: 'Олег Коваль',
    companyName: 'ФОП Коваль Олег Петрович',
    phone: '+380672147730',
    warehouseRef: 'w-12',
    settlementRef: 's-kyiv',
    settlementName: 'Київ',
    warehouseName: 'Відділення №12 (до 30 кг): вул. Богатирська, 6',
  },
  draft: {
    recipient: {
      name: 'Ірина Коваль',
      phone: '+380672145508',
      warehouseRef: 'w-5',
      settlementRef: 's-lviv',
      settlementName: 'Львів',
      warehouseName: 'Відділення №5: вул. Городоцька, 120',
    },
    parcels: [{ lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 4.2 }],
    declaredValueUah: 4200,
    payerType: 'Recipient',
    description: 'Запчастини',
  },
  quoteUah: 128,
  returnEstimateUah: 128,
  codUah: 4200,
  quoteAt: null,
  trackingCode: '1',
  trackingStatus: 'Створено, очікує відправлення',
  lastTrackedAt: '2026-10-25T16:54:00Z',
  relatedNumbers: [],
  connectionId: null,
  version: 'v1',
  dispatchedAt: null,
  receivedAt: null,
  paymentState: null,
  syncProblem: null,
  trackingEnabled: true,
  events: [
    {
      code: 'Created',
      name: 'ТТН створено',
      occurredAt: '2026-10-14T16:54:00Z',
      recordedAt: '2026-10-14T16:54:00Z',
    },
  ],
  ...over,
})

const delivery = {
  outstandingUah: 4200,
  payments: [],
} as unknown as DeliveryOrder
const allRights: WaybillRights = {
  manage: true,
  finance: true,
  integrations: true,
}

const renderCard = (
  rights: WaybillRights = allRights,
  switchedOff: SwitchedOff | null = null,
) =>
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/app/koval/sales/waybills/ship-1',
          state: { listSearch: '?q=Коваль&page=2' },
        },
      ]}
    >
      <ToastProvider>
        <Routes>
          <Route
            element={
              <WaybillCard
                fallback={null}
                integrationId="int-1"
                rights={rights}
                shipmentId="ship-1"
                slug="koval"
                switchedOff={switchedOff}
              />
            }
            path="/app/koval/sales/waybills/:shipmentId"
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

const header = () =>
  screen.getByRole('heading', { level: 1 }).closest<HTMLElement>('.grid')!

beforeEach(() => {
  vi.mocked(providerReturnApi.get)
    .mockReset()
    .mockReturnValue(new Promise(() => undefined))
  vi.mocked(providerReturnApi.refresh).mockReset()
  vi.mocked(shippingApi.byId).mockReset()
  vi.mocked(shippingApi.refresh).mockReset()
  vi.mocked(shippingApi.cancel).mockReset()
  vi.mocked(ordersApi.getById).mockResolvedValue({
    id: 'order-1',
    number: 361,
  } as OrderDetail)
  vi.mocked(deliveryApi.get).mockResolvedValue(delivery)
  vi.mocked(novaPoshtaSetupApi.connections).mockResolvedValue([])
})

it('shows a created waybill with every action the matrix allows (8.2)', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(shipment())
  renderCard()

  expect(
    await screen.findByRole('heading', { name: `ТТН ${TTN}` }),
  ).toBeVisible()
  expect(
    screen.getByText('Замовлення #361 · створена 14.10.2026'),
  ).toBeVisible()
  const deliveryCard = screen.getByRole('region', { name: 'Доставка' })
  for (const name of ['Друк', 'Оновити статус'])
    expect(within(deliveryCard).getByRole('button', { name })).toBeVisible()
  await userEvent.click(
    within(deliveryCard).getByRole('button', { name: 'Інші дії з накладною' }),
  )
  for (const name of ['Редагувати', 'Скасувати ТТН', 'До замовлення'])
    expect(screen.getByRole('menuitem', { name })).toBeVisible()
  await userEvent.keyboard('{Escape}')
  // «До списку» returns to the same search and page.
  expect(screen.getByRole('link', { name: 'Накладні НП' })).toHaveAttribute(
    'href',
    '/app/koval/sales/waybills?q=Коваль&page=2',
  )

  const info = screen.getByRole('region', { name: 'Накладна' })
  expect(
    within(info).getByText('Львів · Відділення №5: вул. Городоцька, 120'),
  ).toBeVisible()
  expect(within(info).getByText('Київ · №12')).toBeVisible()
  expect(within(info).getByText('1 місце · 4,2 кг · 60×40×30 см')).toBeVisible()

  expect(within(deliveryCard).getByText('Створено')).toBeVisible()
  expect(deliveryCard).not.toHaveTextContent(
    'Після відправлення зміни до накладної оформлюються через Нову пошту.',
  )
  expect(
    within(deliveryCard).getByText('Створено, очікує відправлення'),
  ).toBeVisible()

  const payment = screen.getByRole('region', { name: 'Оплата' })
  expect(within(payment).getByText('Очікуємо післяплату')).toBeVisible()
  expect(
    within(payment).getByRole('link', { name: 'Відкрити замовлення #361' }),
  ).toBeVisible()

  const history = screen.getByRole('list', { name: 'Події накладної' })
  expect(within(history).getByText('ТТН створено')).toBeVisible()
})

it.each([
  { dispatchedAt: '2026-10-25T18:05:00Z' },
  { receivedAt: '2026-10-26T11:22:00Z' },
])(
  'explains where to change a waybill after dispatch or receipt: %j',
  async (dates) => {
    vi.mocked(shippingApi.byId).mockResolvedValue(shipment(dates))
    renderCard()

    await screen.findByRole('heading', { name: `ТТН ${TTN}` })
    expect(
      within(screen.getByRole('region', { name: 'Доставка' })).getByText(
        'Після відправлення зміни до накладної оформлюються через Нову пошту.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Скасувати ТТН' })).toBeNull()
  },
)

it('continues a draft in its order, without print or tracking (8.1)', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({ state: 'Draft', number: null, trackingCode: null, events: [] }),
  )
  renderCard()

  expect(
    await screen.findByRole('heading', { name: 'ТТН Чернетка' }),
  ).toBeVisible()
  expect(screen.getByText('Замовлення #361 · не створена')).toBeVisible()
  expect(
    screen.getAllByRole('link', { name: 'Продовжити в замовленні' })[0],
  ).toHaveAttribute('href', '/app/koval/orders/order-1')
  expect(screen.queryByRole('button', { name: 'Друк' })).toBeNull()
  expect(screen.getByText('Ще не передано Новій пошті')).toBeVisible()
  expect(
    screen.getByText(
      'У чернетки немає номера ТТН, друку й відстеження. Створюється вона в замовленні.',
    ),
  ).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Оплата' })).getByText(
      'Не оплачено',
    ),
  ).toBeVisible()
})

it('keeps a received waybill to print and refresh only (8.3)', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({
      trackingCode: '9',
      trackingStatus: 'Відправлення отримано',
      dispatchedAt: '2026-10-25T18:05:00Z',
      receivedAt: '2026-10-26T11:22:00Z',
      paymentState: 'Reconciled',
    }),
  )
  renderCard()

  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  expect(within(header()).getByText('Підтверджено')).toBeVisible()
  expect(screen.getAllByRole('button', { name: 'Друк' })[0]).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Скасувати ТТН' })).toBeNull()
  expect(
    within(screen.getByRole('region', { name: 'Оплата' })).getByText(
      'Оплачено',
    ),
  ).toBeVisible()
})

it('offers only the result check while a cancel is unanswered (8.4)', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({ state: 'CancelUnknown' }),
  )
  renderCard()

  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  expect(within(header()).getByText('Скасування невідоме')).toBeVisible()
  expect(
    screen.getByText(
      'Ми надіслали скасування, але Нова пошта не підтвердила результат. Редагування й повторне скасування недоступні до перевірки.',
    ),
  ).toBeVisible()
  expect(
    screen.getAllByRole('button', { name: 'Перевірити результат' })[0],
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Скасувати ТТН' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
  expect(
    within(screen.getByRole('region', { name: 'Доставка' })).getByText(
      'Невідомо',
    ),
  ).toBeVisible()
})

it('offers recovery for a waybill of a lost cabinet (8.5)', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({ connectionId: 'conn-old', trackingCode: '7' }),
  )
  vi.mocked(novaPoshtaSetupApi.connections).mockResolvedValue([
    {
      id: 'conn-old',
      version: 'cv1',
      isCurrent: false,
      hasVerifiedAccess: false,
      waybillCount: 14,
      createdAt: '2026-08-01T10:00:00Z',
    },
  ])
  const user = userEvent.setup()
  renderCard()

  expect(await screen.findByText('Доступ до накладної втрачено')).toBeVisible()
  expect(within(header()).getByText('Немає доступу')).toBeVisible()
  expect(within(header()).getByText('Прибула')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Друк' })).toBeNull()

  await user.click(
    screen.getAllByRole('button', { name: 'Відновити доступ' })[0]!,
  )
  expect(
    await screen.findByRole('dialog', {
      name: 'Відновити доступ до старих накладних',
    }),
  ).toBeVisible()
})

it('keeps a cancelled waybill as history with the way to the order (8.6)', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({ state: 'Cancelled', trackingStatus: 'Видалено відправником' }),
  )
  renderCard()

  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  expect(within(header()).getByText('Скасовано')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Друк' })).toBeNull()
  const payment = screen.getByRole('region', { name: 'Оплата' })
  expect(within(payment).getByText('Не застосовується')).toBeVisible()
})

it('keeps the last known status when refreshing fails (8.7)', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({
      trackingCode: '7',
      trackingStatus: 'Прибула у відділення',
      dispatchedAt: '2026-10-25T18:05:00Z',
      syncProblem: 'tracking_refresh_failed',
    }),
  )
  vi.mocked(shippingApi.refresh).mockResolvedValue(
    shipment({ trackingCode: '9', receivedAt: '2026-10-26T11:22:00Z' }),
  )
  const user = userEvent.setup()
  renderCard()

  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  expect(within(header()).getByText('Не оновлюється')).toBeVisible()
  expect(screen.getByText('Прибула у відділення')).toBeVisible()
  const notice = screen
    .getByText(/Не вдалося оновити статус/)
    .closest('.rz-notice')!
  await user.click(
    within(notice as HTMLElement).getByRole('button', {
      name: 'Оновити статус',
    }),
  )
  expect(shippingApi.refresh).toHaveBeenCalledWith('int-1', 'order-1')
  expect(await within(header()).findByText('Підтверджено')).toBeVisible()
})

it('shows the waybill read-only without order management (8.8)', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(shipment())
  renderCard({ manage: false, finance: false, integrations: false })

  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  expect(
    screen.getByText(
      'Перегляд. Змінювати накладну можуть користувачі з правом «Керування замовленнями».',
    ),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Друк' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
  // Without the finance right Core sends no amounts.
  const payment = screen.getByRole('region', { name: 'Оплата' })
  expect(
    within(payment).getByText('Суми видно з правом «Фінанси».'),
  ).toBeVisible()
  expect(within(payment).queryByText('Очікуємо післяплату')).toBeNull()
})

it.each(['Редагувати', 'Скасувати ТТН'])(
  'returns focus to More after closing %s opened from the menu',
  async (action) => {
    vi.mocked(shippingApi.byId).mockResolvedValue(shipment())
    const user = userEvent.setup()
    renderCard()
    await screen.findByRole('heading', { name: `ТТН ${TTN}` })
    const more = screen.getByRole('button', { name: 'Інші дії з накладною' })
    await user.click(more)
    await user.click(screen.getByRole('menuitem', { name: action }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(more).toHaveFocus())
  },
)

it('disables edit and cancellation in More while a refresh is pending', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(shipment())
  vi.mocked(shippingApi.refresh).mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderCard()
  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  await user.click(screen.getByRole('button', { name: 'Оновити статус' }))
  await user.click(screen.getByRole('button', { name: 'Інші дії з накладною' }))
  for (const name of ['Редагувати', 'Скасувати ТТН'])
    expect(screen.getByRole('menuitem', { name })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
})

it('cancels through the confirm dialog and shows the cancelled waybill', async () => {
  vi.mocked(shippingApi.byId)
    .mockResolvedValueOnce(shipment())
    .mockResolvedValue(shipment({ state: 'Cancelled' }))
  vi.mocked(shippingApi.cancel).mockResolvedValue(undefined)
  const user = userEvent.setup()
  renderCard()

  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  await user.click(screen.getByRole('button', { name: 'Інші дії з накладною' }))
  await user.click(screen.getByRole('menuitem', { name: 'Скасувати ТТН' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Скасувати накладну?',
  })
  expect(
    within(dialog).getByText('Замовлення #361 залишиться відкритим.'),
  ).toBeVisible()
  await user.click(
    within(dialog).getByRole('button', { name: 'Скасувати ТТН' }),
  )

  expect(shippingApi.cancel).toHaveBeenCalledWith('int-1', 'order-1')
  expect(await within(header()).findByText('Скасовано')).toBeVisible()
  expect(
    await screen.findByText('ТТН скасовано. Замовлення залишилося відкритим.'),
  ).toBeVisible()
})

it('keeps a waybill read-only after Nova Poshta is switched off (2.18)', async () => {
  vi.mocked(novaPoshtaSetupApi.connections).mockClear()
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({
      trackingCode: '5',
      trackingStatus: 'Прямує до міста одержувача',
      dispatchedAt: '2026-10-26T09:00:00Z',
      lastTrackedAt: '2026-10-28T09:50:00Z',
      syncProblem: 'tracking_refresh_failed',
      connectionId: 'conn-old',
      trackingEnabled: false,
      events: [
        {
          code: 'Created',
          name: 'ТТН створено',
          occurredAt: '2026-10-25T10:00:00Z',
          recordedAt: '2026-10-25T10:00:00Z',
        },
        {
          code: '5',
          name: 'Передано перевізнику',
          occurredAt: '2026-10-26T09:00:00Z',
          recordedAt: '2026-10-26T09:00:00Z',
        },
      ],
    }),
  )
  renderCard(allRights, { at: '2026-10-28T10:14:00Z', by: 'Олег К.' })

  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  expect(within(header()).getByText('Не оновлюється')).toBeVisible()
  expect(
    screen.getByText(
      /^Інтеграцію з Новою поштою відключено 28\.10\.2026\. Статус ТТН не оновлюється/,
    ),
  ).toBeVisible()
  expect(screen.getByText(/^Останній відомий статус · /)).toBeVisible()
  for (const name of ['Друк етикетки', 'Оновити статус', 'Скасувати ТТН'])
    expect(screen.getByRole('button', { name })).toBeDisabled()
  // Nothing in the header, no sync warning with a refresh, no recovery check.
  expect(screen.queryByRole('button', { name: 'Друк' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
  expect(screen.queryByText(/Не вдалося оновити статус/)).toBeNull()
  expect(novaPoshtaSetupApi.connections).not.toHaveBeenCalled()

  const history = screen.getByRole('list', { name: 'Події накладної' })
  const items = within(history).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toEqual([
    expect.stringContaining('Інтеграцію відключено'),
    expect.stringContaining('Передано перевізнику'),
    expect.stringContaining('ТТН створено'),
  ])
  expect(
    within(items[0]!).getByText('Олег К. · статуси не оновлюються'),
  ).toBeVisible()
})

it('says when the waybill does not exist', async () => {
  vi.mocked(shippingApi.byId).mockRejectedValue({
    isAxiosError: true,
    response: { status: 404, data: { error: { code: 'not_found' } } },
  })
  renderCard()

  expect(await screen.findByText('Накладну не знайдено')).toBeVisible()
})

it.each([
  ['Cancelled', 186, 0, 'Утримано за доставку'],
  ['AwaitingRefund', 0, 300, 'Потрібне повернення'],
] as const)(
  'uses the order settlement %s when the shipment has no payout state',
  async (workflowState, retainedDeliveryCostUah, refundDueUah, label) => {
    vi.mocked(shippingApi.byId).mockResolvedValue(
      shipment({ trackingCode: '103', codUah: 200, paymentState: null }),
    )
    vi.mocked(deliveryApi.get).mockResolvedValue({
      ...delivery,
      outstandingUah: 0,
      workflowState,
      retainedDeliveryCostUah,
      refundDueUah,
      refundAllocations: [],
    })
    renderCard()
    const payment = await screen.findByRole('region', { name: 'Оплата' })
    expect(within(payment).getByText(label)).toBeVisible()
    expect(within(payment).queryByText('Очікуємо післяплату')).toBeNull()
    expect(within(payment).queryByText('Оплачено')).toBeNull()
  },
)

it('explains paused tracking without hiding the last carrier status', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({
      trackingCode: '7',
      trackingStatus: 'Прибула у відділення',
      dispatchedAt: '2026-10-25T18:05:00Z',
      syncProblem: 'tracking_unavailable',
      trackingPaused: true,
      trackingFailures: 10,
    }),
  )
  renderCard()
  await screen.findByRole('heading', { name: `ТТН ${TTN}` })
  expect(screen.getByText(/Автоматичні перевірки призупинено/)).toBeVisible()
  expect(screen.getByText('Прибула у відділення')).toBeVisible()
  expect(screen.getByText(/Невдалих спроб: 10/)).toBeVisible()
})

it('lets the tracking attention destination resume a paused reverse waybill independently of source tracking', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(
    shipment({ trackingCode: '103', dispatchedAt: null }),
  )
  const reverse = {
    sourceVersion: 'v1',
    version: 'return-v1',
    state: 'Accepted',
    requestRef: 'return-ref',
    requestNumber: 'return-request',
    requestStatus: 'Accepted',
    reverse: { number: 'REVERSE-TEST', status: 'В дорозі', statusAt: null },
    capability: { canCreate: false, blockReason: null },
    trackingPaused: true,
    syncProblem: 'tracking_unauthorized',
    trackingEnabled: true,
  }
  vi.mocked(providerReturnApi.get).mockResolvedValue(reverse)
  vi.mocked(providerReturnApi.refresh).mockResolvedValue({
    ...reverse,
    trackingPaused: false,
    syncProblem: null,
  })
  renderCard()
  const card = await screen.findByRole('region', { name: 'Доставка' })
  expect(await within(card).findByText('REVERSE-TEST')).toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: 'Повернення посилки · Нова пошта' }),
  ).not.toBeInTheDocument()
  await userEvent.click(
    within(card)
      .getAllByRole('button', { name: 'Інші дії з накладною' })
      .at(-1)!,
  )
  await userEvent.click(
    await screen.findByRole('menuitem', {
      name: 'Повернення посилки · Нова пошта',
    }),
  )
  const panel = await screen.findByRole('dialog', {
    name: 'Повернення посилки · Нова пошта',
  })
  await userEvent.click(
    within(panel).getByRole('button', { name: 'Оновити повернення' }),
  )
  expect(providerReturnApi.refresh).toHaveBeenCalledWith('int-1', 'ship-1')
  expect(shippingApi.refresh).not.toHaveBeenCalled()
})

it('keeps booking and finding a return in the order rather than the waybill menus', async () => {
  vi.mocked(shippingApi.byId).mockResolvedValue(shipment())
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    sourceVersion: 'v1',
    version: null,
    state: null,
    requestRef: null,
    requestNumber: null,
    requestStatus: null,
    reverse: null,
    capability: { canCreate: true, canFindExternal: true, blockReason: null },
  })
  renderCard()
  const card = await screen.findByRole('region', { name: 'Доставка' })
  await userEvent.click(
    within(card).getAllByRole('button', { name: 'Інші дії з накладною' })[0]!,
  )
  expect(
    screen.queryByRole('menuitem', { name: 'Оформити повернення НП' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Знайти повернення в НП' }),
  ).not.toBeInTheDocument()
})

it.each([
  ['Unknown', 'Результат заявки невідомий'],
  ['Submitting', 'Заявка надсилається'],
  ['Rejected', 'НП відхилила заявку'],
  ['Accepted', 'Заявку прийнято · Очікуємо зворотну ТТН'],
])(
  'shows the %s return inside the delivery card, with details in More',
  async (state, label) => {
    vi.mocked(shippingApi.byId).mockResolvedValue(shipment())
    vi.mocked(providerReturnApi.get).mockResolvedValue({
      sourceVersion: 'v1',
      version: 'return-v1',
      state,
      requestRef: state === 'Accepted' ? 'ref' : null,
      requestNumber: state === 'Accepted' ? '102-001' : null,
      requestStatus: null,
      reverse: null,
      capability: { canCreate: false, blockReason: null },
    })
    renderCard()
    const card = await screen.findByRole('region', { name: 'Доставка' })
    expect(await within(card).findByText(label)).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Повернення посилки · Нова пошта' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Оновити повернення' }),
    ).not.toBeInTheDocument()
  },
)
