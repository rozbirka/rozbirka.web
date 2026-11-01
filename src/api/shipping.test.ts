import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { shippingApi } from './shipping'

afterEach(() => vi.restoreAllMocks())

it.each([null, {}])(
  'reads an order that has no delivery as no shipment: %j',
  async (data) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data })
    expect(await shippingApi.get('integration', 'order')).toBeNull()
  },
)

it('restores the nulls Core omits, so a draft is never mistaken for a waybill', async () => {
  // A draft has no number, no quote and no tracking; Core sends none of those
  // properties at all, and `number !== null` would then be true for all of them.
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      id: 'ship-1',
      integrationId: 'int-1',
      dispatchPointId: 'point-1',
      orderId: 'order-1',
      state: 'Draft',
      sender: { name: 'Склад', phone: '+380', divisionId: 12, settlementId: 1 },
      draft: {
        recipient: {
          name: 'Ірина',
          phone: '+380',
          divisionId: 8,
          settlementId: 2,
        },
        declaredValueUah: 4000,
        returnEstimateUah: 0,
        payerType: 'Recipient',
        description: '',
      },
      returnEstimateUah: 0,
    },
  })

  const shipment = await shippingApi.get('integration', 'order')

  expect(shipment).toMatchObject({
    number: null,
    quoteUah: null,
    codUah: null,
    quoteAt: null,
    trackingStatus: null,
  })
  expect(shipment?.events).toEqual([])
  expect(shipment?.draft.parcels).toEqual([])
})

it('restores the lifecycle fields Core omits, so no access or sync problem is invented', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      id: 'ship-1',
      integrationId: 'int-1',
      dispatchPointId: 'point-1',
      orderId: 'order-1',
      version: 'v1',
      state: 'Created',
      sender: { name: 'Склад', phone: '+380' },
      draft: { recipient: { name: 'Ірина', phone: '+380' } },
      returnEstimateUah: 0,
    },
  })

  expect(await shippingApi.byId('int-1', 'ship-1')).toMatchObject({
    connectionId: null,
    dispatchedAt: null,
    receivedAt: null,
    paymentState: null,
    syncProblem: null,
  })
})

it('sends the waybill list filters under the names Core binds', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: {
      items: [{ id: 's1', orderNumber: 354, state: 'Draft', recipient: {} }],
      page: 2,
      pageSize: 25,
      total: 26,
      totalPages: 2,
    },
  })

  const page = await shippingApi.list('int-1', {
    search: '354',
    hasProblem: true,
    hasCod: false,
    page: 2,
    pageSize: 25,
  })

  expect(get).toHaveBeenCalledWith('/integrations/int-1/shipping/shipments', {
    params: {
      Search: '354',
      HasProblem: true,
      HasCod: false,
      Page: 2,
      PageSize: 25,
    },
  })
  expect(page.items[0]).toMatchObject({ number: null, syncProblem: null })
})

it('asks Core to search for an unknown result when no candidate is named', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    data: { id: 's1', state: 'Created', draft: {}, sender: {} },
  })

  await shippingApi.reconcile('int-1', 'order-1')
  await shippingApi.reconcile('int-1', 'order-1', '20450011872209')

  expect(post).toHaveBeenNthCalledWith(
    1,
    '/integrations/int-1/shipping/orders/order-1/reconcile',
    {},
  )
  expect(post).toHaveBeenNthCalledWith(
    2,
    '/integrations/int-1/shipping/orders/order-1/reconcile',
    { number: '20450011872209' },
  )
})

it('confirms an external waybill with exactly what the preview showed', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    data: { orderId: 'order-1', payments: [] },
  })

  const delivery = await shippingApi.confirmExternal('int-1', 'order-1', {
    number: '204500',
    fingerprint: 'fp',
    shipmentVersion: 'v2',
  })

  expect(post).toHaveBeenCalledWith(
    '/integrations/int-1/shipping/orders/order-1/external/confirm',
    { number: '204500', fingerprint: 'fp', shipmentVersion: 'v2' },
  )
  expect(delivery).toMatchObject({
    workflowState: 'Open',
    refundDueUah: 0,
    refundAllocations: [],
  })
})
