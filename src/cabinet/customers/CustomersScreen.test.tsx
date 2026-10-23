import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { LocaleProvider } from '@/i18n'
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
    targetTenant: {
      id: 'tenant-1',
      slug: 'garage',
      accountingCurrency: 'USD',
      currencyLocked: true,
    },
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
beforeEach(() => {
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  customerMocks.list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
})

it('returns from a customer card to the customer directory', async () => {
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
  const router = createMemoryRouter(
    [
      {
        path: '/app/:tenant',
        children: [
          { path: 'customers', element: <p>Екран клієнтів</p> },
          {
            path: 'customers/:customerId',
            element: <CustomersScreen definition={definition} />,
          },
        ],
      },
    ],
    { initialEntries: ['/app/garage/customers/customer-1'] },
  )
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )

  // The breadcrumb's «Клієнти» leads back to the directory.
  await user.click(await screen.findByRole('link', { name: 'Клієнти' }))

  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/app/garage/customers'),
  )
  expect(screen.getByText('Екран клієнтів')).toBeVisible()
})

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

it('opens the new-customer form in the standard side drawer over the directory', () => {
  customerMocks.list.mockReturnValue(new Promise(() => undefined))
  renderScreen('/app/garage/customers/new')

  expect(screen.getByText('Клієнти', { selector: 'h1' })).toBeInTheDocument()
  const drawer = screen.getByRole('dialog', { name: 'Новий клієнт' })
  expect(drawer).toHaveClass('rz-sheet')
  // The shared drawer: its footer keeps the save action in view.
  expect(
    within(drawer).getByRole('button', { name: 'Створити клієнта' }),
  ).toHaveAttribute('form', 'customer-form')
  expect(customerMocks.getById).not.toHaveBeenCalled()
})

it('keeps the customer drawer open while creation is pending', async () => {
  customerMocks.create.mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  await user.type(screen.getByLabelText('Ім’я'), 'Ірина')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))
  await waitFor(() => expect(customerMocks.create).toHaveBeenCalledOnce())

  const cancel = screen.getByRole('button', { name: 'Скасувати' })
  expect(cancel).toBeDisabled()
  fireEvent.click(cancel)
  expect(screen.getByRole('dialog', { name: 'Новий клієнт' })).toBeVisible()
})

it('uses browser-native contact links and opens a new order over the customer card', async () => {
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
  expect(screen.getByRole('link', { name: /#7/ })).toHaveAttribute(
    'href',
    '/app/garage/orders/order-7',
  )
  const average = screen.getByText('Середній чек').closest('div')
  // v2 KPI: the figure large, the ISO code as its unit.
  expect(average).toHaveTextContent(/1\s167,00\s*USD/)
  await user.click(screen.getByRole('button', { name: 'Копіювати телефон' }))
  expect(writeText).toHaveBeenCalledWith('+380501112233')

  await user.click(screen.getByRole('button', { name: 'Створити замовлення' }))
  expect(screen.getByRole('dialog', { name: 'Нове замовлення' })).toBeVisible()
  expect(screen.getByText('Ірина', { selector: 'h1' })).toBeVisible()
  expect(
    screen.getByRole('status', { name: 'Клієнта обрано' }),
  ).toHaveTextContent('Ірина')
  expect(screen.queryByRole('searchbox', { name: 'Пошук клієнта' })).toBeNull()
})

it('paginates a customer order history by 20 orders', async () => {
  const user = userEvent.setup()
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Ірина',
    phone: '+380501112233',
    notes: null,
    isActive: true,
    createdAt: '2026-08-28T00:00:00Z',
    orders: Array.from({ length: 21 }, (_, index) => ({
      id: `order-${String(index + 1)}`,
      number: index + 1,
      status: 'confirmed',
      totalAmount: 100,
      currency: 'USD',
      partNames: [`Деталь ${String(index + 1)}`],
      createdAt: '2026-08-28T00:00:00Z',
    })),
    ordersCount: 21,
    totalAmount: 2100,
    averageAmount: 100,
    firstOrderAt: '2026-08-28T00:00:00Z',
    lastOrderAt: '2026-08-28T00:00:00Z',
  })

  renderScreen('/app/garage/customers/customer-1')

  expect(await screen.findByText('#1')).toBeVisible()
  expect(screen.getByText('#20')).toBeVisible()
  expect(screen.queryByText('#21')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))

  expect(screen.queryByText('#1')).toBeNull()
  expect(screen.getByText('#21')).toBeVisible()
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
  fireEvent.change(phoneField, { target: { value: '+38050111223' } })
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  expect(phoneField).toHaveAttribute('aria-invalid', 'true')
  // The message names the international format, not a Ukrainian template.
  expect(phoneField).toHaveAccessibleDescription(
    /Перевірте номер: потрібен міжнародний формат, наприклад \+380 67 123 45 67/,
  )
  expect(phoneField).toHaveFocus()
  expect(customerMocks.create).not.toHaveBeenCalled()
})

