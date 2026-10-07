import { describe, expect, it } from 'vitest'
import {
  customerPhoneForSave,
  displayCustomerPhone,
  isCustomerPhoneAcceptable,
  normalizeCustomerPhoneDraft,
  newCustomerPhoneDraft,
} from './customer-phone'

describe('customer phone draft', () => {
  it('starts a new number with the business country code', () => {
    expect(newCustomerPhoneDraft()).toBe('+380')
    expect(newCustomerPhoneDraft('GB')).toBe('+44')
    expect(newCustomerPhoneDraft('PL')).toBe('+48')
  })

  it('keeps what was typed, dropping only characters a phone cannot have', () => {
    expect(normalizeCustomerPhoneDraft('+380 50 111-22-33')).toBe(
      '+380 50 111-22-33',
    )
    expect(normalizeCustomerPhoneDraft('501112233')).toBe('501112233')
    expect(normalizeCustomerPhoneDraft('+380 50 abc')).toBe('+380 50 ')
    expect(normalizeCustomerPhoneDraft('')).toBe('')
  })

  it('drops a trunk zero typed straight after the prefilled code', () => {
    expect(normalizeCustomerPhoneDraft('+3800777123444')).toBe('+380777123444')
    expect(normalizeCustomerPhoneDraft('+4407700900123')).toBe('+447700900123')
  })

  it('starts over when a full international number is typed after the code', () => {
    expect(normalizeCustomerPhoneDraft('+380+49 30 1234567')).toBe(
      '+49 30 1234567',
    )
    expect(normalizeCustomerPhoneDraft('+380380501112233')).toBe(
      '+380501112233',
    )
  })

  it('never trims a long number to a Ukrainian length', () => {
    expect(normalizeCustomerPhoneDraft('+380777123444444')).toBe(
      '+380777123444444',
    )
  })
})

describe('customer phone for save', () => {
  it('still turns a Ukrainian number into +380…', () => {
    expect(customerPhoneForSave('050 111 22 33')).toBe('+380501112233')
    expect(customerPhoneForSave('+380 50 111 22 33')).toBe('+380501112233')
    expect(customerPhoneForSave('+3800501112233')).toBe('+380501112233')
  })

  it('keeps British, Polish and German numbers as typed', () => {
    expect(customerPhoneForSave('+44 7700 900123')).toBe('+447700900123')
    expect(customerPhoneForSave('+48 512 345 678')).toBe('+48512345678')
    expect(customerPhoneForSave('+49 30 1234567')).toBe('+49301234567')
    expect(customerPhoneForSave('0049 30 1234567')).toBe('+49301234567')
  })

  it('reads a national number in the business country', () => {
    expect(customerPhoneForSave('07700 900123', 'GB')).toBe('+447700900123')
    expect(customerPhoneForSave('512 345 678', 'PL')).toBe('+48512345678')
  })

  it('treats an empty field or a bare dial code as no phone', () => {
    expect(customerPhoneForSave('')).toBeNull()
    expect(customerPhoneForSave('+380')).toBeNull()
    expect(customerPhoneForSave('+44 ', 'GB')).toBeNull()
  })

  it('accepts foreign numbers and rejects incomplete ones', () => {
    expect(isCustomerPhoneAcceptable('')).toBe(true)
    expect(isCustomerPhoneAcceptable('+380')).toBe(true)
    expect(isCustomerPhoneAcceptable('+49 30 1234567')).toBe(true)
    expect(isCustomerPhoneAcceptable('+44 7700 900123')).toBe(true)
    expect(isCustomerPhoneAcceptable('+38050111223')).toBe(false)
    expect(isCustomerPhoneAcceptable('+49 30')).toBe(false)
  })
})

describe('customer phone display', () => {
  it('groups E.164 numbers and leaves older records as stored', () => {
    expect(displayCustomerPhone('+380501112233')).toBe('+380 50 111 22 33')
    expect(displayCustomerPhone('+447700900123')).toBe('+44 7700 900123')
    expect(displayCustomerPhone('+49301234567')).toBe('+49301234567')
    expect(displayCustomerPhone('050 111 22 33')).toBe('050 111 22 33')
  })
})
