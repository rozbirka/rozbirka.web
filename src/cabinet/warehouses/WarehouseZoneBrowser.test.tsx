import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, it, vi } from 'vitest'
import { WarehouseZoneBrowser } from './WarehouseZoneBrowser'
import { LocationSearch } from '../inventory/LocationBrowser'

const physical = Array.from({ length: 17 }, (_, index) => ({
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

function mount(canManage = true, archivedOnly = false) {
  const onEdit = vi.fn()
  const onArchive = vi.fn()
  const onRestore = vi.fn()
  render(
    <MemoryRouter
      initialEntries={[
        `/warehouses/wh?locationPage=2&keep=1${archivedOnly ? '&locationStatus=archived' : ''}`,
      ]}
    >
      <LocationSearch label="Пошук зони" placeholder="Назва або код" />
      <WarehouseZoneBrowser
        zones={[
          unassigned,
          ...physical,
          { ...physical[0]!, id: 'old', name: 'Архівна зона', isActive: false },
        ]}
        base="/warehouses"
        partsBase={canManage ? '/parts' : null}
        unassignedHref="/warehouses/wh/unassigned"
        canManage={canManage}
        onAdd={vi.fn()}
        onEdit={onEdit}
        onArchive={onArchive}
        onRestore={onRestore}
      />
      <Url />
    </MemoryRouter>,
  )
  return { onEdit, onArchive, onRestore }
}

it('searches physical zones by code, resets pagination and keeps unassigned visible', async () => {
  const user = userEvent.setup()
  mount()
  expect(screen.getByRole('heading', { name: 'Зони' })).toHaveTextContent(
    /^Зони$/,
  )
  expect(screen.getByRole('link', { name: 'Зона 16' })).toHaveAttribute(
    'href',
    '/warehouses/zones/zone-16',
  )
  await user.type(screen.getByRole('searchbox', { name: 'Пошук зони' }), 'Z1')
  expect(screen.getByRole('link', { name: 'Зона 1' })).toHaveTextContent('Z1')
  expect(screen.queryByRole('meter')).toBeNull()
  expect(screen.queryByText('Запчастин')).toBeNull()
  expect(screen.queryByText('Заповнення')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Зона 2' })).toBeNull()
  const list = screen.getByRole('group', { name: 'Список зон' })
  expect(within(list).getAllByRole('link')[0]).toHaveAccessibleName('Без зони')
  expect(screen.getByRole('link', { name: 'Без зони' })).toHaveAttribute(
    'href',
    '/warehouses/wh/unassigned',
  )
  expect(
    screen.queryByRole('button', { name: 'Дії із зоною Без зони' }),
  ).toBeNull()
  expect(screen.getByTestId('url')).not.toHaveTextContent('locationPage')
  expect(screen.getByTestId('url')).toHaveTextContent('keep=1')
  await user.clear(screen.getByRole('searchbox', { name: 'Пошук зони' }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук зони' }),
    'missing',
  )
  expect(screen.getByText('Місць не знайдено')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Без зони' })).toBeVisible()
})

it('keeps edit and archive actions independent of opening a zone', async () => {
  const user = userEvent.setup()
  const { onEdit, onArchive } = mount()
  await user.click(screen.getByRole('button', { name: 'Дії із зоною Зона 16' }))
  await user.click(screen.getByRole('menuitem', { name: 'Редагувати' }))
  expect(onEdit).toHaveBeenCalledWith(physical[15])
  await user.click(screen.getByRole('button', { name: 'Дії із зоною Зона 16' }))
  await user.click(screen.getByRole('menuitem', { name: 'Архівувати' }))
  expect(onArchive).toHaveBeenCalledWith(physical[15])
})

it('keeps zone navigation without management or parts links', () => {
  mount(false)
  expect(screen.getByRole('link', { name: 'Зона 16' })).toHaveTextContent('Z16')
  expect(screen.queryByRole('meter')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Без зони' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Додати зону' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Дії із зоною Зона 16' }),
  ).toBeNull()
})

it.each([true, false])(
  'shows archived zones and gates restore by management permission (%s)',
  async (canManage) => {
    const user = userEvent.setup()
    const { onRestore } = mount(canManage, true)
    expect(screen.getByText('Архівна зона')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Архівна зона' }),
    ).not.toBeInTheDocument()
    const action = screen.queryByRole('button', {
      name: 'Дії із зоною Архівна зона',
    })
    if (canManage) {
      await user.click(action!)
      expect(
        screen.queryByRole('menuitem', { name: /^Архівувати$/ }),
      ).not.toBeInTheDocument()
      await user.click(screen.getByRole('menuitem', { name: 'Розархівувати' }))
      expect(onRestore).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'old' }),
      )
    } else expect(action).not.toBeInTheDocument()
  },
)

it('shows a range and disabled navigation for a single page of zones', async () => {
  const user = userEvent.setup()
  mount()
  const pager = screen.getByRole('navigation', { name: 'Сторінки зон' })
  expect(pager).toHaveTextContent('16–17 з 17')
  expect(
    within(pager).getByRole('button', { name: 'Наступна сторінка' }),
  ).toBeDisabled()
  await user.click(
    within(pager).getByRole('button', { name: 'Попередня сторінка' }),
  )
  expect(pager).toHaveTextContent('1–15 з 17')
  expect(screen.queryByRole('link', { name: 'Зона 16' })).toBeNull()
  await user.type(screen.getByRole('searchbox', { name: 'Пошук зони' }), 'Z17')
  expect(pager).toHaveTextContent('1–1 з 1')
  expect(
    within(pager).getByRole('button', { name: 'Попередня сторінка' }),
  ).toBeDisabled()
  expect(
    within(pager).getByRole('button', { name: 'Наступна сторінка' }),
  ).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Без зони' })).toBeVisible()
})
