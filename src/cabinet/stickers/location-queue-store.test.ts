import { describe, expect, it, vi } from 'vitest'
import {
  labelQueueKey,
  type LocationLabelQueue,
} from '../inventory/location-label-queue'
import {
  createLocationQueueStore,
  withLocationQueueLock,
} from './location-queue-store'

const scope = { userId: 'u:/α', tenantId: 't:/β' }
const target = { kind: 'section' as const, parentId: 'z', parentName: 'Zone A' }
function setup() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
  let time = 100
  let id = 0
  const deps = { storage, now: () => time, uuid: () => `queue-${++id}` }
  const store = createLocationQueueStore(deps)
  const expected = () => ({
    queueId: store.getSnapshot().queue!.id,
    revision: store.getSnapshot().revision,
  })
  return {
    store,
    storage,
    values,
    deps,
    expected,
    setTime: (value: number) => {
      time = value
    },
  }
}

describe('location queue store', () => {
  it('persists an encoded owner envelope, reloads, and leaves the parts namespace untouched', () => {
    const { store, values, deps } = setup()
    values.set('rozbirka.stickers.queue.v1:u:/α:t:/β', 'parts')
    store.hydrate(scope)
    expect(store.start(target, ['a', 'b'])).toMatchObject({ ok: true })
    const raw = values.get(
      'rozbirka.location-labels.queue.v2:u%3A%2F%CE%B1:t%3A%2F%CE%B2',
    )!
    expect(JSON.parse(raw)).toMatchObject({
      version: 2,
      owner: scope,
      queue: { id: 'queue-1', remainingIds: ['a', 'b'] },
    })
    const reloaded = createLocationQueueStore(deps)
    reloaded.hydrate(scope)
    expect(reloaded.getSnapshot().queue?.remainingIds).toEqual(['a', 'b'])
    expect(values.get('rozbirka.stickers.queue.v1:u:/α:t:/β')).toBe('parts')
  })
  it('never replaces an active queue, does not renew no-ops, and rejects stale acknowledgements', () => {
    const { store, expected, setTime } = setup()
    store.hydrate(scope)
    store.start(target, ['a', 'b', 'c'])
    const initial = store.getSnapshot()
    const oldToken = expected()
    expect(store.start(target, ['d'])).toEqual({
      ok: false,
      reason: 'active-queue',
    })
    expect(store.append({ ...target, parentId: 'other' }, ['d'])).toEqual({
      ok: false,
      reason: 'target-mismatch',
    })
    expect(store.append(target, ['b'])).toMatchObject({
      ok: true,
      addedCount: 0,
    })
    expect(store.acknowledge(['missing'], oldToken)).toBe(false)
    expect(store.getSnapshot()).toBe(initial)
    setTime(300)
    store.append(target, ['d'])
    expect(store.acknowledge(['a'], oldToken)).toBe(false)
    expect(store.remove(['b', 'c'], expected())).toBe(true)
    expect(store.getSnapshot().queue).toMatchObject({
      remainingIds: ['a', 'd'],
      totalCount: 2,
      printedCount: 0,
      expiresAt: 86400300,
    })
    expect(store.acknowledge(['a', 'd'], expected())).toBe(true)
    expect(store.getSnapshot().queue).toBeNull()
    store.start(target, ['a'])
    expect(store.discard(oldToken)).toBe(false)
  })
  it('rejects malformed, expired and foreign envelopes and cleans legacy keys', () => {
    const { store, storage, values } = setup()
    store.hydrate(scope)
    store.start(target, ['a'])
    const key = labelQueueKey(scope.userId, scope.tenantId)
    const valid = JSON.parse(values.get(key)!) as {
      version: 2
      owner: typeof scope
      queue: LocationLabelQueue
    }
    for (const raw of [
      '{',
      JSON.stringify({ ...valid, owner: { ...scope, userId: 'other' } }),
      JSON.stringify({ ...valid, queue: { ...valid.queue, expiresAt: 99 } }),
      JSON.stringify(valid.queue),
    ]) {
      storage.setItem(key, raw)
      storage.setItem(
        `rozbirka.location-labels.queue.v1:${scope.userId}:${scope.tenantId}`,
        'legacy',
      )
      const fresh = createLocationQueueStore({
        storage,
        now: () => 100,
        uuid: () => 'new',
      })
      fresh.hydrate(scope)
      expect(fresh.getSnapshot().queue).toBeNull()
      expect(values.has(key)).toBe(false)
      expect(
        values.has(
          `rozbirka.location-labels.queue.v1:${scope.userId}:${scope.tenantId}`,
        ),
      ).toBe(false)
    }
  })
  it('uses last actual mutation for TTL and preserves memory when storage fails', () => {
    const { store, setTime, expected, storage } = setup()
    store.hydrate(scope)
    store.start(target, ['a', 'b'])
    setTime(1000)
    store.acknowledge(['a'], expected())
    expect(store.getSnapshot().queue?.expiresAt).toBe(86401000)
    storage.setItem = () => {
      throw new Error('blocked')
    }
    store.append(target, ['c'])
    expect(store.getSnapshot()).toMatchObject({
      persistenceError: true,
      queue: { remainingIds: ['b', 'c'] },
    })
  })
  it('adopts other-tab writes and deletion and invalidates an old token', () => {
    const { store, deps, expected } = setup()
    store.hydrate(scope)
    store.start(target, ['a', 'b'])
    const stale = expected()
    const other = createLocationQueueStore(deps)
    other.hydrate(scope)
    other.append(target, ['c'])
    store.handleStorageEvent({
      key: labelQueueKey(scope.userId, scope.tenantId),
    })
    expect(store.getSnapshot().queue?.remainingIds).toEqual(['a', 'b', 'c'])
    expect(store.acknowledge(['a'], stale)).toBe(false)
    other.discard({
      queueId: other.getSnapshot().queue!.id,
      revision: other.getSnapshot().revision,
    })
    store.handleStorageEvent({
      key: labelQueueKey(scope.userId, scope.tenantId),
    })
    expect(store.getSnapshot().queue).toBeNull()
  })
  it('clears departed scopes and refuses late hydration even when storage removal fails', () => {
    const { store, storage, deps } = setup()
    store.hydrate(scope)
    store.start(target, ['a'])
    storage.removeItem = () => {
      throw new Error('blocked')
    }
    store.clear(scope)
    expect(store.getSnapshot().queue).toBeNull()
    store.hydrate(scope)
    expect(store.getSnapshot().queue).toBeNull()
    store.start(target, ['new'])
    expect(store.getSnapshot().queue?.remainingIds).toEqual(['new'])
    const fresh = createLocationQueueStore(deps)
    const originalRead = storage.getItem
    storage.getItem = (key) => {
      fresh.clear(scope)
      return originalRead(key)
    }
    fresh.hydrate(scope)
    expect(fresh.getSnapshot().queue).toBeNull()
  })
  it('clearing another scope does not disturb the current queue', () => {
    const { store } = setup()
    store.hydrate(scope)
    store.start(target, ['a'])
    const snapshot = store.getSnapshot()
    store.clear({ ...scope, tenantId: 'other' })
    expect(store.getSnapshot()).toBe(snapshot)
  })
})
it('does not revive a cleared pending scope when another scope was already active', () => {
  const { store, storage, values } = setup()
  store.hydrate(scope)
  store.start(target, ['a'])
  const other = { ...scope, tenantId: 'next' }
  const envelope = JSON.parse(
    values.get(labelQueueKey(scope.userId, scope.tenantId))!,
  ) as { version: 2; owner: typeof scope; queue: LocationLabelQueue }
  storage.setItem(
    labelQueueKey(other.userId, other.tenantId),
    JSON.stringify({ ...envelope, owner: other }),
  )
  const originalRead = storage.getItem
  storage.getItem = (key) => {
    const raw = originalRead(key)
    if (key === labelQueueKey(other.userId, other.tenantId)) store.clear(other)
    return raw
  }
  store.hydrate(other)
  expect(store.getSnapshot().scope).toEqual(scope)
  expect(store.getSnapshot().queue?.remainingIds).toEqual(['a'])
})
it('expires an in-memory queue when the same scope hydrates after its TTL', () => {
  const { store, setTime } = setup()
  store.hydrate(scope)
  store.start(target, ['a'])
  setTime(86400100)
  store.hydrate(scope)
  expect(store.getSnapshot().queue).toBeNull()
})
it('does not cancel a new owner hydration while an unrelated departed scope clears', () => {
  const { store, storage, values, deps } = setup()
  store.hydrate(scope)
  store.start(target, ['a'])
  const fresh = createLocationQueueStore(deps)
  const originalRead = storage.getItem
  storage.getItem = (key) => {
    fresh.clear({ ...scope, tenantId: 'departed' })
    return originalRead(key)
  }
  fresh.hydrate(scope)
  expect(fresh.getSnapshot().queue?.remainingIds).toEqual(['a'])
  expect(values.has(labelQueueKey(scope.userId, scope.tenantId))).toBe(true)
})

