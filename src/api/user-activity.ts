import { apiClient } from './client'
import type { RequestOptions } from './contracts'

export async function recordUserActivity(
  options: RequestOptions = {},
): Promise<void> {
  await apiClient.post(
    '/me/activity',
    undefined,
    options.signal ? { signal: options.signal } : {},
  )
}
