import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/app'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LocationStickersScreen } from './LocationStickersScreen'
import { locationQueueStore } from './location-queue-store'
import { tenantResetRegistry } from '../tenant-reset-registry'
import type { InventoryZone } from '@/api/inventory'
import type { buildZoneLabelHtml } from '../inventory/zone-label-output'
import { labelQueueKey } from '../inventory/location-label-queue'

const api = vi.hoisted(() => ({
  getSections: vi.fn(),
  getZone: vi.fn(),
  getWarehouses: vi.fn(),
  getZones: vi.fn(),
  getShelves: vi.fn(),
  getSection: vi.fn(),
  getWarehouse: vi.fn(),
}))
const output = vi.hoisted(() => ({
  buildZoneLabelHtml: vi
    .fn<typeof buildZoneLabelHtml>()
    .mockResolvedValue('<html>labels</html>'),
}))
const session = vi.hoisted(() => ({
  tenantId: 't',
  generation: 1,
  signal: new AbortController().signal,
}))
vi.mock('@/api/inventory', () => ({ inventoryApi: api }))
vi.mock('../inventory/zone-label-output', () => output)
vi.mock('@/auth/useTenantSettings', () => ({
  useTenantSettings: () => ({ documentLanguage: 'uk' }),
}))
vi.mock('../use-latest-mutation-guard', () => ({
  useLatestMutationGuard: () => ({
    requireLatestMutation: () => ({
      signal: session.signal,
      tenantId: session.tenantId,
      generation: session.generation,
    }),
  }),
}))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: { id: session.tenantId, slug: 'test' },
    snapshot: {
      userId: 'u',
      tenantId: session.tenantId,
      generation: session.generation,
      permissions: new Set(['inventory.view']),
    },
  }),
}))
const zoneRecord = (id = 'z', name = 'Zone'): InventoryZone => ({
  id,
  name,
  code: id,
  qrCode: `qr:${id}`,
  isActive: true,
  isSystemUnassigned: false,
  warehouseId: 'w',
  warehouseName: 'Warehouse',
  tenantId: session.tenantId,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
})
const records = Array.from({ length: 25 }, (_, i) => ({
  id: `s${i}`,
  name: `Section ${i + 1}`,
  code: `A${i + 1}`,
  qrCode: `raw:${i}`,
  isActive: true,
  zoneId: 'z',
  warehouseId: 'w',
  warehouseName: 'Warehouse',
  zoneName: 'Zone',
  partCount: null,
}))
const print = vi.fn(),
  close = vi.fn(),
  write = vi.fn()
const mount = (query = '?type=locations&kind=section&parent=z&select=all') =>
  render(
    <MemoryRouter initialEntries={[`/app/test/stickers${query}`]}>
      <ToastProvider>
        <LocationStickersScreen />
      </ToastProvider>
    </MemoryRouter>,
  )
beforeEach(() => {
  locationQueueStore.clear()
  localStorage.clear()
  vi.resetAllMocks()
  session.tenantId = 't'
  session.generation = 1
  session.signal = new AbortController().signal
  api.getZone.mockResolvedValue(zoneRecord())
  api.getWarehouse.mockResolvedValue({
    id: 'w',
    name: 'Warehouse',
    isActive: true,
  })
  api.getSections.mockResolvedValue(records)
  api.getWarehouses.mockResolvedValue([
    { id: 'w', name: 'Warehouse', isActive: true },
  ])
  api.getZones.mockResolvedValue([zoneRecord()])
  api.getShelves.mockResolvedValue([])
  output.buildZoneLabelHtml.mockResolvedValue('<html>labels</html>')
  vi.spyOn(window, 'open').mockReturnValue({
    opener: null,
    document: { write, close: vi.fn() },
    focus: vi.fn(),
    print,
    close,
  } as unknown as Window)
})

it('uses the same sticker header, list selection and ten-row pagination as parts', async () => {
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=z')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Стікери' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      'QR-стікери для запчастин і місць зберігання. Оберіть потрібні та підготуйте до друку.',
    ),
  ).toBeInTheDocument()
  expect(
    await screen.findByRole('listitem', { name: 'Обрати: Section 9' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('listitem', { name: 'Обрати: Section 11' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Вибрати всі' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Зняти' })).toBeDisabled()
  await user.click(screen.getByRole('listitem', { name: 'Обрати: Section 1' }))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Зняти' }))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Вибрати всі' }))
  expect(
    screen.getByText('Вибрано 10 обʼєктів · 10 стікерів'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 11' }),
  ).not.toBeChecked()
})

