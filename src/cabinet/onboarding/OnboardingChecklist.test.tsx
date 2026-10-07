import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onboardingApi, type OwnerOnboarding } from '@/api/onboarding'
import type { Tenant } from '@/api/types'
import { ToastProvider } from '@/components/app'
import { LocaleProvider } from '@/i18n'
import type { TenantAccessSnapshot } from '../access-types'
import { OnboardingChecklist } from './OnboardingChecklist'
import { forgetReturnFocus } from './return-focus'
import { resetOnboardingCache } from './use-owner-onboarding'

/* eslint-disable @typescript-eslint/unbound-method -- Vitest resolves the API methods into typed mocks. */

vi.mock('@/api/onboarding', () => ({
  onboardingApi: { get: vi.fn(), setDeferred: vi.fn() },
}))

const get = vi.mocked(onboardingApi.get)
const setDeferred = vi.mocked(onboardingApi.setDeferred)

const tenant: Tenant = {
  id: 'tenant-1',
  name: 'АвтоСклад',
  slug: 'avtosklad',
  plan: 'trial',
  planTier: 'pro',
  city: 'Львів',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-10-07T10:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: true,
}

const ownerSnapshot: TenantAccessSnapshot = {
  userId: 'user-1',
  tenantId: tenant.id,
  generation: 1,
  role: 'owner',
  permissions: new Set([
    'team.view',
    'team.manage',
    'cars.manage',
    'intakes.manage',
    'parts.manage',
    'finance.view',
  ]),
  features: new Set(['intake_management', 'team_collaboration']),
  entitlement: {
    state: 'trial',
    usage: {
      cars: { used: 0, max: 100 },
      intakes: { used: 0, max: 100 },
      parts: { used: 0, max: 10_000 },
      users: { used: 1, max: 10 },
      cashRegisters: { used: 0, max: 10 },
    },
  },
  subscription: null,
}

