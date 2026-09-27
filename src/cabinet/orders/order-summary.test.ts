import { expect, it } from 'vitest'
import type { OrderDetail } from '@/api/orders'
import { orderMoney } from './order-money'
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

it('counts the whole order as outstanding while nothing has been paid', () => {
  const summary = orderMoney(order())

  expect(summary.totalUsd).toBe(360)
  expect(summary.paid).toBe(0)
  expect(summary.remaining).toBe(360)
  expect(summary.paidPercent).toBe(0)
  expect(summary.label).toBe('Очікує оплати')
})

it('takes dollars paid off a dollar order', () => {
  const summary = orderMoney(
    order({
      payments: [payment(100, 'USD')],
      totalPaid: 100,
      paymentCurrency: 'USD',
    }),
  )

  expect(summary.remaining).toBe(260)
  expect(summary.paidPercent).toBe(28)
  expect(summary.label).toBe('Очікує оплати')
})

it('refuses to compare two currencies rather than dropping one', () => {
  const summary = orderMoney(
    order({
      status: 'confirmed',
      payments: [payment(1500, 'UAH'), payment(120, 'USD')],
      totalPaid: null,
      paymentCurrency: null,
    }),
  )

  expect(summary.paid).toBeNull()
  expect(summary.remaining).toBeNull()
  expect(summary.label).toBe('Оплачено повністю')
})

it('never draws a bar past full or a negative balance', () => {
  const summary = orderMoney(
    order({
      payments: [payment(500, 'USD')],
      totalPaid: 500,
      paymentCurrency: 'USD',
    }),
  )

  expect(summary.remaining).toBe(0)
  expect(summary.paidPercent).toBe(100)
  expect(summary.label).toBe('Внесено повністю')
})

it('says what happened to an order that ended badly', () => {
  expect(orderMoney(order({ status: 'refunded' })).label).toBe(
    'Кошти повернено',
  )
  expect(orderMoney(order({ status: 'cancelled' })).label).toBe(
    'Замовлення скасовано',
  )
})
