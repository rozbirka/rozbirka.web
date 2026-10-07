import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { useCabinet } from '../CabinetContext'
import { tenantRequestScope } from '../tenant-request-scope'
import { OrdersScreen } from './OrdersScreen'

const orderMocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  refund: vi.fn(),
  updateItems: vi.fn(),
  updateNotes: vi.fn(),
  updatePayments: vi.fn(),
  setCustomer: vi.fn(),
}))
const partMocks = vi.hoisted(() => ({
  facets: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
}))
const cashMocks = vi.hoisted(() => ({ list: vi.fn() }))
const integrationMocks = vi.hoisted(() => ({ list: vi.fn() }))
const deliveryMocks = vi.hoisted(() => ({ get: vi.fn() }))
const customerMocks = vi.hoisted(() => ({
  search: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  activate: vi.fn(),
}))
vi.mock('@/api/integrations', () => ({
  integrationsApi: { list: integrationMocks.list },
}))
/**
 * Whether an order ships is Core's answer, asked for every order now. An
 * ordinary one is refused with `order_invalid_status`, which the delivery
 * section reads as "not a delivery order" rather than as a failure.
 */
vi.mock('@/api/delivery', () => ({
  deliveryApi: {
    get: deliveryMocks.get,
  },
}))
vi.mock('@/api/orders', () => ({ ordersApi: orderMocks }))
vi.mock('@/api/parts', () => ({ partsApi: partMocks }))
vi.mock('@/api/cash', () => ({ cashApi: cashMocks }))
vi.mock('@/api/customers', async (importOriginal) => ({
  ...(await importOriginal()),
  customersApi: customerMocks,
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const definition = {
  key: 'orders',
  routeSegment: '/orders',
  viewPermission: 'orders.view',
  mutationPermission: 'orders.manage',
  allowedSubscriptionStates: ['active'],
} as never
const cabinet = (
  permissions: string[] = [
    'orders.view',
    'orders.manage',
    'finance.manage',
    'parts.view',
    'customers.view',
    'customers.manage',
  ],
  entitlementState: 'active' | 'cancelled' = 'active',
) =>
  ({
    status: 'ready',
    targetTenant: { id: 'tenant-1', slug: 'garage' },
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation: 1,
      permissions: new Set(permissions),
      features: new Set(),
      entitlement: { state: entitlementState, usage: {} },
    },
    error: null,
  }) as unknown as ReturnType<typeof useCabinet>

const pickerPart = (id: string) => ({
  id,
  name: `Тестова запчастина ${id}`,
  externalCode: null,
  photos: [],
  quantityTotal: 3,
  quantity: 3,
  quantityReserved: 0,
  quantityAvailable: 3,
  quantitySoldTotal: 0,
  status: 'available',
  car: null,
  order: null,
  oemCode: null,
  unit: 'pcs',
  condition: 'used',
  sourceType: 'car',
  createdAt: '2026-10-06T10:00:00Z',
  isInventoryLocked: false,
  hasDiscrepancy: false,
  thumbnailUrl: null,
})

async function selectPickerPart(
  user: ReturnType<typeof userEvent.setup>,
  id: string,
) {
  const part = pickerPart(id)
  partMocks.search.mockResolvedValue({
    items: [part],
    page: 1,
    pageSize: 6,
    total: 1,
    totalPages: 1,
  })
  await user.type(screen.getByLabelText('Пошук запчастини'), part.name)
  await user.click(
    await screen.findByRole('option', {
      name: `Обрати запчастину ${part.name}`,
    }),
  )
}

/**
 * Picks a part inside the add-item drawer. The drawer lists parts itself and
 * reads each one's card for a price, so both mocks have to answer.
 */
async function pickDrawerPart(ids: string[]) {
  partMocks.list.mockResolvedValue({
    items: ids.map(pickerPart),
    page: 1,
    pageSize: 8,
    total: ids.length,
    totalPages: 1,
  })
  const drawer = await screen.findByRole('dialog', { name: 'Додати позицію' })
  await userEvent
    .setup()
    .type(
      within(drawer).getByRole('textbox', { name: 'Пошук запчастини' }),
      'Тестова',
    )
  const rows = await within(drawer).findAllByRole('button', {
    name: /Тестова запчастина/,
  })
  return { drawer, rows }
}

async function openInlineCustomerForm(
  user: ReturnType<typeof userEvent.setup>,
) {
  expect(
    screen.queryByRole('group', { name: 'Новий клієнт' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Створити нового клієнта' }),
  )
}

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
beforeEach(() => {
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  integrationMocks.list.mockResolvedValue([])
  deliveryMocks.get.mockRejectedValue({
    kind: 'conflict',
    // Core's own casing: the constant in `ErrorCodes` is UPPER_SNAKE.
    code: 'ORDER_INVALID_STATUS',
    message: 'Order is not a delivery order.',
  })
  partMocks.facets.mockResolvedValue({
    statuses: [],
    warehouses: [],
    zones: [],
    conditions: [],
    equipmentTypes: [],
    makes: [],
    models: [],
    generations: [],
    origins: [],
    qualityFlags: [],
    inventoryLocks: [],
    discrepancies: [],
  })
  partMocks.get.mockResolvedValue({ effectiveSalePrice: null })
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Ірина',
    phone: null,
    isActive: true,
  })
  cashMocks.list.mockResolvedValue([
    {
      id: 'cash-1',
      name: 'Сейф',
      type: 'safe',
      isActive: true,
      balances: { USD: 0, UAH: 0 },
    },
    {
      id: 'bank-1',
      name: 'ФОП Mono',
      type: 'bank',
      isActive: true,
      balances: { UAH: 0 },
    },
  ])
  orderMocks.getById.mockResolvedValue({
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 0,
    totalPaid: 0,
    paymentCurrency: 'USD',
    createdAt: '2026-09-21T10:00:00Z',
    createdByName: 'Олена',
  })
  orderMocks.updatePayments.mockImplementation(
    (
      id: string,
      payments: { accountId: string; amount: number; currency: string }[],
    ) =>
      Promise.resolve({
        id,
        number: id === 'order-2' ? 2 : 1,
        status: 'pending',
        customerId: null,
        customerName: null,
        notes: null,
        items: [],
        payments: payments.map((payment, index) => ({
          ...payment,
          id: `payment-${index + 1}`,
          accountName: payment.accountId === 'cash-1' ? 'Сейф' : 'ФОП Mono',
        })),
        history: [],
        totalAmount: 250,
        totalPaid: payments.length === 1 ? (payments[0]?.amount ?? 0) : null,
        paymentCurrency:
          payments.length === 1 ? (payments[0]?.currency ?? null) : null,
        createdAt: '2026-08-28T00:00:00Z',
        createdByName: 'Олена',
      }),
  )
  orderMocks.list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
})

it('does not offer delivery after an ordinary order is confirmed', async () => {
  orderMocks.getById.mockResolvedValue({
    id: 'order-1',
    number: 1,
    status: 'confirmed',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 250,
    totalPaid: 250,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  })

  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  await waitFor(() => expect(deliveryMocks.get).toHaveBeenCalled())
  await waitFor(() => expect(integrationMocks.list).toHaveBeenCalled())
  await act(async () => {
    await Promise.resolve()
  })

  expect(
    screen.queryByRole('button', { name: 'Оформити доставку' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Доставка' }),
  ).not.toBeInTheDocument()
})

it('prevents a duplicate canonical create while the first request is pending', async () => {
  let resolve!: (value: { id: string }) => void
  orderMocks.create.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  const user = userEvent.setup()
  render(
    <MemoryRouter
      initialEntries={['/app/garage/orders/new?customerId=customer-1']}
    >
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await selectPickerPart(user, 'part-1')
  await user.type(screen.getByLabelText('Кількість'), '1')
  await user.type(screen.getByLabelText('Ціна за одиницю'), '250')
  const submit = screen.getByRole('button', { name: 'Створити замовлення' })
  await user.click(submit)
  await user.click(submit)

  expect(orderMocks.create).toHaveBeenCalledOnce()
  expect(submit).toBeDisabled()
  resolve({ id: 'order-1' })
})

it('opens canonical creation in a side drawer and preselects the linked customer', async () => {
  customerMocks.getById.mockResolvedValue({
    id: 'customer-1',
    name: 'Ірина Коваль',
    phone: '+380501112233',
    isActive: true,
  })

  render(
    <MemoryRouter
      initialEntries={['/app/garage/orders/new?customerId=customer-1']}
    >
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  const drawer = await screen.findByRole('dialog', {
    name: 'Нове замовлення',
  })
  expect(screen.getByText('Замовлення', { selector: 'h1' })).toBeVisible()
  expect(drawer).toHaveClass('sm:right-0')
  expect(drawer).toHaveClass('sm:max-w-[600px]')
  expect(
    within(drawer).getByRole('button', { name: 'Створити замовлення' }),
  ).toHaveAttribute('form', 'order-create-form')
  expect(await screen.findByLabelText('Пошук клієнта')).toHaveValue(
    'Ірина Коваль',
  )
  expect(
    screen.queryByRole('group', { name: 'Новий клієнт' }),
  ).not.toBeInTheDocument()
  expect(customerMocks.getById).toHaveBeenCalledWith(
    'customer-1',
    expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
  )
})

it('opens the created order inside the orders route', async () => {
  orderMocks.create.mockResolvedValue({ id: 'order-1' })
  const router = createMemoryRouter(
    [
      {
        path: '/app/:tenant/orders/new',
        element: <OrdersScreen definition={definition} />,
      },
      {
        path: '/app/:tenant/orders/:orderId',
        element: <p>Картка замовлення</p>,
      },
    ],
    { initialEntries: ['/app/garage/orders/new'] },
  )
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )

  await selectPickerPart(user, 'part-1')
  await user.type(screen.getByLabelText('Кількість'), '1')
  await user.type(screen.getByLabelText('Ціна за одиницю'), '250')
  await user.click(screen.getByRole('button', { name: 'Створити замовлення' }))

  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/app/garage/orders/order-1'),
  )
  expect(screen.getByText('Замовлення створено.')).toBeVisible()
})

it.each(['parts.view', 'customers.view'])(
  'blocks canonical creation when %s is revoked after render',
  async (permission) => {
    const access = cabinet()
    vi.mocked(useCabinet).mockReturnValue(access)
    orderMocks.create.mockResolvedValue({ id: 'order-1' })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/app/garage/orders/new']}>
        <OrdersScreen definition={definition} />
      </MemoryRouter>,
    )

    await selectPickerPart(user, 'part-1')
    await user.type(screen.getByLabelText('Кількість'), '1')
    await user.type(screen.getByLabelText('Ціна за одиницю'), '250')
    ;(access.snapshot!.permissions as Set<string>).delete(permission)
    await user.click(
      screen.getByRole('button', { name: 'Створити замовлення' }),
    )

    expect(orderMocks.create).not.toHaveBeenCalled()
  },
)

it('blocks add-item replacement when parts.view is revoked after render', async () => {
  const access = cabinet()
  vi.mocked(useCabinet).mockReturnValue(access)
  orderMocks.getById.mockResolvedValue({
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [
      {
        id: 'item-1',
        partId: 'part-1',
        partName: 'Ліхтар',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
      },
    ],
    payments: [],
    history: [],
    totalAmount: 100,
    totalPaid: 0,
    paymentCurrency: null,
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  })
  orderMocks.updateItems.mockResolvedValue({ id: 'order-1' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1/items/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  const { drawer, rows } = await pickDrawerPart(['part-2'])
  await user.click(rows[0]!)
  await user.type(within(drawer).getByLabelText('Ціна за шт, $'), '75')
  const submit = within(drawer).getByRole('button', {
    name: 'Додати в замовлення',
  })
  await waitFor(() => expect(submit).toBeEnabled())
  ;(access.snapshot!.permissions as Set<string>).delete('parts.view')
  await user.click(submit)

  expect(orderMocks.updateItems).not.toHaveBeenCalled()
})

it.each([
  ['parts.view', ['orders.view', 'orders.manage', 'customers.view']],
  ['customers.view', ['orders.view', 'orders.manage', 'parts.view']],
])('blocks canonical creation without %s', (_, permissions) => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(permissions))

  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Потрібен доступ до запчастин і клієнтів.',
  )
  expect(
    screen.queryByRole('button', { name: 'Створити замовлення' }),
  ).not.toBeInTheDocument()
})

it('creates a customer inline before canonical order creation', async () => {
  customerMocks.create.mockResolvedValue({
    customer: { id: 'customer-new', name: 'Нова Ірина' },
  })
  orderMocks.create.mockResolvedValue({ id: 'order-1' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await openInlineCustomerForm(user)
  await user.type(screen.getByLabelText('Ім’я нового клієнта'), 'Нова Ірина')
  expect(screen.getByLabelText('Телефон нового клієнта')).toHaveValue('+380')
  await user.type(screen.getByLabelText('Телефон нового клієнта'), '501112233')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))
  await selectPickerPart(user, 'part-1')
  await user.type(screen.getByLabelText('Кількість'), '1')
  await user.type(screen.getByLabelText('Ціна за одиницю'), '250')
  await user.click(screen.getByRole('button', { name: 'Створити замовлення' }))

  expect(customerMocks.create).toHaveBeenCalledWith(
    {
      name: 'Нова Ірина',
      phone: '+380501112233',
      notes: null,
    },
    { signal: tenantRequestScope.signal },
  )
  expect(orderMocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ customerId: 'customer-new' }),
  )
})

