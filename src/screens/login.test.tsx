import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { credentials } from '@/api/credentials'
import { useAuth, type AuthContextValue } from '@/auth/AuthContext'
import { LoginScreen } from './login'
import type { SendOtpResponse } from '@/api/types'

const challengeData = (seconds = 0) => ({
  challengeId: 'test-challenge',
  expiresAt: '2099-01-01T00:00:00.000Z',
  resendAt: new Date(Date.now() + seconds * 1000).toISOString(),
})

vi.mock('@/api/auth', () => ({
  authApi: {
    otpSend: vi.fn(),
    otpVerify: vi.fn(),
    registrationSend: vi.fn(),
    registrationVerify: vi.fn(),
    cancelRegistration: vi.fn().mockResolvedValue(undefined),
    updateName: vi.fn(),
  },
}))

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))

/* eslint-disable @typescript-eslint/unbound-method */
const otpSend = vi.mocked(authApi.otpSend)
const otpVerify = vi.mocked(authApi.otpVerify)
const updateName = vi.mocked(authApi.updateName)
const registrationSend = vi.mocked(authApi.registrationSend)
const registrationVerify = vi.mocked(authApi.registrationVerify)
const cancelRegistration = vi.mocked(authApi.cancelRegistration)
/* eslint-enable @typescript-eslint/unbound-method */

const existingUser = {
  id: 'user-1',
  phone: '+380501112233',
  displayName: 'Власник',
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
    <span data-testid="location">{location.pathname + location.search}</span>
  )
}

function LoginUnmountHarness() {
  const [mounted, setMounted] = useState(true)
  return (
    <>
      {mounted && <LoginScreen />}
      <button type="button" onClick={() => setMounted(false)}>
        Unmount login
      </button>
      <LocationProbe />
    </>
  )
}

function renderLogin(
  initialEntry:
    | string
    | {
        pathname: string
        search?: string
        state?: { from?: string }
      } = '/login',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function reachOtpStep(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText('Номер телефону'))
  await user.type(screen.getByLabelText('Номер телефону'), '501112233')
  await user.click(screen.getByRole('button', { name: 'Отримати код' }))
  await screen.findByLabelText('Цифра 1')
}

async function enterOtp(user: ReturnType<typeof userEvent.setup>) {
  const inputs = screen.getAllByLabelText(/Цифра \d/)
  for (const [index, input] of inputs.entries()) {
    await user.type(input, String(index + 1))
  }
}

let auth: AuthContextValue

beforeEach(() => {
  credentials.clear()
  sessionStorage.clear()
  auth = {
    status: 'guest',
    user: null,
    tenant: null,
    tenants: [],
    hydrate: vi.fn().mockResolvedValue(undefined),
    commitTenant: vi.fn(),
    updateName: vi.fn(),
    signOut: vi.fn(),
  }
  vi.mocked(useAuth).mockReturnValue(auth)
  otpSend.mockResolvedValue({
    ...challengeData(60),
    retryAfterSeconds: 60,
    cooldownSeconds: 60,
  })
  otpVerify.mockResolvedValue({
    accessToken: 'access',
    user: existingUser,
    isNewUser: false,
  })
  updateName.mockResolvedValue(existingUser)
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
  credentials.clear()
  sessionStorage.clear()
})

it('restores an active OTP challenge after the login page reloads', async () => {
  const user = userEvent.setup()
  const firstRender = renderLogin()

  await reachOtpStep(user)
  firstRender.unmount()

  renderLogin()

  expect(await screen.findByLabelText('Цифра 1')).toBeInTheDocument()
  expect(screen.getByText('+380 50 111 22 33')).toBeInTheDocument()
  expect(otpSend).toHaveBeenCalledTimes(1)
})

it('disables OTP resend during backend cooldown and applies retryAfterSeconds', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  otpSend.mockRejectedValueOnce({
    kind: 'conflict',
    code: 'OTP_COOLDOWN',
    message: 'backend cooldown',
    retryAfterSeconds: 75,
  })
  const user = userEvent.setup()
  renderLogin()

  await reachOtpStep(user)
  await user.click(screen.getByRole('button', { name: 'Надіслати код ще раз' }))

  expect(
    screen.getByRole('button', { name: /Надіслати код ще раз/ }),
  ).toBeDisabled()
  expect(screen.getByText(/75\sс/)).toBeInTheDocument()
})

