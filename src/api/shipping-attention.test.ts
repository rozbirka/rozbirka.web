import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { getTrackingAttention } from './shipping-attention'

afterEach(() => vi.restoreAllMocks())
it('reads scoped paged attention without a carrier mutation and forwards cancellation', async () => {
  const signal = new AbortController().signal
  const data = {
    pausedCount: 0,
    delayedCount: 0,
    total: 0,
    page: 2,
    pageSize: 10,
    items: [],
  }
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data })
  expect(await getTrackingAttention(2, { signal })).toEqual(data)
  expect(get).toHaveBeenCalledWith('/shipping/tracking-attention', {
    params: { page: 2, pageSize: 10 },
    signal,
  })
})
