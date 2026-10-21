import { act, fireEvent, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { recordUserActivity } from '@/api/user-activity'
import { useCabinetActivity } from './use-cabinet-activity'

vi.mock('@/api/user-activity', () => ({ recordUserActivity: vi.fn() }))
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(recordUserActivity).mockReset().mockResolvedValue()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('records real interaction at most once a minute and never records idle timer ticks', async () => {
  renderHook(() => useCabinetActivity('user:tenant:1'), { wrapper })
  await act(async () => {
    await Promise.resolve()
  })
  expect(recordUserActivity).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(window, { key: 'Tab' })
  expect(recordUserActivity).toHaveBeenCalledTimes(1)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000)
  })
  expect(recordUserActivity).toHaveBeenCalledTimes(1)
  fireEvent.wheel(window)
  fireEvent.pointerDown(window)
  expect(recordUserActivity).toHaveBeenCalledTimes(2)
})

it('ignores hidden tabs and cancels the old tenant request before recording a new scope', () => {
  const visibility = vi
    .spyOn(document, 'visibilityState', 'get')
    .mockReturnValue('hidden')
  const view = renderHook(({ scope }) => useCabinetActivity(scope), {
    initialProps: { scope: 'user:first:1' },
    wrapper,
  })
  expect(recordUserActivity).not.toHaveBeenCalled()
  visibility.mockReturnValue('visible')
  fireEvent(document, new Event('visibilitychange'))
  const signal = vi.mocked(recordUserActivity).mock.calls[0]?.[0]?.signal
  view.rerender({ scope: 'user:second:2' })
  expect(signal?.aborted).toBe(true)
  expect(recordUserActivity).toHaveBeenCalledTimes(2)
  view.unmount()
  fireEvent.pointerDown(window)
  expect(recordUserActivity).toHaveBeenCalledTimes(2)
})

it('does not record anonymous or unresolved cabinet access', () => {
  renderHook(() => useCabinetActivity(null), { wrapper })
  fireEvent.pointerDown(window)
  expect(recordUserActivity).not.toHaveBeenCalled()
})

it('records again after StrictMode aborts the first mount request', async () => {
  renderHook(() => useCabinetActivity('user:tenant:1'), {
    wrapper,
    reactStrictMode: true,
  })
  await act(async () => {
    await Promise.resolve()
  })
  expect(
    vi.mocked(recordUserActivity).mock.calls[0]?.[0]?.signal?.aborted,
  ).toBe(true)
  expect(
    vi.mocked(recordUserActivity).mock.lastCall?.[0]?.signal?.aborted,
  ).toBe(false)
})

it('treats activity errors as nonblocking and throttles retries', async () => {
  vi.mocked(recordUserActivity).mockRejectedValue(new Error('Offline'))
  renderHook(() => useCabinetActivity('user:tenant:1'), { wrapper })
  await act(async () => {
    await Promise.resolve()
  })
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(recordUserActivity).toHaveBeenCalledTimes(1)
})
