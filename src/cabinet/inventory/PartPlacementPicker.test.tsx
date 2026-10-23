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
  const choose = async (label: string, option: string) => {
    await user.click(
      screen.getByRole('searchbox', {
        name: `Пошук ${{ Склад: 'складу', Зона: 'зони', Секція: 'секції', Полиця: 'полиці' }[label]}`,
      }),
    )
    await user.click(screen.getByRole('option', { name: option }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  }
  await choose('Склад', 'Основний склад')
  expect(screen.getByRole('searchbox', { name: 'Пошук зони' })).toBeVisible()
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук секції' }),
  ).not.toBeInTheDocument()
  await choose('Зона', 'Контейнер')
  await choose('Секція', 'Стелаж')
  await choose('Полиця', 'Полиця')
  expect(
    JSON.parse(screen.getByTestId('selection').textContent ?? '{}'),
  ).toMatchObject({
    warehouseId: 'warehouse',
    zoneId: 'zone',
    sectionId: 'section',
    shelfId: 'shelf',
  })
  await choose('Секція', 'Залишити в зоні')
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук полиці' }),
  ).not.toBeInTheDocument()
  expect(
    JSON.parse(screen.getByTestId('selection').textContent ?? '{}'),
  ).toMatchObject({
    zoneId: 'zone',
    sectionId: '',
    shelfId: '',
  })
  await choose('Секція', 'Стелаж')
  await choose('Полиця', 'Полиця')
  await choose('Зона', 'Лише склад')
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук секції' }),
  ).not.toBeInTheDocument()
  expect(
    JSON.parse(screen.getByTestId('selection').textContent ?? '{}'),
  ).toMatchObject({
    warehouseId: 'warehouse',
    zoneId: 'system',
    sectionId: '',
    shelfId: '',
  })
})

it('searches and selects with the keyboard without changing placement until selection', async () => {
  const user = userEvent.setup()
  render(<Form />)
  await user.click(screen.getByRole('searchbox', { name: 'Пошук складу' }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук складу' }),
    'Основний',
  )
  expect(
    JSON.parse(screen.getByTestId('selection').textContent ?? '{}'),
  ).toEqual(emptyPartPlacement)
  await user.keyboard('{Enter}')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await user.click(screen.getByRole('searchbox', { name: 'Пошук зони' }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук зони' }),
    'Контейнер',
  )
  await user.keyboard('{Enter}')
  expect(screen.getByRole('searchbox', { name: 'Пошук зони' })).toBeVisible()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await user.click(screen.getByRole('searchbox', { name: 'Пошук складу' }))
  await user.click(screen.getByRole('option', { name: 'Вибрати склад' }))
  expect(
    JSON.parse(screen.getByTestId('selection').textContent ?? '{}'),
  ).toEqual(emptyPartPlacement)
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук зони' }),
  ).not.toBeInTheDocument()
})
