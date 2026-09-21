import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { useCabinet } from '../CabinetContext'
import { CustomersScreen } from './CustomersScreen'

const customerMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/api/customers', async (importOriginal) => ({
  ...(await importOriginal()),
  customersApi: customerMocks,
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const definition = {
  key: 'customers',
  routeSegment: '/customers',
  released: true,
  viewPermission: 'customers.view',
  mutationPermission: 'customers.manage',
  allowedSubscriptionStates: ['active'],
} as never
const cabinet = (
  permissions: string[] = [
    'customers.view',
    'customers.manage',
    'orders.view',
    'orders.manage',
    'parts.view',
    'finance.view',
  ],
) =>
  ({
    status: 'ready',
    targetTenant: { id: 'tenant-1', slug: 'garage' },
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation: 1,
      role: 'manager',
      permissions: new Set(permissions),
      features: new Set(),
      entitlement: { state: 'active', usage: {} },
    },
    error: null,
  }) as unknown as ReturnType<typeof useCabinet>

/** The cabinet shell owns the toast outlet, so screen tests mount one too. */
const renderScreen = (path: string) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <CustomersScreen definition={definition} />
      </MemoryRouter>
    </ToastProvider>,
  )

afterEach(() => {
  vi.clearAllMocks()
})
beforeEach(() => vi.mocked(useCabinet).mockReturnValue(cabinet()))

it('renders the server-returned directory result instead of deriving customer statistics locally', async () => {
  const user = userEvent.setup()
  customerMocks.list.mockResolvedValue({
    items: [
      {
        id: 'customer-1',
        name: 'Ірина',
        phone: null,
        notes: null,
        ordersCount: 3,
        totalAmount: 100,
        lastOrderAt: null,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 27,
    totalPages: 2,
  })

  renderScreen('/app/garage/customers?q=Ірина&page=1')

  expect(await screen.findByText('Ірина')).toBeVisible()
  // The server's own total is what the page reports, not the page's length.
  expect(screen.getByText(/Знайдено 27 клієнтів/)).toBeVisible()
  expect(customerMocks.list).toHaveBeenCalledWith(
    { q: 'Ірина', page: 1 },
    expect.any(Object),
  )

  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  expect(customerMocks.list).toHaveBeenLastCalledWith(
    { q: 'Ірина', page: 2 },
    expect.any(Object),
  )
})

it('treats the new-customer route as a form rather than a customer identifier', () => {
  renderScreen('/app/garage/customers/new')

  expect(screen.getByRole('heading', { name: 'Новий клієнт' })).toBeVisible()
  expect(customerMocks.getById).not.toHaveBeenCalled()
})

it('uses browser-native contact links and carries only the customer id to a new order', async () => {
  const user = userEvent.setup()
  const writeText = vi.spyOn(navigator.clipboard, 'writeText')
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Ірина',
    phone: '+380501112233',
    notes: null,
    isActive: true,
    createdAt: '2026-08-28T00:00:00Z',
    orders: [
      {
        id: 'order-7',
        number: 7,
        status: 'confirmed',
        totalAmount: 10500,
        currency: 'UAH',
        partNames: ['Двері'],
        createdAt: '2026-08-28T00:00:00Z',
      },
    ],
    ordersCount: 9,
    totalAmount: 10500,
    averageAmount: 1166.67,
    firstOrderAt: null,
    lastOrderAt: null,
  })

  renderScreen('/app/garage/customers/customer-1')

  expect(await screen.findByText('9')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Зателефонувати' })).toHaveAttribute(
    'href',
    'tel:+380501112233',
  )
  expect(screen.getByRole('link', { name: 'SMS' })).toHaveAttribute(
    'href',
    'sms:+380501112233',
  )
  expect(
    screen.getByRole('link', { name: 'Створити замовлення' }),
  ).toHaveAttribute('href', '/app/garage/orders/new?customerId=customer-1')
  expect(screen.getByRole('link', { name: /#7/ })).toHaveAttribute(
    'href',
    '/app/garage/orders/order-7',
  )

  await user.click(screen.getByRole('button', { name: 'Копіювати телефон' }))
  expect(writeText).toHaveBeenCalledWith('+380501112233')
})

it('offers reuse and reactivation for the documented duplicate-phone conflict', async () => {
  customerMocks.create.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: {
          code: 'CUSTOMER_PHONE_EXISTS',
          customerId: 'customer-existing',
          customerName: 'Ірина',
          isActive: false,
          message: 'Телефон уже використовується',
        },
      },
    },
  })
  customerMocks.activate.mockResolvedValue({ id: 'customer-existing' })
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  expect(screen.getByLabelText('Телефон')).toHaveValue('+380')
  await user.type(screen.getByLabelText('Ім’я'), 'Нова Ірина')
  await user.type(screen.getByLabelText('Телефон'), '+380501112233')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  expect(
    await screen.findByRole('link', { name: 'Використати клієнта Ірина' }),
  ).toHaveAttribute('href', '/app/garage/customers/customer-existing')
  await user.click(screen.getByRole('button', { name: 'Активувати Ірина' }))
  expect(customerMocks.activate).toHaveBeenCalledWith(
    'customer-existing',
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('rechecks orders.view before reactivating a duplicate from customer edit', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Ірина',
    phone: '+380501112233',
    notes: null,
    isActive: true,
    createdAt: '2026-08-28T00:00:00Z',
    orders: [],
    ordersCount: 0,
    totalAmount: null,
    averageAmount: null,
    firstOrderAt: null,
    lastOrderAt: null,
  })
  customerMocks.update.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: {
          code: 'CUSTOMER_PHONE_EXISTS',
          customerId: 'customer-existing',
          customerName: 'Олена',
          isActive: false,
          message: 'Телефон уже використовується',
        },
      },
    },
  })
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/customer-1/edit')

  await screen.findByDisplayValue('Ірина')
  await user.click(screen.getByRole('button', { name: 'Зберегти зміни' }))
  const reactivate = await screen.findByRole('button', {
    name: 'Активувати Олена',
  })
  ;(currentCabinet.snapshot?.permissions as Set<string>).delete('orders.view')
  await user.click(reactivate)

  expect(customerMocks.activate).not.toHaveBeenCalled()
})

