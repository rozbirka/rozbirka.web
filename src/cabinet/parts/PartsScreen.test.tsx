import { FeatureFlagsProvider } from '../FeatureFlags'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '@/api/types'
import { LocaleProvider, type Locale } from '@/i18n'
import { PartsScreen } from './PartsScreen'
import { resetOnboardingCache } from '../onboarding/use-owner-onboarding'
import { ToastProvider } from '@/components/app'

const inventoryMocks = vi.hoisted(() => ({
  getPartZones: vi.fn().mockResolvedValue([
    {
      isSystemUnassigned: false,
      warehouseId: 'wh-1',
      warehouseName: 'Склад А',
      zoneCode: 'A-3-2',
      zoneId: 'zone-1',
      zoneName: 'Стелаж 3 · полиця 2',
      zoneQrCode: 'QR',
    },
  ]),
}))

const equipmentMocks = vi.hoisted(() => ({
  types: vi.fn().mockResolvedValue([
    // Ordered by name, as Core returns them: lorries come before cars.
    { id: 'type-truck', code: 'commercial_truck', name: 'Вантажний транспорт' },
    { id: 'type-car', code: 'passenger_car', name: 'Легковий автомобіль' },
  ]),
  makes: vi
    .fn()
    .mockResolvedValue([
      { id: 'make-ford', equipmentTypeId: 'type-car', name: 'Ford' },
    ]),
  models: vi
    .fn()
    .mockResolvedValue([
      { id: 'model-focus', makeId: 'make-ford', name: 'Focus' },
    ]),
}))

const flagMocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/feature-flags', () => ({
  FEATURE_FLAGS: { partsBulkImport: 'parts.bulk-import' },
  featureFlagsApi: flagMocks,
}))

const partMocks = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 0,
  }),
  summary: vi
    .fn()
    .mockResolvedValue({ total: 0, available: 0, reserved: 0, sold: 0 }),
  makes: vi.fn().mockResolvedValue(['Ford', 'Tesla']),
  search: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 0,
  }),
  facets: vi.fn().mockResolvedValue({
    statuses: [
      { id: 'available', name: 'available', count: 939 },
      { id: 'reserved', name: 'reserved', count: 39 },
      { id: 'sold', name: 'sold', count: 318 },
    ],
    warehouses: [{ id: 'w1', name: 'Львів, Городоцька', count: 12 }],
    zones: [],
    conditions: [
      { id: 'good', name: 'good', count: 812 },
      { id: 'fair', name: 'fair', count: 361 },
      { id: 'scrap', name: 'scrap', count: 123 },
    ],
    equipmentTypes: [],
    makes: [{ id: 'make-ford', name: 'Ford', count: 40 }],
    models: [{ id: 'model-focus', name: 'Focus', count: 12 }],
    generations: [],
    origins: [
      { id: 'car', name: 'car', count: 900 },
      { id: 'batch', name: 'batch', count: 300 },
      { id: 'free', name: 'free', count: 96 },
    ],
    qualityFlags: [],
    inventoryLocks: [],
    discrepancies: [],
  }),
  get: vi.fn().mockResolvedValue(null),
  history: vi.fn().mockResolvedValue({ partId: 'part-1', events: [] }),
  create: vi.fn().mockResolvedValue({ id: 'part-1' }),
  compatibilities: vi.fn().mockResolvedValue({
    partId: 'part-1',
    version: 'v1',
    items: [
      {
        id: 'compat-1',
        equipmentTypeId: 'type-car',
        equipmentTypeName: 'Легковий автомобіль',
        makeId: 'make-ford',
        makeName: 'Ford',
        modelId: 'model-focus',
        modelName: 'Focus',
        yearFrom: 2018,
        yearTo: 2018,
        evidenceType: 'DonorObservation',
      },
    ],
  }),
  replaceCompatibilities: vi
    .fn()
    .mockResolvedValue({ partId: 'part-1', version: 'v2', items: [] }),
  update: vi.fn().mockResolvedValue({ id: 'part-1' }),
  delete: vi.fn().mockResolvedValue(undefined),
}))
const selectorMocks = vi.hoisted(() => ({
  cars: vi.fn(),
  car: vi.fn(),
  intakes: vi.fn(),
}))
const mediaMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
}))
const cabinetMock = vi.hoisted(() => ({
  // Older contract by default: no accounting currency reported at all.
  tenant: {
    id: 'tenant-1',
    slug: 'yard',
    accountingCurrency: null as string | null,
    currencyLocked: null as boolean | null,
  },
  snapshot: {
    userId: 'user-1',
    tenantId: 'tenant-1',
    generation: 1,
    role: 'owner',
    permissions: new Set([
      'parts.view',
      'parts.manage',
      'cars.view',
      'intakes.view',
      'orders.view',
    ]),
    features: new Set<string>(),
    entitlement: {
      state: 'active',
      usage: {
        cars: { used: 1, max: 10 },
        intakes: { used: 1, max: 10 },
        parts: { used: 1, max: 10 },
        users: { used: 1, max: 10 },
        cashRegisters: { used: 1, max: 10 },
      },
    },
    subscription: null,
  },
}))

const partsDefinition = {
  key: 'parts',
  routeSegment: '/parts',
  viewPermission: 'parts.view',
  mutationPermission: 'parts.manage',
  allowedSubscriptionStates: ['trial', 'active', 'pastDue', 'cancelled'],
  quotaResource: 'parts',
}

vi.mock('@/api/parts', () => ({ partsApi: partMocks }))
vi.mock('@/api/equipment', () => ({ equipmentApi: equipmentMocks }))
vi.mock('@/api/inventory', () => ({ inventoryApi: inventoryMocks }))
vi.mock('@/api/cars', () => ({
  carsApi: { get: selectorMocks.car, list: selectorMocks.cars },
}))
vi.mock('@/api/intakes', () => ({
  intakesApi: { list: selectorMocks.intakes },
}))
vi.mock('@/api/media', () => ({
  mediaApi: { upload: mediaMocks.upload, remove: mediaMocks.remove },
}))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    snapshot: cabinetMock.snapshot,
    error: null,
    targetTenant: cabinetMock.tenant,
  }),
}))
const tenantMocks = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/tenants', () => ({ tenantsApi: tenantMocks }))
const onboardingMocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }))
vi.mock('@/api/onboarding', () => ({ onboardingApi: onboardingMocks }))
const onboardingFacts = {
  eligible: true,
  deferred: false,
  dismissed: false,
  completed: false,
  settingsCompleted: true,
  currencySelected: true,
  sourceCreated: true,
  firstPartCreated: false,
}

beforeEach(() => {
  resetOnboardingCache()
  onboardingMocks.get
    .mockReset()
    .mockResolvedValue({ ...onboardingFacts, eligible: false })
  cabinetMock.tenant = {
    id: 'tenant-1',
    slug: 'yard',
    accountingCurrency: null,
    currencyLocked: null,
  }
  tenantMocks.list
    .mockReset()
    .mockImplementation(() => Promise.resolve([cabinetMock.tenant]))
  partMocks.list.mockReset().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 0,
  })
  partMocks.summary
    .mockReset()
    .mockResolvedValue({ total: 0, available: 0, reserved: 0, sold: 0 })
  partMocks.makes.mockReset().mockResolvedValue(['Ford', 'Tesla'])
  partMocks.search.mockClear()
  partMocks.facets.mockClear()
  partMocks.get.mockReset().mockResolvedValue(null)
  partMocks.history
    .mockReset()
    .mockResolvedValue({ partId: 'part-1', events: [] })
  partMocks.create.mockReset().mockResolvedValue({ id: 'part-1' })
  partMocks.update.mockReset().mockResolvedValue({ id: 'part-1' })
  partMocks.delete.mockReset().mockResolvedValue(undefined)
  selectorMocks.cars.mockReset().mockResolvedValue({
    items: [
      {
        id: 'car-1',
        code: 'CAR-01',
        brand: 'Ford',
        model: 'Focus',
        year: 2018,
      },
    ],
    page: 1,
    pageSize: 100,
    total: 1,
    totalPages: 1,
  })
  selectorMocks.car.mockReset().mockResolvedValue({
    id: 'car-1',
    code: 'CAR-01',
    brand: 'Ford',
    model: 'Focus',
    year: 2018,
  })
  selectorMocks.intakes.mockReset().mockResolvedValue({
    items: [
      {
        id: 'intake-1',
        name: 'Партія серпень',
        supplier: 'Постачальник',
      },
    ],
    page: 1,
    pageSize: 100,
    total: 1,
    totalPages: 1,
  })
  mediaMocks.upload.mockReset()
  mediaMocks.remove.mockReset().mockResolvedValue(undefined)
  cabinetMock.snapshot.permissions = new Set([
    'parts.view',
    'parts.manage',
    'cars.view',
    'intakes.view',
    'orders.view',
  ])
  cabinetMock.snapshot.features = new Set<string>()
  cabinetMock.snapshot.entitlement = {
    state: 'active',
    usage: {
      cars: { used: 1, max: 10 },
      intakes: { used: 1, max: 10 },
      parts: { used: 1, max: 10 },
      users: { used: 1, max: 10 },
      cashRegisters: { used: 1, max: 10 },
    },
  }
})

it('returns from the new-part drawer to the parts directory', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '/app/:tenant',
        children: [
          { path: 'parts', element: <p>Екран деталей</p> },
          {
            path: 'parts/new',
            element: <PartsScreen definition={partsDefinition as never} />,
          },
        ],
      },
    ],
    { initialEntries: ['/app/yard/parts/new'] },
  )
  const user = userEvent.setup()
  render(<RouterProvider router={router} />)

  await user.click(screen.getByRole('button', { name: 'Скасувати' }))

  expect(router.state.location.pathname).toBe('/app/yard/parts')
  expect(screen.getByText('Екран деталей')).toBeVisible()
})

