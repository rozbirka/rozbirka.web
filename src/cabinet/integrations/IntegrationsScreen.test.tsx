/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi, type Integration } from '@/api/integrations'
import type { Tenant } from '@/api/types'
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
