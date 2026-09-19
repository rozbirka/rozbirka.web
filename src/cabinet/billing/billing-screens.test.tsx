import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import type * as BillingModule from '@/api/billing'
import { beforeEach, expect, it, vi } from 'vitest'
import { billingApi, type ProviderAwareSubscriptionDto } from '@/api/billing'
import type { PublicPlanDto } from '@/api/types'
import { ToastProvider } from '@/components/app'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { tenantRequestScope } from '../tenant-request-scope'
import { PaymentsScreen } from './payments-screen'
import { PlansScreen } from './plans-screen'
import { SubscriptionScreen } from './subscription-screen'

/* eslint-disable @typescript-eslint/unbound-method -- Vitest resolves object methods into typed mocks. */

vi.mock('@/api/billing', async (importOriginal) => ({
  ...(await importOriginal<typeof BillingModule>()),
  billingApi: {
    getSubscription: vi.fn(),
    getPlans: vi.fn(),
    subscribe: vi.fn(),
    cancel: vi.fn(),
    getPayments: vi.fn(),
    cancelPayment: vi.fn(),
  },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const subscription: ProviderAwareSubscriptionDto = {
  state: 'trial',
  planCode: 'pro_monthly',
  planName: 'Pro',
  trialEndsAt: '2026-08-21T00:00:00Z',
  trialDaysRemaining: 7,
  currentPeriodEnd: '2026-08-21T00:00:00Z',
  nextChargeAt: null,
  amount: 0,
  currency: 'USD',
  cardLast4: null,
  cardBrand: null,
  canSubscribe: true,
  canCancel: false,
  canReactivate: false,
  canActivateTrial: false,
  usage: {
    cars: { used: 0, max: 100 },
    intakes: { used: 0, max: 100 },
    parts: { used: 0, max: 1000 },
    users: { used: 1, max: 10 },
    cashRegisters: { used: 0, max: 5 },
  },
  features: [],
  source: 'mono',
  manageVia: 'web',
}

const cancellableSubscription: ProviderAwareSubscriptionDto = {
  ...subscription,
  state: 'active',
  amount: 29,
  canSubscribe: false,
  canCancel: true,
}

const litePlan: PublicPlanDto = {
  code: 'lite_monthly',
  name: 'Lite',
  amount: 29,
  currency: 'USD',
  interval: '1m',
  trialDays: 14,
  limits: {
    cars: 10,
    intakes: 10,
    parts: 1000,
    users: 2,
    cashRegisters: 1,
    photosPerPart: null,
  },
  features: [],
}

const pendingPayment = {
  id: 'payment-1',
  type: 'checkout' as const,
  status: 'pending' as const,
  amount: 29,
  currency: 'USD',
  providerInvoiceId: 'invoice-1',
  checkoutUrl: 'https://pay.example/checkout',
  checkoutExpiresAt: '2099-08-15T12:00:00Z',
  createdAt: '2026-08-15T10:00:00Z',
}

const paymentPage = (items = [pendingPayment]) => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: items.length > 0 ? 1 : 0,
})

function axiosFailure(status: number, message: string) {
  return new AxiosError(
    'request failed',
    'ERR_BAD_RESPONSE',
    { headers: new AxiosHeaders(), method: 'post', url: '/billing' },
    undefined,
    {
      status,
      statusText: 'Error',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: { error: { code: 'BILLING_FAILURE', message } },
    },
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const cabinet = (
  permissions = ['billing.view', 'billing.manage'],
  currentSubscription: ProviderAwareSubscriptionDto = subscription,
  generation = 4,
) =>
  ({
    status: 'ready',
    targetTenant: {
      id: 'tenant-1',
      name: 'Koval Auto',
      slug: 'koval',
      plan: 'trial',
      planTier: 'pro',
      city: null,
      logoUrl: null,
      isActive: true,
      createdAt: '2026-08-01T10:00:00Z',
      roleName: 'manager',
    },
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation,
      role: 'custom-role',
      permissions: new Set(permissions),
      features: new Set<string>(),
      entitlement: {
        state: currentSubscription.state,
        usage: currentSubscription.usage,
      },
      subscription: currentSubscription,
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  }) satisfies CabinetContextValue

// Billing mutations run through `useOperation`, which confirms success through
// the cabinet toaster — the screens need its provider the way the shell gives
// it to them.
const inShell = (screenToRender: ReactNode) => (
  <MemoryRouter>
    <ToastProvider>{screenToRender}</ToastProvider>
  </MemoryRouter>
)

const renderScreen = (screenToRender: ReactNode) =>
  render(inShell(screenToRender))

beforeEach(() => {
  vi.clearAllMocks()
  tenantRequestScope.rotate()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(billingApi.getPlans).mockResolvedValue([])
  vi.mocked(billingApi.getPayments).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  })
})

it('uses the cabinet subscription snapshot without loading it again', () => {
  renderScreen(<SubscriptionScreen />)

  expect(screen.getByRole('heading', { name: 'Pro' })).toBeVisible()
  expect(screen.getByText(/7 днів/)).toBeInTheDocument()
  expect(billingApi.getSubscription).not.toHaveBeenCalled()
})

it('keeps subscription usage text at WCAG AA contrast', () => {
  const view = renderScreen(<SubscriptionScreen />)

  expect(screen.getByRole('heading', { name: 'Ліміти тарифу' })).toBeVisible()
  expect(view.container.querySelector('.text-neutral-600')).toBeNull()
})

it('routes native subscriptions to their provider without Mono controls', () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, {
      ...cancellableSubscription,
      canReactivate: true,
      source: 'apple_iap',
      manageVia: 'apple',
    }),
  )

  renderScreen(<SubscriptionScreen />)

  expect(
    screen.getByRole('link', { name: 'Керувати в App Store' }),
  ).toHaveAttribute('href', 'https://apps.apple.com/account/subscriptions')
  expect(
    screen.queryByRole('button', { name: 'Скасувати підписку' }),
  ).toBeNull()
  expect(screen.queryByRole('button', { name: 'Поновити підписку' })).toBeNull()
})

