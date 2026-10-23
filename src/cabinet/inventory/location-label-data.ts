import { inventoryApi } from '@/api/inventory'
import type { LocationLabelTarget } from './location-label-queue'
import type { PrintableZoneLabel } from './zone-label-output'

/** Fetch current labels for exactly one location collection. */
export async function loadLocationLabels(
  target: LocationLabelTarget,
  signal: AbortSignal,
): Promise<PrintableZoneLabel[]> {
  const options = { signal }
  if (target.kind === 'zone') {
    return (
      await inventoryApi.getZones({
        warehouseId: target.parentId,
        activeOnly: true,
        signal,
      })
    )
      .filter(
        (x) =>
          x.warehouseId === target.parentId &&
          x.isActive &&
          !x.isSystemUnassigned,
      )
      .map((x) => ({
        id: x.id,
        qrCode: x.qrCode,
        zoneName: x.name,
        zoneCode: x.code,
        warehouseName: x.warehouseName,
        kind: 'zone',
        path: [x.warehouseName, x.name],
      }))
  }
  if (target.kind === 'section') {
    return (await inventoryApi.getSections(target.parentId, options))
      .filter((x) => x.zoneId === target.parentId && x.isActive)
      .map((x) => ({
        id: x.id,
        qrCode: x.qrCode,
        zoneName: x.name,
        zoneCode: x.code,
        warehouseName: x.warehouseName,
        kind: 'section',
        path: [x.warehouseName, x.zoneName, x.name],
      }))
  }
  return (await inventoryApi.getShelves(undefined, options, target.parentId))
    .filter((x) => x.sectionId === target.parentId && x.isActive)
    .map((x) => ({
      id: x.id,
      qrCode: x.qrCode,
      zoneName: x.name,
      zoneCode: x.code,
      warehouseName: x.warehouseName,
      kind: 'shelf',
      path: [x.warehouseName, x.zoneName, x.sectionName, x.name],
    }))
}