it('clears the inline customer draft when creation is cancelled', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await openInlineCustomerForm(user)
  await user.type(screen.getByLabelText('Ім’я нового клієнта'), 'Чернетка')
  await user.type(screen.getByLabelText('Телефон нового клієнта'), '501112233')
  const form = screen.getByRole('group', { name: 'Новий клієнт' })
  await user.click(within(form).getByRole('button', { name: 'Скасувати' }))

  await openInlineCustomerForm(user)
  expect(screen.getByLabelText('Ім’я нового клієнта')).toHaveValue('')
  expect(screen.getByLabelText('Телефон нового клієнта')).toHaveValue('+380')
})

it.each([
  [
    'customers.manage',
    cabinet(['orders.view', 'orders.manage', 'parts.view', 'customers.view']),
  ],
  ['an active subscription', cabinet(undefined, 'cancelled')],
])('hides inline customer creation without %s', (_, access) => {
  vi.mocked(useCabinet).mockReturnValue(access)

  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(screen.getByLabelText('Пошук клієнта')).toBeVisible()
  expect(
    screen.queryByRole('group', { name: 'Новий клієнт' }),
  ).not.toBeInTheDocument()
  expect(customerMocks.create).not.toHaveBeenCalled()
})

it('hides stale customer results as soon as the order search changes', async () => {
  customerMocks.search
    .mockResolvedValueOnce([
      {
        id: 'customer-old',
        name: 'Старий результат',
        phone: null,
        ordersCount: 1,
      },
    ])
    .mockReturnValueOnce(new Promise(() => undefined))
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  const search = screen.getByLabelText('Пошук клієнта')
  await user.type(search, 'а')
  expect(await screen.findByText('Старий результат')).toBeVisible()

  await user.type(search, 'б')
  expect(screen.queryByText('Старий результат')).not.toBeInTheDocument()
  await waitFor(() => expect(customerMocks.search).toHaveBeenCalledTimes(2))
})

