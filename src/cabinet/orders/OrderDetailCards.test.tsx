import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { ordersApi } from '@/api/orders'
import { OrderCustomerCard, OrderItemsCard } from './OrderDetailCards'

const customerMocks = vi.hoisted(() => ({ getById: vi.fn() }))

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
  customerMocks.getById.mockReset()
})

it('clears the previous customer while a newly assigned customer is loading', async () => {
  customerMocks.getById.mockImplementation((id: string) => {
    if (id === 'customer-1') {
      return Promise.resolve({
        id,
        name: 'Старий клієнт',
        phone: '+380501111111',
        isActive: true,
      })
    }
    return new Promise(() => undefined)
  })

  const view = render(
    <MemoryRouter>
      <OrderCustomerCard
        accountingCurrency="USD"
        customerId="customer-1"
        customerName="Старий клієнт"
        initials="СК"
        to="/customers/customer-1"
      />
    </MemoryRouter>,
  )

  expect(await screen.findByText('+380501111111')).toBeVisible()

  view.rerender(
    <MemoryRouter>
      <OrderCustomerCard
        accountingCurrency="USD"
        customerId="customer-2"
        customerName="Новий клієнт"
        initials="НК"
        to="/customers/customer-2"
      />
    </MemoryRouter>,
  )

  expect(screen.getByText('Новий клієнт')).toBeVisible()
  expect(screen.queryByText('Старий клієнт')).not.toBeInTheDocument()
  expect(screen.queryByText('+380501111111')).not.toBeInTheDocument()
})

it('ignores a previous customer response that arrives after reassignment', async () => {
  const previous = deferred<{
    id: string
    name: string
    phone: string
    isActive: boolean
  }>()
  const current = deferred<{
    id: string
    name: string
    phone: string
    isActive: boolean
  }>()
  customerMocks.getById
    .mockReturnValueOnce(previous.promise)
    .mockReturnValueOnce(current.promise)

  const view = render(
    <MemoryRouter>
      <OrderCustomerCard
        accountingCurrency="USD"
        customerId="customer-1"
        customerName="Старий клієнт"
        initials="СК"
        to="/customers/customer-1"
      />
    </MemoryRouter>,
  )
  view.rerender(
    <MemoryRouter>
      <OrderCustomerCard
        accountingCurrency="USD"
        customerId="customer-2"
        customerName="Новий клієнт"
        initials="НК"
        to="/customers/customer-2"
      />
    </MemoryRouter>,
  )

  await act(async () => {
    previous.resolve({
      id: 'customer-1',
      name: 'Запізнілий клієнт',
      phone: '+380501111111',
      isActive: true,
    })
    await previous.promise
  })
  expect(screen.queryByText('Запізнілий клієнт')).not.toBeInTheDocument()
  expect(screen.getByText('Новий клієнт')).toBeVisible()

  current.resolve({
    id: 'customer-2',
    name: 'Актуальний клієнт',
    phone: '+380502222222',
    isActive: true,
  })
  expect(await screen.findByText('+380502222222')).toBeVisible()
  expect(screen.getByText('Актуальний клієнт')).toBeVisible()
})

it('renders an order whose API response omits the unassigned customer', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: { id: 'order-without-customer', number: 286, status: 'new' },
  })
  try {
    const order = await ordersApi.getById('order-without-customer')
    render(
      <MemoryRouter>
        <OrderCustomerCard
          accountingCurrency="USD"
          customerId={order.customerId}
          customerName={order.customerName}
          initials=""
          to={`/customers/${order.customerId}`}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Клієнта не вказано')).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(customerMocks.getById).not.toHaveBeenCalled()
  } finally {
    get.mockRestore()
  }
})