it('never offers Mono checkout for native subscriptions in the plans screen', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, {
      ...subscription,
      source: 'google_play',
      manageVia: 'google',
    }),
  )
  vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])

  renderScreen(<PlansScreen />)

  expect(
    await screen.findByRole('heading', { name: 'Lite' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Обрати' })).toBeNull()
  expect(screen.getByText(/Google Play/)).toBeInTheDocument()
})

it.each([
  ['apple_iap', 'web'],
  ['mono', 'apple'],
  ['apple_iap', null],
  [null, 'web'],
] as const)(
  'fails closed for mismatched provider metadata (%s, %s)',
  (source, manageVia) => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(undefined, {
        ...cancellableSubscription,
        canReactivate: true,
        source,
        manageVia,
      }),
    )

    renderScreen(<SubscriptionScreen />)

    expect(
      screen.queryByRole('button', { name: 'Скасувати підписку' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Поновити підписку' }),
    ).toBeNull()
    expect(screen.queryByRole('link', { name: /Керувати в/ })).toBeNull()
    expect(
      screen.getByText(/Керування підпискою недоступне/),
    ).toBeInTheDocument()
  },
)

it('revalidates the latest provider before dispatching Mono reactivation', async () => {
  const currentCabinet = cabinet(undefined, {
    ...cancellableSubscription,
    canReactivate: true,
  })
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen(<SubscriptionScreen />)
  // The overview loads its payment strip; let it land before interacting, or
  // the re-render replaces the button mid-click.
  await screen.findByText('Платежів ще не було.')

  const currentSnapshot = currentCabinet.snapshot
  if (!currentSnapshot) throw new Error('Expected ready cabinet snapshot')
  currentSnapshot.subscription = {
    ...cancellableSubscription,
    source: 'apple_iap',
    manageVia: 'apple',
  }
  await user.click(screen.getByRole('button', { name: 'Поновити підписку' }))

  expect(billingApi.subscribe).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Керування підпискою недоступне.',
  )
})

