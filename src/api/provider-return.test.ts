import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { providerReturnApi } from './provider-return'

afterEach(() => vi.restoreAllMocks())

it('reads return state for the immutable shipment and restores omitted nullable values', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: { sourceVersion: 'sv', capability: { canCreate: false } },
  })
  const result = await providerReturnApi.get('integration', 'attempt')
  expect(get).toHaveBeenCalledWith(
    '/integrations/integration/shipping/shipments/attempt/return',
    {},
  )
  expect(result).toEqual({
    trackingPaused: false,
    trackingFailures: 0,
    syncProblem: null,
    sourceVersion: 'sv',
    version: null,
    capability: { canCreate: false, blockReason: null },
    state: null,
    requestRef: null,
    requestStatus: null,
    requestNumber: null,
    reverse: null,
  })
})

it('never treats a provider request number as a reverse waybill', async () => {
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    data: {
      sourceVersion: 'sv',
      capability: { canCreate: false },
      state: 'Accepted',
      requestNumber: '102-001',
      requestRef: 'ref',
    },
  })
  const result = await providerReturnApi.refresh('i', 's')
  expect(result.requestNumber).toBe('102-001')
  expect(result.reverse).toBeNull()
})

it('does not retry a create when the response is lost', async () => {
  const post = vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('lost'))
  const input = {
    sourceVersion: 'sv',
    returnAddressRef: 'a',
    paymentMethod: 'Cash' as const,
    reasonRef: 'r',
    subtypeReasonRef: 'sub',
    note: '',
  }
  await expect(providerReturnApi.create('i', 's', input)).rejects.toThrow(
    'lost',
  )
  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenCalledWith(
    '/integrations/i/shipping/shipments/s/return/create',
    input,
  )
})
