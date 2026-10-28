import { describe, expect, it } from 'vitest'
import {
  acknowledgeLabels,
  appendLabelQueue,
  removeQueueLabels,
  createLabelQueue,
  decodeLabelQueue,
  removeQueueLabel,
  nextLabelBatch,
} from './location-label-queue'

const target = { kind: 'section' as const, parentId: 'z', parentName: 'Zone A' }
const ids = Array.from({ length: 25 }, (_, i) => String(i))
describe('location label queue', () => {
  it('deduplicates selections and prints batches of twenty', () => {
    const queue = createLabelQueue(target, [...ids, '0'])
    expect(queue.remainingIds).toEqual(ids)
    expect(queue.totalCount).toBe(25)
    expect(nextLabelBatch(queue)).toEqual(ids.slice(0, 20))
    expect(() =>
      createLabelQueue(
        target,
        Array.from({ length: 201 }, (_, i) => String(i)),
      ),
    ).toThrow()
  })
  it('acknowledges only confirmed labels and resumes the rest, including non-prefix partial results', () => {
    const queue = createLabelQueue(target, ids)
    const next = acknowledgeLabels(queue, ['0', '2', '2', 'unknown'])!
    expect(next.printedCount).toBe(2)
    expect(next.totalCount).toBe(25)
    expect(nextLabelBatch(next)[0]).toBe('1')
    expect(next.remainingIds).not.toContain('2')
    expect(acknowledgeLabels(next, next.remainingIds)).toBeNull()
  })
  it('removes a remaining label without counting it as printed', () => {
    const queue = acknowledgeLabels(createLabelQueue(target, ['a', 'b', 'c']), [
      'a',
    ])!
    const next = removeQueueLabel(queue, 'b')!
    expect(next).toMatchObject({
      remainingIds: ['c'],
      totalCount: 2,
      printedCount: 1,
    })
    expect(removeQueueLabel(next, 'missing')).toEqual(next)
    expect(removeQueueLabel(next, 'c')).toBeNull()
  })
  it('rejects expired, malformed, inconsistent and duplicate stored queues', () => {
    const queue = createLabelQueue(target, ids)
    expect(decodeLabelQueue(JSON.stringify(queue), Date.now())).toEqual(queue)
    expect(decodeLabelQueue(JSON.stringify(queue), queue.expiresAt)).toBeNull()
    for (const value of [
      '{',
      'null',
      JSON.stringify({ ...queue, printedCount: 99 }),
      JSON.stringify({ ...queue, remainingIds: ['x', 'x'] }),
      JSON.stringify({ ...queue, target: { ...target, kind: 'unknown' } }),
    ]) {
      expect(decodeLabelQueue(value, Date.now())).toBeNull()
    }
  })
})

describe('location queue mutations', () => {
  it('appends new ids in stable order, preserves no-op identity and enforces the remaining limit atomically', () => {
    const queue = createLabelQueue(target, ['a', 'b'], 100)
    expect(
      appendLabelQueue(queue, target, ['b', 'c', 'c', 'd'], 200),
    ).toMatchObject({
      ok: true,
      addedCount: 2,
      queue: {
        remainingIds: ['a', 'b', 'c', 'd'],
        totalCount: 4,
        expiresAt: 86400200,
      },
    })
    expect(appendLabelQueue(queue, target, ['a'], 200)).toEqual({
      ok: true,
      queue,
      addedCount: 0,
    })
    expect(
      appendLabelQueue(
        queue,
        target,
        Array.from({ length: 199 }, (_, i) => `new-${i}`),
        200,
      ),
    ).toEqual({ ok: false, reason: 'limit' })
    expect(queue.remainingIds).toEqual(['a', 'b'])
    expect(
      appendLabelQueue(queue, { ...target, parentId: 'other' }, ['c'], 200),
    ).toEqual({ ok: false, reason: 'target-mismatch' })
  })
  it('allows total progress above 200 when no more than 200 remain', () => {
    const queue = createLabelQueue(
      target,
      Array.from({ length: 200 }, (_, i) => `id-${i}`),
      100,
    )
    const afterPrint = acknowledgeLabels(
      queue,
      queue.remainingIds.slice(0, 20),
      200,
    )!
    const result = appendLabelQueue(
      afterPrint,
      target,
      Array.from({ length: 20 }, (_, i) => `new-${i}`),
      300,
    )
    expect(result).toMatchObject({
      ok: true,
      addedCount: 20,
      queue: { totalCount: 220, printedCount: 20 },
    })
  })
  it('renews TTL only for real removals and acknowledgements and removes only the supplied ids', () => {
    const queue = createLabelQueue(target, ['a', 'b', 'c'], 100)
    expect(acknowledgeLabels(queue, ['missing'], 200)).toBe(queue)
    expect(removeQueueLabels(queue, ['missing'], 200)).toBe(queue)
    const afterPrint = acknowledgeLabels(queue, ['a', 'c', 'a'], 200)!
    expect(afterPrint).toMatchObject({
      remainingIds: ['b'],
      printedCount: 2,
      totalCount: 3,
      expiresAt: 86400200,
    })
    expect(acknowledgeLabels(afterPrint, ['a', 'c'], 300)).toBe(afterPrint)
    expect(removeQueueLabels(afterPrint, ['b'], 300)).toBeNull()
    expect(removeQueueLabels(queue, ['a', 'c'], 200)).toMatchObject({
      remainingIds: ['b'],
      printedCount: 0,
      totalCount: 1,
      expiresAt: 86400200,
    })
  })
  it('rejects invalid targets and ids', () => {
    expect(() => createLabelQueue(target, [''], 100)).toThrow()
    const queue = createLabelQueue(target, ['a'], 100)
    expect(appendLabelQueue(queue, target, [''], 200)).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })
})