it('opens the newly created part instead of leaving the creation drawer open', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '/app/:tenant',
        children: [
          {
            path: 'parts/new',
            element: <PartsScreen definition={partsDefinition as never} />,
          },
          { path: 'parts/:partId', element: <p>Картка деталі</p> },
        ],
      },
    ],
    { initialEntries: ['/app/yard/parts/new?car_id=car-1'] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )

  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Дзеркало' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  expect(await screen.findByText('Картка деталі')).toBeVisible()
  expect(router.state.location.pathname).toBe('/app/yard/parts/part-1')
  expect(screen.queryByRole('dialog', { name: 'Нова деталь' })).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('Деталь створено.')
})

async function expectPartFormClosed() {
  await vi.waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="Поточний маршрут">{location.search}</output>
      <button onClick={() => void navigate(-1)} type="button">
        Назад
      </button>
    </>
  )
}

function DetailNavigation() {
  const navigate = useNavigate()
  return (
    <button onClick={() => void navigate('/app/yard/parts/part-2')}>
      Інша деталь
    </button>
  )
}

it('normalizes invalid URL filters before requesting inventory', async () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/app/yard/parts?status=invalid&page=0&per_page=999&car_ids=&intake_ids=intake-1',
      ]}
    >
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={
            <>
              <PartsScreen definition={partsDefinition as never} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

  await vi.waitFor(() =>
    expect(partMocks.search).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 30 }),
      expect.anything(),
    ),
  )
  expect(partMocks.search.mock.calls.at(-1)?.[0]).not.toHaveProperty('statuses')
  expect(partMocks.search.mock.calls.at(-1)?.[0]).not.toHaveProperty('carIds')
  const statusRow = (name: string | RegExp) =>
    within(screen.getByRole('region', { name: 'Статус' })).getByRole('button', {
      name,
    })
  expect(statusRow(/Усі/)).toHaveAttribute('aria-pressed', 'true')
  expect(
    within(
      screen.getByRole('radiogroup', {
        name: 'Кількість деталей на сторінці',
      }),
    ).getByRole('radio', { name: '30' }),
  ).toBeChecked()
  await vi.waitFor(() =>
    expect(screen.getByLabelText('Поточний маршрут')).toHaveTextContent(
      'page=1&per_page=30&intake_ids=intake-1',
    ),
  )
  await vi.waitFor(() => expect(partMocks.search).toHaveBeenCalledTimes(2))
})

it('keeps controlled filters synced with back navigation and resets page when filters change', async () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/app/yard/parts?status=available&page=2',
        '/app/yard/parts?status=reserved&page=3',
      ]}
      initialIndex={1}
    >
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={
            <>
              <PartsScreen definition={partsDefinition as never} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

  const statusRow = (name: string | RegExp) =>
    within(screen.getByRole('region', { name: 'Статус' })).getByRole('button', {
      name,
    })
  expect(statusRow(/У резерві/)).toHaveAttribute('aria-pressed', 'true')
  const make = screen.getByLabelText('Марка')
  // Options arrive with the facets, so wait for the one we are about to pick.
  await vi.waitFor(() =>
    expect(within(make).getByRole('option', { name: /Ford/ })).toBeDefined(),
  )
  fireEvent.change(make, { target: { value: 'make-ford' } })
  expect(screen.getByLabelText('Поточний маршрут')).toHaveTextContent(
    'make=make-ford',
  )
  expect(screen.getByLabelText('Поточний маршрут').textContent).not.toMatch(
    /(?:^|[?&])page=3(?:&|$)/,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Назад' }))
  await vi.waitFor(() =>
    expect(statusRow(/У резерві/)).toHaveAttribute('aria-pressed', 'true'),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }))
  await vi.waitFor(() =>
    expect(statusRow(/В наявності/)).toHaveAttribute('aria-pressed', 'true'),
  )
})

it('uses server-authoritative pagination metadata for previous and next links', async () => {
  partMocks.search.mockResolvedValueOnce({
    items: [],
    page: 2,
    pageSize: 30,
    total: 90,
    totalPages: 3,
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts?page=99']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={
            <>
              <PartsScreen definition={partsDefinition as never} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Сторінка 2 з 3')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  expect(screen.getByLabelText('Поточний маршрут')).toHaveTextContent('page=3')
})

it('accepts an unbounded positive page while limiting page size to 100', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts?page=101&per_page=101']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  await vi.waitFor(() =>
    expect(partMocks.search).toHaveBeenCalledWith(
      expect.objectContaining({ page: 101, pageSize: 30 }),
      expect.anything(),
    ),
  )
})

it('does not request car or intake selectors without their view permissions', async () => {
  cabinetMock.snapshot.permissions = new Set(['parts.view', 'parts.manage'])
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  await vi.waitFor(() => expect(partMocks.search).toHaveBeenCalled())
  expect(selectorMocks.cars).not.toHaveBeenCalled()
  expect(selectorMocks.intakes).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Авто')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Приймання')).not.toBeInTheDocument()
})

it('does not offer or request unauthorized source selectors on create', () => {
  cabinetMock.snapshot.permissions = new Set(['parts.view', 'parts.manage'])
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.queryByRole('option', { name: 'Автомобіль' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('option', { name: 'Партія' }),
  ).not.toBeInTheDocument()
  expect(selectorMocks.cars).not.toHaveBeenCalled()
  expect(selectorMocks.intakes).not.toHaveBeenCalled()
})

it('loads only the source selector that becomes relevant', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(selectorMocks.cars).toHaveBeenCalledOnce()
  expect(selectorMocks.intakes).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /З авто/ }))
  await screen.findByRole('option', { name: 'CAR-01 · Ford Focus (2018)' })
  expect(selectorMocks.cars).toHaveBeenCalledOnce()
  expect(selectorMocks.intakes).not.toHaveBeenCalled()
})

it('shows server-authoritative compatibility as read-only when mutation is absent from the contract', async () => {
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Bumper',
    condition: 'used',
    status: 'available',
    source: 'free',
    quantityTotal: 1,
    quantityAvailable: 1,
    quantityReserved: 0,
    quantitySoldTotal: 0,
    compatCarBrand: null,
    compatCarModel: null,
    compatCarYear: null,
    oemCode: null,
    effectiveSalePrice: null,
    photos: [],
    reservations: null,
    order: null,
    soldOrders: null,
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const card = await screen.findByRole('region', { name: /Сумісність/ })
  expect(within(card).getByText('Ford Focus')).toBeVisible()
  expect(within(card).getByText('2018')).toBeVisible()
  // The donor row is Core's own, and the screen says so rather than offering
  // an edit that would be refused.
  expect(within(card).getByText('авто-джерело, не редагується')).toBeVisible()
  expect(screen.queryByLabelText('Марка')).not.toBeInTheDocument()
})

it('shows a Ukrainian photo picker with previews for selected part photos', () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByLabelText('Фото деталі')).toHaveAttribute('multiple')
  expect(screen.getByLabelText('Фото деталі')).toHaveAttribute(
    'accept',
    'image/*',
  )
  expect(screen.getByText('Вибрати фото')).toBeVisible()

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:part-photo'),
  })
  fireEvent.change(screen.getByLabelText('Фото деталі'), {
    target: {
      files: [new File(['photo'], 'bumper.jpg', { type: 'image/jpeg' })],
    },
  })

  expect(
    screen.getByRole('img', { name: 'Попередній перегляд bumper.jpg' }),
  ).toHaveAttribute('src', 'blob:part-photo')
  expect(
    screen.getByText(/Файли завантажаться разом зі створенням деталі/),
  ).toBeInTheDocument()
})

it('uses the fixed mobile condition vocabulary when creating a part', () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const conditionCard = screen.getByRole('region', { name: /Стан деталі/ })
  const condition = within(conditionCard).getByRole('radiogroup', {
    name: /Стан деталі/,
  })

  expect(within(condition).getAllByRole('radio')).toHaveLength(3)
  expect(
    within(condition).getByRole('radio', { name: 'Хороший' }),
  ).toHaveAttribute('aria-checked', 'true')
  expect(
    within(condition).getByRole('radio', { name: 'Задовільний' }),
  ).toBeVisible()
  expect(
    within(condition).getByRole('radio', { name: 'На запчастини' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('combobox', { name: 'Стан' }),
  ).not.toBeInTheDocument()
})

it('shows the fixed condition choices in a separate card when editing a part', async () => {
  partMocks.get.mockResolvedValueOnce({
    id: 'part-1',
    source: 'free',
    carId: null,
    intakeId: null,
    name: 'Дзеркало дверей L',
    quantityTotal: 1,
    unit: 'pcs',
    condition: 'fair',
    notes: null,
    oemCode: null,
    partType: null,
    desiredSalePrice: null,
  })

  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1/edit']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId/edit"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const descriptionCard = await screen.findByRole('region', {
    name: 'Опис деталі',
  })
  const conditionCard = screen.getByRole('region', { name: /Стан деталі/ })
  const condition = within(conditionCard).getByRole('radiogroup', {
    name: /Стан деталі/,
  })

  expect(
    within(descriptionCard).queryByRole('radiogroup'),
  ).not.toBeInTheDocument()
  expect(within(condition).getAllByRole('radio')).toHaveLength(3)
  expect(
    within(condition).getByRole('radio', { name: 'Задовільний' }),
  ).toHaveAttribute('aria-checked', 'true')
  expect(
    screen.queryByRole('combobox', { name: 'Стан' }),
  ).not.toBeInTheDocument()
})

