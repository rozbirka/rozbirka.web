import { expect, it } from 'vitest'
import type { DeliveryOrder } from '@/api/delivery'
import type { CashTransaction } from '@/api/cash'
import {
  deliveryStage,
  hryvnia,
  linkableTransactions,
  linkedGross,
  paymentOutcome,
} from './delivery-money'

const delivery = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
  orderId: 'order-1',
  agreedTotalUah: 4600,
  appliedUah: 4600,
  outstandingUah: 0,
  netReceivedUah: 4600,
  feesUah: 0,
  requiredDepositUah: 360,
  depositShortfallUah: 0,
  depositSatisfied: true,
  depositWaived: false,
  depositRequired: true,
  customerTrusted: false,
  dispatchedAt: null,
  receivedAt: null,
  returnedAt: null,
  awaitingCodReconciliation: false,
  payments: [],
  ...over,
})

const receipt = (over: Partial<CashTransaction> = {}): CashTransaction => ({
  id: 'tx-1',
  type: 'manual_in',
  direction: 'in',
  amount: 2390,
  currency: 'UAH',
  note: 'оплата за двигун',
  createdAt: '2026-09-21T10:58:00Z',
  createdByName: 'Дмитро',
  referenceId: null,
  ...over,
})

it('follows the lifecycle by the dates Core stamps', () => {
  expect(deliveryStage(delivery())).toBe('open')
  expect(deliveryStage(delivery({ dispatchedAt: 'now' }))).toBe('dispatched')
  expect(
    deliveryStage(delivery({ dispatchedAt: 'now', receivedAt: 'now' })),
  ).toBe('received')
  expect(
    deliveryStage(delivery({ dispatchedAt: 'now', returnedAt: 'now' })),
  ).toBe('returned')
})

it('adds the fee to a linked receipt instead of taking it off', () => {
  expect(linkedGross(2390, 12)).toBe(2402)
})

it('refuses a payment that would exceed what the order still owes', () => {
  const outcome = paymentOutcome(4000, 3600)

  expect(outcome).toEqual({ gross: 4000, over: true, remaining: 0 })
})

it('says whether a payment closes the balance or leaves some of it', () => {
  expect(paymentOutcome(3600, 3600).remaining).toBe(0)
  expect(paymentOutcome(1000, 3600).remaining).toBe(2600)
})

it('offers only receipts Core will accept for linking', () => {
  const offered = linkableTransactions([
    receipt(),
    receipt({ id: 'tx-2', referenceId: 'order-9' }),
    receipt({ id: 'tx-3', direction: 'out' }),
    receipt({ id: 'tx-4', currency: 'USD' }),
    receipt({ id: 'tx-5', type: 'withdrawal_out' }),
  ])

  expect(offered.map((item) => item.id)).toEqual(['tx-1'])
})

it('takes a hryvnia figure the way the cabinet is typed', () => {
  expect(hryvnia('2 390')).toBeNull()
  expect(hryvnia('2390,50')).toBe(2390.5)
  expect(hryvnia('0')).toBeNull()
  expect(hryvnia('0', { allowZero: true })).toBe(0)
  expect(hryvnia('12,345')).toBeNull()
})
