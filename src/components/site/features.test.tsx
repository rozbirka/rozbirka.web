import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Features } from './features'

describe('Features grid', () => {
  it('groups the thirteen modules with their first three benefits', () => {
    const { container } = render(<Features />)
    expect(container.querySelector('section')).toHaveClass(
      'lp-surface',
      'lp-island',
    )
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '13 модулів в одній системі',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Облік і склад', 'Продажі й гроші', 'Інтеграції'])

    const groups = ['Облік і склад', 'Продажі й гроші', 'Інтеграції'].map(
      (name) => screen.getByRole('list', { name }),
    )
    expect(
      groups.map((group) =>
        within(group)
          .getAllByRole('heading', { level: 4 })
          .map((h) => h.textContent),
      ),
    ).toEqual([
      ['Авто', 'Партії', 'Склад', 'Склади', 'Інвентаризація', 'Стікери'],
      ['Замовлення', 'Клієнти', 'Каси', 'Звіти', 'Команда'],
      ['Нова Пошта', 'OLX'],
    ])
    expect(screen.getByText('12–13')).toBeInTheDocument()

    const team = screen
      .getByRole('heading', { level: 4, name: 'Команда' })
      .closest('li')!
    expect(within(team).getAllByRole('listitem')).toHaveLength(3)
    expect(
      within(team).getByText('Розумієш хто скільки продав і заробив'),
    ).toBeInTheDocument()
    expect(within(team).getByText('11')).toBeInTheDocument()
  })

  it('makes every scrollable phone carousel keyboard focusable', () => {
    render(<Features />)
    for (const name of ['Облік і склад', 'Продажі й гроші', 'Інтеграції']) {
      expect(screen.getByRole('list', { name })).toHaveAttribute(
        'tabindex',
        '0',
      )
    }
  })
})
