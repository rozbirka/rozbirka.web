import { Navigate, useSearchParams } from 'react-router'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import {
  locationStickersHref,
  parseStickerRoute,
  type LocationCollection,
} from '../stickers/sticker-route'
import type { LocationLabelTarget } from './location-label-queue'

/** Old bookmarks only translate intent; the workspace validates ownership and selection. */
export function LegacyLocationLabelsRedirect({
  target,
}: {
  target: LocationCollection
}) {
  const { status, snapshot, targetTenant } = useCabinet()
  const [params] = useSearchParams()
  if (
    status !== 'ready' ||
    !snapshot ||
    !targetTenant?.id ||
    snapshot.tenantId !== targetTenant.id ||
    !snapshot.permissions.has('inventory.view')
  )
    return null
  const collectionParams = new URLSearchParams({
    type: 'locations',
    kind: target.kind,
    parent: target.parentId,
  })
  if (parseStickerRoute(collectionParams).invalid)
    return (
      <Navigate
        replace
        to={`${cabinetPath(targetTenant.slug, 'stickers')}?type=locations`}
      />
    )
  const requestedIds = params.getAll('label')
  const selectedIds = [...new Set(requestedIds)].filter((id) => {
    const candidate = new URLSearchParams(collectionParams)
    candidate.set('label', id)
    return !parseStickerRoute(candidate).invalid
  })
  return (
    <Navigate
      replace
      to={locationStickersHref(
        targetTenant.slug,
        target,
        requestedIds.length ? selectedIds : 'all',
      )}
    />
  )
}

/** Compatibility for existing imports; no embedded print workspace remains. */
export function LocationLabelsPage({
  target,
}: {
  target: LocationLabelTarget
  inventoryBase: string
}) {
  return <LegacyLocationLabelsRedirect target={target} />
}
