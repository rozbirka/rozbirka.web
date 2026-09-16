import { MemoryRouter } from 'react-router'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { IntakeListItem } from '@/api/intakes'
import { DashboardRecentIntakes } from './DashboardRecentIntakes'

const intakes: IntakeListItem[] = [
  {
    id: 'intake-1',
    name: 'Tesla Model Y 2021',
    supplier: 'Ігор',
    purchasedAt: '2026-09-15',
    totalCost: 8_200,
    partsCount: 14,
    soldCount: 2,
    createdAt: '2026-09-16T07:15:00Z',
    createdBy: { id: 'user-1', displayName: 'Олена' },
  },
]

it('renders recent intakes as a separate linked design card', () => {
  render(
    <MemoryRouter>
      <DashboardRecentIntakes
        intakes={intakes}
        intakesPath="/app/garage/intakes"
      />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Приймання' })).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Tesla Model Y 2021' }),
  ).toHaveAttribute('href', '/app/garage/intakes/intake-1')
  expect(screen.getByText('16.09, 10:15').closest('p')).toHaveTextContent(
    '16.09, 10:15 · Олена',
  )
  expect(screen.getByText('14 шт')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Усі' })).toHaveAttribute(
    'href',
    '/app/garage/intakes',
  )
})

it('renders a calm empty state when there are no intakes', () => {
  render(
    <MemoryRouter>
      <DashboardRecentIntakes intakes={[]} intakesPath="/app/garage/intakes" />
    </MemoryRouter>,
  )

  expect(screen.getByText('Приймань ще немає.')).toBeInTheDocument()
})
