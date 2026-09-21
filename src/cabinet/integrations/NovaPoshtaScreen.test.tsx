/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi, type Integration } from '@/api/integrations'
import type { Tenant } from '@/api/types'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { NovaPoshtaScreen } from './NovaPoshtaScreen'

vi.mock('@/api/integrations', () => ({
  integrationsApi: {
    getById: vi.fn(),
    saveNovaPoshtaKey: vi.fn(),
    verify: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    diagnose: vi.fn(),
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

const integration: Integration = {
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
  vi.mocked(integrationsApi.getById).mockResolvedValue(integration)
})

const renderScreen = () =>
  render(
    <MemoryRouter
      initialEntries={['/app/koval/settings/integrations/integration-1']}
    >
      <Routes>
        <Route
          element={<NovaPoshtaScreen />}
          path="/app/:slug/settings/integrations/:integrationId"
        />
      </Routes>
    </MemoryRouter>,
  )

it('never shows a stored key and sends only its replacement', async () => {
  vi.mocked(integrationsApi.saveNovaPoshtaKey).mockResolvedValue(integration)
  const user = userEvent.setup()

  renderScreen()

  expect(await screen.findByText('••••••••••••••••')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Замінити ключ' }))
  await user.type(
    screen.getByLabelText('Новий ключ доступу'),
    '  fixture-key  ',
  )
  await user.click(screen.getByRole('button', { name: 'Зберегти ключ' }))

  expect(integrationsApi.saveNovaPoshtaKey).toHaveBeenCalledWith(
    'integration-1',
    'fixture-key',
  )
  expect(await screen.findByText('••••••••••••••••')).toBeVisible()
})

it('cannot be switched on before a key is stored', async () => {
  vi.mocked(integrationsApi.getById).mockResolvedValue({
    ...integration,
    status: 'draft',
    configured: false,
    verifiedAt: null,
  })

  renderScreen()

  const toggle = await screen.findByRole('button', {
    name: 'Увімкнути інтеграцію',
  })
  expect(toggle).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Перевірити підключення' }),
  ).toBeDisabled()
  expect(screen.getByText('ключ не збережено')).toBeVisible()
})

it('names the step a failed verification stopped at', async () => {
  vi.mocked(integrationsApi.verify).mockResolvedValue({
    ...integration,
    status: 'error',
    lastErrorCode: 'integration_account_unverified',
  })
  vi.mocked(integrationsApi.diagnose).mockResolvedValue({
    integrationId: 'integration-1',
    status: 'error',
    healthy: false,
    checkedAt: '2026-09-21T09:31:00Z',
    lastErrorCode: 'integration_account_unverified',
    checks: [
      { code: 'configuration', status: 'passed', errorCode: null },
      {
        code: 'authorization',
        status: 'failed',
        errorCode: 'integration_account_unverified',
      },
    ],
  })
  const user = userEvent.setup()

  renderScreen()

  await user.click(
    await screen.findByRole('button', { name: 'Перевірити підключення' }),
  )

  expect(await screen.findByText('Ключ приймає сервіс')).toBeVisible()
  expect(screen.getByText('Ключ доступу збережено')).toBeVisible()
  expect(
    screen.getAllByText(/Сервіс відхилив ключ: він недійсний/).length,
  ).toBeGreaterThan(0)
})

it('turns a live integration off with the consequence spelled out', async () => {
  vi.mocked(integrationsApi.deactivate).mockResolvedValue({
    ...integration,
    status: 'inactive',
  })
  const user = userEvent.setup()

  renderScreen()

  await user.click(
    await screen.findByRole('button', { name: 'Вимкнути інтеграцію' }),
  )

  expect(integrationsApi.deactivate).toHaveBeenCalledWith('integration-1')
  expect(
    await screen.findByRole('button', { name: 'Увімкнути інтеграцію' }),
  ).toBeVisible()
  expect(screen.getByText('Вимкнена')).toBeVisible()
})
