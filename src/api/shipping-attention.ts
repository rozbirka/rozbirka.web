import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type { components } from './generated/core'

export type TrackingAttention = components['schemas']['TrackingAttentionDto']
export type TrackingAttentionItem =
  components['schemas']['TrackingAttentionItemDto']

export async function getTrackingAttention(
  page = 1,
  options: RequestOptions = {},
): Promise<TrackingAttention> {
  const { data } = await apiClient.get<TrackingAttention>(
    '/shipping/tracking-attention',
    {
      params: { page, pageSize: 10 },
      ...(options.signal ? { signal: options.signal } : {}),
    },
  )
  return data
}
