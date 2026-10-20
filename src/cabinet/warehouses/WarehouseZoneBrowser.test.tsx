import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, it, vi } from 'vitest'
import { WarehouseZoneBrowser } from './WarehouseZoneBrowser'
import { LocationSearch } from '../inventory/LocationBrowser'

const physical = Array.from({ length: 12 }, (_, index) => ({
  id: `zone-${index + 1}`,
  name: `Зона ${index + 1}`,
  code: `Z${index + 1}`,
  isActive: true,
  isSystemUnassigned: false,
}))
const unassigned = {
  ...physical[0]!,
  id: 'unassigned',
  name: 'Без зони',
  code: 'unassigned',
  isSystemUnassigned: true,
}

function Url() {
  return <output data-testid="url">{useLocation().search}</output>
}

function mount(canManage = true) {
  const onEdit = vi.fn()
  const onArchive = vi.fn()
  render(
    <MemoryRouter initialEntries={['/warehouses/wh?locationPage=2&keep=1']}>
      <LocationSearch label="Пошук зони" placeholder="Назва або код" />
      <WarehouseZoneBrowser
        zones={[unassigned, ...physical]}
        base="/warehouses"
        partsBase={canManage ? '/parts' : null}
        unassignedHref="/warehouses/wh/unassigned"
        canManage={canManage}
        onAdd={vi.fn()}
        onEdit={onEdit}
        onArchive={onArchive}
        headerActions={null}
        printWorkspace={null}
      />
      <Url />
    </MemoryRouter>,
  )
  return { onEdit, onArchive }
}

it('searches physical zones by code, resets pagination and keeps unassigned separate', async () => {
  const user = userEvent.setup()
  mount()
  expect(screen.getByRole('heading', { name: 'Зони' })).toHaveTextContent(
    /^Зони$/,
  )
  expect(screen.getByRole('link', { name: 'Зона 11' })).toHaveAttribute(
    'href',
    '/warehouses/zones/zone-11',
  )
  await user.type(screen.getByRole('searchbox', { name: 'Пошук зони' }), 'Z1')
  expect(screen.getByRole('link', { name: 'Зона 1' })).toHaveTextContent('Z1')
  expect(screen.queryByRole('meter')).toBeNull()
  expect(screen.queryByText('Запчастин')).toBeNull()
  expect(screen.queryByText('Заповнення')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Зона 2' })).toBeNull()
  const list = screen.getByRole('group', { name: 'Список зон' })
  expect(within(list).queryByRole('link', { name: 'Без зони' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Без зони' })).toHaveAttribute(
    'href',
    '/warehouses/wh/unassigned',
  )
  expect(
    screen.queryByRole('button', { name: 'Дії із зоною Без зони' }),
  ).toBeNull()
  expect(screen.getByTestId('url')).not.toHaveTextContent('locationPage')
  expect(screen.getByTestId('url')).toHaveTextContent('keep=1')
})

it('keeps edit and archive actions independent of opening a zone', async () => {
  const user = userEvent.setup()
  const { onEdit, onArchive } = mount()
  await user.click(screen.getByRole('button', { name: 'Дії із зоною Зона 11' }))
  await user.click(
    screen.getByRole('menuitem', { name: 'Редагувати зону Зона 11' }),
  )
  expect(onEdit).toHaveBeenCalledWith(physical[10])
  await user.click(screen.getByRole('button', { name: 'Дії із зоною Зона 11' }))
  await user.click(
    screen.getByRole('menuitem', { name: 'Архівувати зону Зона 11' }),
  )
  expect(onArchive).toHaveBeenCalledWith(physical[10])
})

it('keeps zone navigation without management or parts links', () => {
  mount(false)
  expect(screen.getByRole('link', { name: 'Зона 11' })).toHaveTextContent('Z11')
  expect(screen.queryByRole('meter')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Без зони' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Додати зону' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Дії із зоною Зона 11' }),
  ).toBeNull()
})
