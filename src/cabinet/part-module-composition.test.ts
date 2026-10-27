import { expect, it } from 'vitest'
import { defineFeatureModules } from './module-registry'
import { resolvePartModuleSummary } from './part-module-composition'

const entries = defineFeatureModules([
  {
    code: 'demo',
    labelKey: 'demo.title',
    parentModule: 'parts',
    loadScreen: () => Promise.resolve({ default: () => null }),
  },
])

it('treats unknown module codes as unsupported without building a server-selected destination', () => {
  expect(
    resolvePartModuleSummary(
      'shop',
      {
        moduleCode: 'https://other.example',
        availability: 'ready',
        items: [],
      },
      entries,
    ),
  ).toEqual({ kind: 'unsupported', moduleCode: 'https://other.example' })
})

it('preserves module unavailability and links ready cards by their module-owned IDs', () => {
  expect(
    resolvePartModuleSummary(
      'shop',
      {
        moduleCode: 'demo',
        availability: 'unavailable',
        items: [],
        retryAfterSeconds: 5,
      },
      entries,
    ),
  ).toEqual({ kind: 'unavailable', moduleCode: 'demo', retryAfterSeconds: 5 })
  expect(
    resolvePartModuleSummary(
      'shop',
      {
        moduleCode: 'demo',
        availability: 'ready',
        items: [
          {
            id: '10000000-0000-0000-0000-000000000001',
            rozbirkaPartId: '20000000-0000-0000-0000-000000000002',
            version: '9007199254740993',
          },
        ],
      },
      entries,
    ),
  ).toMatchObject({
    kind: 'ready',
    cards: [
      {
        version: '9007199254740993',
        href: '/app/shop/modules/demo/parts/10000000-0000-0000-0000-000000000001',
      },
    ],
  })
})
