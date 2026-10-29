/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { shippingApi, type ShipmentListItem } from '@/api/shipping'
import { WaybillList } from './WaybillList'
import type { WaybillRights } from './WaybillsScreen'

vi.mock('@/api/shipping', () => ({
  shippingApi: { list: vi.fn(), refresh: vi.fn() },
}))

const row = (over: Partial<ShipmentListItem> = {}): ShipmentListItem => ({
  id: 'ship-1',
  version: 'v1',
  orderId: 'order-361',
  orderNumber: 361,
  state: 'Created',
  number: '20 4512 0098 7731',
  recipient: {
    name: 'Ірина Коваль',
    phone: '+380672145508',
    warehouseRef: 'w-5',
    settlementRef: 's-lviv',
    settlementName: 'Львів',
    warehouseName: 'Відділення №5: вул. Городоцька, 120',
  },
  deliveryCode: '1',
  createdAt: '2026-10-25T16:54:00Z',
  receivedAt: null,
  paymentState: 'AwaitingTransfer',
  codUah: 4200,
  syncProblem: null,
  trackingEnabled: true,
  lastSuccessAt: '2026-10-25T16:54:00Z',
  ...over,
})

const page = (items: ShipmentListItem[], total = items.length) => ({
  items,
  page: 1,
  pageSize: 20,
  total,
  totalPages: Math.max(Math.ceil(total / 20), 1),
})

const rights: WaybillRights = {
  manage: true,
  finance: true,
  integrations: true,
}

function Where() {
  const location = useLocation()
  return (
    <output data-testid="where">
      {location.pathname}
      {location.search}|{JSON.stringify(location.state)}
    </output>
  )
}

const renderList = (entry = '/app/koval/sales/waybills', over = rights) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          element={
            <WaybillList
              fallback={null}
              integrationId="int-1"
              rights={over}
              slug="koval"
            />
          }
          path="/app/koval/sales/waybills"
        />
        <Route element={<Where />} path="*" />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.mocked(shippingApi.list).mockReset()
  vi.mocked(shippingApi.refresh).mockReset()
})

it('lists delivery, cash on delivery and sync as three columns (7.1)', async () => {
  vi.mocked(shippingApi.list).mockResolvedValue(
    page([
      row(),
      row({
        id: 'ship-draft',
        state: 'Draft',
        number: null,
        deliveryCode: null,
        orderNumber: 363,
        codUah: 2600,
        paymentState: 'NoCod',
      }),
      row({
        id: 'ship-sync',
        number: '20 4512 0091 4420',
        deliveryCode: '7',
        syncProblem: 'tracking_refresh_failed',
        lastSuccessAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      }),
      row({
        id: 'ship-cancelled',
        number: '20 4512 0085 0072',
        state: 'Cancelled',
        deliveryCode: null,
      }),
    ]),
  )
  renderList()

  const table = await screen.findByRole('table', {
    name: 'Накладні Нової пошти',
  })
  const rows = within(table).getAllByRole('row')
  expect(within(rows[1]!).getByText('Створено')).toBeVisible()
  expect(within(rows[1]!).getByText('очікуємо')).toBeVisible()
  expect(within(rows[1]!).getByText('Львів · №5')).toBeVisible()
  expect(within(rows[2]!).getByText('Чернетка')).toBeVisible()
  expect(within(rows[2]!).getByText('не створено')).toBeVisible()
  // A failed sync keeps the last known delivery status beside it.
  expect(within(rows[3]!).getByText('Прибула')).toBeVisible()
  expect(within(rows[3]!).getByText('Помилка')).toBeVisible()
  expect(within(rows[3]!).getByText('2 год тому')).toBeVisible()
  expect(rows[4]).toHaveClass('opacity-60')
  expect(within(rows[4]!).getByText('Скасовано')).toBeVisible()

  expect(
    screen.getByText(
      '1 накладна не оновлювалася понад годину. Показано останній відомий статус.',
    ),
  ).toBeVisible()
  expect(within(rows[1]!).getByRole('link', { name: '#361' })).toHaveAttribute(
    'href',
    '/app/koval/orders/order-361',
  )
  expect(shippingApi.list).toHaveBeenCalledWith(
    'int-1',
    { page: 1, pageSize: 20 },
    expect.anything(),
  )
})

