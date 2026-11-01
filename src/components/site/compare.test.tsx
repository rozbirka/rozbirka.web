import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { Compare } from './compare'

function renderCompare() {
  return render(
    <MemoryRouter>
      <Compare />
    </MemoryRouter>,
  )
}

it('compares Excel, a generic ERP and rozbirka with a mark per cell', () => {
  const { container } = renderCompare()
  expect(container.querySelector('section')).toHaveClass('lp-surface', '')
  const table = screen.getByRole('table', {
    name: 'Чому не Excel і не універсальна програма для автомагазину',
  })
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual([
    'Що потрібно розбірці',
    'XExcel / зошит',
    'ERPУніверсальна ERP',
    'rozbirka',
  ])
  const rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(7)
  expect(
    within(rows[1]!)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['✕Рахуєш вручну', '✕Немає', '✓Автоматично'])
  expect(
    within(rows[2]!)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['✕Формули ламаються', '~Частково', '✓З коробки'])
  expect(
    within(rows[6]!).getByRole('rowheader', {
      name: 'Створено саме для розбірки',
    }),
  ).toBeInTheDocument()
})

it('lets keyboard users scroll the wide table', () => {
  renderCompare()
  expect(
    screen.getByRole('region', {
      name: 'Чому не Excel і не універсальна програма для автомагазину',
    }),
  ).toHaveAttribute('tabindex', '0')
  expect(
    screen.getByRole('link', { name: 'Спробувати безкоштовно' }),
  ).toHaveAttribute('href', '/login')
})
