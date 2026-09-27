import { apiClient } from './client'
import type { RequestOptions } from './contracts'

/**
 * The yard's own equipment catalogue. Nothing picks from it directly — the
 * part form offers the same vehicle list the car form does — but compatibility
 * is stored against these identifiers, so a chosen name has to be looked up
 * here before it can be saved.
 */
export interface EquipmentType {
  id: string
  code: string
  name: string
}

export interface EquipmentMake {
  id: string
  equipmentTypeId: string
  name: string
}

export interface EquipmentModel {
  id: string
  makeId: string
  name: string
}

const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

export const equipmentApi = {
  async types(options: RequestOptions = {}): Promise<EquipmentType[]> {
    return (
      await apiClient.get<EquipmentType[]>(
        '/equipment-types',
        requestConfig(options),
      )
    ).data
  },
  async makes(
    equipmentTypeId: string,
    query?: string,
    options: RequestOptions = {},
  ): Promise<EquipmentMake[]> {
    return (
      await apiClient.get<EquipmentMake[]>('/equipment-makes', {
        params: {
          equipment_type_id: equipmentTypeId,
          ...(query ? { q: query } : {}),
        },
        ...requestConfig(options),
      })
    ).data
  },
  async models(
    makeId: string,
    query?: string,
    options: RequestOptions = {},
  ): Promise<EquipmentModel[]> {
    return (
      await apiClient.get<EquipmentModel[]>('/equipment-models', {
        params: { make_id: makeId, ...(query ? { q: query } : {}) },
        ...requestConfig(options),
      })
    ).data
  },
}
