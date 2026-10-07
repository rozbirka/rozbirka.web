import type { OnboardingStep } from './onboarding-policy'

export type ReturnFocusTarget = OnboardingStep | 'continue'

/**
 * Where focus goes when the owner comes back to the dashboard from a step the
 * checklist opened: the step's row, or «Продовжити» when that is what opened
 * it. Kept in memory for one return only, per user and tenant.
 */
let pending: { key: string; target: ReturnFocusTarget } | null = null

export function rememberReturnFocus(key: string, target: ReturnFocusTarget) {
  pending = { key, target }
}

export function forgetReturnFocus() {
  pending = null
}

/** The remembered target for `key`, consumed by the call. */
export function takeReturnFocus(key: string): ReturnFocusTarget | null {
  if (pending?.key !== key) return null
  const { target } = pending
  pending = null
  return target
}
