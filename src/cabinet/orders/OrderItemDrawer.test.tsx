import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { guardFixture } from '../currency/guard-fixture'
import { OrderItemDrawer } from './OrderItemDrawer'

const partsApi = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }))
vi.mock('@/api/parts', () => ({
  partsApi,
}))
const inventoryApi = vi.hoisted(() => ({ getPartZones: vi.fn() }))
vi.mock('@/api/inventory', () => ({
  inventoryApi,
}))

beforeEach(() => {
  vi.resetAllMocks()
  // Most tests do not care where a part lies; the row simply omits it.
  inventoryApi.getPartZones.mockResolvedValue([])
})

function renderDrawer() {
  return render(
    <OrderItemDrawer
      guard={guardFixture()}
      open
      busy={false}
      error={null}
      orderNumber={1}
      orderTotal={0}
      takenPartIds={[]}
      onOpenChange={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )
}

it('stays idle without fetching stock until a query is entered', async () => {
  partsApi.list.mockResolvedValue({ items: [] })
  renderDrawer()
  expect(screen.getByText('Введіть назву або OEM-код')).toBeVisible()
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
  })
  expect(partsApi.list).not.toHaveBeenCalled()
  expect(screen.queryByText('Шукаємо запчастини…')).not.toBeInTheDocument()
})

it('shows failure instead of empty results and retries the same query', async () => {
  partsApi.list
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ items: [] })
  const user = userEvent.setup()
  renderDrawer()
  await user.type(
    screen.getByRole('textbox', { name: 'Пошук запчастини' }),
    'OEM',
  )
  expect(screen.getByText('Шукаємо запчастини…')).toBeVisible()
  await user.click(
    await screen.findByRole('button', { name: 'Повторити пошук' }),
  )
  expect(
    screen.queryByRole('button', { name: 'Повторити пошук' }),
  ).not.toBeInTheDocument()
  await screen.findByText('Нічого не знайдено. Спробуйте OEM-код.')
  expect(partsApi.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ q: 'OEM', status: 'available' }),
  )
})

it('clearing a pending search returns to idle and ignores its late result', async () => {
  let resolve!: (value: { items: never[] }) => void
  partsApi.list.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const user = userEvent.setup()
  renderDrawer()
  await user.type(
    screen.getByRole('textbox', { name: 'Пошук запчастини' }),
    'OEM',
  )
  await waitFor(() => expect(partsApi.list).toHaveBeenCalledTimes(1))
  await user.click(screen.getByRole('button', { name: 'Очистити пошук' }))
  await act(async () => {
    resolve({ items: [] })
    await Promise.resolve()
  })
  expect(screen.getByText('Введіть назву або OEM-код')).toBeVisible()
  expect(screen.queryByText(/Нічого не знайдено/)).not.toBeInTheDocument()
  expect(
    screen.getByRole('textbox', { name: 'Пошук запчастини' }),
  ).toHaveFocus()
})

it('only offers available stock, including the free remainder of a reserved part', async () => {
  const part = {
    id: 'available',
    name: 'Двері',
    photos: [],
    quantityTotal: 3,
    quantityReserved: 1,
    quantityAvailable: 2,
    quantitySoldTotal: 0,
    status: 'available',
    car: null,
    order: null,
    externalCode: null,
  }
  partsApi.list.mockResolvedValue({
    items: [
      part,
      {
        ...part,
        id: 'reserved',
        name: 'У резерві',
        quantityAvailable: 0,
        quantityReserved: 3,
      },
      {
        ...part,
        id: 'sold',
        name: 'Продано',
        quantityAvailable: 0,
        quantityTotal: 0,
      },
    ],
    page: 1,
    pageSize: 8,
    total: 3,
    totalPages: 1,
  })
  partsApi.get.mockResolvedValue({
    effectiveSalePrice: 100,
  })
  const submit = vi.fn()
  const user = userEvent.setup()
  render(
    <OrderItemDrawer
      guard={guardFixture()}
      open
      busy={false}
      error={null}
      orderNumber={1}
      orderTotal={0}
      takenPartIds={[]}
      onOpenChange={vi.fn()}
      onSubmit={submit}
    />,
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Пошук запчастини' }),
    'Двері',
  )
  await screen.findByRole('button', { name: /Двері/ })
  expect(
    screen.queryByRole('button', { name: /У резерві/ }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /Продано/ }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('group', { name: 'Наявність' }),
  ).not.toBeInTheDocument()
  expect(partsApi.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'available' }),
  )
  await waitFor(() =>
    expect(partsApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'Двері', status: 'available' }),
    ),
  )
  await user.click(screen.getByRole('button', { name: /Двері/ }))
  await user.click(screen.getByRole('button', { name: 'Більше' }))
  expect(screen.getByRole('button', { name: 'Більше' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Додати в замовлення' }))
  expect(submit).toHaveBeenCalledWith({
    partId: 'available',
    quantity: 2,
    unitPrice: 100,
  })
  partsApi.list.mockImplementation(() => new Promise(() => undefined))
  await user.type(
    screen.getByRole('textbox', { name: 'Пошук запчастини' }),
    ' X',
  )
  expect(
    screen.queryByRole('button', { name: /Двері/ }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Вибрано')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Додати в замовлення' }),
  ).toBeDisabled()
  expect(screen.getByText('Шукаємо запчастини…')).toBeVisible()
})

