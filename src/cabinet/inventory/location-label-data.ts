import { inventoryApi } from '@/api/inventory'
import type { LocationLabelTarget } from './location-label-queue'
import type { PrintableZoneLabel } from './zone-label-output'

/** Resolve a real active parent before querying its direct printable children. */
export async function loadLocationLabelCollection(
  collection: Pick<LocationLabelTarget, 'kind' | 'parentId'>,
  signal: AbortSignal,
): Promise<{ target: LocationLabelTarget; labels: PrintableZoneLabel[] }> {
  if (collection.kind === 'warehouse')
    return loadStorageStickerCatalogue(collection, signal)
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
  if (target.kind === 'warehouse')
    return (await loadStorageStickerCatalogue(target, signal)).labels
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
        parentId: x.warehouseId,
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
        parentId: x.zoneId,
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
      parentId: x.sectionId,
      qrCode: x.qrCode,
      zoneName: x.name,
      zoneCode: x.code,
      warehouseName: x.warehouseName,
      kind: 'shelf',
      path: [x.warehouseName, x.zoneName, x.sectionName, x.name],
    }))
}

/** Full warehouse catalogue for queue resolution; screens scope their selection lists. */
export async function loadStorageStickerCatalogue(
  collection: Pick<LocationLabelTarget, 'kind' | 'parentId'>,
  signal: AbortSignal,
): Promise<{ target: LocationLabelTarget; labels: PrintableZoneLabel[] }> {
  if (!collection.parentId.trim()) throw new Error('invalid-location-parent')
  const options = { signal }
  let warehouseId = collection.parentId
  if (collection.kind === 'section') {
    const zone = await inventoryApi.getZone(collection.parentId, options)
    if (
      zone.id !== collection.parentId ||
      !zone.isActive ||
      zone.isSystemUnassigned
    )
      throw new Error('unavailable-location-parent')
    warehouseId = zone.warehouseId
  } else if (collection.kind === 'shelf') {
    const section = await inventoryApi.getSection(collection.parentId, options)
    if (section.id !== collection.parentId || !section.isActive)
      throw new Error('unavailable-location-parent')
    const zone = await inventoryApi.getZone(section.zoneId, options)
    if (
      zone.id !== section.zoneId ||
      !zone.isActive ||
      zone.isSystemUnassigned ||
      zone.warehouseId !== section.warehouseId
    )
      throw new Error('unavailable-location-ancestor')
    warehouseId = section.warehouseId
  }
  const warehouse = await inventoryApi.getWarehouse(warehouseId, options)
  if (signal.aborted || warehouse.id !== warehouseId || !warehouse.isActive)
    throw new Error('unavailable-location-ancestor')
  const [allZones, allSections, allShelves] = await Promise.all([
    inventoryApi.getZones({ warehouseId, activeOnly: true, signal }),
    inventoryApi.getSections(undefined, options),
    inventoryApi.getShelves(undefined, options),
  ])
  if (signal.aborted) throw new Error('location-request-aborted')
  const zones = allZones.filter(
    (x) => x.warehouseId === warehouseId && x.isActive && !x.isSystemUnassigned,
  )
  const zoneIds = new Set(zones.map((x) => x.id))
  const sections = allSections.filter(
    (x) => x.warehouseId === warehouseId && x.isActive && zoneIds.has(x.zoneId),
  )
  const sectionById = new Map(sections.map((x) => [x.id, x]))
  const shelves = allShelves.filter(
    (x) =>
      x.warehouseId === warehouseId &&
      x.isActive &&
      sectionById.get(x.sectionId)?.zoneId === x.zoneId,
  )
  const labels: PrintableZoneLabel[] = [
    ...zones.map((x) => ({
      id: x.id,
      parentId: warehouseId,
      kind: 'zone' as const,
      qrCode: x.qrCode,
      zoneName: x.name,
      zoneCode: x.code,
      warehouseName: warehouse.name,
      path: [warehouse.name, x.name],
    })),
    ...sections.map((x) => ({
      id: x.id,
      parentId: x.zoneId,
      kind: 'section' as const,
      qrCode: x.qrCode,
      zoneName: x.name,
      zoneCode: x.code,
      warehouseName: warehouse.name,
      path: [warehouse.name, x.zoneName, x.name],
    })),
    ...shelves.map((x) => ({
      id: x.id,
      parentId: x.sectionId,
      kind: 'shelf' as const,
      qrCode: x.qrCode,
      zoneName: x.name,
      zoneCode: x.code,
      warehouseName: warehouse.name,
      path: [warehouse.name, x.zoneName, x.sectionName, x.name],
    })),
  ]
  return {
    target: {
      kind: 'warehouse',
      parentId: warehouseId,
      parentName: warehouse.name,
    },
    labels: labels.filter((x) => x.qrCode.trim()),
  }
}
