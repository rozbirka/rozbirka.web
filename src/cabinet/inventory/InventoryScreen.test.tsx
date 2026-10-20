import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocaleProvider, type Locale } from '@/i18n'
import type { InventorySection, InventoryZone } from '@/api/inventory'
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
  updateShelf: vi.fn(),
  archiveShelf: vi.fn(),
  updateZone: vi.fn(),
  archiveZone: vi.fn(),
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
    <MemoryRouter initialEntries={[path]}>
      <StockRoutes />
      <LocationProbe />
    </MemoryRouter>,
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
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Inwentaryzacja' }),
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
  // The sample check cannot be expressed as a list of zones.
  expect(screen.getByRole('radio', { name: /Вибіркова/ })).toBeDisabled()
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

it('keeps multiple physical zones selected across warehouses', async () => {
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

  const first = await screen.findByRole('checkbox', {
    name: 'Основний склад · Стелаж A1',
  })
  const second = screen.getByRole('checkbox', {
    name: 'Основний склад · Стелаж A2',
  })
  await user.click(first)
  await user.click(second)
  expect(first).toBeChecked()
  expect(second).toBeChecked()

  await user.click(screen.getByRole('radio', { name: /Другий склад/ }))
  expect(
    screen.getByRole('button', { name: 'Зберегти розміщення' }),
  ).toBeEnabled()
  expect(
    screen.getByRole('region', { name: 'Нове розміщення' }),
  ).toHaveTextContent('Стелаж A2')

  await user.click(
    screen.getByRole('checkbox', { name: 'Другий склад · Стелаж B1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Зберегти розміщення' }))
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-1', 'zone-2', 'zone-3'],
      expect.any(Object),
      undefined,
      undefined,
    ),
  )
})

