import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { CashScreen } from './CashScreen'

const cashMocks = vi.hoisted(() => ({
  list: vi.fn(),
  dailySummary: vi.fn(),
  getById: vi.fn(),
  transactions: vi.fn(),
  createTransaction: vi.fn(),
  transfer: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn(),
  remove: vi.fn(),
  addCurrency: vi.fn(),
  removeCurrency: vi.fn(),
}))

vi.mock('@/api/cash', () => ({
  cashApi: cashMocks,
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
const definition = {
  key: 'cash',
  routeSegment: '/cash',
  released: true,
  viewPermission: 'finance.view',
  mutationPermission: 'finance.manage',
  allowedSubscriptionStates: ['active'],
} as never
const cabinet = (
  permissions: string[] = ['finance.view', 'finance.manage'],
  entitlementState: 'active' | 'cancelled' = 'active',
  cashRegisters = { used: 0, max: 5 as number | null },
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
      entitlement: { state: entitlementState, usage: { cashRegisters } },
    },
    error: null,
  }) as unknown as ReturnType<typeof useCabinet>
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
beforeEach(() => {
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  cashMocks.list.mockResolvedValue([])
  cashMocks.dailySummary.mockResolvedValue({
    date: '2026-09-17',
    timeZone: 'UTC',
    startUtc: '2026-09-17T00:00:00Z',
    endUtc: '2026-09-18T00:00:00Z',
    registers: [],
  })
})

it('renders Core daily figures without calculating them in the browser', async () => {
  cashMocks.list.mockResolvedValue([
    {
      id: 'cash-1',
      name: 'Каса',
      type: 'cash',
      isActive: true,
      balances: { UAH: 1800 },
    },
  ])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 4,
  })
  cashMocks.dailySummary.mockResolvedValue({
    date: '2026-08-28',
    timeZone: 'Europe/Kyiv',
    startUtc: '2026-08-27T21:00:00Z',
    endUtc: '2026-08-28T21:00:00Z',
    registers: [
      {
        id: 'cash-1',
        name: 'Каса',
        type: 'cash',
        isActive: true,
        sortOrder: 0,
        currencies: [
          {
            currency: 'UAH',
            income: 1000,
            expense: 200,
            net: 800,
            balance: 1800,
            operationCount: 4,
          },
        ],
      },
    ],
  })

  render(
    <MemoryRouter initialEntries={['/app/garage/cash?date=2026-08-28']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  // The balance comes from the register itself and the operation count from
  // the day's summary — the browser adds nothing up.
  expect(await screen.findByText('1 800,00 ₴')).toBeVisible()
  expect(screen.getByText('4 операції')).toBeVisible()
})

it('uses the selected timezone rather than UTC when defaulting the finance date', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-28T23:30:00Z'))
  vi.stubEnv('TZ', 'Europe/Kyiv')
  cashMocks.list.mockResolvedValue([])
  cashMocks.dailySummary.mockResolvedValue({
    date: '2026-08-29',
    timeZone: 'Europe/Kiev',
    startUtc: '2026-08-28T21:00:00Z',
    endUtc: '2026-08-29T21:00:00Z',
    registers: [],
  })

  act(() => {
    render(
      <MemoryRouter initialEntries={['/app/garage/cash']}>
        <CashScreen definition={definition} />
      </MemoryRouter>,
    )
  })

  expect(cashMocks.dailySummary).toHaveBeenCalledWith(
    '2026-08-29',
    'Europe/Kiev',
    expect.any(Object),
  )
})

