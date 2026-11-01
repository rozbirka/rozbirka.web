import { Navigate, useLocation, useParams } from 'react-router'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import { LegacyLocationLabelsRedirect } from '../inventory/LocationLabelPrinter'

/** Keep bookmarks and queued-label links working without loading the old screen. */
export function LegacyWarehouseRedirect() {
  const { targetTenant } = useCabinet()
  const { warehouseId, zoneId, sectionId } = useParams()
  const location = useLocation()
  const { search, hash } = location
  const navigationState = location.state as unknown
  if (!targetTenant) return null
  if (
    new URLSearchParams(search).get('labels') === '1' &&
    (warehouseId || zoneId || sectionId)
  )
    return (
      <LegacyLocationLabelsRedirect
        target={{
          kind: sectionId ? 'shelf' : zoneId ? 'section' : 'zone',
          parentId: (sectionId ?? zoneId ?? warehouseId)!,
        }}
      />
    )
  const suffix =
    warehouseId ??
    (zoneId ? `zones/${zoneId}` : sectionId ? `sections/${sectionId}` : '')
  return (
    <Navigate
      replace
      state={navigationState}
      to={`${cabinetPath(targetTenant.slug, 'warehouses', suffix)}${search}${hash}`}
    />
  )
}