it('opens a storage list directly without a blocking collection form', async () => {
  mount('?type=locations')
  expect(
    await screen.findByRole('listitem', { name: 'Обрати: Zone' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('searchbox', { name: 'Назва місця зберігання' }),
  ).toBeEnabled()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Показати стікери' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Підготувати 0' })).toBeDisabled()
})

it('preselects the collection once and creates a queue without printing', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(
    await screen.findByRole('button', { name: 'Підготувати 25' }),
  )
  expect(
    screen.getByText('0 з 25 надруковано · 25 залишилось'),
  ).toBeInTheDocument()
  expect(print).not.toHaveBeenCalled()
  expect(locationQueueStore.getSnapshot().queue?.remainingIds).toHaveLength(25)
  expect(screen.getByText('Стікерів').nextElementSibling).toHaveTextContent(
    '20',
  )
})

it('prints twenty, confirms only chosen labels and restores eighteen remaining after reload', async () => {
  const user = userEvent.setup()
  const view = mount()
  await user.click(
    await screen.findByRole('button', { name: 'Підготувати 25' }),
  )
  await user.click(screen.getByRole('button', { name: 'Друк наступних 20' }))
  await waitFor(() => expect(print).toHaveBeenCalledOnce())
  expect(output.buildZoneLabelHtml.mock.calls[0]?.[0]).toHaveLength(20)
  expect(locationQueueStore.getSnapshot().queue?.remainingIds).toHaveLength(25)
  await user.click(screen.getByRole('button', { name: 'Частково' }))
  const editor = screen.getByRole('dialog')
  for (const i of [0, 2, 4, 6, 8, 10, 12])
    await user.click(
      within(editor).getByRole('checkbox', { name: `Section ${i + 1}` }),
    )
  await user.click(
    within(editor).getByRole('button', { name: 'Підтвердити · 7' }),
  )
  expect(locationQueueStore.getSnapshot().queue?.remainingIds).toHaveLength(18)
  view.unmount()
  mount('?type=locations')
  expect(
    await screen.findByText('7 з 25 надруковано · 18 залишилось'),
  ).toBeInTheDocument()
})

it('PDF and blocked popups never advance the queue', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(
    await screen.findByRole('button', { name: 'Підготувати 25' }),
  )
  await user.click(screen.getByRole('button', { name: 'PDF наступних 20' }))
  await waitFor(() => expect(print).toHaveBeenCalledOnce())
  expect(
    screen.queryByRole('button', { name: 'Усі надруковано' }),
  ).not.toBeInTheDocument()
  expect(locationQueueStore.getSnapshot().queue?.remainingIds).toHaveLength(25)
  vi.mocked(window.open).mockReturnValue(null)
  await user.click(screen.getByRole('button', { name: 'Друк наступних 20' }))
  expect(await screen.findByText(/Браузер заблокував/)).toBeInTheDocument()
  expect(locationQueueStore.getSnapshot().queue?.remainingIds).toHaveLength(25)
})

it('keeps manually deselected rows across search changes and blocks oversized queues', async () => {
  api.getSections.mockResolvedValue(
    Array.from({ length: 201 }, (_, i) => ({
      ...records[0],
      id: `s${i}`,
      name: `Section ${i + 1}`,
    })),
  )
  mount()
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Підготувати 201' }),
    ).toBeDisabled(),
  )
  fireEvent.click(screen.getByRole('checkbox', { name: 'Обрати: Section 1' }))
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Назва місця зберігання' }),
    {
      target: { value: 'Section 1' },
    },
  )
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Підготувати 200' })).toBeEnabled()
})

it('rejects a stale confirmation after tenant cleanup', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(
    await screen.findByRole('button', { name: 'Підготувати 25' }),
  )
  await user.click(screen.getByRole('button', { name: 'Друк наступних 20' }))
  await waitFor(() => expect(print).toHaveBeenCalledOnce())
  await act(() => tenantResetRegistry.clear({ userId: 'u', tenantId: 't' }))
  expect(locationQueueStore.getSnapshot().queue).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Усі надруковано' }),
  ).not.toBeInTheDocument()
})