it('does not start overlapping resend requests', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  const resend = deferred<{
    cooldownSeconds: number
    retryAfterSeconds: number
    challengeId: string
    expiresAt: string
    resendAt: string
  }>()
  otpSend.mockImplementationOnce(() => resend.promise)
  const user = userEvent.setup()
  renderLogin()
  await reachOtpStep(user)

  const resendButton = screen.getByRole('button', {
    name: 'Надіслати код ще раз',
  })
  await user.click(resendButton)
  await user.click(resendButton)

  expect(otpSend).toHaveBeenCalledTimes(2)
  expect(resendButton).toBeDisabled()

  resend.resolve({
    ...challengeData(60),
    cooldownSeconds: 60,
    retryAfterSeconds: 60,
  })
  await waitFor(() => expect(resendButton).toBeDisabled())
})

it('shows the mapped expired-code message', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  otpVerify.mockRejectedValue({
    kind: 'validation',
    code: 'OTP_EXPIRED',
    message: 'backend wording that must not be shown',
  })
  const user = userEvent.setup()
  renderLogin()
  await reachOtpStep(user)
  await enterOtp(user)

  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Код вже не дійсний — запитайте новий',
  )
})

it('shows the mapped backend rate-limit message', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  otpVerify.mockRejectedValue({
    kind: 'unknown',
    code: 'OTP_RATE_LIMITED',
    message: 'upstream wording that must not be shown',
  })
  const user = userEvent.setup()
  renderLogin()
  await reachOtpStep(user)
  await enterOtp(user)

  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Забагато спроб. Спробуйте пізніше',
  )
})

it('shows a network fallback without leaking transport details', async () => {
  otpSend.mockRejectedValue(
    Object.assign(new Error('socket hang up at 10.0.0.7:443'), {
      code: 'ERR_NETWORK',
      isAxiosError: true,
      toJSON: () => ({}),
    }),
  )
  const user = userEvent.setup()
  renderLogin()

  await user.clear(screen.getByLabelText('Номер телефону'))
  await user.type(screen.getByLabelText('Номер телефону'), '501112233')
  await user.click(screen.getByRole('button', { name: 'Отримати код' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Немає з’єднання з мережею.')
  expect(alert).not.toHaveTextContent('10.0.0.7')
})

it('hydrates before navigating after verify', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  const hydration = deferred<void>()
  vi.mocked(auth.hydrate).mockReturnValue(hydration.promise)
  const user = userEvent.setup()
  renderLogin({ pathname: '/login', state: { from: '/account?section=team' } })
  await reachOtpStep(user)
  await enterOtp(user)

  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))

  expect(auth.hydrate).toHaveBeenCalledWith('access')
  expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  expect(screen.queryByText('Ви увійшли')).not.toBeInTheDocument()

  vi.useFakeTimers()
  await act(async () => {
    hydration.resolve()
    await hydration.promise
  })
  expect(screen.getByText('Ви увійшли')).toBeInTheDocument()

  await act(async () => {
    await vi.advanceTimersByTimeAsync(800)
  })
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/account?section=team',
  )
})

it('uses the hydrated selected tenant for a cabinet plan destination', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  vi.mocked(auth.hydrate).mockImplementation(() => {
    const tenant = {
      id: 'tenant-1',
      name: 'Koval Auto',
      slug: 'koval',
      plan: 'active' as const,
      planTier: 'pro',
      city: null,
      logoUrl: null,
      isActive: true,
      createdAt: '2026-08-01T00:00:00Z',
      roleName: 'owner',
    }
    auth.tenant = tenant
    auth.tenants = [tenant]
    return Promise.resolve()
  })
  const user = userEvent.setup()
  renderLogin('/login?plan=pro_monthly')
  await reachOtpStep(user)
  await enterOtp(user)

  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))

  expect(
    await screen.findByRole('link', { name: 'Продовжити' }),
  ).toHaveAttribute(
    'href',
    '/app/koval/settings/billing/plans?plan=pro_monthly',
  )
})

