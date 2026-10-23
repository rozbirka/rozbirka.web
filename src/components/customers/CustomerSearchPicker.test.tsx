import { useState, type FormEvent } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { CustomerSearchPicker } from './CustomerSearchPicker'
import type { CustomerSearchItem } from '@/api/customers'

const { search, list } = vi.hoisted(() => ({ search: vi.fn(), list: vi.fn() }))
vi.mock('@/api/customers', () => ({ customersApi: { search, list } }))

const customer = (id = '1', name = 'Ірина') => ({
  id,
  name,
  phone: '+380501112233',
  ordersCount: 2,
})
function Harness({
  onSelect = vi.fn(),
  initialOpen = false,
  explicitSelection = false,
  selectionAppearance = 'field',
}: {
  initialOpen?: boolean
  explicitSelection?: boolean
  selectionAppearance?: 'field' | 'card'
  onSelect?: (item: CustomerSearchItem) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState('')
  return (
    <>
      <CustomerSearchPicker
        initialOpen={initialOpen}
        selectionAppearance={selectionAppearance}
        query={query}
        onQueryChange={setQuery}
        selectedId={selectedId}
        {...(explicitSelection
          ? {
              selectedName,
              onClear: () => {
                setSelectedId(null)
                setSelectedName('')
              },
            }
          : {})}
        onSelect={(item) => {
          setSelectedId(item.id)
          setSelectedName(item.name)
          setQuery(item.name)
          onSelect(item)
        }}
      />
      <button>Поза пошуком</button>
    </>
  )
}
beforeEach(() => {
  list.mockReset()
  list.mockResolvedValue({
    items: [customer()],
    page: 1,
    pageSize: 20,
    total: 1,
  })
  search.mockReset()
  search.mockResolvedValue([customer()])
})

it('opens a dropdown, selects one customer and closes it without submitting the form', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  const submit = vi.fn((event: FormEvent) => event.preventDefault())
  render(
    <form onSubmit={submit}>
      <Harness onSelect={onSelect} />
    </form>,
  )
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук клієнта' }),
    'Ір',
  )
  const popup = await screen.findByRole('dialog', {
    name: 'Результати пошуку клієнтів',
  })
  await user.click(
    await within(popup).findByRole('option', { name: 'Обрати клієнта Ірина' }),
  )
  expect(onSelect).toHaveBeenCalledWith(customer())
  expect(screen.getByRole('searchbox')).toHaveValue('Ірина')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(submit).not.toHaveBeenCalled()
})

it('closes with Escape and an outside click and reopens on focus', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const input = screen.getByRole('searchbox')
  await user.type(input, 'Ір')
  await screen.findByRole('option')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Поза пошуком' }))
  await user.click(input)
  expect(await screen.findByRole('dialog')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Поза пошуком' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('ignores late search responses and hides old rows immediately', async () => {
  let resolveOld!: (items: ReturnType<typeof customer>[]) => void
  search
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      }),
    )
    .mockResolvedValueOnce([customer('2', 'Олена')])
  const user = userEvent.setup()
  render(<Harness />)
  await user.type(screen.getByRole('searchbox'), 'Ір')
  await waitFor(() => expect(search).toHaveBeenCalledTimes(1))
  await user.clear(screen.getByRole('searchbox'))
  await user.type(screen.getByRole('searchbox'), 'Ол')
  await screen.findByRole('option', { name: 'Обрати клієнта Олена' })
  await act(async () => {
    resolveOld([customer()])
    await Promise.resolve()
  })
  expect(screen.queryByText('Ірина')).not.toBeInTheDocument()
})

it('shows six results at a time in a bounded list and loads the remaining matches', async () => {
  search.mockResolvedValue(
    Array.from({ length: 8 }, (_, i) =>
      customer(String(i), `Клієнт ${String(i)}`),
    ),
  )
  const user = userEvent.setup()
  render(<Harness />)
  await user.type(screen.getByRole('searchbox'), 'Клієнт')
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(6))
  expect(screen.getByText('6 з 8')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Показати ще' }))
  expect(screen.getAllByRole('option')).toHaveLength(8)
  expect(search).toHaveBeenCalledTimes(1)
})

it('supports keyboard selection and keeps Enter in search from submitting the order', async () => {
  const user = userEvent.setup()
  const submit = vi.fn((event: FormEvent) => event.preventDefault())
  const onSelect = vi.fn()
  render(
    <form onSubmit={submit}>
      <Harness onSelect={onSelect} />
    </form>,
  )
  await user.type(screen.getByRole('searchbox'), 'Ір')
  await screen.findByRole('option')
  await user.keyboard('{Enter}')
  expect(submit).not.toHaveBeenCalled()
  expect(onSelect).not.toHaveBeenCalled()
  await user.keyboard('{ArrowDown}{Enter}')
  expect(onSelect).toHaveBeenCalledWith(customer())
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveFocus()
})

