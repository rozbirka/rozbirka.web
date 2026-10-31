import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Hero } from './hero'

describe('Hero conversion', () => {
  it('exposes a stable heading and a real registration destination', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Програма для авторозбірки — CRM і ERP Більше прибутку з кожного авто на розбірці',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Спробувати безкоштовно' }),
    ).toHaveAttribute('href', '/login')
    expect(
      screen.getByRole('link', { name: 'Завантажити в App Store' }),
    ).toHaveAttribute(
      'href',
      'https://apps.apple.com/ua/app/rozbirka/id6762130912',
    )
  })

  it('renders the final demo figures on the server, ready to count up', () => {
    const { container } = render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    )
    const counts = [...container.querySelectorAll('[data-count]')].map(
      (element) => element.textContent?.replace(/\s/g, ' '),
    )
    expect(counts).toEqual(['$3 200', '$5 870', '+83%'])
    expect(screen.getByText('131 з 184')).toBeInTheDocument()
  })
})
