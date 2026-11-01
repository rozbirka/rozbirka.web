import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from '@/i18n'
import { NavLinks } from './nav-links'

describe('NavLinks', () => {
  it('uses homepage destinations from a non-home route', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <NavLinks />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Можливості' })).toHaveAttribute(
      'href',
      '/#features',
    )
    expect(screen.getByRole('link', { name: 'Тариф' })).toHaveAttribute(
      'href',
      '/#pricing',
    )
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute(
      'href',
      '/#faq',
    )
  })

  it('lists the sections in the mock-up order and marks the current one', () => {
    render(
      <MemoryRouter>
        <NavLinks activeHash="#features" activeClassName="is-on" />
      </MemoryRouter>,
    )
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Відгуки',
      'Як це працює',
      'Можливості',
      'Тариф',
      'FAQ',
    ])
    const current = screen.getByRole('link', { name: 'Можливості' })
    expect(current).toHaveAttribute('aria-current', 'location')
    expect(current).toHaveClass('is-on')
    expect(screen.getByRole('link', { name: 'FAQ' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('points to the landing of the current language', () => {
    render(
      <LocaleProvider locale="pl" syncDocumentLang={false}>
        <MemoryRouter initialEntries={['/pl']}>
          <NavLinks />
        </MemoryRouter>
      </LocaleProvider>,
    )

    expect(screen.getByRole('link', { name: 'Jak to działa' })).toHaveAttribute(
      'href',
      '/pl#how',
    )
    expect(screen.getByRole('link', { name: 'Cennik' })).toHaveAttribute(
      'href',
      '/pl#pricing',
    )
  })
})