function ItemNavigation({ partsPath }: { partsPath: string | null }) {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <OrderItemsCard
        addPath={null}
        currency="USD"
        editable={false}
        items={[
          {
            id: 'item-1',
            partId: 'part-1',
            partName: 'Тестова деталь',
            partType: null,
            coverPhotoUrl: null,
            carBrand: null,
            carModel: null,
            carCode: null,
            quantity: 2,
            unitPrice: 150,
            totalPrice: 300,
          },
        ]}
        onEdit={vi.fn()}
        partsPath={partsPath}
        total={300}
      />
      <p data-testid="current-path">{location.pathname}</p>
      <button onClick={() => void navigate(-1)}>Повернутися</button>
    </>
  )
}
function renderItems(partsPath: string | null = '/app/yard/parts') {
  render(
    <MemoryRouter initialEntries={['/app/yard/orders/order-1']}>
      <ItemNavigation partsPath={partsPath} />
    </MemoryRouter>,
  )
}

it('opens the part card from empty space in an order row, leaving the total outside the target', async () => {
  const user = userEvent.setup()
  renderItems()
  await user.click(screen.getByText('Разом'))
  expect(screen.getByTestId('current-path')).toHaveTextContent(
    '/app/yard/orders/order-1',
  )
  const row = screen
    .getByRole('rowheader', { name: /Тестова деталь/ })
    .closest('tr')!
  await user.click(row)
  expect(screen.getByTestId('current-path')).toHaveTextContent(
    '/app/yard/parts/part-1',
  )
})

it('does not make an order row navigable without permission to view parts', async () => {
  const user = userEvent.setup()
  renderItems(null)
  const row = screen
    .getByRole('rowheader', { name: /Тестова деталь/ })
    .closest('tr')!
  await user.click(row)
  expect(
    screen.queryByRole('link', { name: 'Тестова деталь' }),
  ).not.toBeInTheDocument()
  expect(screen.getByTestId('current-path')).toHaveTextContent(
    '/app/yard/orders/order-1',
  )
})

it.each(['mouse', 'keyboard'])(
  'keeps the part link working with %s and creates only one history entry',
  async (method) => {
    const user = userEvent.setup()
    renderItems()
    const link = screen.getByRole('link', { name: 'Тестова деталь' })
    if (method === 'mouse') await user.click(link)
    else {
      link.focus()
      await user.keyboard('{Enter}')
    }
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/app/yard/parts/part-1',
    )
    await user.click(screen.getByRole('button', { name: 'Повернутися' }))
    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/app/yard/orders/order-1',
    )
  },
)

it('keeps the single header change button disabled when a live waybill blocks reassignment', () => {
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Владислав',
    phone: '+380733182301',
  })
  render(
    <MemoryRouter>
      <OrderCustomerCard
        accountingCurrency="USD"
        customerId="customer-1"
        customerName="Владислав"
        initials="В"
        to="/customers/customer-1"
        changeHint="Спочатку скасуйте створену ТТН."
      />
    </MemoryRouter>,
  )
  expect(
    screen.queryByRole('link', { name: 'Редагувати дані клієнта' }),
  ).toBeNull()
  expect(screen.getByRole('button', { name: 'Змінити клієнта' })).toBeDisabled()
  expect(screen.getByText('Спочатку скасуйте створену ТТН.')).toBeVisible()
  expect(
    screen.queryByText(
      'Змінює спільну картку клієнта. Отримувач у створеній ТТН не зміниться.',
    ),
  ).not.toBeInTheDocument()
})

it('opens the existing customer picker from the single header change button', async () => {
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Владислав',
    phone: null,
  })
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <OrderCustomerCard
        accountingCurrency="USD"
        customerId="customer-1"
        customerName="Владислав"
        initials="В"
        to="/customers/customer-1"
        onChange={onChange}
      />
    </MemoryRouter>,
  )
  expect(
    screen.queryByRole('link', { name: 'Редагувати дані клієнта' }),
  ).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Змінити клієнта' }))
  expect(
    screen
      .getByRole('button', { name: 'Змінити клієнта' })
      .closest('.rz-card__head'),
  ).not.toBeNull()
  expect(
    screen.getByRole('button', { name: 'Змінити клієнта' }),
  ).toHaveTextContent('Змінити')
  expect(onChange).toHaveBeenCalledOnce()
  expect(
    screen.queryByText(
      'Змінює клієнта лише цього замовлення. Після заміни перевірте отримувача доставки.',
    ),
  ).not.toBeInTheDocument()
})
