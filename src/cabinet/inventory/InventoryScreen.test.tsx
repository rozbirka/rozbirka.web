import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocaleProvider, type Locale } from '@/i18n'
import { InventoryScreen } from './InventoryScreen'

const api = vi.hoisted(() => ({
  getWarehouses: vi.fn(),
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

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <InventoryScreen definition={definition as never} />
    </MemoryRouter>,
  )

const renderIn = (locale: Locale, path: string) =>
  render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      <MemoryRouter initialEntries={[path]}>
        <InventoryScreen definition={definition as never} />
      </MemoryRouter>
    </LocaleProvider>,
  )

it('renders the inventory overview in British English', async () => {
  renderIn('en-GB', '/app/yard/inventory')
  const houses = await screen.findByRole('region', { name: 'Warehouses' })
  // Warehouse names are user data and stay as entered.
  expect(within(houses).getByText('Основний склад')).toBeInTheDocument()
  expect(within(houses).getByText('4 zones')).toBeInTheDocument()
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
    await screen.findByRole('region', { name: 'Magazyny' }),
  ).toBeInTheDocument()
  expect(screen.getByText('4 strefy')).toBeInTheDocument()
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
  // The warehouse names the running session as well as its own card, so the
  // list is the one that has to carry it.
  const houses = await screen.findByRole('region', { name: 'Склади' })
  expect(within(houses).getByText('Основний склад')).toBeInTheDocument()
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

  renderAt('/app/yard/inventory/warehouses/wh-1')

  expect(await screen.findByText('Стелаж A1')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Редагувати' })).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Архівувати зону Стелаж A1' }),
  ).toBeInTheDocument()

  // Printing, exporting and archiving hide behind the overflow control, the
  // way the toolbar is drawn.
  await user.click(screen.getByRole('button', { name: 'Інші дії зі складом' }))
  await user.click(screen.getByRole('menuitem', { name: 'Друк стікерів зон' }))

  await waitFor(() =>
    expect(api.getZones).toHaveBeenCalledWith({ warehouseId: 'wh-1' }),
  )
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

