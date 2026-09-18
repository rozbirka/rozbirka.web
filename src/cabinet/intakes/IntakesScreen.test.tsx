import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { intakesApi } from '@/api/intakes'
import { mediaApi } from '@/api/media'
import { partsApi } from '@/api/parts'
import type { PlanUsageDto } from '@/api/types'
import { useCabinet } from '../CabinetContext'
import { IntakesScreen } from './IntakesScreen'

/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are invoked only through their owning singleton. */

vi.mock('@/api/intakes', () => ({
  isIntakeStatus: (value: unknown) => value === 'active' || value === 'closed',
  intakesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    addPart: vi.fn(),
  },
}))
vi.mock('@/api/parts', () => ({
  partsApi: {
    update: vi.fn(),
  },
}))
vi.mock('@/api/media', () => ({
  mediaApi: {
    upload: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
vi.mock('../module-registry', () => ({
  cabinetModules: {
    intakes: {
      key: 'intakes',
      released: true,
      routeSegment: '/intakes',
      viewPermission: 'intakes.view',
      mutationPermission: 'intakes.manage',
      quotaResource: 'intakes',
      allowedSubscriptionStates: ['active'],
    },
    parts: {
      key: 'parts',
      released: true,
      routeSegment: '/parts',
      viewPermission: 'parts.view',
      mutationPermission: 'parts.manage',
      quotaResource: 'parts',
      allowedSubscriptionStates: ['active'],
    },
  },
}))

/**
 * The intake form repeats its save button in the sticky bar and in the summary
 * rail, exactly as the design draws it; the rail one is the form's own submit.
 */
const saveButton = (name: string) => {
  const buttons = screen.getAllByRole('button', { name })
  const last = buttons.at(-1)
  if (!last) throw new Error(`Кнопки «${name}» немає на екрані`)
  return last
}

const intake = {
  id: 'intake-1',
  name: 'Липнева партія',
  supplier: 'Постачальник',
  purchasedAt: '2026-08-01T12:00:00Z',
  totalCost: 5000,
  partsCount: 2,
  soldCount: 1,
  createdAt: '2026-08-02T10:00:00Z',
  createdBy: { id: 'user-1', displayName: 'Олена' },
}

const detail = {
  ...intake,
  notes: 'Перевірено',
  photos: [
    {
      url: 'https://cdn.example/intake.jpg',
      thumbnailUrl: 'https://cdn.example/intake-thumb.jpg',
    },
  ],
  parts: [
    {
      id: 'part-1',
      name: 'Бампер',
      partType: 'Кузов',
      condition: 'good',
      quantity: 2,
      unit: 'шт',
      status: 'available',
      qrCode: 'QR-1',
      photos: [],
      createdAt: '2026-08-02T10:30:00Z',
    },
  ],
  profitability: {
    invested: 5000,
    recouped: 1000,
    recoupedPercent: 20,
    partsAvailable: 1,
    partsSold: 1,
  },
}

const cabinet = (
  permissions: string[],
  usageOverrides: Partial<PlanUsageDto> = {},
) => {
  const usage: PlanUsageDto = {
    cars: { used: 0, max: 5 },
    intakes: { used: 0, max: 5 },
    parts: { used: 0, max: 5 },
    users: { used: 0, max: 5 },
    cashRegisters: { used: 0, max: 5 },
    ...usageOverrides,
  }
  return {
    status: 'ready' as const,
    targetTenant: {
      id: 'tenant-1',
      name: 'Demo Yard',
      slug: 'demo',
      plan: 'active',
      planTier: 'pro',
      city: null,
      logoUrl: null,
      isActive: true,
      createdAt: '2026-08-01T00:00:00Z',
      roleName: 'owner',
    },
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation: 1,
      role: 'manager',
      permissions: new Set(permissions),
      features: new Set<string>(),
      entitlement: {
        state: 'active' as const,
        usage,
      },
      subscription: null,
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue({
    status: 'ready',
    targetTenant: null,
    snapshot: null,
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  })
  vi.mocked(intakesApi.list).mockResolvedValue({
    items: [intake],
    page: 2,
    pageSize: 20,
    total: 21,
    totalPages: 2,
  })
  vi.mocked(intakesApi.get).mockResolvedValue(detail)
  vi.mocked(mediaApi.upload).mockResolvedValue({
    storageKey: 'pending/parts/photo',
    url: 'https://cdn.example/part.jpg',
  })
  vi.mocked(mediaApi.remove).mockResolvedValue(undefined)
})

it('loads the URL search and status list state through the server adapter', async () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/app/demo/intakes?search=Липнева&status=active&page=2&pageSize=20',
      ]}
    >
      <Routes>
        <Route path="/app/:tenant/intakes" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Приймання', level: 1 }),
  ).toBeVisible()
  expect(screen.getByText('Липнева партія')).toBeVisible()
  expect(intakesApi.list).toHaveBeenCalledWith(
    { search: 'Липнева', status: 'active', page: 2, pageSize: 20 },
    expect.anything(),
  )
  expect(
    screen.queryByRole('button', { name: 'Спочатку нові' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'За кількістю' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('USD')).not.toBeInTheDocument()
})

it('shows only supported fields on a new intake', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'finance.manage']),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/new']}>
      <Routes>
        <Route path="/app/:tenant/intakes/new" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )
  expect(
    await screen.findByRole('heading', { name: 'Нове приймання' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('group', { name: 'Вид джерела' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByLabelText('Документ постачальника'),
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Супутні витрати')).not.toBeInTheDocument()
})

it('updates a search in the URL before reloading page one', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes?page=2']}>
      <Routes>
        <Route path="/app/:tenant/intakes" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  const search = await screen.findByLabelText('Пошук приймань')
  // The search box submits its own form, as the redesign's header bar draws it.
  await user.type(search, 'Липнева{Enter}')

  await waitFor(() =>
    expect(intakesApi.list).toHaveBeenLastCalledWith(
      { search: 'Липнева', status: undefined, page: 1, pageSize: 20 },
      expect.anything(),
    ),
  )
})

it('uses authoritative server page metadata for pagination controls', async () => {
  const user = userEvent.setup()
  vi.mocked(intakesApi.list).mockResolvedValue({
    items: [intake],
    page: 4,
    pageSize: 10,
    total: 67,
    totalPages: 7,
  })
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes?page=2&pageSize=20']}>
      <Routes>
        <Route path="/app/:tenant/intakes" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Сторінка 4 з 7')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  await waitFor(() =>
    expect(intakesApi.list).toHaveBeenLastCalledWith(
      { search: undefined, status: undefined, page: 5, pageSize: 10 },
      expect.anything(),
    ),
  )
})

it('accepts an unbounded positive page while limiting pageSize to 100', async () => {
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes?page=101&pageSize=101']}>
      <Routes>
        <Route path="/app/:tenant/intakes" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Приймання', level: 1 })
  expect(intakesApi.list).toHaveBeenCalledWith(
    { search: undefined, status: undefined, page: 101, pageSize: 20 },
    expect.anything(),
  )
})

it('omits an invalid status from the URL-backed server request', async () => {
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes?status=archived']}>
      <Routes>
        <Route path="/app/:tenant/intakes" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('heading', { name: 'Приймання', level: 1 })
  expect(intakesApi.list).toHaveBeenCalledWith(
    { search: undefined, status: undefined, page: 1, pageSize: 20 },
    expect.anything(),
  )
})

it('applies intake quota only to create while allowing edit at the limit', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage'], {
      intakes: { used: 5, max: 5 },
      parts: { used: 0, max: 5 },
    }),
  )
  const { unmount } = render(
    <MemoryRouter initialEntries={['/app/demo/intakes/new']}>
      <Routes>
        <Route path="/app/:tenant/intakes/new" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ліміт приймань вичерпано',
  )
  unmount()

  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/edit']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/edit"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Редагування приймання' }),
  ).toBeVisible()
  expect(saveButton('Зберегти зміни')).toBeEnabled()
})

