import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LocationBrowser, LocationSearch } from './LocationBrowser'
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
      <LocationSearch label="Пошук місця" placeholder="Назва або код" />
      <LocationBrowser
        zone={{ ...zoneFixture, warehouseId: 'w', warehouseName: 'Склад' }}
        {...(section ? { section: sections[0] } : {})}
        sections={sections}
        shelves={data}
        sectionShelfCounts={new Map(sections.map((item) => [item.id, 100]))}
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
  it('shows section names, codes and the shelf count', () => {
    mount()
    expect(
      screen.getByText('Виберіть секцію, щоб переглянути її полиці'),
    ).toBeVisible()
    const row = screen.getByRole('link', { name: 'Секція 1, S1' })
    expect(row).toHaveTextContent('Секція 1')
    expect(row).toHaveTextContent('S1')
    expect(row).toHaveAccessibleDescription('Полиць: 100')
    expect(within(row).getByText('100')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Секції' })).toHaveTextContent(
      /^Секції$/,
    )
  })
  it('keeps the full shelf count when searching sections', async () => {
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByRole('searchbox'), 'S7')
    expect(
      screen.getByRole('link', { name: 'Секція 7, S7' }),
    ).toHaveAccessibleDescription('Полиць: 100')
  })
  it('pages sections by fifteen and restores page from the URL', async () => {
    const user = userEvent.setup()
    mount()
    expect(screen.getAllByRole('link', { name: /^Секція \d/ })).toHaveLength(15)
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
      screen.getByRole('link', { name: 'Секція 16, S16' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Секція 16, S16' }),
    ).toHaveAccessibleDescription('Полиць: 100')
    expect(
      screen.queryByRole('link', { name: 'Секція 1, S1' }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('locationPage=2')
    expect(screen.getAllByRole('link', { name: /^Секція \d/ })).toHaveLength(6)
    const pager = screen.getByRole('navigation', { name: 'Сторінки секцій' })
    expect(pager).toHaveTextContent('16–21 з 21')
    expect(
      within(pager).getByRole('button', { name: /Наступна/ }),
    ).toBeDisabled()
    await user.click(within(pager).getByRole('button', { name: /Попередня/ }))
    expect(screen.getAllByRole('link', { name: /^Секція \d/ })).toHaveLength(15)
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
  it('pages only the selected section shelves by fifteen and restores URL page', async () => {
    const user = userEvent.setup()
    mount(true, '/section?locationPage=2')
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(
      16,
    )
    expect(screen.getByText('S1-P16')).toBeInTheDocument()
    expect(screen.queryByText('S2-P16')).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'S1-P100')
    expect(screen.getByText('Полиця 100')).toBeInTheDocument()
    const pager = screen.getByRole('navigation', { name: 'Сторінки полиць' })
    expect(pager).toHaveTextContent('1–1 з 1')
    expect(
      within(pager).getByRole('button', { name: /Наступна/ }),
    ).toBeDisabled()
    expect(screen.getByTestId('url')).not.toHaveTextContent('locationPage=2')
    expect(screen.getByTestId('url')).toHaveTextContent('"zoneSearch":"S7"')
  })
  it('links a shelf to parts with its full hierarchy without a drawer', () => {
    mount(true, '/section?locationSearch=S1-P100')
    expect(
      screen.getByRole('link', { name: 'Переглянути запчастини: Полиця 100' }),
    ).toHaveAttribute(
      'href',
      '/parts?warehouse=w&zone=z&section=s0&shelf=s0-p99',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('shows real sections without the direct zone parts row', () => {
    mount()
    expect(
      screen.queryByRole('link', { name: /У зоні без секції/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Секція 1, S1' })).toHaveAttribute(
      'href',
      '/inventory/sections/s0',
    )
    expect(
      screen.queryByRole('link', {
        name: 'Переглянути запчастини секції: Секція 1',
      }),
    ).not.toBeInTheDocument()
  })
  it('shows real shelves without the direct section parts row', () => {
    mount(true)
    expect(
      screen.queryByRole('link', { name: /У секції без полиці/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Переглянути запчастини: Полиця 1' }),
    ).toHaveAttribute(
      'href',
      '/parts?warehouse=w&zone=z&section=s0&shelf=s0-p0',
    )
  })
  it('hides unavailable management actions', () => {
    mount(true, '/section')
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