it('revalidates the latest provider before dispatching Mono cancellation', async () => {
  const currentCabinet = cabinet(undefined, cancellableSubscription)
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen(<SubscriptionScreen />)
  // The overview loads its payment strip; let it land before interacting, or
  // the re-render replaces the button mid-click.
  await screen.findByText('Платежів ще не було.')

  const currentSnapshot = currentCabinet.snapshot
  if (!currentSnapshot) throw new Error('Expected ready cabinet snapshot')
  currentSnapshot.subscription = {
    ...cancellableSubscription,
    source: 'google_play',
    manageVia: 'google',
  }
  await user.click(screen.getByRole('button', { name: 'Скасувати підписку' }))
  await user.click(
    await screen.findByRole('button', { name: 'Так, скасувати підписку' }),
  )

  expect(billingApi.cancel).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Керування підпискою недоступне.',
  )
})

it('states the consequence before cancelling and does nothing until confirmed', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, cancellableSubscription),
  )
  const user = userEvent.setup()
  renderScreen(<SubscriptionScreen />)

  await user.click(screen.getByRole('button', { name: 'Скасувати підписку' }))

  expect(
    screen.getByRole('dialog', { name: 'Скасувати підписку?' }),
  ).toHaveAccessibleDescription(/до кінця сплаченого періоду/)

  await user.click(screen.getByRole('button', { name: 'Залишити підписку' }))

  expect(billingApi.cancel).not.toHaveBeenCalled()
})

it('confirms a completed cancellation with the refreshed subscription state', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, cancellableSubscription),
  )
  vi.mocked(billingApi.cancel).mockResolvedValue(undefined)
  vi.mocked(billingApi.getSubscription).mockResolvedValue({
    ...cancellableSubscription,
    state: 'cancelled',
    canCancel: false,
    canReactivate: true,
  })
  const user = userEvent.setup()
  renderScreen(<SubscriptionScreen />)

  await user.click(screen.getByRole('button', { name: 'Скасувати підписку' }))
  await user.click(
    screen.getByRole('button', { name: 'Так, скасувати підписку' }),
  )

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Підписку скасовано.',
  )
  expect(screen.getByText('Скасована')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('uses source-appropriate payment copy for native subscriptions', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, {
      ...cancellableSubscription,
      source: 'apple_iap',
      manageVia: 'apple',
    }),
  )
  renderScreen(<PaymentsScreen />)

  // Let the ledger land: the card moves into its column once it does.
  await screen.findByText('Платежів ще не було.')
  expect(
    screen.getByText(/Спосіб оплати керується App Store/),
  ).toBeInTheDocument()
  expect(screen.queryByText(/Monobank/)).toBeNull()
})

it('orders the payment page heading before the billing history section', async () => {
  const view = renderScreen(<PaymentsScreen />)

  await screen.findByText('Платежів ще не було.')
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(
    screen.getByRole('heading', { level: 1, name: 'Платежі' }),
  ).toBeVisible()
  expect(
    screen.getByRole('heading', { level: 2, name: 'Спосіб оплати' }),
  ).toBeVisible()
  expect(view.container.querySelector('.text-neutral-500')).toBeNull()
})

it('loads plans with a signal that aborts on tenant transition', async () => {
  renderScreen(<PlansScreen />)

  await waitFor(() => expect(billingApi.getPlans).toHaveBeenCalledOnce())
  const options = vi.mocked(billingApi.getPlans).mock.calls[0]?.[0]
  expect(options?.signal?.aborted).toBe(false)

  tenantRequestScope.rotate()

  expect(options?.signal?.aborted).toBe(true)
})

it('hides checkout controls without billing.manage regardless of role name', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['billing.view']))
  vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])

  renderScreen(<PlansScreen />)

  expect(
    await screen.findByRole('heading', { name: 'Lite' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Обрати' })).toBeNull()
})

it('checks billing.manage immediately before checkout dispatch', async () => {
  vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
  vi.mocked(billingApi.subscribe).mockReturnValue(new Promise(() => undefined))
  const user = userEvent.setup()
  renderScreen(<PlansScreen />)

  await user.click(await screen.findByRole('button', { name: 'Обрати' }))

  expect(billingApi.subscribe).toHaveBeenCalledWith(
    { planCode: 'lite_monthly' },
    { signal: tenantRequestScope.signal },
  )
})

it('rechecks the latest permission instead of trusting the rendered control', async () => {
  vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen(<PlansScreen />)
  const button = await screen.findByRole('button', { name: 'Обрати' })
  currentCabinet.snapshot?.permissions.delete('billing.manage')

  await user.click(button)

  expect(billingApi.subscribe).not.toHaveBeenCalled()
})

it('loads payments with tenant scope and exposes cancel only with billing.manage', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
  vi.mocked(useCabinet).mockReturnValue(cabinet(['billing.view']))

  renderScreen(<PaymentsScreen />)

  expect(await screen.findByText('Очікує')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull()
  expect(billingApi.getPayments).toHaveBeenCalledWith(1, 10, {
    signal: tenantRequestScope.signal,
  })
  const options = vi.mocked(billingApi.getPayments).mock.calls[0]?.[2]
  tenantRequestScope.rotate()
  expect(options?.signal?.aborted).toBe(true)
})

it('keeps pending checkout as a secured new-tab link', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
  renderScreen(<PaymentsScreen />)

  const checkout = await screen.findByRole('link', {
    name: 'Продовжити оплату',
  })
  expect(checkout).toHaveAttribute('href', 'https://pay.example/checkout')
  expect(checkout).toHaveAttribute('target', '_blank')
  expect(checkout).toHaveAttribute('rel', 'noopener noreferrer')
})