it('asks a new user for a name and stores the rotated access response', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  otpVerify.mockResolvedValue({
    accessToken: 'initial-access',
    user: { ...existingUser, displayName: '' },
    isNewUser: true,
  })
  updateName.mockImplementation(() => {
    credentials.setAccess('rotated-access')
    return Promise.resolve({ ...existingUser, displayName: 'Олена' })
  })
  const user = userEvent.setup()
  renderLogin()
  await reachOtpStep(user)
  await enterOtp(user)
  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))

  const nameInput = await screen.findByLabelText('Ім’я')
  await user.type(nameInput, 'Олена')
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))

  expect(updateName).toHaveBeenCalledWith('Олена', {
    signal: expect.any(AbortSignal) as AbortSignal,
  })
  expect(credentials.getAccess()).toBe('rotated-access')
  expect(auth.hydrate).toHaveBeenCalledOnce()
})

it('rejects an external fallback and navigates to /account', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  const user = userEvent.setup()
  renderLogin({
    pathname: '/login',
    state: { from: 'https://evil.example/steal-session' },
  })
  await reachOtpStep(user)
  await enterOtp(user)
  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))

  expect(
    await screen.findByRole('link', { name: 'Продовжити' }),
  ).toHaveAttribute('href', '/account')
})

it('preserves invitation before scan and plan intents', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  const user = userEvent.setup()
  renderLogin('/login?plan=pro_monthly&scan=QR-123&invite=INVITE_1234')
  await reachOtpStep(user)
  await enterOtp(user)
  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))

  expect(
    await screen.findByRole('link', { name: 'Продовжити' }),
  ).toHaveAttribute('href', '/invite/INVITE_1234')
})

it('starts an authenticated unnamed user at the name step and resumes the invite', async () => {
  auth.status = 'authenticated'
  auth.user = {
    id: 'user-1',
    phone: '+380501112233',
    displayName: ' ',
    role: 'owner',
    isActive: true,
    lastLoginAt: null,
  }
  updateName.mockResolvedValue({ ...existingUser, displayName: 'Олена' })
  const user = userEvent.setup()
  renderLogin('/login?invite=ABCD1234')

  const nameInput = screen.getByLabelText('Ім’я')
  await user.type(nameInput, 'Олена')
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))

  expect(auth.hydrate).toHaveBeenCalledOnce()
  expect(
    await screen.findByRole('link', { name: 'Продовжити' }),
  ).toHaveAttribute('href', '/invite/ABCD1234')
})

it('does not navigate after an unmounted name flow finishes hydrating', async () => {
  auth.status = 'authenticated'
  auth.user = {
    id: 'user-1',
    phone: '+380501112233',
    displayName: ' ',
    role: 'owner',
    isActive: true,
    lastLoginAt: null,
  }
  const hydration = deferred<void>()
  vi.mocked(auth.hydrate).mockReturnValue(hydration.promise)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/login?invite=ABCD1234']}>
      <LoginUnmountHarness />
    </MemoryRouter>,
  )

  await user.type(screen.getByLabelText('Ім’я'), 'Олена')
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))
  expect(auth.hydrate).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('button', { name: 'Unmount login' }))

  vi.useFakeTimers()
  await act(async () => {
    hydration.resolve()
    await hydration.promise
    await Promise.resolve()
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800)
  })

  expect(screen.getByTestId('location')).toHaveTextContent(
    '/login?invite=ABCD1234',
  )
})

it('validates the phone at the field instead of calling the API', async () => {
  const user = userEvent.setup()
  renderLogin()

  const phoneInput = screen.getByLabelText('Номер телефону')
  await user.type(phoneInput, '+380 50 111')
  await user.click(screen.getByRole('button', { name: 'Отримати код' }))

  expect(otpSend).not.toHaveBeenCalled()
  expect(phoneInput).toBeInvalid()
  expect(phoneInput).toHaveAccessibleDescription(
    'Введіть номер повністю. Формат: +380 XX XXX XX XX',
  )
})

