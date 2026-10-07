import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { tenantsApi } from '@/api/tenants'
import { tenantPreference } from '@/api/tenant-preference'
import { useAuth, type AuthContextValue } from '@/auth/AuthContext'
import { LocaleProvider } from '@/i18n'
import { TenantOnboardingScreen } from './tenant-onboarding'

/* eslint-disable @typescript-eslint/unbound-method -- Vitest resolves the API method into a typed mock. */

vi.mock('@/api/tenants', () => ({ tenantsApi: { create: vi.fn() } }))
vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))

const create = vi.mocked(tenantsApi.create)
const hydrate = vi.fn<() => Promise<void>>()
const signOut = vi.fn<() => Promise<void>>()
let auth: AuthContextValue

const hydratedTenant = {
  id: 'tenant-new',
  name: 'New Yard',
  slug: 'new-yard',
  plan: 'trial' as const,
  planTier: 'pro',
  city: 'Львів',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-15T00:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: true,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function LocationProbe() {
  const location = useLocation()
  return (
    <output aria-label="Поточний маршрут">
      {location.pathname + location.search}
    </output>
  )
}

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<TenantOnboardingScreen />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  tenantPreference.clear()
  hydrate.mockImplementation(() => {
    auth.tenant = hydratedTenant
    auth.tenants = [hydratedTenant]
    return Promise.resolve()
  })
  signOut.mockResolvedValue()
  auth = {
    status: 'authenticated',
    user: {
      id: 'user-1',
      phone: '+380501112233',
      displayName: 'Власник',
      effectiveLanguage: 'uk',
    },
    tenant: null,
    tenants: [],
    hydrate,
    commitTenant: vi.fn(),
    updateName: vi.fn(),
    signOut,
  }
  vi.mocked(useAuth).mockImplementation(() => auth)
})

it('creates the first tenant, hydrates, and hands over to the dashboard checklist', async () => {
  create.mockResolvedValue({
    tenantId: 'tenant-new',
    name: 'New Yard',
    slug: 'stale-create-response-slug',
    plan: 'trial',
    planTier: 'pro',
    isActive: true,
  })
  const user = userEvent.setup()
  renderOnboarding()

  await user.type(screen.getByLabelText('Назва розбірки'), 'New Yard')
  await user.type(screen.getByLabelText(/Місто/), 'Львів')
  await user.click(screen.getByRole('button', { name: 'Створити розбірку' }))

  expect(tenantPreference.get()).toBe('tenant-new')
  expect(hydrate).toHaveBeenCalledOnce()
  // No warehouse/team/done steps: the owner continues on the dashboard, and
  // the slug comes from the hydrated tenant, not the create response.
  expect(await screen.findByLabelText('Поточний маршрут')).toHaveTextContent(
    /^\/app\/new-yard\/dashboard$/,
  )
})

it('asks only for what creating the yard stores', () => {
  renderOnboarding()

  expect(screen.getByLabelText('Назва розбірки')).toBeVisible()
  expect(screen.getByLabelText(/Місто/)).toBeVisible()
  // Accounting currency is an onboarding step on the dashboard now, chosen
  // explicitly in business settings — never a dead control here.
  expect(screen.queryByText(/валюта обліку/i)).toBeNull()
  expect(screen.queryByText('Чим займаєтесь')).toBeNull()
  expect(screen.queryByText(/Крок 1/)).toBeNull()
})

it('names the missing yard at its own field instead of calling the API', async () => {
  const user = userEvent.setup()
  renderOnboarding()

  await user.click(screen.getByRole('button', { name: 'Створити розбірку' }))

  const nameInput = screen.getByLabelText('Назва розбірки')
  expect(nameInput).toHaveAccessibleDescription(
    'Вкажіть назву розбірки — щонайменше 2 символи',
  )
  expect(nameInput).toBeInvalid()
  expect(nameInput).toHaveFocus()
  expect(create).not.toHaveBeenCalled()
})

it('keeps the failure reason on screen and creates the yard on retry', async () => {
  create.mockRejectedValueOnce({
    kind: 'conflict',
    message: 'Розбірка з такою назвою вже існує.',
  })
  create.mockResolvedValueOnce({
    tenantId: 'tenant-new',
    name: 'New Yard',
    slug: 'stale-create-response-slug',
    plan: 'trial',
    planTier: 'pro',
    isActive: true,
  })
  const user = userEvent.setup()
  renderOnboarding()

  await user.type(screen.getByLabelText('Назва розбірки'), 'New Yard')
  await user.click(screen.getByRole('button', { name: 'Створити розбірку' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося створити розбірку. Розбірка з такою назвою вже існує.',
  )
  expect(hydrate).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))

  expect(create).toHaveBeenCalledTimes(2)
  expect(await screen.findByLabelText('Поточний маршрут')).toHaveTextContent(
    '/app/new-yard/dashboard',
  )
})

it('invalidates a pending create before logout can resume it', async () => {
  const pendingCreate =
    deferred<Awaited<ReturnType<typeof tenantsApi.create>>>()
  create.mockReturnValue(pendingCreate.promise)
  const user = userEvent.setup()
  renderOnboarding()

  await user.type(screen.getByLabelText('Назва розбірки'), 'New Yard')
  await user.click(screen.getByRole('button', { name: 'Створити розбірку' }))
  const createSignal = create.mock.calls[0]?.[1]?.signal
  await user.click(screen.getByRole('button', { name: 'Вийти' }))

  expect(screen.getByLabelText('Поточний маршрут')).toHaveTextContent(/^\/$/)
  expect(createSignal?.aborted).toBe(true)
  await act(async () => {
    pendingCreate.resolve({
      tenantId: 'tenant-new',
      name: 'New Yard',
      slug: 'stale-create-response-slug',
      plan: 'trial',
      planTier: 'pro',
      isActive: true,
    })
    await pendingCreate.promise
    await Promise.resolve()
  })

  expect(tenantPreference.get()).toBeNull()
  expect(hydrate).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Поточний маршрут')).toHaveTextContent(/^\/$/)
})

it('leaves the protected route before waiting for logout', async () => {
  let finishLogout!: () => void
  signOut.mockReturnValue(
    new Promise<void>((resolve) => {
      finishLogout = resolve
    }),
  )
  const user = userEvent.setup()
  renderOnboarding()

  await user.click(screen.getByRole('button', { name: 'Вийти' }))

  expect(screen.getByLabelText('Поточний маршрут')).toHaveTextContent(/^\/$/)
  finishLogout()
})

it('asks for the business in Polish and says why the name is refused', async () => {
  const user = userEvent.setup()
  render(
    <LocaleProvider locale="pl" syncDocumentLang={false}>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route path="/account" element={<TenantOnboardingScreen />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  )

  expect(
    screen.getByRole('heading', { name: 'Opowiedz nam o swojej firmie' }),
  ).toBeVisible()
  expect(screen.getByText('14 dni za darmo, bez karty')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Utwórz firmę' }))
  expect(
    screen.getByText('Podaj nazwę firmy — co najmniej 2 znaki'),
  ).toBeVisible()
  expect(create).not.toHaveBeenCalled()
  expect(screen.queryByText(/[А-Яа-яЇїІіЄєҐґ]/)).toBeNull()
})
