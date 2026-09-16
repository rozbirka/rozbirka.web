import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { cashApi } from '@/api/cash'
import { intakesApi } from '@/api/intakes'
import { ordersApi } from '@/api/orders'
import { useCabinet } from '../CabinetContext'
import { useDashboardExtras } from './use-dashboard-extras'

vi.mock('@/api/cash', () => ({ cashApi: { list: vi.fn() } }))
vi.mock('@/api/intakes', () => ({ intakesApi: { list: vi.fn() } }))
vi.mock('@/api/orders', () => ({ ordersApi: { list: vi.fn() } }))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

function Harness() {
  const extras = useDashboardExtras({
    cashEnabled: true,
    intakesEnabled: true,
    ordersEnabled: true,
  })
  return <output>{JSON.stringify(extras)}</output>
}

beforeEach(() => {
  vi.mocked(useCabinet).mockReturnValue({
    status: 'ready',
    snapshot: { userId: 'user-1', tenantId: 'tenant-1', generation: 1 },
  } as ReturnType<typeof useCabinet>)
  vi.mocked(cashApi).list.mockResolvedValue([])
  vi.mocked(ordersApi).list.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 4,
    total: 0,
    totalPages: 0,
  })
  vi.mocked(intakesApi).list.mockResolvedValue({
    items: [
      {
        id: 'intake-1',
        name: 'Tesla Model Y',
        supplier: null,
        purchasedAt: null,
        totalCost: null,
        partsCount: 14,
        soldCount: 0,
        createdAt: '2026-09-16T07:15:00Z',
        createdBy: { id: 'user-2', displayName: 'Олена' },
      },
    ],
    page: 1,
    pageSize: 3,
    total: 1,
    totalPages: 1,
  })
})

it('exposes recent intakes alongside dashboard cash and order extras', async () => {
  render(<Harness />)

  await waitFor(() =>
    expect(screen.getByText(/Tesla Model Y/)).toHaveTextContent(
      '"recentIntakes":{"status":"ready"',
    ),
  )
})