it('names the car by its plate and says where the part lies', async () => {
  partsApi.list.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Карта дверей RR',
        externalCode: null,
        photos: [],
        quantityTotal: 1,
        quantityReserved: 0,
        quantityAvailable: 1,
        quantitySoldTotal: 0,
        status: 'available',
        car: {
          id: 'car-1',
          make: 'Tesla',
          model: 'Model Y',
          year: 2023,
          vin: null,
        },
        order: null,
      },
    ],
  })
  partsApi.get.mockResolvedValue({
    oemCode: '1494120-00-B',
    carCode: 'BC 9105 TX',
    effectiveSalePrice: 320,
  })
  inventoryApi.getPartZones.mockResolvedValue([
    { isSystemUnassigned: false, warehouseName: 'Склад B', zoneCode: '04-2' },
  ])
  const user = userEvent.setup()
  renderDrawer()

  await user.type(screen.getByLabelText('Пошук запчастини'), 'карта')

  // The plate is how a yard names a car out loud, and the shelf is what the
  // picker walks to — both belong on the one line under the name.
  expect(
    await screen.findByText(
      '1494120-00-B · Tesla Model Y 2023 · BC 9105 TX · Склад B · 04-2',
    ),
  ).toBeVisible()
})

it('starts with an empty search after it is closed and opened again', async () => {
  partsApi.list.mockResolvedValue({ items: [] })
  const user = userEvent.setup()
  const props = {
    busy: false,
    error: null,
    orderNumber: 1,
    orderTotal: 0,
    takenPartIds: [] as string[],
    guard: guardFixture(),
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
  }
  const { rerender } = render(<OrderItemDrawer {...props} open />)

  await user.type(screen.getByLabelText('Пошук запчастини'), 'двері')
  await screen.findByText('Нічого не знайдено. Спробуйте OEM-код.')

  rerender(<OrderItemDrawer {...props} open={false} />)
  rerender(<OrderItemDrawer {...props} open />)

  expect(screen.getByLabelText('Пошук запчастини')).toHaveValue('')
  expect(screen.getByText('Введіть назву або OEM-код')).toBeVisible()
  expect(partsApi.list).toHaveBeenCalledTimes(1)
})

it('comes back with the item typed before choosing the currency', async () => {
  partsApi.list.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Фара ліва',
        photos: [],
        quantityTotal: 2,
        quantityReserved: 0,
        quantityAvailable: 2,
        quantitySoldTotal: 0,
        status: 'available',
        car: null,
        order: null,
        externalCode: null,
      },
    ],
    page: 1,
    pageSize: 8,
    total: 1,
    totalPages: 1,
  })
  partsApi.get.mockResolvedValue({ effectiveSalePrice: 40 })
  render(
    <OrderItemDrawer
      busy={false}
      draft={{ query: 'Фара', pickedId: 'part-1', quantity: 2, price: '55' }}
      error={null}
      guard={guardFixture()}
      onOpenChange={vi.fn()}
      onSubmit={vi.fn()}
      open
      orderNumber={1}
      orderTotal={0}
      takenPartIds={[]}
    />,
  )
  expect(screen.getByRole('textbox', { name: 'Пошук запчастини' })).toHaveValue(
    'Фара',
  )
  expect(await screen.findByDisplayValue('55')).toBeVisible()
})
