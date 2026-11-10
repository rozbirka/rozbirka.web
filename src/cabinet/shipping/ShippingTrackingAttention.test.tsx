import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  getTrackingAttention,
  type TrackingAttention,
} from '@/api/shipping-attention'
import { ShippingTrackingAttention } from './ShippingTrackingAttention'

vi.mock('@/api/shipping-attention', () => ({ getTrackingAttention: vi.fn() }))
const get = vi.mocked(getTrackingAttention)
const empty: TrackingAttention = {
  total: 0,
  pausedCount: 0,
  delayedCount: 0,
  page: 1,
  pageSize: 10,
  items: [],
}
const issue: TrackingAttention = {
  ...empty,
  total: 2,
  pausedCount: 1,
  delayedCount: 1,
  items: [
    {
      shipmentId: 'source',
      integrationId: 'i',
      orderId: 'o',
      orderNumber: 373,
      number: 'TEST-SOURCE',
      direction: 'source',
      paused: true,
      reason: 'tracking_unauthorized',
      since: '2026-11-10T10:00:00Z',
    },
    {
      shipmentId: 'reverse-source',
      integrationId: 'i',
      orderId: 'o',
      orderNumber: 374,
      number: 'TEST-RETURN',
      direction: 'return',
      paused: false,
      reason: 'tracking_delayed',
      since: '2026-11-10T09:00:00Z',
    },
  ],
}
function view(
  scopeKey = 'user:tenant:1',
  enabled = true,
  tenantSlug = 'rozbirka',
) {
  return (
    <MemoryRouter>
      <ShippingTrackingAttention
        scopeKey={scopeKey}
        enabled={enabled}
        tenantSlug={tenantSlug}
      />
    </MemoryRouter>
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  get.mockResolvedValue(issue)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('shows one persistent notice with reasons and links to source and reverse waybills', async () => {
  render(view())
  fireEvent.click(
    await screen.findByRole('button', { name: 'Переглянути ТТН' }),
  )
  const dialog = screen.getByRole('dialog')
  expect(
    within(dialog).getByText(/Нова пошта не приймає API-ключ/),
  ).toBeInTheDocument()
  expect(
    within(dialog).getByText(/це не означає затримку доставки/),
  ).toBeInTheDocument()
  const links = within(dialog).getAllByRole('link', {
    name: 'Відкрити накладну',
  })
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/app/rozbirka/sales/waybills/source',
    '/app/rozbirka/sales/waybills/reverse-source',
  ])
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Оновити список' }),
  )
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  expect(
    screen.getAllByRole('button', { name: 'Переглянути ТТН', hidden: true }),
  ).toHaveLength(1)
})

it('removes the notice after recovery while the open sheet explains the empty state', async () => {
  render(view())
  fireEvent.click(
    await screen.findByRole('button', { name: 'Переглянути ТТН' }),
  )
  get.mockResolvedValue(empty)
  fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
  expect(
    await screen.findByText('Проблемних перевірок більше немає.'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Переглянути ТТН', hidden: true }),
  ).not.toBeInTheDocument()
})

it('does not fetch without orders.view and aborts and discards an older tenant response', async () => {
  const { rerender } = render(view('old', false))
  expect(get).not.toHaveBeenCalled()
  let resolveOld!: (value: TrackingAttention) => void
  get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve
      }),
  )
  rerender(view('old'))
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  const oldSignal = get.mock.calls[0]![1]!.signal!
  get.mockResolvedValue(empty)
  rerender(view('new', true, 'other'))
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  expect(oldSignal.aborted).toBe(true)
  await act(async () => {
    await Promise.resolve()
    resolveOld(issue)
  })
  expect(
    screen.queryByText('Потрібна увага до відстеження НП'),
  ).not.toBeInTheDocument()
})

it('retains old information on failure and supports retry', async () => {
  get.mockRejectedValueOnce(new Error('offline'))
  render(view())
  fireEvent.click(
    await screen.findByRole('button', { name: 'Спробувати ще раз' }),
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Переглянути ТТН' }),
  )
  get.mockRejectedValueOnce(new Error('temporary'))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
  await waitFor(() =>
    expect(screen.getAllByText(/Не вдалося оновити список/)).toHaveLength(2),
  )
  expect(screen.getByText('ТТН TEST-SOURCE')).toBeInTheDocument()
})

it('paginates and returns to page one when the last page recovers', async () => {
  get.mockResolvedValue({ ...issue, total: 11, pausedCount: 10 })
  render(view())
  fireEvent.click(
    await screen.findByRole('button', { name: 'Переглянути ТТН' }),
  )
  get.mockResolvedValueOnce({
    ...issue,
    page: 2,
    total: 11,
    items: [issue.items[1]!],
  })
  fireEvent.click(screen.getByRole('button', { name: 'Далі' }))
  await waitFor(() => expect(get.mock.calls.at(-1)?.[0]).toBe(2))
  get
    .mockResolvedValueOnce({ ...empty, page: 2, total: 1 })
    .mockResolvedValueOnce({ ...issue, total: 1, items: [issue.items[0]!] })
  fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
  await waitFor(() => expect(screen.getByText('1 з 1')).toBeInTheDocument())
  expect(get.mock.calls.at(-1)?.[0]).toBe(1)
})

it('polls only while visible without overlapping requests and cleans up on unmount', async () => {
  vi.useFakeTimers()
  let finish!: (value: TrackingAttention) => void
  get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { unmount } = render(view())
  expect(get).toHaveBeenCalledTimes(1)
  await act(async () => {
    await Promise.resolve()
    vi.advanceTimersByTime(120_000)
  })
  expect(get).toHaveBeenCalledTimes(1)
  await act(async () => {
    await Promise.resolve()
    finish(issue)
  })
  const visibility = vi
    .spyOn(document, 'visibilityState', 'get')
    .mockReturnValue('hidden')
  await act(async () => {
    await Promise.resolve()
    vi.advanceTimersByTime(60_000)
  })
  expect(get).toHaveBeenCalledTimes(1)
  visibility.mockReturnValue('visible')
  await act(async () => {
    await Promise.resolve()
    fireEvent(document, new Event('visibilitychange'))
  })
  expect(get).toHaveBeenCalledTimes(2)
  unmount()
  await act(async () => {
    await Promise.resolve()
    vi.advanceTimersByTime(60_000)
  })
  expect(get).toHaveBeenCalledTimes(2)
})
