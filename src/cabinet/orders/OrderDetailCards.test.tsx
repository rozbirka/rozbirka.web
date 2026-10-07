import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { ordersApi } from '@/api/orders'
import { OrderCustomerCard } from './OrderDetailCards'

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
