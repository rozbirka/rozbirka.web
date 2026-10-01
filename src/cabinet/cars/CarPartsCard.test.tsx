import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import type { CarProfitability } from '@/api/cars'
import { CarPartsCard } from './CarPartsCard'

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

const renderCard = (
  over: Partial<CarProfitability> = {},
  partsHref: string | null = '/app/demo/parts?car_ids=car-1',
) =>
  render(
    <MemoryRouter>
      <CarPartsCard partsHref={partsHref} profit={profit(over)} />
    </MemoryRouter>,
  )

it('splits the parts into what sold and what is still on the shelf', () => {
  renderCard()

  expect(screen.getByText('79')).toBeVisible()
  expect(screen.getByText('115')).toBeVisible()
  expect(screen.getByText('продано')).toBeVisible()
  expect(screen.getByText('на складі')).toBeVisible()
})

it('states each share as a percentage, not colour alone', () => {
  renderCard()

  expect(screen.getByText('41 %')).toBeVisible()
  expect(screen.getByText('59 %')).toBeVisible()
})

it('sends the reader to the warehouse already filtered to this car', () => {
  renderCard()

  expect(screen.getByRole('link', { name: 'Усі 194 →' })).toHaveAttribute(
    'href',
    '/app/demo/parts?car_ids=car-1',
  )
})

it('drops the link for someone who may not open the warehouse', () => {
  renderCard({}, null)

  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.getByText('продано')).toBeVisible()
})

it('says plainly when the car has not been taken apart yet', () => {
  renderCard({ partsTotal: 0, partsAvailable: 0, partsSold: 0 })

  expect(
    screen.getByText('З цього авто ще не розібрано жодної позиції.'),
  ).toBeVisible()
  expect(screen.queryByText('продано')).toBeNull()
})
