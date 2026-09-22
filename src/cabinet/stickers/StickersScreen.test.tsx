import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { tenantResetRegistry } from '../tenant-reset-registry'
import { StickersScreen } from './StickersScreen'

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
  released: true,
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

const add = async (name: string) => {
  fireEvent.click(
    await screen.findByRole('listitem', { name: `Запчастина ${name}` }),
  )
}

beforeEach(() => {
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

it('matches the sticker workspace while keeping unsupported backend controls out', async () => {
  renderScreen()
  expect(
    screen.getByRole('searchbox', { name: 'Пошук запчастини' }),
  ).toBeVisible()
  await add('Bumper')

  expect(screen.getByRole('heading', { name: 'Стікери' })).toBeVisible()
  expect(screen.getByText('P-04901')).toBeVisible()
  expect(screen.getAllByText(/Ford Focus/)).not.toHaveLength(0)
  expect(screen.getByRole('region', { name: 'Аркуш стікерів' })).toBeVisible()
  for (const unsupported of [
    'Комірки',
    'Автомобілі',
    'Останні друки',
    'Ціна продажу',
  ])
    expect(screen.queryByText(unsupported)).not.toBeInTheDocument()

  expect(screen.getByText('Вибрано обʼєктів')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Підготувати 1' })).toBeEnabled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Збільшити кількість Bumper' }),
  )
  expect(screen.getByRole('button', { name: 'Підготувати 2' })).toBeEnabled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Зменшити кількість Bumper' }),
  )
  expect(screen.getByRole('button', { name: 'Підготувати 1' })).toBeEnabled()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('keeps the paginated parts list and toggles selection by clicking the whole row', async () => {
  renderScreen()
  const list = await screen.findByRole('list', { name: 'Список запчастин' })
  expect(list).toHaveTextContent('Bumper')
  expect(list).not.toHaveTextContent('Mirror')
  expect(list).toHaveTextContent('Доступно: 2 шт.')
  expect(
    screen.getByRole('navigation', {
      name: 'Пагінація запчастин для стікерів',
    }),
  ).toBeVisible()

  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Пошук запчастини' }),
    { target: { value: 'Bumper' } },
  )
  await vi.waitFor(() =>
    expect(partsMocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'Bumper', status: 'available' }),
    ),
  )
  expect(
    screen.queryByRole('dialog', { name: 'Результати пошуку запчастин' }),
  ).toBeNull()

  fireEvent.click(screen.getByRole('listitem', { name: 'Запчастина Bumper' }))
  expect(screen.getByRole('checkbox', { name: 'Bumper' })).toBeChecked()
  expect(screen.getByRole('button', { name: 'Підготувати 1' })).toBeEnabled()

  const increase = screen.getByRole('button', {
    name: 'Збільшити кількість Bumper',
  })
  fireEvent.click(increase)
  expect(screen.getByRole('button', { name: 'Підготувати 2' })).toBeEnabled()
  expect(increase).toBeDisabled()

  fireEvent.click(screen.getByRole('listitem', { name: 'Запчастина Bumper' }))
  expect(screen.getByRole('checkbox', { name: 'Bumper' })).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Підготувати 0' })).toBeDisabled()
})

it('loads sticker data and renders a real QR SVG preview for each queued copy', async () => {
  stickerMocks.getBatchData.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Bumper',
        qrCode: 'QR /1',
        carCode: 'CAR-01',
        carBrand: 'Ford',
        carModel: 'Focus',
        carYear: 2018,
        carId: 'car-1',
        quantity: 4,
        createdAt: '2026-08-28T12:00:00Z',
      },
    ],
  })
  renderScreen()
  await add('Bumper')
  fireEvent.click(screen.getByRole('button', { name: 'Підготувати 1' }))

  const preview = await screen.findByRole('region', { name: 'Аркуш стікерів' })
  expect(stickerMocks.getBatchData).toHaveBeenCalledWith(
    ['part-1'],
    expect.objectContaining({
      signal: expect.any(AbortSignal) as AbortSignal,
    }),
  )
  const qr = screen.getByRole('img', { name: 'QR-код Bumper' })
  expect(qr.querySelectorAll('svg')).toHaveLength(1)
  expect(qr.querySelector('svg path')).not.toBeNull()
  expect(preview).toHaveTextContent('CAR-01 · Ford Focus (2018)')
  expect(preview.innerHTML).not.toContain('QR /1')
})

