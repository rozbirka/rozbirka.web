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
}: {
  onSelect?: (part: PartPickerItem) => void
}) {
  const [query, setQuery] = useState('')
  return (
    <PartSearchPicker
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
    vi.clearAllMocks()
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
    partMocks.search.mockImplementation(
      ({ statuses }: { statuses?: string[] }) =>
        Promise.resolve(
          statuses?.[0] === 'reserved'
            ? page([
                part('2', {
                  quantityAvailable: 1,
                  quantityReserved: 2,
                  status: 'reserved',
                }),
              ])
            : statuses?.[0] === 'available'
              ? page([part('1')], 9)
              : page(
                  [
                    part('1'),
                    part('2', { quantityAvailable: 0, status: 'sold' }),
                  ],
                  12,
                ),
        ),
    )
    partMocks.get.mockImplementation((id: string) =>
      Promise.resolve({
        id,
        effectiveSalePrice: id === '1' ? 0 : null,
      }),
    )
  })

  it('loads all status counts in one request instead of multiplying list searches', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Пошук запчастини' }),
      'цапфа',
    )

    await screen.findByRole('option', { name: /Інвертор 1/ })
    await waitFor(() => expect(partMocks.facets).toHaveBeenCalledOnce())
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
    expect(screen.getByRole('button', { name: /^All/ })).toBeVisible()
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

  it('searches, filters, loads more like mobile, renders optional prices, and selects a part', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)

    const search = screen.getByRole('searchbox', {
      name: 'Пошук запчастини',
    })
    await user.type(search, 'інвертор')

    const dropdown = await screen.findByRole('dialog', {
      name: 'Результати пошуку запчастин',
    })
    await waitFor(() =>
      expect(
        within(dropdown).getByRole('button', { name: /Усі\s*12/ }),
      ).toBeVisible(),
    )
    const availableFilter = within(dropdown).getByRole('button', {
      name: /В наявності\s*9/,
    })
    expect(availableFilter).toHaveClass('text-state-ok')
    expect(availableFilter).not.toHaveClass('bg-state-ok-soft')
    const reservedFilter = within(dropdown).getByRole('button', {
      name: /Резерв\s*1/,
    })
    expect(reservedFilter).toHaveClass('text-state-warn')
    expect(reservedFilter).not.toHaveClass('bg-state-warn-soft')
    expect(within(dropdown).queryByRole('button', { name: /Немає/ })).toBeNull()
    expect(within(dropdown).queryByText('І1')).toBeNull()
    expect(within(dropdown).getByText('0 $')).toBeVisible()
    expect(within(dropdown).getByText('—')).toBeVisible()
    expect(
      within(dropdown).getAllByText('Volkswagen ID.4 · 2022'),
    ).toHaveLength(2)
    expect(within(dropdown).getByText('P-1')).toBeVisible()
    const availableOption = within(dropdown).getByRole('option', {
      name: /Інвертор 1/,
    })
    expect(within(availableOption).getByText('3 в наявності')).toHaveClass(
      'text-state-ok',
    )
    const unavailableOption = within(dropdown).getByRole('option', {
      name: /Інвертор 2/,
    })
    expect(within(unavailableOption).getByText('Немає')).toHaveClass(
      'text-state-danger',
    )

    await user.click(
      within(dropdown).getByRole('button', { name: 'Показати ще' }),
    )
    await waitFor(() =>
      expect(partMocks.search).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 6 }),
        expect.objectContaining({}),
      ),
    )
    expect(within(dropdown).queryByText('На сторінці')).not.toBeInTheDocument()

    await user.click(
      within(dropdown).getByRole('button', { name: /Резерв\s*1/ }),
    )
    await waitFor(() =>
      expect(partMocks.search).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 6,
          statuses: ['reserved'],
        }),
        expect.objectContaining({}),
      ),
    )
    const reservedOption = await within(dropdown).findByRole('option', {
      name: /Інвертор 2/,
    })
    const reservedBadge = within(reservedOption).getByText('Резерв')
    expect(reservedBadge).toHaveClass('text-state-warn')
    expect(
      within(dropdown).getByRole('button', { name: /Резерв\s*1/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(dropdown).getByRole('button', { name: /Резерв\s*1/ }),
    ).toHaveClass('bg-state-warn-soft')
    expect(availableFilter).toHaveAttribute('aria-pressed', 'false')

    await user.click(await screen.findByRole('option', { name: /Інвертор 2/ }))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2', effectiveSalePrice: null }),
    )
  })

  it('keeps the matching parts visible when an auxiliary count request fails', async () => {
    partMocks.facets.mockRejectedValue(new Error('count down'))
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
      ({ query, statuses }: { query?: string; statuses?: string[] }) =>
        statuses?.length
          ? Promise.resolve(page([]))
          : new Promise((resolve) => pending.set(query ?? '', resolve)),
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
})