it('counts all, active, and cashless registers without dropping safe registers', async () => {
  const registers = [
    { id: '1', name: 'Готівка', type: 'safe', isActive: true, balances: {} },
    { id: '2', name: 'Privat', type: 'bank', isActive: true, balances: {} },
    { id: '3', name: 'Nova Pay', type: 'bank', isActive: true, balances: {} },
    { id: '4', name: 'Контейнер', type: 'safe', isActive: false, balances: {} },
    { id: '5', name: 'Резерв', type: 'safe', isActive: false, balances: {} },
  ]
  cashMocks.list.mockResolvedValue(registers)
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  render(
    <MemoryRouter initialEntries={['/app/garage/cash']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Готівка')).toBeVisible()
  const filters = screen.getByRole('group', { name: 'Фільтр кас' })
  expect(within(filters).getByRole('button', { name: /Усі\s*5/ })).toBeVisible()
  expect(
    within(filters).getByRole('button', { name: /Активні\s*3/ }),
  ).toBeVisible()
  expect(
    within(filters).getByRole('button', { name: /Безготівкові\s*2/ }),
  ).toBeVisible()
  expect(screen.getByText('Показано 5 з 5 кас')).toBeVisible()
  const user = userEvent.setup()
  await user.click(within(filters).getByRole('button', { name: /Активні\s*3/ }))
  expect(screen.getByText('Показано 3 з 5 кас')).toBeVisible()
  expect(screen.queryByText('Контейнер')).not.toBeInTheDocument()
})

it('uses the Core manual movement enum values instead of generic income and expense', async () => {
  cashMocks.getById.mockResolvedValue({
    id: 'cash-1',
    name: 'Каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  })
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  cashMocks.createTransaction.mockResolvedValue({})
  const user = userEvent.setup()

  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/app/garage/cash/cash-1']}>
        <CashScreen definition={definition} />
      </MemoryRouter>
    </ToastProvider>,
  )

  await user.click(await screen.findByRole('button', { name: 'Нова операція' }))
  await user.click(screen.getByRole('button', { name: 'Витрата' }))
  await user.type(screen.getByLabelText('Сума'), '25')
  await user.click(screen.getByRole('button', { name: 'Записати операцію' }))

  expect(cashMocks.createTransaction).toHaveBeenCalledWith(
    'cash-1',
    expect.objectContaining({ type: 'manual_out' }),
    expect.any(Object),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Нова операція' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('status')).toHaveTextContent('Операцію записано.')
})

it('keeps existing-register mutations available when the production cash quota is exhausted', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, 'active', { used: 5, max: 5 }),
  )
  const register = {
    id: 'cash-1',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  }
  const destination = {
    id: 'cash-2',
    name: 'Валютна каса',
    type: 'cash',
    isActive: true,
    balances: { USD: 10 },
  }
  cashMocks.getById.mockResolvedValue(register)
  cashMocks.list.mockResolvedValue([register, destination])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  cashMocks.createTransaction.mockResolvedValue({})
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/cash-1']}>
      <CashScreen definition={cabinetModules.cash} />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('link', { name: 'Редагувати' })).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Переказ між касами' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Нова операція' }))
  await user.type(screen.getByLabelText('Сума'), '25')
  await user.click(screen.getByRole('button', { name: 'Записати операцію' }))

  expect(cashMocks.createTransaction).toHaveBeenCalledOnce()
})

it('allows editing an existing register but still meters new register creation at the cash quota', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, 'active', { used: 5, max: 5 }),
  )
  cashMocks.getById.mockResolvedValue({
    id: 'cash-1',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  })
  cashMocks.update.mockResolvedValue({ id: 'cash-1' })
  const user = userEvent.setup()
  const { unmount } = render(
    <MemoryRouter initialEntries={['/app/garage/cash/cash-1/edit']}>
      <CashScreen definition={cabinetModules.cash} />
    </MemoryRouter>,
  )

  const editSubmit = (
    await screen.findAllByRole('button', { name: 'Зберегти зміни' })
  )[0]!
  expect(editSubmit).toBeDisabled()
  await user.clear(screen.getByLabelText('Назва каси'))
  await user.type(screen.getByLabelText('Назва каси'), 'Головна каса')
  await user.click(
    screen.getAllByRole('button', { name: 'Зберегти зміни' })[0]!,
  )
  expect(cashMocks.update).toHaveBeenCalledWith('cash-1', {
    name: 'Головна каса',
  })

  unmount()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/new']}>
      <CashScreen definition={cabinetModules.cash} />
    </MemoryRouter>,
  )
  await user.type(screen.getByLabelText('Назва'), 'Ще одна каса')
  expect(screen.getByRole('button', { name: 'Зберегти' })).toBeDisabled()
})

