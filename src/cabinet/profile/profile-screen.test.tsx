/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { StrictMode } from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Tenant } from '@/api/types'
import { profileApi } from '@/api/profile'
import { credentials } from '@/api/credentials'
import { tenantPreference } from '@/api/tenant-preference'
import { useAuth, type AuthContextValue } from '@/auth/AuthContext'
import type { TenantAccessSnapshot } from '../access-types'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { ProfileScreen } from './profile-screen'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
vi.mock('@/api/profile', () => ({ profileApi: { deleteAccount: vi.fn() } }))

const tenant: Tenant = {
  id: 'tenant-1',
  name: 'QA Switch Test',
  slug: 'qa-switch-test',
  plan: 'active',
  planTier: 'pro',
  city: 'Львів',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'manager',
}

const snapshot: TenantAccessSnapshot = {
  userId: 'user-1',
  tenantId: tenant.id,
  generation: 1,
  role: 'Manager',
  permissions: new Set(),
  features: new Set(),
  entitlement: null,
  subscription: null,
}

const updateName = vi.fn<(name: string) => Promise<void>>()
const signOut = vi.fn<(opts?: { silent?: boolean }) => Promise<void>>()

afterEach(() => {
  vi.useRealTimers()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function unlockDeletionConfirmation() {
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: 'Видалити акаунт' }))
  fireEvent.change(
    screen.getByLabelText('Для підтвердження введіть ВИДАЛИТИ'),
    { target: { value: 'ВИДАЛИТИ' } },
  )
  act(() => {
    vi.advanceTimersByTime(5_000)
  })
  const confirm = screen.getByRole('button', {
    name: 'Так, видалити акаунт',
  })
  vi.useRealTimers()
  return confirm
}

beforeEach(() => {
  updateName.mockReset()
  updateName.mockResolvedValue(undefined)
  signOut.mockReset()
  signOut.mockResolvedValue(undefined)
  vi.mocked(profileApi.deleteAccount).mockReset()
  vi.mocked(profileApi.deleteAccount).mockResolvedValue(undefined)
  credentials.clear()
  tenantPreference.clear()
  vi.mocked(useAuth).mockReturnValue({
    status: 'authenticated',
    user: {
      id: 'user-1',
      phone: '+380733182301',
      displayName: 'Олена',
      role: 'manager',
      isActive: true,
      lastLoginAt: null,
    },
    tenant,
    tenants: [tenant],
    hydrate: vi.fn(),
    commitTenant: vi.fn(),
    updateName,
    signOut,
  } satisfies AuthContextValue)
  vi.mocked(useCabinet).mockReturnValue({
    status: 'ready',
    targetTenant: tenant,
    snapshot,
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  } satisfies CabinetContextValue)
})

it('renders the approved authenticated profile fields', () => {
  const view = render(<ProfileScreen />, { wrapper: MemoryRouter })

  expect(screen.getByRole('heading', { name: 'Профіль' })).toBeVisible()
  expect(screen.getByLabelText('Ім’я та прізвище')).toHaveValue('Олена')
  expect(screen.getByText('+380733182301')).toBeVisible()
  expect(screen.getByText('Менеджер')).toBeVisible()
  expect(screen.getByText('QA Switch Test')).toBeVisible()
  expect(view.container.querySelector('.text-neutral-500')).toBeNull()
})

it('disables saving an unchanged or invalid display name', async () => {
  const user = userEvent.setup()
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  const input = screen.getByLabelText('Ім’я та прізвище')
  const save = screen.getByRole('button', { name: 'Зберегти' })
  expect(save).toBeDisabled()

  await user.clear(input)
  await user.type(input, ' А ')
  expect(save).toBeDisabled()
  expect(updateName).not.toHaveBeenCalled()
})

it('trims and saves the name once while the request is pending', async () => {
  const pending = deferred<void>()
  updateName.mockReturnValue(pending.promise)
  const user = userEvent.setup()
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  const input = screen.getByLabelText('Ім’я та прізвище')
  await user.clear(input)
  await user.type(input, '  Нова назва  ')
  const save = screen.getByRole('button', { name: 'Зберегти' })
  await user.click(save)

  expect(updateName).toHaveBeenCalledOnce()
  expect(updateName).toHaveBeenCalledWith('Нова назва')
  expect(save).toBeDisabled()
  expect(save).toHaveTextContent('Зберігаємо…')
  await user.click(save)
  expect(updateName).toHaveBeenCalledOnce()

  await act(() => {
    pending.resolve()
    return pending.promise
  })
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Ім’я успішно оновлено.',
  )
})