it('keeps the create button outside the dropdown', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  render(
    <CustomerSearchPicker
      query="Ір"
      onQueryChange={vi.fn()}
      selectedId={null}
      onSelect={vi.fn()}
      initialOpen
      onCreate={onCreate}
    />,
  )
  const popup = await screen.findByRole('dialog', {
    name: 'Результати пошуку клієнтів',
  })
  expect(
    within(popup).queryByRole('button', { name: 'Створити нового клієнта' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('searchbox'))
  await user.keyboard('{Escape}')
  await user.click(
    screen.getByRole('button', { name: 'Створити нового клієнта' }),
  )
  expect(onCreate).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('loads recent customers without an invalid empty search, and restores them when cleared', async () => {
  // The search endpoint requires a nonempty q; the list endpoint allows no query.
  search.mockImplementation((query: string) =>
    query.trim()
      ? Promise.resolve([customer('2', 'Олена')])
      : Promise.reject(new Error('Search query is required')),
  )
  const user = userEvent.setup()
  render(<Harness initialOpen />)

  expect(
    await screen.findByRole('option', { name: 'Обрати клієнта Ірина' }),
  ).toBeVisible()
  expect(search).not.toHaveBeenCalled()
  expect(list).toHaveBeenCalledOnce()
  expect(list.mock.calls[0]?.[0]).toEqual({ page: 1, pageSize: 20 })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  await user.type(screen.getByRole('searchbox'), 'Ол')
  expect(
    await screen.findByRole('option', { name: 'Обрати клієнта Олена' }),
  ).toBeVisible()
  expect(search.mock.calls[0]?.[0]).toBe('Ол')

  await user.clear(screen.getByRole('searchbox'))
  expect(
    await screen.findByRole('option', { name: 'Обрати клієнта Ірина' }),
  ).toBeVisible()
  expect(list).toHaveBeenCalledTimes(2)
  expect(search).toHaveBeenCalledTimes(1)
})

it.each(['field', 'card'] as const)(
  'shows a committed customer in %s appearance and supports cancel, replace and clear',
  async (selectionAppearance) => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <Harness
        explicitSelection
        selectionAppearance={selectionAppearance}
        onSelect={onSelect}
      />,
    )
    await user.type(screen.getByRole('searchbox'), 'Ір')
    await user.click(
      await screen.findByRole('option', { name: 'Обрати клієнта Ірина' }),
    )
    expect(
      screen.getByRole('status', { name: 'Клієнта обрано' }),
    ).toHaveTextContent('Ірина')
    expect(screen.queryByRole('searchbox')).toBeNull()
    if (selectionAppearance === 'card') {
      expect(
        screen.getByRole('button', { name: 'Змінити клієнта' }),
      ).toHaveTextContent('2 замовлення')
      expect(
        screen.getByRole('button', { name: 'Змінити клієнта' }),
      ).toHaveTextContent('+380')
    }
    expect(screen.queryByText('Клієнта обрано')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Змінити клієнта' }),
    ).toHaveTextContent('Ірина')
    expect(
      screen.getByRole('button', { name: 'Змінити клієнта' }),
    ).toHaveFocus()
    search.mockResolvedValue([customer('2', 'Олена')])
    await user.click(screen.getByRole('button', { name: 'Змінити клієнта' }))
    const replacement = screen.getByRole('searchbox')
    expect(replacement).toHaveFocus()
    await user.type(replacement, 'Олена')
    expect(
      screen.getByRole('status', { name: 'Клієнта обрано' }),
    ).toHaveTextContent('Ірина')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(
      screen.getByRole('status', { name: 'Клієнта обрано' }),
    ).toHaveTextContent('Ірина')
    expect(onSelect).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Змінити клієнта' }))
    await user.type(screen.getByRole('searchbox'), 'Олена')
    await user.click(
      await screen.findByRole('option', { name: 'Обрати клієнта Олена' }),
    )
    expect(
      screen.getByRole('status', { name: 'Клієнта обрано' }),
    ).toHaveTextContent('Олена')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(onSelect).toHaveBeenLastCalledWith(customer('2', 'Олена'))
    await user.click(
      screen.getByRole('button', { name: 'Прибрати клієнта Олена' }),
    )
    expect(screen.queryByRole('status', { name: 'Клієнта обрано' })).toBeNull()
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('searchbox')).toHaveFocus()
  },
)