it('reports an incomplete code once for the whole group', async () => {
  otpSend.mockResolvedValueOnce({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  const user = userEvent.setup()
  renderLogin()
  await reachOtpStep(user)
  await user.type(screen.getByLabelText('Цифра 1'), '1')

  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))

  expect(otpVerify).not.toHaveBeenCalled()
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Введіть усі 6 цифр коду з SMS',
  )
  expect(screen.getByLabelText('Цифра 1')).toBeInvalid()
})

it('states the resend wait while the control is disabled', async () => {
  const user = userEvent.setup()
  renderLogin()
  await reachOtpStep(user)

  expect(
    screen.getByRole('button', { name: 'Надіслати код ще раз' }),
  ).toBeDisabled()
  expect(
    screen.getByText(/^Надіслати код ще раз можна через \d+\sс$/),
  ).toBeInTheDocument()
})

it('uses explicit protected registration and preserves the invitation after verification', async () => {
  registrationSend.mockResolvedValue({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 300,
  })
  registrationVerify.mockResolvedValue({
    accessToken: 'registered',
    user: existingUser,
    isNewUser: false,
  })
  const user = userEvent.setup()
  renderLogin('/login?invite=valid-invite')
  await user.click(
    screen.getByRole('button', {
      name: 'Немає облікового запису? Зареєструватися',
    }),
  )
  expect(
    screen.getByRole('heading', { name: 'Створіть обліковий запис' }),
  ).toBeInTheDocument()
  await reachOtpStep(user)
  await enterOtp(user)
  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(registrationSend).toHaveBeenCalledWith(
    { phone: '+380501112233' },
    { signal: expect.any(AbortSignal) as AbortSignal },
  )
  expect(registrationVerify).toHaveBeenCalledWith(
    { phone: '+380501112233', code: '123456', challengeId: 'test-challenge' },
    { signal: expect.any(AbortSignal) as AbortSignal },
  )
  expect(otpVerify).not.toHaveBeenCalled()
  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/invite/valid-invite',
    ),
  )
})

it('does not verify a locally expired challenge', async () => {
  otpSend.mockResolvedValue({
    ...challengeData(),
    expiresAt: '2000-01-01T00:00:00Z',
    cooldownSeconds: 0,
    retryAfterSeconds: 0,
  })
  const user = userEvent.setup()
  renderLogin()
  await reachOtpStep(user)
  await enterOtp(user)
  await user.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(
    await screen.findByText('Код вже не дійсний — запитайте новий'),
  ).toBeInTheDocument()
  expect(otpVerify).not.toHaveBeenCalled()
})

it('resets the challenge and clears private registration state when changing phone', async () => {
  registrationSend.mockResolvedValue({
    ...challengeData(),
    cooldownSeconds: 0,
    retryAfterSeconds: 300,
  })
  cancelRegistration.mockResolvedValue(undefined)
  const user = userEvent.setup()
  renderLogin()
  await user.click(
    screen.getByRole('button', {
      name: 'Немає облікового запису? Зареєструватися',
    }),
  )
  await reachOtpStep(user)
  await user.click(screen.getByRole('button', { name: 'Змінити номер' }))
  expect(cancelRegistration).toHaveBeenCalledOnce()
  expect(screen.getByLabelText('Номер телефону')).toBeInTheDocument()
  expect(screen.queryByLabelText('Цифра 1')).not.toBeInTheDocument()
})

it('ignores a send response after leaving login', async () => {
  const send = deferred<SendOtpResponse>()
  otpSend.mockImplementation(() => send.promise)
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <LoginUnmountHarness />
    </MemoryRouter>,
  )
  await user.clear(screen.getByLabelText('Номер телефону'))
  await user.type(screen.getByLabelText('Номер телефону'), '501112233')
  await user.click(screen.getByRole('button', { name: 'Отримати код' }))
  await user.click(screen.getByRole('button', { name: 'Unmount login' }))
  await act(async () => {
    send.resolve({
      ...challengeData(),
      cooldownSeconds: 0,
      retryAfterSeconds: 0,
    })
    await send.promise
  })
  expect(screen.queryByLabelText('Цифра 1')).not.toBeInTheDocument()
  expect(auth.hydrate).not.toHaveBeenCalled()
})
