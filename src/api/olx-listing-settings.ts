import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type { components } from './generated/core'
import type { OlxCity, OlxDistrict } from './olx-live'

type Schema = components['schemas']
type SettingsResponse = Schema['OlxListingSettingsView']
export type OlxListingSettingsView = Required<SettingsResponse>
export type OlxListingSettingsRequest = Schema['OlxListingSettingsRequest']

const base = '/integrations/olx/listing-settings'

const normalize = (settings: SettingsResponse): OlxListingSettingsView => ({
  contactName: settings.contactName ?? null,
  contactPhone: settings.contactPhone ?? null,
  cityId: settings.cityId ?? null,
  districtId: settings.districtId ?? null,
  descriptionSuffix: settings.descriptionSuffix ?? null,
})

export const olxListingSettingsApi = {
  async get(options: RequestOptions = {}): Promise<OlxListingSettingsView> {
    return normalize(
      (await apiClient.get<SettingsResponse>(base, options)).data,
    )
  },

  async update(
    request: OlxListingSettingsRequest,
    options: RequestOptions = {},
  ): Promise<OlxListingSettingsView> {
    return normalize(
      (await apiClient.put<SettingsResponse>(base, request, options)).data,
    )
  },

  async cities(
    this: void,
    query: string,
    options: RequestOptions = {},
  ): Promise<OlxCity[]> {
    return (
      await apiClient.get<OlxCity[]>(`${base}/cities`, {
        ...options,
        params: { query },
        timeout: 60000,
      })
    ).data
  },

  async city(cityId: number, options: RequestOptions = {}): Promise<OlxCity> {
    return (
      await apiClient.get<OlxCity>(`${base}/cities/${cityId}`, {
        ...options,
        timeout: 60000,
      })
    ).data
  },

  async districts(
    cityId: number,
    options: RequestOptions = {},
  ): Promise<OlxDistrict[]> {
    return (
      await apiClient.get<OlxDistrict[]>(`${base}/cities/${cityId}/districts`, {
        ...options,
        timeout: 60000,
      })
    ).data
  },
}
