import { useEffect } from 'react'

/** Refresh visible data after background changes, reconnection or returning to the tab. */
export function useVisibleRefresh(refresh: () => void) {
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== 'hidden') refresh()
    }
    const timer = window.setInterval(update, 10_000)
    window.addEventListener('focus', update)
    window.addEventListener('online', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
      window.removeEventListener('online', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [refresh])
}
