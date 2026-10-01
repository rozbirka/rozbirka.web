import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { partImportsApi, type ImportCapabilities } from '@/api/part-imports'
import { ImportEntryButton } from './ImportEntryButton'

vi.mock('@/api/part-imports', () => ({
  partImportsApi: { capabilities: vi.fn() },
}))

let tenantId = 'tenant-a'
let permission = true
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: { id: tenantId },
    snapshot: {
      tenantId,
      userId: 'user',
      generation: 1,
      permissions: new Set(permission ? ['parts.manage'] : []),
    },
  }),
}))

const capabilities = (enabled: boolean): ImportCapabilities => ({
  enabled,
  schemaVersion: 1,
  formats: [],
  encodings: [],
  fields: [],
  transforms: [],
  limits: { maxBytes: 0, maxRows: 0 },
  maxOrderGroupSize: 500,
})

const entry = () => (
  <MemoryRouter>
    <ImportEntryButton to="/app/test/parts/imports?car_id=car" />
  </MemoryRouter>
)

beforeEach(() => {
  vi.resetAllMocks()
  tenantId = 'tenant-a'
  permission = true
})

it('hides the entry while loading and when the server disables import', async () => {
  let resolve!: (value: ImportCapabilities) => void
  vi.mocked(partImportsApi.capabilities).mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  render(entry())
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  await act(async () => {
    resolve(capabilities(false))
    await Promise.resolve()
  })
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('preserves the source link when the server enables import', async () => {
  vi.mocked(partImportsApi.capabilities).mockResolvedValue(capabilities(true))
  render(entry())
  expect(
    await screen.findByRole('link', { name: 'Імпорт запчастин' }),
  ).toHaveAttribute('href', '/app/test/parts/imports?car_id=car')
})

it('does not expose import when the capability request fails', async () => {
  vi.mocked(partImportsApi.capabilities).mockRejectedValue(new Error('offline'))
  await act(async () => {
    render(entry())
    await Promise.resolve()
  })
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('does not request capabilities without parts.manage', () => {
  permission = false
  render(entry())
  expect(partImportsApi.capabilities).not.toHaveBeenCalled()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('clears enabled state immediately when switching tenants', async () => {
  vi.mocked(partImportsApi.capabilities)
    .mockResolvedValueOnce(capabilities(true))
    .mockResolvedValueOnce(capabilities(false))
  const { rerender } = render(entry())
  await screen.findByRole('link')
  tenantId = 'tenant-b'
  rerender(entry())
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(partImportsApi.capabilities).toHaveBeenCalledTimes(2)
})