it('keeps intake detail visible and reports a normalized delete failure after pending state', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  let rejectRemove!: (reason: unknown) => void
  vi.mocked(intakesApi.remove).mockReturnValue(
    new Promise((_, reject) => {
      rejectRemove = reject
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Липнева партія' }),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Інші дії з прийманням' }),
  )
  const remove = screen.getByRole('button', { name: 'Видалити приймання' })
  await user.click(remove)
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Видалити',
    }),
  )
  expect(remove).toBeDisabled()
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  rejectRemove({ kind: 'conflict', message: 'Приймання містить запчастини.' })

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Приймання містить запчастини.',
  )
  expect(screen.getByRole('heading', { name: 'Липнева партія' })).toBeVisible()
})

it('shows photos and creator but gates linked parts and warehouse actions with parts.view', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText(/Створив Олена/)).toBeVisible()
  expect(screen.getByRole('img', { name: 'Фото приймання 1' })).toBeVisible()
  expect(screen.queryByText(/Вартість:/)).not.toBeInTheDocument()
  expect(screen.queryByText(/5\s000/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Бампер/)).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Додати деталь' }),
  ).not.toBeInTheDocument()
})

it('renders every linked intake part for parts.view without requiring parts.manage', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['intakes.view', 'parts.view']))
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const partRow = await screen.findByRole('rowheader', { name: /Бампер/ })
  expect(partRow).toBeVisible()
  expect(screen.getByRole('cell', { name: '2 шт' })).toBeVisible()
  expect(screen.getByRole('cell', { name: 'Доступна' })).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'Додати деталь' }),
  ).not.toBeInTheDocument()
})