it('appends only new selections to the existing collection and prevents selecting queued rows', async () => {
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=z&label=s0&label=s1')
  await user.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  const queueId = locationQueueStore.getSnapshot().queue!.id
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Section 2' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: 'Обрати: Section 3' }))
  await user.click(screen.getByRole('button', { name: 'Додати до черги · 1' }))
  expect(locationQueueStore.getSnapshot().queue).toMatchObject({
    id: queueId,
    remainingIds: ['s0', 's1', 's2'],
    totalCount: 3,
    printedCount: 0,
  })
  expect(print).not.toHaveBeenCalled()
})

it('requires cancel confirmation and dismissing the dialog preserves the queue', async () => {
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=z&label=s0&label=s1')
  await user.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  const initial = locationQueueStore.getSnapshot().queue
  await user.click(screen.getByRole('button', { name: 'Скасувати чергу' }))
  let dialog = screen.getByRole('dialog', { name: 'Скасувати чергу друку?' })
  await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }))
  expect(locationQueueStore.getSnapshot().queue).toBe(initial)
  await user.click(screen.getByRole('button', { name: 'Скасувати чергу' }))
  dialog = screen.getByRole('dialog', { name: 'Скасувати чергу друку?' })
  await user.click(
    within(dialog).getByRole('button', {
      name: 'Скасувати чергу',
    }),
  )
  expect(locationQueueStore.getSnapshot().queue).toBeNull()
  expect(
    screen.queryByRole('region', { name: 'Активна черга' }),
  ).not.toBeInTheDocument()
})

it('removes searched selections without printing them and clears the final queued label', async () => {
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=z&label=s0&label=s1&label=s2')
  await user.click(await screen.findByRole('button', { name: 'Підготувати 3' }))
  await user.click(screen.getByRole('button', { name: 'Змінити чергу' }))
  let editor = screen.getByRole('dialog')
  await user.click(within(editor).getByRole('checkbox', { name: 'Section 1' }))
  await user.type(
    within(editor).getByRole('searchbox', { name: 'Пошук у черзі' }),
    'Section 3',
  )
  await user.click(within(editor).getByRole('checkbox', { name: 'Section 3' }))
  await user.click(
    within(editor).getByRole('button', { name: 'Прибрати з черги · 2' }),
  )
  expect(locationQueueStore.getSnapshot().queue).toMatchObject({
    remainingIds: ['s1'],
    totalCount: 1,
    printedCount: 0,
  })
  await user.click(screen.getByRole('button', { name: 'Змінити чергу' }))
  editor = screen.getByRole('dialog')
  await user.click(within(editor).getByRole('checkbox', { name: 'Section 2' }))
  await user.click(
    within(editor).getByRole('button', { name: 'Прибрати з черги · 1' }),
  )
  expect(locationQueueStore.getSnapshot().queue).toBeNull()
  expect(
    screen.getByText('У черзі більше немає позицій.').closest('.rz-toast'),
  ).not.toBeNull()
  expect(print).not.toHaveBeenCalled()
})

