import { tenantResetRegistry } from '../tenant-reset-registry'
import {
  createPrintQueueStore,
  browserQueueStorage,
  withPrintQueueLock,
  type QueueStorage,
  type PrintQueueExpected,
  type PrintQueueScope,
} from './print-queue-store'
import {
  createPartPrintQueue,
  appendPartPrintQueue,
  acknowledgePartCopies,
  removePartCopies,
  decodePartPrintQueue,
  partPrintQueueKey,
  type PartPrintQueue,
  type PartStickerSelection,
} from './part-print-queue'
export function createPartQueueStore({
  storage,
  now,
  uuid,
}: {
  storage: QueueStorage
  now: () => number
  uuid: () => string
}) {
  const base = createPrintQueueStore<PartPrintQueue>({
    storage,
    now,
    key: (scope) => partPrintQueueKey(scope.userId, scope.tenantId),
    decode: decodePartPrintQueue,
  })
  const matches = (
    queue: PartPrintQueue | null,
    revision: number,
    expected: PrintQueueExpected,
  ) =>
    !!queue && queue.id === expected.queueId && revision === expected.revision
  return {
    ...base,
    isCurrent(expected: PrintQueueExpected) {
      return base.transact(false, (queue, revision) => ({
        queue,
        result: matches(queue, revision, expected),
      }))
    },
    enqueue(items: PartStickerSelection[]) {
      return base.transact(false, (queue) => {
        try {
          return {
            queue: queue
              ? appendPartPrintQueue(queue, items, now(), uuid)
              : createPartPrintQueue(items, now(), uuid),
            result: true,
          }
        } catch {
          return { queue, result: false }
        }
      })
    },
    acknowledge(ids: string[], expected: PrintQueueExpected) {
      return base.transact(false, (queue, revision) => {
        const next = matches(queue, revision, expected)
          ? acknowledgePartCopies(queue!, ids, now())
          : queue
        return { queue: next, result: next !== queue }
      })
    },
    remove(ids: string[], expected: PrintQueueExpected) {
      return base.transact(false, (queue, revision) => {
        const next = matches(queue, revision, expected)
          ? removePartCopies(queue!, ids, now())
          : queue
        return { queue: next, result: next !== queue }
      })
    },
    discard(expected: PrintQueueExpected) {
      return base.transact(false, (queue, revision) => {
        const valid = matches(queue, revision, expected)
        return { queue: valid ? null : queue, result: valid }
      })
    },
  }
}
export const withPartQueueLock = <T>(
  scope: PrintQueueScope,
  operation: () => T | Promise<T>,
) => withPrintQueueLock('rozbirka.part-labels.lock.v2', scope, operation)
export const partQueueStore = createPartQueueStore({
  storage: browserQueueStorage,
  now: () => Date.now(),
  uuid: () => crypto.randomUUID(),
})
tenantResetRegistry.register((scope) => {
  partQueueStore.clear(scope)
  try {
    localStorage.removeItem(
      `rozbirka.stickers.queue.v1:${scope.userId}:${scope.tenantId}`,
    )
  } catch {
    /* Active memory state is cleared independently. */
  }
})
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) =>
    partQueueStore.handleStorageEvent(event),
  )
