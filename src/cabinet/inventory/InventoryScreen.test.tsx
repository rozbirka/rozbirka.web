import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { LocaleProvider, type Locale } from '@/i18n'
import type {
  InventoryScan,
  InventorySection,
  InventoryZone,
  PartInventoryZone,
  Warehouse,
  WarehouseDetail,
} from '@/api/inventory'
import { InventoryScreen } from './InventoryScreen'
import {
  WarehousesScreen,
  PartPlacementDrawer,
} from '../warehouses/WarehousesScreen'
import { LegacyWarehouseRedirect } from '../warehouses/LegacyWarehouseRedirect'

const api = vi.hoisted(() => ({
  getWarehouses: vi.fn(),
  createWarehouse: vi.fn(),
  getWarehouse: vi.fn(),
  getZone: vi.fn(),
  getZones: vi.fn(),
  getSessions: vi.fn(),
  getSession: vi.fn(),
  getResults: vi.fn(),
  getAudit: vi.fn(),
  getScans: vi.fn(),
  getPartZones: vi.fn(),
  replacePartZones: vi.fn(),
  getShelves: vi.fn().mockResolvedValue([]),
  getSections: vi.fn().mockResolvedValue([]),
  getSection: vi.fn(),
  getShelf: vi.fn(),
  applyAdjustment: vi.fn(),
  updateWarehouse: vi.fn(),
  archiveWarehouse: vi.fn(),
  createZone: vi.fn(),
  createShelf: vi.fn(),
  createSection: vi.fn(),
  updateSection: vi.fn(),
  archiveSection: vi.fn(),
  restoreSection: vi.fn(),
  updateShelf: vi.fn(),
  archiveShelf: vi.fn(),
  updateZone: vi.fn(),
  archiveZone: vi.fn(),
  restoreZone: vi.fn(),
  startSession: vi.fn(),
  completeSession: vi.fn(),
  reopenSession: vi.fn(),
  cancelSession: vi.fn(),
  createSession: vi.fn(),
}))
const parts = vi.hoisted(() => ({
  facets: vi.fn(),
  search: vi.fn(),
  get: vi.fn(),
  history: vi.fn(),
}))
const team = vi.hoisted(() => ({ listMembers: vi.fn() }))
const printable = vi.hoisted(() => ({
  buildZoneLabelHtml: vi.fn().mockResolvedValue('<html>zones</html>'),
}))
const permissions = vi.hoisted(() => ({
  value: new Set([
    'inventory.view',
    'inventory.manage',
    'inventory.adjust',
    'inventory.zones.manage',
    'parts.view',
  ]),
}))

vi.mock('@/api/inventory', () => ({ inventoryApi: api }))
vi.mock('@/api/parts', () => ({ partsApi: parts }))
vi.mock('@/api/team', () => ({ teamApi: team }))
vi.mock('./zone-label-output', () => printable)
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: { id: 'tenant-1', slug: 'yard' },
    snapshot: {
      tenantId: 'tenant-1',
      userId: 'user-1',
      generation: 1,
      permissions: permissions.value,
      features: new Set<string>(),
      entitlement: {
        state: 'active',
        usage: {
          cars: { used: 0, max: null },
          intakes: { used: 0, max: null },
          parts: { used: 0, max: null },
          users: { used: 0, max: null },
          cashRegisters: { used: 0, max: null },
        },
      },
      subscription: null,
      cabinetParityRollout: null,
    },
  }),
}))

const definition = {
  key: 'inventory',
  routeSegment: '/inventory',
  viewPermission: 'inventory.view',
  mutationPermission: 'inventory.manage',
}

const session = {
  id: 'session-1',
  number: 'INV-001',
  status: 'inProgress',
  createdBy: 'user-1',
  startedBy: 'user-1',
  completedBy: null,
  createdAt: '2026-09-02T10:00:00Z',
  startedAt: '2026-09-02T10:05:00Z',
  completedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  preview: {
    includedPartCount: 12,
    coverageWarningPartCount: 1,
    conflictingPartCount: 0,
  },
  zones: [
    {
      zoneId: 'zone-1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      zoneName: 'Стелаж A1',
      zoneCode: 'A1',
      status: 'counting',
      leaseOwnerUserId: 'user-2',
      leaseExpiresAt: '2026-09-02T10:20:00Z',
      completedAt: null,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  permissions.value.delete('team.view')
  team.listMembers.mockResolvedValue([
    {
      id: 'member-1',
      userId: 'user-1',
      name: 'Олена',
      phone: null,
      role: {
        id: 'role-1',
        name: 'Працівник',
        isSystem: true,
        permissions: null,
        membersCount: null,
      },
      isActive: true,
      joinedAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'member-2',
      userId: 'user-2',
      name: 'Іван',
      phone: null,
      role: {
        id: 'role-1',
        name: 'Працівник',
        isSystem: true,
        permissions: null,
        membersCount: null,
      },
      isActive: true,
      joinedAt: '2026-09-01T10:00:00Z',
    },
  ])
  localStorage.clear()
  api.createWarehouse.mockResolvedValue({ id: 'wh-new' })
  api.getWarehouses.mockResolvedValue([
    {
      id: 'wh-1',
      name: 'Основний склад',
      code: 'main',
      isSystemDefault: true,
      isActive: true,
      zoneCount: 4,
    },
  ])
  api.getWarehouse.mockResolvedValue({
    id: 'wh-1',
    tenantId: 'tenant-1',
    name: 'Основний склад',
    code: 'main',
    isSystemDefault: false,
    isActive: true,
    unassignedPartCount: 2,
    createdAt: '2026-09-02T09:00:00Z',
    updatedAt: '2026-09-02T09:00:00Z',
    zones: [
      {
        id: 'zone-1',
        name: 'Стелаж A1',
        code: 'A1',
        isSystemUnassigned: false,
        isActive: true,
      },
    ],
  })
  api.getZone.mockResolvedValue({
    id: 'zone-1',
    warehouseId: 'wh-1',
    warehouseName: 'Основний склад',
    name: 'Стелаж A1',
    code: 'A1',
    qrCode: 'ZONE-1',
    isSystemUnassigned: false,
    isActive: true,
  })
  api.getSessions.mockResolvedValue([session])
  api.getSession.mockResolvedValue(session)
  api.getResults.mockResolvedValue({
    inventorySessionId: 'session-1',
    number: 'INV-001',
    parts: [
      {
        partId: 'part-1',
        partName: 'Крило',
        partQrCode: 'QR-1',
        expectedQuantity: 2,
        actualQuantity: 1,
        delta: -1,
        result: 'Shortage',
        hasCoverageWarning: false,
        unselectedZoneIds: [],
      },
    ],
  })
  api.getAudit.mockResolvedValue([])
  api.getScans.mockResolvedValue([
    {
      id: 'scan-1',
      inventorySessionId: 'session-1',
      zoneId: 'zone-1',
      partId: 'part-1',
      partName: 'Крило',
      partQrCode: 'QR-1',
      scannedBy: 'user-2',
      operationId: 'operation-1',
      scannedAt: '2026-09-02T10:10:00Z',
      unexpected: true,
      zonePartCount: 1,
    },
  ])
  api.getPartZones.mockResolvedValue([])
  api.getZones.mockResolvedValue([
    {
      id: 'zone-1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Стелаж A1',
      code: 'A1',
      qrCode: 'ZONE-1',
      isSystemUnassigned: false,
      isActive: true,
    },
  ])
  api.replacePartZones.mockResolvedValue([])
  api.updateWarehouse.mockResolvedValue(undefined)
  api.archiveWarehouse.mockResolvedValue(undefined)
  api.createZone.mockResolvedValue(undefined)
  api.getShelves.mockResolvedValue([])
  api.getSections.mockResolvedValue([
    {
      id: 'section-1',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Секція B',
      code: 'B',
      qrCode: 'inventory-section:section-1',
      partCount: 4,
      isActive: true,
    },
  ])
  api.getSection.mockResolvedValue({
    id: 'section-1',
    zoneId: 'zone-1',
    zoneName: 'Стелаж A1',
    warehouseId: 'wh-1',
    warehouseName: 'Основний склад',
    name: 'Секція B',
    code: 'B',
    qrCode: 'inventory-section:section-1',
    partCount: 4,
    isActive: true,
  })
  api.createShelf.mockResolvedValue(undefined)
  api.createSection.mockResolvedValue(undefined)
  api.updateSection.mockResolvedValue(undefined)
  api.archiveSection.mockResolvedValue(undefined)
  api.updateShelf.mockResolvedValue(undefined)
  api.archiveShelf.mockResolvedValue(undefined)
  api.updateZone.mockResolvedValue(undefined)
  api.archiveZone.mockResolvedValue(undefined)
  api.startSession.mockResolvedValue(session)
  api.completeSession.mockResolvedValue(session)
  api.reopenSession.mockResolvedValue(session)
  api.cancelSession.mockResolvedValue(session)
  api.createSession.mockResolvedValue(session)
  parts.facets.mockResolvedValue({
    statuses: [],
    warehouses: [],
    zones: [{ id: 'zone-1', name: 'Стелаж A1', count: 18 }],
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
  parts.search.mockImplementation((request: { hasDiscrepancy?: boolean }) =>
    Promise.resolve({
      items: [],
      page: 1,
      pageSize: 1,
      total: request.hasDiscrepancy === true ? 3 : 20,
      totalPages: 1,
    }),
  )
  parts.get.mockResolvedValue({
    id: 'part-1',
    name: 'Крило',
    qrCode: 'QR-1',
    unit: 'шт',
    quantityTotal: 2,
  })
  parts.history.mockResolvedValue({
    partId: 'part-1',
    events: [
      {
        id: 'event-1',
        eventType: 'placed',
        data: '{"zone":"A1"}',
        createdAt: '2026-09-01T10:00:00Z',
      },
    ],
  })
  printable.buildZoneLabelHtml.mockClear()
})

function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="inventory-url">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  )
}

function StockRoutes() {
  return (
    <Routes>
      <Route
        path="/app/:tenant/warehouses/*"
        element={<WarehousesScreen definition={definition as never} />}
      />
      <Route
        path="/app/:tenant/inventory/warehouses/:warehouseId"
        element={<LegacyWarehouseRedirect />}
      />
      <Route
        path="/app/:tenant/inventory/zones/:zoneId"
        element={<LegacyWarehouseRedirect />}
      />
      <Route
        path="/app/:tenant/inventory/sections/:sectionId"
        element={<LegacyWarehouseRedirect />}
      />
      <Route
        path="/app/:tenant/inventory/*"
        element={<InventoryScreen definition={definition as never} />}
      />
      <Route
        path="/app/:tenant/parts/:partId/inventory"
        element={<WarehousesScreen definition={definition as never} />}
      />
    </Routes>
  )
}

const renderAt = (path: string) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <StockRoutes />
        <LocationProbe />
      </MemoryRouter>
    </ToastProvider>,
  )

const renderIn = (locale: Locale, path: string) =>
  render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      <MemoryRouter initialEntries={[path]}>
        <StockRoutes />
      </MemoryRouter>
    </LocaleProvider>,
  )

