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
import {
  tenantResetRegistry,
  type TenantResetScope,
} from '../tenant-reset-registry'

export type LocationQueueScope = TenantResetScope
export interface LocationQueueExpected {
  queueId: string
  revision: number
}
export interface LocationQueueSnapshot {
  queue: LocationLabelQueue | null
  scope: LocationQueueScope | null
  revision: number
  persistenceError: boolean
}
type QueueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
interface LocationQueueDependencies {
  storage: QueueStorage
  now: () => number
  uuid: () => string
}
export const sameLocationQueueScope = (
  a: LocationQueueScope | null,
  b: LocationQueueScope | null,
) =>
  a === b || (!!a && !!b && a.userId === b.userId && a.tenantId === b.tenantId)
const legacyKey = (scope: LocationQueueScope) =>
  `rozbirka.location-labels.queue.v1:${scope.userId}:${scope.tenantId}`
const scopeKey = (scope: LocationQueueScope) =>
  labelQueueKey(scope.userId, scope.tenantId)

export function createLocationQueueStore({
  storage,
  now,
  uuid,
}: LocationQueueDependencies) {
  let snapshot: LocationQueueSnapshot = {
    queue: null,
    scope: null,
    revision: 0,
    persistenceError: false,
  }
  const listeners = new Set<() => void>()
  const clearedScopes = new Set<string>()
  let generation = 0
  let pendingScope: LocationQueueScope | null = null
  const observedStorage = new Map<string, string | null>()
  let mutationReadFailed = false
  const emit = (
    queue: LocationLabelQueue | null,
    scope: LocationQueueScope | null,
    persistenceError: boolean,
  ) => {
    snapshot = {
      queue,
      scope,
      revision: snapshot.revision + 1,
      persistenceError,
    }
    for (const listener of listeners) listener()
  }
  const removeStored = (scope: LocationQueueScope) => {
    let failed = false
    for (const key of [scopeKey(scope), legacyKey(scope)]) {
      if (key === scopeKey(scope) && !observedStorage.has(key)) {
        try {
          observedStorage.set(key, storage.getItem(key))
        } catch {
          /* Removal can still succeed independently of reads. */
        }
      }
      try {
        storage.removeItem(key)
        if (key === scopeKey(scope)) observedStorage.set(key, null)
      } catch {
        failed = true
      }
    }
    return failed
  }
  const persist = (
    scope: LocationQueueScope,
    queue: LocationLabelQueue | null,
  ) => {
    try {
      const raw = queue
        ? JSON.stringify({ version: 2, owner: scope, queue })
        : null
      if (raw !== null) storage.setItem(scopeKey(scope), raw)
      else storage.removeItem(scopeKey(scope))
      observedStorage.set(scopeKey(scope), raw)
      return false
    } catch {
      return true
    }
  }
  const read = (scope: LocationQueueScope) => {
    let persistenceError = false
    let queue: LocationLabelQueue | null = null
    let raw: string | null | undefined
    try {
      storage.removeItem(legacyKey(scope))
    } catch {
      persistenceError = true
    }
    try {
      raw = storage.getItem(scopeKey(scope))
      if (raw !== null) {
        try {
          const value = JSON.parse(raw) as {
            version?: unknown
            owner?: { userId?: unknown; tenantId?: unknown }
            queue?: unknown
          } | null
          if (
            value?.version === 2 &&
            value.owner?.userId === scope.userId &&
            value.owner?.tenantId === scope.tenantId
          ) {
            queue = decodeLabelQueue(JSON.stringify(value.queue), now())
          }
        } catch {
          /* Invalid envelopes are removed below. */
        }
        if (!queue) {
          try {
            storage.removeItem(scopeKey(scope))
            raw = null
          } catch {
            persistenceError = true
          }
        }
      }
    } catch {
      persistenceError = true
    }
    return { queue, persistenceError, raw }
  }
  const hydrate = (scope: LocationQueueScope) => {
    if (!scope.userId || !scope.tenantId) return
    if (sameLocationQueueScope(snapshot.scope, scope)) {
      if (
        snapshot.queue &&
        snapshot.queue.expiresAt <= now() &&
        prepareMutation()
      ) {
        emit(null, snapshot.scope, persist(scope, null) || mutationReadFailed)
      }
      return
    }
    const hydration = ++generation
    pendingScope = scope
    const loaded = clearedScopes.has(scopeKey(scope))
      ? {
          queue: null,
          persistenceError: false,
          raw: observedStorage.get(scopeKey(scope)),
        }
      : read(scope)
    if (pendingScope === scope) pendingScope = null
    if (generation !== hydration) return
    if (loaded.raw !== undefined)
      observedStorage.set(scopeKey(scope), loaded.raw)
    emit(loaded.queue, { ...scope }, loaded.persistenceError)
  }
  // Storage events arrive later than the underlying write. Check the last
  // observed envelope before each mutation so a stale tab cannot overwrite it.
  const prepareMutation = () => {
    mutationReadFailed = false
    const scope = snapshot.scope
    if (!scope) return false
    const key = scopeKey(scope)
    let raw: string | null
    try {
      raw = storage.getItem(key)
    } catch {
      mutationReadFailed = true
      return true
    }
    const observed = observedStorage.get(key)
    if (raw === observed) return true
    if (observed === undefined && (raw === null || clearedScopes.has(key))) {
      observedStorage.set(key, raw)
      return true
    }
    const loaded = read(scope)
    if (loaded.raw !== undefined) observedStorage.set(key, loaded.raw)
    emit(
      loaded.raw === undefined ? snapshot.queue : loaded.queue,
      scope,
      loaded.persistenceError,
    )
    return false
  }
  const mutate = (queue: LocationLabelQueue | null) => {
    if (!snapshot.scope || queue === snapshot.queue) return false
    const scope = snapshot.scope
    clearedScopes.delete(scopeKey(scope))
    const persistenceError = persist(scope, queue) || mutationReadFailed
    emit(queue, scope, persistenceError)
    return true
  }
  const current = (expected: LocationQueueExpected) =>
    !!snapshot.scope &&
    !!snapshot.queue &&
    snapshot.queue.id === expected.queueId &&
    snapshot.revision === expected.revision
  const store = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    hydrate,
    start(target: LocationLabelTarget, ids: string[]): QueueMutationResult {
      if (!prepareMutation()) return { ok: false, reason: 'invalid' }
      if (snapshot.queue) return { ok: false, reason: 'active-queue' }
      if (
        !Array.isArray(ids) ||
        ids.some((id) => typeof id !== 'string' || !id.trim())
      )
        return { ok: false, reason: 'invalid' }
      if (!ids.length) return { ok: false, reason: 'empty' }
      if (new Set(ids).size > MAX_LOCATION_LABELS)
        return { ok: false, reason: 'limit' }
      try {
        const queue = createLabelQueue(target, ids, now(), uuid)
        mutate(queue)
        return { ok: true, queue, addedCount: queue.remainingIds.length }
      } catch {
        return { ok: false, reason: 'invalid' }
      }
    },
    append(target: LocationLabelTarget, ids: string[]): QueueMutationResult {
      if (!prepareMutation() || !snapshot.queue)
        return { ok: false, reason: 'invalid' }
      const result = appendLabelQueue(snapshot.queue, target, ids, now())
      if (result.ok) mutate(result.queue)
      return result
    },
    retarget(target: LocationLabelTarget, expected: LocationQueueExpected) {
      if (
        !prepareMutation() ||
        !current(expected) ||
        target.kind !== 'warehouse' ||
        !target.parentId.trim()
      )
        return false
      if (snapshot.queue!.target.kind === 'warehouse') return false
      return mutate({ ...snapshot.queue!, target })
    },
    acknowledge(ids: string[], expected: LocationQueueExpected) {
      if (!prepareMutation() || !current(expected)) return false
      return mutate(acknowledgeLabels(snapshot.queue!, ids, now()))
    },
    remove(ids: string[], expected: LocationQueueExpected) {
      if (!prepareMutation() || !current(expected)) return false
      return mutate(removeQueueLabels(snapshot.queue!, ids, now()))
    },
    discard(expected: LocationQueueExpected) {
      if (!prepareMutation() || !current(expected)) return false
      return mutate(null)
    },
    clear(scope: LocationQueueScope | null = snapshot.scope) {
      if (!scope) return
      clearedScopes.add(scopeKey(scope))
      const matches = sameLocationQueueScope(snapshot.scope, scope)
      if (matches || sameLocationQueueScope(pendingScope, scope)) generation++
      const persistenceError = removeStored(scope)
      if (matches) emit(null, null, persistenceError)
    },
    handleStorageEvent(event: Pick<StorageEvent, 'key'>) {
      const scope = snapshot.scope
      if (!scope || (event.key !== null && event.key !== scopeKey(scope)))
        return
      if (clearedScopes.has(scopeKey(scope))) return
      const hydration = ++generation
      const loaded = read(scope)
      if (generation !== hydration) return
      if (loaded.raw === undefined) {
        if (!snapshot.persistenceError) emit(snapshot.queue, scope, true)
        return
      }
      observedStorage.set(scopeKey(scope), loaded.raw)
      if (
        JSON.stringify(loaded.queue) !== JSON.stringify(snapshot.queue) ||
        loaded.persistenceError !== snapshot.persistenceError
      ) {
        emit(loaded.queue, scope, loaded.persistenceError)
      }
    },
  }
  return store
}

/** Serialize cooperative cross-tab mutations; stores still check observed storage
 * when Web Locks are unavailable or a storage event has not arrived yet. */
export async function withLocationQueueLock<T>(
  scope: LocationQueueScope,
  operation: () => T | Promise<T>,
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    const key = `rozbirka.location-labels.lock.v2:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.tenantId)}`
    return navigator.locks.request(key, operation)
  }
  return operation()
}

const browserStorage: QueueStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}
export const locationQueueStore = createLocationQueueStore({
  storage: browserStorage,
  now: () => Date.now(),
  uuid: () => crypto.randomUUID(),
})
// Queue cleanup must remain active after the last location screen unmounts.
tenantResetRegistry.register((scope) => locationQueueStore.clear(scope))
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) =>
    locationQueueStore.handleStorageEvent(event),
  )
}
