import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, it } from 'vitest'
import type { Warehouse } from '@/api/inventory'
import { WarehouseBrowser } from './WarehouseBrowser'
import { LocationSearch } from '../inventory/LocationBrowser'

const warehouses: Warehouse[] = Array.from({ length: 17 }, (_, index) => ({
  id: `warehouse-${index + 1}`,
  name: `Склад ${index + 1}`,
  code: `W${index + 1}`,
  isActive: true,
  isSystemDefault: index === 0,
  zoneCount: 2,
  qrCode: `qr-${index + 1}`,
  tenantId: 'tenant-1',
  createdAt: '2026-10-26T08:00:00Z',
  updatedAt: '2026-10-26T08:00:00Z',
}))

function Url() {
  return <output data-testid="url">{useLocation().search}</output>
}

function mount(items = warehouses, search = '?keep=1') {
  render(
    <MemoryRouter initialEntries={[`/warehouses${search}`]}>
      <LocationSearch label="Пошук складу" placeholder="Назва або код" />
      <WarehouseBrowser
        warehouses={items}
        stock={new Map()}
        base="/warehouses"
      />
      <Url />
    </MemoryRouter>,
  )
}

it('keeps pagination visible for a single page of warehouses', () => {
  mount(warehouses.slice(0, 2))
  const pager = screen.getByRole('navigation', { name: 'Сторінки складів' })
  expect(pager).toHaveTextContent('1–2 з 2')
  expect(
    within(pager).getByRole('button', { name: 'Попередня сторінка' }),
  ).toBeDisabled()
  expect(
    within(pager).getByRole('button', { name: 'Наступна сторінка' }),
  ).toBeDisabled()
})

it('pages 15 warehouses, preserves URL filters and resets the page on search', async () => {
  const user = userEvent.setup()
  mount()
  const pager = screen.getByRole('navigation', { name: 'Сторінки складів' })
  expect(pager).toHaveTextContent('1–15 з 17')
  expect(
    screen.queryByRole('link', { name: 'Відкрити склад Склад 16' }),
  ).toBeNull()
  await user.click(
    within(pager).getByRole('button', { name: 'Наступна сторінка' }),
  )
  expect(pager).toHaveTextContent('16–17 з 17')
  expect(
    screen.getByRole('link', { name: 'Відкрити склад Склад 16' }),
  ).toHaveAttribute('href', '/warehouses/warehouse-16')
  expect(screen.getByTestId('url')).toHaveTextContent('keep=1&locationPage=2')
  await user.type(screen.getByRole('searchbox', { name: 'Пошук складу' }), 'W1')
  expect(pager).toHaveTextContent('1–9 з 9')
  expect(screen.getByTestId('url')).not.toHaveTextContent('locationPage')
  expect(screen.getByTestId('url')).toHaveTextContent('keep=1')
  await user.clear(screen.getByRole('searchbox', { name: 'Пошук складу' }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук складу' }),
    'missing',
  )
  expect(
    screen.queryByRole('navigation', { name: 'Сторінки складів' }),
  ).toBeNull()
})

it('clamps an outdated page after the warehouse list shrinks', () => {
  mount(warehouses.slice(0, 2), '?locationPage=99')
  expect(
    screen.getByRole('navigation', { name: 'Сторінки складів' }),
  ).toHaveTextContent('1–2 з 2')
  expect(screen.getAllByRole('link')).toHaveLength(2)
})
