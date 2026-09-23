import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { shippingApi } from './shipping'

afterEach(() => vi.restoreAllMocks())

it.each([null, {}])(
  'treats an empty successful shipment response as no shipment: %j',
  async (data) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data })
    expect(await shippingApi.get('integration', 'order')).toBeNull()
  },
)

it('configures the agreed UAH total without waiving the deposit', async () => {
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: {} })
  await shippingApi.configureOrder('order-1', 4280.5)
  expect(put).toHaveBeenCalledWith('/orders/order-1/delivery', {
    agreedTotalUah: 4280.5,
    waiveDeposit: false,
  })
})
