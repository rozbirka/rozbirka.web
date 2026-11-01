import { expect, it, vi } from 'vitest'
import {
  loadStorageStickerCatalogue,
  loadLocationLabels,
  loadLocationLabelCollection,
} from './location-label-data'
const api = vi.hoisted(() => ({
  getWarehouse: vi.fn(),
  getZone: vi.fn(),
  getSection: vi.fn(),
  getZones: vi.fn(),
  getSections: vi.fn(),
  getShelves: vi.fn(),
}))
vi.mock('@/api/inventory', () => ({ inventoryApi: api }))
const base = {
  id: 'ok',
  name: 'Name',
  code: 'A',
  qrCode: 'raw-qr',
  warehouseId: 'w',
  warehouseName: 'Warehouse',
  zoneId: 'z',
  zoneName: 'Zone',
  sectionId: 's',
  sectionName: 'Section',
  isActive: true,
}
it('loads only active physical zones of this warehouse', async () => {
  api.getZones.mockResolvedValue([
    base,
    { ...base, id: 'foreign', warehouseId: 'other' },
    { ...base, id: 'system', isSystemUnassigned: true },
    { ...base, id: 'archived', isActive: false },
  ])
  expect(
    await loadLocationLabels(
      { kind: 'zone', parentId: 'w', parentName: '' },
      new AbortController().signal,
    ),
  ).toEqual([
    expect.objectContaining({ id: 'ok', kind: 'zone', qrCode: 'raw-qr' }),
  ])
})
it('does not mix sections and shelves or other parents', async () => {
  api.getSections.mockResolvedValue([
    base,
    { ...base, id: 'other', zoneId: 'other' },
  ])
  api.getShelves.mockResolvedValue([
    base,
    { ...base, id: 'other', sectionId: 'other' },
  ])
  expect(
    (
      await loadLocationLabels(
        { kind: 'section', parentId: 'z', parentName: '' },
        new AbortController().signal,
      )
    ).map((x) => x.id),
  ).toEqual(['ok'])
  expect(
    (
      await loadLocationLabels(
        { kind: 'shelf', parentId: 's', parentName: '' },
        new AbortController().signal,
      )
    ).map((x) => x.id),
  ).toEqual(['ok'])
  expect(api.getShelves).toHaveBeenCalledWith(undefined, expect.anything(), 's')
})

it('resolves the real parent and excludes unprintable children', async () => {
  api.getSection.mockResolvedValue({
    id: 's',
    name: 'Rack 4',
    isActive: true,
    zoneId: 'z',
    warehouseId: 'w',
  })
  api.getZone.mockResolvedValue({
    id: 'z',
    isActive: true,
    warehouseId: 'w',
    isSystemUnassigned: false,
  })
  api.getWarehouse.mockResolvedValue({ id: 'w', isActive: true })
  api.getShelves.mockResolvedValue([
    base,
    { ...base, id: 'empty', qrCode: ' ' },
  ])
  const result = await loadLocationLabelCollection(
    { kind: 'shelf', parentId: 's' },
    new AbortController().signal,
  )
  expect(result.target).toEqual({
    kind: 'shelf',
    parentId: 's',
    parentName: 'Rack 4',
  })
  expect(result.labels.map((x) => x.id)).toEqual(['ok'])
})

it('does not print active sections inside an inactive warehouse', async () => {
  api.getZone.mockResolvedValue({
    id: 'z',
    name: 'Zone',
    isActive: true,
    warehouseId: 'w',
  })
  api.getWarehouse.mockResolvedValue({ id: 'w', isActive: false })
  api.getSections.mockResolvedValue([base])
  await expect(
    loadLocationLabelCollection(
      { kind: 'section', parentId: 'z' },
      new AbortController().signal,
    ),
  ).rejects.toThrow()
})

it('does not print active shelves inside an archived or foreign ancestor zone', async () => {
  api.getSection.mockResolvedValue({
    id: 's',
    name: 'Section',
    isActive: true,
    zoneId: 'z',
    warehouseId: 'w',
  })
  api.getWarehouse.mockResolvedValue({ id: 'w', isActive: true })
  api.getZone.mockResolvedValue({ id: 'z', isActive: false, warehouseId: 'w' })
  api.getShelves.mockResolvedValue([base])
  await expect(
    loadLocationLabelCollection(
      { kind: 'shelf', parentId: 's' },
      new AbortController().signal,
    ),
  ).rejects.toThrow()
  api.getZone.mockResolvedValue({
    id: 'z',
    isActive: true,
    warehouseId: 'foreign',
  })
  await expect(
    loadLocationLabelCollection(
      { kind: 'shelf', parentId: 's' },
      new AbortController().signal,
    ),
  ).rejects.toThrow()
})

it('rejects archived and mismatched parents before returning any printable list', async () => {
  api.getZone.mockResolvedValue({ id: 'z', name: 'Zone', isActive: false })
  await expect(
    loadLocationLabelCollection(
      { kind: 'section', parentId: 'z' },
      new AbortController().signal,
    ),
  ).rejects.toThrow()
  api.getWarehouse.mockResolvedValue({
    id: 'other',
    name: 'Wrong',
    isActive: true,
  })
  await expect(
    loadLocationLabelCollection(
      { kind: 'zone', parentId: 'w' },
      new AbortController().signal,
    ),
  ).rejects.toThrow()
})

it('lists zones, sections and shelves in order, excluding foreign and inactive ancestry', async () => {
  api.getWarehouse.mockResolvedValue({
    id: 'w',
    name: 'Warehouse',
    isActive: true,
  })
  api.getZones.mockResolvedValue([
    { ...base, id: 'z' },
    { ...base, id: 'inactive', isActive: false },
    { ...base, id: 'system', isSystemUnassigned: true },
    { ...base, id: 'foreign', warehouseId: 'other' },
  ])
  api.getSections.mockResolvedValue([
    { ...base, id: 's' },
    { ...base, id: 'hidden', zoneId: 'inactive' },
    { ...base, id: 'foreign-section', warehouseId: 'other' },
  ])
  api.getShelves.mockResolvedValue([
    { ...base, id: 'shelf' },
    { ...base, id: 'hidden-shelf', sectionId: 'hidden' },
    { ...base, id: 'bad-zone', zoneId: 'foreign' },
    { ...base, id: 'blank', qrCode: ' ' },
  ])
  const result = await loadStorageStickerCatalogue(
    { kind: 'warehouse', parentId: 'w' },
    new AbortController().signal,
  )
  expect(result.target).toEqual({
    kind: 'warehouse',
    parentId: 'w',
    parentName: 'Warehouse',
  })
  expect(
    result.labels.map(({ id, kind, parentId }) => ({ id, kind, parentId })),
  ).toEqual([
    { id: 'z', kind: 'zone', parentId: 'w' },
    { id: 's', kind: 'section', parentId: 'z' },
    { id: 'shelf', kind: 'shelf', parentId: 's' },
  ])
})
