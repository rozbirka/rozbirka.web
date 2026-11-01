export type LocationLabelKind = 'zone' | 'section' | 'shelf'
export interface LocationLabelTarget {
  kind: LocationLabelKind | 'warehouse'
  parentId: string
  parentName: string
}
export interface LocationLabelQueue {
  version: 1
  id: string
  expiresAt: number
  target: LocationLabelTarget
  remainingIds: string[]
  totalCount: number
  printedCount: number
}
export const MAX_LOCATION_LABELS = 200
export const LOCATION_LABEL_BATCH = 20
export const LOCATION_LABEL_TTL = 24 * 60 * 60 * 1000
export type QueueMutationResult =
  | { ok: true; queue: LocationLabelQueue; addedCount: number }
  | {
      ok: false
      reason: 'empty' | 'limit' | 'target-mismatch' | 'active-queue' | 'invalid'
    }
export const labelQueueKey = (userId: string, tenantId: string) =>
  `rozbirka.location-labels.queue.v2:${encodeURIComponent(userId)}:${encodeURIComponent(tenantId)}`
export const sameLabelTarget = (
  a: LocationLabelTarget,
  b: LocationLabelTarget,
) => a.kind === b.kind && a.parentId === b.parentId

export function createLabelQueue(
  target: LocationLabelTarget,
  ids: string[],
  now = Date.now(),
  uuid: () => string = () => crypto.randomUUID(),
): LocationLabelQueue {
  const remainingIds = [...new Set(ids)]
  if (
    !validLabelTarget(target) ||
    !validLabelIds(ids) ||
    !remainingIds.length ||
    remainingIds.length > MAX_LOCATION_LABELS
  )
    throw new Error('invalid-label-count')
  return {
    version: 1,
    id: uuid(),
    target,
    remainingIds,
    totalCount: remainingIds.length,
    printedCount: 0,
    expiresAt: now + LOCATION_LABEL_TTL,
  }
}
export const nextLabelBatch = (queue: LocationLabelQueue) =>
  queue.remainingIds.slice(0, LOCATION_LABEL_BATCH)
export function acknowledgeLabels(
  queue: LocationLabelQueue,
  ids: string[],
  now = Date.now(),
): LocationLabelQueue | null {
  const confirmed = new Set(ids)
  const remainingIds = queue.remainingIds.filter((id) => !confirmed.has(id))
  if (remainingIds.length === queue.remainingIds.length) return queue
  return remainingIds.length
    ? {
        ...queue,
        remainingIds,
        expiresAt: now + LOCATION_LABEL_TTL,
        printedCount:
          queue.printedCount + queue.remainingIds.length - remainingIds.length,
      }
    : null
}
export function removeQueueLabels(
  queue: LocationLabelQueue,
  ids: string[],
  now = Date.now(),
): LocationLabelQueue | null {
  const removed = new Set(ids)
  const remainingIds = queue.remainingIds.filter((item) => !removed.has(item))
  if (remainingIds.length === queue.remainingIds.length) return queue
  return remainingIds.length
    ? {
        ...queue,
        remainingIds,
        expiresAt: now + LOCATION_LABEL_TTL,
        totalCount:
          queue.totalCount - (queue.remainingIds.length - remainingIds.length),
      }
    : null
}
export function removeQueueLabel(
  queue: LocationLabelQueue,
  id: string,
  now = Date.now(),
): LocationLabelQueue | null {
  return removeQueueLabels(queue, [id], now)
}
function validLabelTarget(target: LocationLabelTarget): boolean {
  return (
    !!target &&
    ['warehouse', 'zone', 'section', 'shelf'].includes(target.kind) &&
    typeof target.parentId === 'string' &&
    !!target.parentId &&
    typeof target.parentName === 'string'
  )
}
function validLabelIds(ids: string[]): boolean {
  return (
    Array.isArray(ids) &&
    ids.every((id) => typeof id === 'string' && !!id.trim())
  )
}
export function appendLabelQueue(
  queue: LocationLabelQueue,
  target: LocationLabelTarget,
  ids: string[],
  now = Date.now(),
): QueueMutationResult {
  if (!validLabelTarget(target) || !validLabelIds(ids))
    return { ok: false, reason: 'invalid' }
  if (!sameLabelTarget(queue.target, target))
    return { ok: false, reason: 'target-mismatch' }
  if (!ids.length) return { ok: false, reason: 'empty' }
  const existing = new Set(queue.remainingIds)
  const added = [...new Set(ids)].filter((id) => !existing.has(id))
  if (queue.remainingIds.length + added.length > MAX_LOCATION_LABELS)
    return { ok: false, reason: 'limit' }
  if (!added.length) return { ok: true, queue, addedCount: 0 }
  return {
    ok: true,
    addedCount: added.length,
    queue: {
      ...queue,
      remainingIds: [...queue.remainingIds, ...added],
      totalCount: queue.totalCount + added.length,
      expiresAt: now + LOCATION_LABEL_TTL,
    },
  }
}
export function decodeLabelQueue(
  raw: string | null,
  now = Date.now(),
): LocationLabelQueue | null {
  try {
    const value = JSON.parse(raw ?? 'null') as LocationLabelQueue | null
    if (
      value?.version !== 1 ||
      typeof value.id !== 'string' ||
      !value.id ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now ||
      !value.target ||
      !['warehouse', 'zone', 'section', 'shelf'].includes(value.target.kind) ||
      typeof value.target.parentId !== 'string' ||
      !value.target.parentId ||
      typeof value.target.parentName !== 'string' ||
      !Array.isArray(value.remainingIds) ||
      !value.remainingIds.length ||
      value.remainingIds.length > MAX_LOCATION_LABELS ||
      value.remainingIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(value.remainingIds).size !== value.remainingIds.length ||
      !Number.isSafeInteger(value.totalCount) ||
      !Number.isSafeInteger(value.printedCount) ||
      value.printedCount < 0 ||
      value.totalCount !== value.remainingIds.length + value.printedCount
    )
      return null
    return value
  } catch {
    return null
  }
}
function ownerFromKey(
  key: string,
): { userId: string; tenantId: string } | null {
  const match = /^rozbirka\.location-labels\.queue\.v2:([^:]*):([^:]*)$/.exec(
    key,
  )
  if (!match) return null
  try {
    return {
      userId: decodeURIComponent(match[1]!),
      tenantId: decodeURIComponent(match[2]!),
    }
  } catch {
    return null
  }
}
export function readLabelQueue(key: string): LocationLabelQueue | null {
  try {
    const raw = localStorage.getItem(key)
    const owner = ownerFromKey(key)
    if (!owner) return decodeLabelQueue(raw)
    const value = JSON.parse(raw ?? 'null') as {
      version?: unknown
      owner?: { userId?: unknown; tenantId?: unknown }
      queue?: unknown
    } | null
    if (
      value?.version !== 2 ||
      value.owner?.userId !== owner.userId ||
      value.owner?.tenantId !== owner.tenantId
    )
      return null
    return decodeLabelQueue(JSON.stringify(value.queue))
  } catch {
    return null
  }
}
export function writeLabelQueue(key: string, queue: LocationLabelQueue | null) {
  try {
    const owner = ownerFromKey(key)
    if (queue)
      localStorage.setItem(
        key,
        JSON.stringify(owner ? { version: 2, owner, queue } : queue),
      )
    else localStorage.removeItem(key)
  } catch {
    /* The in-memory queue remains usable when storage is blocked. */
  }
}