it('blocks create and edit mutations when the customer module decision denies them', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['customers.view']))
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Ірина',
    phone: null,
    notes: null,
    isActive: true,
    createdAt: '2026-08-28T00:00:00Z',
    orders: [],
    ordersCount: 0,
    totalAmount: null,
    averageAmount: null,
    firstOrderAt: null,
    lastOrderAt: null,
  })
  const user = userEvent.setup()
  const { unmount } = renderScreen('/app/garage/customers/new')

  await user.type(screen.getByLabelText('Ім’я'), 'Нова Ірина')
  expect(
    screen.getByRole('button', { name: 'Створити клієнта' }),
  ).toBeDisabled()
  expect(customerMocks.create).not.toHaveBeenCalled()
  unmount()

  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['customers.view', 'orders.view']),
  )
  renderScreen('/app/garage/customers/customer-1/edit')
  await screen.findByDisplayValue('Ірина')
  expect(screen.getByRole('button', { name: 'Зберегти зміни' })).toBeDisabled()
  expect(customerMocks.update).not.toHaveBeenCalled()
})

it('rechecks the latest customer permission before dispatching create', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  await user.type(screen.getByLabelText('Ім’я'), 'Нова Ірина')
  const permissions = currentCabinet.snapshot?.permissions as Set<string>
  permissions.delete('customers.manage')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  expect(customerMocks.create).not.toHaveBeenCalled()
})

it('passes the guarded tenant signal to customer create', async () => {
  customerMocks.create.mockResolvedValue({ customer: { id: 'customer-1' } })
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Нова Ірина',
    phone: null,
    notes: null,
    isActive: true,
    createdAt: '2026-08-28T00:00:00Z',
    orders: [],
    ordersCount: 0,
    totalAmount: null,
    averageAmount: null,
    firstOrderAt: null,
    lastOrderAt: null,
  })
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  await user.type(screen.getByLabelText('Ім’я'), 'Нова Ірина')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  expect(customerMocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Нова Ірина' }),
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('stops an empty name and an unusable phone at their own fields', async () => {
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))
  // Heading and field can share a name here, so the control is queried by role.
  const nameField = screen.getByRole('textbox', { name: 'Ім’я' })
  expect(nameField).toHaveAttribute('aria-invalid', 'true')
  expect(nameField).toHaveAccessibleDescription(/Введіть ім’я клієнта/)
  expect(nameField).toHaveFocus()

  await user.type(nameField, 'Нова Ірина')
  const phoneField = screen.getByRole('textbox', { name: 'Телефон' })
  fireEvent.change(phoneField, { target: { value: '+38050' } })
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  expect(phoneField).toHaveAttribute('aria-invalid', 'true')
  expect(phoneField).toHaveAccessibleDescription(/замало цифр/)
  expect(phoneField).toHaveFocus()
  expect(customerMocks.create).not.toHaveBeenCalled()
})

