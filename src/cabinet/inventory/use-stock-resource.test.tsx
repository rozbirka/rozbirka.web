import { act, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLoad } from './use-stock-resource'
import { useInventoryRefresh } from './use-inventory-refresh'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('keeps the last data and success time after a refresh failure, then recovers', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
  const loader = vi.fn().mockResolvedValue('first')
  const { result } = renderHook(() => useLoad(loader, 'one'))
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ data: 'first' }),
  )
  loader.mockRejectedValueOnce(new Error('Offline'))
  act(() => result.current.refresh())
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      kind: 'ready',
      data: 'first',
      updatedAt: 1000,
      refreshError: true,
    }),
  )
  now.mockReturnValue(2000)
  loader.mockResolvedValue('second')
  act(() => result.current.refresh())
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      data: 'second',
      updatedAt: 2000,
      refreshError: false,
    }),
  )
})

it('keeps rows during a slow refresh and does not restart its pending request', async () => {
  const loader = vi.fn().mockResolvedValue('first')
  const { result } = renderHook(() => useLoad(loader, 'one'))
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ data: 'first' }),
  )
  let resolve!: (value: string) => void
  loader.mockImplementationOnce(
    () =>
      new Promise<string>((done) => {
        resolve = done
      }),
  )
  act(() => result.current.refresh())
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      data: 'first',
      refreshing: true,
    }),
  )
  act(() => {
    result.current.refresh()
    result.current.refresh()
  })
  await act(() => {
    resolve('second')
    return Promise.resolve()
  })
  expect(result.current.state).toMatchObject({
    data: 'second',
    refreshing: false,
  })
  expect(loader).toHaveBeenCalledTimes(2)
})

it('hides the previous session immediately on a key change and ignores late responses', async () => {
  const loader = vi.fn().mockResolvedValue('first')
  const { result, rerender } = renderHook(({ id }) => useLoad(loader, id), {
    initialProps: { id: 'one' },
  })
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ data: 'first' }),
  )
  let resolve!: (value: string) => void
  loader.mockImplementationOnce(
    () =>
      new Promise<string>((done) => {
        resolve = done
      }),
  )
  act(() => result.current.refresh())
  await waitFor(() => expect(loader).toHaveBeenCalledTimes(2))
  loader.mockResolvedValue('other session')
  rerender({ id: 'two' })
  expect(result.current.state.kind).toBe('loading')
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ data: 'other session' }),
  )
  await act(() => {
    resolve('late first session')
    return Promise.resolve()
  })
  expect(result.current.state).toMatchObject({ data: 'other session' })
})

it('hides retained data if access was revoked during a refresh', async () => {
  const loader = vi.fn().mockResolvedValue('private data')
  const { result } = renderHook(() => useLoad(loader, 'one'))
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ data: 'private data' }),
  )
  loader.mockRejectedValueOnce({ kind: 'forbidden', message: 'Access revoked' })
  act(() => result.current.refresh())
  await waitFor(() => expect(result.current.state.kind).toBe('error'))
})

it('preserves the last complete snapshot when a refresh returns partial data', async () => {
  const loader = vi.fn().mockResolvedValue({ rows: ['first'] })
  const complete = (data: { rows: string[] | null }) => data.rows !== null
  const { result } = renderHook(() => useLoad(loader, 'one', complete))
  await waitFor(() =>
    expect(result.current.state).toMatchObject({ data: { rows: ['first'] } }),
  )
  loader.mockResolvedValueOnce({ rows: null })
  act(() => result.current.refresh())
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      data: { rows: ['first'] },
      refreshError: true,
    }),
  )
})

it('automatically recovers from a failed polling request and stops polling on unmount', async () => {
  vi.useFakeTimers()
  const loader = vi.fn().mockResolvedValue('first')
  const { result, unmount } = renderHook(() => {
    const resource = useLoad(loader, 'one')
    useInventoryRefresh(resource.refresh)
    return resource
  })
  await act(() => Promise.resolve())
  expect(result.current.state).toMatchObject({ data: 'first' })
  loader.mockRejectedValueOnce(new Error('Offline'))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
  expect(result.current.state).toMatchObject({
    data: 'first',
    refreshError: true,
  })
  loader.mockResolvedValue('recovered')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
  expect(result.current.state).toMatchObject({
    data: 'recovered',
    refreshError: false,
  })
  unmount()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
  expect(loader).toHaveBeenCalledTimes(3)
})

it('waits while hidden and refreshes once when visibility and focus return together', async () => {
  vi.useFakeTimers()
  const visibility = vi
    .spyOn(document, 'visibilityState', 'get')
    .mockReturnValue('hidden')
  const loader = vi.fn().mockResolvedValue('first')
  const { result, unmount } = renderHook(() => {
    const resource = useLoad(loader, 'one')
    useInventoryRefresh(resource.refresh)
    return resource
  })
  await act(() => Promise.resolve())
  loader.mockResolvedValue('latest')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000)
  })
  expect(result.current.state).toMatchObject({ data: 'first' })
  visibility.mockReturnValue('visible')
  await act(async () => {
    fireEvent(document, new Event('visibilitychange'))
    fireEvent.focus(window)
    fireEvent(window, new Event('online'))
    await Promise.resolve()
  })
  expect(result.current.state).toMatchObject({ data: 'latest' })
  expect(loader).toHaveBeenCalledTimes(2)
  unmount()
  fireEvent.focus(window)
  expect(loader).toHaveBeenCalledTimes(2)
})
