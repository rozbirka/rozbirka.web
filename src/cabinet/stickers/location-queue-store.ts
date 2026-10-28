import {
  acknowledgeLabels,
  appendLabelQueue,
  createLabelQueue,
  decodeLabelQueue,
  labelQueueKey,
  MAX_LOCATION_LABELS,
  removeQueueLabels,
  type LocationLabelQueue,
  type LocationLabelTarget,
  type QueueMutationResult,
} from '../inventory/location-label-queue'
import { tenantResetRegistry } from '../tenant-reset-registry'

import {
  createPrintQueueStore,
  browserQueueStorage,
  samePrintQueueScope,
  withPrintQueueLock,
  type PrintQueueScope,
  type PrintQueueExpected,
  type PrintQueueSnapshot,
  type QueueStorage,
} from './print-queue-store'

export type LocationQueueScope = PrintQueueScope
export type LocationQueueExpected = PrintQueueExpected
export type LocationQueueSnapshot = PrintQueueSnapshot<LocationLabelQueue>
export const sameLocationQueueScope = samePrintQueueScope

export function createLocationQueueStore({
  storage,
  now,
  uuid,
}: {
  storage: QueueStorage
  now: () => number
  uuid: () => string
}) {
  const base = createPrintQueueStore<LocationLabelQueue>({
    storage,
    now,
    key: (scope) => labelQueueKey(scope.userId, scope.tenantId),
    legacyKeys: (scope) => [
      `rozbirka.location-labels.queue.v1:${scope.userId}:${scope.tenantId}`,
    ],
    decode: decodeLabelQueue,
  })
  const expectedMatches = (
    queue: LocationLabelQueue | null,
    revision: number,
    expected: LocationQueueExpected,
  ) =>
    !!queue && queue.id === expected.queueId && revision === expected.revision
  return {
    ...base,
    start(target: LocationLabelTarget, ids: string[]): QueueMutationResult {
      return base.transact<QueueMutationResult>(
        { ok: false, reason: 'invalid' },
        (current) => {
          const reject = (
            reason: 'active-queue' | 'invalid' | 'empty' | 'limit',
          ) => ({ queue: current, result: { ok: false as const, reason } })
          if (current) return reject('active-queue')
          if (
            !Array.isArray(ids) ||
            ids.some((id) => typeof id !== 'string' || !id.trim())
          )
            return reject('invalid')
          if (!ids.length) return reject('empty')
          if (new Set(ids).size > MAX_LOCATION_LABELS) return reject('limit')
          try {
            const queue = createLabelQueue(target, ids, now(), uuid)
            return {
              queue,
              result: {
                ok: true,
                queue,
                addedCount: queue.remainingIds.length,
              },
            }
          } catch {
            return reject('invalid')
          }
        },
      )
    },
    append(target: LocationLabelTarget, ids: string[]): QueueMutationResult {
      return base.transact<QueueMutationResult>(
        { ok: false, reason: 'invalid' },
        (queue) => {
          if (!queue) return { queue, result: { ok: false, reason: 'invalid' } }
          const result = appendLabelQueue(queue, target, ids, now())
          return { queue: result.ok ? result.queue : queue, result }
        },
      )
    },
    retarget(target: LocationLabelTarget, expected: LocationQueueExpected) {
      return base.transact(false, (queue, revision) => {
        const valid =
          expectedMatches(queue, revision, expected) &&
          target.kind === 'warehouse' &&
          !!target.parentId.trim() &&
          queue!.target.kind !== 'warehouse'
        return { queue: valid ? { ...queue!, target } : queue, result: valid }
      })
    },
    acknowledge(ids: string[], expected: LocationQueueExpected) {
      return base.transact(false, (queue, revision) => {
        const next = expectedMatches(queue, revision, expected)
          ? acknowledgeLabels(queue!, ids, now())
          : queue
        return { queue: next, result: next !== queue }
      })
    },
    remove(ids: string[], expected: LocationQueueExpected) {
      return base.transact(false, (queue, revision) => {
        const next = expectedMatches(queue, revision, expected)
          ? removeQueueLabels(queue!, ids, now())
          : queue
        return { queue: next, result: next !== queue }
      })
    },
    discard(expected: LocationQueueExpected) {
      return base.transact(false, (queue, revision) => {
        const valid = expectedMatches(queue, revision, expected)
        return { queue: valid ? null : queue, result: valid }
      })
    },
  }
}
export const withLocationQueueLock = <T>(
  scope: LocationQueueScope,
  operation: () => T | Promise<T>,
) => withPrintQueueLock('rozbirka.location-labels.lock.v2', scope, operation)
export const locationQueueStore = createLocationQueueStore({
  storage: browserQueueStorage,
  now: () => Date.now(),
  uuid: () => crypto.randomUUID(),
})
tenantResetRegistry.register((scope) => locationQueueStore.clear(scope))
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) =>
    locationQueueStore.handleStorageEvent(event),
  )