describe('persisted mutations before storage event delivery', () => {
  for (const operation of [
    'acknowledge',
    'remove',
    'discard',
    'append',
  ] as const) {
    it(`adopts another tab's append and rejects stale ${operation} without losing IDs`, () => {
      const { store, deps, expected, values } = setup()
      store.hydrate(scope)
      store.start(target, ['a', 'b'])
      const oldToken = expected()
      const other = createLocationQueueStore(deps)
      other.hydrate(scope)
      other.append(target, ['c'])
      const authoritative = values.get(
        labelQueueKey(scope.userId, scope.tenantId),
      )
      const result =
        operation === 'append'
          ? store.append(target, ['d'])
          : operation === 'discard'
            ? store.discard(oldToken)
            : store[operation](['a'], oldToken)
      if (operation === 'append') expect(result).toMatchObject({ ok: false })
      else expect(result).toBe(false)
      expect(store.getSnapshot().queue?.remainingIds).toEqual(['a', 'b', 'c'])
      expect(values.get(labelQueueKey(scope.userId, scope.tenantId))).toBe(
        authoritative,
      )
    })
  }
  it('rejects a stale start when another tab created the queue after hydration', () => {
    const { store, deps, values } = setup()
    store.hydrate(scope)
    const other = createLocationQueueStore(deps)
    other.hydrate(scope)
    other.start(target, ['remote'])
    const authoritative = values.get(
      labelQueueKey(scope.userId, scope.tenantId),
    )
    expect(store.start(target, ['local'])).toMatchObject({ ok: false })
    expect(store.getSnapshot().queue?.remainingIds).toEqual(['remote'])
    expect(values.get(labelQueueKey(scope.userId, scope.tenantId))).toBe(
      authoritative,
    )
  })
  it('does not recreate a queue another tab discarded before its storage event arrives', () => {
    const { store, deps } = setup()
    store.hydrate(scope)
    store.start(target, ['a', 'b'])
    const other = createLocationQueueStore(deps)
    other.hydrate(scope)
    other.discard({
      queueId: other.getSnapshot().queue!.id,
      revision: other.getSnapshot().revision,
    })
    expect(store.append(target, ['c'])).toMatchObject({ ok: false })
    expect(store.getSnapshot().queue).toBeNull()
  })
  it('keeps memory operations usable with a warning while storage reads and writes are unavailable', () => {
    const { store, storage, expected } = setup()
    store.hydrate(scope)
    store.start(target, ['a', 'b'])
    storage.getItem = () => {
      throw new Error('blocked')
    }
    storage.setItem = () => {
      throw new Error('blocked')
    }
    expect(store.append(target, ['c'])).toMatchObject({ ok: true })
    expect(store.acknowledge(['a'], expected())).toBe(true)
    expect(store.getSnapshot()).toMatchObject({
      persistenceError: true,
      queue: { remainingIds: ['b', 'c'], printedCount: 1 },
    })
  })
})

