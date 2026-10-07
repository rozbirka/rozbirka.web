import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/AuthContext'
import {
  LocaleOverride,
  LocaleProvider,
  localePreference,
  type Locale,
} from '@/i18n'
import { SiteHeader } from './header'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function renderHeader(path: '/' | '/en' | '/pl' = '/') {
  const page = (locale: Locale) => (
    <LocaleOverride locale={locale}>
      <SiteHeader />
      <CurrentPath />
    </LocaleOverride>
  )
  return render(
    <LocaleProvider locale="uk" syncDocumentLang={false}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={page('uk')} />
          <Route path="/en" element={page('en-GB')} />
          <Route path="/pl" element={page('pl')} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  )
}

describe('site language switcher', () => {
  beforeEach(() => {
    localStorage.clear()
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
  })

  it('shows the language code with a full accessible name', () => {
    renderHeader('/')
    const button = screen.getByRole('button', {
      name: 'Мова сайту: українська',
    })

    expect(button).toHaveTextContent('UK')
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('lists native language names as links with lang and hreflang', async () => {
    const user = userEvent.setup()
    renderHeader('/en')
    await user.click(
      screen.getByRole('button', { name: 'Site language: English (UK)' }),
    )

    const menu = screen.getByRole('menu', { name: 'Site language' })
    const items = within(menu).getAllByRole('menuitemradio')
    expect(
      items.map((item) => [
        item.textContent,
        item.getAttribute('href'),
        item.getAttribute('hreflang'),
        item.getAttribute('lang'),
        item.getAttribute('aria-checked'),
      ]),
    ).toEqual([
      ['Українська', '/', 'uk', 'uk', 'false'],
      ['English (UK)', '/en', 'en-GB', 'en-GB', 'true'],
      ['Polski', '/pl', 'pl', 'pl', 'false'],
    ])
  })

  it('opens with Enter, moves with arrows and closes with Escape', async () => {
    const user = userEvent.setup()
    renderHeader('/')
    const button = screen.getByRole('button', {
      name: 'Мова сайту: українська',
    })

    button.focus()
    await user.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('menuitemradio', { name: 'Українська' }),
    ).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('menuitemradio', { name: 'English (UK)' }),
    ).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(
      screen.getByRole('menuitemradio', { name: 'Українська' }),
    ).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitemradio', { name: 'Polski' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button).toHaveFocus()
  })

  it('opens with Space too', async () => {
    const user = userEvent.setup()
    renderHeader('/pl')
    const button = screen.getByRole('button', {
      name: 'Język strony: polski',
    })

    button.focus()
    await user.keyboard(' ')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'Polski' })).toHaveFocus()
  })

  it('remembers the choice and opens the language page without a redirect banner', async () => {
    const user = userEvent.setup()
    renderHeader('/')
    await user.click(
      screen.getByRole('button', { name: 'Мова сайту: українська' }),
    )
    await user.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByTestId('path')).toHaveTextContent('/en')
    expect(localePreference.get()).toBe('en-GB')
    expect(
      screen.getByRole('button', { name: 'Site language: English (UK)' }),
    ).toHaveTextContent('EN')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers three language segments in the mobile menu', async () => {
    const user = userEvent.setup()
    renderHeader('/pl')
    await user.click(screen.getByRole('button', { name: 'Otwórz menu' }))
    const mobileNav = screen.getByRole('navigation', {
      name: 'Nawigacja mobilna',
    })
    const group = within(mobileNav).getByRole('list', { name: 'Język strony' })
    const links = within(group).getAllByRole('link')

    expect(
      links.map((link) => [
        link.textContent,
        link.getAttribute('href'),
        link.getAttribute('hreflang'),
        link.getAttribute('lang'),
        link.getAttribute('aria-current'),
      ]),
    ).toEqual([
      ['Українська', '/', 'uk', 'uk', null],
      ['English (UK)', '/en', 'en-GB', 'en-GB', null],
      ['Polski', '/pl', 'pl', 'pl', 'true'],
    ])

    await user.click(links[0]!)
    expect(screen.getByTestId('path')).toHaveTextContent('/')
    expect(localePreference.get()).toBe('uk')
    expect(
      screen.getByRole('button', { name: 'Відкрити меню' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })
})
