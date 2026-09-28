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

it('reads a subscription with nothing to report as empty, not as unloaded', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      state: 'Connected',
      pendingNumbers: 0,
      unconfirmedNumbers: 0,
      publicCallbackConfigured: true,
      canRetry: false,
    },
  })

  expect(await integrationsApi.trackingSubscription('np-1')).toMatchObject({
    reasonCode: null,
    lastCallbackAt: null,
  })
})

it('sends a key in the body only when one was typed, and never in the path', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} })

  await integrationsApi.connectTracking('np-1', null)
  await integrationsApi.connectTracking('np-1', 'secret-key')
  await integrationsApi.disconnectTracking('np-1')
  await integrationsApi.retryTracking('np-1')

  expect(post.mock.calls.map(([url]) => url)).toEqual([
    '/integrations/np-1/tracking-subscription/connect',
    '/integrations/np-1/tracking-subscription/connect',
    '/integrations/np-1/tracking-subscription/disconnect',
    '/integrations/np-1/tracking-subscription/retry',
  ])
  expect(post.mock.calls[0]?.[1]).toEqual({})
  expect(post.mock.calls[1]?.[1]).toEqual({ apiKey: 'secret-key' })
  expect(post.mock.calls.every(([url]) => !url.includes('secret-key'))).toBe(
    true,
  )
})
