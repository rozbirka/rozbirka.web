import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeApiProblem } from '@/api/errors'
import { onboardingApi, type OwnerOnboarding } from '@/api/onboarding'
import {
  diffOnboarding,
  isUnavailableProblem,
  isUnknownOutcome,
  type OnboardingChange,
  type OnboardingLoad,
} from './onboarding-policy'

/**
 * Last server read per user and tenant, kept for the browser session. It lets
 * the dashboard show the facts it already read while it re-reads them on
 * return, and tells which step a save elsewhere just credited.
 */
const lastRead = new Map<string, OwnerOnboarding>()

/** Test seam: forget everything read so far. */
export function resetOnboardingCache() {
  lastRead.clear()
}

export type DeferralStatus = 'idle' | 'saving' | 'checking' | 'failed'

export interface OwnerOnboardingState {
  load: OnboardingLoad
  /** Re-read after a failure (the «Повторити» button). */
  retry: () => void
  deferral: DeferralStatus
  /** «Зробити пізніше»: resolves `true` once the server has the deferral. */
  defer: () => Promise<boolean>
  /** «Продовжити» from the compact block: un-defer without waiting for it. */
  resume: () => void
}

/**
 * Onboarding facts of the current tenant for its owner. Reads on mount, when
 * the tab regains focus or becomes visible again (a save in another tab or on
 * mobile, AC-12), and on retry. Progress only ever comes from these reads.
 */
export function useOwnerOnboarding({
  tenantId,
  userId,
  enabled,
  onChange,
}: {
  tenantId: string | null
  userId: string | null
  enabled: boolean
  onChange?: (changes: OnboardingChange[]) => void
}): OwnerOnboardingState {
  const key =
    enabled && tenantId !== null && userId !== null
      ? `${userId}:${tenantId}`
      : null
  const [state, setState] = useState<{
    key: string | null
    load: OnboardingLoad
  }>(() => initialState(key))
  const [deferral, setDeferral] = useState<{
    key: string | null
    status: DeferralStatus
  }>({ key, status: 'idle' })
  const generation = useRef(0)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const accept = useCallback((forKey: string, facts: OwnerOnboarding) => {
    const changes = diffOnboarding(lastRead.get(forKey) ?? null, facts)
    lastRead.set(forKey, facts)
    setState({ key: forKey, load: { status: 'ready', facts } })
    if (changes.length > 0) onChangeRef.current?.(changes)
  }, [])

  const read = useCallback(
    async (forKey: string, forTenant: string, signal?: AbortSignal) => {
      const mine = ++generation.current
      try {
        const facts = await onboardingApi.get(
          forTenant,
          signal ? { signal } : {},
        )
        if (mine !== generation.current) return null
        accept(forKey, facts)
        return facts
      } catch (failure) {
        if (mine !== generation.current) return null
        const problem = normalizeApiProblem(failure)
        if (problem.kind === 'cancelled') return null
        setState((current) => {
          // A background re-read that fails keeps the facts already shown.
          if (current.key === forKey && current.load.status === 'ready')
            return current
          return {
            key: forKey,
            load: isUnavailableProblem(problem)
              ? { status: 'unavailable' }
              : { status: 'error', problem },
          }
        })
        return null
      }
    },
    [accept],
  )

  useEffect(() => {
    if (key === null || tenantId === null) return
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `read` sets state only once the request settles.
    void read(key, tenantId, controller.signal)
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      void read(key, tenantId)
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      generation.current += 1
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [key, read, tenantId])

  const retry = useCallback(() => {
    if (key === null || tenantId === null) return
    setState({ key, load: { status: 'loading' } })
    void read(key, tenantId)
  }, [key, read, tenantId])

  const defer = useCallback(async () => {
    if (key === null || tenantId === null) return false
    setDeferral({ key, status: 'saving' })
    try {
      const facts = await onboardingApi.setDeferred(tenantId, true)
      generation.current += 1
      accept(key, facts)
      setDeferral({ key, status: 'idle' })
      return true
    } catch (failure) {
      const problem = normalizeApiProblem(failure)
      if (problem.kind === 'cancelled') {
        setDeferral({ key, status: 'idle' })
        return false
      }
      if (!isUnknownOutcome(problem)) {
        setDeferral({ key, status: 'failed' })
        return false
      }
      // The answer was lost, not necessarily the write: read the fact back
      // before offering a retry.
      setDeferral({ key, status: 'checking' })
      const facts = await read(key, tenantId)
      const saved = facts?.deferred === true
      setDeferral({ key, status: saved ? 'idle' : 'failed' })
      return saved
    }
  }, [accept, key, read, tenantId])

  const resume = useCallback(() => {
    if (key === null || tenantId === null) return
    const facts = lastRead.get(key)
    if (facts?.deferred !== true) return
    // Not awaited: «Продовжити» opens the step at once. The next read shows
    // whatever the server kept; progress itself is unaffected.
    void onboardingApi
      .setDeferred(tenantId, false)
      .then((next) => lastRead.set(key, next))
      .catch(() => undefined)
  }, [key, tenantId])

  const load: OnboardingLoad =
    state.key === key ? state.load : initialState(key).load
  return {
    load,
    retry,
    deferral: deferral.key === key ? deferral.status : 'idle',
    defer,
    resume,
  }
}

function initialState(key: string | null): {
  key: string | null
  load: OnboardingLoad
} {
  const cached = key === null ? undefined : lastRead.get(key)
  return {
    key,
    load:
      cached === undefined
        ? { status: 'loading' }
        : { status: 'ready', facts: cached },
  }
}
