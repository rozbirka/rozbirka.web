import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StickersScreen } from './StickersScreen'
import { tenantResetRegistry } from '../tenant-reset-registry'
import { partQueueStore } from './part-queue-store'
import { partPrintQueueKey } from './part-print-queue'

const stickerMocks = vi.hoisted(() => ({ getBatchData: vi.fn() }))
const partsMocks = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn() }))
const cabinetMock = vi.hoisted(() => ({
  permissions: new Set(['parts.view', 'stickers.manage']),
}))
vi.mock('@/api/stickers', () => ({
  stickersApi: {
    getBatchData: stickerMocks.getBatchData,
    pdf: { available: false },
  },
}))
vi.mock('@/api/parts', () => ({ partsApi: partsMocks }))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: { id: 'tenant-1' },
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation: 1,
      role: 'manager',
      permissions: cabinetMock.permissions,
      features: new Set(),
      entitlement: {
        state: 'active',
        usage: {
          cars: { used: 1, max: 10 },
          intakes: { used: 1, max: 10 },
          parts: { used: 1, max: 10 },
          users: { used: 1, max: 10 },
          cashRegisters: { used: 1, max: 10 },
        },
      },
      subscription: null,
    },
    error: null,
  }),
}))

const stickersDefinition = {
  key: 'stickers',
  routeSegment: '/stickers',
  viewPermission: 'parts.view',
  mutationPermission: 'stickers.manage',
  allowedSubscriptionStates: ['trial', 'active', 'pastDue', 'cancelled'],
}

const renderScreen = () =>
  render(
    <MemoryRouter>
      <StickersScreen definition={stickersDefinition as never} />
    </MemoryRouter>,
  )

beforeEach(() => {
  partQueueStore.clear()
  localStorage.clear()
  stickerMocks.getBatchData.mockReset().mockResolvedValue({ items: [] })
  partsMocks.get
    .mockReset()
    .mockImplementation((id: string) =>
      Promise.resolve({ id, effectiveSalePrice: null }),
    )
  partsMocks.list.mockReset().mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Bumper',
        externalCode: 'P-04901',
        photos: [],
        quantityTotal: 2,
        quantityReserved: 0,
        quantityAvailable: 2,
        quantitySoldTotal: 0,
        status: 'available',
        order: null,
        car: { make: 'Ford', model: 'Focus', year: 2018 },
      },
      {
        id: 'part-2',
        name: 'Mirror',
        externalCode: null,
        photos: [],
        quantityTotal: 0,
        quantityReserved: 0,
        quantityAvailable: 0,
        quantitySoldTotal: 0,
        status: 'sold',
        order: null,
        car: null,
      },
    ],
    page: 1,
    pageSize: 6,
    total: 2,
    totalPages: 1,
  })
  cabinetMock.permissions = new Set(['parts.view', 'stickers.manage'])
})

const write = vi.fn(),
  print = vi.fn(),
  close = vi.fn()
