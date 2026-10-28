import { render, screen, waitFor } from '@testing-library/react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocationLabelsPage } from './LocationLabelPrinter'
import { LegacyWarehouseRedirect } from '../warehouses/LegacyWarehouseRedirect'
const context = vi.hoisted(() => ({ permission: true }))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: { id: 't', slug: 'yard' },
    snapshot: {
      tenantId: 't',
      userId: 'u',
      permissions: new Set(context.permission ? ['inventory.view'] : []),
    },
  }),
}))
function Destination() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="url">
        {location.pathname}
        {location.search}
      </output>
      <output>{useNavigationType()}</output>
      <button onClick={() => void navigate(-1)}>Back</button>
    </>
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  context.permission = true
  vi.spyOn(window, 'open').mockReturnValue(null)
})
it.each(['zone', 'section', 'shelf'] as const)(
  'replaces old %s labels entry with the canonical workspace without printing',
  async (kind) => {
    render(
      <MemoryRouter
        initialEntries={['/before', '/old?labels=1']}
        initialIndex={1}
      >
        <Routes>
          <Route
            path="/old"
            element={
              <LocationLabelsPage
                target={{ kind, parentId: 'parent', parentName: 'Parent' }}
                inventoryBase="/inventory"
              />
            }
          />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('url')).toHaveTextContent(
        `/app/yard/stickers?type=locations&kind=${kind}&parent=parent&select=all`,
      ),
    )
    expect(screen.getByText('REPLACE')).toBeInTheDocument()
    expect(window.open).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/before')
  },
)
it('preserves an explicit subset instead of selecting the collection', async () => {
  render(
    <MemoryRouter initialEntries={['/old?labels=1&label=s1&label=s2']}>
      <Routes>
        <Route
          path="/old"
          element={
            <LocationLabelsPage
              target={{ kind: 'section', parentId: 'z', parentName: '' }}
              inventoryBase="/inventory"
            />
          }
        />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  )
  await waitFor(() =>
    expect(screen.getByTestId('url')).toHaveTextContent(
      'kind=section&parent=z&label=s1&label=s2',
    ),
  )
  expect(screen.getByTestId('url')).not.toHaveTextContent('select=all')
  expect(window.open).not.toHaveBeenCalled()
})
it.each([
  ['warehouses/w', 'zone', 'w'],
  ['zones/z', 'section', 'z'],
  ['sections/s', 'shelf', 's'],
])(
  'replaces legacy inventory/%s labels directly in one navigation',
  async (suffix, kind, parent) => {
    render(
      <MemoryRouter initialEntries={[`/app/yard/inventory/${suffix}?labels=1`]}>
        <Routes>
          <Route
            path="/app/:tenant/inventory/warehouses/:warehouseId"
            element={<LegacyWarehouseRedirect />}
          />
          <Route
            path="/app/:tenant/inventory/zones/:zoneId"
            element={<LegacyWarehouseRedirect />}
          />
          <Route
            path="/app/:tenant/inventory/sections/:sectionId"
            element={<LegacyWarehouseRedirect />}
          />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('url')).toHaveTextContent(
        `/app/yard/stickers?type=locations&kind=${kind}&parent=${parent}&select=all`,
      ),
    )
    expect(screen.getByText('REPLACE')).toBeInTheDocument()
    expect(window.open).not.toHaveBeenCalled()
  },
)

it('drops malformed IDs and duplicates without broadening an explicit subset', async () => {
  render(
    <MemoryRouter
      initialEntries={[
        '/old?labels=1&label=s1&label=s1&label=%20bad&label=%2Fforeign',
      ]}
    >
      <Routes>
        <Route
          path="/old"
          element={
            <LocationLabelsPage
              target={{ kind: 'section', parentId: 'z', parentName: '' }}
              inventoryBase="/inventory"
            />
          }
        />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  )
  await waitFor(() =>
    expect(screen.getByTestId('url')).toHaveTextContent(
      '/app/yard/stickers?type=locations&kind=section&parent=z&label=s1',
    ),
  )
  expect(screen.getByTestId('url')).not.toHaveTextContent('select=all')
})
it('keeps an entirely malformed subset empty', async () => {
  render(
    <MemoryRouter initialEntries={['/old?labels=1&label=%20bad']}>
      <Routes>
        <Route
          path="/old"
          element={
            <LocationLabelsPage
              target={{ kind: 'section', parentId: 'z', parentName: '' }}
              inventoryBase="/inventory"
            />
          }
        />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  )
  await waitFor(() =>
    expect(screen.getByTestId('url')).toHaveTextContent(
      '/app/yard/stickers?type=locations&kind=section&parent=z',
    ),
  )
  expect(screen.getByTestId('url')).not.toHaveTextContent('select=all')
})
