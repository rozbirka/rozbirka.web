/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  integrationsApi,
  type NovaPoshtaTrackingSubscription,
} from '@/api/integrations'
import type { ApiProblem } from '@/api/contracts'
import type { Tenant } from '@/api/types'
import { ToastProvider } from '@/components/app'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { TrackingSubscriptionPanel } from './tracking-panel'

vi.mock('@/api/integrations', () => ({
  integrationsApi: {
    trackingSubscription: vi.fn(),
    connectTracking: vi.fn(),
    disconnectTracking: vi.fn(),
    retryTracking: vi.fn(),
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
  requireDeliveryDeposit: true,
}

const cabinet = (which: Tenant = tenant) =>
  ({
    status: 'ready',
    targetTenant: which,
    snapshot: {
      userId: 'user-1',
      tenantId: which.id,
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

const status = (
  overrides: Partial<NovaPoshtaTrackingSubscription> = {},
): NovaPoshtaTrackingSubscription => ({
  state: 'Disabled',
  reasonCode: null,
  pendingNumbers: 0,
  unconfirmedNumbers: 0,
  lastCallbackAt: null,
  publicCallbackConfigured: true,
  canRetry: false,
  ...overrides,
})

const problem = (
  kind: ApiProblem['kind'],
  code: string | undefined,
  message = 'Tracking subscription is being updated; retry shortly.',
): ApiProblem => ({ kind, message, ...(code === undefined ? {} : { code }) })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const renderPanel = () =>
  render(
    <ToastProvider>
      <TrackingSubscriptionPanel integrationId="integration-1" />
    </ToastProvider>,
  )

beforeEach(() => {
  // Reset, not clear: a `mockResolvedValueOnce` a failing test never consumed
  // would otherwise answer the next test's first request.
  vi.resetAllMocks()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(status())
  vi.mocked(integrationsApi.connectTracking).mockResolvedValue(undefined)
  vi.mocked(integrationsApi.disconnectTracking).mockResolvedValue(undefined)
  vi.mocked(integrationsApi.retryTracking).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

it('connects without a key and calls it connected only when the server does', async () => {
  vi.useFakeTimers()
  vi.mocked(integrationsApi.trackingSubscription)
    .mockResolvedValueOnce(status())
    .mockResolvedValueOnce(status({ state: 'Connecting' }))
    .mockResolvedValueOnce(status({ state: 'AwaitingVerification' }))
    .mockResolvedValue(
      status({ state: 'Connected', lastCallbackAt: '2026-09-27T10:00:00Z' }),
    )

  renderPanel()
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.getByText('Не підключено')).toBeVisible()

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Підключити' }))
    await Promise.resolve()
  })

  // No key is sent: Core reuses the one already stored for the integration.
  expect(integrationsApi.connectTracking).toHaveBeenCalledWith(
    'integration-1',
    null,
  )
  expect(
    screen.getByText(/Підключаємо оновлення — реєструємо підписку/),
  ).toBeVisible()
  expect(screen.queryByText('Підключено')).not.toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(5_000)
    await Promise.resolve()
  })
  expect(
    screen.getByText(/Очікуємо підтвердження від Нової пошти/),
  ).toBeVisible()
  expect(screen.queryByText('Підключено')).not.toBeInTheDocument()

  await act(async () => {
    vi.advanceTimersByTime(5_000)
    await Promise.resolve()
  })
  expect(screen.getByText('Підключено')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Відключити' })).toBeVisible()
})

it('asks for a key only after Core says there is none stored', async () => {
  vi.mocked(integrationsApi.connectTracking).mockRejectedValueOnce(
    problem('validation', 'tracking_credentials_required'),
  )
  const user = userEvent.setup()

  renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Підключити' }))

  const field = screen.getByLabelText('API-ключ Нової пошти')
  expect(field).toHaveAttribute('type', 'password')
  expect(screen.getByText(/Потрібен API-ключ Нової пошти/)).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Показати ключ' }))
  expect(screen.getByLabelText('API-ключ Нової пошти')).toHaveAttribute(
    'type',
    'text',
  )

  await user.type(screen.getByLabelText('API-ключ Нової пошти'), '  np-key  ')
  await user.click(screen.getByRole('button', { name: 'Підключити' }))

  expect(integrationsApi.connectTracking).toHaveBeenLastCalledWith(
    'integration-1',
    'np-key',
  )
  // Accepted: the form closes and the key is not kept anywhere.
  expect(
    screen.queryByLabelText('API-ключ Нової пошти'),
  ).not.toBeInTheDocument()
})

it('sends one command however many times the button is clicked', async () => {
  const pending = deferred<void>()
  vi.mocked(integrationsApi.connectTracking).mockReturnValue(pending.promise)
  const user = userEvent.setup()

  renderPanel()
  const connect = await screen.findByRole('button', { name: 'Підключити' })
  await user.click(connect)
  await user.click(connect)
  await user.click(connect)

  expect(integrationsApi.connectTracking).toHaveBeenCalledTimes(1)
  pending.resolve()
})

it('explains a busy subscription in Ukrainian and re-reads the state', async () => {
  vi.mocked(integrationsApi.connectTracking).mockRejectedValueOnce(
    problem('conflict', 'tracking_busy'),
  )
  const user = userEvent.setup()

  renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Підключити' }))

  expect(screen.getByText(/Ця дія вже виконується/)).toBeVisible()
  expect(screen.queryByText(/retry shortly/)).not.toBeInTheDocument()
  expect(integrationsApi.trackingSubscription).toHaveBeenCalledTimes(2)
})

it('names the conflict with a hand-configured webhook without touching it', async () => {
  vi.mocked(integrationsApi.connectTracking).mockRejectedValueOnce(
    problem('conflict', 'tracking_manual_webhook_configured'),
  )
  const user = userEvent.setup()

  renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Підключити' }))

  expect(screen.getByText(/вже налаштований ручний вебхук/)).toBeVisible()
  expect(screen.getByText(/самі ми його не вимикаємо/)).toBeVisible()
})

it('shows a no-access state rather than an action when Core refuses the read', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockRejectedValue(
    problem('forbidden', undefined, 'Forbidden'),
  )

  renderPanel()

  expect(
    await screen.findByText(/Немає доступу до автоматичних оновлень/),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Підключити' }),
  ).not.toBeInTheDocument()
})

it('does not offer connecting where the environment has no public callback', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(
    status({ publicCallbackConfigured: false }),
  )

  renderPanel()

  expect(
    await screen.findByText(/автоматичні оновлення ще не налаштовані/),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Підключити' })).toBeDisabled()
  // The yard is never asked for a callback address of its own.
  expect(screen.queryByLabelText(/адрес/i)).not.toBeInTheDocument()
})

it('counts the waybills still queued and the ones the carrier never confirmed', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(
    status({
      state: 'Connected',
      pendingNumbers: 2,
      unconfirmedNumbers: 3,
      lastCallbackAt: '2026-09-27T09:00:00Z',
    }),
  )

  renderPanel()

  expect(
    await screen.findByText('Накладних у черзі підключення: 2.'),
  ).toBeVisible()
  expect(
    screen.getByText(/Для 3 накладних автоматичні оновлення не підтверджені/),
  ).toBeVisible()
  expect(screen.getByText(/Періодична перевірка продовжується/)).toBeVisible()
})

it('carries neither the typed key nor the previous answer into another yard', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(
    status({ state: 'NeedsCredentials', reasonCode: 'provider_unauthorized' }),
  )
  const user = userEvent.setup()

  const view = renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Ввести ключ' }))
  await user.type(screen.getByLabelText('API-ключ Нової пошти'), 'first-yard')

  const other: Tenant = { ...tenant, id: 'tenant-2', slug: 'other' }
  vi.mocked(useCabinet).mockReturnValue(cabinet(other))
  view.rerender(
    <ToastProvider>
      <TrackingSubscriptionPanel integrationId="integration-1" />
    </ToastProvider>,
  )

  expect(
    screen.queryByLabelText('API-ключ Нової пошти'),
  ).not.toBeInTheDocument()
  expect(screen.getByText('Читаємо стан підписки…')).toBeVisible()
})

it('checks the state instead of resending a command that lost its answer', async () => {
  vi.mocked(integrationsApi.connectTracking).mockRejectedValueOnce(
    problem('network', undefined, 'Network Error'),
  )
  const user = userEvent.setup()

  renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Підключити' }))

  expect(integrationsApi.connectTracking).toHaveBeenCalledTimes(1)
  expect(integrationsApi.trackingSubscription).toHaveBeenCalledTimes(2)
  expect(screen.getByText(/Ми не повторюємо дію самі/)).toBeVisible()
})

it('renders a state this build has never heard of without falling over', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(
    status({ state: 'Quantum' }),
  )

  renderPanel()

  expect(await screen.findByText('Стан невідомий')).toBeVisible()
  expect(screen.getByText(/нічого не зламано/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Оновити стан' })).toBeVisible()
})

it('waits for the server to confirm a disconnection', async () => {
  vi.mocked(integrationsApi.trackingSubscription)
    .mockResolvedValueOnce(
      status({ state: 'Connected', lastCallbackAt: '2026-09-27T09:00:00Z' }),
    )
    .mockResolvedValue(status({ state: 'Disconnecting' }))
  const user = userEvent.setup()

  renderPanel()
  await user.click(await screen.findByRole('button', { name: 'Відключити' }))

  expect(
    screen.getByText(
      'Накладні й історія залишаться. Періодична перевірка статусів продовжить працювати.',
    ),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Відключити', hidden: false }),
  )

  expect(integrationsApi.disconnectTracking).toHaveBeenCalledWith(
    'integration-1',
  )
  expect(await screen.findByText(/Відключаємо оновлення/)).toBeVisible()
  expect(screen.queryByText('Не підключено')).not.toBeInTheDocument()
})

it('can be driven from the keyboard alone, reveal toggle included', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(
    status({ state: 'NeedsCredentials', reasonCode: 'provider_unauthorized' }),
  )
  const user = userEvent.setup()

  renderPanel()
  const open = await screen.findByRole('button', { name: 'Ввести ключ' })
  open.focus()
  await user.keyboard('{Enter}')

  const field = screen.getByLabelText('API-ключ Нової пошти')
  await user.tab()
  expect(field).toHaveFocus()
  await user.keyboard('np-key')
  await user.tab()
  const reveal = screen.getByRole('button', { name: 'Показати ключ' })
  expect(reveal).toHaveFocus()
  await user.keyboard(' ')
  expect(screen.getByLabelText('API-ключ Нової пошти')).toHaveAttribute(
    'type',
    'text',
  )

  await user.tab()
  expect(screen.getByRole('button', { name: 'Підключити' })).toHaveFocus()
  await user.keyboard('{Enter}')

  expect(integrationsApi.connectTracking).toHaveBeenCalledWith(
    'integration-1',
    'np-key',
  )
})