it('shows shelves under their zone and prints the shelf QR', async () => {
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

  renderAt('/app/yard/inventory/warehouses/wh-1')

  const sectionGroup = await screen.findByRole('group', {
    name: 'Секція: Секція B',
  })
  expect(within(sectionGroup).getByText(/Деталей: 4/)).toBeInTheDocument()
  await user.click(
    within(sectionGroup).getByRole('button', {
      name: 'Дії з секцією Секція B',
    }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'QR-код' }))
  expect(
    await screen.findByRole('dialog', { name: 'Секція B' }),
  ).toBeInTheDocument()
  expect(
    await screen.findByRole('img', { name: 'QR-код: Секція B' }),
  ).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/))
  await user.click(screen.getByRole('button', { name: 'Закрити' }))
  expect(within(sectionGroup).queryByText('Полиця 1')).not.toBeInTheDocument()
  await user.click(
    within(sectionGroup).getByRole('button', { name: /^Секція B/ }),
  )
  expect(await screen.findByText(/Полиця 1/)).toBeInTheDocument()
  expect(within(sectionGroup).getByText(/Деталей: 3/)).toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Дії з полицею Полиця 1' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'QR-код' }))
  expect(
    await screen.findByRole('dialog', { name: 'Полиця 1' }),
  ).toBeInTheDocument()
  expect(
    await screen.findByRole('img', { name: 'QR-код: Полиця 1' }),
  ).toHaveAttribute('src', expect.stringMatching(/^data:image\/png/))
  await user.click(screen.getByRole('button', { name: 'Друк QR полиці' }))
  expect(printable.buildZoneLabelHtml).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        qrCode: 'inventory-shelf:shelf-1',
        zoneName: 'Полиця 1',
      }),
    ],
    'uk',
  )
  expect(print).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Закрити' }))

  await user.click(
    screen.getByRole('button', { name: 'Дії з полицею Полиця 1' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Редагувати полицю' }))
  expect(screen.getByRole('dialog', { name: 'Редагувати полицю' })).toHaveClass(
    'sm:right-0',
  )
  await user.click(
    within(screen.getByRole('dialog', { name: 'Редагувати полицю' })).getByRole(
      'button',
      { name: 'Скасувати' },
    ),
  )

  await user.click(
    screen.getByRole('button', { name: 'Дії з полицею Полиця 1' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Архівувати полицю' }))
  expect(
    screen.getByRole('dialog', { name: 'Архівувати полицю' }),
  ).toBeInTheDocument()
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
  renderAt('/app/yard/inventory/warehouses/wh-1')

  const first = await screen.findByRole('group', { name: 'Секція: Секція B' })
  const second = screen.getByRole('group', { name: 'Секція: Секція C' })
  const firstToggle = within(first).getByRole('button', { name: /^Секція B/ })
  const secondToggle = within(second).getByRole('button', { name: /^Секція C/ })
  expect(firstToggle).toHaveAttribute('aria-expanded', 'false')
  expect(firstToggle).toHaveTextContent('Полиць: 1')
  expect(screen.queryByText('Полиця B1')).not.toBeInTheDocument()
  expect(screen.queryByText('Полиця C1')).not.toBeInTheDocument()

  await user.click(firstToggle)
  expect(screen.getByText('Полиця B1')).toBeInTheDocument()
  await user.click(secondToggle)
  expect(screen.queryByText('Полиця B1')).not.toBeInTheDocument()
  expect(screen.getByText('Полиця C1')).toBeInTheDocument()
})

it('creates a shelf in a side drawer for its section', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/warehouses/wh-1')

  const sectionGroup = await screen.findByRole('group', {
    name: 'Секція: Секція B',
  })
  await user.click(
    within(sectionGroup).getByRole('button', { name: /^Секція B/ }),
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
  renderAt('/app/yard/inventory/warehouses/wh-1')

  await user.click(await screen.findByRole('button', { name: 'Додати секцію' }))
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
})

it('creates a zone in a side drawer for its warehouse', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/warehouses/wh-1')

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

it('explains that a real zone is needed before sections and opens the zone drawer', async () => {
  const user = userEvent.setup()
  api.getWarehouse.mockResolvedValue({
    ...(await api.getWarehouse()),
    zones: [
      {
        id: 'unassigned',
        name: 'Без зони',
        code: 'unassigned',
        isSystemUnassigned: true,
        isActive: true,
      },
      {
        id: 'archived-zone',
        name: 'Стара зона',
        code: 'old',
        isSystemUnassigned: false,
        isActive: false,
      },
    ],
  })

  renderAt('/app/yard/inventory/warehouses/wh-1')

  const shelves = await screen.findByRole('region', {
    name: 'Секції та полиці за зонами',
  })
  expect(
    within(shelves).getByText(/спочатку додайте зону/i),
  ).toBeInTheDocument()
  expect(
    within(shelves).queryByRole('button', { name: 'Додати секцію' }),
  ).not.toBeInTheDocument()

  await user.click(within(shelves).getByRole('button', { name: 'Додати зону' }))
  expect(screen.getByRole('dialog', { name: 'Нова зона' })).toBeInTheDocument()
})

it('edits a zone in the same side drawer', async () => {
  const user = userEvent.setup()
  renderAt('/app/yard/inventory/warehouses/wh-1')

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
  renderAt('/app/yard/inventory/warehouses/wh-1')

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

it('updates edited section and shelf codes from their names', async () => {
  const user = userEvent.setup()
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
    },
  ])
  renderAt('/app/yard/inventory/warehouses/wh-1')

  const zone = await screen.findByRole('region', {
    name: 'Зона: Стелаж A1',
  })
  const sectionGroup = within(zone).getByRole('group', {
    name: 'Секція: Секція B',
  })
  await user.click(
    within(sectionGroup).getByRole('button', { name: /^Секція B/ }),
  )
  expect(within(sectionGroup).getByText('Полиця')).toBeInTheDocument()
  await user.click(
    within(sectionGroup).getByRole('button', {
      name: 'Редагувати секцію Секція B',
    }),
  )
  const section = screen.getByRole('dialog', { name: 'Редагувати секцію' })
  const sectionName = within(section).getByRole('textbox', { name: 'Назва' })
  const sectionCode = within(section).getByRole('textbox', { name: 'Код' })
  await user.clear(sectionName)
  expect(sectionCode).toHaveValue('')
  await user.type(sectionName, 'Секція C')
  expect(sectionCode).toHaveValue('sektsiya-c')
  await user.click(within(section).getByRole('button', { name: 'Скасувати' }))

  await user.click(
    screen.getByRole('button', { name: 'Дії з полицею Полиця 1' }),
  )
  await user.click(screen.getByRole('menuitem', { name: 'Редагувати полицю' }))
  const shelf = screen.getByRole('dialog', { name: 'Редагувати полицю' })
  const shelfName = within(shelf).getByRole('textbox', { name: 'Назва' })
  const shelfCode = within(shelf).getByRole('textbox', { name: 'Код' })
  await user.clear(shelfName)
  expect(shelfCode).toHaveValue('')
  await user.type(shelfName, 'Полиця 2')
  expect(shelfCode).toHaveValue('polytsya-2')
})

it('counts the warehouse stock from the parts module', async () => {
  renderAt('/app/yard/inventory/warehouses/wh-1')

  await screen.findByText('Стелаж A1')
  // Both figures come from the parts search, scoped to this warehouse.
  expect(parts.search).toHaveBeenCalledWith(
    { warehouseIds: ['wh-1'], pageSize: 1 },
    expect.anything(),
  )
  const stock = screen.getByText('Позицій на складі').closest('div')
  expect(within(stock as HTMLElement).getByText('20')).toBeInTheDocument()
  const differing = screen.getByText('Розходження').closest('div')
  expect(within(differing as HTMLElement).getByText('3')).toBeInTheDocument()
  // The zone facet says how much of that stock sits in each zone.
  expect(screen.getByText('18')).toBeInTheDocument()
})

it('offers to continue the session that is already counting this warehouse', async () => {
  renderAt('/app/yard/inventory/warehouses/wh-1')

  const rail = await screen.findByRole('region', { name: 'Активна сесія' })
  expect(
    within(rail).getByRole('link', { name: 'Продовжити сесію' }),
  ).toHaveAttribute('href', '/app/yard/inventory/sessions/session-1')
  // The zone is being counted right now, so its check column says so.
  expect(screen.getByText('триває')).toBeInTheDocument()
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
