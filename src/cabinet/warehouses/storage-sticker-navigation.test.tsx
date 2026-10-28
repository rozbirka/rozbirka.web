import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { WarehousesScreen } from './WarehousesScreen'
import { cabinetModules } from '../module-registry'

const api = vi.hoisted(() => ({
  getWarehouse: vi.fn(),
  getZone: vi.fn(),
  getSection: vi.fn(),
  getSections: vi.fn(),
  getShelves: vi.fn(),
  getZones: vi.fn(),
}))
const access = vi.hoisted(() => ({ permissions: new Set(['inventory.view']) }))
vi.mock('@/api/inventory', () => ({ inventoryApi: api }))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: { id: 't', slug: 'yard' },
    snapshot: {
      tenantId: 't',
      userId: 'u',
      generation: 1,
      permissions: access.permissions,
    },
  }),
}))
vi.mock('../use-latest-mutation-guard', () => ({
  useLatestMutationGuard: () => ({
    requireLatestMutation: () => ({ signal: new AbortController().signal }),
  }),
}))
const zone = {
  id: 'z',
  warehouseId: 'w',
  warehouseName: 'Склад',
  name: 'Зона',
  code: 'Z',
  isActive: true,
  isSystemUnassigned: false,
}
const section = {
  id: 's',
  zoneId: 'z',
  warehouseId: 'w',
  zoneName: 'Зона',
  name: 'Секція',
  code: 'S',
  isActive: true,
}
function Url() {
  const location = useLocation()
  return (
    <output data-testid="url">
      {location.pathname}
      {location.search}
    </output>
  )
}
function mount(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <WarehousesScreen definition={cabinetModules.warehouses} />
      <Url />
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  access.permissions = new Set(['inventory.view'])
  api.getWarehouse.mockResolvedValue({
    id: 'w',
    name: 'Склад',
    code: 'W',
    isActive: true,
    isSystemDefault: true,
    unassignedPartCount: 0,
    zones: [zone],
  })
  api.getZone.mockResolvedValue(zone)
  api.getSection.mockResolvedValue(section)
  api.getSections.mockResolvedValue([section])
  api.getShelves.mockResolvedValue([])
  api.getZones.mockResolvedValue([zone])
})
it('merges print into the default warehouse top menu with view permission alone', async () => {
  mount('/app/yard/warehouses/w')
  const menu = await screen.findByRole('button', {
    name: 'Інші дії зі складом',
  })
  expect(menu.closest('.rz-topbar__actions')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Дії із зонами' })).toBeNull()
  await userEvent.click(menu)
  expect(
    screen.queryByRole('menuitem', { name: 'Архівувати склад' }),
  ).toBeNull()
  await userEvent.click(
    screen.getByRole('menuitem', { name: 'Друк стікерів зон' }),
  )
  expect(screen.getByTestId('url')).toHaveTextContent(
    '/app/yard/stickers?type=locations&kind=zone&parent=w&select=all',
  )
})
it.each([
  ['zones/z', 'Дії із зоною Зона', 'Друк стікерів секцій', 'section', 'z'],
  ['sections/s', 'Дії з секцією Секція', 'Друк стікерів полиць', 'shelf', 's'],
])(
  'moves the %s print menu into the top actions',
  async (path, menuName, printName, kind, parent) => {
    mount(`/app/yard/warehouses/${path}`)
    const menu = await screen.findByRole('button', { name: menuName })
    expect(menu.closest('.rz-topbar__actions')).not.toBeNull()
    const table = screen.getByRole('region', {
      name: kind === 'shelf' ? 'Полиця' : 'Секція',
    })
    expect(within(table).queryByRole('button', { name: menuName })).toBeNull()
    await userEvent.click(menu)
    await userEvent.click(screen.getByRole('menuitem', { name: printName }))
    expect(screen.getByTestId('url')).toHaveTextContent(
      `/app/yard/stickers?type=locations&kind=${kind}&parent=${parent}&select=all`,
    )
  },
)
it.each([
  { ...zone, isSystemUnassigned: true },
  { ...zone, isActive: false },
])('does not add print for unusable zones', async (data) => {
  api.getZone.mockResolvedValue(data)
  mount('/app/yard/warehouses/zones/z')
  await screen.findByRole('heading', { name: 'Зона' })
  expect(screen.queryByRole('button', { name: 'Дії із зоною Зона' })).toBeNull()
})

it('does not add a print entry for an active zone in an archived warehouse', async () => {
  api.getWarehouse.mockResolvedValue({
    id: 'w',
    name: 'Склад',
    isActive: false,
    zones: [zone],
  })
  mount('/app/yard/warehouses/zones/z')
  await screen.findByRole('heading', { name: 'Зона' })
  expect(screen.queryByRole('button', { name: 'Дії із зоною Зона' })).toBeNull()
})

it('does not expose print for an archived warehouse', async () => {
  api.getWarehouse.mockResolvedValue({
    id: 'w',
    name: 'Склад',
    code: 'W',
    isActive: false,
    zones: [],
    unassignedPartCount: 0,
  })
  mount('/app/yard/warehouses/w')
  await userEvent.click(
    await screen.findByRole('button', { name: 'Інші дії зі складом' }),
  )
  expect(
    screen.queryByRole('menuitem', { name: 'Друк стікерів зон' }),
  ).toBeNull()
})
it('requires inventory viewing for print even when management is present', async () => {
  access.permissions = new Set(['inventory.zones.manage'])
  mount('/app/yard/warehouses/w')
  await userEvent.click(
    await screen.findByRole('button', { name: 'Інші дії зі складом' }),
  )
  expect(
    screen.queryByRole('menuitem', { name: 'Друк стікерів зон' }),
  ).toBeNull()
})
it.each(['missing', 'mismatched'] as const)(
  'does not expose print when the warehouse ancestor is %s',
  async (state) => {
    if (state === 'missing')
      api.getWarehouse.mockRejectedValue(new Error('unavailable'))
    else api.getWarehouse.mockResolvedValue({ id: 'foreign', isActive: true })
    mount('/app/yard/warehouses/zones/z')
    await screen.findByRole('alert')
    expect(
      screen.queryByRole('button', { name: 'Дії із зоною Зона' }),
    ).toBeNull()
  },
)

it('does not expose print for a warehouse response outside the requested scope', async () => {
  api.getWarehouse.mockResolvedValue({
    id: 'foreign',
    name: 'Інший склад',
    code: 'F',
    isActive: true,
    zones: [],
    unassignedPartCount: 0,
  })
  mount('/app/yard/warehouses/w')
  await screen.findByRole('alert')
  expect(
    screen.queryByRole('button', { name: 'Інші дії зі складом' }),
  ).toBeNull()
})