it('prevents stale-authorized pending checkout navigation', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  renderScreen(<PaymentsScreen />)
  const checkout = await screen.findByRole('link', {
    name: 'Продовжити оплату',
  })
  currentCabinet.snapshot?.permissions.delete('billing.manage')
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })

  checkout.dispatchEvent(event)

  expect(event.defaultPrevented).toBe(true)
})

it('prevents pending Mono checkout navigation after provider management changes', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  renderScreen(<PaymentsScreen />)
  const checkout = await screen.findByRole('link', {
    name: 'Продовжити оплату',
  })
  const currentSnapshot = currentCabinet.snapshot
  if (!currentSnapshot) throw new Error('Expected ready cabinet snapshot')
  currentSnapshot.subscription = {
    ...cancellableSubscription,
    source: 'apple_iap',
    manageVia: 'apple',
  }

  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  checkout.dispatchEvent(event)

  expect(event.defaultPrevented).toBe(true)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Керування підпискою недоступне.',
  )
})

it('prevents pending Mono payment cancellation after provider management changes', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen(<PaymentsScreen />)
  const cancel = await screen.findByRole('button', { name: 'Скасувати' })
  const currentSnapshot = currentCabinet.snapshot
  if (!currentSnapshot) throw new Error('Expected ready cabinet snapshot')
  currentSnapshot.subscription = {
    ...cancellableSubscription,
    source: 'google_play',
    manageVia: 'google',
  }

  await user.click(cancel)

  expect(billingApi.cancelPayment).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Керування підпискою недоступне.',
  )
})

it('shows a retryable plans error instead of treating a network failure as empty', async () => {
  vi.mocked(billingApi.getPlans)
    .mockRejectedValueOnce(new AxiosError('offline', 'ERR_NETWORK'))
    .mockResolvedValueOnce([litePlan])
  const user = userEvent.setup()
  renderScreen(<PlansScreen />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося завантажити тарифи: немає з’єднання з мережею.',
  )
  expect(screen.queryByText(/Дані недоступні/)).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))

  expect(
    await screen.findByRole('heading', { name: 'Lite' }),
  ).toBeInTheDocument()
  expect(billingApi.getPlans).toHaveBeenCalledTimes(2)
})

it('shows a retryable payments error instead of treating a network failure as empty', async () => {
  vi.mocked(billingApi.getPayments)
    .mockRejectedValueOnce(new AxiosError('offline', 'ERR_NETWORK'))
    .mockResolvedValueOnce(paymentPage([]))
  const user = userEvent.setup()
  renderScreen(<PaymentsScreen />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося завантажити платежі: немає з’єднання з мережею.',
  )
  expect(screen.queryByText('Платежів ще не було.')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))

  expect(await screen.findByText('Платежів ще не було.')).toBeInTheDocument()
  expect(billingApi.getPayments).toHaveBeenCalledTimes(2)
})