it('keeps a failed save on screen with its reason and lets it be retried', async () => {
  customerMocks.create
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValueOnce({ customer: { id: 'customer-1' } })
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Нова Ірина',
    phone: null,
    notes: null,
    isActive: true,
    createdAt: '2026-08-28T00:00:00Z',
    orders: [],
    ordersCount: 0,
    totalAmount: null,
    averageAmount: null,
    firstOrderAt: null,
    lastOrderAt: null,
  })
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  await user.type(screen.getByLabelText('Ім’я'), 'Нова Ірина')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Сталася непередбачена помилка',
  )
  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await waitFor(() => expect(customerMocks.create).toHaveBeenCalledTimes(2))
})

it('does not fetch bundled detail for an edit route without orders.view', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['customers.view', 'customers.manage']),
  )
  renderScreen('/app/garage/customers/customer-1/edit')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Потрібен доступ до замовлень',
  )
  expect(customerMocks.getById).not.toHaveBeenCalled()
})

it('does not fetch or render bundled order and finance detail without orders.view', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['customers.view', 'customers.manage', 'finance.view']),
  )
  renderScreen('/app/garage/customers/customer-1')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Потрібен доступ до замовлень',
  )
  expect(customerMocks.getById).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('heading', { name: 'Історія замовлень' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Витрачено')).not.toBeInTheDocument()
})

it('uses access decisions and customer eligibility for order, lifecycle, and delete actions', async () => {
  const customer = {
    id: 'customer-1',
    name: 'Ірина',
    phone: null,
    notes: null,
    isActive: false,
    createdAt: '2026-08-28T00:00:00Z',
    orders: [],
    ordersCount: 2,
    totalAmount: 500,
    averageAmount: 250,
    firstOrderAt: null,
    lastOrderAt: null,
  }
  customerMocks.getById.mockResolvedValue(customer)
  vi.mocked(useCabinet).mockReturnValue(
    cabinet([
      'customers.view',
      'customers.manage',
      'orders.view',
      'orders.manage',
      'finance.view',
    ]),
  )
  renderScreen('/app/garage/customers/customer-1')

  const user = userEvent.setup()
  await screen.findByRole('heading', { name: 'Ірина' })
  expect(
    screen.queryByRole('link', { name: 'Створити замовлення' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Редагувати' })).toBeVisible()

  // Lifecycle and deletion sit behind the overflow control.
  await user.click(screen.getByRole('button', { name: 'Інші дії з клієнтом' }))
  expect(screen.getByRole('button', { name: 'Активувати' })).toBeVisible()
  // The customer has orders, so deletion is offered but refused with a reason.
  expect(
    screen.getByRole('button', { name: 'Видалити клієнта' }),
  ).toBeDisabled()
})

it('hides finance metrics without finance.view and preserves a nullable order count', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['customers.view', 'customers.manage', 'orders.view']),
  )
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Ірина',
    phone: null,
    notes: null,
    isActive: true,
    createdAt: '2026-08-28T00:00:00Z',
    orders: [],
    ordersCount: null,
    totalAmount: null,
    averageAmount: null,
    firstOrderAt: null,
    lastOrderAt: null,
  })
  renderScreen('/app/garage/customers/customer-1')

  await screen.findByRole('heading', { name: 'Ірина' })
  // A missing order count reads as a dash rather than a zero.
  const orders = screen.getByText('Замовлень').closest('div')
  expect(within(orders as HTMLElement).getByText('—')).toBeVisible()
  expect(screen.queryByText('Витрачено')).not.toBeInTheDocument()
  expect(screen.queryByText('Середній чек')).not.toBeInTheDocument()
})

it('contains delete-dialog focus and restores it to the trigger on close', async () => {
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Ірина',
    phone: null,
    notes: null,
    isActive: true,
    createdAt: '2026-08-28T00:00:00Z',
    orders: [],
    ordersCount: 0,
    totalAmount: null,
    averageAmount: null,
    firstOrderAt: null,
    lastOrderAt: null,
  })
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/customer-1')

  await screen.findByRole('heading', { name: 'Ірина' })
  await user.click(screen.getByRole('button', { name: 'Інші дії з клієнтом' }))
  const trigger = screen.getByRole('button', { name: 'Видалити клієнта' })
  await user.click(trigger)

  const dialog = await screen.findByRole('dialog')
  const cancel = within(dialog).getByRole('button', { name: 'Скасувати' })
  const confirm = within(dialog).getByRole('button', { name: 'Підтвердити' })
  // Focus lands inside the dialog and cycles between its two answers.
  const focused = () => document.activeElement as HTMLElement | null
  expect(dialog).toContainElement(focused())
  await user.tab()
  expect(dialog).toContainElement(focused())
  expect([cancel, confirm]).toContain(focused())

  await user.click(cancel)
  // Closing hands focus back to the control that opened the question.
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Видалити клієнта' }),
    ).toHaveFocus(),
  )
})
