import { describe, expect, it } from 'vitest'
import {
  amountPrecisionError,
  amountPrecisionProblem,
  BATCH_COST_LIMIT,
} from './amount-precision'

describe('Core currency precision, mirrored', () => {
  it('accepts at most two decimals and refuses a third, never rounding', () => {
    expect(amountPrecisionProblem(12.5, 'USD')).toBeNull()
    expect(amountPrecisionProblem(12.55, 'UAH')).toBeNull()
    expect(amountPrecisionProblem(0.1 + 0.2, 'EUR')).toEqual({
      kind: 'precision',
      currency: 'EUR',
      digits: 2,
    })
    expect(amountPrecisionProblem(12.555, 'pln')).toEqual({
      kind: 'precision',
      currency: 'PLN',
      digits: 2,
    })
  })

  it('takes yen only in whole units', () => {
    expect(amountPrecisionProblem(1500, 'JPY')).toBeNull()
    expect(amountPrecisionProblem(1500.5, 'JPY')).toMatchObject({
      kind: 'precision',
      digits: 0,
    })
  })

  it('caps the magnitude like Core’s check constraints', () => {
    expect(amountPrecisionProblem(9_999_999_999.99, 'USD')).toBeNull()
    expect(amountPrecisionProblem(1e10, 'USD')).toEqual({
      kind: 'too-large',
      currency: 'USD',
    })
    expect(
      amountPrecisionProblem(1e12, 'USD', { limit: BATCH_COST_LIMIT }),
    ).toBeNull()
  })

  it('checks only the magnitude without a currency', () => {
    expect(amountPrecisionProblem(1.23456, null)).toBeNull()
  })

  it('explains the problem in the interface language', () => {
    expect(amountPrecisionError(1.234, 'USD', 'uk')).toBe(
      'Для USD — не більше двох знаків після коми.',
    )
    expect(amountPrecisionError(1.5, 'JPY', 'en-GB')).toBe(
      'Amounts in JPY must be whole numbers.',
    )
    expect(amountPrecisionError(1.234, 'GBP', 'pl')).toBe(
      'Dla GBP podaj najwyżej dwa miejsca po przecinku.',
    )
    expect(amountPrecisionError(12.5, 'GBP', 'pl')).toBeNull()
  })
})
