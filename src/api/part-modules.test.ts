import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, expect, it } from 'vitest'
import { apiClient } from './client'
import { partModulesApi } from './part-modules'

const originalAdapter = apiClient.defaults.adapter!
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it('preserves partial failure instead of treating an unavailable module as empty', async () => {
  let request: InternalAxiosRequestConfig | undefined
  apiClient.defaults.adapter = (config) => {
    request = config
    return Promise.resolve({
      data: {
        data: {
          partId: 'part-1',
          modules: [
            {
              moduleCode: 'demo',
              availability: 'ready',
              items: [],
              problemCode: null,
              retryAfterSeconds: null,
            },
            {
              moduleCode: 'broken',
              availability: 'unavailable',
              items: [],
              problemCode: 'MODULE_UNAVAILABLE',
              retryAfterSeconds: 5,
            },
          ],
        },
      },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    } satisfies AxiosResponse)
  }
  const result = await partModulesApi.get('part-1')
  expect(request?.url).toBe('/parts/part-1/modules')
  expect(result.modules[1]?.availability).toBe('unavailable')
  expect(result.modules[1]?.problemCode).toBe('MODULE_UNAVAILABLE')
})

it('sends one bounded batch and forwards caller cancellation', async () => {
  let request: InternalAxiosRequestConfig | undefined
  apiClient.defaults.adapter = (config) => {
    request = config
    return Promise.resolve({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    } satisfies AxiosResponse)
  }
  const abort = new AbortController()
  await partModulesApi.getBatch(['one', 'two'], { signal: abort.signal })
  expect(request?.url).toBe('/parts/modules/batch')
  expect(JSON.parse(String(request?.data))).toEqual({ partIds: ['one', 'two'] })
  abort.abort()
  expect(request?.signal?.aborted).toBe(true)
  await expect(
    partModulesApi.getBatch(
      Array.from({ length: 101 }, (_, index) => String(index)),
    ),
  ).rejects.toThrow()
})