it('never trims a typed number to a Ukrainian length', () => {
  customerMocks.list.mockReturnValue(new Promise(() => undefined))
  renderScreen('/app/garage/customers/new')

  const phoneField = screen.getByRole('textbox', { name: 'Телефон' })
  fireEvent.change(phoneField, {
    target: { value: '+380777123444444' },
  })

  expect(phoneField).toHaveValue('+380777123444444')
})

it('still saves a Ukrainian number typed without the code as +380…', async () => {
  customerMocks.create.mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  await user.type(screen.getByLabelText('Ім’я'), 'Ірина')
  const phoneField = screen.getByRole('textbox', { name: 'Телефон' })
  await user.clear(phoneField)
  await user.type(phoneField, '050 111 22 33')
  await user.tab()
  expect(phoneField).toHaveValue('+380501112233')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  await waitFor(() =>
    expect(customerMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+380501112233' }),
      expect.any(Object),
    ),
  )
})

it.each([
  ['British', '+44 7700 900123', '+447700900123'],
  ['Polish', '+48 512 345 678', '+48512345678'],
  ['German', '+49 30 1234567', '+49301234567'],
])(
  'keeps a %s customer number as typed instead of rewriting it with +380',
  async (_, typed, saved) => {
    customerMocks.create.mockReturnValue(new Promise(() => undefined))
    const user = userEvent.setup()
    renderScreen('/app/garage/customers/new')

    await user.type(screen.getByLabelText('Ім’я'), 'Client')
    const phoneField = screen.getByRole('textbox', { name: 'Телефон' })
    await user.clear(phoneField)
    await user.type(phoneField, typed)
    await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

    expect(phoneField).not.toHaveAttribute('aria-invalid', 'true')
    await waitFor(() =>
      expect(customerMocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ phone: saved }),
        expect.any(Object),
      ),
    )
  },
)

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
  expect(screen.getByRole('menuitem', { name: 'Активувати' })).toBeVisible()
  // The customer has orders, so deletion is offered but refused with a reason.
  expect(
    screen.getByRole('menuitem', { name: 'Видалити клієнта' }),
  ).toHaveAttribute('aria-disabled', 'true')
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
  const trigger = screen.getByRole('menuitem', { name: 'Видалити клієнта' })
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
      screen.getByRole('button', { name: 'Інші дії з клієнтом' }),
    ).toHaveFocus(),
  )
})

it('edits a customer in the side drawer over the customer card', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  renderScreen('/app/garage/customers/customer-1/edit')

  const drawer = await screen.findByRole('dialog', {
    name: 'Редагувати клієнта',
  })
  expect(drawer).toHaveClass('rz-sheet')
  await within(drawer).findByDisplayValue('Ірина')
  expect(
    within(drawer).getByRole('button', { name: 'Зберегти зміни' }),
  ).toHaveAttribute('form', 'customer-form')
})

const addressedCustomer = {
  id: 'customer-1',
  name: 'Anna Kowalska',
  phone: '+48512345678',
  notes: null,
  isActive: true,
  createdAt: '2026-08-28T00:00:00Z',
  orders: [],
  ordersCount: 0,
  totalAmount: null,
  averageAmount: null,
  firstOrderAt: null,
  lastOrderAt: null,
  countryCode: 'PL',
  city: 'Kraków',
  street: 'Floriańska',
  building: '15',
  postcode: '31-019',
}

it('creates a customer without an address, defaulting the country to the business country', async () => {
  customerMocks.create.mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  expect(screen.getByRole('combobox', { name: 'Країна' })).toHaveValue('UA')
  await user.type(screen.getByLabelText('Ім’я'), 'Ірина')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  await waitFor(() =>
    expect(customerMocks.create).toHaveBeenCalledWith(
      { name: 'Ірина', phone: null, notes: null, countryCode: 'UA' },
      expect.any(Object),
    ),
  )
})

