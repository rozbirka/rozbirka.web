import type { PartSearchRequest } from '@/api/parts'

export type LocationContentsTarget = {
  zoneId: string
  name: string
  path: string[]
} & (
  | { kind: 'zone' | 'zone-direct' }
  | { kind: 'section' | 'direct'; sectionId: string }
  | { kind: 'shelf'; sectionId: string; shelfId: string }
)

export function locationPartsFilter(
  target: LocationContentsTarget,
  query: string,
  page: number,
): PartSearchRequest {
  return {
    zoneIds: [target.zoneId],
    ...('sectionId' in target ? { sectionIds: [target.sectionId] } : {}),
    ...(target.kind === 'zone-direct' ? { missingSection: true } : {}),
    ...(target.kind === 'shelf' ? { shelfIds: [target.shelfId] } : {}),
    ...(target.kind === 'direct' ? { missingShelf: true } : {}),
    ...(query.trim() ? { query: query.trim() } : {}),
    page,
    pageSize: 10,
    sort: 'name_asc',
  }
}

/** Link the place to the normal parts list, keeping the full location scope. */
export function locationPartsHref(
  partsBase: string,
  warehouseId: string,
  target: LocationContentsTarget,
): string {
  const params = new URLSearchParams({
    warehouse: warehouseId,
    zone: target.zoneId,
  })
  if ('sectionId' in target) params.set('section', target.sectionId)
  if (target.kind === 'shelf') params.set('shelf', target.shelfId)
  if (target.kind === 'zone-direct') params.set('without_section', '1')
  if (target.kind === 'direct') params.set('without_shelf', '1')
  return `${partsBase}?${params.toString()}`
}