it('creates a part with every supported source, inventory, price, and compatibility field', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ Results: [{ MakeId: 1, MakeName: 'Ford' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ Results: [{ Model_ID: 2, Model_Name: 'Focus' }] }),
      }),
  )
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?intake_id=intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Front bumper' },
  })
  for (const [label, value] of [
    ['Кількість', '3'],
    ['Нотатки', 'Scratch'],
    ['OEM-код', 'OEM-1'],
    ['Тип деталі', 'body'],
    ['Бажана ціна', '125.5'],
  ] as const) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  fireEvent.click(screen.getByRole('radio', { name: 'Хороший' }))

  fireEvent.click(screen.getByRole('button', { name: 'Додати ще авто' }))
  const vehicle = within(screen.getByRole('region', { name: 'Авто 1' }))
  fireEvent.click(vehicle.getByRole('button', { name: 'Марка' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Ford' }))
  fireEvent.click(vehicle.getByRole('button', { name: 'Модель' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Focus' }))
  fireEvent.change(vehicle.getByLabelText('Рік'), { target: { value: '2018' } })
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await expectPartFormClosed()
  expect(partMocks.create).toHaveBeenCalledWith(
    {
      sourceType: 'batch',
      intakeId: 'intake-1',
      name: 'Front bumper',
      quantity: 3,
      unit: 'шт',
      condition: 'good',
      notes: 'Scratch',
      oemCode: 'OEM-1',
      partType: 'body',
      desiredSalePrice: 125.5,
      photoKeys: [],
      compatibilities: [
        {
          equipmentTypeId: 'type-car',
          makeId: 'make-ford',
          modelId: 'model-focus',
          yearFrom: 2018,
          yearTo: 2018,
        },
      ],
    },
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})
it('retains successful media uploads while exposing retry and remove for each failed file', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  mediaMocks.upload
    .mockResolvedValueOnce({
      storageKey: 'pending/parts/bumper.jpg',
      url: 'https://cdn.example/bumper.jpg',
    })
    .mockRejectedValueOnce(new Error('upload failed'))
    .mockResolvedValueOnce({
      storageKey: 'pending/parts/mirror.jpg',
      url: 'https://cdn.example/mirror.jpg',
    })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?intake_id=intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  fireEvent.change(screen.getByLabelText('Фото деталі'), {
    target: {
      files: [
        new File(['one'], 'bumper.jpg', { type: 'image/jpeg' }),
        new File(['two'], 'mirror.jpg', { type: 'image/jpeg' }),
      ],
    },
  })

  expect(screen.getByText('bumper.jpg · Вибрано')).toBeInTheDocument()
  expect(screen.getByText('mirror.jpg · Вибрано')).toBeInTheDocument()
  expect(mediaMocks.upload).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  expect(
    await screen.findByText('bumper.jpg · Завантажено'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('mirror.jpg · Помилка завантаження'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Створити деталь' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Повторити mirror.jpg' }))
  await screen.findByText('mirror.jpg · Завантажено')
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await expectPartFormClosed()
  expect(mediaMocks.upload).toHaveBeenCalledTimes(3)
  expect(partMocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      photoKeys: ['pending/parts/bumper.jpg', 'pending/parts/mirror.jpg'],
    }),
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('removes a selected file without uploading it before save', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  mediaMocks.upload.mockResolvedValue({
    storageKey: 'pending/parts/bumper.jpg',
    url: 'https://cdn.example/bumper.jpg',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?intake_id=intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  fireEvent.change(screen.getByLabelText('Фото деталі'), {
    target: {
      files: [new File(['one'], 'bumper.jpg', { type: 'image/jpeg' })],
    },
  })
  expect(screen.getByText('bumper.jpg · Вибрано')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Прибрати bumper.jpg' }))
  await vi.waitFor(() =>
    expect(screen.queryByText(/bumper.jpg ·/)).not.toBeInTheDocument(),
  )
  expect(mediaMocks.upload).not.toHaveBeenCalled()
  expect(mediaMocks.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await expectPartFormClosed()
  expect(partMocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ photoKeys: [] }),
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('allows pending part media selection and removal after quota becomes full', async () => {
  mediaMocks.upload.mockResolvedValue({
    storageKey: 'pending/parts/bumper.jpg',
    url: 'https://cdn.example/bumper.jpg',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  cabinetMock.snapshot.entitlement.usage.parts = { used: 10, max: 10 }
  fireEvent.change(screen.getByLabelText('Фото деталі'), {
    target: {
      files: [new File(['one'], 'bumper.jpg', { type: 'image/jpeg' })],
    },
  })
  expect(screen.getByText('bumper.jpg · Вибрано')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Прибрати bumper.jpg' }))

  await vi.waitFor(() =>
    expect(screen.queryByText(/bumper.jpg ·/)).not.toBeInTheDocument(),
  )
  expect(mediaMocks.upload).not.toHaveBeenCalled()
  expect(mediaMocks.remove).not.toHaveBeenCalled()
})

it('persists a tenant-authorized labeled car selection without exposing its raw id', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  fireEvent.click(screen.getByRole('button', { name: /З авто/ }))
  fireEvent.change(await screen.findByLabelText('Автомобіль-джерело'), {
    target: { value: 'car-1' },
  })

  expect(
    await screen.findByText('CAR-01 · Ford Focus (2018)'),
  ).toBeInTheDocument()
  expect(screen.queryByLabelText('ID джерела')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Марка сумісності')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))
  await expectPartFormClosed()
  expect(partMocks.create).toHaveBeenCalledWith(
    {
      sourceType: 'car',
      carId: 'car-1',
      name: 'Bumper',
      quantity: 1,
      unit: 'шт',
      condition: 'good',
      photoKeys: [],
    },
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('rechecks cars.view before creating a car-sourced part', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  fireEvent.click(screen.getByRole('button', { name: /З авто/ }))
  fireEvent.change(await screen.findByLabelText('Автомобіль-джерело'), {
    target: { value: 'car-1' },
  })
  cabinetMock.snapshot.permissions.delete('cars.view')
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await Promise.resolve()
  expect(partMocks.create).not.toHaveBeenCalled()
})

it('rechecks intakes.view before creating an intake-sourced part', async () => {
  cabinetMock.snapshot.features = new Set([FEATURES.IntakeManagement])
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  fireEvent.click(screen.getByRole('button', { name: /З партії/ }))
  fireEvent.change(await screen.findByLabelText('Партія-джерело'), {
    target: { value: 'intake-1' },
  })
  cabinetMock.snapshot.permissions.delete('intakes.view')
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await Promise.resolve()
  expect(partMocks.create).not.toHaveBeenCalled()
})

it('loads existing edit values and updates every field accepted by the immutable request', async () => {
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Front bumper',
    source: 'car',
    carId: 'car-1',
    carCode: 'CAR-01',
    carBrand: 'Ford',
    carModel: 'Focus',
    carYear: 2018,
    intakeId: null,
    quantityTotal: 2,
    quantityAvailable: 2,
    quantityReserved: 0,
    qrCode: 'RZB-26-1',
    createdByName: 'Olena',
    createdAt: '2026-08-01T10:00:00Z',
    unit: 'pcs',
    condition: 'used',
    notes: 'Old note',
    oemCode: 'OEM-read-only',
    partType: 'body',
    desiredSalePrice: 100,
    photos: [
      {
        id: 'photo-1',
        storageKey: 'tenant-secret/existing.jpg',
        url: 'https://cdn.example/existing.jpg',
        thumbnailUrl: 'https://cdn.example/existing-thumb.jpg',
        sortOrder: 0,
      },
    ],
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1/edit']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId/edit"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByLabelText('Назва')).toHaveValue('Front bumper')
  // The source is stated, not editable — it is fixed when the part is born.
  expect(await screen.findByText(/З авто · CAR-01/)).toBeInTheDocument()
  expect(screen.queryByLabelText('ID джерела')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Тип джерела')).not.toBeInTheDocument()
  expect(screen.getByLabelText('OEM-код')).toHaveValue('OEM-read-only')
  // The stepper is a text field with numeric input mode, not <input type=number>.
  expect(screen.getByLabelText('Кількість')).toHaveValue('2')
  expect(screen.getByRole('link', { name: 'Існуюче фото 1' })).toHaveAttribute(
    'href',
    'https://cdn.example/existing.jpg',
  )
  expect(screen.queryByText(/tenant-secret/)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Rear bumper' },
  })
  fireEvent.change(screen.getByLabelText('Кількість'), {
    target: { value: '4' },
  })
  fireEvent.change(screen.getByLabelText('Бажана ціна'), {
    target: { value: '' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }))

  expect(await screen.findByText('Зміни збережено.')).toBeInTheDocument()
  expect(partMocks.update).toHaveBeenCalledWith(
    'part-1',
    {
      name: 'Rear bumper',
      condition: 'used',
      notes: 'Old note',
      quantity: 4,
      partType: 'body',
      unit: 'шт',
      photoKeys: ['tenant-secret/existing.jpg'],
      desiredSalePrice: { isSet: true, value: null },
    },
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
})

it('guards duplicate creates with aria-busy and exposes mutation failures', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  let rejectCreate: ((reason: unknown) => void) | undefined
  partMocks.create.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectCreate = reject
      }),
  )
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?intake_id=intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  const submit = screen.getByRole('button', { name: 'Створити деталь' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  expect(submit).toHaveAttribute('aria-busy', 'true')
  expect(submit).toBeDisabled()
  const cancel = screen.getByRole('button', { name: 'Скасувати' })
  expect(cancel).toBeDisabled()
  fireEvent.click(cancel)
  expect(screen.getByRole('dialog', { name: 'Нова деталь' })).toBeVisible()
  expect(partMocks.create).toHaveBeenCalledTimes(1)
  rejectCreate?.(new Error('failed'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося створити деталь.',
  )
})

it('guards duplicate edits with aria-busy and exposes mutation failures', async () => {
  partMocks.get.mockResolvedValueOnce({
    id: 'part-1',
    source: 'free',
    carId: null,
    intakeId: null,
    name: 'Bumper',
    quantityTotal: 1,
    unit: 'pcs',
    condition: 'used',
    notes: null,
    oemCode: null,
    partType: null,
    desiredSalePrice: null,
  })
  let rejectUpdate: ((reason: unknown) => void) | undefined
  partMocks.update.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectUpdate = reject
      }),
  )
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1/edit']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId/edit"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  const submit = await screen.findByRole('button', { name: 'Зберегти зміни' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  expect(submit).toHaveAttribute('aria-busy', 'true')
  expect(submit).toBeDisabled()
  expect(partMocks.update).toHaveBeenCalledTimes(1)
  rejectUpdate?.(new Error('failed'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося зберегти зміни.',
  )
})

it('uses opaque media labels and never renders storage keys', async () => {
  partMocks.get.mockResolvedValueOnce({
    id: 'part-1',
    name: 'Bumper',
    quantityAvailable: 1,
    quantityReserved: 0,
    compatCarBrand: null,
    compatCarModel: null,
    compatCarYear: null,
    oemCode: null,
    condition: 'used',
    status: 'available',
    effectiveSalePrice: null,
    source: 'free',
    reservations: null,
    order: null,
    soldOrders: null,
    photos: [
      {
        id: 'photo-1',
        storageKey: 'tenant-secret/internal/key.jpg',
        url: 'https://cdn.example/photo.jpg',
      },
    ],
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const photo = await screen.findByAltText('Фото деталі Bumper 1')
  expect(photo).toHaveAttribute('src', 'https://cdn.example/photo.jpg')
  expect(screen.queryByText(/tenant-secret/)).not.toBeInTheDocument()
})

it('confirms deletion, prevents duplicates, and reports a server conflict', async () => {
  partMocks.delete.mockRejectedValueOnce({ response: { status: 409 } })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'Деталь' })
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Інші дії з деталлю' }))
  await user.click(
    await screen.findByRole('menuitem', { name: 'Видалити деталь' }),
  )
  const confirmDelete = await screen.findByRole('button', { name: 'Видалити' })
  fireEvent.click(confirmDelete)
  fireEvent.click(confirmDelete)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося видалити деталь через конфлікт.',
  )
  expect(partMocks.delete).toHaveBeenCalledTimes(1)
})

it('fails closed on create when parts.manage is absent', () => {
  cabinetMock.snapshot.permissions = new Set(['parts.view'])
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByRole('alert')).toHaveTextContent('Недостатньо прав')
  expect(screen.queryByRole('button', { name: 'Створити деталь' })).toBeNull()
})

it('rechecks the latest parts permission before dispatching create', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  cabinetMock.snapshot.permissions.delete('parts.manage')
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await Promise.resolve()
  expect(partMocks.create).not.toHaveBeenCalled()
})

it('rechecks the latest parts quota before dispatching create', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  cabinetMock.snapshot.entitlement.usage.parts = { used: 10, max: 10 }
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await Promise.resolve()
  expect(partMocks.create).not.toHaveBeenCalled()
})

it('applies the parts quota only to create, not edit or delete', async () => {
  cabinetMock.snapshot.entitlement = {
    ...cabinetMock.snapshot.entitlement,
    usage: {
      ...cabinetMock.snapshot.entitlement.usage,
      parts: { used: 10, max: 10 },
    },
  }
  const create = render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Ліміт деталей вичерпано')
  create.unmount()

  partMocks.get.mockResolvedValue({
    id: 'part-1',
    source: 'free',
    carId: null,
    intakeId: null,
    name: 'Bumper',
    quantityTotal: 1,
    unit: 'pcs',
    condition: 'used',
    notes: null,
    oemCode: null,
    partType: null,
    desiredSalePrice: null,
  })
  const edit = render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1/edit']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId/edit"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(
    await screen.findByRole('button', { name: 'Зберегти зміни' }),
  ).toBeEnabled()
  edit.unmount()

  partMocks.get.mockResolvedValue(null)
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Інші дії з деталлю' }),
  )
  await user.click(
    await screen.findByRole('menuitem', { name: 'Видалити деталь' }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Видалити' }))
  await vi.waitFor(() =>
    expect(partMocks.delete).toHaveBeenCalledWith(
      'part-1',
      expect.objectContaining({
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    ),
  )
})

it('renders the immutable detail and history contract with permission-aware links', async () => {
  cabinetMock.snapshot.permissions.add('inventory.view')
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Bumper',
    notes: 'Small scratch',
    source: 'car',
    carId: 'car-1',
    carCode: 'CAR-01',
    intakeId: null,
    quantityTotal: 4,
    quantityAvailable: 1,
    quantityReserved: 1,
    quantitySoldTotal: 2,
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
    compatCarBrand: null,
    compatCarModel: null,
    compatCarYear: null,
    oemCode: null,
    condition: 'used',
    status: 'available',
    effectiveSalePrice: 100,
    photos: [],
    reservations: [
      {
        orderId: 'order-1',
        orderNumber: 42,
        quantity: 1,
        customerName: 'Ivan',
      },
    ],
    order: {
      id: 'order-2',
      number: 43,
      status: 'draft',
      customerName: null,
      createdAt: '2026-08-28T12:00:00Z',
      confirmedAt: null,
      payments: null,
    },
    soldOrders: [
      {
        orderId: 'order-3',
        orderNumber: 44,
        quantitySold: 2,
        unitPrice: 100,
        confirmedAt: '2026-08-28T13:00:00Z',
        customerName: 'Petro',
      },
    ],
  })
  partMocks.history.mockResolvedValue({
    partId: 'part-1',
    events: [
      {
        id: 'event-1',
        eventType: 'created',
        data: 'initial',
        createdAt: '2026-08-28T12:00:00Z',
        user: { id: 'user-1', name: 'Olena' },
        order: { id: 'order-1', number: 42 },
      },
    ],
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Small scratch')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Наявність' })).toHaveTextContent(
    'прийнято 4 шт',
  )
  // The split is in the availability card, with each figure named.
  const stock = screen.getByRole('region', { name: 'Наявність' })
  expect(stock).toHaveTextContent('Доступно')
  expect(stock).toHaveTextContent('У резерві')
  expect(stock).toHaveTextContent('Продано')
  // Who created the part sits with the note they wrote.
  const notes = screen.getByRole('region', { name: 'Нотатки' })
  expect(notes).toHaveTextContent('Створено')
  expect(notes).toHaveTextContent('Olena')
  // The source is one chip: kind, the car itself, then its plate.
  expect(screen.getByRole('link', { name: /З авто.*CAR-01/ })).toHaveAttribute(
    'href',
    '/app/yard/cars/car-1',
  )
  expect(screen.getByRole('link', { name: 'Редагувати' })).toHaveAttribute(
    'href',
    '/app/yard/parts/part-1/edit',
  )
  expect(screen.getByRole('link', { name: 'Перемістити' })).toHaveAttribute(
    'href',
    '/app/yard/parts/part-1/inventory',
  )
  expect(screen.getByRole('link', { name: 'Друк стікера' })).toHaveAttribute(
    'href',
    '/app/yard/stickers?part=part-1',
  )
  // The order is named on the event, not turned into a link: the row already
  // reads as one line.
  const historyCard = screen.getByRole('region', { name: 'Історія' })
  expect(historyCard).toHaveTextContent('№ 42')
  expect(within(historyCard).queryByRole('link', { name: /42/ })).toBeNull()
  const historySection = screen.getByRole('region', { name: 'Історія' })
  const created = within(historySection).getByRole('listitem')
  expect(created).toHaveTextContent('Створено')
  expect(created).toHaveTextContent('initial')
  expect(created).toHaveTextContent('Olena')
})

it('reads history payloads as facts and shows an order once', async () => {
  cabinetMock.snapshot.permissions.add('orders.view')
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Карта дверей',
    condition: 'good',
    status: 'reserved',
    source: 'batch',
    quantityTotal: 1,
    quantityAvailable: 0,
    quantityReserved: 1,
    quantitySoldTotal: 0,
    compatCarBrand: null,
    compatCarModel: null,
    compatCarYear: null,
    oemCode: null,
    effectiveSalePrice: 360,
    photos: [],
    createdByName: 'Андрій Мельник',
    createdAt: '2026-07-23T10:53:00Z',
    order: {
      id: 'order-284',
      number: 284,
      status: 'pending',
      customerName: 'Марина Данилюк',
      createdAt: '2026-08-25T16:09:00Z',
      confirmedAt: null,
      payments: null,
    },
    reservations: [
      {
        orderId: 'order-284',
        orderNumber: 284,
        quantity: 1,
        customerName: 'Марина Данилюк',
      },
    ],
    soldOrders: null,
  })
  partMocks.history.mockResolvedValue({
    partId: 'part-1',
    events: [
      {
        id: 'event-1',
        eventType: 'reserved',
        data: '{"order_id": "ee50afa2-e480", "quantity": 1, "order_number": 284}',
        createdAt: '2026-08-25T16:09:00Z',
        user: { id: 'user-2', name: 'Олександр Ковальчук' },
        order: { id: 'order-284', number: 284 },
      },
      {
        id: 'event-2',
        eventType: 'edited',
        data: '{}',
        createdAt: '2026-08-14T15:26:00Z',
        user: { id: 'user-3', name: 'Марія Бондаренко' },
        order: null,
      },
    ],
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const history = await screen.findByRole('region', { name: 'Історія' })
  const [reserved, edited] = within(history).getAllByRole('listitem')
  // Storage ids and braces are not facts a person reads.
  expect(reserved).toHaveTextContent('Зарезервовано')
  expect(reserved).toHaveTextContent('кількість 1')
  expect(reserved).not.toHaveTextContent('ee50afa2')
  expect(reserved).not.toHaveTextContent('order_id')
  expect(edited).toHaveTextContent('Змінено')
  expect(edited).not.toHaveTextContent('{}')

  // The current order is one of the reservations, so it takes a single row.
  const sales = screen.getByRole('region', { name: 'Продажі' })
  expect(within(sales).getAllByRole('link', { name: '№ 284' })).toHaveLength(1)
})

it('counts every filter value from the server and narrows the search by it', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const conditions = await screen.findByRole('region', {
    name: /Стан деталі/,
  })
  // The numbers are the server's, counted under the rest of the filter.
  expect(
    within(conditions).getByRole('button', { name: /Хороший/i }),
  ).toHaveTextContent('812')
  expect(
    within(conditions).getByRole('button', { name: /Задовільний/i }),
  ).toBeVisible()
  expect(
    within(conditions).getByRole('button', { name: /На запчастини/i }),
  ).toBeVisible()
  fireEvent.click(within(conditions).getByRole('button', { name: /Хороший/i }))

  await vi.waitFor(() =>
    expect(partMocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ conditions: ['good'] }),
      expect.anything(),
    ),
  )
  expect(partMocks.facets).toHaveBeenLastCalledWith(
    expect.objectContaining({ conditions: ['good'] }),
    expect.anything(),
    expect.anything(),
  )

  const origins = screen.getByRole('region', { name: 'Походження' })
  expect(within(origins).getByRole('button', { name: /З авто/i })).toBeVisible()
  expect(
    within(origins).getByRole('button', { name: /З партії/i }),
  ).toBeVisible()
})

it('keeps the selected car and fills its compatibility and placement filters', async () => {
  const carFacets = {
    statuses: [],
    warehouses: [{ id: 'w1', name: 'Львів, Городоцька', count: 12 }],
    zones: [{ id: 'z1', name: 'Стелаж A3', count: 5 }],
    conditions: [],
    equipmentTypes: [],
    makes: [{ id: 'make-ford', name: 'Ford', count: 12 }],
    models: [{ id: 'model-focus', name: 'Focus', count: 12 }],
    generations: [],
    origins: [],
    qualityFlags: [],
    inventoryLocks: [],
    discrepancies: [],
  }
  partMocks.facets
    .mockResolvedValueOnce(carFacets)
    .mockResolvedValueOnce(carFacets)

  render(
    <MemoryRouter initialEntries={['/app/yard/parts?car_ids=car-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={
            <>
              <PartsScreen definition={partsDefinition as never} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

  await vi.waitFor(() => {
    expect(screen.getByLabelText('Марка')).toHaveValue('make-ford')
    expect(screen.getByLabelText('Модель')).toHaveValue('model-focus')
    expect(screen.getByLabelText('Склад')).toHaveValue('w1')
    expect(screen.getByLabelText('Зона')).toHaveValue('z1')
  })
  expect(screen.getByLabelText('Поточний маршрут')).toHaveTextContent(
    'car_ids=car-1',
  )
  expect(
    screen.queryByRole('group', { name: 'Вибраний автомобіль' }),
  ).toBeNull()
  expect(
    screen.queryByRole('group', { name: 'Розміщення вибраного автомобіля' }),
  ).toBeNull()

  await vi.waitFor(() =>
    expect(partMocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        carIds: ['car-1'],
        compatibility: {
          makeIds: ['make-ford'],
          modelIds: ['model-focus'],
        },
        warehouseIds: ['w1'],
        zoneIds: ['z1'],
      }),
      expect.anything(),
    ),
  )
})

it('opens the model filter only once a make is chosen', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const model = await screen.findByLabelText('Модель')
  expect(model).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Марка'), {
    target: { value: 'make-ford' },
  })
  await vi.waitFor(() => expect(screen.getByLabelText('Модель')).toBeEnabled())
})

it('ignores an aborted stale list failure after filters change', async () => {
  let rejectFirst: ((reason: unknown) => void) | undefined
  partMocks.search
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject
        }),
    )
    .mockResolvedValueOnce({
      items: [
        {
          id: 'part-2',
          name: 'Mirror',
          quantityAvailable: 1,
          quantityReserved: 0,
        },
      ],
      page: 1,
      pageSize: 30,
      total: 1,
      totalPages: 1,
    })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  await vi.waitFor(() => expect(partMocks.search).toHaveBeenCalledOnce())
  fireEvent.change(screen.getByLabelText('Пошук деталей'), {
    target: { value: 'mirror' },
  })
  expect(
    await screen.findByRole('link', { name: 'Mirror' }),
  ).toBeInTheDocument()
  await act(async () => {
    rejectFirst?.(new Error('stale failure'))
    await Promise.resolve()
  })

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Mirror' })).toBeInTheDocument()
})

