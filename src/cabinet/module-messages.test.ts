import { describe, expect, it } from 'vitest'
import { moduleLabel, navigationGroupLabel } from './module-messages'
import { cabinetModules, type CabinetModuleKey } from './module-registry'

describe('module labels', () => {
  it('keep the Ukrainian registry names as the source', () => {
    for (const key of Object.keys(cabinetModules) as CabinetModuleKey[]) {
      expect(moduleLabel(key, 'uk')).toBe(cabinetModules[key].navigation?.label)
    }
  })

  it('translate module names and sidebar groups', () => {
    expect(moduleLabel('parts', 'en-GB')).toBe('Parts')
    expect(moduleLabel('business', 'pl')).toBe('Firma')
    expect(navigationGroupLabel('stock', 'en-GB')).toBe('Stock')
    expect(navigationGroupLabel('overview', 'pl')).toBeNull()
  })
})