it('submits one idempotent transfer from a side drawer and reloads the cash overview', async () => {
  const sourceBefore = {
    id: 'cash-source',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  }
  const sourceAfter = { ...sourceBefore, balances: { UAH: 75 } }
  const destinationBefore = {
    id: 'cash-destination',
    name: 'Валютна каса',
    type: 'cash',
    isActive: true,
    balances: { USD: 10 },
  }
  const destinationAfter = {
    ...destinationBefore,
    balances: { USD: 25 },
  }
  cashMocks.list
    .mockResolvedValueOnce([sourceBefore, destinationBefore])
    .mockResolvedValue([sourceAfter, destinationAfter])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  let resolveTransfer!: (value: unknown) => void
  cashMocks.transfer.mockReturnValue(
    new Promise((resolve) => {
      resolveTransfer = resolve
    }),
  )
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
    '00000000-0000-4000-8000-000000000001',
  )
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/app/garage/cash']}>
        <CashScreen definition={definition} />
      </MemoryRouter>
    </ToastProvider>,
  )

  await user.click(
    await screen.findByRole('button', { name: 'Переказ між касами' }),
  )
  const drawer = await screen.findByRole('dialog', {
    name: 'Переказ між касами',
  })
  expect(drawer).toHaveClass('sm:right-0')
  await user.click(
    within(screen.getByRole('group', { name: 'Каса-отримувач' })).getByRole(
      'radio',
      { name: /Валютна каса/ },
    ),
  )
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта списання' })).getByRole(
      'radio',
      { name: 'UAH' },
    ),
  )
  await user.type(screen.getByLabelText('Сума списання'), '30')
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта зарахування' })).getByRole(
      'radio',
      { name: 'USD' },
    ),
  )
  await user.type(screen.getByLabelText('Сума зарахування'), '15')
  await user.type(screen.getByLabelText('Нотатка переказу'), 'Обмін')
  const submit = screen.getByRole('button', { name: 'Переказати кошти' })
  await user.click(submit)
  await user.click(submit)

  expect(cashMocks.transfer).toHaveBeenCalledOnce()
  expect(cashMocks.transfer).toHaveBeenCalledWith(
    {
      fromRegisterId: 'cash-source',
      fromCurrency: 'UAH',
      toRegisterId: 'cash-destination',
      toCurrency: 'USD',
      amountOut: 30,
      amountIn: 15,
      note: 'Обмін',
    },
    {
      idempotencyKey: 'cash-transfer-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(submit).toBeDisabled()
  resolveTransfer({
    out: {
      id: 'transaction-out',
      type: 'transfer_out',
      direction: 'out',
      amount: 30,
      currency: 'UAH',
      note: 'Обмін',
      createdAt: '2026-08-28T12:00:00Z',
      createdByName: 'Олена',
      referenceId: 'transfer-1',
    },
    in: {
      id: 'transaction-in',
      type: 'transfer_in',
      direction: 'in',
      amount: 15,
      currency: 'USD',
      note: 'Обмін',
      createdAt: '2026-08-28T12:00:00Z',
      createdByName: 'Олена',
      referenceId: 'transfer-1',
    },
  })

  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Переказ між касами' }),
    ).not.toBeInTheDocument(),
  )
  expect(cashMocks.list).toHaveBeenCalledTimes(2)
  expect(cashMocks.transactions).toHaveBeenCalledTimes(4)
  expect(screen.getByRole('status')).toHaveTextContent('Переказ виконано.')
})