it('surfaces a backend checkout denial without leaking an unhandled rejection', async () => {
  vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
  vi.mocked(billingApi.subscribe).mockRejectedValue(
    axiosFailure(403, 'raw backend permission detail'),
  )
  const unhandledRejection = vi.fn()
  window.addEventListener('unhandledrejection', unhandledRejection)

  try {
    const user = userEvent.setup()
    renderScreen(<PlansScreen />)
    await user.click(await screen.findByRole('button', { name: 'Обрати' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'У вас більше немає права змінювати підписку.',
    )
    expect(alert).not.toHaveTextContent('raw backend permission detail')
    await Promise.resolve()
    expect(unhandledRejection).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener('unhandledrejection', unhandledRejection)
  }
})

it('surfaces a conflicting payment cancellation without leaking an unhandled rejection', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
  vi.mocked(billingApi.cancelPayment).mockRejectedValue(
    axiosFailure(409, 'raw provider status detail'),
  )
  const unhandledRejection = vi.fn()
  window.addEventListener('unhandledrejection', unhandledRejection)

  try {
    const user = userEvent.setup()
    renderScreen(<PaymentsScreen />)
    await user.click(await screen.findByRole('button', { name: 'Скасувати' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Статус платежу вже змінився. Оновіть список платежів.',
    )
    expect(alert).not.toHaveTextContent('raw provider status detail')
    await Promise.resolve()
    expect(unhandledRejection).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener('unhandledrejection', unhandledRejection)
  }
})

it('settles a rejected subscription cancellation with truthful feedback', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, cancellableSubscription),
  )
  vi.mocked(billingApi.cancel).mockRejectedValue(
    new AxiosError('offline', 'ERR_NETWORK'),
  )
  const unhandledRejection = vi.fn()
  window.addEventListener('unhandledrejection', unhandledRejection)

  try {
    const user = userEvent.setup()
    renderScreen(<SubscriptionScreen />)
    await user.click(screen.getByRole('button', { name: 'Скасувати підписку' }))
    await user.click(
      screen.getByRole('button', { name: 'Так, скасувати підписку' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не вдалося скасувати підписку: немає з’єднання з мережею.',
    )
    expect(
      screen.getByRole('button', { name: 'Так, скасувати підписку' }),
    ).toBeEnabled()
    await Promise.resolve()
    expect(unhandledRejection).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener('unhandledrejection', unhandledRejection)
  }
})

it('ignores a recognized tenant-scope cancellation while a new plans generation loads', async () => {
  const oldLoad = deferred<PublicPlanDto[]>()
  vi.mocked(billingApi.getPlans)
    .mockReturnValueOnce(oldLoad.promise)
    .mockResolvedValueOnce([litePlan])
  let currentCabinet = cabinet(undefined, subscription, 4)
  vi.mocked(useCabinet).mockImplementation(() => currentCabinet)
  const view = renderScreen(<PlansScreen />)
  await waitFor(() => expect(billingApi.getPlans).toHaveBeenCalledOnce())

  tenantRequestScope.rotate()
  currentCabinet = cabinet(undefined, subscription, 5)
  view.rerender(inShell(<PlansScreen />))
  oldLoad.reject(new CanceledError())

  expect(
    await screen.findByRole('heading', { name: 'Lite' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('surfaces a cancellation that was not caused by tenant-scope rotation', async () => {
  vi.mocked(billingApi.getPlans).mockRejectedValue(new CanceledError())

  renderScreen(<PlansScreen />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося завантажити тарифи. Спробуйте ще раз.',
  )
})

it('does not surface a late mutation failure from a stale cabinet generation', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
  const staleCancellation = deferred<void>()
  vi.mocked(billingApi.cancelPayment).mockReturnValue(staleCancellation.promise)
  let currentCabinet = cabinet(undefined, subscription, 4)
  vi.mocked(useCabinet).mockImplementation(() => currentCabinet)
  const user = userEvent.setup()
  const view = renderScreen(<PaymentsScreen />)
  await user.click(await screen.findByRole('button', { name: 'Скасувати' }))

  tenantRequestScope.rotate()
  currentCabinet = cabinet(undefined, subscription, 5)
  view.rerender(inShell(<PaymentsScreen />))
  staleCancellation.reject(axiosFailure(409, 'stale backend response'))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeEnabled(),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('says which billing controls are unavailable instead of faking them', async () => {
  renderScreen(<PaymentsScreen />)

  await screen.findByText('Платежів ще не було.')
  for (const label of [
    'Додати спосіб оплати',
    'Експорт CSV',
    'Змінити реквізити',
  ])
    expect(screen.getByRole('button', { name: label })).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Додати спосіб оплати' }).title,
  ).toContain('Підписка тримає одну картку')
})

it('keeps the card-change control on the subscription overview disabled', async () => {
  renderScreen(<SubscriptionScreen />)

  await screen.findByText('Платежів ще не було.')
  const card = screen.getByRole('button', { name: 'Змінити карту' })
  expect(card).toBeDisabled()
  expect(card.title).toContain('Замінити картку тут не можна')
})

it.each([
  { source: null, manageVia: null, state: 'blocked', planCode: null },
  { source: 'mono', manageVia: 'web', state: 'trial', planCode: 'trial' },
] as const)(
  'offers selected-plan checkout for initial billing state %j',
  async (initial) => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(undefined, {
        ...subscription,
        ...initial,
        canSubscribe: true,
      }),
    )
    vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
    vi.mocked(billingApi.subscribe).mockRejectedValue(new Error('offline'))
    renderScreen(<PlansScreen />)
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Обрати' }))
    await waitFor(() =>
      expect(billingApi.subscribe).toHaveBeenCalledWith(
        { planCode: 'lite_monthly' },
        { signal: tenantRequestScope.signal },
      ),
    )
    expect(await screen.findByRole('alert')).toBeVisible()
  },
)

it('offers checkout without billing history from the subscription overview', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, {
      ...subscription,
      source: null,
      manageVia: null,
      state: 'blocked',
      planCode: null,
    }),
  )
  vi.mocked(billingApi.subscribe).mockRejectedValue(new Error('offline'))
  renderScreen(<SubscriptionScreen />)
  await screen.findByText('Платежів ще не було.')
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Оформити підписку' }))
  await waitFor(() => expect(billingApi.subscribe).toHaveBeenCalled())
})

it.each(['apple_iap', 'google_play'] as const)(
  'blocks checkout for cancelled unexpired %s access',
  async (source) => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(undefined, {
        ...subscription,
        source,
        manageVia: source === 'apple_iap' ? 'apple' : 'google',
        state: 'cancelled',
        currentPeriodEnd: '2099-01-01T00:00:00Z',
        canSubscribe: true,
      }),
    )
    vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
    renderScreen(<PlansScreen />)
    await screen.findByRole('heading', { name: 'Lite' })
    expect(screen.queryByRole('button', { name: 'Обрати' })).toBeNull()
    expect(billingApi.subscribe).not.toHaveBeenCalled()
  },
)