it('rejects an unavailable member of the next batch without printing any labels or advancing progress', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(
    await screen.findByRole('button', { name: 'Підготувати 25' }),
  )
  api.getSections.mockResolvedValue(
    records.map((record, index) =>
      index === 2 ? { ...record, isActive: false } : record,
    ),
  )
  await user.click(screen.getByRole('button', { name: 'Друк наступних 20' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(print).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
  expect(output.buildZoneLabelHtml).not.toHaveBeenCalled()
  expect(locationQueueStore.getSnapshot().queue).toMatchObject({
    remainingIds: records.map((record) => record.id),
    printedCount: 0,
    totalCount: 25,
  })
  expect(
    screen.queryByRole('button', { name: 'Усі надруковано' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByText(
      'Не вдалося підготувати друк. Вибір збережено, спробуйте ще раз.',
    ),
  ).toBeInTheDocument()
})

it('does not block a valid next batch for an unavailable label outside that batch', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(
    await screen.findByRole('button', { name: 'Підготувати 25' }),
  )
  api.getSections.mockResolvedValue(
    records.filter((record) => record.id !== 's24'),
  )
  await user.click(screen.getByRole('button', { name: 'Друк наступних 20' }))
  await waitFor(() => expect(print).toHaveBeenCalledOnce())
  expect(output.buildZoneLabelHtml.mock.calls[0]?.[0]).toHaveLength(20)
  await user.click(screen.getByRole('button', { name: 'Усі надруковано' }))
  expect(locationQueueStore.getSnapshot().queue).toMatchObject({
    remainingIds: ['s20', 's21', 's22', 's23', 's24'],
    printedCount: 20,
    totalCount: 25,
  })
})

it('keeps the queue unchanged when the user reports that nothing printed', async () => {
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=z&label=s0&label=s1')
  await user.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  const initial = locationQueueStore.getSnapshot().queue
  await user.click(screen.getByRole('button', { name: 'Друк наступних 2' }))
  await waitFor(() => expect(print).toHaveBeenCalledOnce())
  await user.click(
    screen.getByRole('button', { name: 'Нічого не надруковано' }),
  )
  expect(locationQueueStore.getSnapshot().queue).toBe(initial)
  expect(
    screen.queryByRole('button', { name: 'Усі надруковано' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Друк наступних 2' })).toBeEnabled()
})

it('closes a late prepared output after a tenant switch and cannot confirm it', async () => {
  let resolveHtml: ((html: string) => void) | undefined
  output.buildZoneLabelHtml.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        resolveHtml = resolve
      }),
  )
  const user = userEvent.setup()
  const view = mount('?type=locations&kind=section&parent=z&label=s0&label=s1')
  await user.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  await user.click(screen.getByRole('button', { name: 'Друк наступних 2' }))
  await waitFor(() => expect(resolveHtml).toBeDefined())
  session.tenantId = 'next'
  session.generation = 2
  view.rerender(
    <MemoryRouter
      initialEntries={[
        '/app/test/stickers?type=locations&kind=section&parent=z',
      ]}
    >
      <LocationStickersScreen />
    </MemoryRouter>,
  )
  await act(async () => {
    resolveHtml?.('<html>old tenant labels</html>')
    await Promise.resolve()
  })
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(write).not.toHaveBeenCalled()
  expect(print).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('button', { name: 'Усі надруковано' }),
  ).not.toBeInTheDocument()
  expect(locationQueueStore.getSnapshot().scope?.tenantId).toBe('next')
  expect(locationQueueStore.getSnapshot().queue).toBeNull()
})

it('invalidates a pending async output when the same queue changes in another tab', async () => {
  let resolveHtml: ((html: string) => void) | undefined
  output.buildZoneLabelHtml.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        resolveHtml = resolve
      }),
  )
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=z&label=s0&label=s1')
  await user.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  await user.click(screen.getByRole('button', { name: 'Друк наступних 2' }))
  await waitFor(() => expect(resolveHtml).toBeDefined())
  act(() => {
    const queue = locationQueueStore.getSnapshot().queue!
    const key = labelQueueKey('u', 't')
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        owner: { userId: 'u', tenantId: 't' },
        queue: { ...queue, remainingIds: ['s0', 's1', 's2'], totalCount: 3 },
      }),
    )
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
  await act(async () => {
    resolveHtml?.('<html>stale revision labels</html>')
    await Promise.resolve()
  })
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(write).not.toHaveBeenCalled()
  expect(print).not.toHaveBeenCalled()
  expect(locationQueueStore.getSnapshot().queue?.remainingIds).toEqual([
    's0',
    's1',
    's2',
  ])
})

it('continues a legacy queue from another warehouse and upgrades it without losing progress', async () => {
  api.getZone.mockImplementation((id: string) =>
    Promise.resolve({
      ...zoneRecord(id),
      warehouseId: id === 'z' ? 'w' : 'other-w',
    }),
  )
  api.getWarehouse.mockImplementation((id: string) =>
    Promise.resolve({ id, name: id, isActive: true }),
  )
  api.getZones.mockImplementation(({ warehouseId }: { warehouseId: string }) =>
    Promise.resolve([
      { ...zoneRecord(warehouseId === 'w' ? 'z' : 'other'), warehouseId },
    ]),
  )
  api.getSections.mockResolvedValue([
    ...records,
    {
      ...records[0],
      id: 'other-section',
      name: 'Other section',
      zoneId: 'other',
      warehouseId: 'other-w',
    },
  ])
  locationQueueStore.hydrate({ userId: 'u', tenantId: 't' })
  locationQueueStore.start(
    { kind: 'section', parentId: 'z', parentName: 'Zone' },
    ['s0'],
  )
  const initial = locationQueueStore.getSnapshot().queue!
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=other&select=all')
  await user.click(
    await screen.findByRole('button', { name: 'Продовжити чергу' }),
  )
  expect(
    await screen.findByRole('button', { name: 'Друк наступних 1' }),
  ).toBeEnabled()
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeInTheDocument()
  expect(locationQueueStore.getSnapshot().queue).toEqual({
    ...initial,
    target: { kind: 'warehouse', parentId: 'w', parentName: 'w' },
  })
  expect(print).not.toHaveBeenCalled()
})