it('renders the inventory overview in British English', async () => {
  renderIn('en-GB', '/app/yard/inventory')
  await screen.findByRole('heading', { level: 1, name: 'Stocktake' })
  expect(screen.queryByRole('region', { name: 'Warehouses' })).toBeNull()
  expect(
    screen.getByRole('heading', { level: 1, name: 'Stocktake' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New session' })).toBeInTheDocument()
  expect(screen.getByLabelText('Search sessions')).toBeInTheDocument()
  expect(screen.getByText('Active sessions')).toBeInTheDocument()
  expect(screen.getByText('In progress')).toBeInTheDocument()
  expect(screen.getByText('1 session · newest first')).toBeInTheDocument()
  expect(screen.getByText('0 / 1 zone')).toBeInTheDocument()
  expect(screen.queryByText(/Інвентаризація|Склади|сесія/)).toBeNull()
})

it('renders the inventory overview in Polish', async () => {
  renderIn('pl', '/app/yard/inventory')
  await screen.findByRole('link', { name: 'Nowa sesja' })
  expect(
    screen.getByRole('heading', { level: 1, name: 'Inwentaryzacja' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Magazyny' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Nowa sesja' })).toBeInTheDocument()
})

it('renders a session in British English with zone lease and status', async () => {
  renderIn('en-GB', '/app/yard/inventory/sessions/session-1')
  expect(await screen.findByText('Стелаж A1')).toBeInTheDocument()
  expect(screen.getByText('Counting')).toBeInTheDocument()
  expect(screen.getByText(/Zone taken by a user until/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Results' })).toBeInTheDocument()
})

it('renders responsive management overview without physical scanning controls', async () => {
  renderAt('/app/yard/inventory')
  await screen.findByRole('heading', { level: 1, name: 'Інвентаризація' })
  expect(screen.queryByRole('region', { name: 'Склади' })).toBeNull()
  expect(screen.getByText('INV-001')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Нова сесія' })).toBeInTheDocument()
  expect(screen.queryByText(/увімкнути камеру/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/сканувати qr/i)).not.toBeInTheDocument()
})

it('shows mobile counting progress as read-only web monitoring', async () => {
  renderAt('/app/yard/inventory/sessions/session-1')
  expect(await screen.findByText('Стелаж A1')).toBeInTheDocument()
  expect(screen.getByText('Підрахунок триває')).toBeInTheDocument()
  expect(screen.getByText(/зайнята користувачем/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Результати' })).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /рахувати/i }),
  ).not.toBeInTheDocument()
})

it('watches the live count from the session screen', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/sessions/session-1')

  await screen.findByRole('heading', { name: 'INV-001' })
  // The counted positions come from the session results, on this screen.
  const positions = screen.getByRole('region', { name: 'Позиції' })
  expect(within(positions).getByText('Крило')).toBeInTheDocument()
  expect(within(positions).getByText('QR-1')).toBeInTheDocument()
  // Scans are read per zone and merged into one stream.
  expect(api.getScans).toHaveBeenCalledWith('session-1', 'zone-1', {
    signal: expect.any(AbortSignal) as AbortSignal,
  })
  expect(
    within(
      screen.getByRole('region', { name: 'Останні сканування' }),
    ).getByText('Крило'),
  ).toBeInTheDocument()

  // The only counted position differs, so the matched filter empties the list.
  await user.click(screen.getByRole('radio', { name: 'Збіглося 0' }))
  expect(within(positions).queryByText('Крило')).not.toBeInTheDocument()
})

it('asks for a reason before cancelling a session', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/sessions/session-1')

  await screen.findByRole('heading', { name: 'INV-001' })
  await user.click(screen.getByRole('button', { name: 'Інші дії із сесією' }))
  await user.click(screen.getByRole('menuitem', { name: 'Скасувати сесію' }))
  const dialog = screen.getByRole('dialog')
  // The reason reaches the audit trail, so it is not optional.
  expect(
    within(dialog).getByRole('button', { name: 'Скасувати сесію' }),
  ).toBeDisabled()
  await user.type(within(dialog).getByLabelText(/Причина/), 'Перерахуємо потім')
  await user.click(
    within(dialog).getByRole('button', { name: 'Скасувати сесію' }),
  )
  await waitFor(() =>
    expect(api.cancelSession).toHaveBeenCalledWith(
      'session-1',
      'Перерахуємо потім',
      { signal: expect.any(AbortSignal) as AbortSignal },
    ),
  )
})

it('builds a session from zones and can start it at once', async () => {
  const user = userEvent.setup()
  api.createSession.mockResolvedValue({ ...session, id: 'session-9' })
  renderAt('/app/yard/inventory/sessions/new')

  await screen.findByRole('heading', { name: 'Нова сесія інвентаризації' })
  const scope = screen.getByRole('region', { name: 'Обсяг сесії' })
  const start = within(scope).getByRole('button', { name: 'Розпочати сесію' })
  // Nothing is picked yet, so the action cannot run.
  expect(start).toBeDisabled()

  await user.click(screen.getByRole('checkbox', { name: /Стелаж A1/ }))
  // The zone carries its real stock, counted by the parts facet.
  expect(screen.getByText('18 позицій')).toBeInTheDocument()

  await user.click(start)

  await waitFor(() =>
    expect(api.createSession).toHaveBeenCalledWith(['zone-1'], {
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
  // Starting is a second call: a draft that was never started stays a draft.
  await waitFor(() =>
    expect(api.startSession).toHaveBeenCalledWith('session-9', {
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('picks every zone of the warehouse for a full check', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/sessions/new')

  await screen.findByRole('heading', { name: 'Нова сесія інвентаризації' })
  await user.click(screen.getByRole('radio', { name: /Повна/ }))

  // A full check owns its selection, so the zone boxes stop being editable.
  const zone = screen.getByRole('checkbox', { name: /Стелаж A1/ })
  expect(zone).toBeChecked()
  expect(zone).toBeDisabled()
  // Only the two choices that can be expressed as zone IDs are offered.
  expect(
    screen.queryByRole('radio', { name: /Вибіркова/ }),
  ).not.toBeInTheDocument()
})

it('retries a failed start from the existing draft without creating another session', async () => {
  const user = userEvent.setup()
  const draft = {
    ...session,
    id: 'session-9',
    number: 'INV-009',
    status: 'draft',
  }
  api.createSession.mockResolvedValue(draft)
  api.startSession.mockRejectedValueOnce(new Error('Start unavailable'))
  api.getSession.mockResolvedValue(draft)
  renderAt('/app/yard/inventory/sessions/new')
  await user.click(await screen.findByRole('checkbox', { name: /Стелаж A1/ }))
  await user.click(
    within(screen.getByRole('region', { name: 'Обсяг сесії' })).getByRole(
      'button',
      { name: 'Розпочати сесію' },
    ),
  )
  expect(await screen.findByRole('heading', { name: 'INV-009' })).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent(/INV-009/)
  expect(api.createSession).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Запустити' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Запустити',
    }),
  )
  await waitFor(() => expect(api.startSession).toHaveBeenCalledTimes(2))
  expect(api.startSession).toHaveBeenLastCalledWith('session-9', {
    signal: expect.any(AbortSignal) as AbortSignal,
  })
  expect(api.createSession).toHaveBeenCalledTimes(1)
})

it('shows and retries session result failures instead of saying counting has not started', async () => {
  const user = userEvent.setup()
  api.getResults.mockRejectedValueOnce(new Error('Results unavailable'))
  renderAt('/app/yard/inventory/sessions/session-1')
  expect(
    await screen.findByText('Не вдалося завантажити результати сесії.'),
  ).toBeVisible()
  expect(
    screen.queryByText('Сесія ще не запущена — рахувати нічого.'),
  ).toBeNull()
  const positions = screen.getByRole('region', { name: 'Позиції' })
  await user.click(within(positions).getByRole('button', { name: 'Повторити' }))
  expect(
    await within(
      await screen.findByRole('region', { name: 'Позиції' }),
    ).findByText('Крило'),
  ).toBeVisible()
  expect(
    screen.queryByText('Не вдалося завантажити результати сесії.'),
  ).toBeNull()
})

it('shows and retries scan failures without presenting an empty scan journal', async () => {
  const user = userEvent.setup()
  api.getScans.mockRejectedValueOnce(new Error('Scans unavailable'))
  renderAt('/app/yard/inventory/sessions/session-1')
  expect(
    await screen.findByText('Не вдалося завантажити сканування сесії.'),
  ).toBeVisible()
  expect(screen.queryByText('Сканувань ще не було.')).toBeNull()
  expect(
    within(screen.getByRole('region', { name: 'Позиції' })).getByText('Крило'),
  ).toBeVisible()
  await user.click(
    within(
      screen.getByRole('region', { name: 'Останні сканування' }),
    ).getByRole('button', { name: 'Повторити' }),
  )
  const scans = await screen.findByRole('region', {
    name: 'Останні сканування',
  })
  expect(await within(scans).findByText('Крило')).toBeVisible()
})

it('keeps raw journal scans visible when comparison results fail to load', async () => {
  const user = userEvent.setup()
  api.getResults.mockRejectedValueOnce(new Error('Results unavailable'))
  renderAt('/app/yard/inventory/sessions/session-1/journal/zone-1')
  expect(
    await screen.findByText('Не вдалося завантажити результати сесії.'),
  ).toBeVisible()
  expect(within(screen.getByRole('table')).getByText('Крило')).toBeVisible()
  expect(screen.getByRole('radio', { name: 'Розходження —' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Повторити' }))
  expect(
    await screen.findByRole('radio', { name: 'Розходження 1' }),
  ).toBeEnabled()
  expect(
    screen.queryByText('Не вдалося завантажити результати сесії.'),
  ).toBeNull()
})

it('does not present scans from only some zones as a complete session stream', async () => {
  const loadScans = api.getScans.getMockImplementation() as (
    ...args: unknown[]
  ) => Promise<InventoryScan[]>
  api.getSession.mockResolvedValue({
    ...session,
    zones: [session.zones[0], { ...session.zones[0], zoneId: 'zone-2' }],
  })
  api.getScans.mockImplementation((id, zoneId, options) =>
    zoneId === 'zone-2'
      ? Promise.reject(new Error('Second zone unavailable'))
      : loadScans(id, zoneId, options),
  )
  renderAt('/app/yard/inventory/sessions/session-1')
  expect(
    await screen.findByText('Не вдалося завантажити сканування сесії.'),
  ).toBeVisible()
  expect(
    within(
      screen.getByRole('region', { name: 'Останні сканування' }),
    ).queryByText('Крило'),
  ).toBeNull()
  expect(
    within(screen.getByRole('region', { name: 'Позиції' })).getByText('Крило'),
  ).toBeVisible()
})

it('does not show failed zone loading as a zero-zone overview', async () => {
  const user = userEvent.setup()
  api.getZones.mockRejectedValueOnce(new Error('Zones unavailable'))
  renderAt('/app/yard/inventory')
  expect(
    await screen.findByText('Не вдалося завантажити перелік зон.'),
  ).toBeVisible()
  expect(screen.getByText('INV-001')).toBeVisible()
  const stat = screen.getByText('Перевірено зон').closest('div') as HTMLElement
  expect(within(stat).getByText('—')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Повторити' }))
  expect(await screen.findByText('INV-001')).toBeVisible()
  expect(screen.queryByText('Не вдалося завантажити перелік зон.')).toBeNull()
})

it('keeps session rows after a failed manual refresh and recovers without reloading the page', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/sessions/session-1')
  const refresh = await screen.findByRole('button', { name: 'Оновити' })
  const updated = screen.getByText(/Оновлено:/).textContent
  api.getSession.mockRejectedValueOnce(new Error('Offline'))
  await user.click(refresh)
  expect(
    await screen.findByText(/Показуємо останні завантажені дані/),
  ).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Позиції' })).getByText('Крило'),
  ).toBeVisible()
  expect(screen.getByText(/Оновлено:/)).toHaveTextContent(updated)
  await user.click(screen.getByRole('button', { name: 'Повторити' }))
  await waitFor(() =>
    expect(screen.queryByText(/Показуємо останні завантажені дані/)).toBeNull(),
  )
})

it('keeps counted parts when only the results request fails during refresh', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/sessions/session-1')
  const refresh = await screen.findByRole('button', { name: 'Оновити' })
  api.getResults.mockRejectedValueOnce(new Error('Results offline'))
  await user.click(refresh)
  expect(
    await screen.findByText(/Показуємо останні завантажені дані/),
  ).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Позиції' })).getByText('Крило'),
  ).toBeVisible()
})

it('refreshes results when the window regains focus', async () => {
  api.getSession.mockResolvedValue({ ...session, status: 'review' })
  renderAt('/app/yard/inventory/sessions/session-1/results')
  expect(await screen.findByText('Крило')).toBeVisible()
  api.getResults.mockResolvedValue({
    inventorySessionId: 'session-1',
    number: 'INV-001',
    parts: [],
  })
  fireEvent.focus(window)
  await waitFor(() => expect(screen.queryByText('Крило')).toBeNull())
  expect(
    screen.getByText('Розходжень немає — застосовувати нічого.'),
  ).toBeVisible()
})

it('refreshes the journal when the document becomes visible', async () => {
  renderAt('/app/yard/inventory/sessions/session-1/journal/zone-1')
  expect(await screen.findByText('Крило')).toBeVisible()
  api.getScans.mockResolvedValue([])
  fireEvent(document, new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByText('Крило')).toBeNull())
  expect(screen.getByRole('button', { name: 'Оновити' })).toBeVisible()
})

it('keeps journal rows when comparison loading fails during refresh', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/sessions/session-1/journal/zone-1')
  expect(await screen.findByText('Крило')).toBeVisible()
  api.getResults.mockRejectedValueOnce(new Error('Comparison offline'))
  await user.click(screen.getByRole('button', { name: 'Оновити' }))
  expect(
    await screen.findByText(/Показуємо останні завантажені дані/),
  ).toBeVisible()
  expect(within(screen.getByRole('table')).getByText('Крило')).toBeVisible()
  expect(screen.getByRole('radio', { name: 'Розходження 1' })).toBeEnabled()
})

it('renders discrepancy results and adjustment affordance', async () => {
  api.getSession.mockResolvedValue({ ...session, status: 'review' })
  renderAt('/app/yard/inventory/sessions/session-1/results')
  expect(await screen.findByText('Крило')).toBeInTheDocument()
  expect(screen.getByText('-1')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Прийняти факт' }),
  ).toBeInTheDocument()
})

it.each([
  ['session', '/app/yard/inventory/sessions/session-1'],
  ['results', '/app/yard/inventory/sessions/session-1/results'],
  ['audit', '/app/yard/inventory/sessions/session-1/audit'],
  ['journal', '/app/yard/inventory/sessions/session-1/journal/zone-1'],
])(
  'shows and retries team loading failures in %s without hiding the screen',
  async (_name, path) => {
    const user = userEvent.setup()
    permissions.value.add('team.view')
    team.listMembers.mockRejectedValueOnce(new Error('Team unavailable'))
    api.getAudit.mockResolvedValue([
      {
        id: 'audit-1',
        inventorySessionId: 'session-1',
        zoneId: null,
        partId: null,
        scanId: null,
        adjustmentId: null,
        action: 'session.started',
        actorUserId: 'user-2',
        detailsJson: null,
        createdAt: '2026-09-02T11:00:00Z',
      },
    ])
    renderAt(path)
    expect(
      await screen.findByText('Не вдалося завантажити команду.'),
    ).toBeVisible()
    expect(screen.queryByText('У команді ще нікого немає.')).toBeNull()
    expect(
      screen.queryByText('Імена видно тим, хто має право «team.view».'),
    ).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
    await user.click(
      within(screen.getByRole('alert')).getByRole('button', {
        name: 'Повторити',
      }),
    )
    expect((await screen.findAllByText(/Олена|Іван/)).length).toBeGreaterThan(0)
    expect(screen.queryByText('Не вдалося завантажити команду.')).toBeNull()
  },
)

it('keeps known team names when refreshing the team fails', async () => {
  const user = userEvent.setup()
  permissions.value.add('team.view')
  renderAt('/app/yard/inventory/sessions/session-1')
  expect(
    await screen.findByText('Іван', { selector: 'span.block' }),
  ).toBeVisible()
  team.listMembers.mockRejectedValueOnce(new Error('Offline'))
  fireEvent.focus(window)
  expect(await screen.findByText(/Не вдалося оновити команду/)).toBeVisible()
  expect(screen.getByText('Іван', { selector: 'span.block' })).toBeVisible()
  expect(
    screen.queryByText('Імена видно тим, хто має право «team.view».'),
  ).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Повторити' }))
  await waitFor(() =>
    expect(screen.queryByText(/Не вдалося оновити команду/)).toBeNull(),
  )
  expect(screen.getByText('Іван', { selector: 'span.block' })).toBeVisible()
})

it('does not request or explain team access on the new-session form', async () => {
  renderAt('/app/yard/inventory/sessions/new')
  expect(
    await screen.findByRole('heading', { name: 'Нова сесія інвентаризації' }),
  ).toBeVisible()
  expect(
    screen.queryByText('Список команди видно тим, хто має право «team.view».'),
  ).not.toBeInTheDocument()
  expect(team.listMembers).not.toHaveBeenCalled()
})

it.each(['blocked only', 'applied and blocked', 'open and blocked'])(
  'does not call coverage-blocked discrepancies decided: %s',
  async (scenario) => {
    api.getSession.mockResolvedValue({ ...session, status: 'review' })
    const blocked = {
      partId: 'part-blocked',
      partName: 'Двері',
      partQrCode: 'QR-blocked',
      expectedQuantity: 3,
      actualQuantity: 2,
      delta: -1,
      result: 'Shortage',
      hasCoverageWarning: true,
      unselectedZoneIds: ['zone-2'],
    }
    api.getResults.mockResolvedValue({
      inventorySessionId: 'session-1',
      number: 'INV-001',
      parts: [
        blocked,
        ...(scenario === 'blocked only'
          ? []
          : [
              {
                ...blocked,
                partId: 'part-other',
                partName: 'Крило',
                hasCoverageWarning: false,
                unselectedZoneIds: [],
              },
            ]),
      ],
    })
    if (scenario === 'applied and blocked') {
      api.getAudit.mockResolvedValue([
        {
          id: 'audit-1',
          inventorySessionId: 'session-1',
          zoneId: null,
          partId: 'part-other',
          scanId: null,
          adjustmentId: 'adjustment-1',
          action: 'adjustment.applied',
          actorUserId: 'user-1',
          detailsJson: null,
          createdAt: '2026-09-02T11:00:00Z',
        },
      ])
    }
    renderAt('/app/yard/inventory/sessions/session-1/results')
    expect(
      await screen.findByText(
        'Є розходження без рішення. Коригування для них недоступне через неповне покриття зон.',
      ),
    ).toBeVisible()
    expect(screen.queryByText('Усі розходження вже мають рішення.')).toBeNull()
    if (scenario === 'open and blocked') {
      expect(
        screen.getAllByRole('button', { name: 'Прийняти факт' }),
      ).toHaveLength(1)
    } else {
      expect(screen.queryByRole('button', { name: 'Прийняти факт' })).toBeNull()
    }
  },
)

it('offers reopen only while a session is in review', async () => {
  api.getSession.mockResolvedValue({ ...session, status: 'review' })
  renderAt('/app/yard/inventory/sessions/session-1')

  expect(
    await screen.findByRole('button', { name: 'Відкрити повторно' }),
  ).toBeInTheDocument()
})

it('does not link draft sessions to unavailable results', async () => {
  api.getSession.mockResolvedValue({ ...session, status: 'draft' })
  renderAt('/app/yard/inventory/sessions/session-1')

  await screen.findByRole('heading', { name: 'INV-001' })
  expect(
    screen.queryByRole('link', { name: 'Результати' }),
  ).not.toBeInTheDocument()
})

it('routes correctly when the tenant slug matches a module segment', async () => {
  renderAt('/app/inventory/inventory/sessions/session-1')

  expect(
    await screen.findByRole('heading', { name: 'INV-001' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Результати' })).toBeInTheDocument()
})

it('routes part placement when the tenant slug is parts', async () => {
  renderAt('/app/parts/parts/part-1/inventory')

  expect(
    await screen.findByLabelText('Основний склад · Стелаж A1'),
  ).toBeInTheDocument()
})

it('does not offer duplicate or unsafe adjustments', async () => {
  api.getSession.mockResolvedValue({ ...session, status: 'review' })
  api.getAudit.mockResolvedValue([
    {
      id: 'audit-1',
      inventorySessionId: 'session-1',
      zoneId: null,
      partId: 'part-1',
      scanId: null,
      adjustmentId: 'adjustment-1',
      action: 'adjustment.applied',
      actorUserId: 'user-1',
      detailsJson: null,
      createdAt: '2026-09-02T11:00:00Z',
    },
  ])

  renderAt('/app/yard/inventory/sessions/session-1/results')

  expect(await screen.findByText('Застосовано')).toBeInTheDocument()
  expect(screen.getByText('Усі розходження вже мають рішення.')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Прийняти факт' }),
  ).not.toBeInTheDocument()
})

it('filters matched results until the user asks to see every position', async () => {
  api.getSession.mockResolvedValue({ ...session, status: 'review' })
  api.getResults.mockResolvedValue({
    inventorySessionId: 'session-1',
    number: 'INV-001',
    parts: [
      {
        partId: 'part-matched',
        partName: 'Дзеркало',
        partQrCode: 'QR-2',
        expectedQuantity: 1,
        actualQuantity: 1,
        delta: 0,
        result: 'Matched',
        hasCoverageWarning: false,
        unselectedZoneIds: [],
      },
    ],
  })
  renderAt('/app/yard/inventory/sessions/session-1/results')

  expect(
    await screen.findByRole('radio', { name: /Розходження/ }),
  ).toBeChecked()
  expect(screen.queryByText('Дзеркало')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: /Усі позиції/ }))
  expect(screen.getByText('Дзеркало')).toBeInTheDocument()
})

it('shows the mobile scan journal as read-only data', async () => {
  renderAt('/app/yard/inventory/sessions/session-1/journal/zone-1')
  expect(await screen.findByText('Крило')).toBeInTheDocument()
  expect(screen.getByText('Несподівана')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /сканувати/i }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /скасувати останнє/i }),
  ).not.toBeInTheDocument()
})

it('filters journal scans by comparison and restores all scans', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/sessions/session-1/journal/zone-1')
  expect(await screen.findByText('Крило')).toBeVisible()
  await user.click(screen.getByRole('radio', { name: 'Збіглося 0' }))
  expect(screen.queryByText('Крило')).toBeNull()
  expect(screen.getByText('Сканувань за цим фільтром немає')).toBeVisible()
  await user.click(screen.getByRole('radio', { name: 'Усі 1' }))
  expect(within(screen.getByRole('table')).getByText('Крило')).toBeVisible()
  await user.click(screen.getByRole('radio', { name: 'Розходження 1' }))
  expect(within(screen.getByRole('table')).getByText('Крило')).toBeVisible()
})

it('filters audit events by kind and by search without mixing the groups', async () => {
  const user = userEvent.setup()
  const event = {
    inventorySessionId: 'session-1',
    zoneId: null,
    partId: null,
    scanId: null,
    adjustmentId: null,
    actorUserId: 'user-1',
    detailsJson: null,
    createdAt: '2026-09-02T11:00:00Z',
  }
  api.getAudit.mockResolvedValue([
    { ...event, id: 'audit-session', action: 'session.started' },
    {
      ...event,
      id: 'audit-adjustment',
      action: 'adjustment.applied',
      adjustmentId: 'adjustment-1',
      partId: 'part-1',
    },
    { ...event, id: 'audit-scan', action: 'scan.recorded', scanId: 'scan-1' },
  ])
  renderAt('/app/yard/inventory/sessions/session-1/audit')
  expect(await screen.findByText('Сесію розпочато')).toBeVisible()
  await user.click(screen.getByRole('radio', { name: 'Рішення 1' }))
  expect(screen.getByText('Коригування застосовано')).toBeVisible()
  expect(screen.queryByText('Сесію розпочато')).toBeNull()
  expect(screen.queryByText('Позицію відскановано')).toBeNull()
  await user.click(screen.getByRole('radio', { name: 'Сканування 1' }))
  expect(screen.getByText('Позицію відскановано')).toBeVisible()
  expect(screen.queryByText('Коригування застосовано')).toBeNull()
  await user.click(screen.getByRole('radio', { name: 'Усі 3' }))
  expect(screen.getByText('Сесію розпочато')).toBeVisible()
  expect(screen.getByText('Коригування застосовано')).toBeVisible()
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук в аудиті' }),
    'розпочато',
  )
  expect(screen.getByText('Сесію розпочато')).toBeVisible()
  expect(screen.queryByText('Коригування застосовано')).toBeNull()
  expect(screen.queryByText('Позицію відскановано')).toBeNull()
})

it('marks voided Mobile scans in the read-only journal', async () => {
  api.getScans.mockResolvedValue([
    {
      id: 'scan-voided',
      inventorySessionId: 'session-1',
      zoneId: 'zone-1',
      partId: 'part-1',
      partName: 'Крило',
      partQrCode: 'QR-1',
      scannedBy: 'user-2',
      operationId: 'operation-1',
      scannedAt: '2026-09-02T10:10:00Z',
      unexpected: false,
      zonePartCount: 0,
      voidedAt: '2026-09-02T10:11:00Z',
      voidedBy: 'user-2',
      voidReason: 'Помилкове сканування',
    },
  ])

  renderAt('/app/yard/inventory/sessions/session-1/journal/zone-1')

  expect(await screen.findByText('Скасовано')).toBeInTheDocument()
  expect(screen.getByText('Помилкове сканування')).toBeInTheDocument()
})

it('manages part placement without exposing counting actions', async () => {
  renderAt('/app/yard/parts/part-1/inventory')
  expect(
    await screen.findByLabelText('Основний склад · Стелаж A1'),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Зберегти розміщення' }),
  ).toBeInTheDocument()
  expect(screen.queryByText(/камера/i)).not.toBeInTheDocument()
})

it('saves a shelf only within the selected zone', async () => {
  const user = userEvent.setup()
  api.getPartZones.mockResolvedValue([
    {
      zoneId: 'zone-1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      zoneName: 'Стелаж A1',
      zoneCode: 'A1',
      zoneQrCode: 'ZONE-1',
      isSystemUnassigned: false,
      shelfId: null,
    },
  ])
  api.getShelves.mockResolvedValue([
    {
      id: 'shelf-1',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Полиця 1',
      code: 'P1',
      qrCode: 'inventory-shelf:shelf-1',
      isActive: true,
      sectionId: 'section-1',
      sectionName: 'Секція B',
      partCount: 3,
    },
  ])
  api.getSections.mockResolvedValue([
    {
      id: 'section-1',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Секція B',
      code: 'B',
      qrCode: 'inventory-section:section-1',
      isActive: true,
    },
  ])
  renderAt('/app/yard/parts/part-1/inventory')

  expect(
    await screen.findByRole('heading', { name: 'Секція / стелаж' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Місце/полиця' }),
  ).not.toBeInTheDocument()
  await user.click(
    await screen.findByRole('radio', { name: /^Стелаж A1 · Секція B$/ }),
  )
  expect(
    screen.getByRole('heading', { name: 'Місце/полиця' }),
  ).toBeInTheDocument()
  await user.click(
    await screen.findByRole('radio', {
      name: /Стелаж A1 · Секція B · Полиця 1/,
    }),
  )
  const summary = screen.getByRole('region', { name: 'Нове розміщення' })
  expect(summary).toHaveTextContent('Основний склад')
  expect(summary).toHaveTextContent('Стелаж A1')
  expect(summary).toHaveTextContent('Секція B')
  expect(summary).toHaveTextContent('Полиця 1')
  await user.click(screen.getByRole('button', { name: 'Зберегти розміщення' }))
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-1'],
      expect.any(Object),
      'shelf-1',
      'section-1',
    ),
  )
})

it('stores a part at the warehouse level without forcing a physical zone', async () => {
  const user = userEvent.setup()
  api.getZones.mockResolvedValue([
    {
      id: 'system-zone-1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Без зони',
      code: 'unassigned',
      qrCode: '',
      isSystemUnassigned: true,
      isActive: true,
    },
  ])
  renderAt('/app/yard/parts/part-1/inventory')

  await user.click(
    await screen.findByRole('radio', {
      name: 'Зберегти тільки на рівні складу',
    }),
  )
  expect(
    screen.queryByRole('heading', { name: 'Секція / стелаж' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Місце/полиця' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('region', { name: 'Нове розміщення' }),
  ).toHaveTextContent('Основний склад')
  expect(
    screen.getByRole('region', { name: 'Нове розміщення' }),
  ).not.toHaveTextContent('unassigned')
  await user.click(screen.getByRole('button', { name: 'Зберегти розміщення' }))
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['system-zone-1'],
      expect.any(Object),
      undefined,
      undefined,
    ),
  )
})

it('selects only one physical zone on the standalone placement page', async () => {
  const user = userEvent.setup()
  api.getWarehouses.mockResolvedValue([
    {
      id: 'wh-1',
      name: 'Основний склад',
      code: 'main',
      isSystemDefault: true,
      isActive: true,
      zoneCount: 2,
    },
    {
      id: 'wh-2',
      name: 'Другий склад',
      code: 'second',
      isSystemDefault: false,
      isActive: true,
      zoneCount: 1,
    },
  ])
  api.getZones.mockResolvedValue([
    {
      id: 'zone-1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Стелаж A1',
      code: 'A1',
      qrCode: 'ZONE-1',
      isSystemUnassigned: false,
      isActive: true,
    },
    {
      id: 'zone-2',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Стелаж A2',
      code: 'A2',
      qrCode: 'ZONE-2',
      isSystemUnassigned: false,
      isActive: true,
    },
    {
      id: 'zone-3',
      warehouseId: 'wh-2',
      warehouseName: 'Другий склад',
      name: 'Стелаж B1',
      code: 'B1',
      qrCode: 'ZONE-3',
      isSystemUnassigned: false,
      isActive: true,
    },
  ])
  renderAt('/app/yard/parts/part-1/inventory')

  const first = await screen.findByRole('radio', {
    name: 'Основний склад · Стелаж A1',
  })
  const second = screen.getByRole('radio', {
    name: 'Основний склад · Стелаж A2',
  })
  await user.click(first)
  await user.click(second)
  expect(first).not.toBeChecked()
  expect(second).toBeChecked()

  await user.click(screen.getByRole('radio', { name: /Другий склад/ }))
  expect(
    screen.getByRole('button', { name: 'Зберегти розміщення' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('region', { name: 'Нове розміщення' }),
  ).not.toHaveTextContent('Стелаж A2')

  await user.click(
    screen.getByRole('radio', { name: 'Другий склад · Стелаж B1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Зберегти розміщення' }))
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-3'],
      expect.any(Object),
      undefined,
      undefined,
    ),
  )
})

it('requires a single destination before replacing an existing multi-zone placement', async () => {
  const user = userEvent.setup()
  api.getZones.mockResolvedValue([
    {
      id: 'zone-1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Стелаж A1',
      code: 'A1',
      qrCode: 'ZONE-1',
      isSystemUnassigned: false,
      isActive: true,
    },
    {
      id: 'zone-2',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Стелаж A2',
      code: 'A2',
      qrCode: 'ZONE-2',
      isSystemUnassigned: false,
      isActive: true,
    },
  ])
  api.getPartZones.mockResolvedValue([
    {
      zoneId: 'zone-1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      zoneName: 'Стелаж A1',
      zoneCode: 'A1',
      zoneQrCode: 'ZONE-1',
      isSystemUnassigned: false,
    },
    {
      zoneId: 'zone-2',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      zoneName: 'Стелаж A2',
      zoneCode: 'A2',
      zoneQrCode: 'ZONE-2',
      isSystemUnassigned: false,
    },
  ])
  renderAt('/app/yard/parts/part-1/inventory')

  const first = await screen.findByRole('radio', {
    name: 'Основний склад · Стелаж A1',
  })
  const second = screen.getByRole('radio', {
    name: 'Основний склад · Стелаж A2',
  })
  expect(first).not.toBeChecked()
  expect(second).not.toBeChecked()
  expect(
    screen.getByRole('button', { name: 'Зберегти розміщення' }),
  ).toBeDisabled()
  expect(api.replacePartZones).not.toHaveBeenCalled()
  await user.click(second)
  await user.click(screen.getByRole('button', { name: 'Зберегти розміщення' }))
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-2'],
      expect.any(Object),
      undefined,
      undefined,
    ),
  )
})

it('stores a part in a section without forcing a shelf', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/parts/part-1/inventory')

  await user.click(await screen.findByLabelText('Основний склад · Стелаж A1'))
  await user.click(
    await screen.findByRole('radio', { name: /^Стелаж A1 · Секція B$/ }),
  )
  await user.click(screen.getByRole('button', { name: 'Зберегти розміщення' }))
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-1'],
      expect.any(Object),
      undefined,
      'section-1',
    ),
  )
})

