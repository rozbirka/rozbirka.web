import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, expect, it } from 'vitest'
import { apiClient } from './client'
import {
  OnboardingContractError,
  onboardingApi,
  parseOwnerOnboarding,
} from './onboarding'

const facts = {
  eligible: true,
  deferred: false,
  dismissed: false,
  completed: false,
  settingsCompleted: true,
  currencySelected: false,
  sourceCreated: false,
  firstPartCreated: false,
}

function response<T>(
  config: InternalAxiosRequestConfig,
  data: T,
): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  }
}

const originalAdapter = apiClient.defaults.adapter!

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it('reads the onboarding facts of one tenant from the result envelope', async () => {
  const controller = new AbortController()
  let observed: InternalAxiosRequestConfig | undefined
  apiClient.defaults.adapter = (config) => {
    observed = config
    return Promise.resolve(
      response(config, {
        data: { ...facts, completedSteps: 1, nextStep: 'currency' },
      }),
    )
  }

  await expect(
    onboardingApi.get('tenant-1', { signal: controller.signal }),
  ).resolves.toEqual(facts)
  expect(observed?.method).toBe('get')
  expect(observed?.url).toBe('/tenants/tenant-1/onboarding')
  controller.abort()
  expect(observed?.signal?.aborted).toBe(true)
})

it('patches only the given flag and returns the server state', async () => {
  const observed: InternalAxiosRequestConfig[] = []
  apiClient.defaults.adapter = (config) => {
    observed.push(config)
    return Promise.resolve(
      response(config, { ...facts, deferred: true, dismissed: true }),
    )
  }

  await expect(
    onboardingApi.update('tenant-1', { deferred: true }),
  ).resolves.toEqual({ ...facts, deferred: true, dismissed: true })
  await onboardingApi.update('tenant-1', { dismissed: true })
  expect(observed.map((config) => config.method)).toEqual(['patch', 'patch'])
  expect(observed[0]?.url).toBe('/tenants/tenant-1/onboarding')
  expect(observed[0]?.data).toBe(JSON.stringify({ deferred: true }))
  expect(observed[1]?.data).toBe(JSON.stringify({ dismissed: true }))
})

it('rejects a response with a missing or non-boolean flag instead of guessing', () => {
  const { sourceCreated: _missing, ...withoutSource } = facts
  expect(() => parseOwnerOnboarding(withoutSource)).toThrow(
    OnboardingContractError,
  )
  const { dismissed: _dismissed, ...withoutDismissed } = facts
  expect(() => parseOwnerOnboarding(withoutDismissed)).toThrow(
    OnboardingContractError,
  )
  expect(() => parseOwnerOnboarding({ ...facts, completed: 'false' })).toThrow(
    OnboardingContractError,
  )
  expect(() => parseOwnerOnboarding(null)).toThrow(OnboardingContractError)
  expect(() => parseOwnerOnboarding([facts])).toThrow(OnboardingContractError)
})
