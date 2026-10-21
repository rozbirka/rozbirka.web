import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
  it('keeps 100 options collapsed and searches by name or code without changing the selection', async () => {
    const user = userEvent.setup()
    render(<Example />)
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Полиця: Полиця 50' }))
    const search = screen.getByRole('combobox', { name: 'Пошук полиці' })
    await user.type(search, 'a01-100')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByTestId('selected')).toHaveTextContent('p50')
    await user.click(screen.getByRole('option', { name: /Полиця 100/ }))
    expect(screen.getByTestId('selected')).toHaveTextContent('p100')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Полиця: Полиця 100' }))
    expect(screen.getByRole('combobox')).toHaveValue('')
    await user.type(screen.getByRole('combobox'), 'Полиця 42')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('selected')).toHaveTextContent('p42')
  })

  it('supports keyboard selection, Escape, empty results and clearing the shelf', async () => {
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByRole('button'))
    await user.type(screen.getByRole('combobox'), 'not found')
    expect(screen.getByRole('status')).toBeInTheDocument()
    await user.keyboard('{Enter}{Escape}')
    expect(screen.getByTestId('selected')).toHaveTextContent('p50')
    await user.click(screen.getByRole('button'))
    await user.clear(screen.getByRole('combobox'))
    await user.keyboard('{Home}{ArrowDown}{Enter}')
    expect(screen.getByTestId('selected')).toHaveTextContent('p1')
    await user.click(screen.getByRole('button'))
    await user.type(screen.getByRole('combobox'), 'Полиця 100')
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
    await user.click(screen.getByRole('button', { name: 'Зона: Полиця 50' }))
    expect(screen.getByRole('listbox')).toHaveAttribute(
      'aria-multiselectable',
      'true',
    )
    await user.type(screen.getByRole('combobox'), 'a01-100')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('selected')).toHaveTextContent(
      'p50,other-warehouse,p100',
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Зона: Вибрано: 2' }),
    ).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Зона: Вибрано: 2' }))
    await user.type(screen.getByRole('combobox'), 'a01-100')
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('option'))
    expect(screen.getByTestId('selected')).toHaveTextContent(
      'p50,other-warehouse',
    )
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('does not open a disabled selector', async () => {
    const user = userEvent.setup()
    render(<Example disabled />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
