export type LocationLabelKind = 'zone' | 'section' | 'shelf'
export interface LocationLabelTarget {
  kind: LocationLabelKind
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
export const labelQueueKey = (userId: string, tenantId: string) =>
  `rozbirka.location-labels.queue.v1:${userId}:${tenantId}`
export const sameLabelTarget = (
  a: LocationLabelTarget,
  b: LocationLabelTarget,
) => a.kind === b.kind && a.parentId === b.parentId

export function createLabelQueue(
  target: LocationLabelTarget,
  ids: string[],
): LocationLabelQueue {
  const remainingIds = [...new Set(ids)]
  if (!remainingIds.length || remainingIds.length > MAX_LOCATION_LABELS)
    throw new Error('invalid-label-count')
  return {
    version: 1,
    id: crypto.randomUUID(),
    target,
    remainingIds,
    totalCount: remainingIds.length,
    printedCount: 0,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  }
}
export const nextLabelBatch = (queue: LocationLabelQueue) =>
  queue.remainingIds.slice(0, LOCATION_LABEL_BATCH)
export function acknowledgeLabels(
  queue: LocationLabelQueue,
  ids: string[],
): LocationLabelQueue | null {
  const confirmed = new Set(ids)
  const remainingIds = queue.remainingIds.filter((id) => !confirmed.has(id))
  return remainingIds.length
    ? {
        ...queue,
        remainingIds,
        printedCount:
          queue.printedCount + queue.remainingIds.length - remainingIds.length,
      }
    : null
}
export function removeQueueLabel(
  queue: LocationLabelQueue,
  id: string,
): LocationLabelQueue | null {
  const remainingIds = queue.remainingIds.filter((item) => item !== id)
  return remainingIds.length
    ? {
        ...queue,
        remainingIds,
        totalCount:
          queue.totalCount - (queue.remainingIds.length - remainingIds.length),
      }
    : null
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
      !['zone', 'section', 'shelf'].includes(value.target.kind) ||
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
export function readLabelQueue(key: string): LocationLabelQueue | null {
  try {
    return decodeLabelQueue(localStorage.getItem(key))
  } catch {
    return null
  }
}
export function writeLabelQueue(key: string, queue: LocationLabelQueue | null) {
  try {
    if (queue) localStorage.setItem(key, JSON.stringify(queue))
    else localStorage.removeItem(key)
  } catch {
    /* The in-memory queue remains usable when storage is blocked. */
  }
}
