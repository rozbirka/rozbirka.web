import { describe, expect, it } from 'vitest'
import {
  acknowledgeLabels,
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
      JSON.stringify({ ...queue, target: { ...target, kind: 'warehouse' } }),
    ]) {
      expect(decodeLabelQueue(value, Date.now())).toBeNull()
    }
  })
})
