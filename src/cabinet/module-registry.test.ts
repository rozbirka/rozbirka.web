import { describe, expect, it } from 'vitest'
import { cabinetModules, type CabinetModuleKey } from './module-registry'

describe('integrated cabinet module release registry', () => {
  it.each<CabinetModuleKey>([
    'cars',
    'intakes',
    'parts',
    'warehouses',
    'inventory',
    'stickers',
    'customers',
    'orders',
    'waybills',
    'cash',
    'team',
    'reports',
    'business',
  ])('releases %s through the existing access boundary', (module) => {
    expect(cabinetModules[module].viewPermission).toBeDefined()
  })

  it('gates inventory navigation and management with inventory permissions', () => {
    expect(cabinetModules.inventory).toMatchObject({
      routeSegment: '/inventory',
      viewPermission: 'inventory.view',
      mutationPermission: 'inventory.manage',
      navigation: { label: 'Інвентаризація', group: 'stock' },
    })
  })

  it('puts Nova Poshta waybills under sales behind the orders rights', () => {
    expect(cabinetModules.waybills).toMatchObject({
      routeSegment: '/sales/waybills',
      viewPermission: 'orders.view',
      mutationPermission: 'orders.manage',
      requiresNovaPoshta: true,
      navigation: { label: 'Накладні НП', group: 'sales' },
    })
  })
})
