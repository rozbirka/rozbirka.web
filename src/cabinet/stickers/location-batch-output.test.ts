import { expect, it } from 'vitest'
import { resolveLocationBatch } from './location-batch-output'
import { createLabelQueue } from '../inventory/location-label-queue'

const target = {
  kind: 'shelf' as const,
  parentId: 's',
  parentName: 'Shelf parent',
}
const label = (id: string) => ({
  id,
  qrCode: `raw:${id}`,
  zoneName: id,
  zoneCode: id,
  warehouseName: 'Warehouse',
  kind: 'shelf' as const,
})

it('resolves exactly the first twenty current labels in queue order', () => {
  const ids = Array.from({ length: 25 }, (_, i) => String(i))
  const queue = createLabelQueue(target, ids)
  const fresh = ids.toReversed().map(label)
  expect(resolveLocationBatch(queue, fresh).map((x) => x.qrCode)).toEqual(
    Array.from({ length: 20 }, (_, i) => `raw:${i}`),
  )
})

it('rejects a missing or invalid QR instead of silently skipping queued labels', () => {
  const queue = createLabelQueue(target, ['a', 'b'])
  expect(() => resolveLocationBatch(queue, [label('a')])).toThrow()
  expect(() =>
    resolveLocationBatch(queue, [label('a'), { ...label('b'), qrCode: ' ' }]),
  ).toThrow()
  expect(() =>
    resolveLocationBatch(queue, [label('a'), { ...label('b'), kind: 'zone' }]),
  ).toThrow()
})

it('prints a mixed warehouse batch while rejecting warehouse labels themselves', () => {
  const queue = createLabelQueue(
    { kind: 'warehouse', parentId: 'w', parentName: 'Warehouse' },
    ['z', 's', 'p'],
  )
  const labels = [
    { ...label('z'), kind: 'zone' as const },
    { ...label('s'), kind: 'section' as const },
    label('p'),
  ]
  expect(resolveLocationBatch(queue, labels).map((x) => x.id)).toEqual([
    'z',
    's',
    'p',
  ])
  expect(() =>
    resolveLocationBatch(queue, [
      { ...labels[0]!, kind: 'warehouse' },
      ...labels.slice(1),
    ]),
  ).toThrow()
})
