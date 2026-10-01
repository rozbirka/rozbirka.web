import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { deliveryApi } from './delivery'

afterEach(() => vi.restoreAllMocks())

const summary = { orderId: 'order-1', agreedTotalUah: 4600 }

it('fills in the payment list Core omits when the order has none', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: summary })

  expect((await deliveryApi.get('order-1')).payments).toEqual([])
})

it('sends the agreed total and never waives the deposit on its own', async () => {
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: summary })

  await deliveryApi.configure('order-1', 4280.5)

  expect(put).toHaveBeenCalledWith('/orders/order-1/delivery', {
    agreedTotalUah: 4280.5,
    waiveDeposit: false,
  })
})

it('carries a replay key on every call that moves money', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: summary })
  const replay = { idempotencyKey: 'delivery-payment-1' }
  const payment = {
    accountId: 'cash-1',
    amountUah: 3600,
    feeUah: 60,
    kind: 'prepayment' as const,
  }

  await deliveryApi.recordPayment('order-1', payment, replay)
  await deliveryApi.linkPayment(
    'order-1',
    { cashTransactionId: 'tx-1', feeUah: 0, kind: 'prepayment' },
    replay,
  )
  await deliveryApi.refundPayment('order-1', 'payment-1', replay)

  expect(post).toHaveBeenNthCalledWith(
    1,
    '/orders/order-1/delivery/payments',
    payment,
    { idempotency: replay },
  )
  expect(post).toHaveBeenNthCalledWith(
    2,
    '/orders/order-1/delivery/payments/link',
    { cashTransactionId: 'tx-1', feeUah: 0, kind: 'prepayment' },
    { idempotency: replay },
  )
  expect(post).toHaveBeenNthCalledWith(
    3,
    '/orders/order-1/delivery/payments/payment-1/refund',
    undefined,
    { idempotency: replay },
  )
})

it('uses the lifecycle endpoints Core names, and returns only an intact return', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: summary })

  await deliveryApi.dispatch('order-1')
  await deliveryApi.receive('order-1')
  await deliveryApi.acceptReturn('order-1')

  expect(post).toHaveBeenNthCalledWith(1, '/orders/order-1/delivery/dispatch')
  expect(post).toHaveBeenNthCalledWith(2, '/orders/order-1/delivery/received')
  expect(post).toHaveBeenNthCalledWith(
    3,
    '/orders/order-1/delivery/return-received',
    { allItemsReceivedUndamaged: true },
  )
})

it('restores the nulls Core omits when it serialises', async () => {
  // `JsonIgnoreCondition.WhenWritingNull` drops a null property entirely, so
  // an order nobody has dispatched arrives with no `dispatchedAt` at all.
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      orderId: 'order-1',
      agreedTotalUah: 4000,
      appliedUah: 0,
      outstandingUah: 4000,
      netReceivedUah: 0,
      feesUah: 0,
      requiredDepositUah: 0,
      depositShortfallUah: 0,
      depositSatisfied: false,
      depositWaived: false,
      customerTrusted: false,
      awaitingCodReconciliation: false,
    },
  })

  const delivery = await deliveryApi.get('order-1')

  expect(delivery.dispatchedAt).toBeNull()
  expect(delivery.receivedAt).toBeNull()
  expect(delivery.returnedAt).toBeNull()
  expect(delivery.payments).toEqual([])
})