it('ignores an aborted stale detail failure after navigation', async () => {
  let rejectFirst: ((reason: unknown) => void) | undefined
  partMocks.get
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject
        }),
    )
    .mockResolvedValueOnce({
      id: 'part-2',
      name: 'Mirror',
      notes: null,
      source: 'free',
      carId: null,
      carCode: null,
      intakeId: null,
      quantityTotal: 1,
      quantityAvailable: 1,
      quantityReserved: 0,
      quantitySoldTotal: 0,
      createdByName: 'Olena',
      createdAt: '2026-08-28T12:00:00Z',
      compatCarBrand: null,
      compatCarModel: null,
      compatCarYear: null,
      oemCode: null,
      condition: 'used',
      status: 'available',
      effectiveSalePrice: null,
      photos: [],
      reservations: null,
      order: null,
      soldOrders: null,
    })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={
            <>
              <PartsScreen definition={partsDefinition as never} />
              <DetailNavigation />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
  await vi.waitFor(() => expect(partMocks.get).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button', { name: 'Інша деталь' }))
  expect(
    await screen.findByRole('heading', { name: 'Mirror' }),
  ).toBeInTheDocument()
  await act(async () => {
    rejectFirst?.(new Error('stale failure'))
    await Promise.resolve()
  })

  expect(screen.queryByText('Не вдалося завантажити деталь.')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Mirror' })).toBeInTheDocument()
})

it('blocks an invalid create and points at the offending fields', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?intake_id=intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Кількість'), {
    target: { value: '0' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'виправте позначені нижче поля',
  )
  expect(partMocks.create).not.toHaveBeenCalled()
  for (const [label, message] of [
    ['Назва', 'Введіть назву деталі'],
    ['Кількість', 'Вкажіть ціле число від 1'],
  ] as const) {
    const control = screen.getByLabelText(label)
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(
      document.getElementById(control.getAttribute('aria-describedby') ?? ''),
    ).toHaveTextContent(message)
  }

  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  fireEvent.change(screen.getByLabelText('Кількість'), {
    target: { value: '2' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await expectPartFormClosed()
  expect(screen.queryByLabelText('Назва')).toBeNull()
})

it('requires a source selection before creating a car-sourced part', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Bumper' },
  })
  fireEvent.click(screen.getByRole('button', { name: /З авто/ }))
  const source = await screen.findByLabelText('Автомобіль-джерело')
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await vi.waitFor(() => expect(source).toHaveAttribute('aria-invalid', 'true'))
  expect(
    document.getElementById(source.getAttribute('aria-describedby') ?? ''),
  ).toHaveTextContent('Оберіть автомобіль зі списку.')
  expect(partMocks.create).not.toHaveBeenCalled()
})

