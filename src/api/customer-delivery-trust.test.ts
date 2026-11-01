import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { customersApi } from './customers'

afterEach(() => vi.restoreAllMocks())

it('updates delivery trust with a reason and returns the server-confirmed customer', async () => {
  const customer = { id: 'customer-1', isTrustedForDelivery: true }
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: null })
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: customer })

  const result = await customersApi.setDeliveryTrust('customer-1', {
    isTrusted: true,
    reason: 'Successful deliveries',
  })

  expect(put).toHaveBeenCalledWith(
    '/customers/customer-1/delivery-trust',
    {
      isTrusted: true,
      reason: 'Successful deliveries',
    },
    {},
  )
  expect(get).toHaveBeenCalledWith('/customers/customer-1', {})
  expect(result.isTrustedForDelivery).toBe(true)
})

it('does not claim a trust change succeeded when the server refused it', async () => {
  vi.spyOn(apiClient, 'put').mockRejectedValue(new Error('Denied'))
  const get = vi.spyOn(apiClient, 'get')
  await expect(
    customersApi.setDeliveryTrust('customer-1', {
      isTrusted: true,
      reason: 'Reviewed',
    }),
  ).rejects.toThrow('Denied')
  expect(get).not.toHaveBeenCalled()
})
