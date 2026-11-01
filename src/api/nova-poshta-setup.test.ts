import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { novaPoshtaSetupApi } from './nova-poshta-setup'

afterEach(() => vi.restoreAllMocks())

it('starts a session from the key and reads a missing configuration as null', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    data: {
      id: 's1',
      version: 'v1',
      state: 'Pending',
      expiresAt: '2026-10-27T20:00:00Z',
    },
  })

  const session = await novaPoshtaSetupApi.begin('int-1', 'key')

  expect(post).toHaveBeenCalledWith(
    '/integrations/int-1/shipping/setup-sessions',
    { apiKey: 'key' },
  )
  expect(session.configuration).toBeNull()
})

it('sends the configuration with the version it last read', async () => {
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
    data: {
      id: 's1',
      version: 'v2',
      state: 'Pending',
      expiresAt: '2026-10-27T20:00:00Z',
      configuration: {
        sender: {
          name: 'Олег',
          phone: '+380',
          settlementRef: 'c',
          warehouseRef: 'w',
        },
      },
    },
  })
  const configuration = {
    sender: {
      name: 'Олег',
      phone: '+380',
      settlementRef: 'c',
      warehouseRef: 'w',
      counterpartyRef: 'cp',
      contactRef: 'ct',
    },
    codCashRegisterId: null,
  }

  const session = await novaPoshtaSetupApi.configure(
    'int-1',
    's1',
    'v1',
    configuration,
  )

  expect(put).toHaveBeenCalledWith(
    '/integrations/int-1/shipping/setup-sessions/s1/configuration',
    { version: 'v1', configuration },
  )
  expect(session.configuration?.codCashRegisterId).toBeNull()
})

it('recovers an older cabinet with its version and the new key', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    data: { connectionId: 'c1', version: 'v2', credentialVersionId: 'k1' },
  })

  await novaPoshtaSetupApi.recover('int-1', 'c1', 'v1', 'key')

  expect(post).toHaveBeenCalledWith(
    '/integrations/int-1/shipping/connections/c1/recover',
    { version: 'v1', apiKey: 'key' },
  )
})
