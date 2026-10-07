import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from '@/i18n'
import { OrderValueCard } from './OrderValueCard'
import { pickConfirmedOrdersValue } from './order-value'

const summaryValue = {
  today: 120,
  week: 980.5,
  month: 12480,
  accountingCurrency: 'USD' as const,
}
const analyticsValue = {
  total: 4310,
  series: [0, 4310],
  accountingCurrency: 'USD' as const,
}

it('says no currency is chosen instead of «0 USD» and links the owner (4b)', () => {
  render(
    <MemoryRouter>
      <OrderValueCard
        period="month"
        periodLabel="Місяць"
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
      <OrderValueCard
        period="month"
        periodLabel="Місяць"
        settingsPath={null}
        status={{ kind: 'not-chosen' }}
      />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link')).toBeNull()
})

it('shows the confirmed-order value of the period in the accounting currency (4a)', () => {
  render(
    <MemoryRouter>
      <OrderValueCard
        analyticsValue={analyticsValue}
        period="week"
        periodLabel="Тиждень"
        settingsPath={null}
        status={{ kind: 'chosen', currency: 'USD', locked: true }}
        summaryValue={summaryValue}
      />
    </MemoryRouter>,
  )
  const card = screen.getByRole('region', {
    name: 'Вартість підтверджених замовлень',
  })
  expect(card).toHaveTextContent(/4\s310\sUSD/)
  expect(card).toHaveTextContent('Облікова вартість · USD')
  expect(card).toHaveTextContent('Тиждень')
  expect(card).not.toHaveTextContent('Сервер ще не рахує')
})

it('formats the value in the interface locale', () => {
  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <MemoryRouter>
        <OrderValueCard
          period="month"
          periodLabel="Month"
          settingsPath={null}
          status={{ kind: 'chosen', currency: 'USD', locked: true }}
          summaryValue={summaryValue}
        />
      </MemoryRouter>
    </LocaleProvider>,
  )
  expect(screen.getByText('12,480 USD')).toBeVisible()
  expect(screen.getByText('Value of confirmed orders')).toBeVisible()
})

it('is not shown when Core withholds the value from this role', () => {
  const { container } = render(
    <MemoryRouter>
      <OrderValueCard
        analyticsValue={null}
        period="day"
        periodLabel="День"
        settingsPath={null}
        status={{ kind: 'chosen', currency: 'USD', locked: true }}
        summaryValue={null}
      />
    </MemoryRouter>,
  )
  expect(container).toBeEmptyDOMElement()
})

describe('pickConfirmedOrdersValue', () => {
  it('prefers the analytics period total', () => {
    expect(
      pickConfirmedOrdersValue('week', analyticsValue, summaryValue),
    ).toEqual({ amount: 4310, currency: 'USD' })
  })

  it('falls back to the summary field of the period', () => {
    expect(pickConfirmedOrdersValue('day', null, summaryValue)).toEqual({
      amount: 120,
      currency: 'USD',
    })
    expect(pickConfirmedOrdersValue('week', undefined, summaryValue)).toEqual({
      amount: 980.5,
      currency: 'USD',
    })
    expect(pickConfirmedOrdersValue('month', null, null)).toBeNull()
  })
})