it('serializes same-owner operations through browser locks while allowing a different owner', async () => {
  const lanes = new Map<string, Promise<unknown>>()
  vi.stubGlobal('navigator', {
    locks: {
      request: <T>(name: string, operation: () => T | Promise<T>) => {
        const next = (lanes.get(name) ?? Promise.resolve()).then(operation)
        lanes.set(
          name,
          next.catch(() => undefined),
        )
        return next
      },
    },
  })
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const events: string[] = []
  try {
    const first = withLocationQueueLock(scope, async () => {
      events.push('first started')
      await gate
      events.push('first done')
      return 1
    })
    const second = withLocationQueueLock(scope, () => {
      events.push('second')
      return 2
    })
    const different = withLocationQueueLock(
      { ...scope, tenantId: 'other' },
      () => {
        events.push('other')
        return 3
      },
    )
    expect(await different).toBe(3)
    expect(events).toEqual(['first started', 'other'])
    release?.()
    expect(await Promise.all([first, second])).toEqual([1, 2])
    expect(events).toEqual(['first started', 'other', 'first done', 'second'])
  } finally {
    vi.unstubAllGlobals()
  }
})
it('runs the guarded operation immediately when browser locks are unavailable', async () => {
  vi.stubGlobal('navigator', {})
  let result = 0
  try {
    const pending = withLocationQueueLock(scope, () => {
      result = 7
      return result
    })
    expect(result).toBe(7)
    expect(await pending).toBe(7)
  } finally {
    vi.unstubAllGlobals()
  }
})
it('cleans an unobserved departed scope even when reads fail but removal works', () => {
  const { store, storage, deps } = setup()
  const previous = createLocationQueueStore(deps)
  previous.hydrate(scope)
  previous.start(target, ['old'])
  const originalRead = storage.getItem
  storage.getItem = () => {
    throw new Error('reads blocked')
  }
  store.clear(scope)
  storage.getItem = originalRead
  const next = createLocationQueueStore(deps)
  next.hydrate(scope)
  expect(next.getSnapshot().queue).toBeNull()
})
it('retains the memory queue when a storage event cannot read authoritative data', () => {
  const { store, storage } = setup()
  store.hydrate(scope)
  store.start(target, ['a', 'b'])
  storage.getItem = () => {
    throw new Error('blocked')
  }
  store.handleStorageEvent({ key: labelQueueKey(scope.userId, scope.tenantId) })
  expect(store.getSnapshot()).toMatchObject({
    persistenceError: true,
    queue: { remainingIds: ['a', 'b'] },
  })
})
