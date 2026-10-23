import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n'
import { PartSearchPicker, type PartPickerItem } from './PartSearchPicker'

const partMocks = vi.hoisted(() => ({
  facets: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
}))

vi.mock('@/api/parts', () => ({ partsApi: partMocks }))

const part = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Інвертор ${id}`,
  photos: [],
  quantityTotal: 3,
  quantity: 3,
  quantityReserved: 0,
  quantityAvailable: 3,
  quantitySoldTotal: 0,
  status: 'available',
  car: {
    id: `car-${id}`,
    make: 'Volkswagen',
    model: 'ID.4',
    year: 2022,
    vin: null,
  },
  order: null,
  externalCode: `P-${id}`,
  oemCode: `P-${id}`,
  sourceType: 'car',
  condition: 'used',
  unit: 'pcs',
  createdAt: '2026-10-06T10:00:00Z',
  isInventoryLocked: false,
  hasDiscrepancy: false,
  thumbnailUrl: null,
  ...overrides,
})

const page = (items: ReturnType<typeof part>[], total = items.length) => ({
  items,
  page: 1,
  pageSize: 6,
  total,
  totalPages: Math.max(1, Math.ceil(total / 6)),
})

function Harness({
  onSelect = () => undefined,
  compact = false,
}: {
  onSelect?: (part: PartPickerItem) => void
  compact?: boolean
}) {
  const [query, setQuery] = useState('')
  return (
    <PartSearchPicker
      compact={compact}
      currency="USD"
      onClear={vi.fn()}
      onQueryChange={setQuery}
      onSelect={(selected) => {
        setQuery(selected.name)
        onSelect(selected)
      }}
      query={query}
      value={null}
    />
  )
}

describe('PartSearchPicker', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
    partMocks.facets.mockResolvedValue({
      statuses: [
        { id: 'available', name: 'В наявності', count: 9 },
        { id: 'reserved', name: 'Резерв', count: 1 },
        { id: 'sold', name: 'Продано', count: 2 },
      ],
      warehouses: [],
      zones: [],
      conditions: [],
      equipmentTypes: [],
      makes: [],
      models: [],
      generations: [],
      origins: [],
      qualityFlags: [],
      inventoryLocks: [],
      discrepancies: [],
    })
    partMocks.search.mockResolvedValue(
      page(
        [
          part('1'),
          part('2', {
            quantityAvailable: 1,
            quantityReserved: 2,
            status: 'reserved',
          }),
        ],
        9,
      ),
    )
    partMocks.get.mockImplementation((id: string) =>
      Promise.resolve({
        id,
        effectiveSalePrice: id === '1' ? 0 : null,
      }),
    )
  })

  it('requests only parts with free stock without loading redundant status counts', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Пошук запчастини' }),
      'цапфа',
    )

    await screen.findByRole('option', { name: /Інвертор 1/ })
    expect(partMocks.facets).not.toHaveBeenCalled()
    expect(partMocks.search).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ['available'] }),
      expect.anything(),
    )
    expect(partMocks.search).toHaveBeenCalledTimes(1)
    expect(partMocks.list).not.toHaveBeenCalled()
  })

  it('speaks English (UK) inside an en-GB locale', async () => {
    const user = userEvent.setup()
    render(
      <LocaleProvider locale="en-GB" syncDocumentLang={false}>
        <Harness />
      </LocaleProvider>,
    )

    await user.type(
      screen.getByRole('searchbox', { name: 'Search for a part' }),
      'inverter',
    )

    const option = await screen.findByRole('option', {
      name: 'Choose part Інвертор 1',
    })
    expect(option).toHaveTextContent('3 in stock')
    expect(screen.getByText('In stock')).toBeVisible()
    expect(screen.getByRole('listbox', { name: 'Parts found' })).toBeVisible()
  })

  it('reuses loaded prices when repeated searches return the same parts', async () => {
    render(<Harness />)
    const search = screen.getByRole('searchbox', {
      name: 'Пошук запчастини',
    })

    fireEvent.change(search, { target: { value: 'цапфа' } })
    await screen.findByRole('option', { name: /Інвертор 1/ })
    await waitFor(() => expect(partMocks.get).toHaveBeenCalledTimes(2))

    fireEvent.change(search, { target: { value: 'цапфа задня' } })
    await waitFor(() => expect(partMocks.search).toHaveBeenCalledTimes(2))
    await screen.findByRole('option', { name: /Інвертор 1/ })

    expect(partMocks.get).toHaveBeenCalledTimes(2)
  })

  it('keeps partially reserved stock, omits fully reserved and sold parts, and paginates available results', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    partMocks.search
      .mockResolvedValueOnce(
        page(
          [
            part('1', {
              quantityTotal: 1,
              quantity: 1,
              quantityAvailable: 0,
              quantityReserved: 1,
              status: 'reserved',
            }),
            part('2', {
              quantityTotal: 3,
              quantity: 3,
              quantityAvailable: 1,
              quantityReserved: 2,
              status: 'available',
            }),
            part('sold', { quantity: 0, quantityAvailable: 0, status: 'sold' }),
          ],
          7,
        ),
      )
      .mockResolvedValueOnce({ ...page([part('3')], 7), page: 2 })
    render(<Harness onSelect={onSelect} />)
    const search = screen.getByRole('searchbox', { name: 'Пошук запчастини' })
    await user.type(search, 'інвертор')
    const dropdown = await screen.findByRole('dialog', {
      name: 'Результати пошуку запчастин',
    })
    const available = await within(dropdown).findByRole('option', {
      name: /Інвертор 2/,
    })
    expect(within(available).getByText('1 в наявності')).toBeVisible()
    expect(
      within(dropdown).queryByRole('option', { name: /Інвертор 1/ }),
    ).toBeNull()
    expect(
      within(dropdown).queryByRole('option', { name: /Інвертор sold/ }),
    ).toBeNull()
    expect(
      within(dropdown).queryByRole('button', { name: /Резерв/ }),
    ).toBeNull()
    expect(partMocks.get).not.toHaveBeenCalledWith('1', expect.anything())
    await user.click(
      within(dropdown).getByRole('button', { name: 'Показати ще' }),
    )
    const next = await within(dropdown).findByRole('option', {
      name: /Інвертор 3/,
    })
    expect(available).toBeVisible()
    expect(partMocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        statuses: ['available'],
        page: 2,
        pageSize: 6,
      }),
      expect.anything(),
    )
    expect(within(dropdown).getByText('2 з 7')).toBeVisible()
    await user.click(next)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '3' }))
  })

  it('keeps the matching parts visible when an auxiliary price request fails', async () => {
    partMocks.get.mockRejectedValueOnce(new Error('price down'))
    partMocks.search.mockResolvedValue(page([part('1')], 1))
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Пошук запчастини' }),
      'інвертор',
    )

    expect(
      await screen.findByRole('option', { name: /Інвертор 1/ }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not let an older response replace a newer query', async () => {
    vi.useFakeTimers()
    const pending = new Map<string, (result: ReturnType<typeof page>) => void>()
    partMocks.search.mockImplementation(
      ({ query }: { query?: string }) =>
        new Promise((resolve) => pending.set(query ?? '', resolve)),
    )
    render(<Harness />)

    const search = screen.getByRole('searchbox', {
      name: 'Пошук запчастини',
    })
    fireEvent.change(search, { target: { value: 'a' } })
    await act(() => vi.advanceTimersByTimeAsync(300))
    fireEvent.change(search, { target: { value: 'b' } })
    await act(() => vi.advanceTimersByTimeAsync(300))

    pending.get('b')?.(page([part('new')]))
    await act(() => Promise.resolve())
    pending.get('a')?.(page([part('old')]))
    await act(() => Promise.resolve())

    expect(screen.getByText('Інвертор new')).toBeVisible()
    expect(screen.queryByText('Інвертор old')).toBeNull()
  })
  it('matches the compact order dropdown without redundant headings or missing-car copy', async () => {
    partMocks.search.mockResolvedValue(
      page([
        part('1', { car: null, externalCode: null, oemCode: null }),
        part('2', { car: null, externalCode: 'OEM-2' }),
        part('sold', { car: null, quantityAvailable: 0, status: 'sold' }),
      ]),
    )
    partMocks.get.mockResolvedValue({ effectiveSalePrice: 100 })
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Harness compact onSelect={onSelect} />)
    await user.type(screen.getByRole('searchbox'), 'цапфа')
    const option = await screen.findByRole('option', {
      name: 'Обрати запчастину Інвертор 1',
    })
    expect(screen.getAllByText('В наявності')).toHaveLength(2)
    expect(screen.queryByText('Без привʼязки до автомобіля')).toBeNull()
    expect(screen.queryByRole('option', { name: /sold/ })).toBeNull()
    expect(within(option).getByText('В наявності')).toHaveClass(
      'rz-pill',
      'rz-pill--ok',
    )
    expect(within(option).getByText('3 шт')).toBeVisible()
    expect(within(option).getByText('В наявності')).not.toContainElement(
      within(option).getByText('3 шт'),
    )
    expect(await within(option).findByText('100,00 USD')).toBeVisible()
    expect(screen.getByText('OEM-2')).toBeVisible()
    await user.click(option)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        quantityAvailable: 3,
        effectiveSalePrice: 100,
      }),
    )
  })
})
