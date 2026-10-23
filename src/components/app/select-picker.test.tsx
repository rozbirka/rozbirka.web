import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { SelectPicker } from './select-picker'
import { Sheet } from './form-dialog'

const options = [
  { value: '', label: 'Усі склади' },
  { value: 'main', label: 'Основний склад', description: 'Київ', count: 12 },
  { value: 'archive', label: 'Архів', disabled: true },
]
function Probe() {
  const [value, setValue] = useState('')
  return (
    <SelectPicker
      label="Склад"
      options={options}
      value={value}
      onValueChange={setValue}
    />
  )
}
it('searches without changing the selection and closes after choosing one value', async () => {
  const user = userEvent.setup()
  render(<Probe />)
  const trigger = screen.getByRole('button', { name: 'Склад' })
  expect(trigger).toHaveTextContent('Усі склади')
  await user.click(trigger)
  expect(screen.getByRole('option', { name: 'Архів' })).toBeDisabled()
  await user.type(screen.getByRole('searchbox'), 'Київ')
  expect(trigger).toHaveTextContent('Усі склади')
  expect(screen.queryByRole('option', { name: 'Усі склади' })).toBeNull()
  await user.click(screen.getByRole('option', { name: 'Основний склад' }))
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(trigger).toHaveTextContent('Основний склад')
  expect(trigger).toHaveFocus()
  await user.click(trigger)
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(
    screen.getByRole('option', { name: 'Основний склад' }),
  ).toHaveAttribute('aria-selected', 'true')
})
it('dismisses only its own popup with Escape inside a sheet', async () => {
  const user = userEvent.setup()
  const close = vi.fn()
  render(
    <Sheet open onOpenChange={close} title="Нова деталь">
      <Probe />
    </Sheet>,
  )
  const trigger = screen.getByRole('button', { name: 'Склад' })
  await user.click(trigger)
  await user.keyboard('{ArrowDown}{Escape}')
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(screen.getByRole('dialog', { name: 'Нова деталь' })).toBeVisible()
  expect(trigger).toHaveFocus()
  expect(close).not.toHaveBeenCalled()
})
it('associates errors with the control and keeps disabled selection closed', async () => {
  const user = userEvent.setup()
  render(
    <SelectPicker
      label="Склад"
      options={options}
      value=""
      onValueChange={vi.fn()}
      error="Оберіть склад"
      showLabel
      disabled
    />,
  )
  const trigger = screen.getByRole('button', { name: 'Склад' })
  expect(trigger).toHaveAccessibleDescription('Оберіть склад')
  expect(trigger).toHaveAttribute('aria-invalid', 'true')
  await user.click(trigger)
  expect(screen.queryByRole('listbox')).toBeNull()
})

it('opens fixed choices without search and selects with the keyboard, skipping disabled items', async () => {
  const user = userEvent.setup()
  const change = vi.fn()
  render(
    <SelectPicker
      label="Сортувати"
      searchable={false}
      options={[
        { value: 'amount', label: 'Сумою' },
        { value: 'disabled', label: 'Недоступно', disabled: true },
        { value: 'name', label: 'Іменем' },
      ]}
      value="name"
      onValueChange={change}
    />,
  )
  const trigger = screen.getByRole('button', { name: 'Сортувати' })
  await user.click(trigger)
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.getByRole('option', { name: 'Іменем' })).toHaveFocus()
  await user.keyboard('{Home}{ArrowDown}')
  expect(screen.getByRole('option', { name: 'Іменем' })).toHaveFocus()
  await user.keyboard('{ArrowUp}{Enter}')
  expect(change).toHaveBeenCalledWith('amount')
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(trigger).toHaveFocus()
})
