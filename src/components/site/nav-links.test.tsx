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
    expect(screen.getByRole('link', { name: 'Тарифи' })).toHaveAttribute(
      'href',
      '/#pricing',
    )
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute(
      'href',
      '/#faq',
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

    expect(screen.getByRole('link', { name: 'Strona główna' })).toHaveAttribute(
      'href',
      '/pl',
    )
    expect(screen.getByRole('link', { name: 'Cennik' })).toHaveAttribute(
      'href',
      '/pl#pricing',
    )
  })
})