it('requires intakes.manage, parts.view, and available parts quota for intake add-part', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  const { unmount } = render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/new"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Недостатньо прав')
  unmount()

  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view'], {
      intakes: { used: 0, max: 5 },
      parts: { used: 5, max: 5 },
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/new"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ліміт запчастин вичерпано',
  )
})

it('allows no-photo part creation without parts.manage and exposes upload only with it', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
  )
  vi.mocked(intakesApi.addPart).mockResolvedValue({} as never)
  const { unmount } = render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/new"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Додати деталь' }),
  ).toBeVisible()
  expect(screen.queryByLabelText('Додати фото')).not.toBeInTheDocument()
  await user.type(screen.getByRole('textbox', { name: 'Назва' }), 'Бампер')
  await user.click(
    within(screen.getByRole('region', { name: 'Нова позиція' })).getByRole(
      'button',
      { name: 'Додати деталь' },
    ),
  )
  expect(intakesApi.addPart).toHaveBeenCalledWith(
    'intake-1',
    {
      name: 'Бампер',
      partType: null,
      condition: 'good',
      quantity: 1,
      unit: 'шт',
      notes: null,
      photoKeys: [],
    },
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
  unmount()

  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view', 'parts.manage']),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/new"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByLabelText('Додати фото')).toBeEnabled()
})

it('rechecks parts.view before uploading intake-part media', async () => {
  const currentCabinet = cabinet([
    'intakes.view',
    'intakes.manage',
    'parts.view',
    'parts.manage',
  ])
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/new"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const upload = await screen.findByLabelText('Додати фото')
  currentCabinet.snapshot.permissions.delete('parts.view')
  await user.upload(
    upload,
    new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
  )

  expect(mediaApi.upload).not.toHaveBeenCalled()
})

it('locks add-part submit, prevents duplicates, normalizes conflict, and retains inputs', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view', 'parts.manage']),
  )
  let rejectPart!: (reason: unknown) => void
  vi.mocked(intakesApi.addPart).mockReturnValue(
    new Promise((_, reject) => {
      rejectPart = reject
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/new"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  await user.type(screen.getByRole('textbox', { name: 'Назва' }), 'Бампер')
  const save = within(
    screen.getByRole('region', { name: 'Нова позиція' }),
  ).getByRole('button', { name: 'Додати деталь' })
  await user.click(save)
  expect(save).toBeDisabled()
  expect(save.closest('form')).toHaveAttribute('aria-busy', 'true')
  await user.click(save)
  expect(intakesApi.addPart).toHaveBeenCalledTimes(1)
  rejectPart({ kind: 'conflict', message: 'QR-код уже використано.' })

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'QR-код уже використано.',
  )
  expect(screen.getByRole('textbox', { name: 'Назва' })).toHaveValue('Бампер')
})

