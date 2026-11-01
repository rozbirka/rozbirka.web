import { cleanup, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePlacementPolling } from './placement-job-polling'

let visibility: DocumentVisibilityState
let online: boolean

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  online = true
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility,
  )
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('waits two seconds before polling an active job', () => {
  const refresh = vi.fn()
  renderHook(() => usePlacementPolling(true, false, refresh))

  vi.advanceTimersByTime(1999)
  expect(refresh).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(refresh).toHaveBeenCalledOnce()
})

it('starts the two-second interval after the initial job request settles', () => {
  const refresh = vi.fn()
  const { rerender } = renderHook(
    ({ busy }) => usePlacementPolling(true, busy, refresh),
    { initialProps: { busy: true } },
  )

  vi.advanceTimersByTime(10000)
  fireEvent(document, new Event('visibilitychange'))
  fireEvent(window, new Event('online'))
  expect(refresh).not.toHaveBeenCalled()

  rerender({ busy: false })
  vi.advanceTimersByTime(1999)
  expect(refresh).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(refresh).toHaveBeenCalledOnce()
})

it.each(['hidden', 'offline'] as const)(
  'waits for foreground connectivity when initially %s',
  (state) => {
    visibility = state === 'hidden' ? 'hidden' : 'visible'
    online = state !== 'offline'
    const refresh = vi.fn()
    renderHook(() => usePlacementPolling(true, false, refresh))

    vi.advanceTimersByTime(10000)
    expect(refresh).not.toHaveBeenCalled()

    visibility = 'visible'
    online = true
    if (state === 'hidden') fireEvent(document, new Event('visibilitychange'))
    else fireEvent(window, new Event('online'))
    expect(refresh).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(2000)
    expect(refresh).toHaveBeenCalledOnce()
  },
)

it.each(['hidden', 'offline'] as const)(
  'cancels an existing timer when becoming %s and resumes once',
  (state) => {
    const refresh = vi.fn()
    renderHook(() => usePlacementPolling(true, false, refresh))
    vi.advanceTimersByTime(1000)

    if (state === 'hidden') {
      visibility = 'hidden'
      fireEvent(document, new Event('visibilitychange'))
    } else {
      online = false
      fireEvent(window, new Event('offline'))
    }
    vi.advanceTimersByTime(5000)
    expect(refresh).not.toHaveBeenCalled()

    visibility = 'visible'
    online = true
    if (state === 'hidden') fireEvent(document, new Event('visibilitychange'))
    else fireEvent(window, new Event('online'))
    expect(refresh).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(2000)
    expect(refresh).toHaveBeenCalledOnce()
  },
)

it.each(['hidden', 'offline'] as const)(
  'rechecks whether the page is %s when the timer fires',
  (state) => {
    const refresh = vi.fn()
    renderHook(() => usePlacementPolling(true, false, refresh))
    vi.advanceTimersByTime(1000)
    visibility = state === 'hidden' ? 'hidden' : 'visible'
    online = state !== 'offline'

    // State can change before the browser delivers its visibility/online event.
    vi.advanceTimersByTime(1000)
    expect(refresh).not.toHaveBeenCalled()
  },
)

it('stops pending timers and ignores wake events when polling becomes inactive', () => {
  const refresh = vi.fn()
  const { rerender } = renderHook(
    ({ active }) => usePlacementPolling(active, false, refresh),
    { initialProps: { active: true } },
  )
  vi.advanceTimersByTime(1000)
  rerender({ active: false })

  fireEvent(document, new Event('visibilitychange'))
  fireEvent(window, new Event('online'))
  vi.advanceTimersByTime(5000)
  expect(refresh).not.toHaveBeenCalled()
})

it('removes pending timers and wake listeners after unmounting', () => {
  const refresh = vi.fn()
  const { unmount } = renderHook(() =>
    usePlacementPolling(true, false, refresh),
  )
  unmount()

  fireEvent(document, new Event('visibilitychange'))
  fireEvent(window, new Event('online'))
  vi.advanceTimersByTime(5000)
  expect(refresh).not.toHaveBeenCalled()
})

it('rearms after a fast response even if React batches away the busy render', () => {
  const refresh = vi.fn()
  const { rerender } = renderHook(
    ({ updatedAt }) => usePlacementPolling(true, false, refresh, updatedAt),
    { initialProps: { updatedAt: 1 } },
  )
  vi.advanceTimersByTime(2000)
  expect(refresh).toHaveBeenCalledOnce()
  // A fast GET can commit only its final state; busy stays false in both renders.
  rerender({ updatedAt: 2 })
  vi.advanceTimersByTime(2000)
  expect(refresh).toHaveBeenCalledTimes(2)
})
