import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { PartPlacementPicker } from './PartPlacementPicker'
import {
  emptyPartPlacement,
  type PartPlacement,
  type PlacementOptions,
} from './part-placement-state'

const options: PlacementOptions = {
  zones: [
    {
      id: 'system',
      warehouseId: 'warehouse',
      warehouseName: 'Основний склад',
      name: 'Без зони',
      isSystemUnassigned: true,
      isActive: true,
    },
    {
      id: 'zone',
      warehouseId: 'warehouse',
      warehouseName: 'Основний склад',
      name: 'Контейнер',
      isSystemUnassigned: false,
      isActive: true,
    },
  ] as PlacementOptions['zones'],
  sections: [
    { id: 'section', zoneId: 'zone', name: 'Стелаж', isActive: true },
  ] as PlacementOptions['sections'],
  shelves: [
    {
      id: 'shelf',
      sectionId: 'section',
      zoneId: 'zone',
      name: 'Полиця',
      isActive: true,
    },
  ] as PlacementOptions['shelves'],
  loading: false,
  error: false,
  retry: () => undefined,
}

function Form() {
  const [value, setValue] = useState<PartPlacement>(emptyPartPlacement)
  return (
    <>
      <PartPlacementPicker
        value={value}
        onChange={setValue}
        options={options}
      />
      <output data-testid="selection">{JSON.stringify(value)}</output>
    </>
  )
}

it('reveals each location level and clears descendants when its parent changes', async () => {
  const user = userEvent.setup()
  render(<Form />)
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Склад' }),
    'warehouse',
  )
  expect(screen.getByRole('combobox', { name: 'Зона' })).toHaveValue('system')
  expect(
    screen.queryByRole('combobox', { name: 'Секція' }),
  ).not.toBeInTheDocument()

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Зона' }),
    'zone',
  )
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Секція' }),
    'section',
  )
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Полиця' }),
    'shelf',
  )
  expect(
    JSON.parse(screen.getByTestId('selection').textContent ?? '{}'),
  ).toMatchObject({ zoneId: 'zone', sectionId: 'section', shelfId: 'shelf' })

  await user.selectOptions(screen.getByRole('combobox', { name: 'Секція' }), '')
  expect(
    screen.queryByRole('combobox', { name: 'Полиця' }),
  ).not.toBeInTheDocument()
  expect(
    JSON.parse(screen.getByTestId('selection').textContent ?? '{}'),
  ).toMatchObject({ zoneId: 'zone', sectionId: '', shelfId: '' })
})
