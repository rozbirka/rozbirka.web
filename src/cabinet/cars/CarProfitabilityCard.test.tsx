import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { CarProfitability } from '@/api/cars'
import { CarProfitabilityCard } from './CarProfitabilityCard'

const profit = (over: Partial<CarProfitability> = {}): CarProfitability => ({
  invested: 13760,
  recouped: 18401,
  remaining: 13760 - 18401,
  recoupedPercent: 134,
  partsTotal: 194,
  partsAvailable: 115,
  partsSold: 79,
  ...over,
})

const renderCard = (over: Partial<CarProfitability> = {}, expensesTotal = 0) =>
  render(
    <CarProfitabilityCard
      expensesTotal={expensesTotal}
      profit={profit(over)}
      purchasePrice={13760}
    />,
  )

it('names what the invested figure is made of', () => {
  renderCard({}, 420)

  expect(screen.getByText(/авто 13 760 \$ \+ витрати 420 \$/)).toBeVisible()
})

it('says plainly when a car cost nothing beyond its price', () => {
  renderCard()

  expect(screen.getByText('ціна придбання')).toBeVisible()
})

it('reports the surplus over what went in, not the share returned', () => {
  renderCard()

  expect(screen.getByText('Прибуток')).toBeVisible()
  expect(screen.getByText('+34 % до вкладеного')).toBeVisible()
  expect(
    screen.getByRole('progressbar', { name: 'Окупність' }),
  ).toHaveAttribute('aria-valuenow', '134')
})

it('turns the third figure into the gap that is still to be sold', () => {
  renderCard({ recouped: 9870, remaining: 3890, recoupedPercent: 72 })

  expect(screen.getByText('До окупності')).toBeVisible()
  expect(screen.getByText('ще продати на цю суму')).toBeVisible()
  expect(screen.getByText('Окупається')).toBeVisible()
})

it('does not call a car with no sales anything but that', () => {
  renderCard({
    recouped: 0,
    remaining: 13760,
    recoupedPercent: 0,
    partsSold: 0,
    partsAvailable: 194,
  })

  expect(screen.getByText('Без продажів')).toBeVisible()
  expect(screen.getByText('продажів ще не було')).toBeVisible()
})

it('writes break-even on the bar so the marker is not colour alone', () => {
  renderCard()

  expect(screen.getByText(/беззбитковість 13 760 \$/)).toBeVisible()
})

it('leaves the payback bar out when nothing went in and nothing came back', () => {
  renderCard({ invested: 0, recouped: 0, remaining: 0, recoupedPercent: null })

  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(screen.getByText('Прибутковість')).toBeVisible()
})