it('creates a customer with a foreign address and postcode', async () => {
  customerMocks.create.mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/new')

  await user.type(screen.getByLabelText('Ім’я'), 'John Smith')
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Країна' }),
    'GB',
  )
  await user.type(screen.getByLabelText('Місто'), ' London ')
  await user.type(screen.getByLabelText('Вулиця'), 'Baker Street')
  await user.type(screen.getByLabelText('Будинок'), '221B')
  await user.type(screen.getByLabelText('Поштовий індекс'), 'NW1 6XE')
  expect(screen.getByLabelText('Поштовий індекс')).toHaveAttribute(
    'maxLength',
    '32',
  )
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

  await waitFor(() =>
    expect(customerMocks.create).toHaveBeenCalledWith(
      {
        name: 'John Smith',
        phone: null,
        notes: null,
        countryCode: 'GB',
        city: 'London',
        street: 'Baker Street',
        building: '221B',
        postcode: 'NW1 6XE',
      },
      expect.any(Object),
    ),
  )
})

it('sends only the changed address fields on edit and clears one with an empty string', async () => {
  customerMocks.getById.mockResolvedValue(addressedCustomer)
  customerMocks.update.mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/customer-1/edit')

  const drawer = await screen.findByRole('dialog', {
    name: 'Редагувати клієнта',
  })
  await within(drawer).findByDisplayValue('Anna Kowalska')
  expect(within(drawer).getByRole('combobox', { name: 'Країна' })).toHaveValue(
    'PL',
  )
  await user.clear(within(drawer).getByLabelText('Місто'))
  const postcode = within(drawer).getByLabelText('Поштовий індекс')
  await user.clear(postcode)
  await user.type(postcode, '31-020')
  await user.click(
    within(drawer).getByRole('button', { name: 'Зберегти зміни' }),
  )

  await waitFor(() =>
    expect(customerMocks.update).toHaveBeenCalledWith(
      'customer-1',
      {
        name: 'Anna Kowalska',
        phone: '+48512345678',
        notes: null,
        city: '',
        postcode: '31-020',
      },
      expect.any(Object),
    ),
  )
})

it('shows the customer address on the card, with the country named', async () => {
  customerMocks.getById.mockResolvedValue(addressedCustomer)
  renderScreen('/app/garage/customers/customer-1')

  await screen.findByRole('heading', { name: 'Anna Kowalska' })
  const address = screen.getByText('Адреса').nextElementSibling as HTMLElement
  expect(address).toHaveTextContent('Floriańska, 15')
  expect(address).toHaveTextContent('31-019 Kraków')
  expect(address).toHaveTextContent('Польща')
  // Phones are shown grouped; links keep the plain number.
  expect(screen.getAllByText('+48 512 345 678')[0]).toBeVisible()
})

it('says the address is not set when the customer has none', async () => {
  customerMocks.getById.mockResolvedValue({
    ...addressedCustomer,
    countryCode: null,
    city: null,
    street: null,
    building: null,
    postcode: null,
  })
  renderScreen('/app/garage/customers/customer-1')

  await screen.findByRole('heading', { name: 'Anna Kowalska' })
  expect(screen.getByText('Адреса').nextElementSibling).toHaveTextContent(
    'Не вказано',
  )
})

