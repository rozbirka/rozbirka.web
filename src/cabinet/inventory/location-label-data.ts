import { inventoryApi } from '@/api/inventory'
import type { LocationLabelTarget } from './location-label-queue'
import type { PrintableZoneLabel } from './zone-label-output'

/** Resolve a real active parent before querying its direct printable children. */
export async function loadLocationLabelCollection(
  collection: Pick<LocationLabelTarget, 'kind' | 'parentId'>,
  signal: AbortSignal,
): Promise<{ target: LocationLabelTarget; labels: PrintableZoneLabel[] }> {
  if (!collection.parentId.trim()) throw new Error('invalid-location-parent')
  const options = { signal }
  const parent =
    collection.kind === 'zone'
      ? await inventoryApi.getWarehouse(collection.parentId, options)
      : collection.kind === 'section'
        ? await inventoryApi.getZone(collection.parentId, options)
        : await inventoryApi.getSection(collection.parentId, options)
  if (
    signal.aborted ||
    parent.id !== collection.parentId ||
    !parent.isActive ||
    ('isSystemUnassigned' in parent && parent.isSystemUnassigned)
  )
    throw new Error('unavailable-location-parent')
  if (collection.kind !== 'zone' && 'warehouseId' in parent) {
    const warehouseId = parent.warehouseId
    const warehouse = await inventoryApi.getWarehouse(warehouseId, options)
    if (signal.aborted || warehouse.id !== warehouseId || !warehouse.isActive)
      throw new Error('unavailable-location-ancestor')
    if (collection.kind === 'shelf' && 'zoneId' in parent) {
      const zone = await inventoryApi.getZone(parent.zoneId, options)
      if (
        signal.aborted ||
        zone.id !== parent.zoneId ||
        zone.warehouseId !== warehouseId ||
        !zone.isActive ||
        zone.isSystemUnassigned
      )
        throw new Error('unavailable-location-ancestor')
    }
  }
  const target = { ...collection, parentName: parent.name }
  const labels = await loadLocationLabels(target, signal)
  if (signal.aborted) throw new Error('location-request-aborted')
  return {
    target,
    labels: labels.filter((label) => Boolean(label.qrCode.trim())),
  }
}

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