it('previews every selected sticker copy while keeping the separate-page print hint', async () => {
  stickerMocks.getBatchData.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Bumper',
        qrCode: 'QR-1',
        carCode: 'CAR-01',
        carBrand: 'Ford',
        carModel: 'Focus',
        carYear: 2018,
        carId: 'car-1',
        quantity: 2,
        createdAt: '2026-08-28T12:00:00Z',
      },
    ],
  })
  renderScreen()
  await add('Bumper')
  fireEvent.click(
    screen.getByRole('button', { name: 'Збільшити кількість Bumper' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Підготувати 2' }))

  const preview = await screen.findByRole('region', {
    name: 'Аркуш стікерів',
  })
  expect(
    screen.getAllByRole('article', {
      name: 'Попередній перегляд стікера Bumper',
    }),
  ).toHaveLength(2)
  expect(screen.getAllByRole('img', { name: 'QR-код Bumper' })).toHaveLength(2)
  expect(preview).toHaveTextContent('Попередній перегляд')
  expect(preview).toHaveTextContent(
    'Кожен стікер друкується на окремому аркуші 40×58 мм.',
  )
})

it('downloads, prints, and shares the same printable QR artifact with URL cleanup', async () => {
  stickerMocks.getBatchData.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        name: 'Bumper',
        qrCode: 'QR-1',
        carCode: null,
        carBrand: null,
        carModel: null,
        carYear: null,
        carId: null,
        quantity: 1,
        createdAt: '2026-08-28T12:00:00Z',
      },
    ],
  })
  const createObjectURL = vi.fn().mockReturnValue('blob:sticker-layout')
  const revokeObjectURL = vi.fn()
  class TestURL extends URL {
    static override createObjectURL = createObjectURL
    static override revokeObjectURL = revokeObjectURL
  }
  vi.stubGlobal('URL', TestURL)
  const anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
  const write = vi.fn()
  const print = vi.fn()
  vi.spyOn(window, 'open').mockReturnValue({
    document: { write, close: vi.fn() },
    focus: vi.fn(),
    print,
  } as unknown as Window)
  const share = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', {
    ...navigator,
    canShare: vi.fn().mockReturnValue(true),
    share,
  })
  renderScreen()
  await add('Bumper')
  fireEvent.click(screen.getByRole('button', { name: 'Підготувати 1' }))
  await screen.findByRole('button', { name: 'Друкувати 1' })

  fireEvent.click(screen.getByRole('button', { name: 'Завантажити' }))
  await vi.waitFor(() => expect(anchorClick).toHaveBeenCalled())
  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:sticker-layout')

  fireEvent.click(screen.getByRole('button', { name: 'Друкувати 1' }))
  await vi.waitFor(() => expect(print).toHaveBeenCalled())
  expect(write.mock.calls[0]?.[0]).toContain('<svg')
  expect(write.mock.calls[0]?.[0]).toContain('/scan/QR-1')

  fireEvent.click(screen.getByRole('button', { name: 'Поділитися' }))
  await vi.waitFor(() => expect(share).toHaveBeenCalled())
  expect(share.mock.calls[0]?.[0]).toEqual(
    expect.objectContaining({
      files: [expect.any(File)],
      title: 'Стікери Rozbirka',
    }),
  )
  const shared = share.mock.calls[0]?.[0] as ShareData | undefined
  expect(shared?.files?.[0]?.name).toBe('rozbirka-stickers.html')
})

it('fails closed on generation when stickers.manage is absent', () => {
  cabinetMock.permissions = new Set(['parts.view'])
  renderScreen()

  expect(
    screen.getByRole('searchbox', { name: 'Пошук запчастини' }),
  ).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Недостатньо прав')
})

it('rechecks the latest sticker permission before requesting batch data', async () => {
  renderScreen()
  await add('Bumper')
  cabinetMock.permissions.delete('stickers.manage')
  fireEvent.click(screen.getByRole('button', { name: 'Підготувати 1' }))

  await Promise.resolve()
  expect(stickerMocks.getBatchData).not.toHaveBeenCalled()
})

it('persists only a stable user-tenant queue with TTL and clears it on scope cleanup', async () => {
  const first = renderScreen()
  await add('Bumper')
  await vi.waitFor(() => expect(localStorage.length).toBe(1))
  first.unmount()
  renderScreen()
  expect(await screen.findByRole('checkbox', { name: 'Bumper' })).toBeChecked()

  await act(() =>
    tenantResetRegistry.clear({ userId: 'user-1', tenantId: 'tenant-1' }),
  )
  await vi.waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Підготувати 0' }),
    ).toBeDisabled(),
  )
  expect(localStorage.length).toBe(0)
})

it('discards an expired persisted queue', async () => {
  const first = renderScreen()
  await add('Bumper')
  await vi.waitFor(() => expect(localStorage.length).toBe(1))
  const key = localStorage.key(0)!
  const stored = JSON.parse(localStorage.getItem(key)!) as {
    expiresAt: number
  }
  localStorage.setItem(
    key,
    JSON.stringify({ ...stored, expiresAt: Date.now() - 1 }),
  )
  first.unmount()

  renderScreen()
  expect(screen.queryByRole('checkbox', { name: 'Bumper' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Підготувати 0' })).toBeDisabled()
  expect(localStorage.getItem(key)).toBeNull()
})
