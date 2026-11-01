import { expect, it } from 'vitest'
import type { DeliveryOrder } from '@/api/delivery'
import type { ExternalShipmentPreview, Shipment } from '@/api/shipping'
import {
  contactLine,
  parcelLine,
  parcelsFrom,
  parseDimensions,
  previewIncomplete,
  previewMismatch,
  quoteFresh,
  routeLine,
  waybillStage,
} from './waybill-view'

const delivery = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
  orderId: 'order-1',
  agreedTotalUah: 9600,
  appliedUah: 5400,
  outstandingUah: 4200,
  netReceivedUah: 5400,
  feesUah: 0,
  requiredDepositUah: 224,
  depositShortfallUah: 0,
  depositSatisfied: true,
  depositWaived: false,
  depositRequired: true,
  customerTrusted: false,
  dispatchedAt: null,
  receivedAt: null,
  returnedAt: null,
  awaitingCodReconciliation: false,
  payments: [],
  workflowState: 'Open',
  refundDueUah: 0,
  refundAllocations: [],
  ...over,
})

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'ship-1',
  integrationId: 'int-1',
  dispatchPointId: 'point-1',
  connectionId: null,
  orderId: 'order-1',
  version: 'v1',
  state: 'Draft',
  number: null,
  sender: {
    name: 'ФОП Коваль Олег Петрович',
    phone: '+380672147730',
    warehouseRef: 'w-12',
    settlementRef: 's-kyiv',
    warehouseName: 'Відділення №12 (до 30 кг): вул. Богатирська, 6',
    settlementName: 'м. Київ, Київська обл.',
  },
  draft: {
    recipient: {
      name: 'Ірина Коваль',
      phone: '+380672145508',
      warehouseRef: 'w-5',
      settlementRef: 's-lviv',
      warehouseName: 'Відділення №5: вул. Городоцька, 120',
      settlementName: 'Львів',
    },
    parcels: [{ lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 4.2 }],
    declaredValueUah: 9600,
    payerType: 'Recipient',
    description: 'Автозапчастини',
  },
  quoteUah: 128,
  returnEstimateUah: 96,
  codUah: null,
  quoteAt: null,
  trackingCode: null,
  trackingStatus: null,
  lastTrackedAt: null,
  relatedNumbers: [],
  events: [],
  dispatchedAt: null,
  receivedAt: null,
  paymentState: null,
  syncProblem: null,
  trackingEnabled: true,
  ...over,
})

const preview = (
  over: Partial<ExternalShipmentPreview> = {},
): ExternalShipmentPreview => ({
  number: '20451931554012',
  fingerprint: 'f',
  shipmentVersion: 'v1',
  providerStatus: '1',
  sender: shipment().sender,
  recipient: shipment().draft.recipient,
  codAmountUah: 4200,
  recordsDispatch: false,
  recordsReceipt: false,
  ...over,
})

it('reads the waybill stage from the shipment and the order', () => {
  const points = ['point-1']
  expect(waybillStage(delivery(), null, points)).toBe('none')
  expect(waybillStage(delivery(), shipment(), points)).toBe('draft')
  expect(waybillStage(delivery(), shipment({ state: 'Unknown' }), points)).toBe(
    'unknown',
  )
  expect(
    waybillStage(delivery(), shipment({ state: 'CancelUnknown' }), points),
  ).toBe('cancelUnknown')
  const created = shipment({ state: 'Created', number: '20451200987731' })
  expect(waybillStage(delivery(), created, points)).toBe('created')
  expect(
    waybillStage(
      delivery({ dispatchedAt: '2026-10-26T08:10:00Z' }),
      created,
      points,
    ),
  ).toBe('sent')
  expect(
    waybillStage(
      delivery(),
      { ...created, receivedAt: '2026-10-27T10:00:00Z' },
      points,
    ),
  ).toBe('received')
})

it('marks a draft whose dispatch point was retired by new settings (2.9)', () => {
  expect(waybillStage(delivery(), shipment(), ['point-2'])).toBe('draftStale')
  // A failed points read is not a retired point.
  expect(waybillStage(delivery(), shipment(), [])).toBe('draft')
})

it('writes recipient, route and parcel the way the block shows them', () => {
  const value = shipment()
  expect(contactLine(value.draft.recipient)).toBe(
    'Ірина Коваль · +380 67 214 55 08',
  )
  expect(routeLine(value.sender, value.draft.recipient)).toBe(
    'Київ №12 → Львів №5',
  )
  expect(
    routeLine(value.sender, { ...value.draft.recipient, warehouseName: null }),
  ).toBe('Київ №12 → —')
  expect(parcelLine(value.draft.parcels, 'uk')).toBe('1 місце · 4,2 кг')
})

it('turns pieces, weight and dimensions into Core parcels and back', () => {
  expect(parseDimensions('60×40×30')).toEqual({
    lengthCm: 60,
    widthCm: 40,
    heightCm: 30,
  })
  expect(parseDimensions('60 x 40 x 30')).not.toBeNull()
  expect(parseDimensions('60×40')).toBeNull()
  expect(parseDimensions('60×0×30')).toBeNull()
  const parcels = parcelsFrom(2, 9, { lengthCm: 60, widthCm: 40, heightCm: 30 })
  expect(parcels).toHaveLength(2)
  expect(parcels[0]?.weightKg).toBe(4.5)
  expect(parcelLine(parcels, 'uk')).toBe('2 місця · 9 кг')
})

it('keeps a quote fresh for 24 hours only', () => {
  const now = Date.parse('2026-10-25T20:00:00Z')
  expect(quoteFresh(shipment({ quoteAt: '2026-10-25T19:52:00Z' }), now)).toBe(
    true,
  )
  expect(quoteFresh(shipment({ quoteAt: '2026-10-24T19:00:00Z' }), now)).toBe(
    false,
  )
  expect(quoteFresh(shipment(), now)).toBe(false)
})

it('compares an external waybill with the order without changing it (6.8–6.9)', () => {
  const draft = shipment().draft
  expect(previewMismatch(preview(), draft, delivery())).toEqual({
    recipient: false,
    cod: false,
  })
  expect(
    previewMismatch(
      preview({
        recipient: { ...draft.recipient, name: 'Ірина Ковальчук' },
        codAmountUah: 4000,
      }),
      draft,
      delivery(),
    ),
  ).toEqual({ recipient: true, cod: true })
  // A received parcel may carry the post-payment already recorded.
  expect(
    previewMismatch(
      preview({ codAmountUah: 4000, recordsReceipt: true }),
      draft,
      delivery(),
    ).cod,
  ).toBe(false)
  expect(
    previewIncomplete(
      preview({ recipient: { ...draft.recipient, warehouseRef: '' } }),
    ),
  ).toBe(true)
})
