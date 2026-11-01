export interface PartStickerSelection {
  id: string
  quantity: number
  availableQuantity?: number
  name?: string
  externalCode?: string | null
  carLabel?: string | null
}
export interface PartQueueCopy {
  id: string
  partId: string
  name?: string
  externalCode?: string | null
  carLabel?: string | null
}
export interface PartPrintQueue {
  version: 1
  id: string
  expiresAt: number
  remaining: PartQueueCopy[]
  totalCount: number
  printedCount: number
}
export const PART_QUEUE_LIMIT = 200
export const PART_BATCH_SIZE = 20
export const PART_QUEUE_TTL = 24 * 60 * 60 * 1000
export const partPrintQueueKey = (userId: string, tenantId: string) =>
  `rozbirka.part-labels.queue.v2:${encodeURIComponent(userId)}:${encodeURIComponent(tenantId)}`
const validSelection = (items: PartStickerSelection[]) =>
  items.length > 0 &&
  new Set(items.map((x) => x.id)).size === items.length &&
  items.every(
    (x) => !!x.id.trim() && Number.isSafeInteger(x.quantity) && x.quantity > 0,
  ) &&
  items.reduce((sum, x) => sum + x.quantity, 0) <= PART_QUEUE_LIMIT
const copies = (
  items: PartStickerSelection[],
  uuid: () => string,
): PartQueueCopy[] =>
  items.flatMap(({ id, quantity, name, externalCode, carLabel }) =>
    Array.from({ length: quantity }, () => ({
      id: uuid(),
      partId: id,
      ...(name === undefined ? {} : { name }),
      externalCode: externalCode ?? null,
      carLabel: carLabel ?? null,
    })),
  )
export function createPartPrintQueue(
  items: PartStickerSelection[],
  now = Date.now(),
  uuid: () => string = () => crypto.randomUUID(),
): PartPrintQueue {
  if (!validSelection(items)) throw new Error('invalid-part-label-count')
  return {
    version: 1,
    id: uuid(),
    expiresAt: now + PART_QUEUE_TTL,
    remaining: copies(items, uuid),
    totalCount: items.reduce((sum, x) => sum + x.quantity, 0),
    printedCount: 0,
  }
}
export function appendPartPrintQueue(
  queue: PartPrintQueue,
  items: PartStickerSelection[],
  now = Date.now(),
  uuid: () => string = () => crypto.randomUUID(),
): PartPrintQueue {
  if (
    !validSelection(items) ||
    queue.remaining.length + items.reduce((sum, x) => sum + x.quantity, 0) >
      PART_QUEUE_LIMIT
  )
    throw new Error('invalid-part-label-count')
  const added = copies(items, uuid)
  return {
    ...queue,
    remaining: [...queue.remaining, ...added],
    totalCount: queue.totalCount + added.length,
    expiresAt: now + PART_QUEUE_TTL,
  }
}
export const nextPartBatch = (queue: PartPrintQueue) =>
  queue.remaining.slice(0, PART_BATCH_SIZE)
function finishCopies(
  queue: PartPrintQueue,
  ids: readonly string[],
  printed: boolean,
  now: number,
): PartPrintQueue | null {
  const selected = new Set(ids)
  const remaining = queue.remaining.filter((x) => !selected.has(x.id))
  const count = queue.remaining.length - remaining.length
  if (!count) return queue
  return remaining.length
    ? {
        ...queue,
        remaining,
        printedCount: queue.printedCount + (printed ? count : 0),
        totalCount: queue.totalCount - (printed ? 0 : count),
        expiresAt: now + PART_QUEUE_TTL,
      }
    : null
}
export const acknowledgePartCopies = (
  queue: PartPrintQueue,
  ids: readonly string[],
  now = Date.now(),
) => finishCopies(queue, ids, true, now)
export const removePartCopies = (
  queue: PartPrintQueue,
  ids: readonly string[],
  now = Date.now(),
) => finishCopies(queue, ids, false, now)
export function decodePartPrintQueue(
  raw: string,
  now = Date.now(),
): PartPrintQueue | null {
  try {
    const value = JSON.parse(raw) as PartPrintQueue | null
    const optionalText = (x: unknown) =>
      x === undefined || x === null || typeof x === 'string'
    if (
      value?.version !== 1 ||
      typeof value.id !== 'string' ||
      !value.id ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now ||
      !Array.isArray(value.remaining) ||
      !value.remaining.length ||
      value.remaining.length > PART_QUEUE_LIMIT ||
      value.remaining.some(
        (x) =>
          !x ||
          typeof x.id !== 'string' ||
          !x.id ||
          typeof x.partId !== 'string' ||
          !x.partId ||
          !optionalText(x.name) ||
          !optionalText(x.externalCode) ||
          !optionalText(x.carLabel),
      ) ||
      new Set(value.remaining.map((x) => x.id)).size !==
        value.remaining.length ||
      !Number.isSafeInteger(value.printedCount) ||
      value.printedCount < 0 ||
      !Number.isSafeInteger(value.totalCount) ||
      value.totalCount !== value.remaining.length + value.printedCount
    )
      return null
    return value
  } catch {
    return null
  }
}
