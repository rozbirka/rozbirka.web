import { expect, it } from 'vitest'
import type { DeliveryOrder, DeliveryPayment } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'
import {
  lifecycle,
  orderChip,
  paymentStanding,
  readiness,
  readinessBlocks,
  readinessNextStep,
  readinessPassed,
  shipmentChip,
} from './delivery-view'

const payment = (over: Partial<DeliveryPayment> = {}): DeliveryPayment => ({
  id: 'pay-1',
  accountId: 'till-1',
  amountUah: 4600,
  feeUah: 0,
  netUah: 4600,
  kind: 'prepayment',
  recordedBy: 'Дмитро',
  createdAt: '2026-09-21T11:02:00Z',
  refundedAt: null,
  ...over,
})

const delivery = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
  orderId: 'order-1',
  agreedTotalUah: 4600,
  appliedUah: 4600,
  outstandingUah: 0,
  netReceivedUah: 4600,
  feesUah: 0,
  requiredDepositUah: 360,
  depositShortfallUah: 0,
  depositSatisfied: true,
  depositWaived: false,
  depositRequired: true,
  customerTrusted: false,
  dispatchedAt: null,
  receivedAt: null,
  returnedAt: null,
  awaitingCodReconciliation: false,
  payments: [payment()],
  workflowState: 'Open',
  refundDueUah: 0,
  refundAllocations: [],
  ...over,
})

const shipment = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'ship-1',
  integrationId: 'int-1',
  dispatchPointId: 'point-1',
  orderId: 'order-1',
  state: 'Created',
  number: '20451931 5540',
  sender: {
    name: 'Склад',
    phone: '+380',
    warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
    settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
  },
  draft: {
    recipient: {
      name: 'Ірина Олійник',
      phone: '+380503381172',
      warehouseRef: '1ec09d2e-e1c2-11e3-8c4a-0050568002d0',
      settlementRef: '8d5a980d-391c-11dd-90d9-001a92567626',
    },
    parcels: [{ lengthCm: 60, widthCm: 40, heightCm: 35, weightKg: 42 }],
    declaredValueUah: 4600,
    payerType: 'Recipient',
    description: 'Запчастини',
  },
  quoteUah: 180,
  returnEstimateUah: 180,
  codUah: 0,
  quoteAt: new Date().toISOString(),
  trackingCode: null,
  trackingStatus: null,
  lastTrackedAt: null,
  relatedNumbers: [],
  connectionId: null,
  version: 'v1',
  dispatchedAt: null,
  receivedAt: null,
  paymentState: null,
  syncProblem: null,
  trackingEnabled: true,
  events: [
    {
      code: 'Created',
      name: 'Створено',
      occurredAt: null,
      recordedAt: '2026-09-21T11:12:00Z',
    },
  ],
  ...over,
})

it('walks the lifecycle in Core order and marks the furthest step reached', () => {
  const steps = lifecycle(
    delivery({ dispatchedAt: '2026-09-22T08:04:00Z' }),
    shipment(),
    'uk',
  )

  expect(steps.map((step) => [step.label, step.done, step.current])).toEqual([
    ['Оплачено', true, false],
    ['ТТН', true, false],
    ['Передано перевізнику', true, true],
    ['Отримано', false, false],
  ])
  // Stamped in the business time zone (Kyiv, UTC+3 in September).
  expect(steps[0]?.meta).toBe('21.09 · 14:02')
  expect(steps[3]?.meta).toBe('')
})

it('does not call an order paid while anything is still owed', () => {
  const steps = lifecycle(delivery({ outstandingUah: 1200 }), null, 'uk')

  expect(steps[0]).toMatchObject({ done: false, meta: '' })
  expect(steps[0]?.current).toBe(false)
})

it.each([
  { depositRequired: true, customerTrusted: true, depositWaived: true },
  { depositRequired: false, customerTrusted: false, depositWaived: false },
])(
  'completes the first milestone without inventing payment when no prepayment is required: %j',
  (policy) => {
    const unpaid = delivery({
      ...policy,
      appliedUah: 0,
      outstandingUah: 4600,
      netReceivedUah: 0,
      payments: [],
    })
    expect(lifecycle(unpaid, shipment(), 'uk')[0]).toMatchObject({
      label: 'Без передоплати',
      done: true,
      meta: '',
      prepaymentNotRequired: true,
    })
    expect(paymentStanding(unpaid, 'uk').label).toBe('Не оплачено')
    expect(unpaid.outstandingUah).toBe(4600)
    expect(unpaid.payments).toEqual([])
  },
)

it.each([
  { customerTrusted: false, depositWaived: true },
  { customerTrusted: true, depositWaived: false },
])(
  'does not complete the first milestone for an inactive exception: %j',
  (policy) => {
    const unpaid = delivery({
      ...policy,
      appliedUah: 0,
      outstandingUah: 4600,
      netReceivedUah: 0,
      payments: [],
    })
    expect(lifecycle(unpaid, shipment(), 'uk')[0]).toMatchObject({
      label: 'Оплачено',
      done: false,
      meta: '',
    })
  },
)

