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
