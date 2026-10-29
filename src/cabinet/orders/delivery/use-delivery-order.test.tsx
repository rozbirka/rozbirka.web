/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { integrationsApi, type Integration } from '@/api/integrations'
import { shippingApi, type Shipment } from '@/api/shipping'
import { useDeliveryOrder } from './use-delivery-order'

vi.mock('@/api/delivery', () => ({ deliveryApi: { get: vi.fn() } }))
vi.mock('@/api/integrations', () => ({
  integrationsApi: { list: vi.fn(), dispatchPoints: vi.fn() },
}))
vi.mock('@/api/shipping', () => ({ shippingApi: { get: vi.fn() } }))
vi.mock('@/api/customers', () => ({ customersApi: { getById: vi.fn() } }))

const novaPoshta = (over: Partial<Integration> = {}): Integration => ({
  id: 'int-1',
  definitionId: 'definition-np',
  code: 'nova_poshta',
  displayName: 'Нова пошта',
  status: 'inactive',
  configured: true,
  verifiedAt: '2026-10-25T16:40:00Z',
  lastErrorCode: null,
  settings: null,
  deactivatedAt: '2026-10-28T08:14:00Z',
  deactivatedBy: 'Олег К.',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(deliveryApi.get).mockResolvedValue({} as DeliveryOrder)
})

it('reads the waybill of a switched-off integration without the carrier', async () => {
  const waybill = { id: 'ship-1', trackingEnabled: false } as Shipment
  vi.mocked(integrationsApi.list).mockResolvedValue([novaPoshta()])
  vi.mocked(shippingApi.get).mockResolvedValue(waybill)

  const { result } = renderHook(() => useDeliveryOrder('order-1', 'cust-1'))

  await waitFor(() => expect(result.current.state).not.toBeNull())
  expect(shippingApi.get).toHaveBeenCalledWith(
    'int-1',
    'order-1',
    expect.anything(),
  )
  expect(integrationsApi.dispatchPoints).not.toHaveBeenCalled()
  expect(result.current.state).toMatchObject({
    shipment: waybill,
    // Nothing that reaches the carrier may run, so there is no usable id.
    integrationId: null,
    carrier: { status: 'inactive', errorCode: null },
    disconnected: { integrationId: 'int-1', at: '2026-10-28T08:14:00Z' },
  })
})

it('loads no waybill for an integration that is in error', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([
    novaPoshta({ status: 'error', lastErrorCode: 'integration_key_rejected' }),
  ])

  const { result } = renderHook(() => useDeliveryOrder('order-1', null))

  await waitFor(() => expect(result.current.state).not.toBeNull())
  expect(shippingApi.get).not.toHaveBeenCalled()
  expect(result.current.state?.disconnected).toBeNull()
})
