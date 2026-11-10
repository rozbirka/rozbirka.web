import { describe, expect, it } from 'vitest'
import {
  cardPaymentSignal,
  deliverySignal,
  listCodNote,
  shortPlace,
  trackingSignal,
} from './waybill-presentation'

describe('waybill delivery signal', () => {
  it.each([
    ['Created', '1', null, 'Створено', 'info'],
    ['Created', '5', null, 'Прямує', 'info'],
    ['Created', '7', null, 'Прибула', 'info'],
    ['Created', '9', null, 'Підтверджено', 'ok'],
    ['Created', null, '2026-10-26T10:00:00Z', 'Підтверджено', 'ok'],
    ['Created', '102', null, 'Повернення відправнику', 'danger'],
    ['Created', '103', null, 'Відмова від отримання', 'warn'],
    ['Created', '103', '2026-10-26T10:00:00Z', 'Відмова від отримання', 'warn'],
    ['Cancelled', '1', null, 'Скасовано', 'neutral'],
    ['CancelUnknown', '1', null, 'Невідомо', 'warn'],
  ])('reads %s / code %s as %s', (state, code, receivedAt, label, tone) => {
    expect(deliverySignal(state, code, receivedAt, 'uk')).toEqual({
      label,
      tone,
    })
  })

  it.each(['104', '105', '106', '107', '111', '112', '999', 'new-code'])(
    'does not invent an ordinary delivery outcome for code %s',
    (code) => {
      expect(deliverySignal('Created', code, null, 'uk')).toEqual({
        label: 'Потребує уточнення',
        tone: 'neutral',
      })
    },
  )

  it('preserves an explicit receipt fact when a later code is unmapped', () => {
    expect(
      trackingSignal('Created', '999', '2026-11-06T10:00:00Z', 'uk'),
    ).toEqual({ label: 'Підтверджено', tone: 'ok' })
  })

  it.each([
    ['uk', 'Повернення відправнику', 'Відмова від отримання'],
    ['en-GB', 'Returning to sender', 'Delivery refused'],
    ['pl', 'Zwrot do nadawcy', 'Odmowa odbioru'],
  ] as const)(
    'distinguishes ordered returns from refusals in %s',
    (locale, returning, refused) => {
      expect(trackingSignal('Created', '102', null, locale)).toEqual({
        label: returning,
        tone: 'danger',
      })
      expect(trackingSignal('Created', '103', null, locale)).toEqual({
        label: refused,
        tone: 'warn',
      })
    },
  )

  it.each([
    ['uk', 'Чернетка'],
    ['en-GB', 'Draft'],
    ['pl', 'Szkic'],
  ] as const)('labels a draft delivery neutrally in %s', (locale, label) => {
    expect(deliverySignal('Draft', null, null, locale)).toEqual({
      label,
      tone: 'neutral',
    })
  })

  it('does not invent a carrier status for a draft or an unanswered create', () => {
    expect(trackingSignal('Draft', null, null, 'uk')).toBeNull()
    expect(trackingSignal('Unknown', null, null, 'uk')).toBeNull()
  })
})

describe('cash on delivery', () => {
  it('names the payout under the amount in the list', () => {
    expect(listCodNote('Created', 'Paid', 'uk')).toEqual({
      text: 'зараховано',
      tone: 'ok',
    })
    expect(listCodNote('Created', 'NeedsReconciliation', 'uk')).toEqual({
      text: 'потрібна звірка',
      tone: 'warn',
    })
    expect(listCodNote('Draft', 'NoCod', 'uk')).toEqual({
      text: 'не створено',
    })
  })

  it('tells paid from awaited on the card before any payout', () => {
    const created = { state: 'Created', paymentState: null, codUah: 4200 }
    expect(cardPaymentSignal(created, 4200, 'uk').label).toBe(
      'Очікуємо післяплату',
    )
    expect(cardPaymentSignal(created, 0, 'uk').label).toBe('Оплачено')
    expect(
      cardPaymentSignal({ ...created, paymentState: 'Reconciled' }, 0, 'uk'),
    ).toEqual({ label: 'Оплачено', tone: 'ok' })
  })
})

it('writes a branch the way the list does', () => {
  expect(
    shortPlace({
      name: '',
      phone: '',
      warehouseRef: 'w',
      settlementRef: 's',
      settlementName: 'м. Харків, Харківська обл.',
      warehouseName: 'Відділення №61: вул. Полтавський шлях, 1',
    }),
  ).toBe('Харків · №61')
})

it.each([
  ['uk', 'Утримано за доставку'],
  ['en-GB', 'Retained for delivery'],
  ['pl', 'Zatrzymano na dostawę'],
] as const)(
  'shows retained delivery costs separately from refunded COD in %s',
  (locale, label) => {
    expect(listCodNote('Created', 'DeliveryCostsRetained', locale)).toEqual({
      text: label,
    })
    expect(
      cardPaymentSignal(
        {
          state: 'Cancelled',
          paymentState: 'DeliveryCostsRetained',
          codUah: 0,
        },
        0,
        locale,
      ),
    ).toEqual({ label, tone: 'neutral' })
  },
)

it.each([
  ['LatePaymentNeedsRefund', 'Потрібне повернення'],
  ['LateRefundRequired', 'Потрібне повернення'],
  ['NeedsReconciliation', 'Потрібна звірка'],
  ['CashRegisterRequired', 'Внесіть вручну'],
  ['PermissionRequired', 'Внесіть вручну'],
])(
  'keeps late carrier payout %s visible after settling a return',
  (paymentState, label) => {
    expect(
      cardPaymentSignal(
        { state: 'Created', paymentState, codUah: 200 },
        0,
        'uk',
        {
          workflowState: 'Cancelled',
          refundDueUah: 0,
          retainedDeliveryCostUah: 186,
          refundAllocations: [],
        },
      ),
    ).toEqual({ label, tone: 'warn' })
  },
)
