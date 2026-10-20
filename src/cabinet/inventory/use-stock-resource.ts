import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCabinet } from '../CabinetContext'

export type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: T }

export function useLoad<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  key: string,
) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<LoadState<T>>({ kind: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    void loader(controller.signal).then(
      (data) => !controller.signal.aborted && setState({ kind: 'ready', data }),
      () => !controller.signal.aborted && setState({ kind: 'error' }),
    )
    return () => controller.abort()
  }, [key, loader, revision])
  const reload = useCallback(() => {
    setState({ kind: 'loading' })
    setRevision((value) => value + 1)
  }, [])
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  return useMemo(() => ({ state, reload, refresh }), [refresh, reload, state])
}

export function usePermission(permission: string) {
  const { snapshot } = useCabinet()
  return snapshot?.permissions.has(permission) ?? false
}