it.each(['orders.manage', 'customers.view', 'customers.manage'])(
  'blocks inline customer creation when %s is revoked after render',
  async (permission) => {
    const access = cabinet()
    vi.mocked(useCabinet).mockReturnValue(access)
    customerMocks.create.mockResolvedValue({
      customer: { id: 'customer-new', name: 'Нова Ірина' },
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/app/garage/orders/new']}>
        <OrdersScreen definition={definition} />
      </MemoryRouter>,
    )

    await openInlineCustomerForm(user)
    await user.type(screen.getByLabelText('Ім’я нового клієнта'), 'Нова Ірина')
    ;(access.snapshot!.permissions as Set<string>).delete(permission)
    await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))

    expect(customerMocks.create).not.toHaveBeenCalled()
  },
)

it('reuses an active duplicate-phone customer in the pending order', async () => {
  customerMocks.create.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: {
          code: 'CUSTOMER_PHONE_EXISTS',
          customerId: 'customer-existing',
          customerName: 'Ірина',
          isActive: true,
          message: 'Телефон уже використовується',
        },
      },
    },
  })
  orderMocks.create.mockResolvedValue({ id: 'order-1' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await openInlineCustomerForm(user)
  await user.type(screen.getByLabelText('Ім’я нового клієнта'), 'Нова Ірина')
  await user.type(
    screen.getByLabelText('Телефон нового клієнта'),
    '+380501112233',
  )
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))
  await user.click(
    await screen.findByRole('button', { name: 'Використати клієнта Ірина' }),
  )
  await selectPickerPart(user, 'part-1')
  await user.type(screen.getByLabelText('Кількість'), '1')
  await user.type(screen.getByLabelText('Ціна за одиницю'), '250')
  await user.click(screen.getByRole('button', { name: 'Створити замовлення' }))

  expect(orderMocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ customerId: 'customer-existing' }),
  )
})

it('reactivates an inactive duplicate-phone customer before selecting it', async () => {
  customerMocks.create.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: {
          code: 'CUSTOMER_PHONE_EXISTS',
          customerId: 'customer-inactive',
          customerName: 'Олена',
          isActive: false,
          message: 'Телефон уже використовується',
        },
      },
    },
  })
  customerMocks.activate.mockResolvedValue({
    id: 'customer-inactive',
    name: 'Олена',
  })
  orderMocks.create.mockResolvedValue({ id: 'order-1' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await openInlineCustomerForm(user)
  await user.type(screen.getByLabelText('Ім’я нового клієнта'), 'Нова Олена')
  await user.type(
    screen.getByLabelText('Телефон нового клієнта'),
    '+380501112233',
  )
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))
  await user.click(
    await screen.findByRole('button', { name: 'Активувати Олена' }),
  )
  await selectPickerPart(user, 'part-1')
  await user.type(screen.getByLabelText('Кількість'), '1')
  await user.type(screen.getByLabelText('Ціна за одиницю'), '250')
  await user.click(screen.getByRole('button', { name: 'Створити замовлення' }))

  expect(customerMocks.activate).toHaveBeenCalledWith('customer-inactive', {
    signal: tenantRequestScope.signal,
  })
  expect(orderMocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ customerId: 'customer-inactive' }),
  )
})

it('blocks duplicate-customer reactivation when customers.view is revoked after render', async () => {
  const access = cabinet()
  vi.mocked(useCabinet).mockReturnValue(access)
  customerMocks.create.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: {
          code: 'CUSTOMER_PHONE_EXISTS',
          customerId: 'customer-inactive',
          customerName: 'Олена',
          isActive: false,
          message: 'Телефон уже використовується',
        },
      },
    },
  })
  customerMocks.activate.mockResolvedValue({
    id: 'customer-inactive',
    name: 'Олена',
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await openInlineCustomerForm(user)
  await user.type(screen.getByLabelText('Ім’я нового клієнта'), 'Нова Олена')
  await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))
  const activate = await screen.findByRole('button', {
    name: 'Активувати Олена',
  })
  ;(access.snapshot!.permissions as Set<string>).delete('customers.view')
  await user.click(activate)

  expect(customerMocks.activate).not.toHaveBeenCalled()
})

it.each([
  ['parts.view', ['orders.view', 'orders.manage', 'customers.view']],
  ['customers.view', ['orders.view', 'orders.manage', 'parts.view']],
])('hides the directory create action without %s', async (_, permissions) => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(permissions))

  render(
    <MemoryRouter initialEntries={['/app/garage/orders']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення' })
  expect(
    screen.queryByRole('link', { name: 'Нове замовлення' }),
  ).not.toBeInTheDocument()
})

