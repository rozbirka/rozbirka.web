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
  })

  it('renders every landing section in British English', async () => {
    renderLanding('en-GB', '/en')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Know where every part is and where your money is',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveAttribute('href', '#main')
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getByRole('link', { name: 'Features' })).toHaveAttribute(
      'href',
      '/en#features',
    )
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
      screen.getByRole('link', { name: 'Start free trial' }),
    ).toHaveAttribute('href', '/login')
    expect(
      screen.getByRole('heading', { level: 3, name: 'Tills' }),
    ).toBeInTheDocument()
    expect(screen.getByAltText('Tills screenshot')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pause autoplay' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pricing plans' }),
    ).toBeInTheDocument()
    expect(screen.getByText('14 days free')).toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'Start 14-day free trial' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Can I see the profit for each car separately\?/,
      }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByAltText('rozbirka on phones')).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: 'Download on the App Store' }),
    ).not.toHaveLength(0)
    expect(
      screen.getAllByLabelText('Google Play — coming soon'),
    ).not.toHaveLength(0)
    expect(
      screen.getByRole('link', { name: 'Privacy policy' }),
    ).toHaveAttribute('hreflang', 'uk')
    expect(
      screen.getByRole('button', { name: 'Back to top' }),
    ).toBeInTheDocument()
    expect(textOutsideLanguageNames()).not.toMatch(/[А-Яа-яЇїІіЄєҐґ]/)
  })

  it('renders the Polish landing headline and plans', () => {
    renderLanding('pl', '/pl')

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Wiesz, gdzie każda część i gdzie są Twoje pieniądze',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('14 dni za darmo')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Zacznij 14 dni za darmo' }),
    ).toBeInTheDocument()
    expect(textOutsideLanguageNames()).not.toMatch(/[А-Яа-яЇїІіЄєҐґ]/)
  })
})