it('opens zone creation in a side drawer and derives its code from the name', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/parts/part-1/inventory')

  await user.click(await screen.findByRole('button', { name: 'Додати зону' }))
  const drawer = screen.getByRole('dialog', { name: 'Нова зона' })
  expect(drawer).toHaveClass('rz-sheet')
  await user.type(
    within(drawer).getByRole('textbox', { name: 'Назва' }),
    'Стелаж Б2',
  )
  expect(within(drawer).getByRole('textbox', { name: 'Код' })).toHaveValue(
    'stelazh-b2',
  )
})

it('updates the zone code when its name is edited in the side drawer', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/wh-1')

  await user.click(
    await screen.findByRole('button', { name: 'Дії із зоною Стелаж A1' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Редагувати' }))
  const drawer = screen.getByRole('dialog', { name: 'Редагувати зону' })
  expect(drawer).toHaveClass('rz-sheet')
  expect(within(drawer).getByRole('textbox', { name: 'Код' })).toHaveValue('A1')
  await user.clear(within(drawer).getByRole('textbox', { name: 'Назва' }))
  await user.type(
    within(drawer).getByRole('textbox', { name: 'Назва' }),
    'Сектор В3',
  )
  expect(within(drawer).getByRole('textbox', { name: 'Код' })).toHaveValue(
    'sektor-v3',
  )
})

it('allows a long part QR code to wrap on a narrow placement screen', async () => {
  const qrCode =
    '3870f3f5ecb1dbab378027dd9299c57988085d4d7b80054a7a8156cf523e87db'
  parts.get.mockResolvedValue({
    id: 'part-1',
    name: 'Крило',
    qrCode,
    unit: 'шт',
    quantityTotal: 2,
  })

  renderAt('/app/yard/parts/part-1/inventory')

  const qrLabels = await screen.findAllByText(qrCode)
  expect(
    qrLabels.find((label) => label.classList.contains('font-mono')),
  ).toHaveClass('break-all', 'max-w-full')
})

it('shows progress while part placement is being saved', async () => {
  let finishSaving: (() => void) | undefined
  api.getPartZones.mockResolvedValue([
    {
      isSystemUnassigned: false,
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      zoneCode: 'A1',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      zoneQrCode: 'ZONE-1',
    },
  ])
  api.replacePartZones.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishSaving = () => resolve([])
      }),
  )

  renderAt('/app/yard/parts/part-1/inventory')
  fireEvent.click(
    await screen.findByRole('button', { name: 'Зберегти розміщення' }),
  )

  // Both the toolbar and the summary panel save, and both report progress.
  for (const button of screen.getAllByRole('button', { name: 'Зберігаємо…' })) {
    expect(button).toBeDisabled()
  }
  finishSaving?.()
})

it('confirms that part placement was saved with an ok toast', async () => {
  renderAt('/app/yard/parts/part-1/inventory')
  fireEvent.click(
    await screen.findByRole('radio', { name: 'Основний склад · Стелаж A1' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти розміщення' }))

  const toast = (await screen.findByText('Розміщення збережено')).closest(
    '.rz-toast',
  )
  expect(toast).toHaveAttribute('role', 'status')
  expect(api.replacePartZones).toHaveBeenCalledTimes(1)
})

it('says nothing changed with an info toast when the set is the same', async () => {
  api.getPartZones.mockResolvedValue([
    {
      isSystemUnassigned: false,
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      zoneCode: 'A1',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      zoneQrCode: 'ZONE-1',
    },
  ])

  renderAt('/app/yard/parts/part-1/inventory')
  fireEvent.click(
    await screen.findByRole('button', { name: 'Зберегти розміщення' }),
  )

  const toast = (
    await screen.findByText('Нічого не змінилося — набір зон уже такий.', {
      selector: '.rz-toast__msg',
    })
  ).closest('.rz-toast')
  expect(toast).toHaveAttribute('role', 'status')
  expect(screen.queryByText('Розміщення збережено')).not.toBeInTheDocument()
})

it('does not allow replacement when current part placement failed to load', async () => {
  api.getPartZones.mockRejectedValue(new Error('offline'))

  renderAt('/app/yard/parts/part-1/inventory')

  expect(
    await screen.findByText(/Не вдалося завантажити дані/),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Зберегти розміщення' }),
  ).not.toBeInTheDocument()
})

it('offers warehouse and zone management and prints actual zone QR labels', async () => {
  const user = userEvent.setup()
  const print = vi.fn()
  const focus = vi.fn()
  const close = vi.fn()
  const write = vi.fn()
  vi.spyOn(window, 'open').mockReturnValue({
    document: { write, close },
    focus,
    print,
    opener: null,
  } as never)

  renderAt('/app/yard/warehouses/wh-1')

  expect(await screen.findByText('Стелаж A1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Редагувати' })).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Дії із зоною Стелаж A1' }),
  )
  expect(
    screen.getByRole('menuitem', { name: 'Архівувати' }),
  ).toBeInTheDocument()
  await user.keyboard('{Escape}')

  // Printing, exporting and archiving hide behind the overflow control, the
  // way the toolbar is drawn.
  await user.click(screen.getByRole('button', { name: 'Дії із зонами' }))
  await user.click(screen.getByRole('menuitem', { name: 'Друк стікерів зон' }))

  const picker = await screen.findByRole('region', { name: 'Етикетки зон' })
  expect(
    screen.getByRole('heading', {
      name: 'Основний склад',
      level: 1,
      hidden: true,
    }),
  ).toBeInTheDocument()
  await user.click(
    await within(picker).findByRole('checkbox', { name: 'Обрати: Стелаж A1' }),
  )
  expect(print).not.toHaveBeenCalled()
  await user.click(within(picker).getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(print).toHaveBeenCalled())
  expect(printable.buildZoneLabelHtml).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        zoneName: 'Стелаж A1',
        warehouseName: 'Основний склад',
        qrCode: 'ZONE-1',
      }),
    ],
    'uk',
  )
  expect(write).toHaveBeenCalledWith('<html>zones</html>')
  expect(print).toHaveBeenCalled()
})

it('browses locations without row actions or part counts and prints selected shelf labels', async () => {
  const user = userEvent.setup()
  const print = vi.fn()
  vi.spyOn(window, 'open').mockReturnValue({
    document: { write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    print,
    opener: null,
  } as never)
  api.getShelves.mockResolvedValue([
    {
      id: 'shelf-1',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Полиця 1',
      code: 'P1',
      qrCode: 'inventory-shelf:shelf-1',
      isActive: true,
      sectionId: 'section-1',
      sectionName: 'Секція B',
      partCount: 3,
    },
  ])
  renderAt('/app/yard/warehouses/zones/zone-1')
  const sectionGroup = await screen.findByRole('row', {
    name: /Секція B/,
  })
  expect(
    within(sectionGroup).queryByLabelText(/Позицій/),
  ).not.toBeInTheDocument()
  expect(within(sectionGroup).queryByRole('button')).not.toBeInTheDocument()
  expect(api.getSections).toHaveBeenCalledWith(
    'zone-1',
    expect.objectContaining({ includePartCounts: false }),
  )
  await user.click(
    within(sectionGroup).getByRole('link', { name: /^Секція B/ }),
  )
  const table = await screen.findByRole('table', { name: 'Полиці: Секція B' })
  expect(within(table).queryByText('3')).not.toBeInTheDocument()
  expect(within(table).queryByRole('button')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Дії з секцією Секція B' }),
  ).toBeInTheDocument()
  expect(api.getShelves).toHaveBeenCalledWith(
    'zone-1',
    expect.objectContaining({ includePartCounts: false }),
    'section-1',
  )
  expect(
    within(table).getByRole('link', {
      name: 'Переглянути запчастини: Полиця 1',
    }),
  ).toHaveAttribute(
    'href',
    '/app/yard/parts?warehouse=wh-1&zone=zone-1&section=section-1&shelf=shelf-1',
  )
  await user.click(
    screen.getByRole('button', { name: 'Дії з секцією Секція B' }),
  )
  await user.click(
    screen.getByRole('menuitem', { name: 'Друк стікерів полиць' }),
  )
  const picker = await screen.findByRole('region', { name: 'Етикетки полиць' })
  await user.click(
    await within(picker).findByRole('checkbox', { name: 'Обрати: Полиця 1' }),
  )
  await user.click(within(picker).getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(print).toHaveBeenCalled())
  expect(printable.buildZoneLabelHtml).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        qrCode: 'inventory-shelf:shelf-1',
        zoneName: 'Полиця 1',
      }),
    ],
    'uk',
  )
})

it('keeps large section lists compact and opens shelves for one section at a time', async () => {
  const user = userEvent.setup()
  api.getSections.mockResolvedValue([
    {
      id: 'section-1',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Секція B',
      code: 'B',
      isActive: true,
    },
    {
      id: 'section-2',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      name: 'Секція C',
      code: 'C',
      isActive: true,
    },
  ])
  api.getShelves.mockResolvedValue([
    {
      id: 'shelf-1',
      sectionId: 'section-1',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      sectionName: 'Секція B',
      name: 'Полиця B1',
      code: 'B1',
      qrCode: 'QR-B1',
      isActive: true,
    },
    {
      id: 'shelf-2',
      sectionId: 'section-2',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      sectionName: 'Секція C',
      name: 'Полиця C1',
      code: 'C1',
      qrCode: 'QR-C1',
      isActive: true,
    },
  ])
  renderAt('/app/yard/warehouses/zones/zone-1')

  const first = await screen.findByRole('link', { name: 'Секція B, B' })
  const second = screen.getByRole('link', { name: 'Секція C, C' })
  expect(first).toHaveAttribute(
    'href',
    '/app/yard/warehouses/sections/section-1',
  )
  expect(api.getShelves).toHaveBeenCalledTimes(1)
  expect(api.getShelves).toHaveBeenCalledWith(
    'zone-1',
    expect.objectContaining({ includePartCounts: false }),
    undefined,
  )
  expect(first).toHaveAccessibleDescription('Полиць: 1')
  expect(second).toHaveAccessibleDescription('Полиць: 1')
  api.getSection.mockResolvedValue(
    ((await api.getSections()) as InventorySection[])[1],
  )
  await user.click(second)
  expect(
    await screen.findByRole('heading', { name: 'Секція C', level: 1 }),
  ).toBeInTheDocument()
  expect(await screen.findByText('Полиця C1')).toBeInTheDocument()
  expect(screen.queryByText('Полиця B1')).not.toBeInTheDocument()
  expect(api.getShelves).toHaveBeenCalledWith(
    'zone-1',
    expect.anything(),
    'section-2',
  )
})

it('creates a shelf in a side drawer for its section', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/zones/zone-1')

  const sectionGroup = await screen.findByRole('row', {
    name: /Секція B/,
  })
  await user.click(
    within(sectionGroup).getByRole('link', { name: /^Секція B/ }),
  )
  await user.click(await screen.findByRole('button', { name: 'Додати полицю' }))
  const drawer = screen.getByRole('dialog', { name: 'Нова полиця' })
  expect(drawer).toHaveClass('rz-sheet')
  expect(within(drawer).getByText('Секція B')).toBeInTheDocument()

  const name = within(drawer).getByRole('textbox', { name: 'Назва' })
  const code = within(drawer).getByRole('textbox', { name: 'Код' })
  await user.type(name, 'Полиця 2')
  expect(code).toHaveValue('polytsya-2')
  await user.clear(code)
  await user.type(code, 'P2')
  await user.type(name, ' для кузова')
  expect(code).toHaveValue('P2')
  await user.click(within(drawer).getByRole('button', { name: 'Зберегти' }))

  await waitFor(() =>
    expect(api.createShelf).toHaveBeenCalledWith(
      {
        zoneId: 'zone-1',
        sectionId: 'section-1',
        name: 'Полиця 2 для кузова',
        code: 'P2',
      },
      expect.anything(),
    ),
  )
})