it('reuses a transfer key after an ambiguous failure and rotates it when the payload changes', async () => {
  const source = {
    id: 'cash-source',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  }
  const destination = {
    id: 'cash-destination',
    name: 'Валютна каса',
    type: 'cash',
    isActive: true,
    balances: { USD: 10 },
  }
  cashMocks.list.mockResolvedValue([source, destination])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  cashMocks.transfer
    .mockRejectedValueOnce({
      kind: 'network',
      message: 'Немає з’єднання з мережею.',
    })
    .mockRejectedValueOnce({
      kind: 'timeout',
      message: 'Час очікування запиту минув.',
    })
    .mockResolvedValue({})
  const randomUUID = vi
    .spyOn(globalThis.crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', { name: 'Переказ між касами' }),
  )
  await screen.findByRole('dialog', { name: 'Переказ між касами' })
  const destinationCurrency = screen.getByRole('group', {
    name: 'Валюта зарахування',
  })
  expect(
    within(destinationCurrency).getByRole('radio', { name: 'UAH' }),
  ).toBeVisible()
  expect(
    within(destinationCurrency).getByRole('radio', { name: 'USD' }),
  ).toBeVisible()
  await user.click(
    within(screen.getByRole('group', { name: 'Каса-отримувач' })).getByRole(
      'radio',
      { name: /Валютна каса/ },
    ),
  )
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта списання' })).getByRole(
      'radio',
      { name: 'UAH' },
    ),
  )
  await user.type(screen.getByLabelText('Сума списання'), '30')
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта зарахування' })).getByRole(
      'radio',
      { name: 'USD' },
    ),
  )
  await user.type(screen.getByLabelText('Сума зарахування'), '15')
  const submit = screen.getByRole('button', { name: 'Переказати кошти' })

  await user.click(submit)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Немає з’єднання з мережею.',
  )
  await user.click(submit)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Час очікування запиту минув.',
  )

  expect(cashMocks.transfer).toHaveBeenNthCalledWith(1, expect.any(Object), {
    idempotencyKey: 'cash-transfer-00000000-0000-4000-8000-000000000001',
  })
  expect(cashMocks.transfer).toHaveBeenNthCalledWith(2, expect.any(Object), {
    idempotencyKey: 'cash-transfer-00000000-0000-4000-8000-000000000001',
  })
  expect(randomUUID).toHaveBeenCalledOnce()

  await user.type(screen.getByLabelText('Нотатка переказу'), 'Інший намір')
  await user.click(submit)

  expect(cashMocks.transfer).toHaveBeenNthCalledWith(3, expect.any(Object), {
    idempotencyKey: 'cash-transfer-00000000-0000-4000-8000-000000000002',
  })
  expect(randomUUID).toHaveBeenCalledTimes(2)
})

it('reuses a movement key after an ambiguous failure and rotates it after success', async () => {
  const register = {
    id: 'cash-1',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  }
  cashMocks.getById.mockResolvedValue(register)
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  cashMocks.createTransaction
    .mockRejectedValueOnce({
      kind: 'network',
      message: 'Немає з’єднання з мережею.',
    })
    .mockResolvedValue({})
  const randomUUID = vi
    .spyOn(globalThis.crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/cash-1']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Нова операція' }))
  await screen.findByRole('dialog', { name: 'Нова операція' })
  await user.type(screen.getByLabelText('Сума'), '25')
  const submit = screen.getByRole('button', { name: 'Записати операцію' })

  await user.click(submit)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Немає з’єднання з мережею.',
  )
  expect(screen.getByRole('dialog', { name: 'Нова операція' })).toBeVisible()
  await user.click(submit)

  expect(cashMocks.createTransaction).toHaveBeenNthCalledWith(
    1,
    'cash-1',
    expect.any(Object),
    {
      idempotencyKey: 'cash-movement-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(cashMocks.createTransaction).toHaveBeenNthCalledWith(
    2,
    'cash-1',
    expect.any(Object),
    {
      idempotencyKey: 'cash-movement-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(randomUUID).toHaveBeenCalledOnce()

  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Нова операція' }),
    ).not.toBeInTheDocument(),
  )
  await user.click(screen.getByRole('button', { name: 'Нова операція' }))
  await screen.findByRole('dialog', { name: 'Нова операція' })
  await user.click(screen.getByRole('button', { name: 'Записати операцію' }))

  expect(cashMocks.createTransaction).toHaveBeenNthCalledWith(
    3,
    'cash-1',
    expect.any(Object),
    {
      idempotencyKey: 'cash-movement-00000000-0000-4000-8000-000000000002',
    },
  )
  expect(randomUUID).toHaveBeenCalledTimes(2)
})

it('blocks a manual movement when finance.view is revoked after render', async () => {
  const access = cabinet()
  vi.mocked(useCabinet).mockReturnValue(access)
  cashMocks.getById.mockResolvedValue({
    id: 'cash-1',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  })
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  cashMocks.createTransaction.mockResolvedValue({})
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/cash-1']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(await screen.findByRole('button', { name: 'Нова операція' }))
  await user.type(screen.getByLabelText('Сума'), '25')
  ;(access.snapshot!.permissions as Set<string>).delete('finance.view')
  await user.click(screen.getByRole('button', { name: 'Записати операцію' }))

  expect(cashMocks.createTransaction).not.toHaveBeenCalled()
})

