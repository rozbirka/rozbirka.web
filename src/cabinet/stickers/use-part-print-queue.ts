import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { PartStickerSelection } from './part-print-queue'
import {
  samePrintQueueScope,
  type PrintQueueExpected,
  type PrintQueueScope,
} from './print-queue-store'
import { partQueueStore } from './part-queue-store'

export function usePartPrintQueue(scope: PrintQueueScope | null) {
  const userId = scope?.userId
  const tenantId = scope?.tenantId
  const owner = useMemo(
    () => (userId && tenantId ? { userId, tenantId } : null),
    [userId, tenantId],
  )
  const activeOwner = useRef<PrintQueueScope | null>(null)
  const snapshot = useSyncExternalStore(
    partQueueStore.subscribe,
    partQueueStore.getSnapshot,
    partQueueStore.getSnapshot,
  )
  useLayoutEffect(() => {
    activeOwner.current = owner
    if (owner) partQueueStore.hydrate(owner)
    return () => {
      activeOwner.current = null
    }
  }, [owner])
  const operations = useMemo(() => {
    const active = () =>
      !!owner &&
      activeOwner.current === owner &&
      samePrintQueueScope(owner, partQueueStore.getSnapshot().scope)
    return {
      enqueue: (items: PartStickerSelection[]) =>
        active() && partQueueStore.enqueue(items),
      acknowledge: (ids: string[], expected: PrintQueueExpected) =>
        active() && partQueueStore.acknowledge(ids, expected),
      remove: (ids: string[], expected: PrintQueueExpected) =>
        active() && partQueueStore.remove(ids, expected),
      discard: (expected: PrintQueueExpected) =>
        active() && partQueueStore.discard(expected),
      clear: () => {
        if (active()) partQueueStore.clear(owner)
      },
    }
  }, [owner])
  const matches = !!owner && samePrintQueueScope(owner, snapshot.scope)
  return {
    ...snapshot,
    scope: owner,
    queue: matches ? snapshot.queue : null,
    persistenceError: matches && snapshot.persistenceError,
    ...operations,
  }
}
