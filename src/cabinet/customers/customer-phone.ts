import {
  formatPhone,
  isValidContactPhone,
  normalizePhone,
  phoneDialCode,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from '@/lib/phone'

/**
 * Customer contact phones (REQ-LOCALIZATION AC-20/AC-31). A customer may have
 * a number from any country: a number typed with `+` or `00` is kept as typed,
 * a national number gets the business country's code. Nothing here rewrites a
 * foreign number with +380 or trims it to a Ukrainian length; Core validates
 * the result with libphonenumber.
 */

/**
 * What a new phone field starts with: the business country's dial code, so a
 * local number can be typed straight after it. Delete it to type another
 * country's number.
 */
export const newCustomerPhoneDraft = (country: PhoneCountry = 'UA') =>
  phoneDialCode(country)

/** Dial codes of countries whose national numbers carry a trunk `0`. */
const TRUNK_DIAL_CODES = ['380', '44']

/**
 * Light cleanup while typing: only digits, spaces, brackets, dashes and one
 * leading `+` survive, and a trunk `0` typed right after the prefilled
 * +380/+44 is dropped (`+3800…` → `+380…`). Never adds a country code to a
 * number without one and never trims digits.
 */
export const normalizeCustomerPhoneDraft = (value: string) => {
  // A `+` typed or pasted after the prefilled code starts a new number.
  const lastPlus = value.lastIndexOf('+')
  const source = lastPlus > 0 ? value.slice(lastPlus) : value
  const leadingPlus = source.trimStart().startsWith('+')
  const cleaned = source.replace(/[^\d\s()-]/g, '').slice(0, 32)
  let draft = leadingPlus ? `+${cleaned.trimStart()}` : cleaned
  // A full Ukrainian number pasted without `+` after the prefilled +380.
  if (draft.startsWith('+380380')) draft = `+380${draft.slice(7)}`
  for (const dial of TRUNK_DIAL_CODES)
    if (draft.startsWith(`+${dial}0`))
      return `+${dial}${draft.slice(dial.length + 2)}`
  return draft
}

const isDialCodeOnly = (digits: string) =>
  PHONE_COUNTRIES.some((country) => phoneDialCode(country).slice(1) === digits)

/**
 * The E.164 number to save, or `null` when nothing beyond a bare dial code
 * was typed. `country` is the business country, used for national numbers.
 */
export function customerPhoneForSave(
  value: string,
  country: PhoneCountry = 'UA',
): string | null {
  const digits = value.replace(/\D/g, '')
  if (digits === '' || isDialCodeOnly(digits)) return null
  const e164 = normalizePhone(value, country)
  for (const dial of TRUNK_DIAL_CODES)
    if (e164.startsWith(`+${dial}0`))
      return `+${dial}${e164.slice(dial.length + 2)}`
  return e164
}

/** `true` when the field is empty or holds a plausible international number. */
export function isCustomerPhoneAcceptable(
  value: string,
  country: PhoneCountry = 'UA',
): boolean {
  const e164 = customerPhoneForSave(value, country)
  return e164 === null || isValidContactPhone(e164)
}

/**
 * A stored phone for reading: E.164 is grouped (`+44 7700 900123`), anything
 * else (older records) is shown exactly as stored.
 */
export const displayCustomerPhone = (phone: string) =>
  /^\+\d+$/.test(phone.replace(/[\s()-]/g, '')) ? formatPhone(phone) : phone
