import { partsApi } from '@/api/parts'

// The parts endpoint cannot exclude queue IDs. Load matching pages once so
// filtering pending parts still produces full pages and accurate result counts.
export async function loadStickerParts(q: string, signal: AbortSignal) {
  const options = {
    pageSize: 100,
    status: 'available',
    ...(q ? { q } : {}),
    signal,
  }
  const first = await partsApi.list({ ...options, page: 1 })
  const items = [...first.items]
  for (let page = 2; page <= first.totalPages; page += 3) {
    signal.throwIfAborted()
    const pages = await Promise.all(
      Array.from(
        { length: Math.min(3, first.totalPages - page + 1) },
        (_, offset) => partsApi.list({ ...options, page: page + offset }),
      ),
    )
    items.push(...pages.flatMap((result) => result.items))
  }
  signal.throwIfAborted()
  return [...new Map(items.map((part) => [part.id, part])).values()]
}