it('uses the reusable customer and part searches to populate a canonical order', async () => {
  partMocks.search.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Ліхтар',
        photos: [],
        quantity: 3,
        quantityReserved: 0,
        quantityAvailable: 3,
        quantitySoldTotal: 0,
        status: 'available',
        car: null,
        oemCode: null,
        unit: 'pcs',
        condition: 'used',
        sourceType: 'car',
        createdAt: '2026-10-06T10:00:00Z',
        isInventoryLocked: false,
        hasDiscrepancy: false,
        thumbnailUrl: null,
      },
    ],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  })
  customerMocks.search.mockResolvedValue([
    {
      id: 'customer-1',
      name: 'Ірина',
      phone: null,
      ordersCount: 0,
    },
  ])
  orderMocks.create.mockResolvedValue({ id: 'order-1' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Пошук запчастини'), 'Ліхтар')
  await user.click(
    await screen.findByRole('option', { name: 'Обрати запчастину Ліхтар' }),
  )
  expect(
    screen.queryByRole('option', { name: 'Обрати запчастину Ліхтар' }),
  ).toBeNull()
  await user.type(screen.getByLabelText('Пошук клієнта'), 'Ірина')
  await user.click(
    await screen.findByRole('button', { name: 'Обрати клієнта Ірина' }),
  )
  expect(screen.getByLabelText('Пошук клієнта')).toHaveValue('Ірина')
  expect(screen.getByLabelText('Пошук клієнта')).toHaveClass('border-brand/40')
  expect(
    screen.queryByRole('button', { name: 'Обрати клієнта Ірина' }),
  ).toBeNull()
  expect(screen.getByRole('button', { name: 'Менше' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Більше' })).toBeEnabled()
  expect(screen.getByLabelText('Ціна за одиницю')).toHaveClass('text-left')
  await user.type(screen.getByLabelText('Кількість'), '1')
  await user.type(screen.getByLabelText('Ціна за одиницю'), '250')
  await user.click(screen.getByRole('button', { name: 'Створити замовлення' }))

  expect(partMocks.search).toHaveBeenCalledWith(
    expect.objectContaining({ query: 'Ліхтар', page: 1, pageSize: 6 }),
    expect.objectContaining({}),
  )
  expect(customerMocks.search).toHaveBeenCalledWith('Ірина', expect.any(Object))
  expect(orderMocks.create).toHaveBeenCalledWith({
    customerId: 'customer-1',
    notes: null,
    items: [{ partId: 'part-1', quantity: 1, unitPrice: 250 }],
  })
})

it('builds a multi-part order and shows its total in dollars', async () => {
  partMocks.search.mockResolvedValue({
    items: [
      {
        ...pickerPart('part-1'),
        name: 'Ліхтар',
      },
      {
        ...pickerPart('part-2'),
        name: 'Двері',
        quantity: 2,
        quantityTotal: 2,
        quantityAvailable: 2,
      },
    ],
    page: 1,
    pageSize: 10,
    total: 2,
    totalPages: 1,
  })
  orderMocks.create.mockResolvedValue({ id: 'order-1' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  const search = screen.getByLabelText('Пошук запчастини')
  await user.type(search, 'Ліх')
  await user.click(
    await screen.findByRole('option', { name: 'Обрати запчастину Ліхтар' }),
  )
  expect(search).toHaveValue('Ліхтар')
  await user.type(screen.getByLabelText('Кількість'), '2')
  await user.type(screen.getByLabelText('Ціна за одиницю'), '50')
  await user.click(screen.getByRole('button', { name: 'Додати деталь' }))

  const items = screen.getByLabelText('Позиції замовлення')
  expect(within(items).getByText('Ліхтар')).toBeVisible()
  expect(within(items).getByText('2 × $50')).toBeVisible()
  expect(within(items).getByText('$100')).toBeVisible()

  await user.type(search, 'Двер')
  await user.click(
    await screen.findByRole('option', { name: 'Обрати запчастину Двері' }),
  )
  await user.type(screen.getByLabelText('Кількість'), '1')
  await user.type(screen.getByLabelText('Ціна за одиницю'), '75')
  await user.click(screen.getByRole('button', { name: 'Додати деталь' }))

  const summary = screen.getByLabelText('Підсумок замовлення')
  expect(within(summary).getByText('Разом за замовлення')).toBeVisible()
  expect(within(summary).getByText('2 позиції')).toBeVisible()
  expect(within(summary).getByText('$175')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Створити замовлення' }))

  expect(orderMocks.create).toHaveBeenCalledWith({
    customerId: null,
    notes: null,
    items: [
      { partId: 'part-1', quantity: 2, unitPrice: 50 },
      { partId: 'part-2', quantity: 1, unitPrice: 75 },
    ],
  })
})

it('appends an item to the full Core item list when the replacement endpoint is used', async () => {
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    payments: [],
    history: [],
    totalAmount: 250,
    totalPaid: 0,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
    items: [
      {
        id: 'item-1',
        partId: 'part-1',
        partName: 'Ліхтар',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
      },
      {
        id: 'item-2',
        partId: 'part-2',
        partName: 'Двері',
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150,
      },
    ],
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.updateItems.mockResolvedValue(order)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1/items/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  const { drawer, rows } = await pickDrawerPart(['part-3'])
  await user.click(rows[0]!)
  await user.click(within(drawer).getByRole('button', { name: 'Більше' }))
  await user.type(within(drawer).getByLabelText('Ціна за шт, $'), '75')
  await user.click(
    within(drawer).getByRole('button', { name: 'Додати в замовлення' }),
  )

  expect(orderMocks.updateItems).toHaveBeenCalledWith('order-1', [
    { partId: 'part-1', quantity: 1, unitPrice: 100 },
    { partId: 'part-2', quantity: 1, unitPrice: 150 },
    { partId: 'part-3', quantity: 2, unitPrice: 75 },
  ])
})

it('offers no add-item drawer until the order it belongs to has loaded', async () => {
  let resolveOrder!: (value: unknown) => void
  orderMocks.getById.mockReturnValue(
    new Promise((resolve) => {
      resolveOrder = resolve
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1/items/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  // The drawer sits on the order card, so there is nothing to submit from
  // until the card itself knows what the order already holds.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent(
    'Завантажуємо замовлення…',
  )

  resolveOrder({
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 0,
    totalPaid: 0,
    paymentCurrency: null,
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  })

  expect(
    await screen.findByRole('dialog', { name: 'Додати позицію' }),
  ).toBeVisible()
})

it('shows the order error instead of an add-item drawer when loading fails', async () => {
  orderMocks.getById.mockRejectedValue(new Error('network'))
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1/items/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(
    await screen.findByText('Не вдалося завантажити замовлення'),
  ).toBeVisible()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(orderMocks.updateItems).not.toHaveBeenCalled()
})

it('refuses to add a part the order already holds', async () => {
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [
      {
        id: 'item-1',
        partId: 'part-1',
        partName: 'Тестова запчастина part-1',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
      },
    ],
    payments: [],
    history: [],
    totalAmount: 100,
    totalPaid: 0,
    paymentCurrency: null,
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  orderMocks.getById.mockResolvedValue(order)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1/items/new']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  const { drawer, rows } = await pickDrawerPart(['part-1', 'part-2'])
  // A line already on the order says so and cannot be picked again; its
  // quantity is changed through «Редагувати позиції» instead.
  expect(rows[0]).toBeDisabled()
  expect(within(drawer).getByText('у замовленні')).toBeVisible()
  await user.click(rows[0]!)
  expect(within(drawer).queryByText('Вибрано')).not.toBeInTheDocument()

  await user.click(rows[1]!)
  expect(within(drawer).getByText('Вибрано')).toBeVisible()
})

it('persists a payment before confirming a pending order separately', async () => {
  const generatedId = '00000000-0000-4000-8000-000000000001'
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(generatedId)
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 250,
    totalPaid: 0,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.updatePayments.mockImplementation(
    (
      _id: string,
      payments: { accountId: string; amount: number; currency: string }[],
    ) => {
      const savedOrder = {
        ...order,
        payments: payments.map((payment, index) => ({
          ...payment,
          id: `payment-${index + 1}`,
          accountName: 'Сейф',
        })),
      }
      orderMocks.getById.mockResolvedValue(savedOrder)
      return Promise.resolve(savedOrder)
    },
  )
  orderMocks.confirm.mockResolvedValue(order)
  const user = userEvent.setup()
  const view = render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
        <OrdersScreen definition={definition} />
      </MemoryRouter>
    </ToastProvider>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Додати платіж',
  })
  expect(cashMocks.list).toHaveBeenCalledWith(true, expect.any(Object))
  await user.click(within(dialog).getByRole('radio', { name: /Сейф.*USD/ }))
  await user.clear(within(dialog).getByLabelText('Сума, USD'))
  await user.type(within(dialog).getByLabelText('Сума, USD'), '250')
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти платіж' }),
  )

  expect(orderMocks.updatePayments).toHaveBeenCalledWith('order-1', [
    { accountId: 'cash-1', amount: 250, currency: 'USD' },
  ])
  expect(orderMocks.confirm).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByText('Платіж збережено.')).toBeVisible()
  const payments = screen.getByRole('list', { name: 'Платежі замовлення' })
  expect(within(payments).getByText('Сейф · USD')).toBeVisible()
  expect(within(payments).getByText('250,00 $')).toBeVisible()

  view.unmount()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Замовлення #1' })
  const persistedPayments = screen.getByRole('list', {
    name: 'Платежі замовлення',
  })
  expect(within(persistedPayments).getByText('Сейф · USD')).toBeVisible()
  expect(within(persistedPayments).getByText('250,00 $')).toBeVisible()

  await user.click(
    screen.getByRole('button', { name: 'Підтвердити замовлення' }),
  )

  expect(orderMocks.confirm).toHaveBeenCalledWith(
    'order-1',
    { payments: [{ accountId: 'cash-1', amount: 250, currency: 'USD' }] },
    { idempotencyKey: `order-confirm-${generatedId}` },
  )
})

it('reuses a confirmation key after an ambiguous failure and rotates it when the payment changes', async () => {
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 250,
    totalPaid: 0,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  } as never
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.confirm
    .mockRejectedValueOnce({
      kind: 'network',
      message: 'Немає з’єднання з мережею.',
    })
    .mockRejectedValueOnce({
      kind: 'timeout',
      message: 'Час очікування запиту минув.',
    })
    .mockResolvedValue(order)
  const randomUUID = vi
    .spyOn(globalThis.crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  let dialog = await screen.findByRole('dialog', {
    name: 'Додати платіж',
  })
  // Currency comes first: it decides which tills can take the money.
  await user.click(within(dialog).getByRole('button', { name: 'UAH' }))
  await user.click(within(dialog).getByRole('radio', { name: /Сейф.*UAH/ }))
  await user.clear(within(dialog).getByLabelText('Сума, UAH'))
  await user.type(within(dialog).getByLabelText('Сума, UAH'), '250')
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти платіж' }),
  )
  const submit = screen.getByRole('button', {
    name: 'Підтвердити замовлення',
  })

  await user.click(submit)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Немає з’єднання з мережею.',
  )
  await user.click(submit)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Час очікування запиту минув.',
  )

  expect(orderMocks.confirm).toHaveBeenNthCalledWith(
    1,
    'order-1',
    expect.any(Object),
    {
      idempotencyKey: 'order-confirm-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(orderMocks.confirm).toHaveBeenNthCalledWith(
    2,
    'order-1',
    expect.any(Object),
    {
      idempotencyKey: 'order-confirm-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(randomUUID).toHaveBeenCalledOnce()

  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })
  // Currency comes first: it decides which tills can take the money.
  await user.click(within(dialog).getByRole('button', { name: 'UAH' }))
  await user.click(within(dialog).getByRole('radio', { name: /Сейф.*UAH/ }))
  await user.clear(within(dialog).getByLabelText('Сума, UAH'))
  await user.type(within(dialog).getByLabelText('Сума, UAH'), '200')
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти платіж' }),
  )
  await user.click(submit)

  expect(orderMocks.confirm).toHaveBeenNthCalledWith(
    3,
    'order-1',
    expect.any(Object),
    {
      idempotencyKey: 'order-confirm-00000000-0000-4000-8000-000000000002',
    },
  )
  expect(randomUUID).toHaveBeenCalledTimes(2)
})

it('rotates a confirmation key when client-side navigation changes the order resource', async () => {
  const order = (id: string) => ({
    id,
    number: id === 'order-1' ? 1 : 2,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 250,
    totalPaid: 0,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  })
  orderMocks.getById.mockImplementation((id: string) =>
    Promise.resolve(order(id)),
  )
  orderMocks.confirm.mockRejectedValue({
    kind: 'network',
    message: 'Немає з’єднання з мережею.',
  })
  const randomUUID = vi
    .spyOn(globalThis.crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
  const router = createMemoryRouter(
    [
      {
        path: '/app/:tenant/orders/:orderId',
        element: <OrdersScreen definition={definition} />,
      },
    ],
    { initialEntries: ['/app/garage/orders/order-1'] },
  )
  const user = userEvent.setup()
  render(<RouterProvider router={router} />)

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  let dialog = await screen.findByRole('dialog', {
    name: 'Додати платіж',
  })
  // Currency comes first: it decides which tills can take the money.
  await user.click(within(dialog).getByRole('button', { name: 'UAH' }))
  await user.click(within(dialog).getByRole('radio', { name: /Сейф.*UAH/ }))
  await user.clear(within(dialog).getByLabelText('Сума, UAH'))
  await user.type(within(dialog).getByLabelText('Сума, UAH'), '250')
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти платіж' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Підтвердити замовлення' }),
  )
  expect(await screen.findByRole('alert')).toBeVisible()

  await act(async () => {
    await router.navigate('/app/garage/orders/order-2')
  })
  await screen.findByRole('heading', { name: 'Замовлення #2' })
  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  dialog = await screen.findByRole('dialog', {
    name: 'Додати платіж',
  })
  // Currency comes first: it decides which tills can take the money.
  await user.click(within(dialog).getByRole('button', { name: 'UAH' }))
  await user.click(within(dialog).getByRole('radio', { name: /Сейф.*UAH/ }))
  await user.clear(within(dialog).getByLabelText('Сума, UAH'))
  await user.type(within(dialog).getByLabelText('Сума, UAH'), '250')
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти платіж' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Підтвердити замовлення' }),
  )

  expect(orderMocks.confirm).toHaveBeenNthCalledWith(
    1,
    'order-1',
    expect.any(Object),
    {
      idempotencyKey: 'order-confirm-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(orderMocks.confirm).toHaveBeenNthCalledWith(
    2,
    'order-2',
    expect.any(Object),
    {
      idempotencyKey: 'order-confirm-00000000-0000-4000-8000-000000000002',
    },
  )
  expect(randomUUID).toHaveBeenCalledTimes(2)
})