it('rotates a movement key when client-side navigation changes the register resource', async () => {
  const register = (id: string) => ({
    id,
    name: id === 'cash-1' ? 'Основна каса' : 'Резервна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  })
  cashMocks.getById.mockImplementation((id: string) =>
    Promise.resolve(register(id)),
  )
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  cashMocks.createTransaction.mockRejectedValue({
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
        path: '/app/:tenant/cash/:registerId',
        element: <CashScreen definition={definition} />,
      },
    ],
    { initialEntries: ['/app/garage/cash/cash-1'] },
  )
  const user = userEvent.setup()
  render(<RouterProvider router={router} />)

  await screen.findByRole('heading', { name: 'Основна каса' })
  await user.click(screen.getByRole('button', { name: 'Нова операція' }))
  await user.type(screen.getByLabelText('Сума'), '25')
  await user.click(screen.getByRole('button', { name: 'Записати операцію' }))
  expect(await screen.findByRole('alert')).toBeVisible()

  await act(async () => {
    await router.navigate('/app/garage/cash/cash-2')
  })
  await screen.findByText('Гроші · Резервна каса')
  await user.click(screen.getByRole('button', { name: 'Записати операцію' }))

  expect(cashMocks.createTransaction).toHaveBeenNthCalledWith(
    1,
    'cash-1',
    expect.any(Object),
    {
      idempotencyKey: 'cash-movement-00000000-0000-4000-8000-000000000001',
    },
  )
  expect(cashMocks.createTransaction).toHaveBeenNthCalledWith(
    2,
    'cash-2',
    expect.any(Object),
    {
      idempotencyKey: 'cash-movement-00000000-0000-4000-8000-000000000002',
    },
  )
  expect(randomUUID).toHaveBeenCalledTimes(2)
})

it('keeps the transfer form available while surfacing an explicit conflict', async () => {
  const source = {
    id: 'cash-source',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  }
  const destination = {
    id: 'cash-destination',
    name: 'Валютна каса',
    type: 'cash',
    isActive: true,
    balances: { USD: 10 },
  }
  cashMocks.list.mockResolvedValue([source, destination])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  cashMocks.transfer.mockRejectedValue({
    kind: 'conflict',
    status: 409,
    message: 'Недостатньо коштів для переказу.',
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', { name: 'Переказ між касами' }),
  )
  await user.click(
    within(
      await screen.findByRole('group', { name: 'Каса-отримувач' }),
    ).getByRole('radio', { name: /Валютна каса/ }),
  )
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта списання' })).getByRole(
      'radio',
      { name: 'UAH' },
    ),
  )
  await user.type(screen.getByLabelText('Сума списання'), '50')
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта зарахування' })).getByRole(
      'radio',
      { name: 'USD' },
    ),
  )
  await user.type(screen.getByLabelText('Сума зарахування'), '30')
  await user.click(screen.getByRole('button', { name: 'Переказати кошти' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Недостатньо коштів для переказу.',
  )
  expect(
    screen.getByRole('heading', { name: 'Переказ між касами' }),
  ).toBeVisible()
})

it('blocks transfers above the source balance before calling Core', async () => {
  cashMocks.list.mockResolvedValue([
    {
      id: 'cash-source',
      name: 'Основна каса',
      type: 'cash',
      isActive: true,
      balances: { UAH: 100 },
    },
    {
      id: 'cash-destination',
      name: 'Валютна каса',
      type: 'cash',
      isActive: true,
      balances: { USD: 10 },
    },
  ])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', { name: 'Переказ між касами' }),
  )
  await user.click(
    within(screen.getByRole('group', { name: 'Каса-отримувач' })).getByRole(
      'radio',
      { name: /Валютна каса/ },
    ),
  )
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта списання' })).getByRole(
      'radio',
      { name: 'UAH' },
    ),
  )
  await user.type(screen.getByLabelText('Сума списання'), '101')
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта зарахування' })).getByRole(
      'radio',
      { name: 'USD' },
    ),
  )
  await user.type(screen.getByLabelText('Сума зарахування'), '3')

  expect(
    screen.getByText(
      'У касі-відправнику недостатньо коштів для цього переказу.',
    ),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Переказати кошти' }),
  ).toBeDisabled()
  expect(cashMocks.transfer).not.toHaveBeenCalled()
})

