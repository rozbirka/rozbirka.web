import { describe, expect, it } from 'vitest'
import {
  normalizeCustomerPhoneDraft,
  newCustomerPhoneDraft,
} from './customer-phone'

describe('customer phone draft', () => {
  it('starts every new Ukrainian customer number with the country prefix', () => {
    expect(newCustomerPhoneDraft()).toBe('+380')
  })

  it('preserves the country prefix while the local digits are edited', () => {
    expect(normalizeCustomerPhoneDraft('501112233')).toBe('+380501112233')
    expect(normalizeCustomerPhoneDraft('')).toBe('+380')
    expect(normalizeCustomerPhoneDraft('+380 50 111 22 33')).toBe(
      '+380501112233',
    )
  })

  it('limits a Ukrainian number to ten local digits including the leading zero', () => {
    expect(normalizeCustomerPhoneDraft('0777123444')).toBe('+380777123444')
    expect(normalizeCustomerPhoneDraft('+380777123444444')).toBe(
      '+380777123444',
    )
  })
})