const fresh: OwnerOnboarding = {
  eligible: true,
  deferred: false,
  completed: false,
  settingsCompleted: false,
  currencySelected: false,
  sourceCreated: false,
  firstPartCreated: false,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function LocationProbe() {
  const location = useLocation()
  return (
    <output aria-label="Поточний маршрут">
      {location.pathname + location.search + location.hash}
    </output>
  )
}

function renderChecklist({
  snapshot = ownerSnapshot,
  path = '/app/avtosklad/dashboard',
  locale,
}: {
  snapshot?: TenantAccessSnapshot
  path?: string
  locale?: 'uk' | 'en-GB' | 'pl'
} = {}) {
  const dashboard = (
    <>
      <OnboardingChecklist snapshot={snapshot} tenant={tenant} />
      <LocationProbe />
    </>
  )
  const router = createMemoryRouter(
    [
      { path: '/app/:tenant/dashboard', element: dashboard },
      { path: '*', element: <LocationProbe /> },
    ],
    { initialEntries: [path] },
  )
  const tree = (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
  render(
    locale === undefined ? (
      tree
    ) : (
      <LocaleProvider locale={locale}>{tree}</LocaleProvider>
    ),
  )
  return router
}

const route = () => screen.getByLabelText('Поточний маршрут')

/** The checklist once read: the skeleton shares its name but has no progress. */
async function findLoaded(name: string) {
  await screen.findByRole('progressbar')
  return screen.getByRole('region', { name })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetOnboardingCache()
  forgetReturnFocus()
  localStorage.clear()
})

describe('visibility', () => {
  it('shows nothing to an invited worker and never asks Core (AC-1)', () => {
    renderChecklist({ snapshot: { ...ownerSnapshot, role: 'manager' } })
    expect(screen.queryByRole('region')).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('shows nothing for a yard created before launch (AC-9)', async () => {
    get.mockResolvedValue({ ...fresh, eligible: false })
    renderChecklist()
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('tenant-1', expect.anything()),
    )
    await waitFor(() =>
      expect(screen.queryByText('Завантажуємо прогрес…')).toBeNull(),
    )
    expect(screen.queryByRole('heading', { name: 'Перші кроки' })).toBeNull()
  })

  it('shows nothing when Core answers that onboarding is not for this user', async () => {
    get.mockRejectedValue({ kind: 'forbidden', message: 'Немає доступу' })
    renderChecklist()
    await waitFor(() =>
      expect(screen.queryByLabelText('Перші кроки')).toBeNull(),
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('the expanded list', () => {
  it('renders four ordered steps, server progress and the next step (AC-1, AC-2)', async () => {
    get.mockResolvedValue({ ...fresh, settingsCompleted: true })
    renderChecklist()

    const section = await findLoaded('Перші кроки')
    const list = within(section).getByRole('list')
    expect(list.tagName).toBe('OL')
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)

    const progress = within(section).getByRole('progressbar', {
      name: 'Перші кроки',
    })
    expect(progress).toHaveAttribute('aria-valuenow', '1')
    expect(progress).toHaveAttribute('aria-valuemax', '4')
    expect(progress).toHaveAttribute('aria-valuetext', '1 із 4 кроків')

    const next = within(section).getByRole('link', { current: 'step' })
    expect(next).toHaveAccessibleName(/Обрати валюту обліку/)
    expect(next).toHaveAttribute(
      'href',
      '/app/avtosklad/settings/business#accounting-currency',
    )
    expect(
      within(section).getByRole('link', { name: /Налаштувати розбірку/ }),
    ).toHaveTextContent('Виконано')
  })

  it('shows a loading skeleton and no guessed progress while reading', () => {
    get.mockReturnValue(new Promise(() => undefined))
    renderChecklist()
    const loading = screen.getByRole('region', { name: 'Перші кроки' })
    expect(loading).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Завантажуємо прогрес…')).toHaveAttribute(
      'role',
      'status',
    )
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('reports a failed read with a retry instead of progress (EC-4)', async () => {
    get.mockRejectedValueOnce({ kind: 'network', message: 'offline' })
    get.mockResolvedValueOnce(fresh)
    const user = userEvent.setup()
    renderChecklist()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не вдалося завантажити прогрес налаштування',
    )
    expect(screen.queryByRole('progressbar')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(await findLoaded('Перші кроки')).toBeVisible()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('opens the first incomplete step on «Продовжити», not the one after', async () => {
    // A car exists from «Склад», but the currency is still open (SC-4, AC-6).
    get.mockResolvedValue({
      ...fresh,
      settingsCompleted: true,
      sourceCreated: true,
    })
    const user = userEvent.setup()
    renderChecklist()

    await user.click(await screen.findByRole('button', { name: 'Продовжити' }))
    expect(route()).toHaveTextContent(
      '/app/avtosklad/settings/business#accounting-currency',
    )
  })

  it('opens any step directly from its row', async () => {
    get.mockResolvedValue(fresh)
    const user = userEvent.setup()
    renderChecklist()

    await user.click(
      await screen.findByRole('link', { name: /Додати першу запчастину/ }),
    )
    expect(route()).toHaveTextContent('/app/avtosklad/parts/new')
  })

  it('offers a car or a batch for the source step and returns to the dashboard (AC-3)', async () => {
    get.mockResolvedValue({
      ...fresh,
      settingsCompleted: true,
      currencySelected: true,
    })
    const user = userEvent.setup()
    renderChecklist()

    await user.click(await screen.findByRole('button', { name: 'Продовжити' }))
    const chooser = await screen.findByRole('dialog', {
      name: 'Додати джерело запчастин',
    })
    expect(
      within(chooser).getByRole('link', { name: /Автомобіль/ }),
    ).toHaveAttribute(
      'href',
      `/app/avtosklad/cars/new?return_to=${encodeURIComponent('/app/avtosklad/dashboard?onboarding=source')}`,
    )
    await user.click(within(chooser).getByRole('link', { name: /Партія/ }))
    expect(route()).toHaveTextContent('/app/avtosklad/intakes/new?return_to=')
  })

  it('goes straight to the only source the owner may create', async () => {
    get.mockResolvedValue({
      ...fresh,
      settingsCompleted: true,
      currencySelected: true,
    })
    const user = userEvent.setup()
    renderChecklist({
      snapshot: {
        ...ownerSnapshot,
        features: new Set(['team_collaboration']),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Продовжити' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(route()).toHaveTextContent('/app/avtosklad/cars/new?return_to=')
  })

  it('cleans up the return from a source form and credits the step with a status toast', async () => {
    get.mockResolvedValueOnce({
      ...fresh,
      settingsCompleted: true,
      currencySelected: true,
    })
    const first = renderChecklist()
    await findLoaded('Перші кроки')
    first.dispose()
    document.body.innerHTML = ''

    get.mockResolvedValueOnce({
      ...fresh,
      settingsCompleted: true,
      currencySelected: true,
      sourceCreated: true,
    })
    renderChecklist({
      path: '/app/avtosklad/dashboard?onboarding=source&car_id=car-1&draft=1',
    })

    expect(
      await screen.findByText('Крок «Додати джерело запчастин» зараховано'),
    ).toBeVisible()
    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.textContent?.includes('зараховано')),
    ).toBe(true)
    await waitFor(() =>
      expect(route()).toHaveTextContent(/^\/app\/avtosklad\/dashboard$/),
    )
  })

  it('re-reads when the tab regains focus, so saves elsewhere count (AC-4, AC-12)', async () => {
    get.mockResolvedValueOnce(fresh)
    get.mockResolvedValueOnce({ ...fresh, settingsCompleted: true })
    renderChecklist()
    await findLoaded('Перші кроки')

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '1',
      ),
    )
  })

  it('returns focus to the row that opened the step', async () => {
    get.mockResolvedValue(fresh)
    const user = userEvent.setup()
    const router = renderChecklist()

    await user.click(
      await screen.findByRole('link', { name: /Додати першу запчастину/ }),
    )
    await act(() => router.navigate('/app/avtosklad/dashboard'))

    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: /Додати першу запчастину/ }),
      ).toHaveFocus(),
    )
  })
})

describe('deferral', () => {
  it('collapses to the compact block and moves focus to its «Продовжити» (SC-5)', async () => {
    get.mockResolvedValue({ ...fresh, settingsCompleted: true })
    const saving = deferred<OwnerOnboarding>()
    setDeferred.mockReturnValue(saving.promise)
    const user = userEvent.setup()
    renderChecklist()

    await user.click(
      await screen.findByRole('button', { name: 'Зробити пізніше' }),
    )
    const busy = screen.getByRole('button', { name: 'Зберігаємо…' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(setDeferred).toHaveBeenCalledWith('tenant-1', true)

    await act(async () => {
      saving.resolve({ ...fresh, settingsCompleted: true, deferred: true })
      await saving.promise
    })

    const compact = await screen.findByRole('region', {
      name: 'Завершіть налаштування',
    })
    expect(within(compact).queryByRole('list')).toBeNull()
    expect(within(compact).getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '1 із 4 кроків',
    )
    await waitFor(() =>
      expect(
        within(compact).getByRole('button', { name: 'Продовжити' }),
      ).toHaveFocus(),
    )
  })

  it('stays compact on the next visit (AC-7) and continues at the first incomplete step', async () => {
    get.mockResolvedValue({
      ...fresh,
      deferred: true,
      settingsCompleted: true,
      currencySelected: true,
    })
    setDeferred.mockResolvedValue({
      ...fresh,
      settingsCompleted: true,
      currencySelected: true,
    })
    const user = userEvent.setup()
    renderChecklist({
      snapshot: {
        ...ownerSnapshot,
        permissions: new Set(['cars.manage', 'team.view']),
      },
    })

    const compact = await screen.findByRole('region', {
      name: 'Завершіть налаштування',
    })
    expect(screen.queryByRole('region', { name: 'Перші кроки' })).toBeNull()
    await user.click(
      within(compact).getByRole('button', { name: 'Продовжити' }),
    )

    expect(setDeferred).toHaveBeenCalledWith('tenant-1', false)
    expect(route()).toHaveTextContent('/app/avtosklad/cars/new')
  })

  it('keeps the list and offers a retry when deferring fails (AC-5)', async () => {
    get.mockResolvedValue(fresh)
    setDeferred.mockRejectedValue({ kind: 'server', message: 'boom' })
    const user = userEvent.setup()
    renderChecklist()

    await user.click(
      await screen.findByRole('button', { name: 'Зробити пізніше' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не вдалося відкласти налаштування',
    )
    expect(screen.getByRole('region', { name: 'Перші кроки' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Зробити пізніше' }),
    ).toBeEnabled()
  })

  it('re-reads after a lost answer and accepts the deferral the server kept (EC-1)', async () => {
    get.mockResolvedValueOnce(fresh)
    const check = deferred<OwnerOnboarding>()
    get.mockReturnValueOnce(check.promise)
    setDeferred.mockRejectedValue({ kind: 'network', message: 'offline' })
    const user = userEvent.setup()
    renderChecklist()

    await user.click(
      await screen.findByRole('button', { name: 'Зробити пізніше' }),
    )
    expect(
      await screen.findByText('Звʼязок перервався. Перевіряємо, чи збережено…'),
    ).toBeVisible()

    await act(async () => {
      check.resolve({ ...fresh, deferred: true })
      await check.promise
    })
    expect(
      await screen.findByRole('region', { name: 'Завершіть налаштування' }),
    ).toBeVisible()
    expect(setDeferred).toHaveBeenCalledTimes(1)
  })
})

describe('completion', () => {
  it('shows recommended actions and hides for good (AC-8)', async () => {
    get.mockResolvedValue({
      ...fresh,
      completed: true,
      settingsCompleted: true,
      currencySelected: true,
      sourceCreated: true,
      firstPartCreated: true,
    })
    const user = userEvent.setup()
    renderChecklist({
      snapshot: {
        ...ownerSnapshot,
        permissions: new Set([...ownerSnapshot.permissions, 'finance.view']),
      },
    })

    const card = await screen.findByRole('region', {
      name: 'Основне налаштування завершено',
    })
    expect(
      within(card).getByRole('link', { name: 'Налаштувати касу' }),
    ).toHaveAttribute('href', '/app/avtosklad/cash')
    expect(
      within(card).getByRole('link', { name: 'Запросити команду' }),
    ).toHaveAttribute('href', '/app/avtosklad/team')

    await user.click(within(card).getByRole('button', { name: 'Сховати' }))
    expect(
      screen.queryByRole('region', { name: 'Основне налаштування завершено' }),
    ).toBeNull()
    expect(
      localStorage.getItem('rozbirka:onboarding-done-hidden:user-1:tenant-1'),
    ).toBe('1')
  })
})

describe('locales', () => {
  it.each([
    ['en-GB', 'Getting started', '0 of 4 steps', 'Do it later'],
    ['pl', 'Pierwsze kroki', '0 z 4 kroków', 'Zrób to później'],
  ] as const)('renders %s copy', async (locale, title, progress, later) => {
    get.mockResolvedValue(fresh)
    renderChecklist({ locale })

    const section = await findLoaded(title)
    expect(within(section).getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      progress,
    )
    expect(within(section).getByRole('button', { name: later })).toBeVisible()
  })
})