it('requires equal amounts when a transfer does not convert currency', async () => {
  cashMocks.list.mockResolvedValue([
    {
      id: 'cash-source',
      name: 'Основна каса',
      type: 'cash',
      isActive: true,
      balances: { UAH: 100 },
    },
    {
      id: 'cash-destination',
      name: 'Друга каса',
      type: 'cash',
      isActive: true,
      balances: { UAH: 0 },
    },
  ])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', { name: 'Переказ між касами' }),
  )
  await user.click(
    within(screen.getByRole('group', { name: 'Каса-отримувач' })).getByRole(
      'radio',
      { name: /Друга каса/ },
    ),
  )
  const currencyGroups = screen.getAllByRole('group', {
    name: /Валюта (списання|зарахування)/,
  })
  for (const group of currencyGroups)
    await user.click(within(group).getByRole('radio', { name: 'UAH' }))
  await user.type(screen.getByLabelText('Сума списання'), '50')
  await user.type(screen.getByLabelText('Сума зарахування'), '49')

  expect(
    screen.getByText(
      'Для переказу без конвертації суми списання і зарахування мають збігатися.',
    ),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Переказати кошти' }),
  ).toBeDisabled()
})

it.each([
  ['finance.manage', cabinet(['finance.view'])],
  ['an active subscription', cabinet(undefined, 'cancelled')],
])('hides transfers without %s', async (_, access) => {
  vi.mocked(useCabinet).mockReturnValue(access)
  cashMocks.list.mockResolvedValue([
    {
      id: 'cash-source',
      name: 'Основна каса',
      type: 'cash',
      isActive: true,
      balances: { UAH: 100 },
    },
  ])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })

  render(
    <MemoryRouter initialEntries={['/app/garage/cash']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Каси' })
  expect(
    screen.queryByRole('button', { name: 'Переказ між касами' }),
  ).not.toBeInTheDocument()
  expect(cashMocks.transfer).not.toHaveBeenCalled()
})

it('passes URL-backed ledger currency, date, and page filters to Core', async () => {
  cashMocks.getById.mockResolvedValue({
    id: 'cash-1',
    name: 'Каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  })
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 2,
    pageSize: 20,
    total: 30,
    totalPages: 2,
  })

  render(
    <MemoryRouter
      initialEntries={[
        '/app/garage/cash/cash-1?currency=UAH&from=2026-09-01&to=2026-09-22&page=2',
      ]}
    >
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Каса' })
  expect(cashMocks.transactions).toHaveBeenCalledWith(
    'cash-1',
    {
      currency: 'UAH',
      from: '2026-09-01',
      to: '2026-09-22',
      page: 2,
    },
    expect.any(Object),
  )
})

it('preserves ledger total pages and moves backward and forward through the URL', async () => {
  cashMocks.getById.mockResolvedValue({
    id: 'cash-1',
    name: 'Каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  })
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 2,
    pageSize: 20,
    total: 61,
    totalPages: 4,
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter
      initialEntries={['/app/garage/cash/cash-1?currency=UAH&page=2']}
    >
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Сторінка 2 з 4')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Попередня сторінка' }))
  expect(cashMocks.transactions).toHaveBeenLastCalledWith(
    'cash-1',
    {
      currency: 'UAH',
      page: 1,
    },
    expect.any(Object),
  )

  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  expect(cashMocks.transactions).toHaveBeenLastCalledWith(
    'cash-1',
    {
      currency: 'UAH',
      page: 2,
    },
    expect.any(Object),
  )
})

it('creates a register with contract-supported currencies and opening balances', async () => {
  cashMocks.create.mockResolvedValue({ id: 'cash-2' })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/new']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Назва'), 'Основна каса')
  await user.click(screen.getByRole('button', { name: /\$.*USD|USD/ }))
  await user.type(screen.getByLabelText('Баланс UAH'), '1000')
  await user.type(screen.getByLabelText('Баланс USD'), '25')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))

  expect(cashMocks.create).toHaveBeenCalledWith({
    name: 'Основна каса',
    type: 'cash',
    currencies: ['UAH', 'USD'],
    initialBalances: { UAH: 1000, USD: 25 },
  })
})