it('creates a section inside a zone before adding locations', async () => {
  const user = userEvent.setup()
  const existing = (await api.getSections()) as InventorySection[]
  const created = {
    ...existing[0],
    id: 'section-new',
    name: 'Секція C',
    code: 'sektsiya-c',
  }
  api.createSection.mockImplementation(() => {
    api.getSections.mockResolvedValue([...existing, created])
    api.getSection.mockResolvedValue(created)
    return Promise.resolve(created)
  })
  renderAt('/app/yard/warehouses/zones/zone-1?locationSearch=B')

  await user.click(
    await screen.findByRole('button', { name: /^Додати секцію/ }),
  )
  const drawer = screen.getByRole('dialog', { name: 'Нова секція' })
  await user.type(
    within(drawer).getByRole('textbox', { name: 'Назва' }),
    'Секція C',
  )
  await user.click(within(drawer).getByRole('button', { name: 'Зберегти' }))

  await waitFor(() =>
    expect(api.createSection).toHaveBeenCalledWith(
      { zoneId: 'zone-1', name: 'Секція C', code: 'sektsiya-c' },
      expect.anything(),
    ),
  )
  expect(
    await screen.findByRole('heading', { name: 'Секція C', level: 1 }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'До зони' }))
  expect(
    await screen.findByRole('searchbox', { name: 'Пошук секції' }),
  ).toHaveValue('B')
})

it('creates a zone in a side drawer for its warehouse', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/wh-1')

  await user.click(await screen.findByRole('button', { name: 'Додати зону' }))
  const drawer = screen.getByRole('dialog', { name: 'Нова зона' })
  expect(drawer).toHaveClass('rz-sheet')
  expect(within(drawer).getByText('Основний склад')).toBeInTheDocument()

  await user.type(
    within(drawer).getByRole('textbox', { name: 'Назва' }),
    'Стелаж B2',
  )
  expect(within(drawer).getByRole('textbox', { name: 'Код' })).toHaveValue(
    'stelazh-b2',
  )
  await user.click(within(drawer).getByRole('button', { name: 'Додати зону' }))

  await waitFor(() =>
    expect(api.createZone).toHaveBeenCalledWith(
      { warehouseId: 'wh-1', name: 'Стелаж B2', code: 'stelazh-b2' },
      expect.anything(),
    ),
  )
})

it('keeps the warehouse as a zone overview and opens zone creation there', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/wh-1')
  expect(
    await screen.findByRole('link', { name: 'Стелаж A1' }),
  ).toHaveAttribute('href', '/app/yard/warehouses/zones/zone-1')
  expect(
    screen.queryByRole('region', { name: 'Секції та полиці за зонами' }),
  ).not.toBeInTheDocument()
  expect(api.getSections).not.toHaveBeenCalled()
  expect(api.getShelves).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Додати зону' }))
  expect(screen.getByRole('dialog', { name: 'Нова зона' })).toBeInTheDocument()
})

it('loads only the selected zone and links back to its warehouse', async () => {
  renderAt('/app/yard/warehouses/zones/zone-1')
  expect(
    await screen.findByRole('heading', { name: 'Стелаж A1' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'До складу' })).toHaveAttribute(
    'href',
    '/app/yard/warehouses/wh-1',
  )
  expect(
    screen.queryByRole('combobox', { name: 'Зона складу' }),
  ).not.toBeInTheDocument()
  await screen.findByRole('row', { name: /Секція B/ })
  expect(api.getSections).toHaveBeenCalledWith('zone-1', expect.anything())
  expect(api.getShelves).toHaveBeenCalledTimes(1)
  expect(api.getShelves).toHaveBeenCalledWith(
    'zone-1',
    expect.objectContaining({ includePartCounts: false }),
    undefined,
  )
})

it('opens a physical zone without parts viewing permission', async () => {
  permissions.value.delete('parts.view')
  try {
    renderAt('/app/yard/warehouses/wh-1')
    expect(
      await screen.findByRole('link', { name: 'Стелаж A1' }),
    ).toHaveAttribute('href', '/app/yard/warehouses/zones/zone-1')
  } finally {
    permissions.value.add('parts.view')
  }
})

it('does not expose section creation for the system unassigned zone', async () => {
  api.getZone.mockResolvedValue({
    ...((await api.getZone()) as InventoryZone),
    isSystemUnassigned: true,
    name: 'Без зони',
  })
  api.getZone.mockClear()
  renderAt('/app/yard/warehouses/zones/zone-1')
  await screen.findByRole('heading', { name: 'Без зони' })
  expect(
    screen.queryByRole('button', { name: /Додати секцію/ }),
  ).not.toBeInTheDocument()
  expect(api.getSections).not.toHaveBeenCalled()
})

it('edits a zone in the same side drawer', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/wh-1')

  await user.click(
    await screen.findByRole('button', { name: 'Дії із зоною Стелаж A1' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Редагувати' }))
  const drawer = screen.getByRole('dialog', { name: 'Редагувати зону' })
  expect(drawer).toHaveClass('rz-sheet')
  const name = within(drawer).getByRole('textbox', { name: 'Назва' })
  const code = within(drawer).getByRole('textbox', { name: 'Код' })
  await user.clear(name)
  expect(code).toHaveValue('')
  await user.type(name, 'Стелаж A2')
  expect(code).toHaveValue('stelazh-a2')
  await user.click(within(drawer).getByRole('button', { name: 'Зберегти' }))

  await waitFor(() =>
    expect(api.updateZone).toHaveBeenCalledWith(
      'zone-1',
      { name: 'Стелаж A2', code: 'stelazh-a2', isActive: true },
      expect.anything(),
    ),
  )
})

it('updates an edited warehouse code from its name but keeps a manual code', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/wh-1')

  await user.click(await screen.findByRole('button', { name: 'Редагувати' }))
  const dialog = screen.getByRole('dialog', { name: 'Редагувати склад' })
  const name = within(dialog).getByRole('textbox', { name: 'Назва' })
  const code = within(dialog).getByRole('textbox', { name: 'Код' })
  await user.clear(name)
  expect(code).toHaveValue('')
  await user.type(name, 'Новий склад')
  expect(code).toHaveValue('novyy-sklad')
  await user.clear(code)
  await user.type(code, 'custom')
  await user.type(name, ' 2')
  expect(code).toHaveValue('custom')
})

it('selects a shelf directly from the list before opening its editor', async () => {
  const user = userEvent.setup()
  const shelf = {
    id: 'shelf-1',
    zoneId: 'zone-1',
    zoneName: 'Стелаж A1',
    warehouseId: 'wh-1',
    warehouseName: 'Основний склад',
    name: 'Полиця 1',
    code: 'P1',
    qrCode: 'inventory-shelf:shelf-1',
    isActive: true,
    sectionId: 'section-1',
    sectionName: 'Секція B',
  }
  api.getShelves.mockResolvedValue([
    shelf,
    { ...shelf, id: 'shelf-2', name: 'Полиця 2', code: 'P2' },
    { ...shelf, id: 'other', name: 'Чужа полиця', sectionId: 'other-section' },
  ])
  renderAt('/app/yard/warehouses/sections/section-1')
  await user.click(
    await screen.findByRole('button', { name: 'Дії з секцією Секція B' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Редагувати полицю' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Чужа полиця')).not.toBeInTheDocument()
  await user.type(screen.getByRole('searchbox', { name: 'Пошук полиці' }), 'P2')
  expect(
    screen.queryByRole('button', { name: 'Редагувати полицю: Полиця 1' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Редагувати полицю: Полиця 2' }),
  )
  const editor = screen.getByRole('dialog', { name: 'Редагувати полицю' })
  const name = within(editor).getByRole('textbox', { name: 'Назва' })
  await user.clear(name)
  await user.type(name, 'Фари')
  expect(within(editor).getByRole('textbox', { name: 'Код' })).toHaveValue(
    'fary',
  )
  api.updateShelf.mockRejectedValueOnce(new Error('Save failed'))
  await user.click(within(editor).getByRole('button', { name: 'Зберегти' }))
  expect(await within(editor).findByRole('alert')).toBeInTheDocument()
  expect(name).toHaveValue('Фари')
  await user.click(within(editor).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(api.updateShelf).toHaveBeenLastCalledWith(
    'shelf-2',
    { name: 'Фари', code: 'fary', isActive: true },
    expect.anything(),
  )
})

it('hides shelf rename for users without zone management permission', async () => {
  const user = userEvent.setup()
  permissions.value.delete('inventory.zones.manage')
  try {
    renderAt('/app/yard/warehouses/sections/section-1')
    await screen.findByRole('heading', { name: 'Полиці', level: 2 })
    await user.click(
      screen.getByRole('button', { name: 'Дії з секцією Секція B' }),
    )
    expect(
      screen.queryByRole('menuitem', { name: 'Редагувати полицю' }),
    ).not.toBeInTheDocument()
  } finally {
    permissions.value.add('inventory.zones.manage')
  }
})

it('counts the warehouse stock from the parts module', async () => {
  renderAt('/app/yard/warehouses/wh-1')

  await screen.findByText('Стелаж A1')
  // Both figures come from the parts search, scoped to this warehouse.
  expect(parts.search).toHaveBeenCalledWith(
    {
      warehouseIds: ['wh-1'],
      statuses: ['available', 'reserved'],
      pageSize: 1,
    },
    expect.anything(),
  )
  const stock = screen.getByText('Запчастин на складі').closest('div')
  expect(within(stock as HTMLElement).getByText('20')).toBeInTheDocument()
  expect(screen.queryByText('Розходження')).toBeNull()
  // Stock totals stay above the list; zone rows no longer repeat counts.
  expect(
    within(screen.getByRole('region', { name: 'Зони' })).queryByText('18'),
  ).toBeNull()
})

it('asks for a reason before booking the counted quantity', async () => {
  const user = userEvent.setup()
  api.getSession.mockResolvedValue({ ...session, status: 'review' })
  api.applyAdjustment.mockResolvedValue({})
  renderAt('/app/yard/inventory/sessions/session-1/results')

  await user.click(await screen.findByRole('button', { name: 'Прийняти факт' }))
  const dialog = screen.getByRole('dialog')
  // The reason reaches the session's audit trail, so it is not optional.
  expect(
    within(dialog).getByRole('button', { name: 'Застосувати' }),
  ).toBeDisabled()
  await user.type(
    within(dialog).getByLabelText('Причина'),
    'Знайшли в іншій зоні',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Застосувати' }))

  await waitFor(() => expect(api.applyAdjustment).toHaveBeenCalledTimes(1))
  expect(api.applyAdjustment).toHaveBeenCalledWith(
    'session-1',
    'part-1',
    'Знайшли в іншій зоні',
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('opens warehouse creation in a side drawer without leaving warehouses', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses')
  await user.click(await screen.findByRole('button', { name: 'Додати склад' }))
  const drawer = screen.getByRole('dialog', { name: 'Новий склад' })
  expect(drawer).toHaveClass('rz-sheet')
  await user.type(
    within(drawer).getByRole('textbox', { name: 'Назва' }),
    'Склад Б',
  )
  await user.click(within(drawer).getByRole('button', { name: 'Скасувати' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(api.createWarehouse).not.toHaveBeenCalled()
})

it('saves placement from the drawer and blocks dismissal while saving', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSaved = vi.fn()
  let finish!: () => void
  api.replacePartZones.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  render(
    <MemoryRouter>
      <PartPlacementDrawer
        partId="part-1"
        onClose={onClose}
        onSaved={onSaved}
      />
    </MemoryRouter>,
  )
  const drawer = await screen.findByRole('dialog', {
    name: 'Розміщення на складі',
  })
  expect(drawer).toHaveClass('rz-sheet')
  await user.click(
    await within(drawer).findByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A1/ }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(within(drawer).getByText('Дані запчастини')).toBeVisible()
  expect(
    within(drawer).queryByText(
      'Залишок між зонами не ділиться: запчастина лежить у вибраних зонах цілком, тому кількість тут не редагується.',
    ),
  ).toBeNull()
  expect(parts.history).not.toHaveBeenCalled()
  expect(parts.facets).not.toHaveBeenCalled()

  await user.click(
    within(drawer).getByRole('searchbox', { name: 'Пошук секції' }),
  )
  await user.click(await screen.findByRole('option', { name: /Секція B/ }))
  await user.click(
    within(drawer).getByRole('button', { name: 'Зберегти розміщення' }),
  )
  expect(api.replacePartZones).toHaveBeenCalledWith(
    'part-1',
    ['zone-1'],
    expect.anything(),
    undefined,
    'section-1',
  )
  expect(
    within(drawer).getByRole('button', { name: 'Скасувати' }),
  ).toBeDisabled()
  await user.click(within(drawer).getByRole('button', { name: 'Закрити' }))
  expect(onClose).not.toHaveBeenCalled()
  finish()
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  expect(onClose).toHaveBeenCalledOnce()
})

it.each([false, true])(
  'selects warehouse-only placement inside the zone dropdown (physical zones: %s)',
  async (hasPhysicalZones) => {
    const user = userEvent.setup()
    const existingZones = (await api.getZones()) as InventoryZone[]
    api.getZones.mockResolvedValue([
      ...(hasPhysicalZones ? existingZones : []),
      {
        id: 'system-zone-1',
        warehouseId: 'wh-1',
        warehouseName: 'Основний склад',
        name: 'Без зони',
        code: 'unassigned',
        qrCode: '',
        isSystemUnassigned: true,
        isActive: true,
      },
    ])
    render(
      <MemoryRouter>
        <PartPlacementDrawer
          partId="part-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>,
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Розміщення на складі',
    })
    const warehouseOnlyName = 'Зберегти тільки на рівні складу'
    expect(
      within(dialog).queryByRole('button', { name: warehouseOnlyName }),
    ).not.toBeInTheDocument()
    await user.click(
      await within(dialog).findByRole('searchbox', { name: 'Пошук зони' }),
    )
    await user.click(screen.getByRole('option', { name: warehouseOnlyName }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    if (hasPhysicalZones) {
      await user.click(
        within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
      )
      await user.click(screen.getByRole('option', { name: /Стелаж A1/ }))
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(
        within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
      ).toBeVisible()
      await user.click(
        within(dialog).getByRole('searchbox', { name: 'Пошук секції' }),
      )
      await user.click(screen.getByRole('option', { name: /Секція B/ }))
      await user.click(
        within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
      )
      await user.click(screen.getByRole('option', { name: warehouseOnlyName }))
    }
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
    ).toHaveValue(warehouseOnlyName)
    expect(
      within(dialog).queryByRole('searchbox', { name: 'Пошук секції' }),
    ).not.toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Зберегти розміщення' }),
    )
    await waitFor(() =>
      expect(api.replacePartZones).toHaveBeenCalledWith(
        'part-1',
        ['system-zone-1'],
        expect.anything(),
        undefined,
        undefined,
      ),
    )
  },
)

it('replaces the selected zone in the same warehouse, closes the dropdown and clears its section', async () => {
  const user = userEvent.setup()
  const existingZones = (await api.getZones()) as InventoryZone[]
  api.getZones.mockResolvedValue([
    ...existingZones,
    { ...existingZones[0], id: 'zone-2', name: 'Стелаж A2', code: 'A2' },
  ])
  render(
    <MemoryRouter>
      <PartPlacementDrawer
        partId="part-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </MemoryRouter>,
  )
  const dialog = await screen.findByRole('dialog', {
    name: 'Розміщення на складі',
  })
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A1/ }))
  await user.click(
    within(dialog).getByRole('searchbox', { name: 'Пошук секції' }),
  )
  await user.click(screen.getByRole('option', { name: /Секція B/ }))
  await user.click(
    within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A2/ }))

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  const trigger = within(dialog).getByRole('searchbox', { name: 'Пошук зони' })
  expect(trigger).toHaveFocus()
  expect(trigger).toHaveValue('Стелаж A2')
  expect(within(dialog).queryByText('Зон вибрано: 2')).not.toBeInTheDocument()
  await user.click(trigger)
  expect(screen.getByRole('listbox')).not.toHaveAttribute(
    'aria-multiselectable',
    'true',
  )
  expect(screen.getByRole('option', { name: /Стелаж A1/ })).toHaveAttribute(
    'aria-selected',
    'false',
  )
  expect(screen.getByRole('option', { name: /Стелаж A2/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A2/ }))
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти розміщення' }),
  )
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-2'],
      expect.anything(),
      undefined,
      undefined,
    ),
  )
})

it('uses a newly created zone as the only placement in the drawer', async () => {
  const user = userEvent.setup()
  const existingZones = (await api.getZones()) as InventoryZone[]
  const createdZone = {
    ...existingZones[0],
    id: 'zone-new',
    name: 'Нова зона',
    code: 'nova-zona',
  }
  api.createZone.mockResolvedValue(createdZone)
  render(
    <MemoryRouter>
      <PartPlacementDrawer
        partId="part-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </MemoryRouter>,
  )
  const dialog = await screen.findByRole('dialog', {
    name: 'Розміщення на складі',
  })
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A1/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Додати зону' }))
  const editor = screen.getByRole('dialog', { name: 'Нова зона' })
  await user.type(
    within(editor).getByRole('textbox', { name: 'Назва' }),
    'Нова зона',
  )
  api.getZones.mockResolvedValue([...existingZones, createdZone])
  await user.click(within(editor).getByRole('button', { name: 'Додати зону' }))
  expect(
    await within(dialog).findByRole('searchbox', { name: 'Пошук зони' }),
  ).toHaveValue('Нова зона')
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти розміщення' }),
  )
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-new'],
      expect.anything(),
      undefined,
      undefined,
    ),
  )
})

