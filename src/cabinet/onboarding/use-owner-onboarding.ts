import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeApiProblem } from '@/api/errors'
import {
  onboardingApi,
  type OwnerOnboarding,
  type UpdateOnboardingRequest,
} from '@/api/onboarding'
import {
  diffOnboarding,
  isOfflineProblem,
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

/** The facts last read this session for a user and tenant, if any. */
export function cachedOnboarding(
  userId: string,
  tenantId: string,
): OwnerOnboarding | undefined {
  return lastRead.get(`${userId}:${tenantId}`)
}

/**
 * Before Core stored `dismissed`, hiding the completion card was remembered
 * per user and tenant in this browser under this key. It is migrated to the
 * server once and then removed.
 */
export const legacyHiddenKey = (key: string) =>
  `rozbirka:onboarding-done-hidden:${key}`

function readLegacyHidden(key: string): boolean {
  try {
    return localStorage.getItem(legacyHiddenKey(key)) === '1'
  } catch {
    return false
  }
}

function forgetLegacyHidden(key: string) {
  try {
    localStorage.removeItem(legacyHiddenKey(key))
  } catch {
    // Nothing to remove.
  }
}

/** One of the three onboarding PATCHes the owner can trigger. */
export type OnboardingAction = 'defer' | 'resume' | 'dismiss'

export type MutationStatus = 'idle' | 'saving' | 'checking' | 'failed'

const PATCH: Record<OnboardingAction, UpdateOnboardingRequest> = {
  defer: { deferred: true },
  resume: { deferred: false },
  dismiss: { dismissed: true },
}

const SAVED: Record<OnboardingAction, (facts: OwnerOnboarding) => boolean> = {
  defer: (facts) => facts.deferred,
  resume: (facts) => !facts.deferred,
  dismiss: (facts) => facts.dismissed,
}

export interface OwnerOnboardingState {
  load: OnboardingLoad
  /** Re-read after a failure (the «Повторити» button). */
  retry: () => void
  /** Re-read in the background, keeping what is shown meanwhile. */
  refresh: () => Promise<void>
  /** The PATCH in flight or last failed, with its action. */
  mutation: { action: OnboardingAction | null; status: MutationStatus }
  /** «Зробити пізніше»: resolves `true` once the server has the deferral. */
  defer: () => Promise<boolean>
  /**
   * Compact «Продовжити»: clears the deferral and resolves `true` only once
   * the server has it, so the step opens after a confirmed answer.
   */
  resume: () => Promise<boolean>
  /** «Сховати» on the completion card (Core `dismissed`). */
  dismiss: () => Promise<boolean>
  /**
   * The card was hidden in this browser before Core stored it; true until
   * the migration to `dismissed` succeeds, so it does not flash back.
   */
  hiddenLocally: boolean
}

/**
 * Onboarding facts of the current tenant for its owner. Reads on mount, when
 * the tab regains focus or becomes visible again (a save in another tab or on
 * mobile, AC-12), when the connection returns, and on retry. Progress only
 * ever comes from these reads.
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
  const [mutation, setMutation] = useState<{
    key: string | null
    action: OnboardingAction | null
    status: MutationStatus
  }>({ key, action: null, status: 'idle' })
  const generation = useRef(0)
  const mutating = useRef(false)
  const migrated = useRef(new Set<string>())
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
              : isOfflineProblem(problem)
                ? { status: 'offline' }
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
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller.abort()
      generation.current += 1
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [key, read, tenantId])

  const retry = useCallback(() => {
    if (key === null || tenantId === null) return
    setState({ key, load: { status: 'loading' } })
    void read(key, tenantId)
  }, [key, read, tenantId])

  const refresh = useCallback(async () => {
    if (key === null || tenantId === null) return
    await read(key, tenantId)
  }, [key, read, tenantId])

  /**
   * One PATCH with the house rule for a lost answer: the write may have
   * landed, so the fact is read back before failure is reported — never
   * written twice blindly.
   */
  const mutate = useCallback(
    async (action: OnboardingAction): Promise<boolean> => {
      if (key === null || tenantId === null || mutating.current) return false
      mutating.current = true
      setMutation({ key, action, status: 'saving' })
      try {
        const facts = await onboardingApi.update(tenantId, PATCH[action])
        generation.current += 1
        accept(key, facts)
        setMutation({ key, action, status: 'idle' })
        return true
      } catch (failure) {
        const problem = normalizeApiProblem(failure)
        if (problem.kind === 'cancelled') {
          setMutation({ key, action, status: 'idle' })
          return false
        }
        if (!isUnknownOutcome(problem)) {
          setMutation({ key, action, status: 'failed' })
          return false
        }
        setMutation({ key, action, status: 'checking' })
        const facts = await read(key, tenantId)
        const saved = facts !== null && SAVED[action](facts)
        setMutation({ key, action, status: saved ? 'idle' : 'failed' })
        return saved
      } finally {
        mutating.current = false
      }
    },
    [accept, key, read, tenantId],
  )

  const defer = useCallback(() => mutate('defer'), [mutate])
  const resume = useCallback(async () => {
    if (key !== null && lastRead.get(key)?.deferred === false) return true
    return mutate('resume')
  }, [key, mutate])
  const dismiss = useCallback(() => mutate('dismiss'), [mutate])

  // Move a completion card hidden in this browser before Core stored it.
  const loadedFacts =
    state.key === key && state.load.status === 'ready' ? state.load.facts : null
  useEffect(() => {
    if (key === null || loadedFacts === null || migrated.current.has(key))
      return
    if (!readLegacyHidden(key)) return
    migrated.current.add(key)
    if (loadedFacts.dismissed) {
      forgetLegacyHidden(key)
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the one-off migration PATCH sets state only as it progresses.
    void mutate('dismiss').then((saved) => {
      if (saved) forgetLegacyHidden(key)
    })
  }, [key, loadedFacts, mutate])

  const load: OnboardingLoad =
    state.key === key ? state.load : initialState(key).load
  return {
    load,
    retry,
    refresh,
    mutation:
      mutation.key === key
        ? { action: mutation.action, status: mutation.status }
        : { action: null, status: 'idle' },
    defer,
    resume,
    dismiss,
    hiddenLocally: key !== null && readLegacyHidden(key),
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
