import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { DashboardData } from '@/api/dashboard-contract'
import { DashboardSummary } from './DashboardSummary'

const summary = (overrides: Partial<DashboardData> = {}): DashboardData => ({
  userName: 'Максим',
  role: 'owner',
  yardName: 'Koval Auto',
  yardCity: 'Київ',
  isYardEmpty: false,
  todaySalesCount: 1_234,
  availablePartsCount: 5_678,
  intakesCount: 12,
  revenue: {
    today: [{ currency: 'UAH', amount: 45_600 }],
    week: [],
    month: [],
  },
  todayNewPartsCount: 23,
  lastActivity: {
    type: 'Додано запчастину',
    userName: 'Олена',
    timestamp: '2026-08-28T13:45:00Z',
  },
  activeCarsCount: 6,
  outOfStockPartsCount: 0,
  customersCount: 789,
  totalBalanceUah: 123_456,
  teamMembersCount: 4,
  totalInvested: 23_000,
  totalRecouped: 8_500,
  carsInWork: 3,
  totalPartsSold: 45,
  myPartsToday: 2,
  lastMyActivity: {
    type: 'Продано запчастину',
    userName: 'Максим',
    timestamp: '2026-08-28T14:00:00Z',
  },
  ...overrides,
})

const metric = (label: string) => screen.getByText(label).closest('article')
const normalizedText = (element: Element | null) =>
  element?.textContent?.replace(/\s+/g, ' ') ?? ''

it('renders the money and warehouse overview with authoritative values', () => {
  render(
    <DashboardSummary
      data={summary({
        revenue: {
          today: [
            { currency: 'USD', amount: 1_240 },
            { currency: 'UAH', amount: 18_600 },
          ],
          week: [],
          month: [],
        },
      })}
    />,
  )

  expect(screen.getByRole('region', { name: 'Зведення' })).toContainElement(
    screen.getByRole('heading', { name: 'Гроші' }),
  )
  expect(screen.getByRole('heading', { name: 'Склад' })).toBeInTheDocument()
  expect(normalizedText(metric('Виручка'))).toContain('1 240USD')
  expect(normalizedText(metric('Виручка'))).toContain('18 600UAH')
  expect(normalizedText(metric('Баланс кас'))).toContain('123 456UAH')
  expect(normalizedText(metric('Доступних запчастин'))).toContain('5 678шт')
  expect(normalizedText(metric('Продано всього'))).toContain('45шт')
  expect(normalizedText(metric('Виручка'))).toContain('1 234 замовлення')
  const activity = screen.getByRole('region', { name: 'Остання активність' })
  expect(activity).toHaveTextContent(/28\.08\.2026, 16:45/)
  expect(activity).toHaveTextContent(/Додано запчастину/)
})

it('does not invent absent owner values', () => {
  render(
    <DashboardSummary
      data={summary({
        activeCarsCount: null,
        outOfStockPartsCount: null,
        customersCount: null,
        totalBalanceUah: null,
        teamMembersCount: null,
        totalInvested: null,
        totalRecouped: null,
      })}
    />,
  )

  expect(screen.queryByText('Баланс кас')).not.toBeInTheDocument()
  expect(screen.queryByText('Інвестовано всього')).not.toBeInTheDocument()
  expect(screen.queryByText('Повернено всього')).not.toBeInTheDocument()
})

it('renders Core-provided work totals for an owner, including a real zero', () => {
  render(
    <DashboardSummary
      data={summary({
        role: 'owner',
        carsInWork: 3,
        totalPartsSold: 0,
        myPartsToday: null,
        lastMyActivity: null,
      })}
    />,
  )

  expect(screen.getByText('Продано всього').parentElement).toHaveTextContent(
    '0',
  )
})

it('renders Core-provided personal totals and activity for a manager', () => {
  render(
    <DashboardSummary
      data={summary({
        role: 'manager',
        carsInWork: null,
        totalPartsSold: null,
        myPartsToday: 2,
        lastMyActivity: {
          type: 'Продано запчастину',
          userName: 'Олена',
          timestamp: '2026-08-28T14:00:00Z',
        },
      })}
    />,
  )

  expect(
    screen.getByRole('region', { name: 'Моя остання активність' }),
  ).toHaveTextContent('Продано запчастину · Олена')
})

it('renders master-only totals and activity without owner values', () => {
  render(
    <DashboardSummary
      data={summary({
        role: 'master',
        activeCarsCount: null,
        outOfStockPartsCount: null,
        customersCount: null,
        totalBalanceUah: null,
        teamMembersCount: null,
        totalInvested: null,
        totalRecouped: null,
      })}
    />,
  )

  expect(screen.getByText('Продано всього')).toBeInTheDocument()
  expect(screen.getByText(/Продано запчастину/)).toBeInTheDocument()
  expect(screen.queryByText('Інвестовано всього')).not.toBeInTheDocument()
})

it('shows recoupment from server totals without inventing a cash split', () => {
  render(
    <DashboardSummary
      data={summary({ totalInvested: 10_000, totalRecouped: 8_200 })}
    />,
  )

  expect(screen.getByText('Окупність складу 82%')).toBeInTheDocument()
  expect(normalizedText(metric('Повернено всього'))).toContain(
    'лишилось 1 800 USD',
  )
  expect(screen.queryByText('Сейф')).not.toBeInTheDocument()
  expect(screen.queryByText('ФОП Mono')).not.toBeInTheDocument()
})

it('shows real cash balances for every currency returned by cash registers', () => {
  render(
    <DashboardSummary
      cashBalances={{ UAH: 123_456, USD: 2_450 }}
      data={summary()}
    />,
  )

  expect(normalizedText(metric('Баланс кас'))).toContain('2 450USD')
  expect(normalizedText(metric('Баланс кас'))).toContain('123 456UAH')
})

it('renders an empty yard as a successful onboarding state', () => {
  render(<DashboardSummary data={summary({ isYardEmpty: true })} />)

  expect(screen.getByText('Почніть наповнювати розбірку')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
