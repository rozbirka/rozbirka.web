import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { recordUserActivity } from './user-activity'

afterEach(() => vi.restoreAllMocks())

it('records the authenticated membership activity without client identity or timestamp', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ status: 204 })
  const signal = new AbortController().signal
  await recordUserActivity({ signal })
  expect(post).toHaveBeenCalledWith('/me/activity', undefined, { signal })
})
