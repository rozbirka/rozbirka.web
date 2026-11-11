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

it('distinguishes confirmed subscription callbacks from real shipment events and explains key reuse', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(
    status({ state: 'Connected', lastCallbackAt: '2026-11-11T12:52:00Z' }),
  )
  renderPanel()
  expect(
    await screen.findByText(/Збережений ключ НП використовується для вебхуків/),
  ).toBeVisible()
  expect(screen.getByText(/Останній callback/)).toBeVisible()
  expect(screen.getByText(/Callback може бути тестовим/)).toBeVisible()
})

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

it('observes automatic setup without sending a connect command', async () => {
  vi.useFakeTimers()
  vi.mocked(integrationsApi.trackingSubscription)
    .mockResolvedValueOnce(status({ state: 'Connecting' }))
    .mockResolvedValueOnce(status({ state: 'AwaitingVerification' }))
    .mockResolvedValue(
      status({ state: 'Connected', lastCallbackAt: '2026-10-29T15:00:00Z' }),
    )
  renderPanel()
  await act(async () => {
    await Promise.resolve()
  })
  expect(
    screen.queryByRole('button', { name: 'Підключити' }),
  ).not.toBeInTheDocument()
  expect(screen.getByText(/Нові накладні додаються автоматично/)).toBeVisible()
  await act(async () => {
    vi.advanceTimersByTime(5_000)
    await Promise.resolve()
  })
  expect(screen.getByText('Очікуємо підтвердження')).toBeVisible()
  await act(async () => {
    vi.advanceTimersByTime(5_000)
    await Promise.resolve()
  })
  expect(screen.getByText('Підключено')).toBeVisible()
  expect(integrationsApi.connectTracking).not.toHaveBeenCalled()
})

it('connects with the independent v1 key and waits for callback confirmation', async () => {
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

  fireEvent.change(screen.getByLabelText('API-ключ NovaPost v1'), {
    target: { value: 'v1-test-key' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Підключити' }))
    await Promise.resolve()
  })

  expect(integrationsApi.connectTracking).toHaveBeenCalledWith(
    'integration-1',
    'v1-test-key',
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

it('repairs webhook credentials without reopening the v2 setup wizard', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(
    status({ state: 'NeedsCredentials', reasonCode: 'provider_unauthorized' }),
  )
  const user = userEvent.setup()
  renderPanel()
  const input = await screen.findByLabelText('API-ключ NovaPost v1')
  expect(input).toHaveAttribute('type', 'password')
  expect(
    screen.queryByRole('link', { name: 'Перевірити підключення НП' }),
  ).not.toBeInTheDocument()
  const connect = screen.getByRole('button', { name: 'Підключити' })
  expect(connect).toBeDisabled()
  await user.type(input, ' independent-v1-key ')
  await user.click(connect)
  expect(integrationsApi.connectTracking).toHaveBeenCalledWith(
    'integration-1',
    'independent-v1-key',
  )
  expect(input).toHaveValue('')
})

it('discards a sensitive key when the tenant changes, including switching back', async () => {
  const view = renderPanel()
  const input = await screen.findByLabelText('API-ключ NovaPost v1')
  fireEvent.change(input, { target: { value: 'private-key' } })
  vi.mocked(useCabinet).mockReturnValue(
    cabinet({ ...tenant, id: 'tenant-2', slug: 'other' }),
  )
  view.rerender(
    <ToastProvider>
      <TrackingSubscriptionPanel integrationId="integration-1" />
    </ToastProvider>,
  )
  expect(await screen.findByLabelText('API-ключ NovaPost v1')).toHaveValue('')
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  view.rerender(
    <ToastProvider>
      <TrackingSubscriptionPanel integrationId="integration-1" />
    </ToastProvider>,
  )
  expect(await screen.findByLabelText('API-ключ NovaPost v1')).toHaveValue('')
})

it('sends one command however many times the button is clicked', async () => {
  const pending = deferred<void>()
  vi.mocked(integrationsApi.connectTracking).mockReturnValue(pending.promise)
  const user = userEvent.setup()

  renderPanel()
  const connect = await screen.findByRole('button', { name: 'Підключити' })
  fireEvent.change(screen.getByLabelText('API-ключ NovaPost v1'), {
    target: { value: 'v1-test-key' },
  })
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
  fireEvent.change(await screen.findByLabelText('API-ключ NovaPost v1'), {
    target: { value: 'v1-test-key' },
  })
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
  fireEvent.change(await screen.findByLabelText('API-ключ NovaPost v1'), {
    target: { value: 'v1-test-key' },
  })
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
  expect(
    screen.queryByRole('button', { name: 'Підключити' }),
  ).not.toBeInTheDocument()
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

it('does not carry a previous error into another yard', async () => {
  vi.mocked(integrationsApi.connectTracking).mockRejectedValueOnce(
    problem('conflict', 'tracking_busy'),
  )
  const user = userEvent.setup()
  const view = renderPanel()
  fireEvent.change(await screen.findByLabelText('API-ключ NovaPost v1'), {
    target: { value: 'v1-test-key' },
  })
  await user.click(await screen.findByRole('button', { name: 'Підключити' }))
  expect(screen.getByText(/Ця дія вже виконується/)).toBeVisible()
  vi.mocked(useCabinet).mockReturnValue(
    cabinet({ ...tenant, id: 'tenant-2', slug: 'other' }),
  )
  view.rerender(
    <ToastProvider>
      <TrackingSubscriptionPanel integrationId="integration-1" />
    </ToastProvider>,
  )
  expect(screen.queryByText(/Ця дія вже виконується/)).not.toBeInTheDocument()
  expect(screen.getByText('Читаємо стан підписки…')).toBeVisible()
})

it('checks the state instead of resending a command that lost its answer', async () => {
  vi.mocked(integrationsApi.connectTracking).mockRejectedValueOnce(
    problem('network', undefined, 'Network Error'),
  )
  const user = userEvent.setup()

  renderPanel()
  fireEvent.change(await screen.findByLabelText('API-ключ NovaPost v1'), {
    target: { value: 'v1-test-key' },
  })
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

it('provides keyboard access to the separate v1 credential form', async () => {
  vi.mocked(integrationsApi.trackingSubscription).mockResolvedValue(
    status({ state: 'NeedsCredentials' }),
  )
  const user = userEvent.setup()
  renderPanel()
  const input = await screen.findByLabelText('API-ключ NovaPost v1')
  await user.tab()
  expect(input).toHaveFocus()
})