it('names the order and the parcel separately', () => {
  // Module 46: the order's pill follows Core's workflow state.
  expect(orderChip(delivery({ outstandingUah: 1200 }), 'uk').label).toBe(
    'Очікує',
  )
  expect(orderChip(delivery({ workflowState: 'Completed' }), 'uk')).toEqual({
    label: 'Підтверджено',
    tone: 'ok',
  })
  expect(
    orderChip(
      delivery({ workflowState: 'AwaitingGoods', dispatchedAt: 'x' }),
      'uk',
    ).label,
  ).toBe('Повернення')
  // Cancelling an order that never left is not a return (10.13).
  expect(
    orderChip(delivery({ workflowState: 'AwaitingRefund' }), 'uk').label,
  ).toBe('Очікує')
  expect(orderChip(delivery({ workflowState: 'Cancelled' }), 'uk').label).toBe(
    'Скасовано',
  )

  expect(shipmentChip(delivery(), null, 'uk').label).toBe('ТТН не створена')
  expect(shipmentChip(delivery(), shipment(), 'uk').label).toBe('ТТН створена')
  expect(
    shipmentChip(delivery({ dispatchedAt: 'x' }), shipment(), 'uk').label,
  ).toBe('Передано перевізнику')
})

it('does not treat an outstanding balance as an obstacle to a waybill', () => {
  const owing = readiness(
    delivery({ outstandingUah: 1200 }),
    shipment(),
    true,
    'uk',
  )

  expect(readinessPassed(owing)).toBe(true)
  expect(owing[0]).toMatchObject({
    label: 'Залишок поїде післяплатою',
    ok: true,
  })

  const ready = readiness(delivery(), shipment(), true, 'uk')
  expect(readinessPassed(ready)).toBe(true)
  // The route and the parcel are the carrier's call, not ours.
  expect(ready.at(-1)).toMatchObject({ deferred: true, ok: true })
})

it('does not report a deposit nobody has worked out as short by nothing', () => {
  // Before a carrier quote there is no deposit figure at all, and «бракує
  // 0,00 ₴» says the opposite of what is true.
  const checks = readiness(
    delivery({
      requiredDepositUah: 0,
      depositShortfallUah: 0,
      depositSatisfied: false,
    }),
    shipment(),
    true,
    'uk',
  )

  expect(checks.find((check) => check.key === 'deposit')).toMatchObject({
    state: 'зʼявиться після розрахунку',
    ok: false,
    // A figure nobody has worked out yet is a step ahead, not an obstacle:
    // the quote that produces it is taken on the very next screen.
    pending: true,
  })
  expect(readinessPassed(checks)).toBe(false)
  expect(readinessBlocks(checks)).toHaveLength(0)
})

it('lets a yard that asks for no deposit ship without one', () => {
  // The figure is still computed and shown; it simply stops standing in the way.
  const checks = readiness(
    delivery({
      depositRequired: false,
      requiredDepositUah: 400,
      depositSatisfied: false,
    }),
    shipment(),
    true,
    'uk',
  )

  expect(checks.find((check) => check.key === 'deposit')).toMatchObject({
    state: 'Розбірка відправляє без обов’язкової передоплати',
    ok: true,
  })
  expect(readinessBlocks(checks)).toHaveLength(0)
})

it('counts a stale carrier quote as a failed check', () => {
  const stale = readiness(
    delivery(),
    shipment({ quoteAt: '2026-01-01T00:00:00Z' }),
    true,
    'uk',
  )

  expect(stale.find((check) => check.key === 'quote')).toMatchObject({
    state: 'застарів — оновимо на наступному кроці',
    ok: false,
  })
  expect(readinessPassed(stale)).toBe(false)
  // Re-quoting happens in the booking drawer, so it cannot bar the way there.
  expect(readinessBlocks(stale)).toHaveLength(0)
})

it('keeps a fresh order out only when the fix lives somewhere else', () => {
  const fresh = readiness(delivery(), null, false, 'uk')

  // Nothing calculated, no deposit, no waybill — and still nothing blocking,
  // because all of that is done on the next screen.
  const blocked = readinessBlocks(fresh)
  expect(blocked.map((check) => check.key)).toEqual(['dispatch-point'])
  expect(readinessNextStep(fresh, 'uk').title).toBe(
    'Спершу треба виправити налаштування',
  )

  expect(readinessBlocks(readiness(delivery(), null, true, 'uk'))).toHaveLength(
    0,
  )
  expect(
    readinessNextStep(readiness(delivery(), null, true, 'uk'), 'uk').title,
  ).toBe('Наступний крок — розрахувати доставку')
})

it('leaves the payment stage incomplete when the hryvnia total is unset', () => {
  const unpriced = delivery({
    agreedTotalUah: 0,
    appliedUah: 0,
    outstandingUah: 0,
    payments: [],
  })
  expect(paymentStanding(unpriced, 'uk')).toEqual({
    label: 'Суму не визначено',
    tone: 'dim',
  })
  expect(lifecycle(unpriced, null, 'uk')[0]).toMatchObject({
    done: false,
    current: false,
    meta: '',
  })
})

it('does not call an untouched order partly paid', () => {
  // #284 in the yard's own data: agreed 4 000 ₴, not a hryvnia against it.
  expect(
    paymentStanding(
      delivery({ appliedUah: 0, outstandingUah: 4000, payments: [] }),
      'uk',
    ),
  ).toEqual({ label: 'Не оплачено', tone: 'dim' })

  expect(
    paymentStanding(delivery({ appliedUah: 1000, outstandingUah: 3000 }), 'uk'),
  ).toEqual({ label: 'Оплачено частково', tone: 'warn' })

  expect(paymentStanding(delivery(), 'uk')).toEqual({
    label: 'Оплачено повністю',
    tone: 'ok',
  })
})
