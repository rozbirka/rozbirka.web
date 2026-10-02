import { apiClient } from './client'
import type { RequestOptions } from './contracts'

export const FEATURE_FLAGS = { partsBulkImport: 'parts.bulk-import' } as const
export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]
export type FeatureFlagValues = Readonly<Record<string, boolean>>

export const featureFlagsApi = {
  async get(options: RequestOptions = {}): Promise<FeatureFlagValues> {
    const response = await apiClient.get<Record<string, boolean>>(
      '/me/feature-flags',
      options.signal ? { signal: options.signal } : {},
    )
    return response.data
  },
}