it('preserves a refund key only for ambiguous retries and rotates after definitive outcomes', async () => {
  const order = {
    id: 'order-1',
    number: 1,
    status: 'confirmed',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 250,
    totalPaid: 250,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.refund
    .mockRejectedValueOnce({
      kind: 'network',
      message: 'Немає з’єднання з мережею.',
    })
    .mockRejectedValueOnce({
      kind: 'validation',
      message: 'Перевірте причину повернення.',
    })
    .mockResolvedValue(order)
  const randomUUID = vi
    .spyOn(globalThis.crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  // Refund is destructive, so it asks in a dialog that carries its own reason
  // field and names the sum on the confirm button.
  const openRefund = () =>
    user.click(screen.getByRole('button', { name: 'Оформити повернення' }))
  // The sum carries a non-breaking space from the money formatter, and an
  // accessible name is matched verbatim.
  const submit = () =>
    user.click(screen.getByRole('button', { name: /^Повернути 250,00/ }))

  await openRefund()
  expect(
    screen.getByRole('button', { name: /^Повернути 250,00/ }),
  ).toBeDisabled()
  await user.type(screen.getByLabelText('Причина'), 'Помилка каси')
  expect(
    screen.getByRole('button', { name: /^Повернути 250,00/ }),
  ).toBeEnabled()
  await submit()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Немає з’єднання з мережею.',
  )
  await submit()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Перевірте причину повернення.',
  )
  await submit()
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  )
  // A definitive outcome closes the question; asking again rotates the key.
  await openRefund()
  expect(screen.getByLabelText('Причина')).toHaveValue('')
  await user.type(screen.getByLabelText('Причина'), 'Інша причина')
  await submit()

  for (const [call, uuid] of [
    [1, '00000000-0000-4000-8000-000000000001'],
    [2, '00000000-0000-4000-8000-000000000001'],
    [3, '00000000-0000-4000-8000-000000000002'],
    [4, '00000000-0000-4000-8000-000000000003'],
  ] as const) {
    expect(orderMocks.refund).toHaveBeenNthCalledWith(
      call,
      'order-1',
      {
        refundReason: call === 4 ? 'Інша причина' : 'Помилка каси',
      },
      { idempotencyKey: `order-refund-${uuid}` },
    )
  }
  expect(randomUUID).toHaveBeenCalledTimes(3)
})

