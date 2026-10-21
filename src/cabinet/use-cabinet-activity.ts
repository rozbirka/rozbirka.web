import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { recordUserActivity } from '@/api/user-activity'

const ACTIVITY_INTERVAL_MS = 60_000

/** Explicit visible-page use; background polling and token refresh never call this. */
export function useCabinetActivity(scopeKey: string | null) {
  const { pathname } = useLocation()
  const lastAttempt = useRef<{
    key: string
    at: number
    controller: AbortController
  } | null>(null)
  useEffect(() => {
    if (!scopeKey) return
    const controller = new AbortController()
    let pending = false
    const record = () => {
      if (
        document.visibilityState !== 'visible' ||
        controller.signal.aborted ||
        pending
      )
        return
      const now = Date.now()
      const last = lastAttempt.current
      if (
        last?.key === scopeKey &&
        now >= last.at &&
        now - last.at < ACTIVITY_INTERVAL_MS
      )
        return
      lastAttempt.current = { key: scopeKey, at: now, controller }
      pending = true
      void recordUserActivity({ signal: controller.signal })
        .catch(() => {
          /* Activity recording must not interrupt the person's work. */
        })
        .finally(() => {
          pending = false
        })
    }
    record()
    window.addEventListener('pointerdown', record, true)
    window.addEventListener('keydown', record, true)
    window.addEventListener('wheel', record, { capture: true, passive: true })
    window.addEventListener('focus', record)
    document.addEventListener('visibilitychange', record)
    return () => {
      controller.abort()
      if (pending && lastAttempt.current?.controller === controller)
        lastAttempt.current = null
      window.removeEventListener('pointerdown', record, true)
      window.removeEventListener('keydown', record, true)
      window.removeEventListener('wheel', record, true)
      window.removeEventListener('focus', record)
      document.removeEventListener('visibilitychange', record)
    }
  }, [scopeKey, pathname])
}
