import { expect, it } from 'vitest'
import {
  createPartPrintQueue,
  appendPartPrintQueue,
  acknowledgePartCopies,
  removePartCopies,
  decodePartPrintQueue,
  nextPartBatch,
} from './part-print-queue'
let sequence = 0
const uuid = () => `id-${++sequence}`
const selection = (id: string, quantity: number) => ({ id, quantity, name: id })
it('batches physical copies, splitting one part across batches and acknowledging arbitrary copies', () => {
  const queue = createPartPrintQueue(
    [selection('a', 23), selection('b', 2)],
    100,
    uuid,
  )
  expect(queue.remaining).toHaveLength(25)
  expect(new Set(queue.remaining.map((x) => x.id)).size).toBe(25)
  expect(nextPartBatch(queue).map((x) => x.partId)).toEqual(Array(20).fill('a'))
  const confirmed = nextPartBatch(queue)
    .filter((_, i) => i % 3 === 0)
    .map((x) => x.id)
  const next = acknowledgePartCopies(queue, confirmed, 200)!
  expect(next).toMatchObject({ printedCount: 7, totalCount: 25 })
  expect(next.remaining).toHaveLength(18)
  expect(next.remaining.filter((x) => x.partId === 'a')).toHaveLength(16)
  expect(decodePartPrintQueue(JSON.stringify(next), 201)).toEqual(next)
  expect(
    acknowledgePartCopies(
      next,
      next.remaining.map((x) => x.id),
    ),
  ).toBeNull()
})
it('appends copies within the pending limit and removes without counting them printed', () => {
  const queue = createPartPrintQueue([selection('a', 200)], 100, uuid)
  expect(() =>
    appendPartPrintQueue(queue, [selection('b', 1)], 200, uuid),
  ).toThrow()
  const partial = acknowledgePartCopies(
    queue,
    nextPartBatch(queue).map((x) => x.id),
    200,
  )!
  const appended = appendPartPrintQueue(
    partial,
    [selection('a', 20)],
    300,
    uuid,
  )
  expect(appended).toMatchObject({ totalCount: 220, printedCount: 20 })
  expect(new Set(appended.remaining.map((x) => x.id)).size).toBe(200)
  const removed = removePartCopies(
    appended,
    appended.remaining.slice(0, 3).map((x) => x.id),
    400,
  )!
  expect(removed).toMatchObject({ totalCount: 217, printedCount: 20 })
  expect(removed.remaining).toHaveLength(197)
  expect(removePartCopies(removed, ['missing'])).toBe(removed)
})
it('rejects bad quantities, duplicate IDs, expired or inconsistent saved queues', () => {
  for (const quantity of [0, -1, 1.5, 201, Infinity])
    expect(() =>
      createPartPrintQueue([selection('a', quantity)], 100, uuid),
    ).toThrow()
  expect(() =>
    createPartPrintQueue([selection('a', 1), selection('a', 1)], 100, uuid),
  ).toThrow()
  const queue = createPartPrintQueue([selection('a', 2)], 100, uuid)
  expect(
    decodePartPrintQueue(JSON.stringify(queue), queue.expiresAt),
  ).toBeNull()
  expect(
    decodePartPrintQueue(JSON.stringify({ ...queue, printedCount: 4 }), 100),
  ).toBeNull()
  expect(
    decodePartPrintQueue(
      JSON.stringify({
        ...queue,
        remaining: [queue.remaining[0], queue.remaining[0]],
      }),
      100,
    ),
  ).toBeNull()
})
