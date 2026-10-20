import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeApiProblem } from '@/api/errors'
import { useCabinet } from '../CabinetContext'

export type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready'
      data: T
      updatedAt: number | null
      refreshing: boolean
      refreshError: boolean
    }

const loading = { kind: 'loading' } as const
const complete = () => true

/** Access changes must invalidate retained data, including partial responses. */
export function optionalInventoryData(error: unknown): null {
  const { kind } = normalizeApiProblem(error)
  if (
    kind === 'forbidden' ||
    kind === 'session-expired' ||
    kind === 'not-found'
  ) {
    throw error
  }
  return null
}

export function useLoad<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  key: string,
  isComplete: (data: T) => boolean = complete,
) {
  const [revision, setRevision] = useState(0)
  const [entry, setEntry] = useState<{
    loader: typeof loader
    key: string
    state: LoadState<T>
  }>(() => ({ loader, key, state: loading }))
  const flight = useRef<{
    loader: typeof loader
    key: string
    controller: AbortController
  } | null>(null)
  const queued = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    const request = { loader, key, controller }
    flight.current = request
    queued.current = false
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setEntry((previous) => ({
        loader,
        key,
        state:
          previous.loader === loader &&
          previous.key === key &&
          previous.state.kind === 'ready'
            ? { ...previous.state, refreshing: true }
            : loading,
      }))
      try {
        const data = await loader(controller.signal)
        if (controller.signal.aborted) return
        const full = isComplete(data)
        setEntry((previous) => ({
          loader,
          key,
          state:
            !full &&
            previous.loader === loader &&
            previous.key === key &&
            previous.state.kind === 'ready'
              ? { ...previous.state, refreshing: false, refreshError: true }
              : {
                  kind: 'ready',
                  data,
                  updatedAt: full ? Date.now() : null,
                  refreshing: false,
                  refreshError: false,
                },
        }))
      } catch (error) {
        if (controller.signal.aborted) return
        const { kind } = normalizeApiProblem(error)
        const retain =
          kind !== 'forbidden' &&
          kind !== 'session-expired' &&
          kind !== 'not-found'
        setEntry((previous) => ({
          loader,
          key,
          state:
            retain &&
            previous.loader === loader &&
            previous.key === key &&
            previous.state.kind === 'ready'
              ? { ...previous.state, refreshing: false, refreshError: true }
              : { kind: 'error' },
        }))
      } finally {
        if (flight.current === request) flight.current = null
      }
    })
    return () => {
      controller.abort()
      if (flight.current === request) flight.current = null
    }
  }, [key, loader, revision, isComplete])
  const reload = useCallback(() => {
    setEntry({ loader, key, state: loading })
    setRevision((value) => value + 1)
  }, [loader, key])
  const refresh = useCallback(() => {
    if (
      queued.current ||
      (flight.current?.loader === loader && flight.current.key === key)
    )
      return
    queued.current = true
    setRevision((value) => value + 1)
  }, [loader, key])
  const state =
    entry.loader === loader && entry.key === key ? entry.state : loading
  return useMemo(() => ({ state, reload, refresh }), [refresh, reload, state])
}

export function usePermission(permission: string) {
  const { snapshot } = useCabinet()
  return snapshot?.permissions.has(permission) ?? false
}