beforeEach(() => {
  partsMocks.list.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Bumper',
        quantityAvailable: 25,
        externalCode: 'P1',
        car: null,
      },
    ],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  })
  stickerMocks.getBatchData.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Bumper',
        qrCode: 'raw:1',
        quantity: 25,
        carCode: null,
        carBrand: null,
        carModel: null,
        carYear: null,
      },
    ],
  })
  write.mockClear()
  print.mockClear()
  close.mockClear()
  vi.spyOn(window, 'open').mockReturnValue({
    opener: null,
    document: { write, close: vi.fn() },
    focus: vi.fn(),
    print,
    close,
  } as unknown as Window)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function savedSelection(quantity: number) {
  localStorage.setItem(
    'rozbirka.stickers.queue.v1:user-1:tenant-1',
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 100000,
      items: [
        { id: 'part-1', name: 'Bumper', quantity, availableQuantity: 25 },
      ],
    }),
  )
}
it('prints twenty copies, confirms only seven and restores eighteen after remount', async () => {
  savedSelection(25)
  const view = renderScreen()
  fireEvent.click(await screen.findByRole('button', { name: 'Підготувати 25' }))
  expect(
    await screen.findByText('0 з 25 надруковано · 25 залишилось'),
  ).toBeVisible()
  expect(print).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Друк наступних 20' }))
  await vi.waitFor(() => expect(print).toHaveBeenCalledOnce())
  expect(
    (write.mock.calls[0]?.[0] as string).match(/class="sticker"/g),
  ).toHaveLength(20)
  fireEvent.click(screen.getByRole('button', { name: 'Частково' }))
  for (const number of [1, 3, 5, 8, 11, 14, 20])
    fireEvent.click(
      screen.getByRole('checkbox', { name: `Bumper · Копія ${number}` }),
    )
  fireEvent.click(screen.getByRole('button', { name: 'Підтвердити · 7' }))
  await screen.findByText('7 з 25 надруковано · 18 залишилось')
  view.unmount()
  renderScreen()
  expect(
    await screen.findByText('7 з 25 надруковано · 18 залишилось'),
  ).toBeVisible()
  expect(partQueueStore.getSnapshot().queue?.remaining).toHaveLength(18)
})
it('PDF, blocked popups and nothing printed never acknowledge copies', async () => {
  savedSelection(2)
  renderScreen()
  fireEvent.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'PDF наступних 2' }),
  )
  await vi.waitFor(() => expect(print).toHaveBeenCalledOnce())
  expect(
    screen.queryByRole('button', { name: 'Усі надруковано' }),
  ).not.toBeInTheDocument()
  expect(partQueueStore.getSnapshot().queue?.remaining).toHaveLength(2)
  vi.mocked(window.open).mockReturnValueOnce(null)
  fireEvent.click(screen.getByRole('button', { name: 'Друк наступних 2' }))
  await vi.waitFor(() =>
    expect(partQueueStore.getSnapshot().queue?.remaining).toHaveLength(2),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Друк наступних 2' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Нічого не надруковано' }),
  )
  expect(partQueueStore.getSnapshot().queue?.printedCount).toBe(0)
})
it('rejects a missing requested part without skipping it or advancing the queue', async () => {
  savedSelection(2)
  renderScreen()
  fireEvent.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  await screen.findByText('0 з 2 надруковано · 2 залишилось')
  stickerMocks.getBatchData.mockResolvedValue({ items: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Друк наступних 2' }))
  await vi.waitFor(() => expect(close).toHaveBeenCalled())
  expect(print).not.toHaveBeenCalled()
  expect(partQueueStore.getSnapshot().queue?.remaining).toHaveLength(2)
})
it('does not confirm an output after the persisted queue changes in another tab', async () => {
  savedSelection(2)
  renderScreen()
  fireEvent.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  await screen.findByText('0 з 2 надруковано · 2 залишилось')
  let resolveBatch: ((value: { items: object[] }) => void) | undefined
  stickerMocks.getBatchData.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveBatch = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Друк наступних 2' }))
  await vi.waitFor(() => expect(resolveBatch).toBeDefined())
  act(() => {
    const queue = partQueueStore.getSnapshot().queue!
    const key = partPrintQueueKey('user-1', 'tenant-1')
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        owner: { userId: 'user-1', tenantId: 'tenant-1' },
        queue: { ...queue, remaining: queue.remaining.slice(1), totalCount: 1 },
      }),
    )
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
  await act(async () => {
    resolveBatch?.({
      items: [{ id: 'part-1', name: 'Bumper', qrCode: 'raw:1', quantity: 25 }],
    })
    await Promise.resolve()
  })
  expect(print).not.toHaveBeenCalled()
  expect(partQueueStore.getSnapshot().queue?.remaining).toHaveLength(1)
})

it('adds copies, edits individual copies without counting them printed, and confirms cancellation', async () => {
  savedSelection(2)
  renderScreen()
  fireEvent.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  await screen.findByText('0 з 2 надруковано · 2 залишилось')
  fireEvent.click(
    await screen.findByRole('listitem', { name: 'Запчастина Bumper' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Додати до черги · 1' }))
  await screen.findByText('0 з 3 надруковано · 3 залишилось')
  fireEvent.click(screen.getByRole('button', { name: 'Змінити чергу' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Bumper · Копія 2' }))
  fireEvent.click(screen.getByRole('button', { name: 'Прибрати з черги · 1' }))
  await screen.findByText('0 з 2 надруковано · 2 залишилось')
  expect(partQueueStore.getSnapshot().queue?.printedCount).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати чергу' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Скасувати чергу друку?',
  })
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Скасувати чергу' }),
  )
  await vi.waitFor(() => expect(partQueueStore.getSnapshot().queue).toBeNull())
  expect(print).not.toHaveBeenCalled()
})
it('closes delayed output and clears both namespaces when the owner signs out', async () => {
  savedSelection(2)
  renderScreen()
  fireEvent.click(await screen.findByRole('button', { name: 'Підготувати 2' }))
  await screen.findByText('0 з 2 надруковано · 2 залишилось')
  let resolveBatch: ((value: { items: object[] }) => void) | undefined
  stickerMocks.getBatchData.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveBatch = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Друк наступних 2' }))
  await vi.waitFor(() => expect(resolveBatch).toBeDefined())
  await act(() =>
    tenantResetRegistry.clear({ userId: 'user-1', tenantId: 'tenant-1' }),
  )
  await act(async () => {
    resolveBatch?.({
      items: [{ id: 'part-1', name: 'Bumper', qrCode: 'raw:1', quantity: 25 }],
    })
    await Promise.resolve()
  })
  await vi.waitFor(() => expect(close).toHaveBeenCalled())
  expect(print).not.toHaveBeenCalled()
  expect(partQueueStore.getSnapshot().queue).toBeNull()
  expect(
    localStorage.getItem(partPrintQueueKey('user-1', 'tenant-1')),
  ).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Усі надруковано' }),
  ).not.toBeInTheDocument()
})