it('keeps all levels available in the general warehouse catalogue and prints a mixed selection', async () => {
  api.getSections.mockResolvedValue(records.slice(0, 1))
  api.getShelves.mockResolvedValue([
    {
      ...records[0],
      id: 'shelf',
      name: 'Shelf',
      sectionId: 's0',
      sectionName: 'Section 1',
    },
  ])
  const user = userEvent.setup()
  mount('?type=locations&kind=warehouse&parent=w&label=z')
  await screen.findByRole('checkbox', { name: 'Обрати: Shelf' })
  expect(
    screen.getAllByRole('listitem').map((x) => x.getAttribute('aria-label')),
  ).toEqual(['Обрати: Zone', 'Обрати: Section 1', 'Обрати: Shelf'])
  expect(
    screen.queryByRole('button', { name: 'Змінити список' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Обрати: Zone' })).toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Shelf' }),
  ).not.toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Вибрати всі' }))
  await user.click(screen.getByRole('button', { name: 'Підготувати 3' }))
  expect(locationQueueStore.getSnapshot().queue?.target).toMatchObject({
    kind: 'warehouse',
    parentId: 'w',
  })
  await user.click(screen.getByRole('button', { name: 'Друк наступних 3' }))
  await waitFor(() => expect(print).toHaveBeenCalledOnce())
  expect(
    output.buildZoneLabelHtml.mock.calls[0]?.[0].map((x) => x.kind),
  ).toEqual(['zone', 'section', 'shelf'])
})

it('ignores an old tenant collection response arriving after the new tenant list', async () => {
  let resolveOld: ((items: typeof records) => void) | undefined
  api.getSections.mockImplementationOnce(
    () =>
      new Promise<typeof records>((resolve) => {
        resolveOld = resolve
      }),
  )
  const view = mount()
  await waitFor(() => expect(resolveOld).toBeDefined())
  session.tenantId = 'next'
  session.generation = 2
  api.getSections.mockResolvedValue([
    { ...records[0], id: 'current-section', name: 'Current tenant section' },
  ])
  view.rerender(
    <MemoryRouter
      initialEntries={[
        '/app/test/stickers?type=locations&kind=section&parent=z&select=all',
      ]}
    >
      <LocationStickersScreen />
    </MemoryRouter>,
  )
  expect(
    await screen.findByRole('checkbox', {
      name: 'Обрати: Current tenant section',
    }),
  ).toBeInTheDocument()
  await act(async () => {
    resolveOld?.(records)
    await Promise.resolve()
  })
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Підготувати 1' })).toBeEnabled()
  expect(locationQueueStore.getSnapshot().scope?.tenantId).toBe('next')
})

it('allows removing an unavailable queued ID so it cannot trap the queue', async () => {
  locationQueueStore.hydrate({ userId: 'u', tenantId: 't' })
  locationQueueStore.start(
    { kind: 'section', parentId: 'z', parentName: 'Zone' },
    ['s0', 'missing'],
  )
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=z')
  await user.click(await screen.findByRole('button', { name: 'Змінити чергу' }))
  const editor = screen.getByRole('dialog')
  await user.click(
    within(editor).getByRole('checkbox', {
      name: 'Етикетка недоступна · missing',
    }),
  )
  await user.click(
    within(editor).getByRole('button', { name: 'Прибрати з черги · 1' }),
  )
  expect(locationQueueStore.getSnapshot().queue).toMatchObject({
    remainingIds: ['s0'],
    totalCount: 1,
    printedCount: 0,
  })
  expect(screen.getByRole('button', { name: 'Друк наступних 1' })).toBeEnabled()
})

