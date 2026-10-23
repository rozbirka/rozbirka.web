import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LocationSelect } from './LocationSelect'

const options = Array.from({ length: 100 }, (_, index) => ({
  id: `p${index + 1}`,
  name: `Полиця ${index + 1}`,
  code: `A01-${String(index + 1).padStart(3, '0')}`,
}))
function Example({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<string | null>('p50')
  return (
    <>
      <LocationSelect
        label="Полиця"
        searchLabel="Пошук полиці"
        noneLabel="Без полиці"
        value={value}
        onChange={setValue}
        options={options}
        disabled={disabled}
      />
      <output data-testid="selected">{value ?? 'none'}</output>
    </>
  )
}

function MultipleExample() {
  const [value, setValue] = useState<string[]>(['p50', 'other-warehouse'])
  return (
    <>
      <LocationSelect
        multiple
        label="Зона"
        searchLabel="Пошук зони"
        noneLabel="Виберіть зону"
        value={value}
        onChange={setValue}
        options={options}
      />
      <output data-testid="selected">{value.join(',')}</output>
    </>
  )
}

describe('compact location selection', () => {
  it('renders choices outside a clipping card while preserving the input relationship', async () => {
    const user = userEvent.setup()
    render(
      <div data-testid="clipping-card" style={{ overflow: 'clip' }}>
        <Example />
      </div>,
    )
    const input = screen.getByRole('searchbox')
    await user.click(input)
    const popup = screen.getByRole('dialog', { name: 'Пошук полиці' })
    expect(screen.getByTestId('clipping-card')).not.toContainElement(popup)
    expect(input).toHaveAttribute('aria-controls', popup.id)
    await user.type(input, 'a01-100{Enter}')
    expect(screen.getByTestId('selected')).toHaveTextContent('p100')
    expect(input).toHaveFocus()
  })

  it('keeps 100 options collapsed and searches by name or code without changing the selection', async () => {
    const user = userEvent.setup()
    render(<Example />)
    expect(screen.getByRole('searchbox')).toHaveValue('Полиця 50')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    await user.click(screen.getByRole('searchbox', { name: 'Пошук полиці' }))
    expect(screen.queryByText('A01-001')).not.toBeInTheDocument()
    const search = screen.getByRole('searchbox', { name: 'Пошук полиці' })
    await user.type(search, 'a01-100')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByTestId('selected')).toHaveTextContent('p50')
    await user.click(screen.getByRole('option', { name: /Полиця 100/ }))
    expect(screen.getByTestId('selected')).toHaveTextContent('p100')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('searchbox', { name: 'Пошук полиці' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    await user.type(screen.getByRole('searchbox'), 'Полиця 42')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('selected')).toHaveTextContent('p42')
  })

  it('supports keyboard selection, Escape, empty results and clearing the shelf', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'not found')
    expect(screen.getByText('Місць не знайдено')).toBeInTheDocument()
    await user.keyboard('{Enter}{Escape}')
    expect(screen.getByTestId('selected')).toHaveTextContent('p50')
    await user.click(screen.getByRole('searchbox'))
    await user.clear(screen.getByRole('searchbox'))
    await user.keyboard('{Home}{ArrowDown}{Enter}')
    expect(screen.getByTestId('selected')).toHaveTextContent('p1')
    await user.click(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'Полиця 100')
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: 'Без полиці',
      }),
    )
    expect(screen.getByTestId('selected')).toHaveTextContent('none')
  })

  it('toggles multiple locations while searching and preserves selections outside the current options', async () => {
    const user = userEvent.setup()
    render(<MultipleExample />)
    await user.click(screen.getByRole('searchbox', { name: 'Пошук зони' }))
    expect(screen.getByRole('listbox')).toHaveAttribute(
      'aria-multiselectable',
      'true',
    )
    await user.type(screen.getByRole('searchbox'), 'a01-100')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('selected')).toHaveTextContent(
      'p50,other-warehouse,p100',
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Пошук зони' })).toHaveFocus()
    await user.click(screen.getByRole('searchbox', { name: 'Пошук зони' }))
    await user.type(screen.getByRole('searchbox'), 'a01-100')
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('option'))
    expect(screen.getByTestId('selected')).toHaveTextContent(
      'p50,other-warehouse',
    )
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('restores the selected location after outside dismissal and prevents form submission on selection', async () => {
    const user = userEvent.setup()
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={submit}>
        <Example />
        <button type="button">Поза пошуком</button>
      </form>,
    )
    const input = screen.getByRole('searchbox', { name: 'Пошук полиці' })
    await user.click(input)
    expect(screen.getAllByRole('option')).toHaveLength(101)
    await user.type(input, 'not found')
    await user.click(screen.getByRole('button', { name: 'Поза пошуком' }))
    expect(input).toHaveValue('Полиця 50')
    expect(screen.getByTestId('selected')).toHaveTextContent('p50')
    await user.click(input)
    await user.type(input, 'A01-100')
    await user.keyboard('{Enter}')
    expect(input).toHaveValue('Полиця 100')
    expect(submit).not.toHaveBeenCalled()
    // The same focused field can reopen after selection.
    await user.click(input)
    expect(screen.getAllByRole('option')).toHaveLength(101)
    await user.keyboard('{Escape}')
    expect(input).toHaveValue('Полиця 100')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.keyboard('a')
    expect(input).toHaveValue('a')
    await user.keyboard('01-042{Enter}')
    expect(input).toHaveValue('Полиця 42')
  })

  it('searches by location context and omits the empty choice when it is disallowed', async () => {
    const user = userEvent.setup()
    const change = vi.fn()
    render(
      <LocationSelect
        label="Зона"
        searchLabel="Пошук зони"
        noneLabel="Виберіть зону"
        allowNone={false}
        value="a"
        onChange={change}
        options={[
          { id: 'a', name: 'A-01', code: 'first', context: 'Основний склад' },
          { id: 'b', name: 'B-01', code: 'second', context: 'Інший склад' },
        ]}
      />,
    )
    const input = screen.getByRole('searchbox')
    expect(input).toHaveValue('Основний склад · A-01')
    await user.click(input)
    expect(screen.getAllByRole('option')).toHaveLength(2)
    await user.type(input, 'Інший')
    expect(screen.getByRole('option', { name: 'B-01' })).toBeVisible()
    expect(change).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(change).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not open a disabled selector', async () => {
    const user = userEvent.setup()
    render(<Example disabled />)
    await user.click(screen.getByRole('searchbox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
