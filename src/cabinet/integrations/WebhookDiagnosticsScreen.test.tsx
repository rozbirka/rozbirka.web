/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi } from '@/api/integrations'
import type { Tenant } from '@/api/types'
import { ToastProvider } from '@/components/app'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { WebhookDiagnosticsScreen } from './WebhookDiagnosticsScreen'

vi.mock('@/api/integrations', () => ({
  integrationsApi: {
    webhookStatus: vi.fn(),
    configureWebhook: vi.fn(),
    retryWebhookEvent: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(integrationsApi.webhookStatus).mockResolvedValue({
    enabled: true,
    pending: 14,
    deadLetters: 2,
    oldestPendingAt: new Date(Date.now() - 38 * 60000).toISOString(),
    deadLetterIds: [
      '3f2a1b4c-0000-0000-0000-000000000001',
      'aa11bb22-0000-0000-0000-000000000002',
    ],
  })
})

const renderScreen = () =>
  render(
    <MemoryRouter
      initialEntries={[
        '/app/koval/settings/integrations/integration-1/webhook',
      ]}
    >
      <ToastProvider>
        <Routes>
          <Route
            element={<WebhookDiagnosticsScreen />}
            path="/app/:slug/settings/integrations/:integrationId/webhook"
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

it('reports the queue in minutes waited rather than a raw timestamp', async () => {
  renderScreen()

  expect(await screen.findByText('38 хв')).toBeVisible()
  expect(screen.getByText('14')).toBeVisible()
  expect(screen.getByText(/не вдалося обробити після всіх спроб/)).toBeVisible()
})

it('says plainly that the service reports no waybill or reason for a stuck event', async () => {
  renderScreen()

  const failures = await screen.findByRole('region', {
    name: 'Події з вичерпаними спробами',
  })
  expect(within(failures).getByText('Подія 3f2a1b4c')).toBeVisible()
  expect(
    within(failures).getByText(/Сервіс не повідомляє, якої накладної/),
  ).toBeVisible()
})

it('retries every stuck event and counts the ones that stayed stuck', async () => {
  vi.mocked(integrationsApi.retryWebhookEvent)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('still stuck'))
  const user = userEvent.setup()

  renderScreen()

  await user.click(await screen.findByRole('button', { name: 'Повторити всі' }))

  expect(integrationsApi.retryWebhookEvent).toHaveBeenCalledTimes(2)
  expect(
    await screen.findByText('Повторено 1 із 2. Не вдалося: 1.'),
  ).toBeVisible()
})

it('offers a secret when the feed is not receiving anything yet', async () => {
  vi.mocked(integrationsApi.webhookStatus).mockResolvedValue({
    enabled: false,
    pending: 0,
    deadLetters: 0,
    oldestPendingAt: null,
    deadLetterIds: [],
  })
  vi.mocked(integrationsApi.configureWebhook).mockResolvedValue(undefined)
  const user = userEvent.setup()

  renderScreen()

  expect(await screen.findByText(/Прийом подій не налаштований/)).toBeVisible()
  expect(screen.getByText('секрет не збережено')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Додати секрет' }))
  await user.type(screen.getByLabelText(/Новий секрет/), '  np-secret  ')
  await user.click(screen.getByRole('button', { name: 'Зберегти секрет' }))

  expect(integrationsApi.configureWebhook).toHaveBeenCalledWith(
    'integration-1',
    'np-secret',
  )
})