it('shows only the name field on the register edit screen', async () => {
  cashMocks.getById.mockResolvedValue({
    id: 'cash-1',
    name: 'Основна каса',
    type: 'bank',
    isActive: true,
    balances: { UAH: 100 },
  })
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/cash-1/edit']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Редагування каси' })
  expect(screen.getByRole('textbox', { name: 'Назва каси' })).toHaveValue(
    'Основна каса',
  )
  for (const removed of [
    'Тип каси',
    'Валюти',
    'Рахунки',
    'Відповідальний',
    'Склад',
    'Звіряння й доступ',
  ])
    expect(screen.queryByText(removed)).not.toBeInTheDocument()
})

it('saves the register name and returns to its exact detail route', async () => {
  const register = {
    id: 'cash-1',
    name: 'Каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 0 },
  }
  cashMocks.getById.mockResolvedValue(register)
  cashMocks.update.mockResolvedValue({ ...register, name: 'Нова назва' })
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const router = createMemoryRouter(
    [
      {
        path: '/app/:tenant/cash/*',
        element: <CashScreen definition={definition} />,
      },
    ],
    { initialEntries: ['/app/garage/cash/cash-1/edit'] },
  )
  const user = userEvent.setup()
  render(<RouterProvider router={router} />)

  await screen.findByRole('heading', { name: 'Редагування каси' })
  const name = screen.getByRole('textbox', { name: 'Назва каси' })
  await user.clear(name)
  await user.type(name, 'Нова назва')
  await user.click(
    screen.getAllByRole('button', { name: 'Зберегти зміни' })[0]!,
  )

  expect(cashMocks.update).toHaveBeenCalledWith('cash-1', {
    name: 'Нова назва',
  })
  await waitFor(() =>
    expect(router.state.location.pathname).toBe('/app/garage/cash/cash-1'),
  )
})

it('names the manual movement direction and its signed amount before submitting', async () => {
  cashMocks.getById.mockResolvedValue({
    id: 'cash-1',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  })
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/cash-1']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('button', { name: 'Нова операція' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Ручна операція' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Нова операція' }))
  await user.type(screen.getByLabelText('Сума'), '25')
  expect(screen.getByText('Надходження до каси «Основна каса»')).toBeVisible()
  expect(screen.getByText('+25 UAH')).toBeVisible()

  const income = screen.getByRole('button', { name: 'Надходження' })
  const expense = screen.getByRole('button', { name: 'Витрата' })
  expect(income).toHaveAttribute('aria-pressed', 'true')
  expect(income).toHaveClass('border-state-ok/70')
  expect(expense).toHaveClass('border-state-danger/35')
  await user.click(expense)
  expect(expense).toHaveAttribute('aria-pressed', 'true')
  expect(expense).toHaveClass('border-state-danger/70')
  expect(screen.getByText('Витрата з каси «Основна каса»')).toBeVisible()
  expect(screen.getByText('−25 UAH')).toBeVisible()
})

it('shows the source and destination balances beside the transfer amounts', async () => {
  const source = {
    id: 'cash-source',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { UAH: 100 },
  }
  const destination = {
    id: 'cash-destination',
    name: 'Валютна каса',
    type: 'cash',
    isActive: true,
    balances: { USD: 10 },
  }
  cashMocks.list.mockResolvedValue([source, destination])
  cashMocks.transactions.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', { name: 'Переказ між касами' }),
  )
  await screen.findByRole('dialog', { name: 'Переказ між касами' })
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта списання' })).getByRole(
      'radio',
      { name: 'UAH' },
    ),
  )
  expect(screen.getByText('Доступно в цій касі: 100 UAH')).toBeVisible()

  await user.click(
    within(screen.getByRole('group', { name: 'Каса-отримувач' })).getByRole(
      'radio',
      { name: /Валютна каса/ },
    ),
  )
  await user.click(
    within(screen.getByRole('group', { name: 'Валюта зарахування' })).getByRole(
      'radio',
      { name: 'USD' },
    ),
  )
  expect(screen.getByText('Баланс каси-отримувача: 10 USD')).toBeVisible()
})