it('replaces the previous zone across warehouses in the compact placement drawer', async () => {
  const user = userEvent.setup()
  const existingZones = (await api.getZones()) as InventoryZone[]
  const existingWarehouses = (await api.getWarehouses()) as Warehouse[]
  api.getZones.mockClear()
  api.getWarehouses.mockClear()
  api.getWarehouses.mockResolvedValue([
    ...existingWarehouses,
    {
      ...existingWarehouses[0],
      id: 'wh-2',
      name: 'Другий склад',
      code: 'second',
    },
  ])
  api.getZones.mockResolvedValue([
    ...existingZones,
    {
      ...existingZones[0],
      id: 'zone-2',
      warehouseId: 'wh-2',
      warehouseName: 'Другий склад',
      name: 'Стелаж B1',
      code: 'B1',
    },
  ])
  render(
    <MemoryRouter>
      <PartPlacementDrawer
        partId="part-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </MemoryRouter>,
  )
  const dialog = await screen.findByRole('dialog', {
    name: 'Розміщення на складі',
  })
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A1/ }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await user.click(
    within(dialog).getByRole('searchbox', { name: 'Пошук складу' }),
  )
  await user.click(screen.getByRole('option', { name: /Другий склад/ }))
  expect(
    within(dialog).getByRole('button', { name: 'Зберегти розміщення' }),
  ).toBeDisabled()
  await user.click(
    within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж B1/ }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти розміщення' }),
  )
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-2'],
      expect.anything(),
      undefined,
      undefined,
    ),
  )
})

it('blocks saving from the part placement editor when the balance is zero', async () => {
  const user = userEvent.setup()
  parts.get.mockResolvedValue({
    id: 'part-1',
    name: 'Крило',
    qrCode: 'QR-1',
    unit: 'шт',
    quantityTotal: 0,
    status: 'sold',
  })
  render(
    <MemoryRouter>
      <PartPlacementDrawer
        partId="part-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </MemoryRouter>,
  )
  const dialog = await screen.findByRole('dialog', {
    name: 'Розміщення на складі',
  })
  expect(
    await within(dialog).findByText(
      'Немає залишку на складі. Розміщення недоступне.',
    ),
  ).toBeVisible()
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A1/ }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(
    within(dialog).getByRole('button', { name: 'Зберегти розміщення' }),
  ).toBeDisabled()
  expect(api.replacePartZones).not.toHaveBeenCalled()
})

it('keeps the placement drawer selection on failure and retries successfully', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSaved = vi.fn()
  api.replacePartZones
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([])
  render(
    <MemoryRouter>
      <PartPlacementDrawer
        partId="part-1"
        onClose={onClose}
        onSaved={onSaved}
      />
    </MemoryRouter>,
  )
  const drawer = screen.getByRole('dialog', { name: 'Розміщення на складі' })
  await user.click(
    await within(drawer).findByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A1/ }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await user.click(
    within(drawer).getByRole('button', { name: 'Зберегти розміщення' }),
  )
  expect(await within(drawer).findByRole('alert')).toBeInTheDocument()
  expect(
    within(drawer).getByRole('searchbox', { name: 'Пошук зони' }),
  ).toHaveValue('Стелаж A1')
  expect(onClose).not.toHaveBeenCalled()
  await user.click(
    within(drawer).getByRole('button', { name: 'Зберегти розміщення' }),
  )
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
})

it('creates a warehouse from its drawer', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses')
  await user.click(await screen.findByRole('button', { name: 'Додати склад' }))
  const drawer = screen.getByRole('dialog', { name: 'Новий склад' })
  await user.type(
    within(drawer).getByRole('textbox', { name: 'Назва' }),
    'Склад Б',
  )
  await user.click(within(drawer).getByRole('button', { name: 'Додати склад' }))
  await waitFor(() =>
    expect(api.createWarehouse).toHaveBeenCalledWith(
      { name: 'Склад Б', code: 'sklad-b' },
      expect.anything(),
    ),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
})

