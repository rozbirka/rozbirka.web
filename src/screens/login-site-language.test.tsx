import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/AuthContext'
import { SiteHeader } from '@/components/site/header'
import {
  LocaleOverride,
  LocaleProvider,
  localePreference,
  requestLocale,
  siteLocalePreference,
  useLocale,
} from '@/i18n'
import { LoginScreen } from './login'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))

function GoToCabinet() {
  const navigate = useNavigate()
  return <button onClick={() => void navigate('/account')}>Open cabinet</button>
}

function CabinetLanguage() {
  return <output data-testid="cabinet-language">{useLocale().locale}</output>
}

beforeEach(() => {
  localStorage.clear()
  localePreference.set('uk')
  vi.mocked(useAuth).mockReturnValue({
    status: 'guest',
    user: null,
    tenant: null,
    tenants: [],
    hydrate: vi.fn(),
    commitTenant: vi.fn(),
    updateName: vi.fn(),
    signOut: vi.fn(),
  })
})

afterEach(() => {
  localStorage.clear()
  requestLocale.set(null)
})

it.each([
  [
    'English (UK)',
    'en-GB',
    'Sign in with your phone number',
    'No account yet? Sign up',
    'Create an account',
    'Log in',
  ],
  [
    'Polski',
    'pl',
    'Logowanie numerem telefonu',
    'Nie masz konta? Zarejestruj się',
    'Utwórz konto',
    'Zaloguj się',
  ],
] as const)(
  'carries %s from the landing through login and registration without changing the cabinet',
  async (
    language,
    locale,
    title,
    registration,
    registrationTitle,
    loginLink,
  ) => {
    const user = userEvent.setup()
    render(
      <LocaleProvider>
        <MemoryRouter>
          <GoToCabinet />
          <Routes>
            <Route
              path="/"
              element={
                <LocaleOverride locale="uk">
                  <SiteHeader />
                </LocaleOverride>
              }
            />
            <Route
              path="/en"
              element={
                <LocaleOverride locale="en-GB">
                  <SiteHeader />
                </LocaleOverride>
              }
            />
            <Route
              path="/pl"
              element={
                <LocaleOverride locale="pl">
                  <SiteHeader />
                </LocaleOverride>
              }
            />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/account" element={<CabinetLanguage />} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>,
    )
    await user.click(
      screen.getByRole('button', { name: 'Мова сайту: українська' }),
    )
    await user.click(screen.getByRole('menuitemradio', { name: language }))
    await user.click(screen.getByRole('link', { name: loginLink }))
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe(locale)
    expect(requestLocale.get()).toBe(locale)
    await user.click(screen.getByRole('button', { name: registration }))
    expect(
      screen.getByRole('heading', { name: registrationTitle }),
    ).toBeInTheDocument()
    expect(localePreference.get()).toBe('uk')
    expect(siteLocalePreference.get()).toBe(locale)
    await user.click(screen.getByRole('button', { name: 'Open cabinet' }))
    expect(screen.getByTestId('cabinet-language')).toHaveTextContent('uk')
    expect(requestLocale.get()).toBe('uk')
    expect(document.documentElement.lang).toBe('uk')
  },
)

it('uses the cabinet fallback for a direct login without a public-site choice', () => {
  render(
    <LocaleProvider locale="uk">
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    </LocaleProvider>,
  )
  expect(
    screen.getByRole('heading', { name: 'Вхід за номером телефону' }),
  ).toBeInTheDocument()
})