it('limits the shelf deep link list and selection to that section', async () => {
  api.getSections.mockResolvedValue(records.slice(0, 2))
  api.getSection.mockResolvedValue(records[0])
  api.getShelves.mockResolvedValue([
    {
      ...records[0],
      id: 'p0',
      name: 'Chosen shelf',
      sectionId: 's0',
      sectionName: 'Section 1',
    },
    {
      ...records[0],
      id: 'p1',
      name: 'Other shelf',
      sectionId: 's1',
      sectionName: 'Section 2',
    },
  ])
  mount('?type=locations&kind=shelf&parent=s0&select=all')
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', { name: 'Обрати: Chosen shelf' }),
    ).toBeChecked(),
  )
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Other shelf' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Zone' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Підготувати 1' })).toBeEnabled()
})

it('opens the page containing the first shelf requested from a section menu, keeping every requested shelf selected', async () => {
  api.getSection.mockResolvedValue(records[0])
  const shelves = Array.from({ length: 11 }, (_, i) => ({
    ...records[0],
    id: `p${i}`,
    name: `Requested shelf ${i + 1}`,
    sectionId: 's0',
    sectionName: 'Section 1',
  }))
  api.getShelves.mockResolvedValue([
    ...Array.from({ length: 4 }, (_, i) => ({
      ...shelves[0],
      id: `other${i}`,
      name: `Other shelf ${i + 1}`,
      sectionId: 's1',
    })),
    ...shelves,
  ])
  const user = userEvent.setup()
  mount('?type=locations&kind=shelf&parent=s0&select=all')
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Requested shelf 1' }),
  ).toBeChecked()
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Zone' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Підготувати 11' })).toBeEnabled()
  expect(
    screen.getByRole('button', { name: 'Попередня сторінка' }),
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Requested shelf 11' }),
  ).toBeChecked()
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Requested shelf 1' }),
  ).not.toBeInTheDocument()
})

it('does not select or display a requested shelf already queued', async () => {
  api.getSection.mockResolvedValue(records[0])
  api.getShelves.mockResolvedValue([
    {
      ...records[0],
      id: 'p0',
      name: 'Queued shelf',
      sectionId: 's0',
      sectionName: 'Section 1',
    },
  ])
  locationQueueStore.hydrate({ userId: 'u', tenantId: 't' })
  locationQueueStore.start(
    { kind: 'warehouse', parentId: 'w', parentName: 'Warehouse' },
    ['p0'],
  )
  mount('?type=locations&kind=shelf&parent=s0&select=all')
  await screen.findByRole('region', { name: 'Активна черга' })
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Queued shelf' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByText('Вибрано 0 обʼєктів · 0 стікерів'),
  ).toBeInTheDocument()
})

it('paginates only sections of the requested zone and preserves their selection', async () => {
  api.getZone.mockResolvedValue(zoneRecord('other-zone'))
  api.getZones.mockResolvedValue([zoneRecord(), zoneRecord('other-zone')])
  const requested = Array.from({ length: 11 }, (_, index) => ({
    ...records[0],
    id: `requested-${index}`,
    name: `Requested section ${index + 1}`,
    zoneId: 'other-zone',
  }))
  api.getSections.mockResolvedValue([...records, ...requested])
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=other-zone&select=all')
  expect(
    await screen.findByRole('checkbox', {
      name: 'Обрати: Requested section 1',
    }),
  ).toBeChecked()
  expect(screen.getByText('1–10 з 11')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Попередня сторінка' }),
  ).toBeDisabled()
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Requested section 11' }),
  ).toBeChecked()
  expect(screen.getByText('11–11 з 11')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Попередня сторінка' }))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Requested section 1' }),
  ).toBeChecked()
  expect(screen.getByRole('button', { name: 'Підготувати 11' })).toBeEnabled()
})