it('renders the customer directory in British English', async () => {
  customerMocks.list.mockResolvedValue({
    items: [
      {
        id: 'customer-1',
        name: 'John Smith',
        phone: '+447700900123',
        notes: null,
        ordersCount: 3,
        totalAmount: null,
        lastOrderAt: '2026-08-28T10:00:00Z',
      },
    ],
    page: 1,
    pageSize: 20,
    total: 21,
    totalPages: 2,
  })
  render(
    <LocaleProvider locale="en-GB" timeZone="Europe/London">
      <ToastProvider>
        <MemoryRouter initialEntries={['/app/garage/customers']}>
          <CustomersScreen definition={definition} />
        </MemoryRouter>
      </ToastProvider>
    </LocaleProvider>,
  )

  expect(await screen.findByText('John Smith')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Customers' })).toBeVisible()
  expect(screen.getByRole('link', { name: /New customer/ })).toBeVisible()
  expect(screen.getByLabelText('Search customers')).toBeVisible()
  expect(screen.getByRole('radio', { name: /Regular/ })).toBeVisible()
  expect(screen.getByText(/21 customers found/)).toBeVisible()
  expect(screen.getByText('regular')).toBeVisible()
  expect(screen.getByText('+44 7700 900123')).toBeVisible()
  expect(screen.getByText('28/08/2026')).toBeVisible()
})

it('renders the customer form in Polish', () => {
  customerMocks.list.mockReturnValue(new Promise(() => undefined))
  render(
    <LocaleProvider locale="pl">
      <ToastProvider>
        <MemoryRouter initialEntries={['/app/garage/customers/new']}>
          <CustomersScreen definition={definition} />
        </MemoryRouter>
      </ToastProvider>
    </LocaleProvider>,
  )

  const drawer = screen.getByRole('dialog', { name: 'Nowy klient' })
  expect(within(drawer).getByLabelText('Kod pocztowy')).toBeVisible()
  expect(
    within(drawer).getByRole('combobox', { name: 'Kraj' }),
  ).toHaveDisplayValue('Ukraina')
  expect(
    within(drawer).getByRole('button', { name: 'Utwórz klienta' }),
  ).toBeVisible()
})

it('edits customer notes in their card, cancels drafts, and clears with an empty string', async () => {
  const customer = { ...addressedCustomer, notes: 'Початкова нотатка' }
  customerMocks.getById.mockResolvedValue(customer)
  customerMocks.update.mockResolvedValue({
    customer: { ...customer, notes: null },
  })
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/customer-1')
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  expect(within(card).queryByRole('textbox')).not.toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: 'Редагувати' }))
  const input = within(card).getByRole('textbox', {
    name: 'Нотатки',
  })
  await user.clear(input)
  await user.type(input, 'Незбережена зміна')
  await user.click(within(card).getByRole('button', { name: 'Скасувати' }))
  expect(within(card).getByText('Початкова нотатка')).toBeVisible()
  expect(customerMocks.update).not.toHaveBeenCalled()

  await user.click(within(card).getByRole('button', { name: 'Редагувати' }))
  await user.clear(within(card).getByRole('textbox', { name: 'Нотатки' }))
  await user.click(within(card).getByRole('button', { name: 'Зберегти' }))
  expect(customerMocks.update).toHaveBeenCalledWith(
    'customer-1',
    { notes: '' },
    { signal: expect.any(AbortSignal) as AbortSignal },
  )
  expect(await within(card).findByText('Нотаток немає.')).toBeVisible()
  expect(within(card).queryByRole('textbox')).not.toBeInTheDocument()
})

it('retains a rejected customer note draft and saves only trimmed notes on retry', async () => {
  const customer = { ...addressedCustomer, notes: null }
  customerMocks.getById.mockResolvedValue(customer)
  customerMocks.update
    .mockRejectedValueOnce({ kind: 'validation', message: 'Виправте нотатку' })
    .mockResolvedValueOnce({
      customer: { ...customer, notes: 'Перевірити адресу' },
    })
  const user = userEvent.setup()
  renderScreen('/app/garage/customers/customer-1')
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  await user.click(within(card).getByRole('button', { name: 'Редагувати' }))
  const input = within(card).getByRole('textbox', {
    name: 'Нотатки',
  })
  await user.type(input, '  Перевірити адресу  ')
  await user.click(within(card).getByRole('button', { name: 'Зберегти' }))
  expect(await within(card).findByRole('alert')).toBeVisible()
  expect(input).toHaveValue('  Перевірити адресу  ')
  await user.click(within(card).getByRole('button', { name: 'Зберегти' }))
  expect(customerMocks.update).toHaveBeenLastCalledWith(
    'customer-1',
    { notes: 'Перевірити адресу' },
    { signal: expect.any(AbortSignal) as AbortSignal },
  )
  expect(await within(card).findByText('Перевірити адресу')).toBeVisible()
})

it('does not offer inline customer notes editing without customer management permission', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['customers.view', 'orders.view']),
  )
  customerMocks.getById.mockResolvedValue({
    ...addressedCustomer,
    notes: 'Для перегляду',
  })
  renderScreen('/app/garage/customers/customer-1')
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  expect(within(card).getByText('Для перегляду')).toBeVisible()
  expect(within(card).queryByRole('button')).not.toBeInTheDocument()
  expect(within(card).queryByRole('textbox')).not.toBeInTheDocument()
})

