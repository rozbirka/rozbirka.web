import { expect, it, vi } from 'vitest'
import { loadLocationLabels } from './location-label-data'
const api = vi.hoisted(() => ({
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