it('lists each chosen photo with its size and a way to drop it', async () => {
  mediaMocks.upload.mockResolvedValue({
    storageKey: 'pending/parts/bumper.jpg',
    url: 'https://cdn.example/bumper.jpg',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Фото деталі'), {
    target: {
      files: [new File(['one'], 'bumper.jpg', { type: 'image/jpeg' })],
    },
  })

  const photos = await screen.findByRole('list', { name: 'Вибрані фото' })
  expect(screen.getByText('bumper.jpg · Вибрано')).toBeInTheDocument()
  expect(screen.getByText('3 Б')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'bumper.jpg' })).toBeNull()
  expect(mediaMocks.upload).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'Прибрати bumper.jpg' }),
  ).toBeInTheDocument()
  expect(photos).toBeInTheDocument()
})

const pickableRows = [
  {
    id: 'part-1',
    name: 'Фара ліва',
    photos: [],
    quantityTotal: 2,
    quantityReserved: 0,
    quantityAvailable: 2,
    quantitySoldTotal: 0,
    status: 'available',
    car: null,
    order: null,
  },
  {
    id: 'part-2',
    name: 'Бампер передній',
    photos: [],
    quantityTotal: 1,
    quantityReserved: 0,
    quantityAvailable: 1,
    quantitySoldTotal: 0,
    status: 'available',
    car: null,
    order: null,
  },
]

function renderDirectory() {
  partMocks.search.mockResolvedValue({
    items: pickableRows,
    page: 1,
    pageSize: 30,
    total: 2,
    totalPages: 1,
  })
  return render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          element={
            <>
              <PartsScreen definition={partsDefinition as never} />
              <LocationProbe />
            </>
          }
          path="/app/:tenant/parts"
        />
      </Routes>
    </MemoryRouter>,
  )
}

it('tells the operator that the parts search accepts a VIN', async () => {
  renderDirectory()

  await screen.findByRole('link', { name: 'Фара ліва' })
  expect(screen.getByLabelText('Пошук деталей')).toHaveAttribute(
    'placeholder',
    'Пошук: назва, OEM, QR або VIN',
  )
})

it('does not show selection checkboxes or bulk actions in the parts directory', async () => {
  renderDirectory()

  await screen.findByRole('link', { name: 'Фара ліва' })
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: 'Дії над обраними' }),
  ).not.toBeInTheDocument()
})

it('does not expose web-only saved filters', async () => {
  renderDirectory()

  await screen.findByRole('link', { name: 'Фара ліва' })
  expect(screen.queryByRole('region', { name: 'Мої подання' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Зберегти ці фільтри' }),
  ).toBeNull()
})

it('uses standard row spacing without exposing density controls', async () => {
  partMocks.search.mockResolvedValue({
    items: pickableRows,
    page: 1,
    pageSize: 30,
    total: 2,
    totalPages: 1,
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          element={<PartsScreen definition={partsDefinition as never} />}
          path="/app/:tenant/parts"
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('table')).toHaveClass('text-[14.5px]')
  expect(
    screen.queryByRole('radiogroup', { name: 'Щільність рядків' }),
  ).toBeNull()
  expect(screen.queryByText('Рядки')).toBeNull()
})

it('keeps the top stock totals in sync with the filtered status counts', async () => {
  partMocks.summary.mockResolvedValue({
    total: 1323,
    available: 925,
    reserved: 15,
    sold: 383,
  })
  partMocks.facets.mockResolvedValueOnce({
    statuses: [
      { id: 'available', name: 'available', count: 104 },
      { id: 'reserved', name: 'reserved', count: 4 },
      { id: 'sold', name: 'sold', count: 85 },
    ],
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

  renderDirectory()

  const soldLabel = await screen.findByText('продано')
  expect(soldLabel).toHaveTextContent(/85\s*продано/)
  expect(screen.getByText('усього')).toHaveTextContent(/193\s*усього/)
  expect(screen.getByText('доступно')).toHaveTextContent(/104\s*доступно/)
  expect(screen.getByText('у резерві')).toHaveTextContent(/4\s*у резерві/)
  expect(screen.getByText('Розмір сторінки').parentElement).toHaveClass(
    'ml-auto',
  )
})

it('edits a quantity in the row by rewriting the whole record', async () => {
  const user = userEvent.setup()
  localStorage.clear()
  partMocks.search.mockResolvedValue({
    items: pickableRows,
    page: 1,
    pageSize: 30,
    total: 2,
    totalPages: 1,
  })
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Фара ліва',
    condition: 'good',
    notes: 'знята з Focus',
    quantityTotal: 2,
    partType: 'optics',
    unit: 'шт',
    photos: [
      {
        id: 'p1',
        storageKey: 'key-1',
        url: '',
        thumbnailUrl: '',
        sortOrder: 0,
      },
    ],
    desiredSalePrice: 300,
  })
  partMocks.update.mockResolvedValue({ id: 'part-1', desiredSalePrice: 300 })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          element={<PartsScreen definition={partsDefinition as never} />}
          path="/app/:tenant/parts"
        />
      </Routes>
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', {
      name: 'Змінити — Кількість — Фара ліва',
    }),
  )
  const input = screen.getByRole('textbox', { name: 'Кількість — Фара ліва' })
  await user.clear(input)
  await user.type(input, '5')
  await user.click(screen.getByRole('button', { name: 'Зберегти значення' }))

  await vi.waitFor(() =>
    expect(partMocks.update).toHaveBeenCalledWith(
      'part-1',
      {
        name: 'Фара ліва',
        condition: 'good',
        notes: 'знята з Focus',
        quantity: 5,
        partType: 'optics',
        unit: 'шт',
        photoKeys: ['key-1'],
        desiredSalePrice: { isSet: false },
      },
      expect.anything(),
    ),
  )
})

