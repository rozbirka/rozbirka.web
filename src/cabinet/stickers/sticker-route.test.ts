import { describe, expect, it } from 'vitest'
import { locationStickersHref, parseStickerRoute } from './sticker-route'

describe('sticker routes', () => {
  it('preserves existing part selections and their order', () => {
    expect(
      parseStickerRoute(
        new URLSearchParams('part=part-2&part=part-1&part=part-2'),
      ),
    ).toEqual({
      mode: 'parts',
      collection: null,
      selectAll: false,
      selectedIds: ['part-2', 'part-1', 'part-2'],
      invalid: false,
    })
  })

  it.each([
    [
      'warehouse',
      'warehouse-1',
      '/app/koval/stickers?type=locations&kind=warehouse&parent=warehouse-1&select=all',
    ],
    [
      'zone',
      'warehouse-1',
      '/app/koval/stickers?type=locations&kind=zone&parent=warehouse-1&select=all',
    ],
    [
      'section',
      'zone-1',
      '/app/koval/stickers?type=locations&kind=section&parent=zone-1&select=all',
    ],
    [
      'shelf',
      'section-1',
      '/app/koval/stickers?type=locations&kind=shelf&parent=section-1&select=all',
    ],
  ] as const)(
    'builds the %s collection destination',
    (kind, parentId, expected) => {
      expect(locationStickersHref('koval', { kind, parentId }, 'all')).toBe(
        expected,
      )
      expect(
        parseStickerRoute(new URL(expected, 'https://test.local').searchParams),
      ).toEqual({
        mode: 'locations',
        collection: { kind, parentId },
        selectAll: true,
        selectedIds: [],
        invalid: false,
      })
    },
  )

  it('builds explicit labels with canonical URL encoding and no all-selection', () => {
    expect(
      locationStickersHref('koval', { kind: 'shelf', parentId: 'section-1' }, [
        'shelf-2',
        'shelf-1',
      ]),
    ).toBe(
      '/app/koval/stickers?type=locations&kind=shelf&parent=section-1&label=shelf-2&label=shelf-1',
    )
  })

  it('opens the location selector without requiring a collection', () => {
    expect(parseStickerRoute(new URLSearchParams('type=locations'))).toEqual({
      mode: 'locations',
      collection: null,
      selectAll: false,
      selectedIds: [],
      invalid: false,
    })
  })

  it('gives explicit location parameters priority over parts without accepting URL permissions', () => {
    expect(
      parseStickerRoute(
        new URLSearchParams(
          'type=locations&kind=zone&parent=warehouse-1&label=zone-2&part=part-1&permission=stickers.manage',
        ),
      ),
    ).toEqual({
      mode: 'locations',
      collection: { kind: 'zone', parentId: 'warehouse-1' },
      selectAll: false,
      selectedIds: ['zone-2'],
      invalid: false,
    })
  })

  it.each([
    'type=unknown',
    'type=locations&type=locations',
    'type=parts&type=locations',
    'type=locations&kind=bin&parent=x',
    'type=locations&kind=zone',
    'type=locations&parent=x',
    'type=locations&kind=zone&kind=section&parent=x',
    'type=locations&kind=zone&parent=x&parent=y',
    'type=locations&kind=zone&parent=',
    'type=locations&kind=zone&parent=%20',
    'type=locations&kind=zone&parent=x&select=none',
    'type=locations&kind=zone&parent=x&select=all&select=all',
    'type=locations&kind=zone&parent=x&select=all&label=y',
    'type=locations&kind=zone&parent=x&label=y&label=y',
    'type=locations&kind=zone&parent=x&label=',
    'type=locations&label=x',
    'kind=zone&parent=x&select=all',
    'type=parts&kind=zone&parent=x',
  ])('rejects invalid or conflicting parameters safely: %s', (query) => {
    expect(parseStickerRoute(new URLSearchParams(query))).toMatchObject({
      invalid: true,
      collection: null,
      selectAll: false,
      selectedIds: [],
    })
  })
})