it('searches 100 sections and 100 shelves inside the placement drawer and submits their IDs', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const sections = Array.from({ length: 100 }, (_, index) => ({
    id: `s${index + 1}`,
    name: `Секція ${index + 1}`,
    code: `S${index + 1}`,
    zoneId: 'zone-1',
    zoneName: 'Стелаж A1',
    warehouseId: 'wh-1',
    warehouseName: 'Основний склад',
    qrCode: `section:${index}`,
    isActive: true,
  }))
  api.getSections.mockResolvedValue(sections)
  api.getShelves.mockResolvedValue(
    Array.from({ length: 100 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Полиця ${index + 1}`,
      code: `P${index + 1}`,
      sectionId: 's100',
      sectionName: 'Секція 100',
      zoneId: 'zone-1',
      zoneName: 'Стелаж A1',
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      qrCode: `shelf:${index}`,
      isActive: true,
    })),
  )
  render(
    <MemoryRouter>
      <PartPlacementDrawer
        partId="part-1"
        onClose={onClose}
        onSaved={onSaved}
      />
    </MemoryRouter>,
  )
  const drawer = screen.getByRole('dialog', { name: 'Розміщення на складі' })
  await user.click(
    await within(drawer).findByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(screen.getByRole('option', { name: /Стелаж A1/ }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await user.click(
    within(drawer).getByRole('searchbox', { name: 'Пошук секції' }),
  )
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук секції' }),
    's100',
  )
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
  expect(drawer).toBeInTheDocument()
  await user.click(
    within(drawer).getByRole('searchbox', { name: 'Пошук секції' }),
  )
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук секції' }),
    's100',
  )
  await user.click(screen.getByRole('option', { name: /Секція 100/ }))
  await user.click(
    within(drawer).getByRole('searchbox', { name: 'Пошук полиці' }),
  )
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук полиці' }),
    'p100',
  )
  expect(screen.getAllByRole('option')).toHaveLength(2)
  await user.keyboard('{Enter}')
  await user.click(
    within(drawer).getByRole('button', { name: 'Зберегти розміщення' }),
  )
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  expect(api.replacePartZones).toHaveBeenCalledWith(
    'part-1',
    ['zone-1'],
    expect.anything(),
    'p100',
    's100',
  )
})

it('opens one section and requests only shelves belonging to it', async () => {
  renderAt('/app/yard/warehouses/sections/section-1')
  expect(
    await screen.findByRole('heading', { name: 'Секція B', level: 1 }),
  ).toBeInTheDocument()
  expect(api.getSection).toHaveBeenCalledWith('section-1', expect.anything())
  await screen.findByRole('heading', { name: 'Полиці', level: 2 })
  expect(api.getShelves).toHaveBeenCalledWith(
    'zone-1',
    expect.anything(),
    'section-1',
  )
  expect(api.getSections).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: 'До зони' })).toHaveAttribute(
    'href',
    '/app/yard/warehouses/zones/zone-1',
  )
})

it('keeps zone navigation without a direct-parts row or drawer list', async () => {
  renderAt('/app/yard/warehouses/zones/zone-1')
  expect(
    await screen.findByRole('link', { name: 'Усі запчастини зони' }),
  ).toHaveAttribute('href', '/app/yard/parts?warehouse=wh-1&zone=zone-1')
  expect(screen.queryByRole('link', { name: /У зоні без секції/ })).toBeNull()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(parts.search).not.toHaveBeenCalledWith(
    expect.objectContaining({ pageSize: 10 }),
    expect.anything(),
  )
})

it('links all section parts while retaining the shelf navigation', async () => {
  renderAt('/app/yard/warehouses/sections/section-1')
  expect(
    await screen.findByRole('link', { name: 'Усі запчастини секції' }),
  ).toHaveAttribute(
    'href',
    '/app/yard/parts?warehouse=wh-1&zone=zone-1&section=section-1',
  )
})

it.each([
  ['/app/yard/warehouses/zones/zone-1', 'У зоні без секції'],
  ['/app/yard/warehouses/sections/section-1', 'У секції без полиці'],
])(
  'omits the direct-parts row without fetching its count at %s',
  async (path, name) => {
    renderAt(path)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: new RegExp(name) })).toBeNull()
    expect(parts.search).not.toHaveBeenCalled()
  },
)

it('prints shelf labels and keeps section editing and archiving in its detail menu', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/sections/section-1')
  await user.click(
    await screen.findByRole('button', { name: 'Дії з секцією Секція B' }),
  )
  expect(
    screen.queryByRole('menuitem', { name: 'QR-код' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('menuitem', { name: 'Друк стікерів полиць' }),
  )
  const labels = await screen.findByRole('region', { name: 'Етикетки полиць' })
  await user.click(
    within(labels).getByRole('button', { name: 'Завершити вибір' }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Дії з секцією Секція B' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Редагувати секцію' }))
  const editor = screen.getByRole('dialog', { name: 'Редагувати секцію' })
  const name = within(editor).getByRole('textbox', { name: 'Назва' })
  await user.clear(name)
  await user.type(name, 'Кузов')
  await user.click(within(editor).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() =>
    expect(api.updateSection).toHaveBeenCalledWith(
      'section-1',
      { name: 'Кузов', code: 'kuzov', isActive: true },
      expect.anything(),
    ),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await user.click(
    screen.getByRole('button', { name: 'Дії з секцією Секція B' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Архівувати секцію' }))
  const confirm = screen.getByRole('dialog', { name: 'Архівувати секцію' })
  await user.click(
    within(confirm).getByRole('button', { name: 'Архівувати секцію' }),
  )
  await waitFor(() =>
    expect(api.archiveSection).toHaveBeenCalledWith(
      'section-1',
      expect.anything(),
    ),
  )
})

it('shows the zone as one section list with a header hint and opens the selected section', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/zones/zone-1?locationSearch=B')
  const heading = await screen.findByRole('heading', {
    level: 2,
    name: 'Секції',
  })
  const card = heading.closest('section')!
  expect(
    within(card).getByText('Виберіть секцію, щоб переглянути її полиці'),
  ).toBeVisible()
  expect(screen.queryByRole('heading', { level: 2, name: 'Полиці' })).toBeNull()
  expect(
    within(card).getByRole('button', { name: 'Додати секцію' }),
  ).toBeVisible()
  expect(
    within(card).getByRole('button', { name: 'Дії із зоною Стелаж A1' }),
  ).toBeVisible()
  await user.click(within(card).getByRole('link', { name: 'Секція B, B' }))
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Секція B' }),
  ).toBeVisible()
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Полиці' }),
  ).toBeVisible()
  await user.click(screen.getByRole('link', { name: 'До зони' }))
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Стелаж A1' }),
  ).toBeVisible()
  expect(screen.getByRole('searchbox', { name: 'Пошук секції' })).toHaveValue(
    'B',
  )
})

it('counts only active shelves in each section, including empty sections', async () => {
  const user = userEvent.setup()
  const section = await (api.getSection(
    'section-1',
  ) as Promise<InventorySection>)
  api.getSections.mockResolvedValue([
    section,
    { ...section, id: 'empty-section', name: 'Порожня секція', code: 'empty' },
  ])
  const shelf = {
    id: 'shelf-1',
    sectionId: 'section-1',
    zoneId: 'zone-1',
    warehouseId: 'wh-1',
    name: 'Полиця',
    code: 'P1',
    isActive: true,
  }
  api.getShelves.mockResolvedValue([
    shelf,
    { ...shelf, id: 'shelf-2' },
    { ...shelf, id: 'archived', isActive: false },
    { ...shelf, id: 'wrong-zone', zoneId: 'other-zone' },
    { ...shelf, id: 'wrong-warehouse', warehouseId: 'other-warehouse' },
  ])
  renderAt('/app/yard/warehouses/zones/zone-1')
  expect(
    await screen.findByRole('link', { name: 'Секція B, B' }),
  ).toHaveAccessibleDescription('Полиць: 2')
  expect(
    screen.getByRole('link', { name: 'Порожня секція, empty' }),
  ).toHaveAccessibleDescription('Полиць: 0')
  await user.type(screen.getByRole('searchbox', { name: 'Пошук секції' }), 'B')
  expect(
    screen.getByRole('link', { name: 'Секція B, B' }),
  ).toHaveAccessibleDescription('Полиць: 2')
})

it('opens section label printing only through the zone menu', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/zones/zone-1')
  await screen.findByRole('row', { name: /Секція B/ })
  expect(
    screen.queryByRole('button', { name: 'Етикетки секцій' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Дії із зоною Стелаж A1' }),
  )
  await user.click(
    screen.getByRole('menuitem', { name: 'Друк стікерів секцій' }),
  )
  expect(
    await screen.findByRole('region', { name: 'Етикетки секцій' }),
  ).toBeInTheDocument()
})

it('can cancel shelf editing mode and return to opening parts', async () => {
  const user = userEvent.setup()
  api.getShelves.mockResolvedValue([
    {
      id: 'shelf-1',
      sectionId: 'section-1',
      zoneId: 'zone-1',
      warehouseId: 'wh-1',
      name: 'Полиця 1',
      code: 'P1',
      isActive: true,
    },
  ])
  renderAt('/app/yard/warehouses/sections/section-1')
  await user.click(
    await screen.findByRole('button', { name: 'Дії з секцією Секція B' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Редагувати полицю' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Редагувати полицю: Полиця 1' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(
    screen.queryByRole('button', { name: 'Редагувати полицю: Полиця 1' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Переглянути запчастини: Полиця 1' }),
  ).toHaveAttribute(
    'href',
    '/app/yard/parts?warehouse=wh-1&zone=zone-1&section=section-1&shelf=shelf-1',
  )
})

it.each([
  [
    '/app/yard/warehouses/wh-1',
    'Дії із зонами',
    'Друк стікерів зон',
    'Етикетки зон',
    'Основний склад',
  ],
  [
    '/app/yard/warehouses/zones/zone-1',
    'Дії із зоною Стелаж A1',
    'Друк стікерів секцій',
    'Етикетки секцій',
    'Стелаж A1',
  ],
  [
    '/app/yard/warehouses/sections/section-1',
    'Дії з секцією Секція B',
    'Друк стікерів полиць',
    'Етикетки полиць',
    'Секція B',
  ],
])(
  'selects and prints inline in its existing collection at %s',
  async (path, menu, print, collection, title) => {
    const user = userEvent.setup()
    renderAt(path)
    const heading = await screen.findByRole('heading', {
      name: title,
      level: 1,
    })
    await user.click(await screen.findByRole('button', { name: menu }))
    await user.click(screen.getByRole('menuitem', { name: print }))
    const workspace = await screen.findByRole('region', { name: collection })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBe(heading)
    expect(heading).toBeVisible()
    expect(screen.getByTestId('inventory-url')).toHaveTextContent(
      path + '?labels=1',
    )
    expect(
      within(workspace).getByRole('searchbox', { name: 'Назва або код' }),
    ).toBeInTheDocument()
    await user.click(
      within(workspace).getByRole('button', { name: 'Завершити вибір' }),
    )
    expect(
      screen.queryByRole('region', { name: collection }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBe(heading)
    expect(screen.getByTestId('inventory-url')).toHaveTextContent(path)
    expect(screen.getByTestId('inventory-url')).not.toHaveTextContent(
      'labels=1',
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: menu })).toHaveFocus(),
    )
  },
)

it('restores the section browse filter after closing inline selection', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/zones/zone-1?locationSearch=B')
  await user.click(
    await screen.findByRole('button', { name: 'Дії із зоною Стелаж A1' }),
  )
  await user.click(
    screen.getByRole('menuitem', { name: 'Друк стікерів секцій' }),
  )
  const workspace = await screen.findByRole('region', {
    name: 'Етикетки секцій',
  })
  expect(within(workspace).getByRole('searchbox')).toHaveValue('B')
  await user.click(
    within(workspace).getByRole('button', { name: 'Завершити вибір' }),
  )
  expect(screen.getByRole('searchbox', { name: 'Пошук секції' })).toHaveValue(
    'B',
  )
  expect(api.getZone).toHaveBeenCalledTimes(1)
})

it.each(['missing-section', 'archived-section', 'missing-warehouse'])(
  'clears a legacy saved queue even when its parent is %s',
  async (scenario) => {
    const { labelQueueKey, createLabelQueue, writeLabelQueue, readLabelQueue } =
      await import('./location-label-queue')
    const key = labelQueueKey('user-1', 'tenant-1')
    const warehouse = scenario === 'missing-warehouse'
    writeLabelQueue(
      key,
      createLabelQueue(
        {
          kind: warehouse ? 'zone' : 'shelf',
          parentId: warehouse ? 'wh-1' : 'section-1',
          parentName: warehouse ? 'Основний склад' : 'Секція B',
        },
        ['gone'],
      ),
    )
    if (warehouse) api.getWarehouse.mockRejectedValue(new Error('gone'))
    else if (scenario === 'missing-section')
      api.getSection.mockRejectedValue(new Error('gone'))
    else {
      const section = (await api.getSection()) as InventorySection
      api.getSection.mockResolvedValue({ ...section, isActive: false })
    }
    renderAt(
      warehouse
        ? '/app/yard/warehouses/wh-1?labels=1'
        : '/app/yard/warehouses/sections/section-1?labels=1',
    )
    await waitFor(() => expect(readLabelQueue(key)).toBeNull())
  },
)

it('opens warehouses separately from stocktake sessions', async () => {
  renderAt('/app/yard/warehouses')
  const warehouses = await screen.findByRole('region', { name: 'Склади' })
  expect(
    screen.getByRole('heading', { level: 1, name: 'Склади' }),
  ).toBeVisible()
  expect(
    within(warehouses).getByRole('link', { name: /Основний склад/ }),
  ).toHaveAttribute('href', '/app/yard/warehouses/wh-1')
  expect(
    screen.queryByRole('region', { name: 'Сесії інвентаризації' }),
  ).toBeNull()
  expect(screen.queryByRole('link', { name: 'Нова сесія' })).toBeNull()
})

it('shows warehouse stock figures with a direct opening action', async () => {
  parts.facets.mockResolvedValue({
    warehouses: [{ id: 'wh-1', name: 'Основний склад', count: 1378 }],
  })
  renderAt('/app/yard/warehouses')
  const warehouse = await screen.findByRole('link', {
    name: 'Відкрити склад Основний склад',
  })
  expect(
    within(warehouse.closest('tr')!).getAllByRole('cell')[0],
  ).toHaveTextContent(/1\s378/)
  expect(
    within(warehouse.closest('tr')!).getAllByRole('cell')[1],
  ).toHaveTextContent('4')
  expect(warehouse).toHaveAttribute('href', '/app/yard/warehouses/wh-1')
})

it('counts unique parts across warehouses instead of adding their facet counts', async () => {
  api.getWarehouses.mockResolvedValue([
    {
      id: 'wh-1',
      name: 'Основний склад',
      code: 'main',
      isSystemDefault: true,
      isActive: true,
      zoneCount: 2,
    },
    {
      id: 'wh-2',
      name: 'Другий склад',
      code: 'second',
      isSystemDefault: false,
      isActive: false,
      zoneCount: 1,
    },
  ])
  parts.facets.mockResolvedValue({
    warehouses: [
      { id: 'wh-1', name: 'Основний склад', count: 20 },
      { id: 'wh-2', name: 'Другий склад', count: 20 },
    ],
  })
  parts.search.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 1,
    total: 25,
    totalPages: 25,
  })
  renderAt('/app/yard/warehouses')
  await screen.findByRole('heading', { level: 1, name: 'Склади' })
  const stock = screen.getByText('Запчастин на складах').closest('div')
  expect(within(stock as HTMLElement).getByText('25')).toBeVisible()
  expect(screen.getByText('Активних: 1 · архівних: 1')).toBeVisible()
  expect(parts.search).toHaveBeenCalledWith(
    {
      warehouseIds: ['wh-1', 'wh-2'],
      statuses: ['available', 'reserved'],
      pageSize: 1,
    },
    expect.anything(),
  )
})

it.each([
  ['/app/yard/warehouses', 'Запчастин на складах', 'warehouse'],
  ['/app/yard/warehouses/wh-1', 'Запчастин на складі', 'zone'],
] as const)(
  'counts only stock positions on %s',
  async (path, label, dimension) => {
    parts.search.mockImplementation((request: { statuses?: string[] }) =>
      Promise.resolve({
        items: [],
        total:
          request.statuses?.includes('available') &&
          request.statuses.includes('reserved')
            ? 7
            : 20,
      }),
    )
    parts.facets.mockImplementation((request: { statuses?: string[] }) =>
      Promise.resolve({
        warehouses: [
          {
            id: 'wh-1',
            name: 'Основний склад',
            count: request.statuses?.length ? 7 : 20,
          },
        ],
        zones: [
          {
            id: 'zone-1',
            name: 'Стелаж A1',
            count: request.statuses?.length ? 5 : 18,
          },
        ],
      }),
    )
    renderAt(path)
    await screen.findByRole('heading', {
      level: 1,
      name: path.endsWith('wh-1') ? 'Основний склад' : 'Склади',
    })
    const stat = screen.getByText(label).closest('div')!
    expect(within(stat).getByText('7')).toBeVisible()
    expect(parts.facets).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ['available', 'reserved'] }),
      [dimension],
      expect.anything(),
    )
    expect(parts.search).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ['available', 'reserved'],
        pageSize: 1,
      }),
      expect.anything(),
    )
    if (path.endsWith('wh-1')) {
      expect(screen.getAllByText(/2 без зони/).length).toBe(2)
      expect(screen.getByText(/7 позицій/)).toBeVisible()
    } else {
      expect(
        screen
          .getByRole('link', { name: 'Відкрити склад Основний склад' })
          .closest('tr'),
      ).toHaveTextContent('7')
    }
  },
)

it('keeps the warehouse list usable when the overview stock total is unavailable', async () => {
  parts.search.mockRejectedValue(new Error('unavailable'))
  renderAt('/app/yard/warehouses')
  expect(
    await screen.findByRole('link', { name: 'Відкрити склад Основний склад' }),
  ).toBeVisible()
  const stock = screen.getByText('Запчастин на складах').closest('div')
  expect(within(stock as HTMLElement).getByText('—')).toBeVisible()
  expect(
    within(stock as HTMLElement).getByText('залишки недоступні'),
  ).toBeVisible()
})

it.each([
  ['/app/yard/warehouses', 'facets'],
  ['/app/yard/warehouses', 'search'],
  ['/app/yard/warehouses/wh-1', 'facets'],
  ['/app/yard/warehouses/wh-1', 'search'],
] as const)(
  'shows a retriable stock error on %s when %s fails, keeping locations visible',
  async (path, source) => {
    const user = userEvent.setup()
    parts.facets.mockResolvedValue({
      warehouses: [{ id: 'wh-1', count: 17 }],
      zones: [{ id: 'zone-1', count: 17 }],
    })
    parts.search.mockResolvedValue({
      items: [],
      total: 17,
      page: 1,
      pageSize: 1,
      totalPages: 17,
    })
    parts[source].mockRejectedValueOnce(new Error('Network unavailable'))
    renderAt(path)

    const message =
      'Не вдалося завантажити статистику запчастин. Склади та місця залишаються доступними.'
    expect(await screen.findByText(message)).toBeVisible()
    if (path.endsWith('wh-1')) {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Основний склад' }),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: /Стелаж A1/ })).toBeVisible()
      expect(
        screen.queryByText('потрібне право «parts.view»'),
      ).not.toBeInTheDocument()
    } else {
      expect(
        screen.getByRole('link', { name: 'Відкрити склад Основний склад' }),
      ).toBeVisible()
    }
    await user.click(screen.getByRole('button', { name: 'Повторити' }))
    await waitFor(() =>
      expect(screen.queryByText(message)).not.toBeInTheDocument(),
    )
    expect(parts[source]).toHaveBeenCalledTimes(2)
    expect(screen.getAllByText('17').length).toBeGreaterThan(0)
  },
)

it('retains known statistics when a retry also fails', async () => {
  const user = userEvent.setup()
  parts.facets
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockRejectedValueOnce(new Error('Still unavailable'))
  parts.search
    .mockResolvedValueOnce({ items: [], total: 17 })
    .mockRejectedValueOnce(new Error('Unavailable'))
  renderAt('/app/yard/warehouses')
  const message =
    'Не вдалося завантажити статистику запчастин. Склади та місця залишаються доступними.'
  await screen.findByText(message)
  const stock = screen.getByText('Запчастин на складах').closest('div')!
  expect(within(stock).getByText('17')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(parts.search).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Повторити' })).toBeEnabled(),
  )
  expect(within(stock).getByText('17')).toBeVisible()
  expect(screen.getByText(message)).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Відкрити склад Основний склад' }),
  ).toBeVisible()
})

it('updates the warehouse directory on a partial retry while keeping the known stock total', async () => {
  const user = userEvent.setup()
  const initial = (await api.getWarehouses()) as Warehouse[]
  api.getWarehouses.mockClear()
  api.getWarehouses.mockResolvedValueOnce(initial).mockResolvedValue([
    ...initial,
    {
      ...initial[0],
      id: 'wh-new',
      name: 'Новий склад',
      code: 'new',
      isSystemDefault: false,
    },
  ])
  parts.facets.mockRejectedValue(new Error('Unavailable'))
  parts.search
    .mockResolvedValueOnce({ items: [], total: 17 })
    .mockRejectedValue(new Error('Offline'))
  renderAt('/app/yard/warehouses')
  const message =
    'Не вдалося завантажити статистику запчастин. Склади та місця залишаються доступними.'
  await screen.findByText(message)
  await user.click(screen.getByRole('button', { name: 'Повторити' }))
  expect(
    await screen.findByRole('link', { name: 'Відкрити склад Новий склад' }),
  ).toBeVisible()
  const stat = screen.getByText('Запчастин на складах').closest('div')!
  expect(within(stat).getByText('17')).toBeVisible()
  expect(screen.getByText(message)).toBeVisible()
})

it('keeps stock statistics after creating a zone when its statistics reload fails', async () => {
  const user = userEvent.setup()
  parts.facets.mockResolvedValue({ zones: [{ id: 'zone-1', count: 17 }] })
  parts.search.mockResolvedValue({ items: [], total: 17 })
  renderAt('/app/yard/warehouses/wh-1')
  await screen.findByRole('heading', { level: 1, name: 'Основний склад' })
  const stat = () => screen.getByText('Запчастин на складі').closest('div')!
  expect(within(stat()).getByText('17')).toBeVisible()
  parts.facets.mockRejectedValue(new Error('Offline'))
  await user.click(screen.getByRole('button', { name: 'Додати зону' }))
  const form = await screen.findByRole('dialog', { name: 'Нова зона' })
  await user.type(
    within(form).getByRole('textbox', { name: 'Назва' }),
    'Новий стелаж',
  )
  await user.click(within(form).getByRole('button', { name: 'Додати зону' }))
  await screen.findByText(
    'Не вдалося завантажити статистику запчастин. Склади та місця залишаються доступними.',
  )
  expect(within(stat()).getByText('17')).toBeVisible()
})

it('shows an archive conflict inside the zone confirmation', async () => {
  const user = userEvent.setup()
  api.archiveZone.mockRejectedValueOnce({
    kind: 'conflict',
    code: 'INVENTORY_ZONE_IN_USE',
    message: 'Спочатку перемістіть усі запчастини із зони.',
  })
  renderAt('/app/yard/warehouses/wh-1')
  await screen.findByRole('heading', { level: 1, name: 'Основний склад' })
  await user.click(
    screen.getByRole('button', { name: 'Дії із зоною Стелаж A1' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Архівувати' }))
  const dialog = screen.getByRole('dialog', { name: 'Архівувати зону?' })
  await user.click(
    within(dialog).getByRole('button', { name: 'Архівувати зону' }),
  )
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Спочатку перемістіть усі запчастини до іншого місця. Після цього зону можна архівувати або деактивувати.',
  )
})

it('shows an archive conflict inside the confirmation and leaves the warehouse open', async () => {
  const user = userEvent.setup()
  api.archiveWarehouse.mockRejectedValueOnce({
    kind: 'conflict',
    code: 'WAREHOUSE_IN_USE',
    message: 'Спочатку перемістіть усі запчастини зі складу.',
  })
  renderAt('/app/yard/warehouses/wh-1')
  await screen.findByRole('heading', { level: 1, name: 'Основний склад' })
  await user.click(screen.getByRole('button', { name: 'Інші дії зі складом' }))
  await user.click(screen.getByRole('menuitem', { name: 'Архівувати склад' }))
  const dialog = screen.getByRole('dialog', { name: 'Архівувати склад?' })
  await user.click(
    within(dialog).getByRole('button', { name: 'Архівувати склад' }),
  )
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Спочатку перемістіть усі запчастини, включно з «Без зони», до іншого складу. Після цього склад можна архівувати або деактивувати.',
  )
  expect(screen.getByTestId('inventory-url')).toHaveTextContent(
    '/app/yard/warehouses/wh-1',
  )
})

it('searches warehouse codes and resets the current page without losing other parameters', async () => {
  const user = userEvent.setup()
  api.getWarehouses.mockResolvedValue(
    Array.from({ length: 12 }, (_, index) => ({
      id: `wh-${index + 1}`,
      name: `Склад ${index + 1}`,
      code: `WH${index + 1}`,
      isActive: true,
      isSystemDefault: index === 0,
      zoneCount: 2,
    })),
  )
  renderAt('/app/yard/warehouses?locationPage=2&keep=1')
  expect(
    await screen.findByRole('link', { name: 'Відкрити склад Склад 11' }),
  ).toBeVisible()
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук складу' }),
    'WH2',
  )
  expect(
    screen.getByRole('link', { name: 'Відкрити склад Склад 2' }),
  ).toHaveAttribute('href', '/app/yard/warehouses/wh-2')
  expect(
    screen.queryByRole('link', { name: 'Відкрити склад Склад 11' }),
  ).toBeNull()
  expect(screen.getByTestId('inventory-url')).toHaveTextContent('keep=1')
  expect(screen.getByTestId('inventory-url')).not.toHaveTextContent(
    'locationPage',
  )
})

it('distinguishes warehouse search with no matches from an empty warehouse directory', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses')
  await screen.findByRole('heading', { level: 1, name: 'Склади' })
  const search = screen.getByRole('searchbox', { name: 'Пошук складу' })
  await user.type(search, 'невідомий')
  expect(
    screen.getByText('Складів за цією назвою або кодом не знайдено.'),
  ).toBeVisible()
  expect(screen.queryByText('Складів ще немає')).toBeNull()
  expect(screen.getByRole('button', { name: 'Додати склад' })).toBeVisible()
  await user.clear(search)
  expect(
    screen.getByRole('link', { name: 'Відкрити склад Основний склад' }),
  ).toBeVisible()
})

it('shows an empty warehouse as zero parts in the warehouse directory', async () => {
  renderAt('/app/yard/warehouses')
  const warehouse = await screen.findByRole('link', {
    name: 'Відкрити склад Основний склад',
  })
  expect(
    within(warehouse.closest('tr')!).getAllByRole('cell')[0],
  ).toHaveTextContent('0')
  expect(
    within(warehouse.closest('tr')!).getAllByRole('cell')[1],
  ).toHaveTextContent('4')
  expect(warehouse).toHaveAttribute('href', '/app/yard/warehouses/wh-1')
})

it('keeps warehouse navigation available when stock figures fail', async () => {
  parts.facets.mockRejectedValue(new Error('unavailable'))
  renderAt('/app/yard/warehouses')
  const warehouse = await screen.findByRole('link', {
    name: 'Відкрити склад Основний склад',
  })
  expect(warehouse).toHaveAttribute('href', '/app/yard/warehouses/wh-1')
  expect(
    within(warehouse.closest('tr')!).getAllByRole('cell')[0],
  ).toHaveTextContent('залишки недоступні')
  expect(
    within(warehouse.closest('tr')!).getAllByRole('cell')[1],
  ).toHaveTextContent('4')
})

it('keeps the warehouse directory available without stock or management permissions', async () => {
  permissions.value.delete('parts.view')
  permissions.value.delete('inventory.zones.manage')
  try {
    renderAt('/app/yard/warehouses')
    const warehouse = await screen.findByRole('link', {
      name: 'Відкрити склад Основний склад',
    })
    expect(
      within(warehouse.closest('tr')!).getByText('залишки недоступні'),
    ).toBeVisible()
    expect(parts.facets).not.toHaveBeenCalled()
    expect(parts.search).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Додати склад' })).toBeNull()
  } finally {
    permissions.value.add('parts.view')
    permissions.value.add('inventory.zones.manage')
  }
})

it('keeps stocktake usable when the warehouse list is unavailable', async () => {
  api.getWarehouses.mockRejectedValue(new Error('unavailable'))
  renderAt('/app/yard/inventory')
  expect(await screen.findByText('INV-001')).toBeVisible()
  expect(api.getWarehouses).not.toHaveBeenCalled()
  expect(parts.facets).not.toHaveBeenCalled()
})

it.each([
  ['warehouses/wh-1', 'wh-1'],
  ['zones/zone-1', 'zones/zone-1'],
  ['sections/section-1', 'sections/section-1'],
])(
  'redirects legacy %s links and preserves label parameters',
  async (legacy, canonical) => {
    renderAt(`/app/yard/inventory/${legacy}?labels=1#queue`)
    await waitFor(() =>
      expect(screen.getByTestId('inventory-url')).toHaveTextContent(
        `/app/yard/warehouses/${canonical}?labels=1#queue`,
      ),
    )
  },
)

it('returns from a warehouse to the warehouse list', async () => {
  renderAt('/app/yard/warehouses/wh-1')
  expect(
    await screen.findByRole('link', { name: 'До складів' }),
  ).toHaveAttribute('href', '/app/yard/warehouses')
})

it('respects an explicitly selected warehouse when creating a stocktake', async () => {
  api.getWarehouses.mockResolvedValue([
    {
      id: 'wh-1',
      name: 'Основний склад',
      code: 'main',
      isSystemDefault: true,
      isActive: true,
      zoneCount: 1,
    },
    {
      id: 'wh-2',
      name: 'Другий склад',
      code: 'second',
      isSystemDefault: false,
      isActive: true,
      zoneCount: 1,
    },
  ])
  renderAt('/app/yard/inventory/sessions/new?warehouseId=wh-2')
  expect(
    await screen.findByRole('radio', { name: 'Другий склад' }),
  ).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('radio', { name: 'Основний склад' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
})

it('shows an empty warehouse list with its creation action', async () => {
  api.getWarehouses.mockResolvedValue([])
  renderAt('/app/yard/warehouses')
  expect(await screen.findByText('Складів ще немає')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Додати склад' })).toBeVisible()
  expect(parts.search).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('region', { name: 'Сесії інвентаризації' }),
  ).toBeNull()
})

it('retries a failed warehouse list request', async () => {
  const user = userEvent.setup()
  api.getWarehouses.mockRejectedValueOnce(new Error('unavailable'))
  renderAt('/app/yard/warehouses')
  await user.click(await screen.findByRole('button', { name: 'Повторити' }))
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Склади' }),
  ).toBeVisible()
})

it('loads warehouses independently of stocktake sessions', async () => {
  api.getSessions.mockRejectedValue(new Error('stocktake unavailable'))
  renderAt('/app/yard/warehouses')
  await screen.findByRole('region', { name: 'Склади' })
  expect(
    screen.getByRole('heading', { level: 1, name: 'Склади' }),
  ).toBeVisible()
  expect(api.getSessions).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: 'Інвентаризація' })).toBeNull()
  expect(screen.queryByText('Ще не перевіряли')).toBeNull()
})

it('shows warehouse details without stocktake controls or requests', async () => {
  renderAt('/app/yard/warehouses/wh-1')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Основний склад' }),
  ).toBeVisible()
  expect(api.getSessions).not.toHaveBeenCalled()
  expect(screen.queryByRole('region', { name: 'Активна сесія' })).toBeNull()
  expect(screen.queryByText('Історія перевірок')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Нова сесія' })).toBeNull()
  expect(screen.queryByText('Розходження')).toBeNull()
})

const unassignedPart = {
  id: 'part-1',
  name: 'Крило',
  oemCode: 'OEM-123',
  externalCode: null,
  quantity: 2,
  quantityAvailable: 2,
  quantityReserved: 0,
  unit: 'шт',
  condition: 'used',
  sourceType: 'manual',
  status: 'available',
  createdAt: '2026-09-02T10:00:00Z',
  isInventoryLocked: false,
  hasDiscrepancy: false,
  thumbnailUrl: null,
  car: null,
}

