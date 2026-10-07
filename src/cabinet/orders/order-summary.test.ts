import { expect, it } from 'vitest'
import type { OrderDetail } from '@/api/orders'
import { money, orderMoney, refundEffects } from './order-money'
import { orderSteps } from './order-steps'

const stamp = (value: string) => value.slice(0, 10)

const order = (overrides: Partial<OrderDetail> = {}): OrderDetail => ({
  id: 'order-1',
  number: 284,
  status: 'pending',
  customerId: null,
  customerName: null,
  notes: null,
  items: [
    {
      id: 'item-1',
      partId: 'part-1',
      partName: 'Карта дверей FR',
      partType: null,
      coverPhotoUrl: null,
      carBrand: null,
      carModel: null,
      carCode: null,
      quantity: 1,
      unitPrice: 360,
      totalPrice: 360,
    },
  ],
  payments: [],
  history: [],
  totalAmount: 360,
  totalPaid: null,
  paymentCurrency: null,
  itemsTotalUsd: 360,
  createdAt: '2026-08-25T16:09:00Z',
  createdByName: 'Андрій Мельник',
  ...overrides,
})

const payment = (amount: number, currency: string) => ({
  id: `pay-${currency}-${String(amount)}`,
  accountId: 'till-1',
  accountName: 'Основна каса',
  amount,
  currency,
})

it('does not mark an unpaid order paid', () => {
  // `current` is drawn like a step that happened, so an open order has to sit
  // on «Створено» and leave «Оплачено» ahead of it.
  expect(orderSteps(order(), stamp)).toEqual([
    {
      key: 'created',
      label: 'Створено',
      meta: '2026-08-25 · Андрій Мельник',
      state: 'done',
    },
    { key: 'confirmed', label: 'Підтверджено', meta: '', state: 'upcoming' },
  ])
})

it('dates the confirmation once it has happened', () => {
  const steps = orderSteps(
    order({
      status: 'confirmed',
      confirmedAt: '2026-09-22T10:14:00Z',
      confirmedByName: 'Олексій',
    }),
    stamp,
  )

  expect(steps).toHaveLength(2)
  expect(steps[1]).toMatchObject({
    label: 'Підтверджено',
    meta: '2026-09-22 · Олексій',
    state: 'current',
  })
})

it('ends a refunded order on its own third step', () => {
  const steps = orderSteps(
    order({
      status: 'refunded',
      confirmedAt: '2026-09-22T10:14:00Z',
      refundedAt: '2026-09-23T12:40:00Z',
      refundedByName: 'Дмитро',
    }),
    stamp,
  )

  expect(steps.map((step) => step.label)).toEqual([
    'Створено',
    'Підтверджено',
    'Повернено',
  ])
  expect(steps[1]?.state).toBe('done')
  expect(steps[2]?.state).toBe('current')
})

it('ends a cancelled order without ever claiming it was paid', () => {
  const steps = orderSteps(
    order({ status: 'cancelled', cancelledAt: '2026-08-26T09:00:00Z' }),
    stamp,
  )

  expect(steps.map((step) => step.label)).toEqual(['Створено', 'Скасовано'])
})

it('keeps the order value apart from what has not been paid yet', () => {
  const summary = orderMoney(order())

  expect(summary.value).toBe(360)
  expect(summary.paid).toEqual([])
  expect(summary.status).toBe('pending')
  // Nothing about a remaining sum or a share paid: there is no rate (AC-12).
  expect(summary).not.toHaveProperty('remaining')
  expect(summary).not.toHaveProperty('paidPercent')
})

it('lists actual payments per currency and never adds currencies up', () => {
  const summary = orderMoney(
    order({
      payments: [
        payment(1500, 'UAH'),
        payment(120, 'USD'),
        payment(2700, 'uah'),
      ],
      totalPaid: null,
      paymentCurrency: null,
    }),
  )

  expect(summary.paid).toEqual([
    { currency: 'UAH', amount: 4200 },
    { currency: 'USD', amount: 120 },
  ])
})

it('does not judge a USD order paid in UAH as underpaid or overpaid (AC-11)', () => {
  const summary = orderMoney(
    order({
      itemsTotalUsd: 100,
      payments: [payment(4200, 'UAH')],
      totalPaid: 4200,
      paymentCurrency: 'UAH',
    }),
  )

  expect(summary.value).toBe(100)
  expect(summary.paid).toEqual([{ currency: 'UAH', amount: 4200 }])
  expect(summary.status).toBe('pending')
  expect(summary.tone).toBe('warn')
})

it('says what happened to an order that ended', () => {
  expect(orderMoney(order({ status: 'confirmed' })).tone).toBe('ok')
  expect(orderMoney(order({ status: 'refunded' })).status).toBe('refunded')
  expect(orderMoney(order({ status: 'cancelled' })).tone).toBe('dim')
})

it('writes money with the ISO code and the currency precision', () => {
  expect(money(12480, 'USD').replace(/\s/g, ' ')).toBe('12 480,00 USD')
  expect(money(1500, 'JPY').replace(/\s/g, ' ')).toBe('1 500 JPY')
  expect(money(100, null)).toBe('100')
  expect(money(null, 'USD')).toBe('—')
})

it('names every refunded sum in its own currency', () => {
  const current = order({
    status: 'confirmed',
    payments: [payment(4200, 'UAH'), payment(30, 'EUR')],
  })
  const [line] = refundEffects(current, orderMoney(current))
  expect(line?.replace(/\s/g, ' ')).toBe(
    '4 200,00 UAH і 30,00 EUR повернеться клієнту з каси: Основна каса',
  )
})
