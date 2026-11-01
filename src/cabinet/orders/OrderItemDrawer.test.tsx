import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { guardFixture } from '../currency/guard-fixture'
import { OrderItemDrawer } from './OrderItemDrawer'

const partsApi = vi.hoisted(() => ({ search: vi.fn(), get: vi.fn() }))
vi.mock('@/api/parts', () => ({ partsApi }))

const part = (id = 'part-1', name = 'Фара ліва', available = 2) => ({
  id,
  name,
  externalCode: 'OEM-123',
  oemCode: 'OEM-123',
  quantity: 3,
  quantityReserved: 1,
  quantityAvailable: available,
  status: 'available',
  car: { id: 'car-1', make: 'Tesla', model: 'Model Y', year: 2023, vin: null },
  thumbnailUrl: null,
  unit: 'pcs',
  condition: 'used',
  sourceType: 'car',
  createdAt: '2026-10-06T10:00:00Z',
  isInventoryLocked: false,
  hasDiscrepancy: false,
})
const page = (items: ReturnType<typeof part>[] = []) => ({
  items,
  page: 1,
  pageSize: 6,
  total: items.length,
  totalPages: 1,
})
const drawerProps = () => ({
  guard: guardFixture(),
  open: true,
  busy: false,
  error: null,
  orderNumber: 1,
  orderTotal: 0,
  takenPartIds: [] as string[],
  onOpenChange: vi.fn(),
  onSubmit: vi.fn(),
})
function renderDrawer(
  overrides: Partial<ComponentProps<typeof OrderItemDrawer>> = {},
) {
  return render(<OrderItemDrawer {...drawerProps()} {...overrides} />)
}
beforeEach(() => {
  vi.resetAllMocks()
  partsApi.search.mockResolvedValue(page())
  partsApi.get.mockResolvedValue({ ...part(), effectiveSalePrice: 100 })
})

it('uses the same search field and stays idle until a query is entered', async () => {
  renderDrawer()
  expect(
    screen.getByRole('searchbox', { name: 'Пошук запчастини' }),
  ).toBeVisible()
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
  })
  expect(partsApi.search).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('dialog', { name: 'Результати пошуку запчастин' }),
  ).not.toBeInTheDocument()
})

it('shows a failed search and retries the same query inside the shared dropdown', async () => {
  partsApi.search
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(page())
  const user = userEvent.setup()
  renderDrawer()
  await user.type(screen.getByRole('searchbox'), 'OEM')
  await user.click(
    await screen.findByRole('button', { name: 'Повторити пошук' }),
  )
  await screen.findByText('Нічого не знайдено')
  expect(partsApi.search).toHaveBeenLastCalledWith(
    expect.objectContaining({
      query: 'OEM',
      statuses: ['available'],
      pageSize: 6,
    }),
    expect.anything(),
  )
})