it.each([
  ['mono', null, false],
  ['apple_iap', null, false],
  ['google_play', null, false],
  ['apple_iap', 'apple', true],
  ['google_play', 'google', true],
] as const)(
  'offers checkout after confirmed expired access (%s, %s)',
  async (source, manageVia, canSubscribe) => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(undefined, {
        ...subscription,
        source,
        manageVia,
        state: 'blocked',
        planCode: 'lite_monthly',
        currentPeriodEnd: '2020-01-01T00:00:00Z',
        canSubscribe,
        canReactivate: true,
      }),
    )
    vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
    renderScreen(<PlansScreen />)
    expect(await screen.findByRole('button', { name: 'Обрати' })).toBeEnabled()
  },
)

it.each([
  {
    source: null,
    manageVia: null,
    state: 'blocked',
    canSubscribe: false,
    canReactivate: true,
    currentPeriodEnd: null,
  },
  {
    source: 'apple_iap',
    manageVia: 'apple',
    state: 'blocked',
    canSubscribe: false,
    canReactivate: true,
    currentPeriodEnd: '2020-01-01T00:00:00Z',
  },
  {
    source: 'google_play',
    manageVia: null,
    state: 'blocked',
    canSubscribe: false,
    canReactivate: true,
    currentPeriodEnd: '2099-01-01T00:00:00Z',
  },
  {
    source: 'apple_iap',
    manageVia: null,
    state: 'blocked',
    canSubscribe: false,
    canReactivate: true,
    currentPeriodEnd: null,
  },
] as const)(
  'fails closed for ambiguous or ineligible checkout %j',
  async (billingState) => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(undefined, {
        ...subscription,
        ...billingState,
        planCode: null,
      }),
    )
    vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
    renderScreen(<PlansScreen />)
    await screen.findByRole('heading', { name: 'Lite' })
    expect(screen.queryByRole('button', { name: 'Обрати' })).toBeNull()
  },
)

