import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type { components } from './generated/core'

export type PartModuleComposition =
  components['schemas']['PartModuleComposition']
export type ModuleSummary = components['schemas']['ModuleSummary']

export const partModulesApi = {
  async get(
    partId: string,
    options: RequestOptions = {},
  ): Promise<PartModuleComposition> {
    const response = await apiClient.get<PartModuleComposition>(
      `/parts/${encodeURIComponent(partId)}/modules`,
      options,
    )
    return response.data
  },

  async getBatch(
    partIds: readonly string[],
    options: RequestOptions = {},
  ): Promise<PartModuleComposition[]> {
    if (partIds.length === 0 || partIds.length > 100) {
      throw new Error('Provide 1 to 100 Part IDs')
    }
    const response = await apiClient.post<PartModuleComposition[]>(
      '/parts/modules/batch',
      { partIds: [...new Set(partIds)] },
      options,
    )
    return response.data
  },
}