it('clearing a pending search closes the dropdown and ignores its late result', async () => {
  let resolve!: (value: ReturnType<typeof page>) => void
  partsApi.search.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const user = userEvent.setup()
  renderDrawer()
  await user.type(screen.getByRole('searchbox'), 'OEM')
  await waitFor(() => expect(partsApi.search).toHaveBeenCalledOnce())
  await user.clear(screen.getByRole('searchbox'))
  await act(async () => {
    resolve(page([part()]))
    await Promise.resolve()
  })
  expect(screen.queryByRole('option')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('dialog', { name: 'Результати пошуку запчастин' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveFocus()
})

it('offers only free stock, closes after selection and enforces its quantity limit', async () => {
  partsApi.search.mockResolvedValue(
    page([
      part(),
      { ...part('reserved', 'У резерві', 0), status: 'reserved' },
      { ...part('sold', 'Продано', 0), status: 'sold' },
    ]),
  )
  const submit = vi.fn()
  const user = userEvent.setup()
  renderDrawer({ onSubmit: submit })
  await user.type(screen.getByRole('searchbox'), 'Фара')
  const option = await screen.findByRole('option', {
    name: 'Обрати запчастину Фара ліва',
  })
  await waitFor(() => expect(option).toBeEnabled())
  expect(
    screen.queryByRole('option', { name: /У резерві|Продано/ }),
  ).not.toBeInTheDocument()
  expect(within(option).getByText('В наявності')).toBeVisible()
  expect(within(option).getByText('2 шт')).toBeVisible()
  await user.click(option)
  expect(
    screen.queryByRole('dialog', { name: 'Результати пошуку запчастин' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveValue('Фара ліва')
  await user.click(screen.getByRole('button', { name: 'Більше' }))
  expect(screen.getByRole('button', { name: 'Більше' })).toBeDisabled()
  await user.clear(screen.getByLabelText('Кількість'))
  await user.type(screen.getByLabelText('Кількість'), '999')
  expect(screen.getByLabelText('Кількість')).toHaveValue('2')
  await user.click(screen.getByRole('button', { name: 'Додати в замовлення' }))
  expect(submit).toHaveBeenCalledWith({
    partId: 'part-1',
    quantity: 2,
    unitPrice: 100,
  })
  await user.type(screen.getByRole('searchbox'), ' X')
  expect(screen.queryByText('Вибрано')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Додати в замовлення' }),
  ).toBeDisabled()
})

it('shows the same code, separate stock quantity and price as the new-order picker', async () => {
  partsApi.search.mockResolvedValue(page([part()]))
  const user = userEvent.setup()
  renderDrawer()
  await user.type(screen.getByRole('searchbox'), 'фара')
  const option = await screen.findByRole('option', { name: /Фара ліва/ })
  expect(within(option).getByText('OEM-123')).toBeVisible()
  expect(within(option).getByText('В наявності')).toBeVisible()
  expect(within(option).getByText('2 шт')).toBeVisible()
  expect(await within(option).findByText(/100,00 USD/)).toBeVisible()
})

it('starts with an empty search after closing and reopening', async () => {
  const user = userEvent.setup()
  const props = drawerProps()
  const { rerender } = render(<OrderItemDrawer {...props} />)
  await user.type(screen.getByRole('searchbox'), 'фара')
  await screen.findByText('Нічого не знайдено')
  rerender(<OrderItemDrawer {...props} open={false} />)
  rerender(<OrderItemDrawer {...props} />)
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.queryByRole('option')).not.toBeInTheDocument()
  expect(partsApi.search).toHaveBeenCalledOnce()
})

it('restores the selected part and entered values after choosing a currency', async () => {
  renderDrawer({
    draft: { query: 'Фара', pickedId: 'part-1', quantity: 2, price: '55' },
  })
  expect(screen.getByRole('searchbox')).toHaveValue('Фара')
  expect(await screen.findByDisplayValue('55')).toBeVisible()
  expect(screen.getByLabelText('Кількість')).toHaveValue('2')
  expect(
    screen.getByRole('button', { name: 'Додати в замовлення' }),
  ).toBeEnabled()
})

it('disables existing order lines and Escape closes only the results', async () => {
  partsApi.search.mockResolvedValue(page([part('taken', 'Вже додана'), part()]))
  const onOpenChange = vi.fn()
  const user = userEvent.setup()
  renderDrawer({ takenPartIds: ['taken'], onOpenChange })
  await user.type(screen.getByRole('searchbox'), 'фара')
  const taken = await screen.findByRole('option', { name: /Вже додана/ })
  await waitFor(() =>
    expect(screen.getByRole('option', { name: /Фара ліва/ })).toBeEnabled(),
  )
  expect(taken).toBeDisabled()
  expect(within(taken).getByText('у замовленні')).toBeVisible()
  await user.click(taken)
  expect(
    screen.getByRole('button', { name: 'Додати в замовлення' }),
  ).toBeDisabled()
  await user.click(screen.getByRole('searchbox'))
  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('option', { name: /Фара ліва/ })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(
    screen.queryByRole('dialog', { name: 'Результати пошуку запчастин' }),
  ).not.toBeInTheDocument()
  expect(onOpenChange).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

it('does not restore an old currency draft over a new search', async () => {
  let resolve!: (
    value: ReturnType<typeof part> & { effectiveSalePrice: number },
  ) => void
  partsApi.get.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    }),
  )
  const user = userEvent.setup()
  renderDrawer({
    draft: { query: 'Фара', pickedId: 'part-1', quantity: 2, price: '55' },
  })
  await waitFor(() => expect(partsApi.get).toHaveBeenCalledOnce())
  await user.clear(screen.getByRole('searchbox'))
  await user.type(screen.getByRole('searchbox'), 'Двері')
  await act(async () => {
    resolve({ ...part(), effectiveSalePrice: 100 })
    await Promise.resolve()
  })
  expect(screen.getByRole('searchbox')).toHaveValue('Двері')
  expect(screen.queryByText('Вибрано')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Додати в замовлення' }),
  ).toBeDisabled()
})
