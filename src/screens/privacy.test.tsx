import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { LocaleProvider, siteLocalePreference } from '@/i18n'
import { PrivacyScreen } from './privacy'

afterEach(() => {
  siteLocalePreference.set(null)
  document.documentElement.lang = 'uk'
})

it('provides the same standalone legal document with contact-only links', () => {
  render(<PrivacyScreen />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Як ми поводимось з даними',
  )
  const links = screen.getAllByRole('link')
  expect(links.length).toBeGreaterThan(0)
  for (const link of links)
    expect(link).toHaveAttribute('href', 'mailto:support@rozbirka.com')
  expect(screen.queryByRole('navigation')).toBeNull()
  // The only controls choose the page language.
  const group = screen.getByRole('group', { name: 'Мова сторінки' })
  expect(screen.getAllByRole('button')).toEqual(
    within(group).getAllByRole('button'),
  )
  expect(
    within(group).getByRole('button', { name: 'Українська' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

it('describes personal erasure separately from company data and existing subscriptions', () => {
  const { container } = render(<PrivacyScreen />)
  const text = container.textContent
  expect(text).toContain('Спільні записи компанії')
  expect(text).toContain('не скасовує підписку')
  expect(text).not.toMatch(/30 днів|14 днів|усіма пов.язаними даними/)
  for (const provider of [
    'Google',
    'Cloudflare',
    'Twilio',
    'Monobank',
    'RevenueCat',
  ])
    expect(text).toContain(provider)
})

it('opens in the site language chosen on the landing and says the Ukrainian original applies', () => {
  siteLocalePreference.set('en-GB')
  render(
    <LocaleProvider locale="uk">
      <PrivacyScreen />
    </LocaleProvider>,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'How we handle your data',
  )
  expect(screen.getByText(/the Ukrainian version applies/)).toBeVisible()
  expect(screen.getByRole('main')).toHaveAttribute('lang', 'en-GB')
  expect(document.documentElement.lang).toBe('en-GB')
  expect(screen.getByText(/Shared company records/)).toBeVisible()
  for (const link of screen.getAllByRole('link'))
    expect(link).toHaveAttribute('href', 'mailto:support@rozbirka.com')
})

it('switches the page to Polish and remembers it as the site language', async () => {
  const user = userEvent.setup()
  render(<PrivacyScreen />)
  await user.click(screen.getByRole('button', { name: 'Polski' }))
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Jak postępujemy z danymi',
  )
  expect(screen.getByText(/obowiązuje wersja ukraińska/)).toBeVisible()
  expect(screen.getByRole('group', { name: 'Język strony' })).toBeVisible()
  expect(siteLocalePreference.get()).toBe('pl')
})

it('keeps every translated section the Ukrainian source has', async () => {
  const user = userEvent.setup()
  render(<PrivacyScreen />)
  const count = () => screen.getAllByRole('heading', { level: 2 }).length
  expect(count()).toBe(10)
  await user.click(screen.getByRole('button', { name: 'English (UK)' }))
  expect(count()).toBe(10)
  await user.click(screen.getByRole('button', { name: 'Polski' }))
  expect(count()).toBe(10)
})
