import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, expect, it } from 'vitest'
import { apiClient } from './client'
import { partImportsApi } from './part-imports'
const original = apiClient.defaults.adapter!
afterEach(() => {
  apiClient.defaults.adapter = original
})
it('preserves TAB, encoding and the upload key in multipart data', async () => {
  let sent!: InternalAxiosRequestConfig
  apiClient.defaults.adapter = async (config) => {
    await Promise.resolve()
    sent = config
    return {
      data: { data: { id: 'import-1' } },
      status: 202,
      statusText: 'Accepted',
      headers: new AxiosHeaders(),
      config,
    }
  }
  const file = new File(['Name\tQuantity'], 'parts.csv')
  expect(
    await partImportsApi.upload(file, 'same-key', {
      delimiter: '\t',
      encoding: 'windows-1251',
    }),
  ).toEqual({ id: 'import-1' })
  expect(sent.url).toBe('/parts/imports')
  expect((sent.data as FormData).get('delimiter')).toBe('\t')
  expect((sent.data as FormData).get('encoding')).toBe('windows-1251')
  expect((sent.data as FormData).get('key')).toBe('same-key')
})
it('sends the exact validated revision, digest and replay key', async () => {
  let sent!: InternalAxiosRequestConfig
  apiClient.defaults.adapter = async (config) => {
    await Promise.resolve()
    sent = config
    return {
      data: { data: { id: 'execution' } },
      status: 202,
      statusText: 'Accepted',
      headers: new AxiosHeaders(),
      config,
    }
  }
  await partImportsApi.commit('abc', {
    revision: 4,
    previewVersion: 2,
    digest: 'digest',
    key: 'replay',
  })
  expect(JSON.parse(sent.data as string)).toEqual({
    revision: 4,
    previewVersion: 2,
    digest: 'digest',
    key: 'replay',
  })
  expect(sent.url).toBe('/parts/imports/abc/commit')
})
