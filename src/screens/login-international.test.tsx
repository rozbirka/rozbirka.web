import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { useAuth, type AuthContextValue } from '@/auth/AuthContext'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { LoginScreen } from './login'

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

// eslint-disable-next-line @typescript-eslint/unbound-method
const otpSend = vi.mocked(authApi.otpSend)

function renderLogin(locale: 'uk' | 'en-GB' | 'pl') {
  return render(
    <LocaleProvider locale={locale}>
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    </LocaleProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  vi.mocked(useAuth).mockReturnValue({
    status: 'guest',
    user: null,
    tenant: null,
    tenants: [],
    hydrate: vi.fn(),
    commitTenant: vi.fn(),
    updateName: vi.fn(),
    signOut: vi.fn(),
  } satisfies AuthContextValue)
  otpSend.mockResolvedValue({
    challengeId: 'c',
    expiresAt: '2099-01-01T00:00:00.000Z',
    resendAt: new Date(Date.now()).toISOString(),
    retryAfterSeconds: 0,
    cooldownSeconds: 0,
  })
})

it('signs in a British number in English without rewriting it to +380', async () => {
  const user = userEvent.setup()
  renderLogin('en-GB')

  expect(
    screen.getByRole('heading', { name: 'Sign in with your phone number' }),
  ).toBeVisible()
  expect(
    screen.getByRole('radio', { name: /United Kingdom \+44/ }),
  ).toBeChecked()
  const input = screen.getByLabelText('Phone number')
  await user.clear(input)
  await user.type(input, '07700 900123')
  expect(input).toHaveValue('+44 7700 900123')

  await user.click(screen.getByRole('button', { name: 'Get code' }))
  expect(otpSend).toHaveBeenCalledWith(
    { phone: '+447700900123' },
    expect.anything(),
  )
  expect(await screen.findByText('+44 7700 900123')).toBeVisible()
})

it('switches the number country when a full international number is pasted', async () => {
  const user = userEvent.setup()
  renderLogin('uk')

  const input = screen.getByLabelText('Номер телефону')
  await user.clear(input)
  await user.click(input)
  await user.clear(input)
  await user.paste('+48 512 345 678')
  expect(input).toHaveValue('+48 512 345 678')
  expect(screen.getByRole('radio', { name: /Польща \+48/ })).toBeChecked()
})

it('keeps the national digits when the country is changed', async () => {
  const user = userEvent.setup()
  renderLogin('pl')

  const input = screen.getByLabelText('Numer telefonu')
  await user.clear(input)
  await user.type(input, '512345678')
  expect(input).toHaveValue('+48 512 345 678')
  await user.click(screen.getByRole('radio', { name: /Ukraina \+380/ }))
  expect(input).toHaveValue('+380 51 234 56 78')
})

it('rejects a number from an unsupported country before sending', async () => {
  const user = userEvent.setup()
  renderLogin('en-GB')

  const input = screen.getByLabelText('Phone number')
  await user.clear(input)
  await user.type(input, '+4915123456789')
  await user.click(screen.getByRole('button', { name: 'Get code' }))
  expect(
    screen.getByText(/SMS sign-in is available for numbers from Ukraine/),
  ).toBeVisible()
  expect(otpSend).not.toHaveBeenCalled()
})