it.each([
  { source: null, manageVia: null, currentPeriodEnd: null },
  {
    source: 'apple_iap',
    manageVia: null,
    currentPeriodEnd: '2020-01-01T00:00:00Z',
  },
] as const)(
  'resumes and cancels an abandoned new checkout before Mono activation %j',
  async (provider) => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(undefined, {
        ...subscription,
        ...provider,
        state: 'blocked',
        planCode: null,
        canSubscribe: true,
        canReactivate: true,
      }),
    )
    vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
    vi.mocked(billingApi.cancelPayment).mockResolvedValue()
    renderScreen(<PaymentsScreen />)
    expect(
      await screen.findByRole('link', { name: 'Продовжити оплату' }),
    ).toHaveAttribute('href', pendingPayment.checkoutUrl)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Скасувати' }))
    await waitFor(() =>
      expect(billingApi.cancelPayment).toHaveBeenCalledWith('payment-1', {
        signal: tenantRequestScope.signal,
      }),
    )
  },
)

it('does not resume an expired checkout but still allows cancelling it', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(
    paymentPage([
      { ...pendingPayment, checkoutExpiresAt: '2020-01-01T00:00:00Z' },
    ]),
  )
  renderScreen(<PaymentsScreen />)
  await screen.findByRole('button', { name: 'Скасувати' })
  expect(screen.queryByRole('link', { name: 'Продовжити оплату' })).toBeNull()
})

it('rechecks checkout expiry when following an already rendered payment link', async () => {
  vi.mocked(billingApi.getPayments).mockResolvedValue(paymentPage())
  renderScreen(<PaymentsScreen />)
  const checkout = await screen.findByRole('link', {
    name: 'Продовжити оплату',
  })
  const now = vi
    .spyOn(Date, 'now')
    .mockReturnValue(Date.parse('2100-01-01T00:00:00Z'))
  try {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    checkout.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Строк оплати рахунку минув',
    )
  } finally {
    now.mockRestore()
  }
})

it('does not offer duplicate default checkout for a blocked but still active Mono subscription', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, {
      ...cancellableSubscription,
      state: 'blocked',
      canReactivate: true,
    }),
  )
  renderScreen(<SubscriptionScreen />)
  await screen.findByText('Платежів ще не було.')
  expect(screen.queryByRole('button', { name: 'Оформити підписку' })).toBeNull()
})

it('keeps the active Mono plan current even when access is blocked', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, {
      ...cancellableSubscription,
      state: 'blocked',
      planCode: litePlan.code,
      canReactivate: true,
    }),
  )
  vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
  renderScreen(<PlansScreen />)
  await screen.findByRole('heading', { name: 'Lite' })
  expect(screen.queryByRole('button', { name: 'Обрати' })).toBeNull()
})

it.each(['apple_iap', 'google_play'] as const)(
  'allows web checkout after a confirmed expired %s trial',
  async (source) => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(undefined, {
        ...subscription,
        source,
        manageVia: source === 'apple_iap' ? 'apple' : 'google',
        state: 'blocked',
        planCode: 'trial',
        currentPeriodEnd: null,
        trialEndsAt: '2020-01-01T00:00:00Z',
        canSubscribe: true,
        canReactivate: true,
      }),
    )
    vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
    renderScreen(<PlansScreen />)
    expect(await screen.findByRole('button', { name: 'Обрати' })).toBeEnabled()
  },
)

it('does not substitute trial dates for an unknown paid-store period end', async () => {
  vi.mocked(useCabinet).mockReturnValue(
    cabinet(undefined, {
      ...subscription,
      source: 'apple_iap',
      manageVia: 'apple',
      state: 'blocked',
      planCode: 'pro_monthly',
      currentPeriodEnd: null,
      trialEndsAt: '2020-01-01T00:00:00Z',
      canSubscribe: true,
      canReactivate: true,
    }),
  )
  vi.mocked(billingApi.getPlans).mockResolvedValue([litePlan])
  renderScreen(<PlansScreen />)
  await screen.findByRole('heading', { name: 'Lite' })
  expect(screen.queryByRole('button', { name: 'Обрати' })).toBeNull()
})
