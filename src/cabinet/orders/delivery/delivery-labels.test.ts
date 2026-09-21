import { expect, it } from 'vitest'
import type { Shipment } from '@/api/shipping'
import {
  QUOTE_TTL_MS,
  prepayment,
  quotePresentation,
  quoteState,
} from './delivery-labels'

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'shipment-1',
  integrationId: 'integration-1',
  dispatchPointId: 'point-1',
  orderId: 'order-1',
  state: 'Draft',
  number: null,
  sender: {
    name: 'Олена Коваль',
    phone: '+380672147730',
    divisionId: 12,
    settlementId: 10,
  },
  draft: {
    recipient: {
      name: 'Ірина Олійник',
      phone: '+380503381172',
      divisionId: 8,
      settlementId: 20,
    },
    parcels: [{ lengthCm: 40, widthCm: 30, heightCm: 22, weightKg: 4.2 }],
    declaredValueUah: 4280,
    returnEstimateUah: 180,
    payerType: 'Recipient',
    description: 'Автозапчастини',
  },
  quoteUah: 180,
  returnEstimateUah: 180,
  codUah: null,
  quoteAt: new Date().toISOString(),
  trackingCode: null,
  trackingStatus: null,
  lastTrackedAt: null,
  relatedNumbers: [],
  events: [],
  ...over,
})

const base = { dirty: false, busy: false, failure: null }

it('offers a waybill only on a quote that still answers the form', () => {
  const fresh = quoteState({ ...base, shipment: shipment() })

  expect(fresh.kind).toBe('ready')
  expect(quotePresentation(fresh).canCreate).toBe(true)
})

it('blocks the waybill once the carrier quote is a day old', () => {
  const old = new Date(Date.now() - QUOTE_TTL_MS - 60_000).toISOString()
  const state = quoteState({ ...base, shipment: shipment({ quoteAt: old }) })
  const view = quotePresentation(state)

  expect(state.kind).toBe('stale')
  expect(view.canCreate).toBe(false)
  expect(view.showMoney).toBe(true)
  expect(view.dimMoney).toBe(true)
})

it('blocks the waybill while the form no longer matches the quote', () => {
  const state = quoteState({ ...base, dirty: true, shipment: shipment() })
  const view = quotePresentation(state)

  expect(state.kind).toBe('dirty')
  expect(view.canCreate).toBe(false)
  expect(view.action).toBe('Зберегти й перерахувати')
})

it('treats a missing quote and a failed one as separate states', () => {
  expect(
    quoteState({ ...base, shipment: shipment({ quoteAt: null }) }).kind,
  ).toBe('none')
  expect(
    quoteState({ ...base, failure: 'Гранична вага', shipment: shipment() }),
  ).toEqual({ kind: 'failed', message: 'Гранична вага' })
})

it('adds the return estimate the manager entered to the carrier quote', () => {
  expect(prepayment(shipment())).toBe(360)
  expect(prepayment(shipment({ quoteUah: null }))).toBeNull()
  expect(prepayment(null)).toBeNull()
})