it('locks intake create submission and prevents duplicate POSTs', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  let resolveCreate!: (value: typeof detail) => void
  vi.mocked(intakesApi.create).mockReturnValue(
    new Promise((resolve) => {
      resolveCreate = resolve
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/new']}>
      <Routes>
        <Route path="/app/:tenant/intakes/new" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  const save = saveButton('Створити приймання')
  await user.click(save)
  expect(save).toBeDisabled()
  expect(save.closest('form')).toHaveAttribute('aria-busy', 'true')
  await user.click(save)
  expect(intakesApi.create).toHaveBeenCalledTimes(1)
  resolveCreate(detail)
})

it('allows intake creation without finance.manage while hiding and omitting totalCost', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  vi.mocked(intakesApi.create).mockResolvedValue(detail)
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/new']}>
      <Routes>
        <Route path="/app/:tenant/intakes/new" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.queryByLabelText('Загальна вартість')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Назва'), 'Нефінансове приймання')
  await user.click(saveButton('Створити приймання'))

  await waitFor(() => expect(intakesApi.create).toHaveBeenCalledTimes(1))
  expect(intakesApi.create).toHaveBeenCalledWith(
    {
      name: 'Нефінансове приймання',
      supplier: null,
      purchasedAt: null,
      notes: null,
      photoKeys: [],
    },
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('rechecks the latest intake permission before dispatching create', async () => {
  const currentCabinet = cabinet(['intakes.view', 'intakes.manage'])
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/new']}>
      <Routes>
        <Route path="/app/:tenant/intakes/new" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  currentCabinet.snapshot.permissions.delete('intakes.manage')
  await user.click(saveButton('Створити приймання'))

  expect(intakesApi.create).not.toHaveBeenCalled()
})

it('allows intake editing without finance.manage while hiding and omitting totalCost', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  vi.mocked(intakesApi.update).mockResolvedValue(detail)
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/edit']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/edit"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByLabelText('Назва')).toHaveValue('Липнева партія')
  expect(screen.queryByLabelText('Загальна вартість')).not.toBeInTheDocument()
  await user.click(saveButton('Зберегти зміни'))

  await waitFor(() => expect(intakesApi.update).toHaveBeenCalledTimes(1))
  expect(intakesApi.update).toHaveBeenCalledWith(
    'intake-1',
    {
      name: 'Липнева партія',
      supplier: 'Постачальник',
      purchasedAt: '2026-08-01T12:00:00Z',
      notes: 'Перевірено',
    },
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('exposes and submits totalCost when the intake manager has finance.manage', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'finance.manage']),
  )
  vi.mocked(intakesApi.create).mockResolvedValue(detail)
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/new']}>
      <Routes>
        <Route path="/app/:tenant/intakes/new" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Загальна вартість'), '7500')
  await user.click(saveButton('Створити приймання'))

  await waitFor(() => expect(intakesApi.create).toHaveBeenCalledTimes(1))
  expect(intakesApi.create).toHaveBeenCalledWith(
    expect.objectContaining({ totalCost: 7500 }),
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('rechecks finance.manage before dispatching an intake totalCost', async () => {
  const currentCabinet = cabinet([
    'intakes.view',
    'intakes.manage',
    'finance.manage',
  ])
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/new']}>
      <Routes>
        <Route path="/app/:tenant/intakes/new" element={<IntakesScreen />} />
      </Routes>
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Загальна вартість'), '7500')
  currentCabinet.snapshot.permissions.delete('finance.manage')
  await user.click(saveButton('Створити приймання'))

  expect(intakesApi.create).not.toHaveBeenCalled()
})

it('locks intake edit submission, normalizes permission failure, and retains the form', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  let rejectUpdate!: (reason: unknown) => void
  vi.mocked(intakesApi.update).mockReturnValue(
    new Promise((_, reject) => {
      rejectUpdate = reject
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/edit']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/edit"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const name = await screen.findByLabelText('Назва')
  expect(name).toHaveValue('Липнева партія')
  const save = saveButton('Зберегти зміни')
  await user.click(save)
  expect(save).toBeDisabled()
  expect(save.closest('form')).toHaveAttribute('aria-busy', 'true')
  rejectUpdate({ kind: 'forbidden', message: 'Редагування заборонено.' })

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Редагування заборонено.',
  )
  expect(name).toHaveValue('Липнева партія')
})

it('books a batch sheet in one row at a time and prices the rows that carry one', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view', 'parts.manage']),
  )
  vi.mocked(intakesApi.addPart)
    .mockResolvedValueOnce({ id: 'part-a' } as never)
    .mockResolvedValueOnce({ id: 'part-b' } as never)
  vi.mocked(partsApi.update).mockResolvedValue({} as never)
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/batch']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/batch"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Приймання партією' }),
  ).toBeVisible()
  await user.type(screen.getByLabelText('Назва позиції 1'), 'Фара права')
  await user.type(screen.getByLabelText('Ціна в рядку 1'), '120')
  await user.type(screen.getByLabelText('Назва позиції 2'), 'Бампер')
  await user.click(saveButton('Прийняти 2 позиції'))

  await waitFor(() => expect(intakesApi.addPart).toHaveBeenCalledTimes(2))
  expect(intakesApi.addPart).toHaveBeenNthCalledWith(
    1,
    'intake-1',
    expect.objectContaining({ name: 'Фара права', quantity: 1, unit: 'шт' }),
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
  expect(intakesApi.addPart).toHaveBeenNthCalledWith(
    2,
    'intake-1',
    expect.objectContaining({ name: 'Бампер' }),
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
  // Only the priced row reaches the parts endpoint.
  expect(partsApi.update).toHaveBeenCalledTimes(1)
  expect(partsApi.update).toHaveBeenCalledWith(
    'part-a',
    { desiredSalePrice: { isSet: true, value: 120 } },
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('keeps the unbooked rows in the sheet when a batch row fails', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view', 'parts.manage']),
  )
  vi.mocked(intakesApi.addPart)
    .mockResolvedValueOnce({ id: 'part-a' } as never)
    .mockRejectedValueOnce({ kind: 'conflict', message: 'Ліміт вичерпано.' })
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/batch']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/batch"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Приймання партією' }),
  ).toBeVisible()
  await user.type(screen.getByLabelText('Назва позиції 1'), 'Фара права')
  await user.type(screen.getByLabelText('Назва позиції 2'), 'Бампер')
  await user.click(saveButton('Прийняти 2 позиції'))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Прийнято 1 з 2 позицій',
  )
  expect(screen.getByLabelText('Назва позиції 1')).toHaveValue('Бампер')
})
