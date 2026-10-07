import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { carsApi, type CarProfitability } from '@/api/cars'
import { LocaleProvider, type Locale } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { CarPartsCard } from './CarPartsCard'
import { CarProfitabilityCard } from './CarProfitabilityCard'
import { CarsScreen } from './CarsScreen'

/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are invoked only through their owning singleton. */

vi.mock('@/api/cars', () => ({
  isCarStatus: (value: unknown) => value === 'active' || value === 'archived',
  carsApi: { list: vi.fn(), get: vi.fn() },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
vi.mock('../module-registry', () => ({
  cabinetModules: {
    cars: {
      key: 'cars',
      routeSegment: '/cars',
      viewPermission: 'cars.view',
      mutationPermission: 'cars.manage',
      quotaResource: 'cars',
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
  },
}))

const car = {
  id: 'car-1',
  code: 'CAR-001',
  brand: 'BMW',
  model: 'X5',
  year: 2020,
  color: null,
  status: 'active' as const,
  acquiredAt: '2026-08-01',
  partsCount: 3,
  soldPartsCount: 1,
  coverPhotoUrl: null,
  profitability: {
    invested: 12000,
    recouped: 5000,
    recoupedPercent: 42,
    partsAvailable: 2,
  },
}

const profit: CarProfitability = {
  invested: 12000,
  recouped: 5000,
  remaining: 7000,
  recoupedPercent: 42,
  partsTotal: 3,
  partsAvailable: 2,
  partsSold: 1,
}

const detail = {
  ...car,
  vin: 'WBAXX11010A123456',
  notes: null,
  createdAt: '2026-08-01T12:00:00Z',
  purchasePrice: 12000,
  photos: [],
  expenses: [],
  profitability: profit,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue({
    status: 'ready',
    targetTenant: null,
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation: 1,
      role: 'manager',
      permissions: new Set([
        'cars.view',
        'cars.manage',
        'parts.view',
        'finance.view',
        'finance.manage',
      ]),
      features: new Set<string>(),
      entitlement: {
        state: 'active',
        usage: {
          cars: { used: 0, max: 5 },
          intakes: { used: 0, max: 5 },
          parts: { used: 0, max: 5 },
          users: { used: 0, max: 5 },
          cashRegisters: { used: 0, max: 5 },
        },
      },
      subscription: null,
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  } as unknown as ReturnType<typeof useCabinet>)
  vi.mocked(carsApi.list).mockResolvedValue({
    items: [car],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  })
  vi.mocked(carsApi.get).mockResolvedValue(detail)
})

const renderAt = (path: string, locale: Locale) =>
  render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/:tenant/cars" element={<CarsScreen />} />
          <Route path="/app/:tenant/cars/:carId" element={<CarsScreen />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  )

it('renders the cars list in British English', async () => {
  renderAt('/app/demo/cars', 'en-GB')

  expect(
    await screen.findByRole('heading', { name: 'Cars', level: 1 }),
  ).toBeVisible()
  expect(screen.getByRole('link', { name: /Add car/ })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Search cars' })).toBeVisible()
  expect(screen.getByRole('list', { name: 'Car list' })).toBeVisible()
  expect(screen.getByText('BMW X5 (2020)')).toBeVisible()
  expect(screen.getByText('Active', { selector: 'span' })).toBeVisible()
  expect(screen.getByText('Page 1 of 1')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  expect(screen.queryByText(/Автомобілі|Сторінка/)).toBeNull()
})

it('says the list is empty in Polish', async () => {
  vi.mocked(carsApi.list).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  })
  renderAt('/app/demo/cars', 'pl')

  expect(await screen.findByText('Nie ma jeszcze aut')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Auta', level: 1 })).toBeVisible()
})

it('renders the car detail with English dates and plurals', async () => {
  renderAt('/app/demo/cars/car-1', 'en-GB')

  expect(await screen.findByText(/in stock since 1 Aug 2026/)).toBeVisible()
  expect(screen.getByRole('link', { name: /Back to cars/ })).toBeVisible()
  expect(screen.getByText('0 photos')).toBeVisible()
  expect(screen.getByText('No photos of this car yet.')).toBeVisible()
  expect(
    screen.getByText(
      'We suggest shooting the front, rear quarter, side — then add them when editing the car.',
    ),
  ).toBeVisible()
  expect(screen.getByText('Parts from this car')).toBeVisible()
  expect(screen.getByText('Profitability')).toBeVisible()
})

it('localizes the parts and profitability cards', () => {
  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <MemoryRouter>
        <CarPartsCard partsHref="/app/demo/parts" profit={profit} />
        <CarProfitabilityCard
          expensesTotal={0}
          profit={profit}
          purchasePrice={12000}
        />
      </MemoryRouter>
    </LocaleProvider>,
  )

  expect(screen.getByRole('link', { name: 'All 3 →' })).toBeVisible()
  expect(screen.getByText('33%')).toBeVisible()
  expect(screen.getByText('3 parts from this car')).toBeInTheDocument()
  expect(screen.getByText('Paying off')).toBeVisible()
  expect(screen.getByText('from selling 1 item')).toBeVisible()
  expect(screen.getByText('To break even')).toBeVisible()
  expect(screen.getByRole('progressbar', { name: 'Payback' })).toHaveAttribute(
    'aria-valuetext',
    '42% of investment recouped',
  )
})
