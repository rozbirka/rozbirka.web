import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocationPartsList } from './LocationPartsList'
import type { PartSearchRequest } from '@/api/parts'

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
function LocationProbe() {
  return <output data-testid="parts-list-url">{useLocation().search}</output>
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
  expect(link).toHaveTextContent('Фара')
  expect(link.parentElement).toHaveTextContent('Фара3G1941005')
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByRole('region', { name: 'Секція' })).toHaveTextContent(
    'Позицій: 12',
  )
})

it('uses fixed 20-part pages, keeps the search and URL state, and has no page-size selector', async () => {
  mocked.search.mockResolvedValue({ ...result, total: 1320 })
  const user = userEvent.setup()
  render(
    <MemoryRouter
      initialEntries={[
        '/?unassignedSearch=OEM&unassignedPage=2&unassignedPageSize=100&keep=1',
      ]}
    >
      <LocationPartsList target={target} context="unassigned" />
      <LocationProbe />
    </MemoryRouter>,
  )
  await screen.findByRole('link', { name: /Фара/ })
  expect(mocked.search.mock.lastCall?.[0]).toMatchObject({
    page: 2,
    pageSize: 20,
    query: 'OEM',
  })
  expect(screen.getByText('21–40 з 1320')).toBeVisible()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  await waitFor(() =>
    expect(mocked.search.mock.lastCall?.[0]).toMatchObject({
      page: 3,
      pageSize: 20,
      query: 'OEM',
    }),
  )
  expect(screen.getByText('41–60 з 1320')).toBeVisible()
  expect(screen.getByTestId('parts-list-url')).toHaveTextContent('keep=1')
  expect(screen.getByRole('searchbox')).toHaveValue('OEM')
})

it('keeps the fixed-size compact pager visible on a short unassigned list', async () => {
  render(
    <MemoryRouter>
      <LocationPartsList target={target} context="unassigned" />
    </MemoryRouter>,
  )
  await screen.findByRole('link', { name: /Фара/ })
  expect(mocked.search.mock.lastCall?.[0]).toMatchObject({ pageSize: 20 })
  expect(screen.getByText('1–12 з 12')).toBeVisible()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Наступна сторінка' }),
  ).toBeDisabled()
})

it('requests only physical stock before pagination in the placement queue', async () => {
  const items = [
    { ...result.items[0], id: 'available', name: 'Фара', status: 'available' },
    {
      ...result.items[0],
      id: 'reserved',
      name: 'Бампер',
      status: 'reserved',
      quantityAvailable: 0,
    },
    {
      ...result.items[0],
      id: 'sold',
      name: 'Продане крило',
      status: 'sold',
      quantity: 0,
    },
  ]
  mocked.search.mockImplementation((request: PartSearchRequest) => {
    const matching = items.filter(
      (part) =>
        !request.statuses?.length || request.statuses.includes(part.status),
    )
    return Promise.resolve({
      ...result,
      items: matching,
      total: matching.length,
    })
  })
  render(
    <MemoryRouter>
      <LocationPartsList target={target} context="unassigned" />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('link', { name: 'Фара' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Бампер' })).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Продане крило' })).toBeNull()
  expect(screen.getByText('1–2 з 2')).toBeVisible()
  expect(mocked.search.mock.lastCall?.[0]).toMatchObject({
    statuses: ['available', 'reserved'],
    pageSize: 20,
  })
})

it('keeps sold parts visible in ordinary location contents', async () => {
  mocked.search.mockResolvedValue({
    ...result,
    items: [{ ...result.items[0], quantity: 0, status: 'sold' }],
  })
  render(
    <MemoryRouter>
      <LocationPartsList target={target} context="section" />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('link', { name: 'Фара' })).toBeVisible()
  expect(mocked.search.mock.lastCall?.[0]).not.toHaveProperty('statuses')
})