it('keeps the typed value and shows a retryable error when saving fails', async () => {
  updateName.mockRejectedValue(new Error('identity offline'))
  const user = userEvent.setup()
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  const input = screen.getByLabelText('Ім’я та прізвище')
  await user.clear(input)
  await user.type(input, 'Нове ім’я')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося зберегти ім’я. Спробуйте ще раз.',
  )
  expect(input).toHaveValue('Нове ім’я')
  expect(screen.getByRole('button', { name: 'Зберегти' })).toBeEnabled()
})

it('does not publish local completion state after unmount', async () => {
  const pending = deferred<void>()
  updateName.mockReturnValue(pending.promise)
  const user = userEvent.setup()
  const view = render(<ProfileScreen />, { wrapper: MemoryRouter })

  const input = screen.getByLabelText('Ім’я та прізвище')
  await user.clear(input)
  await user.type(input, 'Інше ім’я')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  view.unmount()

  await act(() => {
    pending.resolve()
    return pending.promise
  })
  expect(updateName).toHaveBeenCalledOnce()
})

it('publishes save completion after the StrictMode effect replay', async () => {
  const pending = deferred<void>()
  updateName.mockReturnValue(pending.promise)
  const user = userEvent.setup()
  render(
    <StrictMode>
      <ProfileScreen />
    </StrictMode>,
    { wrapper: MemoryRouter },
  )

  const input = screen.getByLabelText('Ім’я та прізвище')
  await user.clear(input)
  await user.type(input, 'Ім’я в StrictMode')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  await act(() => {
    pending.resolve()
    return pending.promise
  })

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Ім’я успішно оновлено.',
  )
})

it('requires a second destructive confirmation before deleting the account', async () => {
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  fireEvent.click(screen.getByRole('button', { name: 'Видалити акаунт' }))
  expect(
    screen.getByRole('group', {
      name: 'Підтвердіть видалення акаунта. Ця дія незворотна.',
    }),
  ).toBeVisible()
  expect(profileApi.deleteAccount).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  fireEvent.click(unlockDeletionConfirmation())

  expect(profileApi.deleteAccount).toHaveBeenCalledOnce()
  await waitFor(() => expect(signOut).toHaveBeenCalledWith({ silent: true }))
})

it('requires the exact deletion phrase and a five second delay', () => {
  vi.useFakeTimers()
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  fireEvent.click(screen.getByRole('button', { name: 'Видалити акаунт' }))
  const phrase = screen.getByLabelText('Для підтвердження введіть ВИДАЛИТИ')
  const confirm = screen.getByRole('button', {
    name: 'Так, видалити акаунт',
  })

  fireEvent.change(phrase, { target: { value: 'видалити' } })
  expect(confirm).toBeDisabled()
  act(() => {
    vi.advanceTimersByTime(5_000)
  })
  expect(confirm).toBeDisabled()
  expect(profileApi.deleteAccount).not.toHaveBeenCalled()

  fireEvent.change(phrase, { target: { value: 'ВИДАЛИТИ' } })
  expect(confirm).toBeEnabled()
  expect(profileApi.deleteAccount).not.toHaveBeenCalled()
})

it('preserves the local session when account deletion fails', async () => {
  vi.mocked(profileApi.deleteAccount).mockRejectedValue(new Error('offline'))
  credentials.setAccess('private-access')
  tenantPreference.set(tenant.id)
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  fireEvent.click(unlockDeletionConfirmation())

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося видалити акаунт. Спробуйте ще раз.',
  )
  expect(signOut).not.toHaveBeenCalled()
  expect(credentials.getAccess()).toBe('private-access')
  expect(tenantPreference.get()).toBe(tenant.id)
})

it('clears local private state after deletion even when sign-out rejects', async () => {
  signOut.mockRejectedValue(new Error('session unavailable'))
  credentials.setAccess('private-access')
  tenantPreference.set(tenant.id)
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  fireEvent.click(unlockDeletionConfirmation())

  await waitFor(() => {
    expect(credentials.getAccess()).toBeNull()
    expect(tenantPreference.get()).toBeNull()
  })
  expect(screen.queryByRole('alert')).toBeNull()
})

