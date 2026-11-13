import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n'
import { StockSpotlight, TeamSpotlight, TrialBand } from './spotlights'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('light chapter spotlights', () => {
  it('marks every section as a light chapter', () => {
    const { container } = render(
      <MemoryRouter>
        <StockSpotlight />
        <TeamSpotlight />
        <TrialBand />
      </MemoryRouter>,
    )
    const sections = [...container.querySelectorAll('section')]
    expect(sections).toHaveLength(3)
    for (const section of sections) {
      expect(section).toHaveAttribute('data-tone', 'light')
      expect(section).toHaveClass('lp-light', 'lp-chap')
    }
    expect(sections[2]).toHaveClass('lp-chap-last')
  })

  it('shows the team activity log instead of the permissions table', () => {
    render(<TeamSpotlight />)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Розбірка працює, навіть коли тебе немає на місці',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Кожен у команді бачить свою частину роботи. Ти бачиш усе.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Журнал дій · сьогодні' }),
    ).toBeInTheDocument()
    const rows = within(
      screen.getAllByRole('list').find((list) => list.tagName === 'OL')!,
    ).getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    expect(rows[0]).toHaveTextContent('09:12')
    expect(rows[0]).toHaveTextContent('Олег · Майстер')
    expect(rows[1]).toHaveTextContent('Замовлення #1048 оплачено · 515 USD')
    expect(rows[2]).toHaveTextContent('Фара ліва 160 → 180 USD')
    expect(screen.getByText('Продажі Ірини сьогодні')).toBeInTheDocument()
    expect(screen.getByText(/^1\s240 USD$/)).toBeInTheDocument()
  })

  it('formats the log amounts per locale', () => {
    render(
      <LocaleProvider locale="en-GB" syncDocumentLang={false}>
        <TeamSpotlight />
      </LocaleProvider>,
    )
    expect(screen.getByText('1,240 USD')).toBeInTheDocument()
    expect(screen.getByText('Order #1048 paid · 515 USD')).toBeInTheDocument()
  })

  it('splits the trial title and keeps the CTA and the Telegram demo', () => {
    vi.stubEnv('VITE_TELEGRAM_SUPPORT_BOT', 'rozbirkabot')
    render(
      <MemoryRouter>
        <TrialBand />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Перевір на своїй розбірці — 14 днів безкоштовно',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('14 днів безкоштовно')).toHaveClass(
      'whitespace-nowrap',
    )
    expect(
      screen.getByRole('link', { name: 'Почати безкоштовно' }),
    ).toHaveAttribute('href', '/login?purpose=registration')
    expect(
      screen.getByRole('link', { name: 'Замовити демо' }).getAttribute('href'),
    ).toContain('rozbirkabot')
  })
})
