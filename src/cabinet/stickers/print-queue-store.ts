import type { TenantResetScope } from '../tenant-reset-registry'

export type PrintQueueScope = TenantResetScope
export interface PrintQueueExpected {
  queueId: string
  revision: number
}
export interface PrintQueueRecord {
  id: string
  expiresAt: number
}
export interface PrintQueueSnapshot<Q> {
  queue: Q | null
  scope: PrintQueueScope | null
  revision: number
  persistenceError: boolean
}
export type QueueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const samePrintQueueScope = (
  a: PrintQueueScope | null,
  b: PrintQueueScope | null,
) =>
  a === b || (!!a && !!b && a.userId === b.userId && a.tenantId === b.tenantId)

export function createPrintQueueStore<Q extends PrintQueueRecord>({
  storage,
  now,
  key: scopeKey,
  decode,
  legacyKeys = () => [],
}: {
  storage: QueueStorage
  now: () => number
  key: (scope: PrintQueueScope) => string
  decode: (raw: string, now: number) => Q | null
  legacyKeys?: (scope: PrintQueueScope) => string[]
}) {
  let snapshot: PrintQueueSnapshot<Q> = {
    queue: null,
    scope: null,
    revision: 0,
    persistenceError: false,
  }
  const listeners = new Set<() => void>()
  const clearedScopes = new Set<string>()
  let generation = 0
  let pendingScope: PrintQueueScope | null = null
  const observedStorage = new Map<string, string | null>()
  let mutationReadFailed = false
  const emit = (
    queue: Q | null,
    scope: PrintQueueScope | null,
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
  const removeStored = (scope: PrintQueueScope) => {
    let failed = false
    for (const key of [scopeKey(scope), ...legacyKeys(scope)]) {
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
  const persist = (scope: PrintQueueScope, queue: Q | null) => {
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
  const read = (scope: PrintQueueScope) => {
    let persistenceError = false
    let queue: Q | null = null
    let raw: string | null | undefined
    try {
      for (const key of legacyKeys(scope)) storage.removeItem(key)
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
            queue = decode(JSON.stringify(value.queue), now())
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
  const hydrate = (scope: PrintQueueScope) => {
    if (!scope.userId || !scope.tenantId) return
    if (samePrintQueueScope(snapshot.scope, scope)) {
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
  const mutate = (queue: Q | null) => {
    if (!snapshot.scope || queue === snapshot.queue) return false
    const scope = snapshot.scope
    clearedScopes.delete(scopeKey(scope))
    const persistenceError = persist(scope, queue) || mutationReadFailed
    emit(queue, scope, persistenceError)
    return true
  }
  const store = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    hydrate,
    transact<R>(
      fallback: R,
      operation: (
        queue: Q | null,
        revision: number,
      ) => { queue: Q | null; result: R },
    ): R {
      if (!prepareMutation()) return fallback
      const next = operation(snapshot.queue, snapshot.revision)
      mutate(next.queue)
      return next.result
    },
    clear(scope: PrintQueueScope | null = snapshot.scope) {
      if (!scope) return
      clearedScopes.add(scopeKey(scope))
      const matches = samePrintQueueScope(snapshot.scope, scope)
      if (matches || samePrintQueueScope(pendingScope, scope)) generation++
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

export async function withPrintQueueLock<T>(
  namespace: string,
  scope: PrintQueueScope,
  operation: () => T | Promise<T>,
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    const key = `${namespace}:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.tenantId)}`
    return navigator.locks.request(key, operation)
  }
  return operation()
}
export const browserQueueStorage: QueueStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}