it('keeps search, filters and page in the address and hands them to the card (7.2)', async () => {
  vi.mocked(shippingApi.list).mockResolvedValue(page([row()], 1))
  const user = userEvent.setup()
  renderList('/app/koval/sales/waybills?q=Коваль&delivery=7&page=2')

  await screen.findByRole('table', { name: 'Накладні Нової пошти' })
  expect(shippingApi.list).toHaveBeenCalledWith(
    'int-1',
    { search: 'Коваль', deliveryCode: '7', page: 2, pageSize: 20 },
    expect.anything(),
  )
  expect(
    screen.getByRole('button', { name: /Доставка: Прибула/ }),
  ).toBeVisible()
  expect(screen.getByText('Знайдено: 1')).toBeVisible()

  await user.click(
    screen.getByRole('link', { name: 'Відкрити накладну 20 4512 0098 7731' }),
  )
  expect(screen.getByTestId('where')).toHaveTextContent(
    '/app/koval/sales/waybills/ship-1|{"listSearch":"?q=Коваль&delivery=7&page=2"}',
  )
})

it('filters by sync problems and resets everything at once', async () => {
  vi.mocked(shippingApi.list).mockResolvedValue(page([row()], 1))
  const user = userEvent.setup()
  renderList()

  await screen.findByRole('table', { name: 'Накладні Нової пошти' })
  await user.click(screen.getByRole('button', { name: 'Синхронізація' }))
  await user.click(await screen.findByRole('button', { name: 'Є проблема' }))
  expect(shippingApi.list).toHaveBeenLastCalledWith(
    'int-1',
    { hasProblem: true, page: 1, pageSize: 20 },
    expect.anything(),
  )

  await user.click(screen.getByRole('button', { name: 'Скинути' }))
  expect(shippingApi.list).toHaveBeenLastCalledWith(
    'int-1',
    { page: 1, pageSize: 20 },
    expect.anything(),
  )
})

it('hides the cash-on-delivery filter without the finance right', async () => {
  vi.mocked(shippingApi.list).mockResolvedValue(
    page([row({ codUah: null, paymentState: null })]),
  )
  renderList(undefined, { manage: false, finance: false, integrations: false })

  await screen.findByRole('table', { name: 'Накладні Нової пошти' })
  expect(screen.queryByRole('button', { name: 'Післяплата' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Доставка' })).toBeVisible()
})

it('explains an empty list and points to orders (7.5)', async () => {
  vi.mocked(shippingApi.list).mockResolvedValue(page([]))
  renderList()

  expect(await screen.findByText('Накладних ще немає')).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Перейти до замовлень' }),
  ).toHaveAttribute('href', '/app/koval/orders')
  expect(screen.queryByRole('search')).toBeNull()
})

it('says nothing matched the query and offers a reset (7.6)', async () => {
  vi.mocked(shippingApi.list).mockResolvedValue(page([]))
  const user = userEvent.setup()
  renderList('/app/koval/sales/waybills?q=20%204599')

  expect(await screen.findByText('Нічого не знайдено')).toBeVisible()
  expect(
    screen.getByText('За запитом «20 4599» накладних немає.'),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Скинути пошук і фільтри' }),
  )
  expect(shippingApi.list).toHaveBeenLastCalledWith(
    'int-1',
    { page: 1, pageSize: 20 },
    expect.anything(),
  )
})

it('reports a failed load with a retry (7.7)', async () => {
  vi.mocked(shippingApi.list)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(page([row()]))
  const user = userEvent.setup()
  renderList()

  const alert = await screen.findByRole('alert')
  expect(
    within(alert).getByText('Не вдалося завантажити накладні'),
  ).toBeVisible()
  await user.click(
    within(alert).getByRole('button', { name: 'Спробувати ще раз' }),
  )
  expect(
    await screen.findByRole('table', { name: 'Накладні Нової пошти' }),
  ).toBeVisible()
})

it('refreshes the live waybills on the page with «Оновити статуси»', async () => {
  vi.mocked(shippingApi.list).mockResolvedValue(
    page([
      row(),
      row({
        id: 'ship-2',
        orderId: 'order-2',
        receivedAt: '2026-10-26T10:00:00Z',
      }),
    ]),
  )
  vi.mocked(shippingApi.refresh).mockResolvedValue({} as never)
  const user = userEvent.setup()
  renderList()

  await screen.findByRole('table', { name: 'Накладні Нової пошти' })
  await user.click(screen.getByRole('button', { name: 'Оновити статуси' }))
  expect(shippingApi.refresh).toHaveBeenCalledTimes(1)
  expect(shippingApi.refresh).toHaveBeenCalledWith('int-1', 'order-361')
})
