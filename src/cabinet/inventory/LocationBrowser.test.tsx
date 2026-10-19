import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LocationBrowser } from './LocationBrowser'
import type { InventorySection, InventoryShelf } from '@/api/inventory'

const zoneFixture = {
  createdAt: '',
  updatedAt: '',
  tenantId: 't',
  qrCode: 'QR',
  id: 'z',
  name: 'Зона А',
  code: 'A',
  isActive: true,
  isSystemUnassigned: false,
}
const sections: InventorySection[] = Array.from({ length: 21 }, (_, i) => ({
  id: `s${i}`,
  name: `Секція ${i + 1}`,
  code: `S${i + 1}`,
  zoneId: 'z',
  zoneName: 'Зона А',
  warehouseId: 'w',
  warehouseName: 'Склад',
  isActive: true,
  qrCode: `section:${i}`,
  partCount: 2,
}))
const shelves: InventoryShelf[] = sections.flatMap((section) =>
  Array.from({ length: 100 }, (_, i) => ({
    id: `${section.id}-p${i}`,
    name: `Полиця ${i + 1}`,
    code: `${section.code}-P${i + 1}`,
    sectionId: section.id,
    sectionName: section.name,
    zoneId: 'z',
    zoneName: 'Зона А',
    warehouseId: 'w',
    warehouseName: 'Склад',
    isActive: true,
    qrCode: `shelf:${i}`,
    partCount: i,
  })),
)
function Url() {
  const location = useLocation()
  return (
    <output data-testid="url">
      {location.pathname}
      {location.search}
      {JSON.stringify(location.state)}
    </output>
  )
}
function mount(
  section = false,
  initial = '/warehouse',
  access = true,
  data = shelves,
) {
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: initial.split('?')[0] ?? '/',
          search: initial.includes('?') ? '?' + initial.split('?')[1] : '',
          state: { zoneId: 'z', zoneSearch: 'S7' },
        },
      ]}
    >
      <LocationBrowser
        zone={{ ...zoneFixture, warehouseId: 'w', warehouseName: 'Склад' }}
        {...(section ? { section: sections[0] } : {})}
        sections={sections}
        shelves={data}
        base="/inventory"
        canManage={false}
        canViewParts={access}
        partsBase="/parts"
        onAddSection={() => undefined}
        onAddShelf={() => undefined}
      />
      <Url />
    </MemoryRouter>,
  )
}
describe('location resource navigation', () => {
  it('shows active shelf totals per section independently of search and other zones', async () => {
    const user = userEvent.setup()
    const first = shelves[0]!
    mount(false, '/warehouse', true, [
      first,
      { ...first, id: 'second' },
      { ...first, id: 'inactive', isActive: false },
      { ...first, id: 'foreign-zone', zoneId: 'other' },
      { ...first, id: 'foreign-warehouse', warehouseId: 'other' },
    ])
    expect(
      within(screen.getByRole('group', { name: 'Секція: Секція 1' })).getByText(
        /Полиць: 2/,
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Секція: Секція 2' })).getByText(
        /Полиць: 0/,
      ),
    ).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'S1')
    expect(
      within(screen.getByRole('group', { name: 'Секція: Секція 1' })).getByText(
        /Полиць: 2/,
      ),
    ).toBeInTheDocument()
  })
  it('pages sections by ten and restores page from the URL', async () => {
    const user = userEvent.setup()
    mount()
    expect(screen.getAllByRole('link', { name: /^Секція \d/ })).toHaveLength(10)
    expect(screen.getByRole('link', { name: 'Секція 1, S1' })).toHaveAttribute(
      'href',
      '/inventory/sections/s0',
    )
    await user.click(
      within(
        screen.getByRole('navigation', { name: 'Сторінки секцій' }),
      ).getByRole('button', { name: /Наступна/ }),
    )
    expect(
      screen.getByRole('link', { name: 'Секція 11, S11' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Секція 1, S1' }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('locationPage=2')
  })
  it('searches sections and carries search into section navigation state', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByRole('searchbox'), 'S7')
    expect(screen.getAllByRole('link', { name: /^Секція \d/ })).toHaveLength(1)
    await user.click(screen.getByRole('link', { name: 'Секція 7, S7' }))
    expect(screen.getByTestId('url')).toHaveTextContent(
      '/inventory/sections/s6',
    )
    expect(screen.getByTestId('url')).toHaveTextContent('locationSearch=S7')
  })
  it('pages only the selected section shelves by ten and restores URL page', async () => {
    const user = userEvent.setup()
    mount(true, '/section?locationPage=2')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(
      11,
    )
    expect(screen.getByText('S1-P11')).toBeInTheDocument()
    expect(screen.queryByText('S2-P11')).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'S1-P100')
    expect(screen.getByText('Полиця 100')).toBeInTheDocument()
    expect(screen.getByTestId('url')).not.toHaveTextContent('locationPage=2')
    expect(screen.getByTestId('url')).toHaveTextContent('"zoneSearch":"S7"')
  })
  it('links a shelf to parts with its full hierarchy and ten rows, without a drawer', () => {
    mount(true, '/section?locationSearch=S1-P100')
    expect(
      screen.getByRole('link', { name: 'Переглянути запчастини: Полиця 100' }),
    ).toHaveAttribute(
      'href',
      '/parts?warehouse=w&zone=z&section=s0&shelf=s0-p99',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('links direct zone parts without a separate per-section count link', () => {
    mount()
    expect(
      screen.getByRole('link', { name: /У зоні без секції/ }),
    ).toHaveAttribute('href', '/parts?warehouse=w&zone=z&without_section=1')
    expect(
      screen.queryByRole('link', {
        name: 'Переглянути запчастини секції: Секція 1',
      }),
    ).not.toBeInTheDocument()
  })
  it('links direct section parts without creating a fake shelf', () => {
    mount(true)
    expect(
      screen.getByRole('link', { name: /У секції без полиці/ }),
    ).toHaveAttribute(
      'href',
      '/parts?warehouse=w&zone=z&section=s0&without_shelf=1',
    )
  })
  it('keeps the uncounted direct-parts link and hides unavailable management actions', () => {
    mount(true, '/section')
    expect(
      screen.getByRole('link', { name: /У секції без полиці/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Додати полицю' }),
    ).not.toBeInTheDocument()
  })
  it('keeps structure readable without parts permission and does not open URL contents', () => {
    mount(true, '/section?locationContents=s0-p0', false)
    expect(screen.getByText('S1-P1')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Переглянути запчастини/ }),
    ).not.toBeInTheDocument()
  })
  it('shows an empty section and no matching shelves separately', async () => {
    const user = userEvent.setup()
    mount(true, '/section', true, [])
    expect(screen.getByText('Полиць поки немає')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'missing')
    expect(screen.getByText('Місць не знайдено')).toBeInTheDocument()
  })
})