it('describes register form controls and offers a way out of the form', () => {
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/new']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  expect(
    screen.getByRole('textbox', { name: 'Назва' }),
  ).toHaveAccessibleDescription('Так каса підписана у звітах і переказах')
  expect(screen.getByRole('group', { name: 'Тип' })).toBeVisible()
  expect(screen.getByRole('button', { name: /Готівкова/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('link', { name: 'Скасувати' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Зберегти' })).toBeVisible()
})

it('hides cash mutations without finance.manage and renders quota failures', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['finance.view']))
  cashMocks.list.mockResolvedValue([])
  cashMocks.dailySummary.mockResolvedValue({
    date: '2026-08-28',
    timeZone: 'Europe/Kiev',
    startUtc: '2026-08-27T21:00:00Z',
    endUtc: '2026-08-28T21:00:00Z',
    registers: [],
  })
  const { unmount } = render(
    <MemoryRouter initialEntries={['/app/garage/cash?date=2026-08-28']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Каси' })
  expect(
    screen.queryByRole('link', { name: 'Нова каса' }),
  ).not.toBeInTheDocument()
  unmount()

  vi.mocked(useCabinet).mockReturnValue(cabinet())
  cashMocks.create.mockRejectedValue({
    kind: 'unknown',
    status: 402,
    message: 'Quota exceeded',
  })
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/new']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )
  await user.type(screen.getByLabelText('Назва'), 'Ще одна каса')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Функція потребує активної підписки.',
  )
})

it('keeps only real till data and renders expenses in red', async () => {
  const register = {
    id: 'cash-1',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { USD: 14280 },
  }
  cashMocks.getById.mockResolvedValue(register)
  cashMocks.list.mockResolvedValue([register])
  cashMocks.dailySummary.mockResolvedValue({
    date: '2026-09-17',
    timeZone: 'UTC',
    startUtc: '2026-09-17T00:00:00Z',
    endUtc: '2026-09-18T00:00:00Z',
    registers: [
      {
        id: 'cash-1',
        name: 'Основна каса',
        type: 'cash',
        isActive: true,
        sortOrder: 0,
        currencies: [
          {
            currency: 'USD',
            income: 1240,
            expense: 240,
            net: 1000,
            balance: 14280,
            operationCount: 6,
          },
        ],
      },
    ],
  })
  const row = {
    id: 'movement-1',
    type: 'refund_out',
    direction: 'out',
    amount: 990,
    currency: 'USD',
    note: 'Продаж SO-1042',
    createdAt: '2026-09-16T14:20:00Z',
    createdByName: 'Дмитро Кравець',
    referenceId: null,
  }
  cashMocks.transactions.mockImplementation(
    (_id: string, query: { pageSize?: number }) =>
      Promise.resolve(
        query.pageSize === 1
          ? {
              items: [row],
              page: 1,
              pageSize: 1,
              total: 84,
              totalPages: 84,
            }
          : {
              items: [row],
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
      ),
  )

  render(
    <MemoryRouter initialEntries={['/app/garage/cash/cash-1']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Основна каса', level: 1 })
  expect(screen.getByRole('heading', { name: 'Операції' })).toBeVisible()
  expect(screen.getByText(/84 операції усього/)).toBeVisible()
  expect(screen.getByText('−990,00 $')).toHaveClass('text-state-danger')
  expect(cashMocks.transactions).toHaveBeenCalledWith(
    'cash-1',
    { page: 1, pageSize: 1 },
    expect.any(Object),
  )
  for (const removed of [
    'Надходження за день',
    'Витрати за день',
    'Останнє звіряння',
    'Налаштування',
    'Доступ',
    'Звірити залишок',
  ])
    expect(screen.queryByText(removed)).not.toBeInTheDocument()
})

it('does not render unsupported till settings', async () => {
  cashMocks.getById.mockResolvedValue({
    id: 'cash-1',
    name: 'Основна каса',
    type: 'cash',
    isActive: true,
    balances: { USD: 14280 },
  })
  render(
    <MemoryRouter initialEntries={['/app/garage/cash/cash-1/edit']}>
      <CashScreen definition={definition} />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Редагування каси' })
  expect(screen.getByRole('textbox', { name: 'Назва каси' })).toBeVisible()
  expect(screen.queryByText('Відповідальний')).not.toBeInTheDocument()
  expect(screen.queryByText('Склад')).not.toBeInTheDocument()
  expect(screen.queryByText('Звіряння й доступ')).not.toBeInTheDocument()
  expect(screen.queryByText('Валюти')).not.toBeInTheDocument()
})
