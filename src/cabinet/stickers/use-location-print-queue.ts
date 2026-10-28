import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type {
  LocationLabelTarget,
  QueueMutationResult,
} from '../inventory/location-label-queue'
import {
  locationQueueStore,
  sameLocationQueueScope,
  type LocationQueueExpected,
  type LocationQueueScope,
} from './location-queue-store'

export function useLocationPrintQueue(scope: LocationQueueScope | null) {
  const userId = scope?.userId
  const tenantId = scope?.tenantId
  const owner = useMemo(
    () => (userId && tenantId ? { userId, tenantId } : null),
    [userId, tenantId],
  )
  const activeOwner = useRef<LocationQueueScope | null>(null)
  const snapshot = useSyncExternalStore(
    locationQueueStore.subscribe,
    locationQueueStore.getSnapshot,
    locationQueueStore.getSnapshot,
  )
  useLayoutEffect(() => {
    activeOwner.current = owner
    if (owner) locationQueueStore.hydrate(owner)
    return () => {
      activeOwner.current = null
    }
  }, [owner])
  const operations = useMemo(() => {
    const active = () =>
      !!owner &&
      activeOwner.current === owner &&
      sameLocationQueueScope(owner, locationQueueStore.getSnapshot().scope)
    const invalid: QueueMutationResult = { ok: false, reason: 'invalid' }
    return {
      start: (target: LocationLabelTarget, ids: string[]) =>
        active() ? locationQueueStore.start(target, ids) : invalid,
      append: (target: LocationLabelTarget, ids: string[]) =>
        active() ? locationQueueStore.append(target, ids) : invalid,
      acknowledge: (ids: string[], expected: LocationQueueExpected) =>
        active() && locationQueueStore.acknowledge(ids, expected),
      remove: (ids: string[], expected: LocationQueueExpected) =>
        active() && locationQueueStore.remove(ids, expected),
      discard: (expected: LocationQueueExpected) =>
        active() && locationQueueStore.discard(expected),
      clear: () => {
        if (active()) locationQueueStore.clear(owner)
      },
    }
  }, [owner])
  const matches = !!owner && sameLocationQueueScope(owner, snapshot.scope)
  return {
    ...snapshot,
    scope: owner,
    queue: matches ? snapshot.queue : null,
    persistenceError: matches && snapshot.persistenceError,
    ...operations,
  }
}
