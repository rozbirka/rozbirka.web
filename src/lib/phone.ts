/**
 * Phone numbers for Ukraine, the United Kingdom and Poland (sign-in by SMS
 * and the default for customer contacts) plus any other international
 * number for customer contacts (REQ-LOCALIZATION AC-20/AC-31/AC-32).
 *
 * The server stays authoritative (libphonenumber in Identity/Core); this
 * keeps the browser from rewriting a foreign number with +380 or cutting it
 * to a Ukrainian length, and catches obvious mistakes before a request.
 */

export const PHONE_COUNTRIES = ['UA', 'GB', 'PL'] as const
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]

interface CountryRule {
  dial: string
  /** Digits after the country code. */
  lengths: readonly number[]
  /** National numbers written with a leading trunk 0. */
  trunk: boolean
  /** Digit groups after the country code, for display. */
  groups: readonly number[]
  example: string
}

const RULES: Readonly<Record<PhoneCountry, CountryRule>> = {
  UA: {
    dial: '380',
    lengths: [9],
    trunk: true,
    groups: [2, 3, 2, 2],
    example: '+380 67 123 45 67',
  },
  GB: {
    dial: '44',
    lengths: [10],
    trunk: true,
    groups: [4, 6],
    example: '+44 7700 900123',
  },
  PL: {
    dial: '48',
    lengths: [9],
    trunk: false,
    groups: [3, 3, 3],
    example: '+48 512 345 678',
  },
}

export function phoneDialCode(country: PhoneCountry): string {
  return `+${RULES[country].dial}`
}

export function phoneExample(country: PhoneCountry): string {
  return RULES[country].example
}

export function isPhoneCountry(value: unknown): value is PhoneCountry {
  return (
    typeof value === 'string' &&
    (PHONE_COUNTRIES as readonly string[]).includes(value)
  )
}

/** Country of an E.164 number among UA/GB/PL, or `null`. */
export function phoneCountry(e164: string): PhoneCountry | null {
  const digits = e164.replace(/\D/g, '')
  for (const country of PHONE_COUNTRIES) {
    if (digits.startsWith(RULES[country].dial)) return country
  }
  return null
}

/**
 * Best-effort E.164 for what was typed. An explicit `+` or `00` keeps the
 * number international as typed; otherwise the default country's code is
 * added, dropping a trunk `0` (and the legacy Ukrainian `80…`). Returns `''`
 * for empty input. Never trims digits.
 */
export function normalizePhone(
  input: string,
  defaultCountry: PhoneCountry = 'UA',
): string {
  const trimmed = input.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  const international = trimmed.startsWith('+') || digits.startsWith('00')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (international) return `+${digits}`

  const rule = RULES[defaultCountry]
  if (
    digits.startsWith(rule.dial) &&
    rule.lengths.includes(digits.length - rule.dial.length)
  )
    return `+${digits}`
  if (
    defaultCountry === 'UA' &&
    digits.startsWith('80') &&
    digits.length === 11
  )
    return `+3${digits}`
  if (rule.trunk && digits.startsWith('0')) digits = digits.slice(1)
  return `+${rule.dial}${digits}`
}

/** A complete number for one of the sign-in countries (UA, GB, PL). */
export function isValidSignInPhone(e164: string): boolean {
  if (!/^\+\d+$/.test(e164)) return false
  const country = phoneCountry(e164)
  if (!country) return false
  const rule = RULES[country]
  const national = e164.slice(1 + rule.dial.length)
  if (!rule.lengths.includes(national.length)) return false
  if (rule.trunk && national.startsWith('0')) return false
  return true
}

/**
 * A plausible international number for a customer contact: the UA/GB/PL
 * rules when it is one of those, otherwise 8–15 digits (E.164 maximum).
 */
export function isValidContactPhone(e164: string): boolean {
  if (!/^\+[1-9]\d+$/.test(e164)) return false
  if (phoneCountry(e164)) return isValidSignInPhone(e164)
  const length = e164.length - 1
  return length >= 8 && length <= 15
}

/**
 * Grouped display of an E.164 number (`+44 7700 900123`); other countries
 * and incomplete numbers are shown as `+digits` without guessing groups.
 */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (!digits) return ''
  const country = phoneCountry(`+${digits}`)
  if (!country) return `+${digits}`
  const rule = RULES[country]
  let rest = digits.slice(rule.dial.length)
  const parts = [`+${rule.dial}`]
  for (const size of rule.groups) {
    if (!rest) break
    parts.push(rest.slice(0, size))
    rest = rest.slice(size)
  }
  if (rest) parts.push(rest)
  return parts.join(' ')
}

/** Sign-in country to preselect for an interface locale. */
export function phoneCountryForLocale(locale: string): PhoneCountry {
  if (locale === 'en-GB') return 'GB'
  if (locale === 'pl') return 'PL'
  return 'UA'
}
