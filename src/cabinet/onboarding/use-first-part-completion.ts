import { useCallback, useState } from 'react'
import { isOwnerRole, type OnboardingChange } from './onboarding-policy'
import { cachedOnboarding, useOwnerOnboarding } from './use-owner-onboarding'

/**
 * Whether saving a part just completed the owner's onboarding (the first
 * part, ROZ-163 step 4). Only an owner whose onboarding is not known to be
 * finished reads it, and completion comes from Core's facts after the save
 * — never from the save itself.
 */
export function useFirstPartCompletion({
  tenantId,
  userId,
  role,
}: {
  tenantId: string | null
  userId: string | null
  role: string | null | undefined
}) {
  const [done, setDone] = useState(false)
  const cached =
    tenantId !== null && userId !== null
      ? cachedOnboarding(userId, tenantId)
      : undefined
  const finished =
    cached !== undefined && (!cached.eligible || cached.completed)
  const onboarding = useOwnerOnboarding({
    tenantId,
    userId,
    enabled: isOwnerRole(role) && !finished && !done,
    onChange: useCallback((changes: OnboardingChange[]) => {
      if (changes.some((change) => change.kind === 'completed')) setDone(true)
    }, []),
  })
  const { refresh } = onboarding
  /** Call after a part was saved. */
  const check = useCallback(() => void refresh(), [refresh])
  return { done, check }
}