it('hides finance transitions when the snapshot lacks finance.manage', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['orders.view', 'orders.manage']),
  )
  orderMocks.getById.mockResolvedValue({
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 250,
    totalPaid: 0,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  })
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  expect(
    screen.queryByRole('button', { name: 'Підтвердити' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Додати платіж' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Повернути кошти' }),
  ).not.toBeInTheDocument()
})

it('keeps server search, status, and pagination in the order URL', async () => {
  orderMocks.list.mockResolvedValue({
    items: [
      {
        id: 'order-12',
        number: 12,
        status: 'pending',
        customerName: 'Ірина',
        itemCount: 1,
        partNames: ['Двері'],
        paymentAccountNames: [],
        totalAmount: 250,
        createdAt: '2026-08-28T00:00:00Z',
      },
    ],
    page: 2,
    pageSize: 20,
    total: 41,
    totalPages: 3,
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter
      initialEntries={['/app/garage/orders?q=door&status=pending&page=2']}
    >
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('link', { name: /#12/ })).toBeVisible()
  expect(screen.getByLabelText('Пошук замовлень')).toHaveValue('door')
  // The status is a set of chips now; the URL's one is the pressed chip.
  expect(screen.getByRole('radio', { name: /Очікує/ })).toBeChecked()
  expect(orderMocks.list).toHaveBeenCalledWith(
    {
      search: 'door',
      status: 'pending',
      customerId: undefined,
      page: 2,
    },
    expect.any(Object),
  )

  await user.click(screen.getByRole('button', { name: 'Попередня сторінка' }))
  expect(orderMocks.list).toHaveBeenLastCalledWith(
    {
      search: 'door',
      status: 'pending',
      customerId: undefined,
      page: 1,
    },
    expect.any(Object),
  )
})

it('shows authoritative detail and lets orders.manage edit pending fields and cancel', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['orders.view', 'orders.manage', 'finance.manage']),
  )
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: 'customer-1',
    customerName: 'Ірина',
    notes: 'Перевірити',
    items: [
      {
        id: 'item-1',
        partId: 'part-1',
        partName: 'Двері',
        quantity: 1,
        unitPrice: 250,
        totalPrice: 250,
      },
    ],
    payments: [
      {
        id: 'payment-1',
        accountId: 'cash-1',
        accountName: 'Основна каса',
        amount: 100,
        currency: 'UAH',
      },
    ],
    history: [
      {
        eventType: 'created',
        userName: 'Олена',
        createdAt: '2026-08-28T00:00:00Z',
        data: null,
      },
    ],
    totalAmount: 250,
    totalPaid: 100,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.updateNotes.mockResolvedValue({ ...order, notes: 'Готово' })
  orderMocks.setCustomer.mockResolvedValue(order)
  orderMocks.cancel.mockResolvedValue({ ...order, status: 'cancelled' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  expect(
    screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
      .filter((title) =>
        ['Нотатки', 'Платежі', 'Позиції'].includes(title ?? ''),
      ),
  ).toEqual(['Позиції', 'Платежі', 'Нотатки'])
  const summaryTerms = screen.getAllByRole('term').map((t) => t.textContent)
  expect(summaryTerms).toEqual(
    expect.arrayContaining(['Сума замовлення', 'Сплачено']),
  )
  const summaryValues = screen
    .getAllByRole('definition')
    .map((d) => d.textContent?.replace(/\s+/g, ' ').trim())
  expect(summaryValues).toEqual(expect.arrayContaining(['250,00 $']))
  const payments = screen.getByRole('list', { name: 'Платежі замовлення' })
  expect(within(payments).getByText('Основна каса · UAH')).toBeVisible()
  expect(within(payments).getByText('100,00 ₴')).toBeVisible()
  expect(within(payments).queryByText('Завдаток')).not.toBeInTheDocument()
  expect(within(payments).queryByText('Доплата')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('table', { name: 'Платежі замовлення' }),
  ).not.toBeInTheDocument()
  const paymentsCard = screen
    .getByRole('heading', { name: 'Платежі' })
    .closest('section')
  const paymentSummary = screen
    .getByRole('heading', { name: 'До сплати' })
    .closest('section')
  expect(
    within(paymentsCard!).queryByRole('button', {
      name: 'Додати платіж',
    }),
  ).not.toBeInTheDocument()
  expect(
    within(paymentSummary!).getByRole('button', {
      name: 'Додати платіж',
    }),
  ).toBeVisible()
  const audit = screen.getByRole('list', { name: 'Історія замовлення' })
  expect(within(audit).getByText('Замовлення створено')).toBeVisible()
  expect(within(audit).getByText(/Олена/)).toBeVisible()
  const timestamp = within(audit).getByText('2026-08-28 00:00')
  expect(timestamp.tagName).toBe('TIME')
  expect(timestamp).toHaveAttribute('datetime', '2026-08-28T00:00:00Z')
  expect(screen.getByRole('link', { name: 'Додати позицію' })).toHaveAttribute(
    'href',
    '/app/garage/orders/order-1/items/new',
  )

  // The note is edited where it is read: the card swaps to a field in place.
  await user.click(screen.getByRole('button', { name: 'Редагувати нотатки' }))
  await user.clear(screen.getByLabelText('Нотатки замовлення'))
  await user.type(screen.getByLabelText('Нотатки замовлення'), 'Готово')
  await user.click(screen.getByRole('button', { name: 'Зберегти нотатки' }))
  expect(orderMocks.updateNotes).toHaveBeenCalledWith('order-1', 'Готово')

  expect(
    screen.queryByLabelText('ID клієнта замовлення'),
  ).not.toBeInTheDocument()

  expect(
    screen.queryByRole('button', { name: 'Підтвердити' }),
  ).not.toBeInTheDocument()
  // Cancelling is destructive, so it lives in the order's menu too.
  await user.click(
    screen.getByRole('button', { name: 'Інші дії із замовленням' }),
  )
  expect(
    screen.queryByRole('menuitem', { name: 'Дублювати' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('menuitem', { name: 'Скасувати замовлення' }),
  )
  expect(orderMocks.cancel).toHaveBeenCalledWith('order-1')
})

it('adds one payment at a time and keeps the ones the order already holds', async () => {
  const generatedId = '00000000-0000-4000-8000-000000000002'
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(generatedId)
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [
      {
        id: 'payment-1',
        accountId: 'cash-1',
        accountName: 'Сейф',
        amount: 200,
        currency: 'USD',
      },
    ],
    history: [],
    totalAmount: 300,
    itemsTotalUsd: 300,
    totalPaid: 200,
    paymentCurrency: 'USD',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.updatePayments.mockResolvedValue(order)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })
  expect(dialog).toHaveClass('sm:right-0')

  // The drawer opens on the outstanding sum, not the whole order.
  const due = within(dialog).getByText('До сплати').parentElement
  expect(due).toHaveTextContent(/100(?:,00)?\s\$/)
  expect(within(dialog).getByLabelText('Сума, USD')).toHaveValue('100,00')

  await user.click(within(dialog).getByRole('button', { name: 'Завдаток 50%' }))
  expect(within(dialog).getByLabelText('Сума, USD')).toHaveValue('50,00')
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти платіж' }),
  )

  // What the order already holds is sent back with the new line: the endpoint
  // takes the whole set, so an omitted payment would be a payment withdrawn.
  expect(orderMocks.updatePayments).toHaveBeenCalledWith('order-1', [
    { accountId: 'cash-1', amount: 200, currency: 'USD' },
    { accountId: 'cash-1', amount: 50, currency: 'USD' },
  ])
})

it('records a payment in a till currency the order total cannot be compared with', async () => {
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 300,
    itemsTotalUsd: 300,
    totalPaid: 0,
    paymentCurrency: null,
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.updatePayments.mockResolvedValue(order)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })

  // Currency comes first: it decides which tills can take the money.
  await user.click(within(dialog).getByRole('button', { name: 'UAH' }))
  await user.click(within(dialog).getByRole('radio', { name: /Сейф.*UAH/ }))
  // No rate exists anywhere in the cabinet, so hryvnia gets no suggested sum
  // and no presets.
  expect(within(dialog).getByLabelText('Сума, UAH')).toHaveValue('')
  expect(
    within(dialog).queryByRole('button', { name: /Уся сума/ }),
  ).not.toBeInTheDocument()

  // The equivalent the design asks for has nowhere to be stored, so the field
  // is shown and disabled rather than taking a number that would be dropped.
  const equivalent = within(dialog).getByLabelText(
    'Скільки зарахувати в замовлення, $',
  )
  expect(equivalent).toBeDisabled()

  await user.type(within(dialog).getByLabelText('Сума, UAH'), '4100')
  // The till gets the hryvnia; the dollar balance is untouched and says so.
  const summary = within(dialog).getByText('До сплати').closest('dl')
  expect(summary).toHaveTextContent('не зараховується')
  expect(summary).toHaveTextContent(
    'залишок за замовленням не зміниться: курсу в кабінеті немає',
  )
  const remainder = within(dialog).getByText('Залишиться').parentElement
  expect(remainder).toHaveTextContent(/300(?:,00)?\s\$/)

  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти платіж' }),
  )
  expect(orderMocks.updatePayments).toHaveBeenCalledWith('order-1', [
    { accountId: 'cash-1', amount: 4100, currency: 'UAH' },
  ])
})