it('refuses a quantity that is not a whole number and says so in the cell', async () => {
  const user = userEvent.setup()
  localStorage.clear()
  partMocks.search.mockResolvedValue({
    items: pickableRows,
    page: 1,
    pageSize: 30,
    total: 2,
    totalPages: 1,
  })
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Фара ліва',
    condition: 'good',
    notes: null,
    quantityTotal: 2,
    partType: null,
    unit: 'шт',
    photos: [],
    desiredSalePrice: null,
  })
  partMocks.update.mockClear()
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          element={<PartsScreen definition={partsDefinition as never} />}
          path="/app/:tenant/parts"
        />
      </Routes>
    </MemoryRouter>,
  )

  await user.click(
    await screen.findByRole('button', {
      name: 'Змінити — Кількість — Фара ліва',
    }),
  )
  const input = screen.getByRole('textbox', { name: 'Кількість — Фара ліва' })
  await user.clear(input)
  await user.type(input, '2.5{Enter}')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Кількість — ціле число від нуля.',
  )
  expect(partMocks.update).not.toHaveBeenCalled()
})

it('keeps a locked part read-only in the row and says which session holds it', async () => {
  partMocks.search.mockResolvedValue({
    items: [{ ...pickableRows[0]!, isInventoryLocked: true }],
    page: 1,
    pageSize: 30,
    total: 1,
    totalPages: 1,
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          element={<PartsScreen definition={partsDefinition as never} />}
          path="/app/:tenant/parts"
        />
      </Routes>
    </MemoryRouter>,
  )

  await screen.findByRole('table')
  expect(
    screen.queryByRole('button', { name: 'Змінити — Кількість — Фара ліва' }),
  ).not.toBeInTheDocument()
})

it('names the network as the reason when the stock list cannot be reached', async () => {
  partMocks.search.mockRejectedValue(
    Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      code: 'ERR_NETWORK',
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          element={<PartsScreen definition={partsDefinition as never} />}
          path="/app/:tenant/parts"
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Склад не відповідає' }),
  ).toBeVisible()
  expect(screen.getByText(/Немає звʼязку з сервером/)).toBeVisible()
})

it('blames the server, not the network, when the request came back 500', async () => {
  partMocks.search.mockRejectedValue(
    Object.assign(new Error('boom'), {
      isAxiosError: true,
      response: { status: 500, data: {} },
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          element={<PartsScreen definition={partsDefinition as never} />}
          path="/app/:tenant/parts"
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Склад не завантажився' }),
  ).toBeVisible()
})

it('opens the new part as a drawer and names the next thing to fix', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?intake_id=intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const drawer = await screen.findByRole('dialog')
  expect(drawer).toHaveClass('sm:right-0')
  expect(within(drawer).getByText(/Введіть назву деталі/)).toBeVisible()

  await user.type(within(drawer).getByLabelText('Назва'), 'Цапфа RR')

  expect(within(drawer).getByText('Фото можна додати пізніше.')).toBeVisible()
})

it('spells out what each condition means, not just its name', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const scrap = await screen.findByRole('radio', { name: 'На запчастини' })
  expect(scrap).toHaveAccessibleDescription(/Несправна або некомплектна/)
  expect(screen.getByRole('radio', { name: 'Хороший' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

it('starts a part from a car page with that car already chosen', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?car_id=car-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('button', { name: /З авто/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(
    screen.getByRole('combobox', { name: 'Автомобіль-джерело' }),
  ).toHaveValue('car-1')
})

it('hides the create-car action after choosing a source car and restores it when cleared', async () => {
  cabinetMock.snapshot.permissions.add('cars.manage')
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(
    screen.getByRole('link', { name: 'Створити автомобіль' }),
  ).toBeVisible()
  const source = await screen.findByRole('combobox', {
    name: 'Автомобіль-джерело',
  })
  fireEvent.change(source, { target: { value: 'car-1' } })
  expect(screen.queryByRole('link', { name: 'Створити автомобіль' })).toBeNull()

  fireEvent.change(source, { target: { value: '' } })
  expect(
    screen.getByRole('link', { name: 'Створити автомобіль' }),
  ).toBeVisible()
})

it('shows the selected source car as compatibility without an empty vehicle form', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?car_id=car-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Ford Focus')).toBeVisible()
  expect(
    screen.getByText('З вибраного авто-джерела. Змінюється разом із джерелом.'),
  ).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Авто 1' })).toBeNull()
})

it('adds and removes extra compatibility inline on demand', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ Results: [{ MakeId: 1, MakeName: 'Ford' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ Results: [{ Model_ID: 2, Model_Name: 'Focus' }] }),
      }),
  )

  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.queryByRole('region', { name: 'Авто 1' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Додати ще авто' }))
  const vehicle = within(await screen.findByRole('region', { name: 'Авто 1' }))
  expect(screen.queryByRole('dialog', { name: 'Додати сумісність' })).toBeNull()
  fireEvent.click(vehicle.getByRole('button', { name: 'Марка' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Ford' }))
  fireEvent.click(vehicle.getByRole('button', { name: 'Модель' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Focus' }))
  fireEvent.change(vehicle.getByLabelText('Рік'), {
    target: { value: '2018' },
  })
  expect(vehicle.getByLabelText('Рік')).toHaveValue('2018')
  await user.click(vehicle.getByRole('button', { name: 'Прибрати' }))

  expect(screen.queryByRole('region', { name: 'Авто 1' })).toBeNull()
})

it('refuses to save a make the yard has never catalogued', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  equipmentMocks.makes.mockResolvedValueOnce([])
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ Results: [{ MakeId: 9, MakeName: 'Rivian' }] }),
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?intake_id=intake-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Цапфа' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Додати ще авто' }))
  const vehicle = within(screen.getByRole('region', { name: 'Авто 1' }))
  fireEvent.click(vehicle.getByRole('button', { name: 'Марка' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Rivian' }))
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    /У довіднику розбірки немає марки: Rivian/,
  )
  expect(partMocks.create).not.toHaveBeenCalled()
})

it('keeps the donor row by replacing compatibility after creating a car part', async () => {
  partMocks.create.mockResolvedValue({ id: 'part-new' })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ Results: [{ MakeId: 1, MakeName: 'Ford' }] }),
    }),
  )
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?car_id=car-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Цапфа' },
  })
  expect(await screen.findByText('Ford Focus')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Додати ще авто' }))
  const vehicle = within(screen.getByRole('region', { name: 'Авто 2' }))
  fireEvent.click(vehicle.getByRole('button', { name: 'Марка' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Ford' }))
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

  await expectPartFormClosed()
  // The list never rides along with the part: that would drop the donor row.
  expect(partMocks.create.mock.calls[0]?.[0]).not.toHaveProperty(
    'compatibilities',
  )
  expect(partMocks.replaceCompatibilities).toHaveBeenCalledWith(
    'part-new',
    'v1',
    [
      {
        equipmentTypeId: 'type-car',
        makeId: 'make-ford',
        modelId: null,
        yearFrom: null,
        yearTo: null,
      },
    ],
  )
})

it('says the part cannot be ordered from its own page yet, instead of pretending', async () => {
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Bumper',
    condition: 'fair',
    status: 'available',
    source: 'free',
    quantityTotal: 1,
    quantityAvailable: 1,
    quantityReserved: 0,
    quantitySoldTotal: 0,
    oemCode: null,
    effectiveSalePrice: 180,
    desiredSalePrice: 180,
    photos: [],
    reservations: null,
    order: null,
    soldOrders: null,
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const order = await screen.findByRole('button', {
    name: 'Додати в замовлення',
  })
  expect(order).toBeDisabled()
  expect(order).toHaveAttribute(
    'title',
    expect.stringContaining('ще не підключене'),
  )
})

it('offers the price only as a warning while the part has none', async () => {
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Bumper',
    condition: 'fair',
    status: 'available',
    source: 'free',
    quantityTotal: 1,
    quantityAvailable: 1,
    quantityReserved: 0,
    quantitySoldTotal: 0,
    oemCode: null,
    effectiveSalePrice: null,
    desiredSalePrice: null,
    photos: [],
    reservations: null,
    order: null,
    soldOrders: null,
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const price = await screen.findByRole('region', { name: 'Ціна продажу' })
  expect(within(price).getByText('Ціни ще немає')).toBeVisible()
  expect(
    within(price).getByText('Без ціни деталь не можна додати в замовлення.'),
  ).toBeVisible()
  expect(within(price).queryByRole('link', { name: 'Змінити' })).toBeNull()
})

it('names where the part actually sits, and says when it sits nowhere', async () => {
  const part = {
    id: 'part-1',
    name: 'Bumper',
    condition: 'fair',
    status: 'available',
    source: 'free',
    quantityTotal: 1,
    quantityAvailable: 1,
    quantityReserved: 0,
    quantitySoldTotal: 0,
    oemCode: null,
    effectiveSalePrice: 180,
    desiredSalePrice: 180,
    photos: [],
    reservations: null,
    order: null,
    soldOrders: null,
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
  }
  partMocks.get.mockResolvedValue(part)
  cabinetMock.snapshot.permissions.add('inventory.view')
  const { unmount } = render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const stock = await screen.findByRole('region', { name: 'Наявність' })
  expect(
    await within(stock).findByText('Склад А · Стелаж 3 · полиця 2'),
  ).toBeVisible()
  unmount()

  // Core keeps a system zone for anything nobody has placed; it is not a place.
  inventoryMocks.getPartZones.mockResolvedValueOnce([
    {
      isSystemUnassigned: true,
      warehouseId: 'wh-1',
      warehouseName: 'Склад А',
      zoneCode: '—',
      zoneId: 'zone-0',
      zoneName: 'Без зони',
      zoneQrCode: 'QR',
    },
  ])
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByText('Не розміщена')).toBeVisible()
})

it('keeps reserves with the sales and says what it cannot promise about them', async () => {
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Bumper',
    condition: 'fair',
    status: 'reserved',
    source: 'free',
    quantityTotal: 5,
    quantityAvailable: 2,
    quantityReserved: 2,
    quantitySoldTotal: 1,
    oemCode: null,
    effectiveSalePrice: 180,
    desiredSalePrice: 180,
    photos: [],
    order: null,
    soldOrders: null,
    reservations: [
      {
        orderId: 'order-1042',
        orderNumber: 1042,
        quantity: 1,
        customerName: 'Андрій Коваль',
      },
      {
        orderId: 'order-1045',
        orderNumber: 1045,
        quantity: 1,
        customerName: 'СТО «Мотор-Сервіс»',
      },
    ],
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const sales = await screen.findByRole('region', { name: 'Продажі' })
  expect(within(sales).getByText('Андрій Коваль')).toBeVisible()
  expect(within(sales).getByText('СТО «Мотор-Сервіс»')).toBeVisible()
  // A reservation carries no price of its own, and the table says so.
  expect(within(sales).getAllByText('—').length).toBeGreaterThan(0)

  // The action from the design is offered, but refused with its reason.
  const extend = within(sales).getAllByRole('button', {
    name: /Продовжити/,
  })[0]!
  expect(extend).toBeDisabled()
  expect(extend).toHaveAttribute(
    'title',
    expect.stringContaining('Строку резерву розбірка не веде'),
  )
})

it('groups history by day and narrows it to what was asked for', async () => {
  const user = userEvent.setup()
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Bumper',
    condition: 'fair',
    status: 'available',
    source: 'free',
    quantityTotal: 1,
    quantityAvailable: 1,
    quantityReserved: 0,
    quantitySoldTotal: 0,
    oemCode: null,
    effectiveSalePrice: 180,
    desiredSalePrice: 180,
    photos: [],
    order: null,
    soldOrders: null,
    reservations: null,
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
  })
  partMocks.history.mockResolvedValue({
    partId: 'part-1',
    events: [
      {
        id: 'e1',
        eventType: 'sold',
        data: '{"quantity":2}',
        createdAt: '2026-09-19T14:48:00Z',
        user: { id: 'u1', name: 'Олег Ткач' },
        order: { id: 'o-1037', number: 1037 },
      },
      {
        id: 'e2',
        eventType: 'updated',
        data: '{"old_price":200,"new_price":180}',
        createdAt: '2026-08-02T06:15:00Z',
        user: { id: 'u2', name: 'Марія Бондаренко' },
        order: null,
      },
      {
        id: 'e3',
        eventType: 'placed',
        data: '{"zone":"A-3-2"}',
        createdAt: '2026-08-02T05:08:00Z',
        user: { id: 'u2', name: 'Марія Бондаренко' },
        order: null,
      },
    ],
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const card = await screen.findByRole('region', { name: 'Історія' })
  // Two days, and the two events of the second one share a single heading.
  expect(within(card).getByText('19.09.2026')).toBeVisible()
  expect(within(card).getAllByText('02.08.2026')).toHaveLength(1)
  // A before-and-after pair earns the arrow; a lone fact does not.
  expect(within(card).getByText('200')).toBeVisible()
  expect(within(card).getByText('180')).toBeVisible()

  await user.click(within(card).getByRole('button', { name: 'Ціна' }))

  expect(within(card).queryByText('Продано')).toBeNull()
  expect(within(card).getByText('Змінено')).toBeVisible()
})

it('narrows the sales table to reserves or to sales', async () => {
  const user = userEvent.setup()
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Bumper',
    condition: 'fair',
    status: 'reserved',
    source: 'free',
    quantityTotal: 3,
    quantityAvailable: 0,
    quantityReserved: 1,
    quantitySoldTotal: 2,
    oemCode: null,
    effectiveSalePrice: 180,
    desiredSalePrice: 200,
    photos: [],
    order: null,
    reservations: [
      {
        orderId: 'order-1042',
        orderNumber: 1042,
        quantity: 1,
        customerName: 'Андрій Коваль',
      },
    ],
    soldOrders: [
      {
        orderId: 'order-1037',
        orderNumber: 1037,
        quantitySold: 2,
        unitPrice: 180,
        confirmedAt: '2026-09-19T14:48:00Z',
        customerName: 'Олег Шевчук',
      },
    ],
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  const sales = await screen.findByRole('region', { name: 'Продажі' })
  // Revenue and the discount against the asking price are both real figures.
  expect(sales).toHaveTextContent('Виручка')
  expect(sales).toHaveTextContent('Знижки')
  expect(within(sales).getByText('Андрій Коваль')).toBeVisible()
  expect(within(sales).getByText('Олег Шевчук')).toBeVisible()

  await user.click(within(sales).getByRole('tab', { name: /Продано/ }))

  expect(within(sales).queryByText('Андрій Коваль')).toBeNull()
  expect(within(sales).getByText('Олег Шевчук')).toBeVisible()
})

it('requires a source for manual creation and does not offer free parts', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(
    screen.queryByRole('button', { name: /Вільна/ }),
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Фара' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Деталь не створено',
  )
  expect(partMocks.create).not.toHaveBeenCalled()
})

it('resets a saved free source filter visibly without sending it to search', async () => {
  partMocks.search.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 0,
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts?origin=free']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(
    await screen.findByText(/Фільтр «Вільні запчастини» скинуто/),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /^Вільна/ }),
  ).not.toBeInTheDocument()
  for (const call of partMocks.search.mock.calls)
    expect(call[0]).not.toHaveProperty('originTypes')
})

