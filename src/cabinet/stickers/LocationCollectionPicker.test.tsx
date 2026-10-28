import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type {
  InventorySection,
  InventoryZone,
  Warehouse,
} from '@/api/inventory'
import { LocationCollectionPicker } from './LocationCollectionPicker'

const api = vi.hoisted(() => ({
  getWarehouses: vi.fn(),
  getZones: vi.fn(),
  getSections: vi.fn(),
}))
vi.mock('@/api/inventory', () => ({ inventoryApi: api }))
const warehouse = (id: string, name: string, isActive = true): Warehouse => ({
  id,
  name,
  code: id,
  isActive,
  isSystemDefault: false,
  qrCode: `qr:${id}`,
  tenantId: 't',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  zoneCount: 1,
})
const zone = (
  id: string,
  name: string,
  warehouseId = 'w1',
  overrides: Partial<InventoryZone> = {},
): InventoryZone => ({
  id,
  name,
  warehouseId,
  warehouseName: 'Warehouse 1',
  code: id,
  qrCode: `qr:${id}`,
  isActive: true,
  isSystemUnassigned: false,
  tenantId: 't',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...overrides,
})
const section = (
  id: string,
  name: string,
  overrides: Partial<InventorySection> = {},
): InventorySection => ({
  id,
  name,
  code: id,
  qrCode: `qr:${id}`,
  isActive: true,
  zoneId: 'z1',
  zoneName: 'Zone 1',
  warehouseId: 'w1',
  warehouseName: 'Warehouse 1',
  partCount: null,
  ...overrides,
})
const choose = () => screen.getByRole('button', { name: 'Показати стікери' })
const combo = (name: string) => screen.getByRole('combobox', { name })
beforeEach(() => {
  vi.resetAllMocks()
  api.getWarehouses.mockResolvedValue([
    warehouse('w1', 'Warehouse 1'),
    warehouse('w2', 'Warehouse 2'),
    warehouse('archived', 'Archived warehouse', false),
  ])
  api.getZones.mockResolvedValue([
    zone('z1', 'Zone 1'),
    zone('wrong-warehouse', 'Foreign zone', 'w2'),
    zone('archived-zone', 'Archived zone', 'w1', { isActive: false }),
    zone('system', 'Unassigned', 'w1', { isSystemUnassigned: true }),
  ])
  api.getSections.mockResolvedValue([
    section('s1', 'Section 1'),
    section('other-zone', 'Foreign section', { zoneId: 'other' }),
    section('other-warehouse', 'Foreign warehouse section', {
      warehouseId: 'w2',
    }),
    section('archived-section', 'Archived section', { isActive: false }),
  ])
})

it('requires an active warehouse and submits its direct zone collection', async () => {
  const user = userEvent.setup()
  const onChoose = vi.fn()
  render(<LocationCollectionPicker onChoose={onChoose} />)
  expect(choose()).toBeDisabled()
  await waitFor(() => expect(combo('Склад')).toBeEnabled())
  expect(
    screen.queryByRole('option', { name: 'Archived warehouse' }),
  ).not.toBeInTheDocument()
  await user.selectOptions(combo('Склад'), 'w1')
  await waitFor(() => expect(choose()).toBeEnabled())
  await user.click(choose())
  expect(onChoose).toHaveBeenCalledWith({ kind: 'zone', parentId: 'w1' })
})

