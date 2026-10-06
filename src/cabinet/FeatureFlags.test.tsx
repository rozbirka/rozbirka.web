import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FEATURE_FLAGS } from '@/api/feature-flags'
import { FeatureFlagsProvider, FeatureGate } from './FeatureFlags'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api/feature-flags', () => ({
  FEATURE_FLAGS: { partsBulkImport: 'parts.bulk-import' },
  featureFlagsApi: { get },
}))

const child = (
  <FeatureGate name={FEATURE_FLAGS.partsBulkImport}>
    <button>Імпорт</button>
  </FeatureGate>
)
const flush = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  get.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

it('defaults off without a provider or when the first fetch fails', async () => {
  const { rerender } = render(child)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  get.mockRejectedValue(new Error('offline'))
  rerender(<FeatureFlagsProvider>{child}</FeatureFlagsProvider>)
  await flush()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('refreshes flags and keeps the same tenant snapshot during an outage', async () => {
  get
    .mockResolvedValueOnce({ 'parts.bulk-import': true })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ 'parts.bulk-import': false })
  render(<FeatureFlagsProvider>{child}</FeatureFlagsProvider>)
  await flush()
  expect(screen.getByRole('button')).toBeInTheDocument()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000)
  })
  expect(screen.getByRole('button')).toBeInTheDocument()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000)
  })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('clears the previous tenant flags and ignores late responses after switching scope', async () => {
  let resolveOld!: (value: Record<string, boolean>) => void
  get
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    .mockResolvedValueOnce({ 'parts.bulk-import': false })
  const { rerender } = render(
    <FeatureFlagsProvider key="tenant-a">{child}</FeatureFlagsProvider>,
  )
  const oldSignal = (get.mock.calls[0]![0] as { signal: AbortSignal }).signal
  rerender(<FeatureFlagsProvider key="tenant-b">{child}</FeatureFlagsProvider>)
  expect(oldSignal.aborted).toBe(true)
  await act(async () => {
    resolveOld({ 'parts.bulk-import': true })
    await Promise.resolve()
  })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('drops an enabled value immediately when the authenticated tenant boundary changes', async () => {
  get
    .mockResolvedValueOnce({ 'parts.bulk-import': true })
    .mockImplementationOnce(
      () =>
        new Promise(() => {
          /* Keep the new scope pending. */
        }),
    )
  const { rerender } = render(
    <FeatureFlagsProvider key="user-a:tenant-a">{child}</FeatureFlagsProvider>,
  )
  await flush()
  expect(screen.getByRole('button')).toBeInTheDocument()
  rerender(
    <FeatureFlagsProvider key="user-a:tenant-b">{child}</FeatureFlagsProvider>,
  )
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('does not treat unexpected truthy values as enabled and stops refreshing on unmount', async () => {
  get.mockResolvedValue({ 'parts.bulk-import': 'true' })
  const { unmount } = render(
    <FeatureFlagsProvider>{child}</FeatureFlagsProvider>,
  )
  await flush()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  unmount()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000)
  })
  expect(get).toHaveBeenCalledTimes(1)
})