function setupUnassignedQueue() {
  const physical = {
    id: 'zone-1',
    warehouseId: 'wh-1',
    warehouseName: 'Основний склад',
    name: 'Стелаж A1',
    code: 'A1',
    qrCode: 'ZONE-1',
    isSystemUnassigned: false,
    isActive: true,
  }
  const unassigned = {
    ...physical,
    id: 'system-zone-1',
    name: 'Без зони',
    code: 'unassigned',
    qrCode: '',
    isSystemUnassigned: true,
  }
  api.getWarehouse.mockResolvedValue({
    id: 'wh-1',
    name: 'Основний склад',
    code: 'main',
    isActive: true,
    isSystemDefault: true,
    tenantId: 'tenant-1',
    createdAt: '',
    updatedAt: '',
    unassignedPartCount: 1,
    zones: [unassigned, physical],
  })
  api.getZones.mockResolvedValue([unassigned, physical])
  api.getPartZones.mockResolvedValue([
    {
      zoneId: unassigned.id,
      zoneName: unassigned.name,
      zoneCode: unassigned.code,
      warehouseId: 'wh-1',
      warehouseName: 'Основний склад',
      isSystemUnassigned: true,
      shelfId: null,
      sectionId: null,
    },
  ])
  parts.search.mockResolvedValue({
    items: [unassignedPart],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  })
}

async function openUnassignedPlacement(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Крило' }),
  )
  await user.click(screen.getByRole('button', { name: 'Розмістити вибрані' }))
}

it('offers unassigned placement only after selecting parts, without per-row placement buttons', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const selection = await screen.findByRole('checkbox', {
    name: 'Обрати: Крило',
  })
  expect(
    screen.queryByRole('button', { name: /Розмістити/ }),
  ).not.toBeInTheDocument()
  await user.click(selection)
  expect(
    screen.getByRole('button', { name: 'Розмістити вибрані' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Розмістити Крило' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Розмістити вибрані' }))
  expect(
    await screen.findByRole('dialog', { name: 'Розмістити запчастину' }),
  ).toBeVisible()
})

it('opens the warehouse unassigned queue with a scoped search and selection', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  renderAt('/app/yard/warehouses/wh-1')
  const link = await screen.findByRole('link', { name: 'Без зони' })
  expect(link).toHaveAttribute('href', '/app/yard/warehouses/wh-1/unassigned')
  await user.click(link)
  expect(await screen.findByRole('heading', { name: 'Без зони' })).toBeVisible()
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Крило' }),
  ).toBeVisible()
  expect(parts.search).toHaveBeenLastCalledWith(
    {
      statuses: ['available', 'reserved'],
      warehouseIds: ['wh-1'],
      zoneIds: ['system-zone-1'],
      page: 1,
      pageSize: 20,
      sort: 'name_asc',
    },
    expect.any(Object),
  )
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук запчастин' }),
    'OEM-123',
  )
  await waitFor(() =>
    expect(parts.search.mock.lastCall?.[0]).toMatchObject({
      query: 'OEM-123',
      warehouseIds: ['wh-1'],
      zoneIds: ['system-zone-1'],
    }),
  )
})

it('places an unassigned part without leaving the queue and preserves its search', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  api.replacePartZones.mockImplementationOnce(() => {
    parts.search.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    })
    return Promise.resolve([])
  })
  renderAt(
    '/app/yard/warehouses/wh-1/unassigned?unassignedSearch=OEM-123&keep=1',
  )
  await openUnassignedPlacement(user)
  const dialog = await screen.findByRole('dialog', {
    name: 'Розмістити запчастину',
  })
  const save = within(dialog).getByRole('button', {
    name: 'Розмістити',
  })
  expect(save).toBeDisabled()
  await chooseUnassignedZone(user, dialog)
  await user.click(save)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.replacePartZones).toHaveBeenCalledWith(
    'part-1',
    ['zone-1'],
    expect.any(Object),
    undefined,
    undefined,
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('checkbox', { name: 'Обрати: Крило' }),
    ).toBeNull(),
  )
  expect(
    screen.getByRole('searchbox', { name: 'Пошук запчастин' }),
  ).toHaveValue('OEM-123')
  expect(screen.getByTestId('inventory-url')).toHaveTextContent('keep=1')
  expect(screen.getByTestId('inventory-url')).toHaveTextContent(
    '/warehouses/wh-1/unassigned',
  )
})

it('keeps the placement choice on save failure and allows retry from the queue', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  api.replacePartZones.mockRejectedValueOnce(new Error('Offline'))
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  await openUnassignedPlacement(user)
  const dialog = await screen.findByRole('dialog')
  await chooseUnassignedZone(user, dialog)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(await within(dialog).findByRole('alert')).toBeVisible()
  expect(
    within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Крило', hidden: true }),
  ).toBeInTheDocument()
  await user.click(
    within(dialog).getByRole('button', { name: 'Повторити для нерозміщених' }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.replacePartZones).toHaveBeenCalledTimes(2)
})

it('shows failed unassigned loading separately from an empty queue and retries', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  parts.search.mockRejectedValueOnce(new Error('Offline'))
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося завантажити запчастини',
  )
  expect(screen.queryByText('Немає запчастин для розміщення.')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Крило' }),
  ).toBeVisible()
})

it('disables selection for parts locked by stocktake', async () => {
  setupUnassignedQueue()
  parts.search.mockResolvedValue({
    items: [{ ...unassignedPart, isInventoryLocked: true }],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  })
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Крило' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Крило' }),
  ).toHaveAttribute('title', 'Розміщення заблоковано під час інвентаризації.')
})

it.each([
  { status: 'sold', quantity: 0 },
  { status: 'available', quantity: 0 },
])('omits parts without stock from the placement queue: %o', async (stock) => {
  setupUnassignedQueue()
  parts.search.mockResolvedValue({
    items: [{ ...unassignedPart, ...stock }],
    total: 1,
  })
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  await screen.findByRole('region', { name: 'Запчастини без зони' })
  expect(screen.queryByRole('link', { name: /Крило/ })).toBeNull()
  expect(screen.queryByRole('checkbox', { name: 'Обрати: Крило' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Розмістити Крило' })).toBeNull()
  expect(screen.queryByText('Немає залишку')).toBeNull()
})

it('allows placing reserved units that are still physically in stock', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  parts.search.mockResolvedValue({
    items: [
      {
        ...unassignedPart,
        status: 'reserved',
        quantityAvailable: 0,
        quantityReserved: 2,
      },
    ],
    total: 1,
  })
  parts.get.mockResolvedValue({
    id: 'part-1',
    name: 'Крило',
    unit: 'шт',
    status: 'reserved',
    quantityTotal: 2,
    quantityAvailable: 0,
    quantityReserved: 2,
  })
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Крило' }),
  ).toBeEnabled()
  await openUnassignedPlacement(user)
  const dialog = await screen.findByRole('dialog')
  await chooseUnassignedZone(user, dialog)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  await waitFor(() => expect(api.replacePartZones).toHaveBeenCalledOnce())
})

it('bulk places parts in a selected section and shelf and shows their stock details', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  setupPlacementHierarchy()
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  expect(within(dialog).getAllByText('OEM-123').length).toBeGreaterThan(0)
  expect(within(dialog).getAllByText('2 шт на складі').length).toBeGreaterThan(
    0,
  )
  await choosePlacementShelf(user, dialog)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  await waitFor(() => expect(api.replacePartZones).toHaveBeenCalledTimes(2))
  expect(api.replacePartZones).toHaveBeenCalledWith(
    'part-1',
    ['zone-1'],
    expect.any(Object),
    'shelf-1',
    'section-1',
  )
})

function setupPlacementHierarchy() {
  api.getSections.mockResolvedValue([
    {
      id: 'section-1',
      name: 'Секція A',
      code: 'A',
      zoneId: 'zone-1',
      warehouseId: 'wh-1',
      isActive: true,
    },
  ])
  api.getShelves.mockResolvedValue([
    {
      id: 'shelf-1',
      name: 'Полиця 1',
      code: '1',
      sectionId: 'section-1',
      zoneId: 'zone-1',
      warehouseId: 'wh-1',
      isActive: true,
    },
  ])
}

async function choosePlacementShelf(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук секції' }),
  )
  await user.click(await screen.findByRole('option', { name: /Секція A/ }))
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук полиці' }),
  )
  await user.click(await screen.findByRole('option', { name: /Полиця 1/ }))
}

it('uses the same section and shelf placement for a single part', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  setupPlacementHierarchy()
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  await openUnassignedPlacement(user)
  const dialog = await screen.findByRole('dialog', {
    name: 'Розмістити запчастину',
  })
  expect(within(dialog).getByText('OEM-123')).toBeVisible()
  await chooseUnassignedZone(user, dialog)
  await choosePlacementShelf(user, dialog)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.replacePartZones).toHaveBeenCalledWith(
    'part-1',
    ['zone-1'],
    expect.any(Object),
    'shelf-1',
    'section-1',
  )
})

it('rechecks stock before writing and skips a part sold after selection', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  parts.get.mockImplementation((id: string) =>
    Promise.resolve({
      id,
      name: id === 'part-1' ? 'Крило' : 'Фара',
      unit: 'шт',
      quantityTotal: id === 'part-1' ? 2 : 0,
      status: id === 'part-1' ? 'available' : 'sold',
    }),
  )
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(
    await within(dialog).findByText(
      'Фара: Немає залишку на складі. Розміщення недоступне.',
    ),
  ).toBeVisible()
  expect(within(dialog).getByText('0 шт на складі')).toBeVisible()
  expect(within(dialog).getByText('Продано')).toBeVisible()
  expect(within(dialog).getByRole('status')).toHaveTextContent(
    'Розміщено: 1 із 2',
  )
  expect(api.replacePartZones).toHaveBeenCalledTimes(1)
  expect(api.replacePartZones.mock.calls[0]?.[0]).toBe('part-1')
})

it('clears section and shelf when changing the selected zone', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  setupPlacementHierarchy()
  const warehouse = await (api.getWarehouse('wh-1') as Promise<WarehouseDetail>)
  api.getWarehouse.mockResolvedValue({
    ...warehouse,
    zones: [
      ...warehouse.zones,
      { ...warehouse.zones[1], id: 'zone-2', name: 'Інша зона' },
    ],
  })
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  await choosePlacementShelf(user, dialog)
  await user.click(
    within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(await screen.findByRole('option', { name: /Інша зона/ }))
  expect(
    await within(dialog).findByRole('searchbox', { name: 'Пошук секції' }),
  ).toBeVisible()
  expect(within(dialog).queryByRole('button', { name: /полиця/i })).toBeNull()
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  await waitFor(() => expect(api.replacePartZones).toHaveBeenCalledTimes(2))
  expect(api.replacePartZones).toHaveBeenCalledWith(
    'part-1',
    ['zone-2'],
    expect.any(Object),
    undefined,
    undefined,
  )
})

it('keeps the selected parent and retries failed section and shelf loading', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  setupPlacementHierarchy()
  api.getSections.mockRejectedValueOnce(new Error('Offline'))
  api.getShelves.mockRejectedValueOnce(new Error('Offline'))
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  expect(
    await within(dialog).findByText('Не вдалося завантажити дані.'),
  ).toBeVisible()
  expect(
    within(dialog).getByRole('button', { name: 'Розмістити' }),
  ).toBeDisabled()
  expect(
    within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
  ).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Повторити' }))
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук секції' }),
  )
  await user.click(await screen.findByRole('option', { name: /Секція A/ }))
  expect(
    await within(dialog).findByText('Не вдалося завантажити дані.'),
  ).toBeVisible()
  expect(
    within(dialog).getByRole('button', { name: 'Розмістити' }),
  ).toBeDisabled()
  expect(
    within(dialog).getByRole('searchbox', { name: 'Пошук секції' }),
  ).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Повторити' }))
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук полиці' }),
  )
  await user.click(await screen.findByRole('option', { name: /Полиця 1/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  await waitFor(() => expect(api.replacePartZones).toHaveBeenCalledTimes(2))
})

it('does not erase an existing deep location in another zone', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  setupPlacementHierarchy()
  const current = await (api.getPartZones('part-1') as Promise<
    PartInventoryZone[]
  >)
  api.getPartZones.mockResolvedValue([
    ...current,
    {
      ...current[0],
      zoneId: 'zone-other',
      isSystemUnassigned: false,
      sectionId: 'section-other',
      shelfId: 'shelf-other',
    },
  ])
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  await choosePlacementShelf(user, dialog)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(await within(dialog).findAllByRole('alert')).toHaveLength(2)
  expect(within(dialog).getAllByRole('alert')[0]).toHaveTextContent(
    'в іншій зоні',
  )
  expect(api.replacePartZones).not.toHaveBeenCalled()
})

it('keeps the unassigned queue read-only without location management permission', async () => {
  setupUnassignedQueue()
  permissions.value.delete('inventory.zones.manage')
  try {
    renderAt('/app/yard/warehouses/wh-1/unassigned')
    expect(await screen.findByRole('link', { name: /Крило/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Розмістити/ })).toBeNull()
  } finally {
    permissions.value.add('inventory.zones.manage')
  }
})

it('does not query all parts if the warehouse system zone is absent', async () => {
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося визначити зону нерозміщених запчастин.',
  )
  expect(parts.search).not.toHaveBeenCalled()
})

it('prefills the queue warehouse and preserves other physical zones when placing', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  api.getWarehouses.mockResolvedValue([
    {
      id: 'wh-other',
      name: 'Інший склад',
      code: 'other',
      isActive: true,
      isSystemDefault: false,
      zoneCount: 1,
    },
    {
      id: 'wh-1',
      name: 'Основний склад',
      code: 'main',
      isActive: true,
      isSystemDefault: true,
      zoneCount: 2,
    },
  ])
  const loadZones = api.getZones.getMockImplementation() as (
    ...args: unknown[]
  ) => Promise<InventoryZone[]>
  const zones = await loadZones()
  api.getZones.mockResolvedValue([
    ...zones,
    {
      ...zones[1],
      id: 'zone-other',
      warehouseId: 'wh-other',
      warehouseName: 'Інший склад',
      name: 'Інша зона',
      isSystemUnassigned: false,
    },
  ])
  api.getPartZones.mockResolvedValue([
    {
      zoneId: 'zone-other',
      zoneName: 'Інша зона',
      warehouseId: 'wh-other',
      isSystemUnassigned: false,
    },
    {
      zoneId: 'system-zone-1',
      zoneName: 'Без зони',
      warehouseId: 'wh-1',
      isSystemUnassigned: true,
    },
  ])
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  await openUnassignedPlacement(user)
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Основний склад')).toBeVisible()
  const save = within(dialog).getByRole('button', {
    name: 'Розмістити',
  })
  expect(save).toBeDisabled()
  await chooseUnassignedZone(user, dialog)
  await user.click(save)
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-other', 'zone-1'],
      expect.any(Object),
      undefined,
      undefined,
    ),
  )
})

it('returns to the last remaining queue page after placement and keeps the search', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  let placed = false
  parts.search.mockImplementation((request: { page?: number }) =>
    Promise.resolve({
      items: !placed
        ? [unassignedPart]
        : request.page === 2
          ? []
          : Array.from({ length: 20 }, (_, index) => ({
              ...unassignedPart,
              id: `remaining-${index}`,
              name: `Крило ${index + 2}`,
            })),
      page: request.page ?? 1,
      pageSize: 20,
      total: placed ? 20 : 21,
      totalPages: placed ? 1 : 2,
    }),
  )
  api.replacePartZones.mockImplementationOnce(() => {
    placed = true
    return Promise.resolve([])
  })
  renderAt(
    '/app/yard/warehouses/wh-1/unassigned?unassignedSearch=Крило&unassignedPage=2&keep=1',
  )
  await openUnassignedPlacement(user)
  const dialog = await screen.findByRole('dialog')
  await chooseUnassignedZone(user, dialog)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Крило 2' }),
  ).toBeVisible()
  expect(screen.getByTestId('inventory-url')).toHaveTextContent(
    'unassignedPage=1',
  )
  expect(screen.getByTestId('inventory-url')).toHaveTextContent('keep=1')
  expect(
    screen.getByRole('searchbox', { name: 'Пошук запчастин' }),
  ).toHaveValue('Крило')
})

it('distinguishes a completed placement queue from an empty search', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  parts.search.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  })
  renderAt('/app/yard/warehouses/wh-1/unassigned?unassignedSearch=absent')
  expect(
    await screen.findByText('Запчастин за цим запитом не знайдено.'),
  ).toBeVisible()
  expect(screen.queryByText('Немає запчастин для розміщення.')).toBeNull()
  await user.clear(screen.getByRole('searchbox', { name: 'Пошук запчастин' }))
  expect(
    await screen.findByText('Немає запчастин для розміщення.'),
  ).toBeVisible()
})

it('does not load unassigned parts without parts viewing permission', async () => {
  setupUnassignedQueue()
  permissions.value.delete('parts.view')
  try {
    renderAt('/app/yard/warehouses/wh-1/unassigned')
    expect(
      await screen.findByText('Для перегляду запчастин потрібне право доступу'),
    ).toBeVisible()
    expect(parts.search).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Розмістити/ })).toBeNull()
  } finally {
    permissions.value.add('parts.view')
  }
})

function setupBulkUnassignedQueue() {
  setupUnassignedQueue()
  const queueParts = [
    unassignedPart,
    { ...unassignedPart, id: 'part-2', name: 'Фара' },
    {
      ...unassignedPart,
      id: 'locked-part',
      name: 'Бампер',
      isInventoryLocked: true,
    },
  ]
  const placed = new Set<string>()
  parts.search.mockImplementation(() => {
    const items = queueParts.filter((part) => !placed.has(part.id))
    return Promise.resolve({
      items,
      page: 1,
      pageSize: 20,
      total: items.length,
      totalPages: 1,
    })
  })
  return { placed }
}

async function openBulkUnassignedPlacement(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати всі на сторінці' }),
  )
  await user.click(screen.getByRole('button', { name: 'Розмістити вибрані' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Розмістити вибрані запчастини',
  })
  await chooseUnassignedZone(user, dialog)
  return dialog
}

async function chooseUnassignedZone(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  await user.click(
    await within(dialog).findByRole('searchbox', { name: 'Пошук зони' }),
  )
  await user.click(await screen.findByRole('option', { name: /Стелаж A1/ }))
}

it('selects unassigned parts from row background after the first checkbox and exits when cleared', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const first = await screen.findByRole('checkbox', { name: 'Обрати: Крило' })
  const second = screen.getByRole('checkbox', { name: 'Обрати: Фара' })
  await user.click(second.closest('tr')!)
  expect(second).not.toBeChecked()
  await user.click(first)
  await user.click(second.closest('tr')!)
  expect(second).toBeChecked()
  const locked = screen.getByRole('checkbox', { name: 'Обрати: Бампер' })
  await user.click(locked.closest('tr')!)
  expect(locked).not.toBeChecked()
  await user.click(second.closest('tr')!)
  expect(second).not.toBeChecked()
  await user.click(first.closest('tr')!)
  expect(first).not.toBeChecked()
  expect(
    screen.queryByRole('button', { name: 'Розмістити вибрані' }),
  ).toBeNull()
  await user.click(second.closest('tr')!)
  expect(second).not.toBeChecked()
})