it('does not offer archived cars for new parts', async () => {
  selectorMocks.cars.mockResolvedValue({
    items: [
      {
        id: 'old-car',
        code: 'OLD',
        brand: 'Ford',
        model: 'Focus',
        status: 'archived',
      },
    ],
    page: 1,
    pageSize: 100,
    total: 1,
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.queryByRole('option', { name: /OLD/ })).not.toBeInTheDocument()
  expect(selectorMocks.cars).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'active' }),
    expect.anything(),
  )
})

it('blocks a stale direct create link to an archived car before any part write', async () => {
  selectorMocks.car.mockResolvedValue({ id: 'car-1', status: 'archived' })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/new?car_id=car-1']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/new"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Назва'), {
    target: { value: 'Фара' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'До архівного автомобіля не можна додавати деталі.',
  )
  expect(partMocks.create).not.toHaveBeenCalled()
})

it('does not offer part import without an enabled tenant flag', async () => {
  render(
    <MemoryRouter initialEntries={['/app/yard/parts']}>
      <Routes>
        <Route
          path="/app/:tenant/parts"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )

  await vi.waitFor(() => expect(partMocks.search).toHaveBeenCalled())
  expect(
    screen.queryByRole('link', { name: 'Імпорт запчастин' }),
  ).not.toBeInTheDocument()
})

it('offers the existing import link when the tenant flag is enabled', async () => {
  flagMocks.get.mockResolvedValue({ 'parts.bulk-import': true })
  render(
    <FeatureFlagsProvider>
      <MemoryRouter initialEntries={['/app/yard/parts']}>
        <Routes>
          <Route
            path="/app/:tenant/parts"
            element={<PartsScreen definition={partsDefinition as never} />}
          />
        </Routes>
      </MemoryRouter>
    </FeatureFlagsProvider>,
  )
  expect(
    await screen.findByRole('link', { name: 'Імпорт запчастин' }),
  ).toHaveAttribute('href', '/app/yard/parts/imports')
})

function renderInLocale(locale: Locale, entry: string, path: string) {
  return render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            element={<PartsScreen definition={partsDefinition as never} />}
            path={path}
          />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  )
}

