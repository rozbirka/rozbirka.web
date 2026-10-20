import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocationPartsList } from './LocationPartsList'

const mocked = vi.hoisted(() => ({
  search: vi.fn(),
  user: 'user-1',
  allowed: true,
}))
vi.mock('@/api/parts', () => ({ partsApi: { search: mocked.search } }))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: { id: 'tenant', slug: 'yard' },
    snapshot: {
      userId: mocked.user,
      tenantId: 'tenant',
      generation: 1,
      permissions: new Set(mocked.allowed ? ['parts.view'] : []),
    },
  }),
}))
const target = {
  kind: 'section' as const,
  zoneId: 'zone',
  sectionId: 'section',
  name: 'Секція',
  path: ['Склад', 'Зона', 'Секція'],
}
const result = {
  items: [
    {
      id: 'part',
      name: 'Фара',
      quantity: 2,
      status: 'reserved',
      thumbnailUrl: null,
      car: { make: 'Tesla', model: 'Y', year: 2023 },
    },
  ],
  page: 1,
  pageSize: 10,
  total: 12,
  totalPages: 2,
}
beforeEach(() => {
  mocked.search.mockReset()
  mocked.search.mockResolvedValue(result)
  mocked.user = 'user-1'
  mocked.allowed = true
})
it('loads section contents through scoped server paging, searches and links to the part card', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <LocationPartsList target={target} context="section" />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('link', { name: /Фара/ })).toHaveAttribute(
    'href',
    '/app/yard/parts/part',
  )
  expect(mocked.search.mock.calls[0]?.[0]).toMatchObject({
    zoneIds: ['zone'],
    sectionIds: ['section'],
    page: 1,
    pageSize: 10,
  })
  await user.click(
    within(screen.getByRole('navigation')).getByRole('button', {
      name: /наступн/i,
    }),
  )
  await waitFor(() =>
    expect(mocked.search.mock.lastCall?.[0]).toMatchObject({ page: 2 }),
  )
  await user.type(screen.getByRole('searchbox'), 'OEM123')
  await waitFor(() =>
    expect(mocked.search.mock.lastCall?.[0]).toMatchObject({
      query: 'OEM123',
      page: 1,
    }),
  )
})
it('requests direct placements only and offers retry for failed reads', async () => {
  mocked.search
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ...result, items: [], total: 0 })
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <LocationPartsList
        target={{ ...target, kind: 'direct' }}
        context="sheet"
      />
    </MemoryRouter>,
  )
  await user.click(
    await screen.findByRole('button', { name: 'Спробувати ще раз' }),
  )
  expect(
    await screen.findByText('Запчастин тут поки немає'),
  ).toBeInTheDocument()
  expect(mocked.search.mock.lastCall?.[0]).toMatchObject({
    missingShelf: true,
    sectionIds: ['section'],
  })
})
it('does not fetch without parts permission or display an old owner response', async () => {
  let finish: (value: typeof result) => void = () => undefined
  mocked.search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const view = render(
    <MemoryRouter>
      <LocationPartsList target={target} context="section" />
    </MemoryRouter>,
  )
  await waitFor(() => expect(mocked.search).toHaveBeenCalledOnce())
  mocked.user = 'user-2'
  mocked.allowed = false
  view.rerender(
    <MemoryRouter>
      <LocationPartsList target={target} context="section" />
    </MemoryRouter>,
  )
  finish(result)
  await waitFor(() =>
    expect(screen.queryByText('Фара')).not.toBeInTheDocument(),
  )
  expect(mocked.search).toHaveBeenCalledOnce()
})

it('waits for the search debounce without requesting the previous filter again', async () => {
  render(
    <MemoryRouter>
      <LocationPartsList target={target} context="section" />
    </MemoryRouter>,
  )
  await screen.findByRole('link', { name: /Фара/ })
  mocked.search.mockClear()
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'OEM123' },
  })
  expect(mocked.search).not.toHaveBeenCalled()
  await waitFor(() => expect(mocked.search).toHaveBeenCalledTimes(1))
  expect(mocked.search.mock.lastCall?.[0]).toMatchObject({
    query: 'OEM123',
    page: 1,
  })
})

it('lists a part as its name with the OEM code on the same row', async () => {
  mocked.search.mockResolvedValue({
    ...result,
    items: [
      { ...result.items[0], thumbnailUrl: '/photo.jpg', oemCode: '3G1941005' },
    ],
  })
  const { container } = render(
    <MemoryRouter>
      <LocationPartsList target={target} context="section" />
    </MemoryRouter>,
  )
  const link = await screen.findByRole('link', { name: /Фара/ })
  expect(link).toHaveTextContent('Фара3G1941005')
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByRole('region', { name: 'Секція' })).toHaveTextContent(
    'Позицій: 12',
  )
})
