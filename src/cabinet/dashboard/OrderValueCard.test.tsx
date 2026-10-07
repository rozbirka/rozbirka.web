import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { OrderValueCard } from './OrderValueCard'

it('says no currency is chosen instead of «0 USD» and links the owner (4b)', () => {
  render(
    <MemoryRouter>
      <OrderValueCard
        settingsPath="/app/koval/settings/business"
        status={{ kind: 'not-chosen' }}
      />
    </MemoryRouter>,
  )
  expect(screen.getByText('Валюту обліку ще не обрано')).toBeVisible()
  expect(screen.queryByText(/0\sUSD/)).toBeNull()
  expect(screen.getByRole('link', { name: 'Обрати валюту →' })).toHaveAttribute(
    'href',
    '/app/koval/settings/business#accounting-currency',
  )
})

it('gives a worker no link to the setting', () => {
  render(
    <MemoryRouter>
      <OrderValueCard settingsPath={null} status={{ kind: 'not-chosen' }} />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link')).toBeNull()
})

it('names the accounting currency of the value (4a)', () => {
  render(
    <MemoryRouter>
      <OrderValueCard
        settingsPath={null}
        status={{ kind: 'chosen', currency: 'USD', locked: true }}
      />
    </MemoryRouter>,
  )
  expect(screen.getByText('Облікова вартість · USD')).toBeVisible()
})