it('preserves an existing multi-zone placement when saved', async () => {
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

  expect(
    await screen.findByRole('checkbox', { name: 'Основний склад · Стелаж A1' }),
  ).toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Основний склад · Стелаж A2' }),
  ).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Зберегти розміщення' }))
  await waitFor(() =>
    expect(api.replacePartZones).toHaveBeenCalledWith(
      'part-1',
      ['zone-1', 'zone-2'],
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
  expect(drawer).toHaveClass('sm:right-0')
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
    await screen.findByRole('button', { name: 'Редагувати зону Стелаж A1' }),
  )
  const drawer = screen.getByRole('dialog', { name: 'Редагувати зону' })
  expect(drawer).toHaveClass('sm:right-0')
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

it('confirms that part placement was saved', async () => {
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

  expect(await screen.findByText('Розміщення збережено')).toBeInTheDocument()
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
  expect(
    screen.getByRole('button', { name: 'Архівувати зону Стелаж A1' }),
  ).toBeInTheDocument()

  // Printing, exporting and archiving hide behind the overflow control, the
  // way the toolbar is drawn.
  await user.click(screen.getByRole('button', { name: 'Інші дії зі складом' }))
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
  await user.click(
    within(picker).getByRole('button', { name: 'Підготувати 1' }),
  )
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
  const sectionGroup = await screen.findByRole('group', {
    name: 'Секція: Секція B',
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
  await user.click(
    within(picker).getByRole('button', { name: 'Підготувати 1' }),
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
  expect(
    within(screen.getByRole('group', { name: 'Секція: Секція B' })).getByText(
      /Полиць: 1/,
    ),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('group', { name: 'Секція: Секція C' })).getByText(
      /Полиць: 1/,
    ),
  ).toBeInTheDocument()
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

  const sectionGroup = await screen.findByRole('group', {
    name: 'Секція: Секція B',
  })
  await user.click(
    within(sectionGroup).getByRole('link', { name: /^Секція B/ }),
  )
  await user.click(await screen.findByRole('button', { name: 'Додати полицю' }))
  const drawer = screen.getByRole('dialog', { name: 'Нова полиця' })
  expect(drawer).toHaveClass('sm:right-0')
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
  expect(drawer).toHaveClass('sm:right-0')
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
  await screen.findByRole('group', { name: 'Секція: Секція B' })
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
    await screen.findByRole('button', { name: 'Редагувати зону Стелаж A1' }),
  )
  const drawer = screen.getByRole('dialog', { name: 'Редагувати зону' })
  expect(drawer).toHaveClass('sm:right-0')
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
    await screen.findByRole('heading', { name: /Полиці ·/, level: 2 })
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
    { warehouseIds: ['wh-1'], pageSize: 1 },
    expect.anything(),
  )
  const stock = screen.getByText('Позицій на складі').closest('div')
  expect(within(stock as HTMLElement).getByText('20')).toBeInTheDocument()
  expect(screen.queryByText('Розходження')).toBeNull()
  // The zone facet says how much of that stock sits in each zone.
  expect(screen.getByText('18')).toBeInTheDocument()
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
  expect(drawer).toHaveClass('sm:right-0')
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
  expect(drawer).toHaveClass('sm:right-0')
  await user.click(
    await within(drawer).findByRole('checkbox', {
      name: 'Основний склад · Стелаж A1',
    }),
  )
  await user.click(
    within(drawer).getByRole('button', { name: /^Секція \/ стелаж:/ }),
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
  const zone = await within(drawer).findByRole('checkbox', {
    name: 'Основний склад · Стелаж A1',
  })
  await user.click(zone)
  await user.click(
    within(drawer).getByRole('button', { name: 'Зберегти розміщення' }),
  )
  expect(await within(drawer).findByRole('alert')).toBeInTheDocument()
  expect(zone).toBeChecked()
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
    await within(drawer).findByRole('checkbox', {
      name: 'Основний склад · Стелаж A1',
    }),
  )
  await user.click(
    within(drawer).getByRole('button', { name: /^Секція \/ стелаж:/ }),
  )
  await user.type(
    screen.getByRole('combobox', { name: 'Пошук секції' }),
    's100',
  )
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
  expect(drawer).toBeInTheDocument()
  await user.click(
    within(drawer).getByRole('button', { name: /^Секція \/ стелаж:/ }),
  )
  await user.type(
    screen.getByRole('combobox', { name: 'Пошук секції' }),
    's100',
  )
  await user.click(screen.getByRole('option', { name: /Секція 100/ }))
  await user.click(
    within(drawer).getByRole('button', { name: /^Місце\/полиця:/ }),
  )
  await user.type(
    screen.getByRole('combobox', { name: 'Пошук полиці' }),
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
  await screen.findByRole('heading', { name: /Полиці ·/, level: 2 })
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

it('links direct zone parts to the parts screen without fetching a drawer list', async () => {
  renderAt('/app/yard/warehouses/zones/zone-1')
  expect(
    await screen.findByRole('link', { name: /У зоні без секції/ }),
  ).toHaveAttribute(
    'href',
    '/app/yard/parts?warehouse=wh-1&zone=zone-1&without_section=1',
  )
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
  'keeps the direct-parts link without fetching its count at %s',
  async (path, name) => {
    renderAt(path)
    const direct = await screen.findByRole('link', { name: new RegExp(name) })
    expect(within(direct).queryByText('Позицій')).not.toBeInTheDocument()
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

it('opens section label printing only through the zone menu', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/warehouses/zones/zone-1')
  await screen.findByRole('group', { name: 'Секція: Секція B' })
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
    'Інші дії зі складом',
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
      within(workspace).getByRole('region', { name: 'Аркуш стікерів' }),
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
  'still clears its inline selection when its parent is %s',
  async (scenario) => {
    const user = userEvent.setup()
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
    await user.click(await screen.findByRole('button', { name: 'Зняти' }))
    await waitFor(() => expect(readLabelQueue(key)).toBeNull())
  },
)

it('opens warehouses separately from stocktake sessions', async () => {
  renderAt('/app/yard/warehouses')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Склади' }),
  ).toBeVisible()
  const warehouses = screen.getByRole('region', { name: 'Склади' })
  expect(
    within(warehouses).getByRole('link', { name: /Основний склад/ }),
  ).toHaveAttribute('href', '/app/yard/warehouses/wh-1')
  expect(
    screen.queryByRole('region', { name: 'Сесії інвентаризації' }),
  ).toBeNull()
  expect(screen.queryByRole('link', { name: 'Нова сесія' })).toBeNull()
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
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Склади' }),
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