it('does not show a stale till while reloading the payment drawer', async () => {
  cashMocks.list
    .mockResolvedValueOnce([
      {
        id: 'cash-old',
        name: 'Стара каса',
        type: 'safe',
        isActive: true,
        balances: { USD: 0 },
      },
    ])
    .mockReturnValueOnce(new Promise(() => undefined))
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  let dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })
  expect(
    await within(dialog).findByRole('radio', { name: /Стара каса.*USD/ }),
  ).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }))

  await user.click(screen.getByRole('button', { name: 'Додати платіж' }))
  dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })

  expect(within(dialog).getByText('Завантажуємо каси…')).toBeVisible()
  expect(within(dialog).queryByText('Стара каса')).not.toBeInTheDocument()
  expect(cashMocks.list).toHaveBeenCalledTimes(2)
})

it('replaces the full pending item set when quantity, price, or removal changes', async () => {
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [
      {
        id: 'item-1',
        partId: 'part-1',
        partName: 'Ліхтар',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
      },
      {
        id: 'item-2',
        partId: 'part-2',
        partName: 'Двері',
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150,
      },
    ],
    payments: [],
    history: [],
    totalAmount: 250,
    totalPaid: 0,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  const repriced = {
    ...order,
    items: [
      { ...order.items[0], quantity: 2, unitPrice: 125, totalPrice: 250 },
      order.items[1],
    ],
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.updateItems
    .mockResolvedValueOnce(repriced)
    .mockResolvedValueOnce({ ...repriced, items: [repriced.items[0]] })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  expect(screen.queryByLabelText('Кількість Ліхтар')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Ціна Ліхтар')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Редагувати позиції' }),
  ).toBeVisible()
  expect(screen.getByRole('link', { name: 'Додати позицію' })).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Редагувати позиції' }))
  await user.clear(screen.getByLabelText('Кількість Ліхтар'))
  await user.type(screen.getByLabelText('Кількість Ліхтар'), '2')
  await user.clear(screen.getByLabelText('Ціна Ліхтар'))
  await user.type(screen.getByLabelText('Ціна Ліхтар'), '125')
  await user.click(screen.getByRole('button', { name: 'Зберегти позиції' }))

  expect(orderMocks.updateItems).toHaveBeenNthCalledWith(1, 'order-1', [
    { partId: 'part-1', quantity: 2, unitPrice: 125 },
    { partId: 'part-2', quantity: 1, unitPrice: 150 },
  ])
  expect(screen.queryByLabelText('Кількість Ліхтар')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Редагувати позиції' }),
  ).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Редагувати позиції' }))
  await user.click(
    await screen.findByRole('button', { name: 'Видалити Двері' }),
  )
  expect(orderMocks.updateItems).toHaveBeenNthCalledWith(2, 'order-1', [
    { partId: 'part-1', quantity: 2, unitPrice: 125 },
  ])
})

it('keeps invalid item quantities on the client and explains unavailable stock', async () => {
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [
      {
        id: 'item-1',
        partId: 'part-1',
        partName: 'Ліхтар',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
      },
    ],
    payments: [],
    history: [],
    totalAmount: 100,
    totalPaid: 0,
    paymentCurrency: 'USD',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.updateItems.mockRejectedValue({
    kind: 'conflict',
    code: 'PARTS_NOT_AVAILABLE',
    message: 'Parts are not available.',
    status: 409,
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', { name: 'Редагувати позиції' }),
  )
  const quantity = screen.getByLabelText('Кількість Ліхтар')
  const save = screen.getByRole('button', { name: 'Зберегти позиції' })

  await user.clear(quantity)
  expect(save).toBeDisabled()
  expect(orderMocks.updateItems).not.toHaveBeenCalled()

  await user.type(quantity, '2')
  await user.click(save)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Недостатньо доступних запчастин для вказаної кількості.',
  )
  expect(screen.getByLabelText('Кількість Ліхтар')).toHaveValue('2')
  expect(screen.getByRole('button', { name: 'Скасувати' })).toBeVisible()
})

it('cancels a pending order when its final item is removed', async () => {
  const order = {
    id: 'order-1',
    number: 1,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [
      {
        id: 'item-1',
        partId: 'part-1',
        partName: 'Ліхтар',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
      },
    ],
    payments: [],
    history: [],
    totalAmount: 100,
    totalPaid: 0,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  }
  orderMocks.getById.mockResolvedValue(order)
  orderMocks.cancel.mockResolvedValue({ ...order, status: 'cancelled' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', { name: 'Редагувати позиції' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Видалити Ліхтар' }),
  )

  expect(orderMocks.cancel).toHaveBeenCalledWith('order-1')
  expect(orderMocks.updateItems).not.toHaveBeenCalled()
})