it('reads the parts directory in English (UK)', async () => {
  partMocks.search.mockResolvedValue({
    items: pickableRows,
    page: 1,
    pageSize: 30,
    total: 2,
    totalPages: 3,
  })
  renderInLocale('en-GB', '/app/yard/parts', '/app/:tenant/parts')

  await screen.findByRole('link', { name: 'Фара ліва' })
  expect(screen.getByRole('heading', { name: 'Parts', level: 1 })).toBeVisible()
  expect(screen.getByLabelText('Search parts')).toHaveAttribute(
    'placeholder',
    'Search: name, OEM, QR or VIN',
  )
  expect(screen.getByRole('link', { name: 'Add part' })).toBeVisible()
  expect(screen.getByRole('button', { name: /In stock/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /For parts/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /From an intake/ })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reset filters' })).toBeDisabled()
  expect(
    screen.getByRole('columnheader', { name: 'Source car' }),
  ).toBeInTheDocument()
  expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
  expect(screen.getByText('Page 1 of 3')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Next page' })).toHaveTextContent(
    'Next',
  )
  expect(screen.queryByText('Деталі')).toBeNull()
})

it('reads the new-part form in English (UK) and Polish', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  const user = userEvent.setup()
  const { unmount } = renderInLocale(
    'en-GB',
    '/app/yard/parts/new?intake_id=intake-1',
    '/app/:tenant/parts/new',
  )

  const drawer = await screen.findByRole('dialog', { name: 'New part' })
  expect(within(drawer).getByText('Warehouse · Parts')).toBeVisible()
  expect(
    within(drawer).getByRole('button', { name: 'Create part' }),
  ).toBeVisible()
  expect(within(drawer).getByRole('button', { name: 'Cancel' })).toBeVisible()
  expect(
    await within(drawer).findByRole('option', {
      name: 'Партія серпень · Постачальник',
    }),
  ).toBeInTheDocument()
  expect(within(drawer).getByLabelText('Source intake')).toBeVisible()
  expect(within(drawer).getByRole('radio', { name: 'For parts' })).toBeVisible()
  expect(
    within(drawer).getByText(
      'Faulty or incomplete. For stripping or rebuilding.',
    ),
  ).toBeVisible()
  expect(within(drawer).getByLabelText('Unit')).toHaveValue('pcs')
  expect(within(drawer).getByLabelText('Part photos')).toBeInTheDocument()
  expect(within(drawer).getByText(/Enter the part name/)).toBeVisible()

  await user.type(within(drawer).getByLabelText('Name'), 'Hub carrier RR')
  expect(within(drawer).getByText('You can add photos later.')).toBeVisible()

  await user.click(within(drawer).getByRole('button', { name: 'Create part' }))
  await expectPartFormClosed()
  expect(partMocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ unit: 'шт', name: 'Hub carrier RR' }),
    expect.anything(),
  )
  unmount()

  renderInLocale('pl', '/app/yard/parts/new', '/app/:tenant/parts/new')
  const polish = await screen.findByRole('dialog', { name: 'Nowa część' })
  expect(
    within(polish).getByRole('button', { name: 'Utwórz część' }),
  ).toBeVisible()
  expect(within(polish).getByLabelText('Jednostka')).toHaveValue('szt.')
})

it('reads a known source error code on create in the interface language', async () => {
  cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
  partMocks.create.mockRejectedValueOnce({
    kind: 'conflict',
    code: 'PART_SOURCE_ARCHIVED',
    message: 'Server text',
  })
  const user = userEvent.setup()
  renderInLocale(
    'en-GB',
    '/app/yard/parts/new?intake_id=intake-1',
    '/app/:tenant/parts/new',
  )
  const drawer = await screen.findByRole('dialog', { name: 'New part' })
  await user.type(within(drawer).getByLabelText('Name'), 'Bumper')
  await user.click(within(drawer).getByRole('button', { name: 'Create part' }))

  expect(
    await within(drawer).findByText(
      'The car is archived — new parts can’t be added to it. Choose another car.',
    ),
  ).toBeVisible()

  partMocks.create.mockRejectedValueOnce({
    kind: 'conflict',
    code: 'SOMETHING_NEW',
    message: 'Message from the server',
  })
  await user.click(within(drawer).getByRole('button', { name: 'Create part' }))
  expect(
    await within(drawer).findByText('Message from the server'),
  ).toBeVisible()
})

it('reads the part page and its history in English (UK)', async () => {
  partMocks.get.mockResolvedValue({
    id: 'part-1',
    name: 'Bumper',
    condition: 'fair',
    status: 'sold',
    source: 'free',
    quantityTotal: 1,
    quantityAvailable: 0,
    quantityReserved: 0,
    quantitySoldTotal: 1,
    oemCode: null,
    unit: 'шт',
    effectiveSalePrice: 180,
    desiredSalePrice: 180,
    photos: [],
    order: null,
    soldOrders: null,
    reservations: null,
    createdByName: 'Olena',
    createdAt: '2026-08-28T12:00:00Z',
  })
  partMocks.history.mockResolvedValue({
    partId: 'part-1',
    events: [
      {
        id: 'e1',
        eventType: 'sold',
        data: '{"quantity":2}',
        createdAt: '2026-09-19T21:48:00Z',
        user: { id: 'u1', name: 'Oleh' },
        order: { id: 'o-1037', number: 1037 },
      },
    ],
  })
  renderInLocale(
    'en-GB',
    '/app/yard/parts/part-1',
    '/app/:tenant/parts/:partId',
  )

  const history = await screen.findByRole('region', { name: 'History' })
  // 21:48 UTC is already the next day in Kyiv, the business time zone.
  expect(within(history).getByText('20/09/2026')).toBeVisible()
  expect(within(history).getByText('00:48')).toBeVisible()
  expect(within(history).getByText('Sold')).toBeVisible()
  expect(within(history).getByText('No. 1037')).toBeVisible()
  expect(screen.getByText('Fair condition')).toBeVisible()
  expect(screen.getByText('0 photos')).toBeVisible()
  expect(screen.getByText('per 1 pcs')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Back to warehouse' })).toBeVisible()
})

describe('asking price and the accounting currency', () => {
  const renderNewPart = () =>
    render(
      <MemoryRouter initialEntries={['/app/yard/parts/new?intake_id=intake-1']}>
        <Routes>
          <Route
            path="/app/:tenant/parts/new"
            element={<PartsScreen definition={partsDefinition as never} />}
          />
        </Routes>
      </MemoryRouter>,
    )

  it('keeps the typed part when the owner leaves to choose the currency', () => {
    cabinetMock.tenant = {
      id: 'tenant-1',
      slug: 'yard',
      accountingCurrency: null,
      currencyLocked: false,
    }
    cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
    renderNewPart()
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'Фара ліва' },
    })

    expect(screen.getByLabelText('Бажана ціна')).toBeDisabled()
    expect(
      screen.getByText('Чернетку збережемо, після вибору повернемо сюди.'),
    ).toBeVisible()
    const link = screen.getByRole('link', { name: 'Обрати валюту обліку →' })
    expect(link).toHaveAttribute(
      'href',
      `/app/yard/settings/business?return_to=${encodeURIComponent('/app/yard/parts/new?intake_id=intake-1')}`,
    )
    fireEvent.click(link)
    expect(sessionStorage.getItem('rozbirka:part-create-draft')).toContain(
      'Фара ліва',
    )
  })

  it('treats 0 as the first price and saves it in the shown currency', async () => {
    cabinetMock.tenant = {
      id: 'tenant-1',
      slug: 'yard',
      accountingCurrency: 'USD',
      currencyLocked: false,
    }
    cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
    partMocks.create.mockResolvedValueOnce({ id: 'part-9' })
    renderNewPart()
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'Фара ліва' },
    })
    fireEvent.change(screen.getByLabelText('Бажана ціна'), {
      target: { value: '0' },
    })

    expect(
      screen.getByText(
        'Після збереження цієї ціни валюту обліку USD буде зафіксовано.',
      ),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

    await expectPartFormClosed()
    expect(tenantMocks.list).toHaveBeenCalled()
    expect(partMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ desiredSalePrice: 0 }),
      expect.anything(),
    )
  })

  it('keeps a yen price whole, as Core does, and does not save', async () => {
    cabinetMock.tenant = {
      id: 'tenant-1',
      slug: 'yard',
      accountingCurrency: 'JPY',
      currencyLocked: true,
    }
    cabinetMock.snapshot.features.add(FEATURES.IntakeManagement)
    renderNewPart()
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'Фара ліва' },
    })
    fireEvent.change(screen.getByLabelText('Бажана ціна'), {
      target: { value: '1500.5' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))

    expect(
      (
        await screen.findAllByText(
          'Сума в JPY має бути цілою, без дробової частини.',
        )
      )[0],
    ).toBeVisible()
    expect(partMocks.create).not.toHaveBeenCalled()
  })
})

describe('the owner’s first part', () => {
  const renderNewPart = () =>
    render(
      <MemoryRouter initialEntries={['/app/yard/parts/new']}>
        <Routes>
          <Route
            path="/app/:tenant/parts/new"
            element={<PartsScreen definition={partsDefinition as never} />}
          />
        </Routes>
      </MemoryRouter>,
    )
  const fillAndSave = async () => {
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'Bumper' },
    })
    fireEvent.click(screen.getByRole('button', { name: /З авто/ }))
    fireEvent.change(await screen.findByLabelText('Автомобіль-джерело'), {
      target: { value: 'car-1' },
    })
    await screen.findByText('CAR-01 · Ford Focus (2018)')
    fireEvent.click(screen.getByRole('button', { name: 'Створити деталь' }))
  }

  it('opens the saved part even when it completes onboarding', async () => {
    onboardingMocks.get
      .mockReset()
      .mockResolvedValueOnce(onboardingFacts)
      .mockResolvedValueOnce({
        ...onboardingFacts,
        completed: true,
        firstPartCreated: true,
      })
    renderNewPart()
    await fillAndSave()

    await expectPartFormClosed()
    expect(screen.queryByText('Основне налаштування завершено')).toBeNull()
    expect(partMocks.create).toHaveBeenCalledOnce()
  })

  it('opens the saved part when onboarding remains incomplete', async () => {
    onboardingMocks.get.mockReset().mockResolvedValue(onboardingFacts)
    renderNewPart()
    await fillAndSave()

    await expectPartFormClosed()
    expect(partMocks.create).toHaveBeenCalledOnce()
  })
})

it('reads the part back after a lost save before reporting it', async () => {
  const stored = {
    id: 'part-1',
    source: 'free',
    carId: null,
    intakeId: null,
    name: 'Дзеркало дверей L',
    quantityTotal: 1,
    unit: 'pcs',
    condition: 'fair',
    notes: null,
    oemCode: null,
    partType: null,
    desiredSalePrice: null,
    photos: [],
  }
  partMocks.get.mockResolvedValue(stored)
  partMocks.update.mockRejectedValueOnce({
    kind: 'network',
    message: 'offline',
  })
  render(
    <MemoryRouter initialEntries={['/app/yard/parts/part-1/edit']}>
      <Routes>
        <Route
          path="/app/:tenant/parts/:partId/edit"
          element={<PartsScreen definition={partsDefinition as never} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  const name = await screen.findByLabelText('Назва')
  fireEvent.change(name, { target: { value: 'Дзеркало праве' } })
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }))

  // Read back: still the old name, so nothing was saved; the typing stays.
  expect(await screen.findByText(/зміни не збереглися/)).toBeInTheDocument()
  expect(screen.getByLabelText('Назва')).toHaveValue('Дзеркало праве')
  expect(partMocks.update).toHaveBeenCalledOnce()
})
