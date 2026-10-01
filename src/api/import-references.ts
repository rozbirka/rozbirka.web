import { apiClient } from './client'
import { carsApi } from './cars'
import { intakesApi } from './intakes'
import { customersApi } from './customers'
import { inventoryApi } from './inventory'
import type { RequestOptions } from './contracts'
export interface ImportReference {
  id: string
  name: string
}
export async function importReferences(
  field: string,
  search: string,
  options: RequestOptions,
): Promise<ImportReference[]> {
  if (field === 'CarId')
    return (
      await carsApi.list({ search, page: 1, pageSize: 100 }, options)
    ).items.map((c) => ({
      id: c.id,
      name: `${c.code} · ${c.brand} ${c.model}`,
    }))
  if (field === 'IntakeId')
    return (
      await intakesApi.list({ search, page: 1, pageSize: 100 }, options)
    ).items.map((c) => ({ id: c.id, name: c.name ?? c.supplier ?? 'Партія' }))
  if (field === 'CustomerId')
    return (
      await customersApi.list({ q: search, page: 1, pageSize: 100 }, options)
    ).items.map((c) => ({ id: c.id, name: c.name }))
  if (field === 'InventoryZoneId')
    return (await inventoryApi.getZones({ ...options, activeOnly: true }))
      .filter((c) =>
        c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      )
      .map((c) => ({ id: c.id, name: c.name }))
  const endpoints: Record<string, string> = {
    EquipmentTypeId: '/equipment-types',
    MakeId: '/equipment-makes',
    ModelId: '/equipment-models',
    GenerationId: '/equipment-generations',
  }
  const endpoint = endpoints[field]
  if (!endpoint) return []
  return (
    await apiClient.get<ImportReference[]>(endpoint, {
      ...options,
      params: { q: search },
    })
  ).data.filter((item) =>
    item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  )
}
