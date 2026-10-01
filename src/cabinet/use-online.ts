import { useSyncExternalStore } from 'react'

const subscribe = (notify: () => void) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

/**
 * Whether the browser currently has a network. Server rendering and browsers
 * without the API both answer "yes", which is the honest default: a false
 * "no connection" is worse than saying nothing.
 */
export const useOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    () => true,
  )
