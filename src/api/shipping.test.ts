import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { shippingApi } from './shipping'

afterEach(() => vi.restoreAllMocks())

it.each([null, {}])(
  'reads an order that has no delivery as no shipment: %j',
  async (data) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data })
    expect(await shippingApi.get('integration', 'order')).toBeNull()
  },
)

it('sends the agreed total and never waives the deposit on its own', async () => {
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: {} })
  await shippingApi.configureOrder('order-1', 4280.5)
  expect(put).toHaveBeenCalledWith('/orders/order-1/delivery', {
    agreedTotalUah: 4280.5,
    waiveDeposit: false,
  })
})
