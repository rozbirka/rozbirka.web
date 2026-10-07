import { describe, expect, it } from 'vitest'
import {
  formatPhone,
  isValidContactPhone,
  isValidSignInPhone,
  normalizePhone,
  phoneCountry,
} from './phone'

describe('phone', () => {
  it('normalizes Ukrainian, British and Polish input to the same E.164', () => {
    for (const input of [
      '+380 67 123 45 67',
      '0671234567',
      '380671234567',
      '80671234567',
      '00380671234567',
    ]) {
      expect(normalizePhone(input, 'UA')).toBe('+380671234567')
    }
    for (const input of [
      '+44 7700 900123',
      '07700 900123',
      '0044 7700900123',
    ]) {
      expect(normalizePhone(input, 'GB')).toBe('+447700900123')
    }
    expect(normalizePhone('512 345 678', 'PL')).toBe('+48512345678')
    expect(normalizePhone('+48 512-345-678', 'UA')).toBe('+48512345678')
  })

  it('never rewrites an international number with +380 or trims it', () => {
    expect(normalizePhone('+49 1512 3456789', 'UA')).toBe('+4915123456789')
    expect(normalizePhone('+44 7700 900123', 'UA')).toBe('+447700900123')
  })

  it('validates sign-in numbers for the three countries only', () => {
    expect(isValidSignInPhone('+380671234567')).toBe(true)
    expect(isValidSignInPhone('+447700900123')).toBe(true)
    expect(isValidSignInPhone('+48512345678')).toBe(true)
    expect(isValidSignInPhone('+38067123456')).toBe(false)
    expect(isValidSignInPhone('+4915123456789')).toBe(false)
  })

  it('accepts other countries for customer contacts', () => {
    expect(isValidContactPhone('+4915123456789')).toBe(true)
    expect(isValidContactPhone('+12025550123')).toBe(true)
    expect(isValidContactPhone('+3806712')).toBe(false)
    expect(isValidContactPhone('+1234')).toBe(false)
  })

  it('groups numbers for display', () => {
    expect(formatPhone('+380671234567')).toBe('+380 67 123 45 67')
    expect(formatPhone('+447700900123')).toBe('+44 7700 900123')
    expect(formatPhone('+48512345678')).toBe('+48 512 345 678')
    expect(formatPhone('+4915123456789')).toBe('+4915123456789')
    expect(phoneCountry('+48512345678')).toBe('PL')
  })
})
