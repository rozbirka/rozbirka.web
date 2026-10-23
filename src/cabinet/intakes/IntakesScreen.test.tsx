import { act, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { intakesApi } from '@/api/intakes'
import { mediaApi } from '@/api/media'
import { partsApi } from '@/api/parts'
import { equipmentApi } from '@/api/equipment'
import { inventoryApi } from '@/api/inventory'
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
    compatibilities: vi.fn(),
    replaceCompatibilities: vi.fn(),
  },
}))
vi.mock('@/api/equipment', () => ({
  equipmentApi: {
    types: vi.fn(),
    makes: vi.fn(),
    models: vi.fn(),
  },
}))
vi.mock('@/api/media', () => ({
  mediaApi: {
    upload: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/api/inventory', () => ({
  inventoryApi: {
    getZones: vi.fn(),
    getSections: vi.fn(),
    getShelves: vi.fn(),
    replacePartZones: vi.fn(),
  },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
vi.mock('../module-registry', () => ({
  cabinetModules: {
    intakes: {
      key: 'intakes',
      routeSegment: '/intakes',
      viewPermission: 'intakes.view',
      mutationPermission: 'intakes.manage',
      quotaResource: 'intakes',
      allowedSubscriptionStates: ['active'],
    },
    parts: {
      key: 'parts',
      routeSegment: '/parts',
      viewPermission: 'parts.view',
      mutationPermission: 'parts.manage',
      quotaResource: 'parts',
      allowedSubscriptionStates: ['active'],
    },
    inventory: {
      key: 'inventory',
      routeSegment: '/inventory',
      viewPermission: 'inventory.view',
      mutationPermission: 'inventory.zones.manage',
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
      requireDeliveryDeposit: true,
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
  vi.mocked(equipmentApi.types).mockResolvedValue([
    { id: 'type-car', code: 'passenger_car', name: 'Passenger car' },
  ])
  vi.mocked(equipmentApi.makes).mockResolvedValue([
    { id: 'make-vw', equipmentTypeId: 'type-car', name: 'Volkswagen' },
  ])
  vi.mocked(equipmentApi.models).mockResolvedValue([])
  vi.mocked(partsApi.compatibilities).mockResolvedValue({
    partId: 'part-new',
    version: 'v1',
    items: [],
  })
  vi.mocked(partsApi.replaceCompatibilities).mockResolvedValue({
    partId: 'part-new',
    version: 'v2',
    items: [],
  })
  vi.mocked(inventoryApi.getZones).mockResolvedValue([
    {
      id: 'system',
      warehouseId: 'warehouse',
      warehouseName: 'Основний склад',
      name: 'Без зони',
      isSystemUnassigned: true,
      isActive: true,
    },
    {
      id: 'zone',
      warehouseId: 'warehouse',
      warehouseName: 'Основний склад',
      name: 'Контейнер',
      isSystemUnassigned: false,
      isActive: true,
    },
  ] as never)
  vi.mocked(inventoryApi.getSections).mockResolvedValue([
    { id: 'section', zoneId: 'zone', name: 'Стелаж', isActive: true },
  ] as never)
  vi.mocked(inventoryApi.getShelves).mockResolvedValue([
    {
      id: 'shelf',
      sectionId: 'section',
      zoneId: 'zone',
      name: 'Полиця',
      isActive: true,
    },
  ] as never)
  vi.mocked(inventoryApi.replacePartZones).mockResolvedValue([])
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
  expect(screen.queryByText('Олена')).not.toBeInTheDocument()
  expect(intakesApi.list).toHaveBeenCalledWith(
    { search: 'Липнева', status: 'active', page: 2, pageSize: 20 },
    expect.anything(),
  )
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
  // Without known parts the dialog asks; the server still has the last word.
  vi.mocked(intakesApi.get).mockResolvedValue({ ...detail, partsCount: 0 })
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
  const remove = screen.getByRole('menuitem', { name: 'Видалити приймання' })
  await user.click(remove)
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Видалити',
    }),
  )
  expect(
    screen.queryByRole('menuitem', { name: 'Видалити приймання' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  rejectRemove({ kind: 'conflict', message: 'Приймання містить запчастини.' })

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося виконати дію через конфлікт даних.',
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

it('opens intake positions in the parts list and does not expose suppliers in the web UI', async () => {
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

  expect(await screen.findByRole('link', { name: 'Усі 2 →' })).toHaveAttribute(
    'href',
    '/app/demo/parts?origin=batch&intake_ids=intake-1',
  )
  expect(screen.queryByText('Постачальник')).not.toBeInTheDocument()
})

it('does not show intake cost or per-position cost on the intake card', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'parts.view', 'finance.view']),
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
  expect(screen.queryByRole('heading', { name: 'Собівартість' })).toBeNull()
  expect(screen.queryByRole('columnheader', { name: 'Собів.' })).toBeNull()
  expect(screen.queryByText(/на позицію/i)).toBeNull()
})

it('keeps the intake summary compact for more than one page of positions', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['intakes.view', 'parts.view']))
  vi.mocked(intakesApi.get).mockResolvedValue({
    ...detail,
    partsCount: 21,
    parts: Array.from({ length: 21 }, (_, index) => ({
      ...detail.parts[0]!,
      id: `part-${String(index + 1)}`,
      name: `Деталь ${String(index + 1)}`,
    })),
  })
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

  const card = await screen.findByRole('region', { name: 'Позиції приймання' })
  expect(within(card).getByRole('link', { name: 'Усі 21 →' })).toBeVisible()
  expect(
    within(card).getByText('21 запчастина з цього приймання'),
  ).toBeVisible()
  expect(within(card).getByText('20')).toBeVisible()
  expect(within(card).queryByRole('table')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Наступна сторінка' }),
  ).not.toBeInTheDocument()
})

it('shows intake stock for parts.view without requiring parts.manage', async () => {
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

  const parts = await screen.findByRole('region', { name: 'Позиції приймання' })
  expect(within(parts).getByRole('link', { name: 'Усі 2 →' })).toBeVisible()
  expect(within(parts).getByText('на складі')).toBeVisible()
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
    within(screen.getByRole('region', { name: 'Додати деталь' })).getByRole(
      'button',
      { name: 'Додати деталь' },
    ),
  )
  expect(intakesApi.addPart).toHaveBeenCalledWith(
    'intake-1',
    {
      name: 'Бампер',
      partType: null,
      oemCode: null,
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

it('uses the standard condition choices and compatibility section without invented part costs', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
  )
  vi.mocked(intakesApi.addPart).mockResolvedValue({ id: 'part-new' } as never)
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

  const condition = await screen.findByRole('radiogroup', {
    name: 'Стан деталі',
  })
  expect(within(condition).getAllByRole('radio')).toHaveLength(3)
  expect(
    within(condition).getByRole('radio', { name: 'Задовільний' }),
  ).toBeVisible()
  expect(screen.getByRole('heading', { name: /Сумісність/ })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Додати ще авто' })).toBeVisible()
  expect(screen.queryByText('Собівартість')).not.toBeInTheDocument()
  expect(screen.queryByText('Маржа')).not.toBeInTheDocument()
  await user.click(
    within(condition).getByRole('radio', { name: 'Задовільний' }),
  )
  await user.type(screen.getByRole('textbox', { name: 'Назва' }), 'Бампер')
  await user.click(saveButton('Додати деталь'))
  await waitFor(() =>
    expect(intakesApi.addPart).toHaveBeenCalledWith(
      'intake-1',
      expect.objectContaining({ condition: 'fair' }),
      expect.anything(),
    ),
  )
})

it.each(['save', 'save-and-add-another'] as const)(
  'refreshes intake parts after %s and returning from the drawer',
  async (mode) => {
    const user = userEvent.setup()
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
    )
    let serverDetail = detail
    vi.mocked(intakesApi.get).mockImplementation(() =>
      Promise.resolve(serverDetail),
    )
    vi.mocked(intakesApi.addPart).mockImplementation(() => {
      serverDetail = {
        ...detail,
        partsCount: detail.partsCount + 1,
        parts: [
          {
            ...detail.parts[0]!,
            id: 'part-new',
            name: 'Нова фара',
            qrCode: 'QR-NEW',
          },
          ...detail.parts,
        ],
      }
      return Promise.resolve({ id: 'part-new' } as never)
    })
    render(
      <MemoryRouter initialEntries={['/app/demo/intakes/intake-1']}>
        <Routes>
          <Route
            path="/app/:tenant/intakes/:intakeId/*"
            element={<IntakesScreen />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('link', { name: 'Усі 2 →' })
    await user.click(screen.getAllByRole('link', { name: 'Додати деталь' })[0]!)
    const drawer = await screen.findByRole('region', { name: 'Додати деталь' })
    await user.type(
      within(drawer).getByRole('textbox', { name: 'Назва' }),
      'Нова фара',
    )
    await user.type(
      within(drawer).getByRole('textbox', { name: 'OEM-код' }),
      '001RV-8820-02',
    )
    await user.click(
      within(drawer).getByRole('button', {
        name: mode === 'save' ? 'Додати деталь' : 'Зберегти й додати ще',
      }),
    )
    if (mode === 'save-and-add-another') {
      await waitFor(() =>
        expect(
          within(drawer).getByRole('textbox', { name: 'Назва' }),
        ).toHaveValue(''),
      )
      await user.click(
        within(drawer).getByRole('button', { name: 'Скасувати' }),
      )
    }

    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Додати деталь' }),
      ).not.toBeInTheDocument(),
    )
    expect(await screen.findByRole('link', { name: 'Усі 3 →' })).toBeVisible()
    const parts = screen.getByRole('region', { name: 'Позиції приймання' })
    expect(
      within(parts).getByText('3 запчастини з цього приймання'),
    ).toBeVisible()
    expect(screen.getByText('Додано «Нова фара»')).toBeVisible()
    expect(screen.getByText('Додано «Бампер»')).toBeVisible()
    expect(intakesApi.addPart).toHaveBeenCalledTimes(1)
  },
)

it('cancels a filled intake part without creating it', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
  )
  vi.mocked(intakesApi.addPart).mockReset()
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/*"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )
  const drawer = await screen.findByRole('region', { name: 'Додати деталь' })
  await user.type(
    within(drawer).getByRole('textbox', { name: 'Назва' }),
    'Не зберігати',
  )
  await user.type(
    within(drawer).getByRole('textbox', { name: 'OEM-код' }),
    'CANCEL-TEST',
  )
  await user.click(within(drawer).getByRole('button', { name: 'Скасувати' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(intakesApi.addPart).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('link', { name: /Не зберігати/ }),
  ).not.toBeInTheDocument()
})

it('limits pasted OEM to 100 characters and saves the complete allowed value', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
  )
  vi.mocked(intakesApi.addPart).mockResolvedValue({
    id: 'part-long-oem',
  } as never)
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/*"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )
  const drawer = await screen.findByRole('region', { name: 'Додати деталь' })
  await user.type(
    within(drawer).getByRole('textbox', { name: 'Назва' }),
    'Довгий OEM',
  )
  const oem = within(drawer).getByRole('textbox', { name: 'OEM-код' })
  await user.click(oem)
  await user.paste('0'.repeat(101))
  expect(oem).toHaveValue('0'.repeat(100))
  await user.click(
    within(drawer).getByRole('button', { name: 'Зберегти й додати ще' }),
  )
  await waitFor(() =>
    expect(intakesApi.addPart).toHaveBeenCalledWith(
      'intake-1',
      expect.objectContaining({ oemCode: '0'.repeat(100) }),
      expect.anything(),
    ),
  )
})

it('keeps name and OEM when Add part fails offline and creates it on retry', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
  )
  vi.mocked(intakesApi.addPart)
    .mockReset()
    .mockRejectedValueOnce({ kind: 'network', message: 'Немає мережі' })
    .mockResolvedValueOnce({ id: 'part-retried' } as never)
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId/*"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )
  const drawer = await screen.findByRole('region', { name: 'Додати деталь' })
  const name = within(drawer).getByRole('textbox', { name: 'Назва' })
  const oem = within(drawer).getByRole('textbox', { name: 'OEM-код' })
  await user.type(name, 'Тест OEM — Фара')
  await user.type(oem, '001RV-8820-02')
  await user.click(
    within(drawer).getByRole('button', { name: 'Додати деталь' }),
  )
  expect(await within(drawer).findByRole('alert')).toHaveTextContent(
    'Немає з’єднання з мережею.',
  )
  expect(name).toHaveValue('Тест OEM — Фара')
  expect(oem).toHaveValue('001RV-8820-02')
  await user.click(
    within(drawer).getByRole('button', { name: 'Додати деталь' }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(intakesApi.addPart).toHaveBeenCalledTimes(2)
  expect(intakesApi.addPart).toHaveBeenLastCalledWith(
    'intake-1',
    expect.objectContaining({
      name: 'Тест OEM — Фара',
      oemCode: '001RV-8820-02',
    }),
    expect.anything(),
  )
})

it('keeps OEM after a failed intake save and clears it only after saving and adding another', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
  )
  vi.mocked(intakesApi.addPart)
    .mockReset()
    .mockRejectedValueOnce({ kind: 'network', message: 'Network unavailable' })
    .mockResolvedValueOnce({ id: 'part-new' } as never)
    .mockResolvedValueOnce({ id: 'part-next' } as never)
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

  const oem = await screen.findByRole('textbox', { name: 'OEM-код' })
  expect(oem).toBeEnabled()
  expect(oem).toHaveAttribute('maxlength', '100')
  await user.type(screen.getByRole('textbox', { name: 'Назва' }), 'Фара')
  await user.type(oem, '  001RV-8820-02  ')
  await user.click(saveButton('Зберегти й додати ще'))
  await screen.findByText('Немає з’єднання з мережею.')
  expect(oem).toHaveValue('  001RV-8820-02  ')
  expect(intakesApi.addPart).toHaveBeenLastCalledWith(
    'intake-1',
    expect.objectContaining({ oemCode: '001RV-8820-02' }),
    expect.anything(),
  )

  await user.click(saveButton('Зберегти й додати ще'))
  await waitFor(() => expect(oem).toHaveValue(''))
  expect(intakesApi.addPart).toHaveBeenCalledTimes(2)
  expect(intakesApi.addPart).toHaveBeenLastCalledWith(
    'intake-1',
    expect.objectContaining({ oemCode: '001RV-8820-02' }),
    expect.anything(),
  )

  await user.type(screen.getByRole('textbox', { name: 'Назва' }), 'Двері')
  await user.click(saveButton('Зберегти й додати ще'))
  await waitFor(() => expect(intakesApi.addPart).toHaveBeenCalledTimes(3))
  expect(intakesApi.addPart).toHaveBeenLastCalledWith(
    'intake-1',
    expect.objectContaining({ oemCode: null }),
    expect.anything(),
  )
})

it('saves intake part location through zone, section, and shelf and retries without creating a duplicate', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet([
      'intakes.view',
      'intakes.manage',
      'parts.view',
      'inventory.view',
      'inventory.zones.manage',
    ]),
  )
  vi.mocked(intakesApi.addPart).mockResolvedValue({ id: 'part-new' } as never)
  vi.mocked(inventoryApi.replacePartZones)
    .mockRejectedValueOnce(new Error('Temporary failure'))
    .mockResolvedValueOnce([])
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

  await user.type(screen.getByRole('textbox', { name: 'Назва' }), 'Фара')
  for (const [label, option] of [
    ['Пошук складу', 'Основний склад'],
    ['Пошук зони', 'Контейнер'],
    ['Пошук секції', 'Стелаж'],
    ['Пошук полиці', 'Полиця'],
  ] as const) {
    await user.click(await screen.findByRole('searchbox', { name: label }))
    await user.click(screen.getByRole('option', { name: option }))
  }
  await user.click(saveButton('Додати деталь'))
  await waitFor(() =>
    expect(inventoryApi.replacePartZones).toHaveBeenCalledWith(
      'part-new',
      ['zone'],
      expect.anything(),
      'shelf',
      'section',
    ),
  )
  await user.click(saveButton('Додати деталь'))
  await waitFor(() =>
    expect(inventoryApi.replacePartZones).toHaveBeenCalledTimes(2),
  )
  expect(intakesApi.addPart).toHaveBeenCalledTimes(1)
})

it('saves intake part compatibility and retries without adding a duplicate part', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view', 'parts.manage']),
  )
  vi.mocked(intakesApi.addPart).mockResolvedValue({ id: 'part-new' } as never)
  vi.mocked(partsApi.replaceCompatibilities)
    .mockRejectedValueOnce(new Error('Temporary failure'))
    .mockResolvedValueOnce({ partId: 'part-new', version: 'v2', items: [] })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ Results: [{ MakeId: 1, MakeName: 'Volkswagen' }] }),
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
  await user.type(screen.getByRole('textbox', { name: 'Назва' }), 'Фара')
  await user.click(screen.getByRole('button', { name: 'Додати ще авто' }))
  await user.click(screen.getByRole('button', { name: 'Марка' }))
  await user.click(await screen.findByRole('option', { name: 'Volkswagen' }))
  await user.type(screen.getByRole('textbox', { name: 'Рік' }), '2018')
  await user.click(saveButton('Додати деталь'))
  await waitFor(() =>
    expect(partsApi.replaceCompatibilities).toHaveBeenCalledTimes(1),
  )
  expect(intakesApi.addPart).toHaveBeenCalledTimes(1)
  expect(partsApi.replaceCompatibilities).toHaveBeenCalledWith(
    'part-new',
    'v1',
    [
      {
        equipmentTypeId: 'type-car',
        makeId: 'make-vw',
        modelId: null,
        yearFrom: 2018,
        yearTo: 2018,
      },
    ],
  )
  await user.click(saveButton('Додати деталь'))
  await waitFor(() =>
    expect(partsApi.replaceCompatibilities).toHaveBeenCalledTimes(2),
  )
  expect(intakesApi.addPart).toHaveBeenCalledTimes(1)
  vi.unstubAllGlobals()
})

it('opens add-part as a standalone page and returns to the intake', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
  )
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId"
          element={<IntakesScreen />}
        />
        <Route
          path="/app/:tenant/intakes/:intakeId/parts/new"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )

  await user.click(
    (await screen.findAllByRole('link', { name: 'Додати деталь' }))[0]!,
  )
  const drawer = await screen.findByRole('region', { name: 'Додати деталь' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Липнева партія' }),
  ).not.toBeInTheDocument()
  await user.click(within(drawer).getByRole('button', { name: 'Назад' }))
  expect(screen.queryByRole('region', { name: 'Додати деталь' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Липнева партія' })).toBeVisible()
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
    screen.getByRole('region', { name: 'Додати деталь' }),
  ).getByRole('button', { name: 'Додати деталь' })
  await user.click(save)
  expect(save).toBeDisabled()
  expect(document.querySelector('#intake-part-form')).toHaveAttribute(
    'aria-busy',
    'true',
  )
  await user.click(save)
  expect(intakesApi.addPart).toHaveBeenCalledTimes(1)
  rejectPart({ kind: 'conflict', message: 'QR-код уже використано.' })

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося виконати дію через конфлікт даних.',
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
      supplier: null,
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
    'У вас немає доступу до цієї дії.',
  )
  expect(name).toHaveValue('Липнева партія')
})

it('explains that an intake with parts cannot be deleted before asking the server', async () => {
  const user = userEvent.setup()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  vi.mocked(intakesApi.get).mockResolvedValue({ ...detail, partsCount: 2 })
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

  await screen.findByRole('heading', { name: 'Липнева партія' })
  await user.click(
    screen.getByRole('button', { name: 'Інші дії з прийманням' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Видалити приймання' }))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('Партію не можна видалити')
  await user.click(within(dialog).getByRole('button', { name: 'Зрозуміло' }))
  expect(intakesApi.remove).not.toHaveBeenCalled()
})

const renderIntakeNotes = () =>
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

it('summarizes sold and stocked positions without finance access and opens this intake’s parts', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['intakes.view', 'parts.view']))
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId"
          element={<IntakesScreen />}
        />
        <Route path="/app/:tenant/parts" element={<p>Запчастини партії</p>} />
      </Routes>
    </MemoryRouter>,
  )
  const card = await screen.findByRole('region', { name: 'Позиції приймання' })
  const all = within(card).getByRole('link', { name: 'Усі 2 →' })
  expect(all).toHaveAttribute(
    'href',
    '/app/demo/parts?origin=batch&intake_ids=intake-1',
  )
  expect(within(card).queryByRole('radiogroup')).not.toBeInTheDocument()
  expect(within(card).queryByRole('table')).not.toBeInTheDocument()
  expect(within(card).getByText('2 запчастини з цього приймання')).toBeVisible()
  expect(within(card).getByText('продано')).toBeVisible()
  expect(within(card).getByText('на складі')).toBeVisible()
  expect(within(card).getAllByText('1')).toHaveLength(2)
  expect(within(card).getAllByText('50 %')).toHaveLength(2)
  await user.click(all)
  expect(await screen.findByText('Запчастини партії')).toBeVisible()
})

it.each([
  { total: 0, sold: 0, available: 0 },
  { total: 2, sold: 2, available: 0 },
])(
  'summarizes an intake with $total positions and $sold sold',
  async ({ total, sold, available }) => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(['intakes.view', 'parts.view']),
    )
    vi.mocked(intakesApi.get).mockResolvedValue({
      ...detail,
      partsCount: total,
      soldCount: sold,
      profitability: null,
      parts: [],
    })
    renderIntakeNotes()
    const card = await screen.findByRole('region', {
      name: 'Позиції приймання',
    })
    expect(
      within(card).getByRole('link', { name: `Усі ${String(total)} →` }),
    ).toHaveAttribute(
      'href',
      '/app/demo/parts?origin=batch&intake_ids=intake-1',
    )
    if (total === 0) {
      expect(
        within(card).getByText('У прийманні ще немає запчастин'),
      ).toBeVisible()
      expect(within(card).queryByText('продано')).not.toBeInTheDocument()
    } else {
      expect(within(card).getByText(String(sold))).toBeVisible()
      expect(within(card).getByText(String(available))).toBeVisible()
      expect(within(card).getByText('100 %')).toBeVisible()
      expect(within(card).getByText('0 %')).toBeVisible()
    }
  },
)

it('hides the parts summary without parts access', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['intakes.view']))
  renderIntakeNotes()
  await screen.findByRole('heading', { name: 'Липнева партія' })
  expect(
    screen.queryByRole('region', { name: 'Позиції приймання' }),
  ).not.toBeInTheDocument()
})

it('edits intake notes inline with only notes in the request and preserves its parts', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage', 'parts.view']),
  )
  vi.mocked(intakesApi.update).mockResolvedValue({
    ...detail,
    notes: 'Нова нотатка',
    parts: [],
  })
  const user = userEvent.setup()
  renderIntakeNotes()
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  await user.click(within(card).getByRole('button', { name: 'Редагувати' }))
  const input = within(card).getByRole('textbox', { name: 'Нотатки' })
  await user.clear(input)
  await user.type(input, '  Нова нотатка  ')
  await user.click(within(card).getByRole('button', { name: 'Зберегти' }))

  await waitFor(() => expect(intakesApi.update).toHaveBeenCalledOnce())
  expect(intakesApi.update).toHaveBeenCalledWith(
    'intake-1',
    { notes: 'Нова нотатка' },
    expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
  )
  await waitFor(() =>
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument(),
  )
  expect(within(card).getByText('Нова нотатка')).toBeVisible()
  const parts = screen.getByRole('region', { name: 'Позиції приймання' })
  expect(within(parts).getByRole('link', { name: 'Усі 2 →' })).toBeVisible()
  expect(screen.getByText('Додано «Бампер»')).toBeVisible()
})

it('keeps the intake notes card when empty and allows adding the first note', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  vi.mocked(intakesApi.get).mockResolvedValue({ ...detail, notes: null })
  vi.mocked(intakesApi.update).mockResolvedValue({
    ...detail,
    notes: 'Перша нотатка',
  })
  const user = userEvent.setup()
  renderIntakeNotes()
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  expect(within(card).getByText('Нотаток немає.')).toBeVisible()
  await user.click(within(card).getByRole('button', { name: 'Редагувати' }))
  await user.type(
    within(card).getByRole('textbox', { name: 'Нотатки' }),
    'Перша нотатка',
  )
  await user.click(within(card).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() =>
    expect(within(card).getByText('Перша нотатка')).toBeVisible(),
  )
  expect(intakesApi.update).toHaveBeenCalledWith(
    'intake-1',
    { notes: 'Перша нотатка' },
    expect.anything(),
  )
})

it('clears an intake note with an empty string while keeping the card editable', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  vi.mocked(intakesApi.update).mockResolvedValue({ ...detail, notes: null })
  const user = userEvent.setup()
  renderIntakeNotes()
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  await user.click(within(card).getByRole('button', { name: 'Редагувати' }))
  await user.clear(within(card).getByRole('textbox', { name: 'Нотатки' }))
  await user.click(within(card).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() =>
    expect(within(card).getByText('Нотаток немає.')).toBeVisible(),
  )
  expect(intakesApi.update).toHaveBeenCalledWith(
    'intake-1',
    { notes: '' },
    expect.anything(),
  )
})

it('retains an unsaved intake note after failure and cancels without a second mutation', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  vi.mocked(intakesApi.update).mockRejectedValue(
    new Error('Не вдалося зберегти'),
  )
  const user = userEvent.setup()
  renderIntakeNotes()
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  await user.click(within(card).getByRole('button', { name: 'Редагувати' }))
  const input = within(card).getByRole('textbox', { name: 'Нотатки' })
  await user.clear(input)
  await user.type(input, 'Чернетка')
  await user.click(within(card).getByRole('button', { name: 'Зберегти' }))
  await within(card).findByRole('alert')
  expect(input).toHaveValue('Чернетка')
  await user.click(within(card).getByRole('button', { name: 'Скасувати' }))
  expect(within(card).getByText('Перевірено')).toBeVisible()
  expect(intakesApi.update).toHaveBeenCalledOnce()
})

it('shows intake notes read-only without intakes.manage', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['intakes.view']))
  renderIntakeNotes()
  const card = await screen.findByRole('region', { name: 'Нотатки' })
  expect(within(card).getByText('Перевірено')).toBeVisible()
  expect(
    within(card).queryByRole('button', { name: 'Редагувати' }),
  ).not.toBeInTheDocument()
})

it('unmounts a pending intake note editor immediately when navigating to another intake', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(['intakes.view', 'intakes.manage']),
  )
  const user = userEvent.setup()
  let finishSave!: (value: typeof detail) => void
  let finishNextLoad!: (value: typeof detail) => void
  const saveResponse = new Promise<typeof detail>((resolve) => {
    finishSave = resolve
  })
  const nextResponse = new Promise<typeof detail>((resolve) => {
    finishNextLoad = resolve
  })
  vi.mocked(intakesApi.update).mockReturnValue(saveResponse)
  vi.mocked(intakesApi.get)
    .mockResolvedValueOnce(detail)
    .mockReturnValueOnce(nextResponse)
  render(
    <MemoryRouter initialEntries={['/app/demo/intakes/intake-1']}>
      <Link to="/app/demo/intakes/intake-2">Next intake</Link>
      <Routes>
        <Route
          path="/app/:tenant/intakes/:intakeId"
          element={<IntakesScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )
  const first = await screen.findByRole('region', { name: 'Нотатки' })
  await user.click(within(first).getByRole('button', { name: 'Редагувати' }))
  await user.type(
    within(first).getByRole('textbox', { name: 'Нотатки' }),
    ' чернетка',
  )
  await user.click(within(first).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(intakesApi.update).toHaveBeenCalledOnce())
  await user.click(screen.getByRole('link', { name: 'Next intake' }))
  expect(first).not.toBeInTheDocument()
  expect(
    screen.queryByRole('textbox', { name: 'Нотатки' }),
  ).not.toBeInTheDocument()
  await act(async () => {
    finishNextLoad({
      ...detail,
      id: 'intake-2',
      name: 'Інше приймання',
      notes: 'Інша нотатка',
    })
    await nextResponse
  })
  expect(await screen.findByText('Інша нотатка')).toBeVisible()
  await act(async () => {
    finishSave({ ...detail, notes: 'Перевірено чернетка' })
    await saveResponse
  })
  expect(screen.getByText('Інша нотатка')).toBeVisible()
  expect(screen.queryByText('Перевірено чернетка')).not.toBeInTheDocument()
})
