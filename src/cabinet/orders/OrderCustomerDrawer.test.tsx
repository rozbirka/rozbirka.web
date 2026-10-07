import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n'
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

const drawerProps = {
  busy: false,
  currentId: null,
  currentName: null,
  error: null,
  onOpenChange: vi.fn(),
  open: true,
  orderNumber: 12,
}

it.each([
  ['Ukrainian national', '050 111 22 33', '+380501112233'],
  ['British', '+44 7700 900123', '+447700900123'],
  ['German', '+49 30 1234567', '+49301234567'],
])(
  'creates a customer with a %s number without rewriting it',
  async (_, typed, saved) => {
    customerMocks.search.mockResolvedValue([])
    customerMocks.create.mockResolvedValue({ customer: { id: 'customer-new' } })
    const onAssign = vi.fn()
    const user = userEvent.setup()
    render(<OrderCustomerDrawer {...drawerProps} onAssign={onAssign} />)

    await user.click(
      await screen.findByRole('button', { name: 'Новий клієнт' }),
    )
    await user.type(screen.getByLabelText('Ім’я або назва компанії'), 'Клієнт')
    const phone = screen.getByLabelText('Телефон')
    expect(phone).toHaveValue('+380')
    await user.clear(phone)
    await user.type(phone, typed)
    await user.click(
      screen.getByRole('button', { name: 'Створити й призначити' }),
    )

    expect(customerMocks.create).toHaveBeenCalledWith({
      name: 'Клієнт',
      phone: saved,
    })
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith('customer-new'))
  },
)

it('explains an incomplete number in an international, country-neutral way', async () => {
  customerMocks.search.mockResolvedValue([])
  const user = userEvent.setup()
  render(<OrderCustomerDrawer {...drawerProps} onAssign={vi.fn()} />)

  await user.click(await screen.findByRole('button', { name: 'Новий клієнт' }))
  await user.type(screen.getByLabelText('Ім’я або назва компанії'), 'Клієнт')
  await user.type(screen.getByLabelText('Телефон'), '50111')
  await user.tab()

  expect(screen.getByLabelText('Телефон')).toHaveAccessibleDescription(
    /потрібен міжнародний формат/,
  )
  expect(
    screen.getByRole('button', { name: 'Створити й призначити' }),
  ).toBeDisabled()
})

it('renders the customer picker in British English', async () => {
  customerMocks.search.mockResolvedValue([
    {
      id: 'customer-1',
      name: 'John Smith',
      phone: '+447700900123',
      ordersCount: 2,
    },
  ])
  render(
    <LocaleProvider locale="en-GB">
      <OrderCustomerDrawer {...drawerProps} onAssign={vi.fn()} />
    </LocaleProvider>,
  )

  expect(await screen.findByText('+44 7700 900123 · 2 orders')).toBeVisible()
  expect(screen.getByRole('dialog', { name: 'Add customer' })).toBeVisible()
  expect(screen.getByText('Order #12 · customer')).toBeVisible()
  expect(screen.getByLabelText('Search customers')).toBeVisible()
  expect(screen.getByText('No customer set')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Assign customer' })).toBeDisabled()
})
