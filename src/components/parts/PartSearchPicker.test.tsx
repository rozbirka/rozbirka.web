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
import { PartSearchPicker, type PartPickerItem } from './PartSearchPicker'

const partMocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@/api/parts', () => ({ partsApi: partMocks }))

const part = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Інвертор ${id}`,
  photos: [],
  quantityTotal: 3,
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
    partMocks.list.mockImplementation(({ status }: { status?: string }) =>
      Promise.resolve(
        status === 'reserved'
          ? page([
              part('2', {
                quantityAvailable: 1,
                quantityReserved: 2,
                status: 'reserved',
              }),
            ])
          : status === 'available'
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
      expect(partMocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 6 }),
      ),
    )
    expect(within(dropdown).queryByText('На сторінці')).not.toBeInTheDocument()

    await user.click(
      within(dropdown).getByRole('button', { name: /Резерв\s*1/ }),
    )
    await waitFor(() =>
      expect(partMocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 6, status: 'reserved' }),
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
    partMocks.list.mockImplementation(({ status }: { status?: string }) => {
      if (status === 'available') return Promise.reject(new Error('count down'))
      return Promise.resolve(page([part('1')], 1))
    })
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
    partMocks.list.mockImplementation(
      ({ q, status }: { q?: string; status?: string }) =>
        status
          ? Promise.resolve(page([]))
          : new Promise((resolve) => pending.set(q ?? '', resolve)),
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
