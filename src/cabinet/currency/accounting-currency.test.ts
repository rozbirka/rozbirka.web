import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  accountingCurrencyStatus,
  currencySettingsView,
  isCurrencyLockedError,
  isCurrencyRequiredError,
  isOwnerRole,
  isPriceValue,
  isUnknownOutcome,
  priceGate,
  willLockCurrency,
} from './accounting-currency'
import { currencyReturnPath, currencySettingsHref } from './return-path'

const apiError = (
  status: number | undefined,
  code?: string,
  axiosCode?: string,
) => {
  const error = new AxiosError('failed', axiosCode)
  if (status !== undefined) {
    error.response = {
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: code ? { error: { code, message: code } } : {},
    }
  }
  return error
}

describe('accounting currency status', () => {
  it('never invents a currency', () => {
    expect(
      accountingCurrencyStatus({
        accountingCurrency: null,
        currencyLocked: false,
      }),
    ).toEqual({ kind: 'not-chosen' })
    // An older contract reports neither field: unknown, not USD.
    expect(
      accountingCurrencyStatus({
        accountingCurrency: null,
        currencyLocked: null,
      }),
    ).toEqual({ kind: 'unknown' })
    expect(
      accountingCurrencyStatus({
        accountingCurrency: 'GBP',
        currencyLocked: true,
      }),
    ).toEqual({ kind: 'chosen', currency: 'GBP', locked: true })
  })

  it('recognises the owner role whatever its casing', () => {
    expect(isOwnerRole('Owner')).toBe(true)
    expect(isOwnerRole('owner')).toBe(true)
    expect(isOwnerRole('manager')).toBe(false)
    expect(isOwnerRole(undefined)).toBe(false)
  })

  it('picks the settings view by lock and permission', () => {
    const chosen = (locked: boolean | null) =>
      ({ kind: 'chosen', currency: 'USD', locked }) as const
    expect(currencySettingsView({ kind: 'not-chosen' }, true)).toBe('choose')
    expect(currencySettingsView({ kind: 'not-chosen' }, false)).toBe(
      'read-only',
    )
    expect(currencySettingsView(chosen(false), true)).toBe('change')
    expect(currencySettingsView(chosen(false), false)).toBe('read-only')
    // Locked wins over ownership; an unreported lock is not offered as editable.
    expect(currencySettingsView(chosen(true), true)).toBe('locked')
    expect(currencySettingsView(chosen(null), true)).toBe('locked')
    expect(currencySettingsView({ kind: 'unknown' }, true)).toBe('unknown')
  })
})

describe('first price rules', () => {
  it('counts zero as a price and an empty field as none', () => {
    expect(isPriceValue('0')).toBe(true)
    expect(isPriceValue(0)).toBe(true)
    expect(isPriceValue('12,50')).toBe(true)
    expect(isPriceValue('')).toBe(false)
    expect(isPriceValue('   ')).toBe(false)
    expect(isPriceValue(null)).toBe(false)
    expect(isPriceValue('abc')).toBe(false)
  })

  it('warns about the lock only before the first price', () => {
    const open = { kind: 'chosen', currency: 'PLN', locked: false } as const
    expect(willLockCurrency(open, true)).toBe('PLN')
    expect(willLockCurrency(open, false)).toBeNull()
    expect(willLockCurrency({ ...open, locked: true }, true)).toBeNull()
    expect(willLockCurrency({ ...open, locked: null }, true)).toBeNull()
    expect(willLockCurrency({ kind: 'not-chosen' }, true)).toBeNull()
  })

  it('blocks price fields without a currency, by role', () => {
    expect(priceGate({ kind: 'not-chosen' }, true)).toEqual({
      kind: 'blocked',
      reason: 'choose',
    })
    expect(priceGate({ kind: 'not-chosen' }, false)).toEqual({
      kind: 'blocked',
      reason: 'ask-owner',
    })
    expect(
      priceGate({ kind: 'chosen', currency: 'JPY', locked: true }, false),
    ).toEqual({ kind: 'ready', currency: 'JPY' })
    expect(priceGate({ kind: 'unknown' }, false)).toEqual({ kind: 'legacy' })
  })
})

describe('write outcomes', () => {
  it('separates unknown outcomes from refusals', () => {
    expect(
      isUnknownOutcome(apiError(undefined, undefined, 'ERR_NETWORK')),
    ).toBe(true)
    expect(
      isUnknownOutcome(apiError(undefined, undefined, 'ECONNABORTED')),
    ).toBe(true)
    expect(isUnknownOutcome(apiError(400, 'INVALID_BUSINESS_SETTINGS'))).toBe(
      false,
    )
    expect(
      isCurrencyLockedError(apiError(409, 'BUSINESS_SETTINGS_LOCKED')),
    ).toBe(true)
    expect(
      isCurrencyRequiredError(apiError(400, 'ACCOUNTING_CURRENCY_REQUIRED')),
    ).toBe(true)
  })
})

describe('return to the price form', () => {
  it('only returns inside the same tenant cabinet', () => {
    const href = currencySettingsHref(
      '/app/koval/settings/business',
      '/app/koval/parts/new?car_id=c1',
    )
    const search = new URL(href, 'http://x.local').searchParams
    expect(currencyReturnPath(search, '/app/koval')).toBe(
      '/app/koval/parts/new?car_id=c1&draft=1',
    )
    expect(
      currencyReturnPath(
        new URLSearchParams({ return_to: '//evil.example/app/koval/x' }),
        '/app/koval',
      ),
    ).toBeNull()
    expect(
      currencyReturnPath(
        new URLSearchParams({ return_to: '/app/other/parts' }),
        '/app/koval',
      ),
    ).toBeNull()
  })
})