it('restores the shelf context page on a direct revisit without selecting labels again', async () => {
  api.getSection.mockResolvedValue(records[0])
  api.getShelves.mockResolvedValue([
    {
      ...records[0],
      id: 'p0',
      name: 'Context shelf',
      sectionId: 's0',
      sectionName: 'Section 1',
    },
  ])
  mount('?type=locations&kind=shelf&parent=s0')
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Context shelf' }),
  ).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Підготувати 0' })).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Попередня сторінка' }),
  ).toBeDisabled()
  expect(screen.getByText('1–1 з 1')).toBeVisible()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('exports the full location selection as HTML and shared HTML before creating a queue', async () => {
  const createObjectURL = vi.fn().mockReturnValue('blob:locations'),
    revokeObjectURL = vi.fn()
  class TestURL extends URL {
    static override createObjectURL = createObjectURL
    static override revokeObjectURL = revokeObjectURL
  }
  vi.stubGlobal('URL', TestURL)
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
  const share = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
  const user = userEvent.setup()
  mount()
  await user.click(await screen.findByRole('button', { name: 'Завантажити' }))
  await waitFor(() => expect(click).toHaveBeenCalledOnce())
  expect(output.buildZoneLabelHtml.mock.calls.at(-1)?.[0]).toHaveLength(25)
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:locations')
  await user.click(screen.getByRole('button', { name: 'Поділитися' }))
  await waitFor(() => expect(share).toHaveBeenCalledOnce())
  expect(share.mock.calls[0]?.[0]).toMatchObject({
    files: [expect.any(File)],
    title: 'Стікери Rozbirka',
  })
  expect(locationQueueStore.getSnapshot().queue).toBeNull()
  expect(print).not.toHaveBeenCalled()
})
it('exports only the next location batch when the selection is empty without changing progress', async () => {
  class TestURL extends URL {
    static override createObjectURL = vi.fn().mockReturnValue('blob:locations')
    static override revokeObjectURL = vi.fn()
  }
  vi.stubGlobal('URL', TestURL)
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
  const user = userEvent.setup()
  mount()
  await user.click(
    await screen.findByRole('button', { name: 'Підготувати 25' }),
  )
  const initial = locationQueueStore.getSnapshot().queue
  await user.click(screen.getByRole('button', { name: 'Друк наступних 20' }))
  await screen.findByRole('button', { name: 'Усі надруковано' })
  await user.click(screen.getByRole('button', { name: 'Завантажити' }))
  await waitFor(() => expect(click).toHaveBeenCalledOnce())
  expect(output.buildZoneLabelHtml.mock.calls.at(-1)?.[0]).toHaveLength(20)
  expect(locationQueueStore.getSnapshot().queue).toBe(initial)
  expect(
    screen.getByRole('button', { name: 'Усі надруковано' }),
  ).toBeInTheDocument()
  vi.stubGlobal('navigator', {
    ...navigator,
    canShare: () => false,
    share: vi.fn(),
  })
  await user.click(screen.getByRole('button', { name: 'Поділитися' }))
  expect(
    await screen.findByText('Обмін файлами не підтримується цим браузером.'),
  ).toBeInTheDocument()
  expect(locationQueueStore.getSnapshot().queue).toBe(initial)
})

it('does not download a prepared location selection after its owner is reset', async () => {
  class TestURL extends URL {
    static override createObjectURL = vi.fn().mockReturnValue('blob:locations')
    static override revokeObjectURL = vi.fn()
  }
  vi.stubGlobal('URL', TestURL)
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
  let finish: ((html: string) => void) | undefined
  output.buildZoneLabelHtml.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const user = userEvent.setup()
  mount()
  await user.click(await screen.findByRole('button', { name: 'Завантажити' }))
  await waitFor(() => expect(finish).toBeDefined())
  await act(() => tenantResetRegistry.clear({ userId: 'u', tenantId: 't' }))
  await act(async () => {
    finish?.('<html>labels</html>')
    await Promise.resolve()
  })
  await screen.findByRole('button', { name: 'Підготувати 25' })
  expect(click).not.toHaveBeenCalled()
  expect(locationQueueStore.getSnapshot().queue).toBeNull()
})

