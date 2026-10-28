import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocationStickersScreen } from './LocationStickersScreen'
import { locationQueueStore } from './location-queue-store'
import { tenantResetRegistry } from '../tenant-reset-registry'
import type { InventoryZone } from '@/api/inventory'
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
  buildZoneLabelHtml: vi.fn().mockResolvedValue('<html>labels</html>'),
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
      <LocationStickersScreen />
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
      'QR-стікери для запчастин. Сканер відкриває запчастину за її кодом.',
    ),
  ).toBeInTheDocument()
  expect(
    await screen.findByRole('listitem', { name: 'Обрати: Section 10' }),
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
  expect(screen.getByRole('searchbox', { name: 'Назва або код' })).toBeEnabled()
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
  expect(
    await screen.findByRole('button', { name: 'Підготувати 201' }),
  ).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Обрати: Section 1' }))
  fireEvent.change(screen.getByRole('searchbox', { name: 'Назва або код' }), {
    target: { value: 'Section 1' },
  })
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
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 2' }),
  ).toBeDisabled()
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
  expect(screen.getByText('У черзі більше немає позицій.')).toBeInTheDocument()
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

it('continues an active queue from a different collection without replacing it', async () => {
  api.getZone.mockImplementation((id: string) =>
    Promise.resolve({
      id,
      name: id === 'z' ? 'Zone' : 'Other zone',
      isActive: true,
    }),
  )
  api.getSections.mockImplementation((id: string) =>
    Promise.resolve(
      id === 'z'
        ? records
        : [
            {
              ...records[0],
              id: 'other-section',
              name: 'Other section',
              zoneId: 'other',
            },
          ],
    ),
  )
  locationQueueStore.hydrate({ userId: 'u', tenantId: 't' })
  locationQueueStore.start(
    { kind: 'section', parentId: 'z', parentName: 'Zone' },
    ['s0'],
  )
  const initial = locationQueueStore.getSnapshot().queue
  const user = userEvent.setup()
  mount('?type=locations&kind=section&parent=other&select=all')
  const continueQueue = await screen.findByRole('button', {
    name: 'Продовжити чергу',
  })
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Додати до черги · 1' }),
    ).toBeDisabled(),
  )
  expect(
    screen.queryByRole('button', { name: 'Друк наступних 1' }),
  ).not.toBeInTheDocument()
  await user.click(continueQueue)
  expect(
    await screen.findByRole('button', { name: 'Друк наступних 1' }),
  ).toBeEnabled()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeDisabled()
  expect(locationQueueStore.getSnapshot().queue).toBe(initial)
  expect(print).not.toHaveBeenCalled()
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