it('renders audit timestamps without exposing technical event data', async () => {
  orderMocks.getById.mockResolvedValue({
    id: 'order-1',
    number: 1,
    status: 'confirmed',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [
      {
        eventType: 'item_updated',
        userName: 'Олена',
        createdAt: '2026-08-28T10:15:00Z',
        data: 'quantity: 2',
      },
      {
        eventType: 'item_updated',
        userName: 'Олена',
        createdAt: '2026-08-28T10:15:00Z',
        data: 'unitPrice: 125',
      },
    ],
    totalAmount: 250,
    totalPaid: 250,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T00:00:00Z',
    createdByName: 'Олена',
  })
  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #1' })
  expect(
    screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
      .filter((title) =>
        ['Нотатки', 'Платежі', 'Позиції'].includes(title ?? ''),
      ),
  ).toEqual(['Позиції', 'Платежі', 'Нотатки'])
  const stamps = screen.getAllByText(/2026.*10:15/)
  expect(stamps).toHaveLength(2)
  for (const stamp of stamps) {
    expect(stamp.tagName).toBe('TIME')
    expect(stamp).toHaveAttribute('datetime', '2026-08-28T10:15:00Z')
  }
  // Event payloads are implementation detail and stay out of the order UI.
  expect(screen.queryByText('quantity: 2')).not.toBeInTheDocument()
  expect(screen.queryByText('unitPrice: 125')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Технічні дані' }),
  ).not.toBeInTheDocument()
})

it('shows the three latest order events in Ukrainian and expands the full history', async () => {
  const user = userEvent.setup()
  orderMocks.getById.mockResolvedValue({
    id: 'order-1',
    number: 1,
    status: 'confirmed',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [
      {
        eventType: 'created',
        userName: 'Олена',
        createdAt: '2026-08-28T10:00:00Z',
        data: null,
      },
      {
        eventType: 'itemsupdated',
        userName: 'Олена',
        createdAt: '2026-08-28T11:00:00Z',
        data: null,
      },
      {
        eventType: 'notesupdated',
        userName: 'Олена',
        createdAt: '2026-08-28T12:00:00Z',
        data: null,
      },
      {
        eventType: 'customerset',
        userName: 'Олена',
        createdAt: '2026-08-28T13:00:00Z',
        data: null,
      },
      {
        eventType: 'confirmed',
        userName: 'Олена',
        createdAt: '2026-08-28T14:00:00Z',
        data: null,
      },
    ],
    totalAmount: 250,
    totalPaid: 250,
    paymentCurrency: 'UAH',
    createdAt: '2026-08-28T10:00:00Z',
    createdByName: 'Олена',
  })

  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  const history = await screen.findByRole('list', {
    name: 'Історія замовлення',
  })
  expect(within(history).getAllByRole('listitem')).toHaveLength(3)
  expect(within(history).getByText('Замовлення підтверджено')).toBeVisible()
  expect(within(history).getByText('Клієнта змінено')).toBeVisible()
  expect(within(history).getByText('Нотатки оновлено')).toBeVisible()
  expect(within(history).queryByText('itemsupdated')).not.toBeInTheDocument()
  expect(
    within(history).queryByText('Замовлення створено'),
  ).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Показати всю історію' }))
  expect(within(history).getAllByRole('listitem')).toHaveLength(5)
  expect(within(history).getByText('Позиції оновлено')).toBeVisible()
  expect(within(history).getByText('Замовлення створено')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Згорнути історію' }))
  expect(within(history).getAllByRole('listitem')).toHaveLength(3)
})

it('shows a pending order with a missing paid total as awaiting payment', async () => {
  orderMocks.getById.mockResolvedValue({
    id: 'order-1',
    number: 358,
    status: 'pending',
    customerId: null,
    customerName: null,
    notes: null,
    items: [],
    payments: [],
    history: [],
    totalAmount: 150,
    totalPaid: undefined,
    paymentCurrency: 'USD',
    createdAt: '2026-09-21T10:14:00Z',
    createdByName: 'Дмитро',
  })

  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-1']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #358' })
  const paymentSummary = screen
    .getByRole('heading', { name: 'До сплати' })
    .closest('section')
  expect(within(paymentSummary!).getByText('Очікує оплати')).toBeVisible()
  expect(within(paymentSummary!).getAllByText('150,00 $')).toHaveLength(2)
  expect(screen.queryByText('Оплачено повністю')).not.toBeInTheDocument()
})

it('keeps order prices in USD and renders mixed-currency payments independently', async () => {
  orderMocks.getById.mockResolvedValue({
    id: 'order-358',
    number: 358,
    status: 'confirmed',
    customerId: null,
    customerName: null,
    notes: null,
    items: [
      {
        id: 'item-1',
        partId: 'part-1',
        partName: 'Цапфа FL Rivian gen1',
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150,
      },
    ],
    payments: [
      {
        id: 'payment-1',
        accountId: 'bank-1',
        accountName: 'ФОП Privat24',
        amount: 1500,
        currency: 'UAH',
      },
      {
        id: 'payment-2',
        accountId: 'cash-1',
        accountName: 'Готівка',
        amount: 120,
        currency: 'USD',
      },
    ],
    history: [],
    totalAmount: 150,
    itemsTotalUsd: 150,
    totalPaid: null,
    paymentCurrency: null,
    createdAt: '2026-09-21T10:14:00Z',
    createdByName: 'Дмитро',
  })

  render(
    <MemoryRouter initialEntries={['/app/garage/orders/order-358']}>
      <OrdersScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Замовлення #358' })
  const payments = screen.getByRole('list', { name: 'Платежі замовлення' })
  expect(within(payments).getByText('ФОП Privat24 · UAH')).toBeVisible()
  expect(within(payments).getByText('Готівка · USD')).toBeVisible()
  expect(within(payments).getByText('1 500,00 ₴')).toBeVisible()
  expect(within(payments).getByText('120,00 $')).toBeVisible()
  expect(within(payments).queryByText('Завдаток')).not.toBeInTheDocument()
  expect(within(payments).queryByText('Доплата')).not.toBeInTheDocument()

  const positions = screen
    .getByRole('heading', { name: 'Позиції' })
    .closest('section')
  // The line's own sum and the order total; the unit price rides along with
  // the quantity as «1 × 150,00 $».
  expect(within(positions!).getAllByText('150,00 $')).toHaveLength(2)
  expect(within(positions!).getByText('1 × 150,00 $')).toBeVisible()
  expect(within(positions!).queryByText(/₴/)).not.toBeInTheDocument()

  const paymentSummary = screen
    .getByRole('heading', { name: 'До сплати' })
    .closest('section')
  expect(within(paymentSummary!).getByText('Оплачено повністю')).toBeVisible()
  expect(
    within(paymentSummary!).queryByText('Оплату підтверджено'),
  ).not.toBeInTheDocument()
  expect(within(paymentSummary!).getAllByText('150,00 $')).toHaveLength(2)
  // Two currencies cannot be added, so the card reports no paid figure at all
  // rather than a dollar total that silently drops the hryvnia.
  expect(within(paymentSummary!).getByText('—')).toBeVisible()
  expect(within(paymentSummary!).queryByText('Залишок')).not.toBeInTheDocument()
  expect(within(paymentSummary!).queryByText(/₴/)).not.toBeInTheDocument()
})
