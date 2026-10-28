import { expect, it } from 'vitest'
import { createPartQueueStore } from './part-queue-store'
import { partPrintQueueKey } from './part-print-queue'
function setup() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, raw: string) => {
      values.set(key, raw)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
  let id = 0
  const deps = { storage, now: () => 100, uuid: () => `copy-${++id}` }
  const store = createPartQueueStore(deps)
  const token = () => ({
    queueId: store.getSnapshot().queue!.id,
    revision: store.getSnapshot().revision,
  })
  return { store, deps, values, token }
}
const scope = { userId: 'u:/a', tenantId: 't:/b' }
it('restores copy-level progress in a separate owner namespace and keeps location storage intact', () => {
  const { store, deps, values, token } = setup()
  values.set('rozbirka.location-labels.queue.v2:u:t', 'locations')
  store.hydrate(scope)
  expect(store.enqueue([{ id: 'p', name: 'Part', quantity: 25 }])).toBe(true)
  store.acknowledge(
    store
      .getSnapshot()
      .queue!.remaining.slice(0, 7)
      .map((x) => x.id),
    token(),
  )
  const reloaded = createPartQueueStore(deps)
  reloaded.hydrate(scope)
  expect(reloaded.getSnapshot().queue).toMatchObject({
    printedCount: 7,
    totalCount: 25,
  })
  expect(reloaded.getSnapshot().queue?.remaining).toHaveLength(18)
  expect(values.get('rozbirka.location-labels.queue.v2:u:t')).toBe('locations')
  expect(values.has('rozbirka.part-labels.queue.v2:u%3A%2Fa:t%3A%2Fb')).toBe(
    true,
  )
})
it('rejects stale acknowledgement and append before a delayed storage event can overwrite another tab', () => {
  const { store, deps, token } = setup()
  store.hydrate(scope)
  store.enqueue([{ id: 'p', quantity: 2 }])
  const stale = token()
  const other = createPartQueueStore(deps)
  other.hydrate(scope)
  other.enqueue([{ id: 'p', quantity: 3 }])
  expect(
    store.acknowledge([store.getSnapshot().queue!.remaining[0]!.id], stale),
  ).toBe(false)
  expect(store.getSnapshot().queue?.remaining).toHaveLength(5)
  expect(
    store.remove(
      store.getSnapshot().queue!.remaining.map((x) => x.id),
      stale,
    ),
  ).toBe(false)
  expect(store.discard(stale)).toBe(false)
})
it('clears the owner without letting an old token discard a new tenant queue', () => {
  const { store, token, values } = setup()
  store.hydrate(scope)
  store.enqueue([{ id: 'p', quantity: 1 }])
  const stale = token()
  store.clear(scope)
  expect(values.has(partPrintQueueKey(scope.userId, scope.tenantId))).toBe(
    false,
  )
  store.hydrate({ ...scope, tenantId: 'other' })
  store.enqueue([{ id: 'other', quantity: 1 }])
  expect(store.discard(stale)).toBe(false)
  expect(store.getSnapshot().queue?.remaining[0]?.partId).toBe('other')
})
it('keeps the active queue usable in memory when browser storage is blocked', () => {
  let id = 0
  const unavailable = () => {
    throw new Error('storage-blocked')
  }
  const store = createPartQueueStore({
    storage: {
      getItem: unavailable,
      setItem: unavailable,
      removeItem: unavailable,
    },
    now: () => 100,
    uuid: () => String(++id),
  })
  store.hydrate(scope)
  expect(store.enqueue([{ id: 'p', quantity: 2 }])).toBe(true)
  const snapshot = store.getSnapshot()
  expect(snapshot.persistenceError).toBe(true)
  expect(
    store.acknowledge([snapshot.queue!.remaining[0]!.id], {
      queueId: snapshot.queue!.id,
      revision: snapshot.revision,
    }),
  ).toBe(true)
  expect(store.getSnapshot().queue?.remaining).toHaveLength(1)
})
