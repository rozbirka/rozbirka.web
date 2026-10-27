import { useEffect } from 'react'
import type { PartPlacementJob } from '@/api/inventory'

export const placementRunning = (job: PartPlacementJob | null | undefined) =>
  job?.status === 'queued' || job?.status === 'running'

/** Read-only polling: at most one request every two seconds, only while visible/online. */
export function usePlacementPolling(
  active: boolean,
  refreshing: boolean,
  refresh: () => void,
  updatedAt: number | null = null,
) {
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const visible = () =>
      document.visibilityState !== 'hidden' && navigator.onLine
    const clear = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
    }
    const wake = () => {
      clear()
      if (visible() && !refreshing) refresh()
    }
    const change = () => {
      if (!visible()) clear()
      else wake()
    }
    if (!refreshing && visible()) timer = setTimeout(wake, 2000)
    document.addEventListener('visibilitychange', change)
    window.addEventListener('online', change)
    window.addEventListener('offline', change)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', change)
      window.removeEventListener('online', change)
      window.removeEventListener('offline', change)
    }
    // A fast GET can batch away the busy render. Its completed snapshot must rearm polling.
  }, [active, refreshing, refresh, updatedAt])
}
