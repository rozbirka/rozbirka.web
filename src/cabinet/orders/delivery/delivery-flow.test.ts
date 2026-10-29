import { expect, it } from 'vitest'
import type { DeliveryOrder } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'
import {
  orderActions,
  paymentState,
  refundTotals,
  returnProgress,
} from './delivery-flow'

const delivery = (over: Partial<DeliveryOrder> = {}): DeliveryOrder =>
  ({
    orderId: 'o',
    agreedTotalUah: 9600,
    appliedUah: 5400,
    outstandingUah: 4200,
    dispatchedAt: null,
    receivedAt: null,
    returnedAt: null,
    payments: [],
    workflowState: 'Open',
    refundDueUah: 0,
    refundAllocations: [],
    ...over,
  }) as DeliveryOrder

const payout = (paymentState: string | null) =>
  ({ paymentState, codUah: 4200 }) as Shipment

it('reads the money block apart from the parcel (9.1–9.7)', () => {
  expect(paymentState(delivery(), null)).toBe('due')
  expect(paymentState(delivery({ receivedAt: 'x' }), null)).toBe('awaitingCod')
  expect(
    paymentState(delivery({ appliedUah: 9600, outstandingUah: 0 }), null),
  ).toBe('paid')
  expect(
    paymentState(delivery({ receivedAt: 'x' }), payout('CashRegisterRequired')),
  ).toBe('manual')
  expect(
    paymentState(delivery({ receivedAt: 'x' }), payout('NeedsReconciliation')),
  ).toBe('reconcile')
})

it('does not treat an unset hryvnia total as a received payment', () => {
  expect(
    paymentState(
      delivery({ agreedTotalUah: 0, appliedUah: 0, outstandingUah: 0 }),
      null,
    ),
  ).toBe('unpriced')
})

it('requires applied payment to cover the agreed total before saying paid', () => {
  expect(
    paymentState(delivery({ appliedUah: 0, outstandingUah: 0 }), null),
  ).toBe('due')
  expect(
    paymentState(delivery({ appliedUah: 9600, outstandingUah: 0 }), null),
  ).toBe('paid')
})

it('reads refunds and money that came after cancellation (10.6–10.16)', () => {
  const refunded = {
    id: 'p1',
    accountId: 'a',
    amountUah: 5400,
    feeUah: 0,
    netUah: 5400,
    kind: 'prepayment',
    recordedBy: null,
    createdAt: 'x',
    refundedAt: 'y',
  }
  expect(
    paymentState(
      delivery({ workflowState: 'AwaitingRefund', refundDueUah: 9600 }),
      null,
    ),
  ).toBe('refundDue')
  const partial = delivery({
    workflowState: 'AwaitingRefund',
    refundDueUah: 4200,
    payments: [refunded],
  })
  expect(paymentState(partial, null)).toBe('refundPartial')
  expect(refundTotals(partial)).toEqual({
    booked: 9600,
    refunded: 5400,
    due: 4200,
  })
  const cancelled = delivery({
    workflowState: 'Cancelled',
    payments: [refunded],
  })
  expect(paymentState(cancelled, null)).toBe('refunded')
  expect(paymentState(cancelled, payout('LatePaymentNeedsRefund'))).toBe('late')
  expect(paymentState(delivery({ workflowState: 'Cancelled' }), null)).toBe(
    'notApplicable',
  )
})

it('offers cancel before dispatch and only a return after (10.1, 10.13, 10.15)', () => {
  expect(orderActions(delivery(), true)).toEqual({
    startReturn: null,
    cancel: 'enabled',
    sentNotice: false,
  })
  expect(orderActions(delivery({ dispatchedAt: 'x' }), true)).toEqual({
    startReturn: 'menu',
    cancel: 'disabled',
    sentNotice: true,
  })
  expect(
    orderActions(delivery({ dispatchedAt: 'x', receivedAt: 'y' }), true),
  ).toEqual({ startReturn: 'button', cancel: null, sentNotice: false })
  // A step already taken is not offered again, nor anything without the right.
  for (const workflowState of ['AwaitingGoods', 'AwaitingRefund', 'Cancelled'])
    expect(
      orderActions(delivery({ dispatchedAt: 'x', workflowState }), true)
        .startReturn,
    ).toBeNull()
  expect(orderActions(delivery(), false).cancel).toBeNull()
})

it('places a return on its step and leaves an unsent cancellation out', () => {
  expect(
    returnProgress(delivery({ workflowState: 'AwaitingRefund' })),
  ).toBeNull()
  expect(
    returnProgress(
      delivery({ dispatchedAt: 'x', workflowState: 'AwaitingGoods' }),
    ),
  ).toBe(1)
  expect(
    returnProgress(
      delivery({ dispatchedAt: 'x', workflowState: 'AwaitingRefund' }),
    ),
  ).toBe(3)
  expect(
    returnProgress(delivery({ dispatchedAt: 'x', workflowState: 'Cancelled' })),
  ).toBe(5)
})
