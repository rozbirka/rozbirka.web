import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { billingApi } from '@/api/billing'
import { useAuth } from '@/auth/AuthContext'
import { LocaleOverride, LocaleProvider, type Locale } from '@/i18n'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/api/billing', () => ({ billingApi: { getPlans: vi.fn() } }))

function renderLanding(locale: Locale, path: string) {
  return render(
    <LocaleProvider locale="uk" syncDocumentLang={false}>
      <MemoryRouter initialEntries={[path]}>
        <LocaleOverride locale={locale}>
          <App />
        </LocaleOverride>
      </MemoryRouter>
    </LocaleProvider>,
  )
}

/** Page text without language names, which are always native (`lang`). */
function textOutsideLanguageNames(): string {
  const copy = document.body.cloneNode(true) as HTMLElement
  copy.querySelectorAll('[lang]').forEach((element) => element.remove())
  const attributes = [...copy.querySelectorAll('[aria-label], [alt]')].map(
    (element) =>
      `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('alt') ?? ''}`,
  )
  return `${copy.textContent ?? ''} ${attributes.join(' ')}`
}

describe('localized landing', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(billingApi.getPlans).mockRejectedValue(new Error('offline'))
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
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renders every landing section in British English', async () => {
    vi.stubEnv('VITE_TELEGRAM_SUPPORT_BOT', 'rozbirkabot')
    renderLanding('en-GB', '/en')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Software for car breakers — CRM and ERP Know where every part is and where your money is',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveAttribute('href', '#main')
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(
      within(nav).getByRole('link', { name: 'How it works' }),
    ).toHaveAttribute('href', '/en#how')
    expect(within(nav).getByRole('link', { name: 'Pricing' })).toHaveAttribute(
      'href',
      '/en#pricing',
    )
    expect(
      within(nav).getByRole('link', { name: 'rozbirka — home' }),
    ).toHaveAttribute('href', '/en')
    expect(within(nav).getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(
      screen.getAllByRole('link', { name: 'Start free trial' })[0],
    ).toHaveAttribute('href', '/login')
    for (const title of [
      'Already on board',
      'Sound familiar?',
      'From VIN to the last nut — all in one profile',
      'Clear profit on every car',
      'Every part in its place — found in seconds',
      'No prying eyes: salespeople don’t see the cost price',
      '13 modules in one system',
      'Why not Excel or a generic auto parts shop system',
      'One plan — every module',
      'Frequently asked questions',
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0)
    }
    expect(
      screen.getByRole('heading', { level: 3, name: 'Tills' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Still keeping your books by hand?',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('14 days free').length).toBeGreaterThan(0)
    expect(
      await screen.findByRole('link', { name: 'Start 14-day free trial' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Can I see the profit for each car separately\?/,
      }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Phone or Telegram')).toBeRequired()
    expect(
      screen.getAllByRole('link', { name: 'Download on the App Store' }),
    ).not.toHaveLength(0)
    expect(
      screen.getByRole('link', { name: 'Privacy policy' }),
    ).toHaveAttribute('hreflang', 'uk')
    expect(textOutsideLanguageNames()).not.toMatch(/[А-Яа-яЇїІіЄєҐґ]/)
  })

  it('renders the Polish landing headline and plans', () => {
    renderLanding('pl', '/pl')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Program do demontażu aut — CRM i ERP Wiesz, gdzie każda część i gdzie są Twoje pieniądze',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('14 dni za darmo').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: 'Zacznij 14 dni za darmo' }),
    ).toBeInTheDocument()
    expect(textOutsideLanguageNames()).not.toMatch(/[А-Яа-яЇїІіЄєҐґ]/)
  })
})
