import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Features } from './features'

describe('Features grid', () => {
  it('lists the thirteen modules with their first three benefits', () => {
    render(<Features />)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '13 модулів в одній системі',
      }),
    ).toBeInTheDocument()
    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(titles).toEqual([
      'Авто',
      'Партії',
      'Склад',
      'Склади',
      'Інвентаризація',
      'Стікери',
      'Замовлення',
      'Клієнти',
      'Каси',
      'Звіти',
      'Команда',
      'Нова Пошта',
      'OLX',
    ])
    const team = screen.getByRole('heading', {
      level: 3,
      name: 'Команда',
    }).parentElement!
    expect(within(team).getAllByRole('listitem')).toHaveLength(3)
    expect(
      within(team).getByText('Розумієш хто скільки продав і заробив'),
    ).toBeInTheDocument()
  })
})