it('hides queued locations from search and restores removed locations unchecked', async () => {
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=z&label=s0')
  await user.click(await screen.findByRole('button', { name: 'Підготувати 1' }))
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeInTheDocument()
  expect(screen.getAllByRole('checkbox')).toHaveLength(10)
  await user.type(
    screen.getByRole('searchbox', { name: 'Назва місця зберігання' }),
    'Section 1',
  )
  expect(
    screen.queryByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Змінити чергу' }))
  const editor = screen.getByRole('dialog')
  await user.click(within(editor).getByRole('checkbox', { name: 'Section 1' }))
  await user.click(
    within(editor).getByRole('button', { name: 'Прибрати з черги · 1' }),
  )
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
})

it.each([
  {
    kind: 'zone',
    parent: 'w',
    names: ['Zone', 'Other zone'],
    ids: ['z', 'other-zone'],
    irrelevant: 'Section',
  },
  {
    kind: 'section',
    parent: 'z',
    names: ['Section 1'],
    ids: ['s0'],
    irrelevant: 'Other',
  },
  {
    kind: 'shelf',
    parent: 's0',
    names: ['Chosen shelf'],
    ids: ['p0'],
    irrelevant: 'Other',
  },
])(
  'limits the $kind print hand-off, search and selection to its parent',
  async ({ kind, parent, names, ids, irrelevant }) => {
    const otherSection = {
      ...records[1],
      zoneId: 'other-zone',
      zoneName: 'Other zone',
    }
    api.getZones.mockResolvedValue([
      zoneRecord(),
      zoneRecord('other-zone', 'Other zone'),
    ])
    api.getZone.mockImplementation((id: string) =>
      Promise.resolve(zoneRecord(id, id === 'z' ? 'Zone' : 'Other zone')),
    )
    api.getSections.mockResolvedValue([records[0], otherSection])
    api.getSection.mockResolvedValue(records[0])
    api.getShelves.mockResolvedValue([
      {
        ...records[0],
        id: 'p0',
        name: 'Chosen shelf',
        sectionId: 's0',
        sectionName: 'Section 1',
      },
      {
        ...otherSection,
        id: 'p1',
        name: 'Other shelf',
        sectionId: 's1',
        sectionName: 'Section 2',
      },
    ])
    const user = userEvent.setup()
    mount(`?type=locations&kind=${kind}&parent=${parent}&select=all`)
    await screen.findByRole('button', { name: `Підготувати ${ids.length}` })
    const list = screen.getByRole('list', { name: 'Місця зберігання' })
    expect(
      within(list)
        .getAllByRole('checkbox')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual(names.map((name) => `Обрати: ${name}`))
    await user.type(
      screen.getByRole('searchbox', { name: 'Назва місця зберігання' }),
      irrelevant,
    )
    expect(within(list).queryAllByRole('checkbox')).toHaveLength(0)
    await user.clear(
      screen.getByRole('searchbox', { name: 'Назва місця зберігання' }),
    )
    await user.click(
      screen.getByRole('button', { name: `Підготувати ${ids.length}` }),
    )
    expect(locationQueueStore.getSnapshot().queue?.remainingIds).toEqual(ids)
  },
)

it.each([
  { query: '  хОдОвА  ', names: ['Секція А02 · Ходова'] },
  { query: 'Кузовні деталі', names: ['Кузовні деталі'] },
  { query: 'unique-code-only', names: [] },
])(
  'searches only primary location names for "$query"',
  async ({ query, names }) => {
    api.getZones.mockResolvedValue([zoneRecord('z', 'Кузовні деталі')])
    const section = {
      ...records[0],
      name: 'Секція А02 · Ходова',
      zoneName: 'Кузовні деталі',
      code: 'unique-code-only',
    }
    api.getSections.mockResolvedValue([section])
    api.getShelves.mockResolvedValue([
      {
        ...section,
        id: 'p0',
        name: 'Полиця А02-01',
        sectionId: 's0',
        sectionName: section.name,
      },
    ])
    mount('?type=locations&kind=warehouse&parent=w')
    await screen.findByRole('checkbox', { name: 'Обрати: Полиця А02-01' })
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: query },
    })
    const list = screen.getByRole('list', { name: 'Місця зберігання' })
    expect(
      within(list)
        .queryAllByRole('checkbox')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual(names.map((name) => `Обрати: ${name}`))
    if (names.length) {
      expect(screen.getByText('1–1 з 1')).toBeVisible()
      fireEvent.click(screen.getByRole('button', { name: 'Вибрати всі' }))
      expect(screen.getByText('Вибрано 1 обʼєктів · 1 стікерів')).toBeVisible()
    } else {
      expect(screen.getByRole('button', { name: 'Вибрати всі' })).toBeDisabled()
    }
  },
)
