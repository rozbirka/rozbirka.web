import { useSyncExternalStore } from 'react'

type Theme = 'dark' | 'light'
const key = 'rozbirka.theme'
const changed = 'rozbirka:theme-change'
let memory: Theme | null = null

function read(): Theme {
  if (typeof window === 'undefined') return 'dark'
  if (memory !== null) return memory
  try {
    return localStorage.getItem(key) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      memory = null
      notify()
    }
  }
  window.addEventListener(changed, notify)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(changed, notify)
    window.removeEventListener('storage', storage)
  }
}

function setTheme(theme: Theme) {
  memory = theme
  try {
    localStorage.setItem(key, theme)
    memory = null
  } catch {
    // The current page can still change theme when storage is unavailable.
  }
  window.dispatchEvent(new Event(changed))
}

/** A browser preference shared by desktop, rail and mobile controls. */
export function useTheme(): readonly [Theme, (theme: Theme) => void] {
  return [useSyncExternalStore(subscribe, read, () => 'dark'), setTheme]
}
