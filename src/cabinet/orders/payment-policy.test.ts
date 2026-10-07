import { describe, expect, it } from 'vitest'
import {
  choosePaymentCurrency,
  parseAmount,
  paymentRecorded,
  sumByCurrency,
  tillCurrencies,
} from './payment-policy'

describe('payment currency per till', () => {
  it('lists a till’s currencies in catalog order', () => {
    expect(tillCurrencies({ balances: { EUR: 1, UAH: 2, USD: 0 } })).toEqual([
      'UAH',
      'USD',
      'EUR',
    ])
  })

  it('keeps the currency when the new till takes it', () => {
    expect(choosePaymentCurrency('UAH', ['UAH', 'USD'])).toEqual({
      currency: 'UAH',
      reselectFrom: null,
    })
  })

  it('resets a dropped currency with the reason instead of relabelling', () => {
    expect(choosePaymentCurrency('EUR', ['UAH'])).toEqual({
      currency: null,
      reselectFrom: 'EUR',
    })
  })

  it('fixes the only currency of a till when nothing was chosen', () => {
    expect(choosePaymentCurrency(null, ['USD'])).toEqual({
      currency: 'USD',
      reselectFrom: null,
    })
    expect(choosePaymentCurrency(null, ['UAH', 'USD'])).toEqual({
      currency: null,
      reselectFrom: null,
    })
  })
})

describe('payment amounts', () => {
  it('reads comma and dot decimals and grouped digits', () => {
    expect(parseAmount('4 200')).toBe(4200)
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })

  it('sums per currency only', () => {
    expect(
      sumByCurrency([
        { amount: 100, currency: 'USD' },
        { amount: 4200, currency: 'UAH' },
        { amount: 50, currency: 'USD' },
      ]),
    ).toEqual([
      { currency: 'UAH', amount: 4200 },
      { currency: 'USD', amount: 150 },
    ])
  })

  it('settles an unknown outcome by counting matching payments', () => {
    const added = { accountId: 'till-1', amount: 4200, currency: 'UAH' }
    expect(paymentRecorded([], [added], added)).toBe(true)
    expect(paymentRecorded([added], [added], added)).toBe(false)
    expect(paymentRecorded([added], [added, added], added)).toBe(true)
  })
})
