import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { integrationsApi } from './integrations'

afterEach(() => vi.restoreAllMocks())

it('fills in the nullable fields Core omits, whatever call returned the integration', async () => {
  const bare = { id: 'np-1', code: 'nova_poshta', status: 'draft' }
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [bare] })
  expect((await integrationsApi.list())[0]).toMatchObject({
    lastErrorCode: null,
    verifiedAt: null,
    settings: null,
  })
  get.mockResolvedValue({ data: bare })
  vi.spyOn(apiClient, 'post').mockResolvedValue({ data: bare })
  vi.spyOn(apiClient, 'put').mockResolvedValue({ data: bare })
  for (const result of await Promise.all([
    integrationsApi.getById('np-1'),
    integrationsApi.create('definition'),
    integrationsApi.saveNovaPoshtaKey('np-1', 'test-key'),
    integrationsApi.verify('np-1'),
    integrationsApi.activate('np-1'),
    integrationsApi.deactivate('np-1'),
  ]))
    expect(result).toMatchObject({
      lastErrorCode: null,
      verifiedAt: null,
      settings: null,
    })
})

it('leaves a carrier error code that Core really sent alone', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: { id: 'np-1', lastErrorCode: 'integration_account_unverified' },
  })
  expect((await integrationsApi.getById('np-1')).lastErrorCode).toBe(
    'integration_account_unverified',
  )
})

it('reads a diagnostics run without checks as an empty list, not a missing one', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    data: { checks: [{ code: 'authorization', status: 'ok' }] },
  })
  expect(await integrationsApi.diagnose('np-1')).toMatchObject({
    lastErrorCode: null,
    checks: [{ errorCode: null }],
  })
  post.mockResolvedValue({ data: {} })
  expect((await integrationsApi.diagnose('np-1')).checks).toEqual([])
})