it('bulk places selected unassigned parts and excludes inventory-locked rows', async () => {
  const user = userEvent.setup()
  const { placed } = setupBulkUnassignedQueue()
  api.replacePartZones.mockImplementation((partId: string) => {
    placed.add(partId)
    return Promise.resolve([])
  })
  renderAt('/app/yard/warehouses/wh-1/unassigned?unassignedSearch=OEM&keep=1')
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Бампер' }),
  ).toBeDisabled()
  const dialog = await openBulkUnassignedPlacement(user)
  expect(dialog).toHaveTextContent('Вибрано: 2')
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(await within(dialog).findByRole('status')).toHaveTextContent(
    'Розміщено: 2 із 2',
  )
  expect(
    api.replacePartZones.mock.calls.map((call: unknown[]) => call.slice(0, 2)),
  ).toEqual([
    ['part-1', ['zone-1']],
    ['part-2', ['zone-1']],
  ])
  await user.click(within(dialog).getByRole('button', { name: 'Закрити' }))
  expect(screen.queryByRole('checkbox', { name: 'Обрати: Крило' })).toBeNull()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Бампер' }),
  ).toBeDisabled()
  expect(
    screen.queryByRole('button', { name: 'Розмістити вибрані' }),
  ).toBeNull()
  expect(
    screen.getByRole('searchbox', { name: 'Пошук запчастин' }),
  ).toHaveValue('OEM')
  expect(screen.getByTestId('inventory-url')).toHaveTextContent('keep=1')
})

it('bulk retries only failed parts and preserves the selected zone after a partial failure', async () => {
  const user = userEvent.setup()
  const { placed } = setupBulkUnassignedQueue()
  let failedOnce = false
  api.replacePartZones.mockImplementation((partId: string) => {
    if (partId === 'part-2' && !failedOnce) {
      failedOnce = true
      return Promise.reject(new Error('Offline'))
    }
    placed.add(partId)
    return Promise.resolve([])
  })
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Фара')
  expect(within(dialog).getByRole('status')).toHaveTextContent(
    'Розміщено: 1 із 2',
  )
  expect(
    within(dialog).getByRole('searchbox', { name: 'Пошук зони' }),
  ).toBeDisabled()
  await user.click(
    within(dialog).getByRole('button', { name: 'Повторити для нерозміщених' }),
  )
  await waitFor(() =>
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Розміщено: 2 із 2',
    ),
  )
  expect(
    api.replacePartZones.mock.calls.map((call: unknown[]) => call[0]),
  ).toEqual(['part-1', 'part-2', 'part-2'])
  expect(within(dialog).queryByRole('alert')).toBeNull()
})

it('bulk preserves physical placements and skips parts already moved out of the source queue', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  const systemPlacement = await (api.getPartZones('part-1') as Promise<
    PartInventoryZone[]
  >)
  api.getPartZones.mockImplementation((partId: string) =>
    Promise.resolve(
      partId === 'part-1'
        ? [
            ...systemPlacement,
            {
              ...systemPlacement[0],
              zoneId: 'zone-other',
              zoneName: 'Інша зона',
              isSystemUnassigned: false,
              shelfId: 'shelf-other',
              sectionId: 'section-other',
            },
          ]
        : [
            {
              ...systemPlacement[0],
              zoneId: 'zone-moved',
              zoneName: 'Уже розміщено',
              isSystemUnassigned: false,
            },
          ],
    ),
  )
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(
    await within(dialog).findByText(/Фара.*вже не в «Без зони»/),
  ).toBeVisible()
  expect(api.replacePartZones).toHaveBeenCalledTimes(1)
  expect(api.replacePartZones).toHaveBeenCalledWith(
    'part-1',
    ['zone-other', 'zone-1'],
    expect.any(Object),
    'shelf-other',
    'section-other',
  )
  expect(within(dialog).getByRole('status')).toHaveTextContent(
    'Розміщено: 1 із 2',
  )
  expect(
    within(dialog).queryByRole('button', {
      name: 'Повторити для нерозміщених',
    }),
  ).toBeNull()
})

it('bulk does not write a part when reading its current placement fails', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  api.getPartZones.mockRejectedValue(new Error('Offline'))
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(await within(dialog).findAllByRole('alert')).toHaveLength(2)
  expect(api.replacePartZones).not.toHaveBeenCalled()
  await user.click(within(dialog).getByRole('button', { name: 'Закрити' }))
  expect(screen.getByRole('checkbox', { name: 'Обрати: Крило' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Обрати: Фара' })).toBeChecked()
})

it('bulk keeps selection across pages and search and can clear it', async () => {
  const user = userEvent.setup()
  setupUnassignedQueue()
  parts.search.mockImplementation(
    (request: { page?: number; query?: string }) => {
      const second = request.page === 2 || request.query === 'Фара'
      return Promise.resolve({
        items: [
          {
            ...unassignedPart,
            id: second ? 'part-2' : 'part-1',
            name: second ? 'Фара' : 'Крило',
          },
        ],
        page: request.page ?? 1,
        pageSize: 20,
        total: request.query ? 1 : 21,
        totalPages: request.query ? 1 : 2,
      })
    },
  )
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Крило' }),
  )
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  const nextPagePart = await screen.findByRole('checkbox', {
    name: 'Обрати: Фара',
  })
  await user.click(nextPagePart.closest('tr')!)
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук запчастин' }),
    'Фара',
  )
  await waitFor(() =>
    expect(parts.search.mock.lastCall?.[0]).toMatchObject({ query: 'Фара' }),
  )
  await user.click(screen.getByRole('button', { name: 'Розмістити вибрані' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Розмістити вибрані запчастини',
  })
  const chosen = within(dialog).getByRole('list', {
    name: 'Вибрані запчастини',
  })
  expect(within(chosen).getAllByRole('listitem')).toHaveLength(2)
  expect(chosen).toHaveTextContent('Крило')
  expect(chosen).toHaveTextContent('Фара')
  await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }))
  await user.click(screen.getByRole('button', { name: 'Зняти вибір' }))
  expect(
    screen.queryByRole('button', { name: 'Розмістити вибрані' }),
  ).toBeNull()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Фара' }),
  ).not.toBeChecked()
})

it('bulk confirms a lost save response by reading placement before retrying', async () => {
  const user = userEvent.setup()
  const { placed } = setupBulkUnassignedQueue()
  const original = await (api.getPartZones('part-1') as Promise<
    PartInventoryZone[]
  >)
  api.getPartZones.mockImplementation((id: string) =>
    Promise.resolve(
      placed.has(id)
        ? [{ ...original[0], zoneId: 'zone-1', isSystemUnassigned: false }]
        : original,
    ),
  )
  api.replacePartZones.mockImplementation((id: string) => {
    placed.add(id)
    return id === 'part-1'
      ? Promise.reject(new Error('Response lost'))
      : Promise.resolve([])
  })
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Крило')
  await user.click(
    within(dialog).getByRole('button', { name: 'Повторити для нерозміщених' }),
  )
  await waitFor(() =>
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Розміщено: 2 із 2',
    ),
  )
  expect(api.replacePartZones).toHaveBeenCalledTimes(2)
})

it('bulk prevents duplicate submission and closing while a write is pending', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  let finish!: () => void
  const saved = new Promise<never[]>((resolve) => {
    finish = () => resolve([])
  })
  api.replacePartZones.mockImplementationOnce(() => saved)
  renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  const submit = within(dialog).getByRole('button', { name: 'Розмістити' })
  await user.dblClick(submit)
  await waitFor(() => expect(api.replacePartZones).toHaveBeenCalledTimes(1))
  expect(submit).toBeDisabled()
  expect(
    within(dialog).getByRole('button', { name: 'Скасувати' }),
  ).toBeDisabled()
  await user.click(within(dialog).getByRole('button', { name: 'Закрити' }))
  expect(dialog).toBeVisible()
  await user.keyboard('{Escape}')
  expect(dialog).toBeVisible()
  await act(async () => {
    finish()
    await saved
  })
  await waitFor(() =>
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Розміщено: 2 із 2',
    ),
  )
})

it('bulk stops after unmounting without writing remaining parts', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  let finish!: () => void
  const saved = new Promise<never[]>((resolve) => {
    finish = () => resolve([])
  })
  let signal: AbortSignal | undefined
  api.replacePartZones.mockImplementationOnce(
    (_id: string, _ids: string[], options: { signal?: AbortSignal }) => {
      signal = options.signal
      return saved
    },
  )
  const view = renderAt('/app/yard/warehouses/wh-1/unassigned')
  const dialog = await openBulkUnassignedPlacement(user)
  await user.click(within(dialog).getByRole('button', { name: 'Розмістити' }))
  await waitFor(() => expect(api.replacePartZones).toHaveBeenCalledTimes(1))
  view.unmount()
  expect(signal?.aborted).toBe(true)
  await act(async () => {
    finish()
    await saved
  })
  expect(api.replacePartZones).toHaveBeenCalledTimes(1)
})

it('bulk hides selected part details when parts viewing permission is revoked', async () => {
  const user = userEvent.setup()
  setupBulkUnassignedQueue()
  const view = renderAt('/app/yard/warehouses/wh-1/unassigned')
  await openBulkUnassignedPlacement(user)
  permissions.value.delete('parts.view')
  try {
    view.rerender(
      <MemoryRouter>
        <StockRoutes />
        <LocationProbe />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.replacePartZones).not.toHaveBeenCalled()
  } finally {
    permissions.value.add('parts.view')
  }
})

it('restores an archived zone from its filtered list and preserves the filter', async () => {
  const user = userEvent.setup()
  const archived = {
    id: 'zone-old',
    name: 'Стара зона',
    code: 'old',
    warehouseId: 'wh-1',
    isActive: false,
    isSystemUnassigned: false,
  }
  api.getZones.mockResolvedValue([archived])
  api.restoreZone.mockImplementation(() => {
    api.getZones.mockResolvedValue([])
    return Promise.resolve({ ...archived, isActive: true })
  })
  renderAt('/app/yard/warehouses/wh-1?locationStatus=archived&keep=1')
  await screen.findByText('Стара зона')
  expect(api.getZones).toHaveBeenCalledWith(
    expect.objectContaining({ warehouseId: 'wh-1', archivedOnly: true }),
  )
  expect(
    screen.queryByRole('link', { name: 'Стара зона' }),
  ).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('group', { name: 'Стан зон' })).getByRole('radio', {
      name: 'Архів',
    }),
  ).toBeChecked()
  await user.click(
    screen.getByRole('button', { name: 'Дії із зоною Стара зона' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Розархівувати' }))
  await waitFor(() =>
    expect(api.restoreZone).toHaveBeenCalledWith('zone-old', expect.anything()),
  )
  await screen.findByText('Архівних зон немає')
  expect(
    within(screen.getByRole('group', { name: 'Стан зон' })).getByRole('radio', {
      name: 'Архів',
    }),
  ).toBeChecked()
  await user.click(
    within(screen.getByRole('group', { name: 'Стан зон' })).getByRole('radio', {
      name: 'Активні',
    }),
  )
  expect(
    await screen.findByRole('link', { name: 'Стелаж A1' }),
  ).toBeInTheDocument()
})

it('restores archived sections and resets the page when switching status', async () => {
  const user = userEvent.setup()
  const archived = {
    id: 'section-old',
    name: 'Стара секція',
    code: 'old',
    zoneId: 'zone-1',
    warehouseId: 'wh-1',
    isActive: false,
  }
  api.getSections.mockImplementation(
    (_zone: string, options?: { archivedOnly?: boolean }) =>
      Promise.resolve(options?.archivedOnly ? [archived] : []),
  )
  api.restoreSection.mockImplementation(() => {
    api.getSections.mockResolvedValue([])
    return Promise.resolve({ ...archived, isActive: true })
  })
  renderAt('/app/yard/warehouses/zones/zone-1?locationPage=2&keep=1')
  const filter = await screen.findByRole('group', { name: 'Стан секцій' })
  await user.click(within(filter).getByRole('radio', { name: 'Архів' }))
  await screen.findByText('Стара секція')
  expect(screen.getByTestId('inventory-url')).toHaveTextContent(
    'locationStatus=archived',
  )
  expect(screen.getByTestId('inventory-url')).toHaveTextContent('keep=1')
  expect(screen.getByTestId('inventory-url')).not.toHaveTextContent(
    'locationPage',
  )
  expect(api.getSections).toHaveBeenCalledWith(
    'zone-1',
    expect.objectContaining({ archivedOnly: true, includePartCounts: false }),
  )
  expect(
    screen.queryByRole('link', { name: 'Стара секція, old' }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Дії із секцією Стара секція' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Розархівувати' }))
  await waitFor(() =>
    expect(api.restoreSection).toHaveBeenCalledWith(
      'section-old',
      expect.anything(),
    ),
  )
  await screen.findByText('Архівних секцій немає')
  expect(
    within(screen.getByRole('group', { name: 'Стан секцій' })).getByRole(
      'radio',
      { name: 'Архів' },
    ),
  ).toBeChecked()
})

it('keeps an archived section visible and allows retry after a restore error', async () => {
  const user = userEvent.setup()
  const archived = {
    id: 'section-old',
    name: 'Стара секція',
    code: 'old',
    zoneId: 'zone-1',
    warehouseId: 'wh-1',
    isActive: false,
  }
  api.getSections.mockResolvedValue([archived])
  api.restoreSection
    .mockRejectedValueOnce({
      kind: 'conflict',
      code: 'INVENTORY_LOCATION_PARENT_INACTIVE',
      message: 'Restore the parent warehouse and zone first.',
    })
    .mockResolvedValue({ ...archived, isActive: true })
  renderAt('/app/yard/warehouses/zones/zone-1?locationStatus=archived')
  await screen.findByText('Стара секція')
  await user.click(
    screen.getByRole('button', { name: 'Дії із секцією Стара секція' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Розархівувати' }))
  expect(
    await screen.findByText(
      'Спочатку розархівуйте батьківський склад і зону, після цього повторіть відновлення.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('Стара секція')).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Дії із секцією Стара секція' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Розархівувати' }))
  await waitFor(() => expect(api.restoreSection).toHaveBeenCalledTimes(2))
})

it('can return to active zones when the archive request fails', async () => {
  const user = userEvent.setup()
  api.getZones.mockRejectedValue(new Error('offline'))
  renderAt('/app/yard/warehouses/wh-1?locationStatus=archived')
  await user.click(
    within(await screen.findByRole('group', { name: 'Стан зон' })).getByRole(
      'radio',
      { name: 'Активні' },
    ),
  )
  expect(
    await screen.findByRole('link', { name: 'Стелаж A1' }),
  ).toBeInTheDocument()
})

it.each([
  ['/app/yard/warehouses/wh-1', 'Стан зон', 'Додати зону', 'Дії із зонами'],
  [
    '/app/yard/warehouses/zones/zone-1',
    'Стан секцій',
    'Додати секцію',
    'Дії із зоною Стелаж A1',
  ],
])(
  'orders the status switch, add action and menu at %s',
  async (path, filterLabel, addLabel, menuLabel) => {
    renderAt(path)
    const filter = await screen.findByRole('group', { name: filterLabel })
    expect(within(filter).getAllByRole('radio')).toHaveLength(2)
    expect(within(filter).getByRole('radio', { name: 'Активні' })).toBeChecked()
    expect(
      within(filter).getByRole('radio', { name: 'Архів' }),
    ).not.toBeChecked()
    expect(
      within(filter).queryByRole('radio', { name: 'Усі' }),
    ).not.toBeInTheDocument()
    const add = screen.getByRole('button', { name: addLabel })
    const menu = screen.getByRole('button', { name: menuLabel })
    expect(
      filter.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      add.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  },
)

it('offers only backend-supported choices when creating a stocktake session', async () => {
  permissions.value.add('team.view')
  renderAt('/app/yard/inventory/sessions/new')
  await screen.findByRole('heading', { name: 'Нова сесія інвентаризації' })
  const types = screen.getByRole('radiogroup', { name: 'Тип перевірки' })
  expect(within(types).getAllByRole('radio')).toHaveLength(2)
  expect(
    screen.queryByRole('radio', { name: /Вибіркова/ }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Виконавці' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Правила' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('textbox', { name: 'Коментар до сесії' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Блокувати рух позицій')).not.toBeInTheDocument()
  expect(screen.queryByText('Сліпий підрахунок')).not.toBeInTheDocument()
  expect(screen.queryByText('Фото при розходженні')).not.toBeInTheDocument()
  const scope = screen.getByRole('region', { name: 'Обсяг сесії' })
  expect(within(scope).queryByText('Виконавців')).not.toBeInTheDocument()
  expect(within(scope).queryByText('Орієнтовно')).not.toBeInTheDocument()
  expect(within(scope).queryByText('Позицій')).not.toBeInTheDocument()
  expect(within(scope).queryByText('—')).not.toBeInTheDocument()
  expect(team.listMembers).not.toHaveBeenCalled()
})

it('saves only selected zone IDs as a draft without starting the session', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/sessions/new')
  await user.click(await screen.findByRole('checkbox', { name: /Стелаж A1/ }))
  await user.click(screen.getByRole('button', { name: 'Зберегти чернетку' }))
  await waitFor(() =>
    expect(api.createSession).toHaveBeenCalledWith(['zone-1'], {
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
  expect(api.createSession).toHaveBeenCalledTimes(1)
  expect(api.startSession).not.toHaveBeenCalled()
})

it.each(['no permission', 'unavailable'] as const)(
  'hides unknown zone counts when parts data is %s without blocking zone selection',
  async (state) => {
    if (state === 'no permission') permissions.value.delete('parts.view')
    else parts.facets.mockRejectedValueOnce(new Error('Parts unavailable'))
    const user = userEvent.setup()
    renderAt('/app/yard/inventory/sessions/new')
    const zone = await screen.findByRole('checkbox', { name: /Стелаж A1/ })
    expect(screen.queryByText('18 позицій')).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    if (state === 'no permission') expect(parts.facets).not.toHaveBeenCalled()
    await user.click(zone)
    expect(
      within(screen.getByRole('region', { name: 'Обсяг сесії' })).getByRole(
        'button',
        { name: 'Розпочати сесію' },
      ),
    ).toBeEnabled()
  },
)