it('preserves private state after unmount until deletion is confirmed', async () => {
  const pending = deferred<void>()
  vi.mocked(profileApi.deleteAccount).mockReturnValue(pending.promise)
  credentials.setAccess('private-access')
  tenantPreference.set(tenant.id)
  const view = render(<ProfileScreen />, { wrapper: MemoryRouter })

  fireEvent.click(unlockDeletionConfirmation())
  view.unmount()

  expect(credentials.getAccess()).toBe('private-access')
  expect(tenantPreference.get()).toBe(tenant.id)
  expect(signOut).not.toHaveBeenCalled()
  await act(() => {
    pending.reject(new DOMException('Aborted', 'AbortError'))
    return pending.promise.catch(() => undefined)
  })
})

it('does not offer cancellation after account deletion has been dispatched', async () => {
  const pending = deferred<void>()
  vi.mocked(profileApi.deleteAccount).mockReturnValue(pending.promise)
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  fireEvent.click(unlockDeletionConfirmation())

  expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent(
    'Видалення акаунта… Дочекайтеся підтвердження.',
  )
  await act(() => {
    pending.reject(new Error('offline'))
    return pending.promise.catch(() => undefined)
  })
})

it('does not clear private state when the profile merely unmounts', () => {
  credentials.setAccess('private-access')
  tenantPreference.set(tenant.id)
  const view = render(<ProfileScreen />, { wrapper: MemoryRouter })

  view.unmount()

  expect(credentials.getAccess()).toBe('private-access')
  expect(tenantPreference.get()).toBe(tenant.id)
  expect(signOut).not.toHaveBeenCalled()
})

it('resets for an in-place auth transition and ignores the prior update completion', async () => {
  const pending = deferred<void>()
  updateName.mockReturnValue(pending.promise)
  const user = userEvent.setup()
  const view = render(<ProfileScreen />, { wrapper: MemoryRouter })

  await user.clear(screen.getByLabelText('Ім’я та прізвище'))
  await user.type(screen.getByLabelText('Ім’я та прізвище'), 'Старе імʼя')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))

  vi.mocked(useAuth).mockReturnValue({
    status: 'authenticated',
    user: {
      id: 'user-2',
      phone: '+380501112233',
      displayName: 'Нове імʼя',
      role: 'owner',
      isActive: true,
      lastLoginAt: null,
    },
    tenant,
    tenants: [tenant],
    hydrate: vi.fn(),
    commitTenant: vi.fn(),
    updateName,
    signOut,
  } satisfies AuthContextValue)
  view.rerender(<ProfileScreen />)

  expect(screen.getByLabelText('Ім’я та прізвище')).toHaveValue('Нове імʼя')
  await act(() => {
    pending.resolve()
    return pending.promise
  })
  expect(screen.queryByRole('status')).toBeNull()
})

it('shows a compact profile with only supported account controls', () => {
  render(<ProfileScreen />, { wrapper: MemoryRouter })

  const personal = screen.getByRole('region', { name: 'Особисті дані' })
  expect(
    within(personal).getByRole('button', { name: 'Зберегти' }),
  ).toBeVisible()
  expect(
    within(personal).getByRole('button', { name: 'Скасувати зміни' }),
  ).toBeVisible()
  expect(screen.getByLabelText('Телефон')).toBeDisabled()
  const access = screen.getByRole('region', { name: 'Доступ' })
  expect(access).toBeVisible()
  expect(
    within(access.parentElement!).getByRole('button', {
      name: 'Видалити акаунт',
    }),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Вийти з системи' })).toBeVisible()
  for (const text of [
    'Завантажити фото',
    'Прибрати',
    'Вхід у систему',
    'У системі з',
    'Останній вхід',
    'Активні сеанси',
    'Особистий акаунт',
    'Відкрити',
  ])
    expect(screen.queryByText(text)).not.toBeInTheDocument()
})

it('does not clear a newer session after old-account deletion completes', async () => {
  const pending = deferred<void>()
  vi.mocked(profileApi.deleteAccount).mockReturnValue(pending.promise)
  credentials.startSession('A')
  render(<ProfileScreen />, { wrapper: MemoryRouter })
  fireEvent.click(unlockDeletionConfirmation())
  credentials.startSession('B')
  await act(async () => {
    pending.resolve()
    await pending.promise
  })
  expect(credentials.getAccess()).toBe('B')
  expect(signOut).not.toHaveBeenCalled()
})
