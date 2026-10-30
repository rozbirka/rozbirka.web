import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { shippingApi } from './shipping'

afterEach(() => vi.restoreAllMocks())

it('searches without a write and restores omitted candidate facts as unavailable', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      shipmentVersion: 'v3',
      status: 'Incomplete',
      candidates: [
        { number: '20450011872209', fingerprint: 'fp', canConfirm: false },
      ],
    },
  })
  const post = vi.spyOn(apiClient, 'post')
  const result = await shippingApi.searchRecoveryCandidates('int/1', 'order/1')
  expect(get).toHaveBeenCalledWith(
    '/integrations/int%2F1/shipping/orders/order%2F1/recovery-candidates',
    {},
  )
  expect(post).not.toHaveBeenCalled()
  expect(result.candidates[0]).toEqual({
    number: '20450011872209',
    fingerprint: 'fp',
    canConfirm: false,
    createdAt: null,
    sender: null,
    recipient: null,
    codUah: null,
  })
})

it('keeps preview separate from confirmation and sends the reviewed version and fingerprint', async () => {
  const post = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValueOnce({
      data: { shipmentVersion: 'v3', status: 'NotFound' },
    })
    .mockResolvedValueOnce({ data: { id: 's1', state: 'Created', draft: {} } })
  expect(
    await shippingApi.previewRecoveryCandidate(
      'int-1',
      'order-1',
      '20450011872209',
    ),
  ).toEqual({ shipmentVersion: 'v3', status: 'NotFound', candidates: [] })
  expect(post).toHaveBeenCalledTimes(1)
  const confirmed = await shippingApi.confirmRecoveryCandidate(
    'int-1',
    'order-1',
    { number: '20450011872209', shipmentVersion: 'v3', fingerprint: 'fp3' },
  )
  expect(post).toHaveBeenNthCalledWith(
    1,
    '/integrations/int-1/shipping/orders/order-1/recovery-candidates/preview',
    { number: '20450011872209' },
  )
  expect(post).toHaveBeenNthCalledWith(
    2,
    '/integrations/int-1/shipping/orders/order-1/recovery-candidates/confirm',
    { number: '20450011872209', shipmentVersion: 'v3', fingerprint: 'fp3' },
  )
  expect(confirmed).toMatchObject({
    id: 's1',
    state: 'Created',
    number: null,
    events: [],
  })
})
