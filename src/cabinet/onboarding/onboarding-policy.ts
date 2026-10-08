import type { OwnerOnboarding } from '@/api/onboarding'
import type { ApiProblem } from '@/api/contracts'

/** The four required steps, in the order «Продовжити» walks them. */
export const ONBOARDING_STEPS = [
  'settings',
  'currency',
  'source',
  'part',
] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

const FACT: Record<
  OnboardingStep,
  keyof Pick<
    OwnerOnboarding,
    | 'settingsCompleted'
    | 'currencySelected'
    | 'sourceCreated'
    | 'firstPartCreated'
  >
> = {
  settings: 'settingsCompleted',
  currency: 'currencySelected',
  source: 'sourceCreated',
  part: 'firstPartCreated',
}

export const isStepDone = (facts: OwnerOnboarding, step: OnboardingStep) =>
  facts[FACT[step]]

/** Steps saved on the server, out of four. Never derived from clicks. */
export const completedStepCount = (facts: OwnerOnboarding) =>
  ONBOARDING_STEPS.filter((step) => isStepDone(facts, step)).length

/** Where «Продовжити» leads: the first step the server has not credited. */
export const firstIncompleteStep = (
  facts: OwnerOnboarding,
): OnboardingStep | null =>
  ONBOARDING_STEPS.find((step) => !isStepDone(facts, step)) ?? null

/** Core's completion flag, or all four facts already in place. */
export const isOnboardingComplete = (facts: OwnerOnboarding) =>
  facts.completed || firstIncompleteStep(facts) === null

/** Only the tenant's owner gets the owner scenario (AC-1). */
export const isOwnerRole = (role: string | null | undefined) =>
  typeof role === 'string' && role.trim().toLowerCase() === 'owner'

export type OnboardingLoad =
  | { status: 'loading' }
  | { status: 'ready'; facts: OwnerOnboarding }
  /** Core answered that this user or build has no onboarding (403/404). */
  | { status: 'unavailable' }
  /**
   * The first read failed for lack of a connection: eligibility is unknown,
   * so nothing — not even an error — is claimed about onboarding yet.
   */
  | { status: 'offline' }
  | { status: 'error'; problem: ApiProblem | null }

export type ChecklistView =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'offline' }
  | { kind: 'error' }
  | { kind: 'expanded'; facts: OwnerOnboarding; next: OnboardingStep }
  | { kind: 'compact'; facts: OwnerOnboarding; next: OnboardingStep }
  | { kind: 'completed' }

/**
 * DIA-ONBOARDING-DECISION plus the system states:
 *
 * | eligible | owner | completed | shown                                 |
 * | -------- | ----- | --------- | ------------------------------------- |
 * | no       | any   | any       | nothing (SC-7, AC-9)                  |
 * | yes      | no    | any       | nothing (AC-1)                        |
 * | yes      | yes   | no        | list, or compact block when deferred  |
 * | yes      | yes   | yes       | completion card until `dismissed`     |
 *
 * Loading and failure are shown only to an owner, because only the owner
 * asks; failure never shows guessed progress (EC-4). A first read without a
 * connection is neutral (eligibility is unknown, so it is not an error of
 * this yard). Completion wins over deferral (Deferred → Completed); hiding
 * the completion card is Core's `dismissed`, shared with mobile.
 */
export function decideChecklistView({
  isOwner,
  load,
}: {
  isOwner: boolean
  load: OnboardingLoad
}): ChecklistView {
  if (!isOwner) return { kind: 'hidden' }
  if (load.status === 'loading') return { kind: 'loading' }
  if (load.status === 'offline') return { kind: 'offline' }
  if (load.status === 'error') return { kind: 'error' }
  if (load.status === 'unavailable') return { kind: 'hidden' }
  const { facts } = load
  if (!facts.eligible) return { kind: 'hidden' }
  const next = firstIncompleteStep(facts)
  if (facts.completed || next === null)
    return facts.dismissed ? { kind: 'hidden' } : { kind: 'completed' }
  return facts.deferred
    ? { kind: 'compact', facts, next }
    : { kind: 'expanded', facts, next }
}

/** A step the server credited, or took back, between two reads. */
export type OnboardingChange =
  | { kind: 'credited'; step: OnboardingStep }
  | { kind: 'completed' }
  | { kind: 'source-reverted' }

/**
 * What changed between two server reads of the same tenant, for the toast.
 * Steps saved anywhere — the checklist, a manual action elsewhere, the mobile
 * app — are credited the same way (AC-4, AC-12). Losing the last source before
 * the first part is the one way back (AC-14); completion is sticky (AC-11).
 */
export function diffOnboarding(
  before: OwnerOnboarding | null,
  after: OwnerOnboarding,
): OnboardingChange[] {
  if (before === null || !after.eligible) return []
  const wasComplete = isOnboardingComplete(before)
  if (!wasComplete && isOnboardingComplete(after))
    return [{ kind: 'completed' }]
  if (wasComplete) return []
  const changes: OnboardingChange[] = []
  for (const step of ONBOARDING_STEPS) {
    if (!isStepDone(before, step) && isStepDone(after, step))
      changes.push({ kind: 'credited', step })
  }
  if (before.sourceCreated && !after.sourceCreated)
    changes.push({ kind: 'source-reverted' })
  return changes
}

/**
 * 403 (not the owner), 404, 405 and 501 (a Core without the onboarding
 * endpoint): there is no onboarding for this user here — show nothing rather
 * than an error every owner would see.
 */
export const isUnavailableProblem = (problem: ApiProblem) =>
  problem.kind === 'forbidden' ||
  problem.kind === 'not-found' ||
  problem.status === 405 ||
  problem.status === 501

/** No connection (or no answer in time): nothing is known yet. */
export const isOfflineProblem = (problem: ApiProblem) =>
  problem.kind === 'network' || problem.kind === 'timeout'

/**
 * A request that may have reached the server before the connection broke:
 * re-read the fact instead of reporting failure (EC-1).
 */
export const isUnknownOutcome = (problem: ApiProblem) =>
  problem.kind === 'network' ||
  problem.kind === 'timeout' ||
  problem.kind === 'unknown'
