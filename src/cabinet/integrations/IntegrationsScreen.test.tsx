/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi, type Integration } from '@/api/integrations'
import type { Tenant } from '@/api/types'
import { tenantSettings } from '@/api/tenant-settings'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { LocaleProvider } from '@/i18n'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { IntegrationsScreen } from './IntegrationsScreen'

vi.mock('@/api/integrations', () => ({
  integrationsApi: {
    list: vi.fn(),
    definitions: vi.fn(),
    create: vi.fn(),
  },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
vi.mock('@/auth/useTenantSettings', () => ({ useTenantSettings: vi.fn() }))

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
  requireDeliveryDeposit: true,
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
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  }) as unknown as CabinetContextValue

const novaPoshta: Integration = {
  id: 'integration-1',
  definitionId: 'definition-np',
  code: 'nova_poshta',
  displayName: 'Нова пошта',
  status: 'active',
  configured: true,
  verifiedAt: '2026-09-21T09:31:00Z',
  lastErrorCode: null,
  settings: { configured: true, activeDispatchPoints: 3 },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(useTenantSettings).mockReturnValue(tenantSettings(null))
  vi.mocked(integrationsApi.list).mockResolvedValue([novaPoshta])
  vi.mocked(integrationsApi.definitions).mockResolvedValue([
    { id: 'definition-np', code: 'nova_poshta', displayName: 'Нова пошта' },
  ])
})

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/app/koval/settings/integrations']}>
      <IntegrationsScreen />
    </MemoryRouter>,
  )

it('opens a connected service by its own link', async () => {
  renderScreen()

  const connected = await screen.findByRole('region', {
    name: 'Підключені сервіси',
  })
  expect(
    within(connected).getByRole('link', { name: /Нова пошта/ }),
  ).toHaveAttribute('href', '/app/koval/settings/integrations/integration-1')
  expect(within(connected).getByText('Підключена')).toBeVisible()
  expect(
    screen.queryByRole('region', { name: 'Доступні до підключення' }),
  ).not.toBeInTheDocument()
})

it('explains a failing connection instead of showing its code', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([
    {
      ...novaPoshta,
      status: 'error',
      lastErrorCode: 'integration_account_unverified',
    },
  ])

  renderScreen()

  expect(await screen.findByText('Помилка')).toBeVisible()
  expect(screen.getByText(/Сервіс відхилив ключ: він недійсний/)).toBeVisible()
  expect(screen.queryByText('integration_account_unverified')).toBeNull()
})

it('connects a catalog service that is not in use yet', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([])
  vi.mocked(integrationsApi.create).mockResolvedValue(novaPoshta)
  const user = userEvent.setup()

  renderScreen()

  const available = await screen.findByRole('region', {
    name: 'Доступні до підключення',
  })
  await user.click(
    within(available).getByRole('button', { name: 'Підключити' }),
  )

  expect(integrationsApi.create).toHaveBeenCalledWith('definition-np')
})

it('keeps the exchange log disabled while the service stores no history', async () => {
  renderScreen()

  const control = await screen.findByRole('button', { name: 'Журнал обміну' })
  expect(control).toBeDisabled()
  expect(control).toHaveAccessibleDescription(/Журналу обміну немає/)
})

const asCountry = (countryCode: 'UA' | 'GB' | 'PL') =>
  vi.mocked(useTenantSettings).mockReturnValue({
    ...tenantSettings(null),
    countryCode,
  })

it('speaks British English inside an en-GB locale', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([
    { ...novaPoshta, status: 'error', lastErrorCode: 'nova_poshta_disabled' },
  ])
  vi.mocked(integrationsApi.definitions).mockResolvedValue([
    { id: 'definition-np', code: 'nova_poshta', displayName: 'Nova Poshta' },
    { id: 'definition-x', code: 'courier_x', displayName: 'Courier X' },
  ])
  asCountry('UA')

  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <MemoryRouter initialEntries={['/app/koval/settings/integrations']}>
        <IntegrationsScreen />
      </MemoryRouter>
    </LocaleProvider>,
  )

  const connected = await screen.findByRole('region', {
    name: 'Connected services',
  })
  expect(within(connected).getByText('Error')).toBeVisible()
  expect(within(connected).getByText('Delivery')).toBeVisible()
  expect(
    within(connected).getByText(
      'The Nova Poshta integration is turned off or not set up.',
    ),
  ).toBeVisible()
  expect(screen.getByText(/1 of 2 available services connected/)).toBeVisible()
  const available = screen.getByRole('region', {
    name: 'Available to connect',
  })
  expect(
    within(available).getByRole('button', { name: 'Connect' }),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Exchange log' })).toBeDisabled()
  expect(screen.queryByText(/Нова пошта доступна лише/)).toBeNull()
})

it.each(['GB', 'PL'] as const)(
  'shows Nova Poshta as unavailable for a %s business, keeping its history readable',
  async (country) => {
    asCountry(country)

    render(
      <LocaleProvider locale="en-GB" syncDocumentLang={false}>
        <MemoryRouter initialEntries={['/app/koval/settings/integrations']}>
          <IntegrationsScreen />
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(
      await screen.findByText(
        'Nova Poshta is only available for businesses in Ukraine. Integrations for your country will come later.',
      ),
    ).toBeVisible()
    const connected = screen.getByRole('region', { name: 'Connected services' })
    // The old connection is still listed, but there is nothing to open.
    expect(within(connected).getByText('Нова пошта')).toBeVisible()
    expect(within(connected).queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull()
  },
)

it('never offers to connect Nova Poshta outside Ukraine, whatever the language', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([])
  asCountry('PL')

  render(
    <MemoryRouter initialEntries={['/app/koval/settings/integrations']}>
      <IntegrationsScreen />
    </MemoryRouter>,
  )

  expect(
    await screen.findByText(/Нова пошта доступна лише для бізнесів в Україні/),
  ).toBeVisible()
  expect(
    screen.queryByRole('region', { name: 'Доступні до підключення' }),
  ).toBeNull()
  expect(screen.queryByRole('button', { name: 'Підключити' })).toBeNull()
})

it('explains a country refusal from Core instead of its raw message', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([])
  vi.mocked(integrationsApi.create).mockRejectedValue({
    kind: 'conflict',
    status: 409,
    code: 'integration_country_unavailable',
    message: 'Integration is not available for tenant country.',
  })
  const user = userEvent.setup()

  render(
    <LocaleProvider locale="pl" syncDocumentLang={false}>
      <MemoryRouter initialEntries={['/app/koval/settings/integrations']}>
        <IntegrationsScreen />
      </MemoryRouter>
    </LocaleProvider>,
  )

  await user.click(await screen.findByRole('button', { name: 'Połącz' }))

  expect(
    await screen.findByText(
      'Nova Poshta jest dostępna tylko dla firm na Ukrainie. Integracje dla Twojego kraju pojawią się później.',
    ),
  ).toBeVisible()
  expect(screen.queryByText(/not available for tenant country/)).toBeNull()
})
