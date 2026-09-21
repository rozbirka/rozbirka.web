/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  integrationsApi,
  type NovaPoshtaDispatchPoint,
} from '@/api/integrations'
import type { Tenant } from '@/api/types'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { DispatchPointsScreen } from './DispatchPointsScreen'

vi.mock('@/api/integrations', () => ({
  integrationsApi: {
    dispatchPoints: vi.fn(),
    createDispatchPoint: vi.fn(),
    updateDispatchPoint: vi.fn(),
    makeDispatchPointDefault: vi.fn(),
    deactivateDispatchPoint: vi.fn(),
    settlements: vi.fn(),
    divisions: vi.fn(),
  },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const tenant: Tenant = {
  id: 'tenant-1',
  name: 'Koval Auto',
  slug: 'koval',
  plan: 'active',
  planTier: 'pro',
  city: 'Львів',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'owner',
}

const cabinet = () =>
  ({
    status: 'ready',
    targetTenant: tenant,
    snapshot: {
      userId: 'user-1',
      tenantId: tenant.id,
      generation: 4,
      role: 'owner',
      permissions: new Set(['team.manage']),
      features: new Set(),
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
      cabinetParityRollout: {
        configuration: JSON.stringify({
          version: 1,
          mode: 'on',
          canaryPercent: 0,
          emergencyOff: false,
        }),
        claim: {
          version: 1,
          subjectId: 'user-1',
          grants: ['cabinet-parity'],
          audiences: [],
        },
      },
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  }) as unknown as CabinetContextValue

const mainPoint: NovaPoshtaDispatchPoint = {
  id: 'point-1',
  name: 'Головний склад',
  senderName: 'Олена Коваль',
  phone: '+380672147730',
  settlementId: 10,
  divisionId: 12,
  companyTin: '42918370',
  companyName: 'ТОВ «Розбірка Житомир»',
  isActive: true,
  isDefault: true,
}

const sparePoint: NovaPoshtaDispatchPoint = {
  ...mainPoint,
  id: 'point-2',
  name: 'Львівський розбір',
  senderName: 'Андрій Гринь',
  divisionId: 8,
  companyTin: null,
  companyName: null,
  isDefault: false,
}

const division = (id: number, name: string) => ({
  id,
  name,
  settlementId: 10,
  countryCode: 'UA',
  sendingAllowed: true,
  receivingAllowed: true,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(integrationsApi.dispatchPoints).mockResolvedValue([
    mainPoint,
    sparePoint,
  ])
  vi.mocked(integrationsApi.divisions).mockResolvedValue({
    items: [
      division(12, 'Відділення №12: вул. Небесної сотні, 6'),
      division(8, 'Відділення №8: вул. Наукова, 45'),
    ],
    page: 1,
    lastPage: 1,
  })
  vi.mocked(integrationsApi.settlements).mockResolvedValue({
    items: [
      {
        id: 10,
        name: 'Житомир',
        prohibitedSending: null,
        prohibitedIssuance: null,
      },
    ],
    page: 1,
    lastPage: 1,
  })
})

const renderScreen = () =>
  render(
    <MemoryRouter
      initialEntries={[
        '/app/koval/settings/integrations/integration-1/dispatch-points',
      ]}
    >
      <Routes>
        <Route
          element={<DispatchPointsScreen />}
          path="/app/:slug/settings/integrations/:integrationId/dispatch-points"
        />
      </Routes>
    </MemoryRouter>,
  )

it('resolves the branch name from the carrier catalogue instead of showing its code', async () => {
  renderScreen()

  const list = await screen.findByRole('region', { name: 'Точки відправлення' })
  expect(
    await within(list).findByText('Відділення №12: вул. Небесної сотні, 6'),
  ).toBeVisible()
  expect(within(list).getByText('За замовчуванням')).toBeVisible()
  expect(within(list).queryByText('12')).toBeNull()
  // One settlement is shared by both points, so it is looked up once.
  expect(integrationsApi.divisions).toHaveBeenCalledTimes(1)
})

it('adds a point from the carrier catalogue and makes it the default', async () => {
  vi.mocked(integrationsApi.dispatchPoints).mockResolvedValue([])
  vi.mocked(integrationsApi.createDispatchPoint).mockResolvedValue(sparePoint)
  vi.mocked(integrationsApi.makeDispatchPointDefault).mockResolvedValue({
    ...sparePoint,
    isDefault: true,
  })
  const user = userEvent.setup()

  renderScreen()

  await user.click(
    (await screen.findAllByRole('button', { name: 'Додати точку' }))[0]!,
  )
  await user.type(screen.getByLabelText(/Назва точки/), 'Львівський розбір')
  await user.type(screen.getByLabelText(/Населений пункт/), 'Житомир')
  const division = await screen.findByLabelText(/Відділення відправлення/)
  await vi.waitFor(() => expect(division).toBeEnabled())
  await user.selectOptions(division, '8')
  await user.type(screen.getByLabelText(/Ім’я відправника/), 'Андрій Гринь')
  await user.type(screen.getByLabelText(/Телефон відправника/), '+380639014418')
  await user.click(
    screen.getByRole('switch', { name: 'Відправник — компанія' }),
  )
  await user.click(
    screen.getByRole('switch', { name: 'Точка за замовчуванням' }),
  )
  await user.click(screen.getByRole('button', { name: 'Додати точку' }))

  expect(integrationsApi.createDispatchPoint).toHaveBeenCalledWith(
    'integration-1',
    {
      name: 'Львівський розбір',
      senderName: 'Андрій Гринь',
      phone: '+380639014418',
      settlementId: 10,
      divisionId: 8,
      companyName: null,
      companyTin: null,
      isActive: true,
    },
  )
  expect(integrationsApi.makeDispatchPointDefault).toHaveBeenCalledWith(
    'integration-1',
    'point-2',
  )
})

it('refuses to switch off the point the carrier falls back to', async () => {
  const user = userEvent.setup()

  renderScreen()

  const list = await screen.findByRole('region', { name: 'Точки відправлення' })
  await user.click(within(list).getAllByRole('button', { name: 'Змінити' })[0]!)

  const deactivate = screen.getByRole('button', { name: 'Вимкнути точку' })
  expect(deactivate).toBeDisabled()
  expect(deactivate).toHaveAccessibleDescription(/Типову точку не можна/)
  expect(screen.getByRole('switch', { name: 'Активна' })).toBeDisabled()
  expect(integrationsApi.deactivateDispatchPoint).not.toHaveBeenCalled()
})

it('offers the first point when the carrier has none yet', async () => {
  vi.mocked(integrationsApi.dispatchPoints).mockResolvedValue([])

  renderScreen()

  expect(await screen.findByText('Точок відправлення ще немає')).toBeVisible()
  expect(integrationsApi.divisions).not.toHaveBeenCalled()
})
