import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { intakesApi } from '@/api/intakes'
import { LocaleProvider, type Locale } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { IntakesScreen } from './IntakesScreen'

/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are invoked only through their owning singleton. */

vi.mock('@/api/intakes', () => ({
  isIntakeStatus: (value: unknown) => value === 'active' || value === 'closed',
  intakesApi: { list: vi.fn(), get: vi.fn() },
}))
vi.mock('@/api/parts', () => ({ partsApi: { update: vi.fn() } }))
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
  },
}))

const intake = {
  id: 'intake-1',
  name: 'July batch',
  supplier: null,
  purchasedAt: '2026-08-01T12:00:00Z',
  totalCost: 5000,
  partsCount: 2,
  soldCount: 1,
  createdAt: '2026-08-02T10:00:00Z',
  createdBy: { id: 'user-1', displayName: 'Olena' },
}

const detail = {
  ...intake,
  notes: null,
  photos: [],
  parts: [
    {
      id: 'part-1',
      name: 'Bumper',
      partType: null,
      condition: 'good',
      quantity: 2,
      unit: 'шт',
      status: 'available',
      qrCode: 'QR-1',
      photos: [],
      createdAt: '2026-08-02T10:30:00Z',
    },
  ],
  profitability: null,
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
      permissions: new Set(['intakes.view', 'parts.view']),
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
  vi.mocked(intakesApi.list).mockResolvedValue({
    items: [intake],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  })
  vi.mocked(intakesApi.get).mockResolvedValue(detail)
})

const renderAt = (path: string, locale: Locale) =>
  render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/:tenant/intakes" element={<IntakesScreen />} />
          <Route
            path="/app/:tenant/intakes/:intakeId"
            element={<IntakesScreen />}
          />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  )

it('renders the intakes list in British English', async () => {
  renderAt('/app/demo/intakes', 'en-GB')

  expect(
    await screen.findByRole('heading', { name: 'Intakes', level: 1 }),
  ).toBeVisible()
  expect(await screen.findByText('July batch')).toBeVisible()
  expect(
    screen.getByRole('searchbox', { name: 'Search intakes' }),
  ).toBeVisible()
  expect(screen.getByRole('radio', { name: /All/ })).toBeChecked()
  expect(screen.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  expect(screen.getByText('Selling')).toBeVisible()
  expect(screen.getByText('1 Aug 2026')).toBeVisible()
  expect(screen.getByText('Showing 1 of 1 intake')).toBeVisible()
  expect(screen.queryByText(/Приймання|Показано/)).toBeNull()
})

it('says the filtered list is empty in Polish', async () => {
  vi.mocked(intakesApi.list).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  })
  renderAt('/app/demo/intakes?status=closed', 'pl')

  expect(await screen.findByText('Brak przyjęć dla tego filtra')).toBeVisible()
  expect(screen.getByText('Pokazano 0 z 0 przyjęć')).toBeVisible()
})

it('renders the intake detail with English units, statuses and history', async () => {
  renderAt('/app/demo/intakes/intake-1', 'en-GB')

  expect(
    await screen.findByRole('heading', { name: 'July batch', level: 1 }),
  ).toBeVisible()
  expect(screen.getByText('Created by Olena, 2 Aug 2026')).toBeVisible()
  expect(screen.getByRole('cell', { name: '2 pcs' })).toBeVisible()
  expect(screen.getByText('Added “Bumper”')).toBeVisible()
  expect(screen.getByText('2 events')).toBeVisible()
  expect(screen.getByText('1 item still in stock')).toBeVisible()
})
