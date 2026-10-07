import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuth, type AuthContextValue } from '@/auth/AuthContext'
import type { Locale } from '@/i18n/locales'
import { localePreference } from '@/i18n/locale-preference'
import { LocaleProvider, useLocale } from '@/i18n/LocaleProvider'
import { LanguageCard } from './language-card'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))

const updateLanguage = vi.fn<(language: Locale | null) => Promise<void>>()

function mockAuth(language: string | null | undefined, withUpdate = true) {
  vi.mocked(useAuth).mockReturnValue({
    status: 'authenticated',
    user: {
      id: 'user-1',
      phone: '+447700900123',
      displayName: 'Jane',
      effectiveLanguage: 'uk',
      ...(language === undefined ? {} : { language }),
    },
    tenant: null,
    tenants: [],
    hydrate: vi.fn(),
    commitTenant: vi.fn(),
    updateName: vi.fn(),
    ...(withUpdate ? { updateLanguage } : {}),
    signOut: vi.fn(),
  } satisfies AuthContextValue)
}

function LocaleProbe() {
  return <p data-testid="locale">{useLocale().locale}</p>
}

function renderCard(profileLanguage: string | null = null) {
  return render(
    <LocaleProvider profileLanguage={profileLanguage}>
      <LanguageCard />
      <LocaleProbe />
    </LocaleProvider>,
  )
}

const httpError = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    data: {},
    status,
    statusText: String(status),
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  })

beforeEach(() => {
  updateLanguage.mockReset()
  updateLanguage.mockResolvedValue(undefined)
  localePreference.set(null)
})

afterEach(() => {
  localePreference.set(null)
})

it('lists automatic plus the three languages in their own names (jsdom browser is English)', () => {
  mockAuth(null)
  renderCard()

  expect(
    screen.getByRole('heading', { name: 'Interface language' }),
  ).toBeVisible()
  expect(screen.getByRole('radio', { name: /Automatic/ })).toBeChecked()
  expect(
    screen.getByText('From your browser language · now: English (UK)'),
  ).toBeVisible()
  expect(screen.getByText('Українська')).toHaveAttribute('lang', 'uk')
  expect(screen.getByText('Polski')).toHaveAttribute('lang', 'pl')
  expect(screen.getByRole('button', { name: 'Save language' })).toBeDisabled()
})

it('saves the chosen language to the profile and mirrors it on the device', async () => {
  mockAuth(null)
  const user = userEvent.setup()
  renderCard()

  await user.click(screen.getByRole('radio', { name: /Polski/ }))
  await user.click(screen.getByRole('button', { name: 'Save language' }))

  expect(updateLanguage).toHaveBeenCalledWith('pl')
  await waitFor(() => expect(localePreference.get()).toBe('pl'))
  expect(screen.getByTestId('locale')).toHaveTextContent('pl')
})

it('keeps the choice on this device when Identity has no language endpoint yet', async () => {
  mockAuth(undefined)
  updateLanguage.mockRejectedValue(httpError(404))
  const user = userEvent.setup()
  renderCard()

  await user.click(screen.getByRole('radio', { name: /Українська/ }))
  await user.click(screen.getByRole('button', { name: 'Save language' }))

  expect(
    await screen.findByText(/Мову збережено на цьому пристрої/),
  ).toBeVisible()
  expect(localePreference.get()).toBe('uk')
})

it('reports a failed save with retry and keeps the old language', async () => {
  mockAuth('en-GB')
  updateLanguage.mockRejectedValue(httpError(503))
  const user = userEvent.setup()
  renderCard('en-GB')

  await user.click(screen.getByRole('radio', { name: /Polski/ }))
  await user.click(screen.getByRole('button', { name: 'Save language' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Couldn’t save the language')
  expect(screen.getByRole('radio', { name: /Polski/ })).toBeChecked()
  expect(screen.getByTestId('locale')).toHaveTextContent('en-GB')
  expect(localePreference.get()).toBeNull()

  updateLanguage.mockResolvedValue(undefined)
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(updateLanguage).toHaveBeenLastCalledWith('pl')
})

it('falls back to device storage when the auth provider cannot save', async () => {
  mockAuth(null, false)
  const user = userEvent.setup()
  renderCard()

  await user.click(screen.getByRole('radio', { name: /Polski/ }))
  await user.click(screen.getByRole('button', { name: 'Save language' }))
  expect(localePreference.get()).toBe('pl')
})
