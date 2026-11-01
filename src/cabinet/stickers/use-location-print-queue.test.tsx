import { act, renderHook, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { tenantResetRegistry } from '../tenant-reset-registry'
import { locationQueueStore } from './location-queue-store'
import { useLocationPrintQueue } from './use-location-print-queue'

const scope = { userId: 'hook-user', tenantId: 'hook-tenant' }
const target = {
  kind: 'zone' as const,
  parentId: 'warehouse',
  parentName: 'Warehouse',
}
afterEach(() => {
  cleanup()
  locationQueueStore.clear()
  localStorage.clear()
})
it('resumes after unmount and clears through the registry while no hook is mounted', async () => {
  const hook = renderHook(() => useLocationPrintQueue(scope))
  act(() => {
    hook.result.current.start(target, ['a', 'b'])
  })
  hook.unmount()
  const remount = renderHook(() => useLocationPrintQueue(scope))
  expect(remount.result.current.queue?.remainingIds).toEqual(['a', 'b'])
  remount.unmount()
  await act(() => tenantResetRegistry.clear(scope))
  const afterReset = renderHook(() => useLocationPrintQueue(scope))
  expect(afterReset.result.current.queue).toBeNull()
})
it('hides old scope immediately and guards retained callbacks from affecting a later scope', () => {
  const hook = renderHook<
    ReturnType<typeof useLocationPrintQueue>,
    { owner: typeof scope | null }
  >(({ owner }) => useLocationPrintQueue(owner), {
    initialProps: { owner: scope },
  })
  const staleStart = hook.result.current.start
  act(() => {
    hook.result.current.start(target, ['a'])
  })
  hook.rerender({ owner: { ...scope, tenantId: 'next' } })
  expect(hook.result.current.queue).toBeNull()
  expect(staleStart(target, ['old'])).toEqual({ ok: false, reason: 'invalid' })
  act(() => {
    hook.result.current.start(target, ['new'])
  })
  hook.rerender({ owner: null })
  expect(hook.result.current.queue).toBeNull()
})
it('invalidates retained callbacks when ownership disappears and after unmount', () => {
  const hook = renderHook<
    ReturnType<typeof useLocationPrintQueue>,
    { owner: typeof scope | null }
  >(({ owner }) => useLocationPrintQueue(owner), {
    initialProps: { owner: scope },
  })
  const oldStart = hook.result.current.start
  hook.rerender({ owner: null })
  expect(oldStart(target, ['old'])).toEqual({ ok: false, reason: 'invalid' })
  hook.rerender({ owner: scope })
  const unmountedStart = hook.result.current.start
  hook.unmount()
  expect(unmountedStart(target, ['unmounted'])).toEqual({
    ok: false,
    reason: 'invalid',
  })
})