it('filters foreign, inactive and system parents before choosing a shelf collection', async () => {
  const user = userEvent.setup()
  const onChoose = vi.fn()
  render(<LocationCollectionPicker onChoose={onChoose} />)
  await waitFor(() => expect(combo('Склад')).toBeEnabled())
  await user.selectOptions(combo('Що друкуємо'), 'shelf')
  await waitFor(() => expect(combo('Склад')).toBeEnabled())
  expect(combo('Зона')).toBeDisabled()
  expect(combo('Секція')).toBeDisabled()
  await user.selectOptions(combo('Склад'), 'w1')
  await waitFor(() => expect(combo('Зона')).toBeEnabled())
  expect(
    within(combo('Зона'))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Оберіть…', 'Zone 1'])
  await user.selectOptions(combo('Зона'), 'z1')
  await waitFor(() => expect(combo('Секція')).toBeEnabled())
  expect(
    within(combo('Секція'))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Оберіть…', 'Section 1'])
  await user.selectOptions(combo('Секція'), 's1')
  await user.click(choose())
  expect(onChoose).toHaveBeenCalledWith({ kind: 'shelf', parentId: 's1' })
  await user.selectOptions(combo('Склад'), 'w2')
  await waitFor(() => expect(combo('Зона')).toBeEnabled())
  expect(combo('Зона')).toHaveValue('')
  expect(combo('Секція')).toHaveValue('')
  expect(choose()).toBeDisabled()
})

it('resets descendant choices when switching kind and submits the selected zone for sections', async () => {
  const user = userEvent.setup()
  const onChoose = vi.fn()
  render(<LocationCollectionPicker onChoose={onChoose} />)
  await waitFor(() => expect(combo('Склад')).toBeEnabled())
  await user.selectOptions(combo('Склад'), 'w1')
  await waitFor(() => expect(choose()).toBeEnabled())
  await user.selectOptions(combo('Що друкуємо'), 'section')
  await waitFor(() => expect(combo('Зона')).toBeEnabled())
  expect(choose()).toBeDisabled()
  await user.selectOptions(combo('Зона'), 'z1')
  await user.click(choose())
  expect(onChoose).toHaveBeenCalledWith({ kind: 'section', parentId: 'z1' })
  await user.selectOptions(combo('Що друкуємо'), 'shelf')
  await waitFor(() => expect(combo('Зона')).toBeEnabled())
  expect(combo('Зона')).toHaveValue('')
  expect(combo('Секція')).toBeDisabled()
  expect(choose()).toBeDisabled()
})

it('keeps submission disabled after a failed load and recovers through retry', async () => {
  api.getWarehouses.mockRejectedValueOnce(new Error('offline'))
  const user = userEvent.setup()
  render(<LocationCollectionPicker onChoose={vi.fn()} />)
  await screen.findByText(
    'Не вдалося визначити список місць зберігання. Оберіть його знову.',
  )
  expect(choose()).toBeDisabled()
  await user.click(screen.getByRole('button', { name: /Спробувати|Повторити/ }))
  await waitFor(() => expect(combo('Склад')).toBeEnabled())
  await user.selectOptions(combo('Склад'), 'w1')
  await waitFor(() => expect(choose()).toBeEnabled())
})

it('ignores an old warehouse response after the parent changes', async () => {
  let resolveOld: ((zones: InventoryZone[]) => void) | undefined
  api.getZones.mockImplementation(({ warehouseId }: { warehouseId: string }) =>
    warehouseId === 'w1'
      ? new Promise<InventoryZone[]>((resolve) => {
          resolveOld = resolve
        })
      : Promise.resolve([zone('z2', 'Zone 2', 'w2')]),
  )
  const user = userEvent.setup()
  render(<LocationCollectionPicker onChoose={vi.fn()} />)
  await waitFor(() => expect(combo('Склад')).toBeEnabled())
  await user.selectOptions(combo('Склад'), 'w1')
  await waitFor(() => expect(choose()).toBeEnabled())
  await user.selectOptions(combo('Що друкуємо'), 'section')
  await waitFor(() => expect(resolveOld).toBeDefined())
  // The type remains available while a parent request is pending.
  await user.selectOptions(combo('Що друкуємо'), 'zone')
  await waitFor(() => expect(combo('Склад')).toBeEnabled())
  await user.selectOptions(combo('Склад'), 'w2')
  await waitFor(() => expect(choose()).toBeEnabled())
  await user.selectOptions(combo('Що друкуємо'), 'section')
  await waitFor(() => expect(combo('Зона')).toBeEnabled())
  await act(async () => {
    resolveOld?.([zone('stale', 'Stale zone')])
    await Promise.resolve()
  })
  expect(
    within(combo('Зона'))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Оберіть…', 'Zone 2'])
})
