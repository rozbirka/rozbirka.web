import { describe, expect, it } from 'vitest'
import { defineFeatureModules } from './module-registry'
import { moduleFeaturePath } from './cabinet-paths'

const feature = {
  code: 'demo',
  labelKey: 'demo.title',
  parentModule: 'parts' as const,
  loadScreen: () => Promise.resolve({ default: () => null }),
}
const cardId = '10000000-0000-0000-0000-000000000001'

describe('independent modules in the cabinet registry', () => {
  it('rejects duplicate and unsafe module routes', () => {
    expect(() => defineFeatureModules([feature, feature])).toThrow()
    expect(() =>
      defineFeatureModules([{ ...feature, code: '../outside' }]),
    ).toThrow()
  })

  it('builds tenant-scoped routes using the module card ID', () => {
    const entry = defineFeatureModules([feature])[0]!
    expect(
      moduleFeaturePath('demo-shop', entry, { kind: 'view', id: cardId }),
    ).toBe(
      '/app/demo-shop/modules/demo/parts/10000000-0000-0000-0000-000000000001',
    )
    expect(
      moduleFeaturePath('demo-shop', entry, { kind: 'create', partId: cardId }),
    ).toBe(
      '/app/demo-shop/modules/demo/parts/new?partId=10000000-0000-0000-0000-000000000001',
    )
    expect(() =>
      moduleFeaturePath('../other', entry, { kind: 'list' }),
    ).toThrow()
    expect(() =>
      moduleFeaturePath('demo-shop', entry, { kind: 'view', id: '../outside' }),
    ).toThrow()
  })
})
