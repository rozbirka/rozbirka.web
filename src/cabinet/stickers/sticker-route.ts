import { cabinetPath } from '../cabinet-paths'

export type StickerMode = 'parts' | 'locations'
export interface LocationCollection {
  kind: 'zone' | 'section' | 'shelf'
  parentId: string
}
export interface StickerRoute {
  mode: StickerMode
  collection: LocationCollection | null
  selectAll: boolean
  selectedIds: string[]
  invalid: boolean
}

const locationKeys = ['kind', 'parent', 'select', 'label'] as const
const validId = (value: string) => /^[A-Za-z0-9._~-]{1,256}$/.test(value)

export function parseStickerRoute(params: URLSearchParams): StickerRoute {
  const types = params.getAll('type')
  const mode: StickerMode = types[0] === 'locations' ? 'locations' : 'parts'
  const empty: StickerRoute = {
    mode,
    collection: null,
    selectAll: false,
    selectedIds: [],
    invalid: false,
  }
  const invalid = (): StickerRoute => ({ ...empty, invalid: true })
  if (
    types.length > 1 ||
    (types.length === 1 && types[0] !== 'parts' && types[0] !== 'locations')
  )
    return invalid()

  if (mode === 'parts') {
    if (locationKeys.some((key) => params.has(key))) return invalid()
    // Preserve the legacy part hand-off; its queue owns deduplication.
    return { ...empty, selectedIds: params.getAll('part') }
  }

  if (['kind', 'parent', 'select'].some((key) => params.getAll(key).length > 1))
    return invalid()
  const kind = params.get('kind')
  const parentId = params.get('parent')
  const selection = params.get('select')
  const selectedIds = params.getAll('label')
  const hasCollection = kind !== null || parentId !== null
  if (!hasCollection) {
    return selection !== null || selectedIds.length > 0 ? invalid() : empty
  }
  if (
    (kind !== 'zone' && kind !== 'section' && kind !== 'shelf') ||
    parentId === null ||
    !validId(parentId)
  )
    return invalid()
  if (selection !== null && selection !== 'all') return invalid()
  if (selection === 'all' && selectedIds.length > 0) return invalid()
  if (
    selectedIds.some((id) => !validId(id)) ||
    new Set(selectedIds).size !== selectedIds.length
  )
    return invalid()

  return {
    ...empty,
    collection: { kind, parentId },
    selectAll: selection === 'all',
    selectedIds,
  }
}

export function locationStickersHref(
  tenantSlug: string,
  collection: LocationCollection,
  selection: 'all' | readonly string[],
): string {
  const params = new URLSearchParams({
    type: 'locations',
    kind: collection.kind,
    parent: collection.parentId,
  })
  if (selection === 'all') params.set('select', 'all')
  else for (const id of selection) params.append('label', id)
  if (parseStickerRoute(params).invalid)
    throw new Error('Invalid location sticker selection')
  return `${cabinetPath(tenantSlug, 'stickers')}?${params.toString()}`
}