it('discards the previous customer note editor immediately on navigation and ignores its late save', async () => {
  const first = { ...addressedCustomer, notes: 'Перша нотатка' }
  const second = {
    ...first,
    id: 'customer-2',
    name: 'Другий клієнт',
    notes: 'Друга нотатка',
  }
  let resolveSecond!: (value: typeof second) => void
  let resolveSave!: (value: { customer: { notes: string } }) => void
  customerMocks.getById.mockImplementation((id: string) =>
    id === first.id
      ? Promise.resolve(first)
      : new Promise<typeof second>((resolve) => {
          resolveSecond = resolve
        }),
  )
  customerMocks.update.mockReturnValue(
    new Promise<{ customer: { notes: string } }>((resolve) => {
      resolveSave = resolve
    }),
  )
  const router = createMemoryRouter(
    [
      {
        path: '/app/:tenant/customers/:customerId',
        element: <CustomersScreen definition={definition} />,
      },
    ],
    { initialEntries: ['/app/garage/customers/customer-1'] },
  )
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  await user.click(within(card).getByRole('button', { name: 'Редагувати' }))
  const input = within(card).getByRole('textbox', {
    name: 'Нотатки',
  })
  await user.clear(input)
  await user.type(input, 'Збережена перша')
  await user.click(within(card).getByRole('button', { name: 'Зберегти' }))
  await act(() => router.navigate('/app/garage/customers/customer-2'))
  expect(
    screen.queryByRole('textbox', { name: 'Нотатки' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Перша нотатка')).not.toBeInTheDocument()
  await act(async () => {
    resolveSecond(second)
    await Promise.resolve()
  })
  expect(await screen.findByText('Друга нотатка')).toBeVisible()
  await act(async () => {
    resolveSave({ customer: { notes: 'Збережена перша' } })
    await Promise.resolve()
  })
  expect(screen.getByText('Друга нотатка')).toBeVisible()
  expect(screen.queryByText('Збережена перша')).not.toBeInTheDocument()
  expect(customerMocks.update).toHaveBeenCalledTimes(1)
})

it('opens a customer order from empty row space without duplicating link navigation', async () => {
  customerMocks.getById.mockResolvedValue({
    ...addressedCustomer,
    ordersCount: 1,
    orders: [
      {
        id: 'order-1',
        number: 359,
        status: 'confirmed',
        totalAmount: 125,
        currency: 'USD',
        partNames: ['Деталь'],
        createdAt: '2026-09-21T10:00:00Z',
      },
    ],
  })
  const router = createMemoryRouter(
    [
      {
        path: '/app/garage/customers/:id',
        element: <CustomersScreen definition={definition} />,
      },
      { path: '/app/garage/orders/:id', element: <p>Замовлення клієнта</p> },
    ],
    { initialEntries: ['/app/garage/customers/customer-1'] },
  )
  const user = userEvent.setup()
  render(<RouterProvider router={router} />)
  const link = await screen.findByRole('link', { name: '#359' })
  await user.click(link.closest('tr')!)
  expect(router.state.location.pathname).toBe('/app/garage/orders/order-1')
  await act(async () => {
    await router.navigate(-1)
  })
  await user.click(await screen.findByRole('link', { name: '#359' }))
  await act(async () => {
    await router.navigate(-1)
  })
  expect(router.state.location.pathname).toBe(
    '/app/garage/customers/customer-1',
  )
})

it('sorts the loaded customers through the shared searchable dropdown', async () => {
  const user = userEvent.setup()
  customerMocks.list.mockResolvedValue({
    items: [
      {
        id: 'one',
        name: 'Андрій',
        phone: null,
        notes: null,
        ordersCount: 1,
        totalAmount: 100,
        lastOrderAt: null,
      },
      {
        id: 'two',
        name: 'Ярослав',
        phone: null,
        notes: null,
        ordersCount: 2,
        totalAmount: 500,
        lastOrderAt: null,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 2,
    totalPages: 1,
  })
  renderScreen('/app/garage/customers')
  const first = await screen.findByText('Ярослав')
  const second = screen.getByText('Андрій')
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  const trigger = screen.getByRole('button', { name: 'Сортувати' })
  expect(trigger).toHaveTextContent('Сумою')
  await user.click(trigger)
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук у списку' }),
  ).not.toBeInTheDocument()
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  await user.click(screen.getByRole('option', { name: 'Іменем' }))
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(trigger).toHaveTextContent('Іменем')
  expect(
    second.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})
