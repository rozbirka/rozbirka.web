import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type {
  DashboardAnalytics,
  DashboardData,
} from '@/api/dashboard-contract'
import { LocaleProvider } from '@/i18n'
import { DashboardKpis } from './DashboardKpis'

const data = (overrides: Partial<DashboardData> = {}): DashboardData => ({
  userName: 'Олена',
  role: 'owner',
  yardName: 'Koval Auto',
  yardCity: 'Київ',
  isYardEmpty: false,
  todaySalesCount: 1,
  availablePartsCount: 978,
  intakesCount: 3,
  revenue: {
    today: [{ currency: 'USD', amount: 103 }],
    week: [],
    month: [],
  },
  todayNewPartsCount: 4,
  lastActivity: null,
  activeCarsCount: 24,
  outOfStockPartsCount: 96,
  customersCount: 40,
  totalBalanceUah: 125_498,
  teamMembersCount: 3,
  totalInvested: 87_770,
  totalRecouped: 76_874,
  carsInWork: 4,
  totalPartsSold: 210,
  myPartsToday: 1,
  lastMyActivity: null,
  ...overrides,
})

const analytics = (
  overrides: Partial<DashboardAnalytics> = {},
): DashboardAnalytics => ({
  period: 'week',
  labels: ['13.09', '14.09'],
  revenue: { totals: { USD: 900 }, trendPercent: 4, series: [400, 500] },
  partsSold: { total: 21, delta: 3, series: [10, 11] },
  activeOrders: { total: 9, delta: -2, series: [11, 9] },
  topPart: null,
  ...overrides,
})

it('says today’s takings in the currency the server tagged them with', () => {
  render(<DashboardKpis analytics={analytics()} data={data()} parts={null} />)

  const revenue = screen.getByText('Надходження сьогодні').closest('div')
  expect(revenue).toHaveTextContent('103')
  expect(revenue).toHaveTextContent('USD')
  expect(revenue).toHaveTextContent('1 продаж')
})

it('reports the payback of the yard against what it put in', () => {
  render(
    <DashboardKpis
      accountingCurrency="GBP"
      analytics={analytics()}
      data={data()}
      parts={null}
    />,
  )

  const payoff = screen.getByText('Окупність складу').closest('div')
  expect(payoff).toHaveTextContent('88')
  expect(payoff).toHaveTextContent('76 874 з 87 770 GBP')
})

it('lists other currencies received today beside the headline, unsummed', () => {
  render(
    <DashboardKpis
      analytics={analytics()}
      data={data({
        revenue: {
          today: [
            { currency: 'UAH', amount: 4200 },
            { currency: 'EUR', amount: 30 },
          ],
          week: [],
          month: [],
        },
      })}
      parts={null}
    />,
  )

  const receipts = screen.getByText('Надходження сьогодні').closest('div')
  expect(receipts).toHaveTextContent('4 200UAH')
  expect(receipts).toHaveTextContent('+ 30 EUR')
})

it('compares active orders with the period, the only comparison there is', () => {
  render(<DashboardKpis analytics={analytics()} data={data()} parts={null} />)

  expect(
    screen.getByText('Активні замовлення').closest('div'),
  ).toHaveTextContent('−2 за період')
})

it('counts reserved positions only once the parts summary has arrived', () => {
  const { rerender } = render(
    <DashboardKpis analytics={analytics()} data={data()} parts={null} />,
  )
  expect(
    screen.getByText('Доступно на складі').closest('div'),
  ).toHaveTextContent('позицій у продажу')

  rerender(
    <DashboardKpis
      analytics={analytics()}
      data={data()}
      parts={{ total: 1200, available: 978, reserved: 14, sold: 208 }}
    />,
  )
  expect(
    screen.getByText('Доступно на складі').closest('div'),
  ).toHaveTextContent('14 у резерві')
})

it('uses three equal columns for three figures and a two-by-two grid for four', () => {
  const { rerender } = render(
    <DashboardKpis
      analytics={analytics()}
      data={data({ revenue: null })}
      parts={null}
    />,
  )

  expect(screen.getByLabelText('Показники')).toHaveClass('sm:grid-cols-3')

  rerender(<DashboardKpis analytics={analytics()} data={data()} parts={null} />)
  expect(screen.getByLabelText('Показники')).toHaveClass('sm:grid-cols-2')
})

it('leaves out a figure the account may not see rather than showing a dash', () => {
  render(
    <DashboardKpis
      analytics={null}
      data={data({ revenue: null, totalInvested: null, totalRecouped: null })}
      parts={null}
    />,
  )

  expect(screen.queryByText('Надходження сьогодні')).not.toBeInTheDocument()
  expect(screen.queryByText('Окупність складу')).not.toBeInTheDocument()
  expect(screen.queryByText('Активні замовлення')).not.toBeInTheDocument()
  expect(screen.getByText('Доступно на складі')).toBeVisible()
})

it('reads the figures in English (UK)', () => {
  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <DashboardKpis
        accountingCurrency="GBP"
        analytics={analytics()}
        data={data({ todaySalesCount: 2 })}
        parts={null}
      />
    </LocaleProvider>,
  )

  expect(screen.getByText('Receipts today').closest('div')).toHaveTextContent(
    '2 sales',
  )
  expect(screen.getByText('Stock payback').closest('div')).toHaveTextContent(
    '76,874 of 87,770 GBP',
  )
  expect(screen.getByText('Active orders').closest('div')).toHaveTextContent(
    '−2 over the period',
  )
  expect(
    screen.getByText('Available in stock').closest('div'),
  ).toHaveTextContent('978items')
  expect(screen.queryByText(/[А-Яа-яЇїІіЄєҐґ]/)).toBeNull()
})
