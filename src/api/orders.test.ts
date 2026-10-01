import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { ordersApi } from './orders'

afterEach(() => vi.restoreAllMocks())

describe('ordersApi', () => {
  it('uses the canonical order endpoints and carries an idempotency key only for replay-safe transitions', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { id: 'order-1' } })
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
      data: { id: 'order-1' },
    })
    const create = {
      customerId: 'customer-1',
      notes: null,
      items: [{ partId: 'part-1', quantity: 1, unitPrice: 250 }],
    }
    const key = 'order-confirm-0001'

    await ordersApi.create(create)
    await ordersApi.updatePayments('order-1', [
      { accountId: 'cash-1', amount: 100, currency: 'USD' },
    ])
    await ordersApi.confirm(
      'order-1',
      { payments: [{ accountId: 'cash-1', amount: 250, currency: 'UAH' }] },
      { idempotencyKey: key },
    )
    await ordersApi.cancel('order-1')
    await ordersApi.refund(
      'order-1',
      { refundReason: 'Повернення' },
      { idempotencyKey: 'order-refund-0001' },
    )

    expect(post).toHaveBeenNthCalledWith(1, '/orders', create)
    expect(put).toHaveBeenCalledWith('/orders/order-1/payments', {
      payments: [{ accountId: 'cash-1', amount: 100, currency: 'USD' }],
    })
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/orders/order-1/confirm',
      { payments: [{ accountId: 'cash-1', amount: 250, currency: 'UAH' }] },
      { idempotency: { idempotencyKey: key } },
    )
    expect(post).toHaveBeenNthCalledWith(3, '/orders/order-1/cancel')
    expect(post).toHaveBeenNthCalledWith(
      4,
      '/orders/order-1/refund',
      { refundReason: 'Повернення' },
      { idempotency: { idempotencyKey: 'order-refund-0001' } },
    )
  })
})

it('fills in the collections Core omits when they are empty', async () => {
  const bare = {
    id: 'order-1',
    number: 286,
    status: 'new',
    customerId: null,
    customerName: null,
    notes: null,
    totalAmount: null,
    totalPaid: null,
    paymentCurrency: null,
    createdAt: '2026-09-21T09:44:00Z',
    createdByName: 'Дмитро',
  }
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: bare })
  vi.spyOn(apiClient, 'post').mockResolvedValue({ data: bare })

  const loaded = await ordersApi.getById('order-1')
  const created = await ordersApi.create({
    customerId: null,
    notes: null,
    items: [],
  })

  for (const order of [loaded, created]) {
    expect(order.items).toEqual([])
    expect(order.payments).toEqual([])
    expect(order.history).toEqual([])
  }
})
