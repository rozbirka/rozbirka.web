import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { OrderCustomerDrawer } from './OrderCustomerDrawer'

const customerMocks = vi.hoisted(() => ({
  search: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/api/customers', async (importOriginal) => ({
  ...(await importOriginal()),
  customersApi: customerMocks,
}))

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  customerMocks.search.mockReset()
  customerMocks.create.mockReset()
})

it('hides results from the previous query as soon as the search changes', async () => {
  customerMocks.search
    .mockResolvedValueOnce([
      {
        id: 'customer-old',
        name: 'Старий клієнт',
        phone: '+380501111111',
        ordersCount: 1,
      },
    ])
    .mockReturnValueOnce(new Promise(() => undefined))
  const user = userEvent.setup()

  render(
    <OrderCustomerDrawer
      busy={false}
      currentId={null}
      currentName={null}
      error={null}
      onAssign={vi.fn()}
      onOpenChange={vi.fn()}
      open
      orderNumber={1}
    />,
  )

  expect(await screen.findByText('Старий клієнт')).toBeVisible()
  await user.type(screen.getByLabelText('Пошук клієнта'), 'новий')

  expect(screen.getByText('Шукаємо клієнтів…')).toBeVisible()
  expect(screen.queryByText('Старий клієнт')).not.toBeInTheDocument()
})

it('ignores a late response from the previous customer query', async () => {
  const oldSearch =
    deferred<
      { id: string; name: string; phone: string | null; ordersCount: number }[]
    >()
  const newSearch =
    deferred<
      { id: string; name: string; phone: string | null; ordersCount: number }[]
    >()
  customerMocks.search
    .mockReturnValueOnce(oldSearch.promise)
    .mockReturnValueOnce(newSearch.promise)
  const user = userEvent.setup()

  render(
    <OrderCustomerDrawer
      busy={false}
      currentId={null}
      currentName={null}
      error={null}
      onAssign={vi.fn()}
      onOpenChange={vi.fn()}
      open
      orderNumber={1}
    />,
  )

  await waitFor(() => expect(customerMocks.search).toHaveBeenCalledTimes(1))
  await user.type(screen.getByLabelText('Пошук клієнта'), 'новий')
  await waitFor(() => expect(customerMocks.search).toHaveBeenCalledTimes(2))

  await act(async () => {
    oldSearch.resolve([
      {
        id: 'customer-old',
        name: 'Запізнілий клієнт',
        phone: null,
        ordersCount: 1,
      },
    ])
    await oldSearch.promise
  })
  expect(screen.queryByText('Запізнілий клієнт')).not.toBeInTheDocument()

  newSearch.resolve([
    {
      id: 'customer-new',
      name: 'Актуальний клієнт',
      phone: null,
      ordersCount: 0,
    },
  ])
  expect(await screen.findByText('Актуальний клієнт')).toBeVisible()
})

it('does not show results from the previous opening while reloading', async () => {
  customerMocks.search
    .mockResolvedValueOnce([
      {
        id: 'customer-old',
        name: 'Клієнт із попереднього відкриття',
        phone: null,
        ordersCount: 1,
      },
    ])
    .mockReturnValueOnce(new Promise(() => undefined))

  const props = {
    busy: false,
    currentId: null,
    currentName: null,
    error: null,
    onAssign: vi.fn(),
    onOpenChange: vi.fn(),
    orderNumber: 1,
  }
  const { rerender } = render(<OrderCustomerDrawer {...props} open />)

  expect(
    await screen.findByText('Клієнт із попереднього відкриття'),
  ).toBeVisible()

  rerender(<OrderCustomerDrawer {...props} open={false} />)
  rerender(<OrderCustomerDrawer {...props} open />)

  expect(screen.getByText('Шукаємо клієнтів…')).toBeVisible()
  expect(
    screen.queryByText('Клієнт із попереднього відкриття'),
  ).not.toBeInTheDocument()
  await waitFor(() => expect(customerMocks.search).toHaveBeenCalledTimes(2))
})
