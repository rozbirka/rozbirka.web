import { apiClient } from './client'
import type { RequestOptions } from './contracts'

/**
 * Owner onboarding of one tenant (Core `OnboardingDto`, pending contract — see
 * contract-alignment.ts). Every flag is a server fact: a step counts only after
 * its entity or setting was saved, never because a form was opened.
 */
export interface OwnerOnboarding {
  /** Created after the feature launched; older tenants never see it. */
  eligible: boolean
  /** The owner chose «Зробити пізніше»; shared across web and mobile. */
  deferred: boolean
  /** Settings and the first part are saved. Sticky: deleting the part later
   * does not reopen onboarding. */
  completed: boolean
  settingsCompleted: boolean
  currencySelected: boolean
  sourceCreated: boolean
  firstPartCreated: boolean
}

export interface UpdateOnboardingRequest {
  deferred: boolean
}

const ONBOARDING_FLAGS = [
  'eligible',
  'deferred',
  'completed',
  'settingsCompleted',
  'currencySelected',
  'sourceCreated',
  'firstPartCreated',
] as const satisfies readonly (keyof OwnerOnboarding)[]

export class OnboardingContractError extends Error {
  constructor() {
    super('Invalid onboarding response')
    this.name = 'OnboardingContractError'
  }
}

/**
 * Validate an onboarding DTO. A missing or non-boolean flag rejects the whole
 * response: progress is shown from facts or not at all, never guessed.
 * Extra fields (Core also sends `completedSteps` and `nextStep`) are ignored —
 * the client derives both from the flags.
 */
export function parseOwnerOnboarding(raw: unknown): OwnerOnboarding {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    throw new OnboardingContractError()
  const source = raw as Record<string, unknown>
  const parsed = {} as Record<(typeof ONBOARDING_FLAGS)[number], boolean>
  for (const flag of ONBOARDING_FLAGS) {
    const value = source[flag]
    if (typeof value !== 'boolean') throw new OnboardingContractError()
    parsed[flag] = value
  }
  return parsed
}

const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

const onboardingPath = (tenantId: string) =>
  `/tenants/${encodeURIComponent(tenantId)}/onboarding`

export const onboardingApi = {
  /** Owner only: Core answers 403 to any other member. */
  async get(
    tenantId: string,
    options: RequestOptions = {},
  ): Promise<OwnerOnboarding> {
    const response = await apiClient.get<unknown>(
      onboardingPath(tenantId),
      requestConfig(options),
    )
    return parseOwnerOnboarding(response.data)
  },

  /** Setting the same value again is harmless, so a retry cannot overshoot. */
  async setDeferred(
    tenantId: string,
    deferred: boolean,
    options: RequestOptions = {},
  ): Promise<OwnerOnboarding> {
    const request: UpdateOnboardingRequest = { deferred }
    const response = await apiClient.patch<unknown>(
      onboardingPath(tenantId),
      request,
      requestConfig(options),
    )
    return parseOwnerOnboarding(response.data)
  },
}
