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

it('patches only the deferred flag and returns the server state', async () => {
  let observed: InternalAxiosRequestConfig | undefined
  apiClient.defaults.adapter = (config) => {
    observed = config
    return Promise.resolve(response(config, { ...facts, deferred: true }))
  }

  await expect(onboardingApi.setDeferred('tenant-1', true)).resolves.toEqual({
    ...facts,
    deferred: true,
  })
  expect(observed?.method).toBe('patch')
  expect(observed?.url).toBe('/tenants/tenant-1/onboarding')
  expect(observed?.data).toBe(JSON.stringify({ deferred: true }))
})

it('rejects a response with a missing or non-boolean flag instead of guessing', () => {
  const { sourceCreated: _missing, ...withoutSource } = facts
  expect(() => parseOwnerOnboarding(withoutSource)).toThrow(
    OnboardingContractError,
  )
  expect(() => parseOwnerOnboarding({ ...facts, completed: 'false' })).toThrow(
    OnboardingContractError,
  )
  expect(() => parseOwnerOnboarding(null)).toThrow(OnboardingContractError)
  expect(() => parseOwnerOnboarding([facts])).toThrow(OnboardingContractError)
})
