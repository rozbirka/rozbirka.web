import type { CustomerAddress, CustomerAddressField } from '@/api/customers'
import { intlLocale, type Locale } from '@/i18n'

/** Business countries first: most customers live there. */
const FIRST_COUNTRIES = ['UA', 'GB', 'PL'] as const

/**
 * Other countries a buyer of used parts most often comes from (neighbours,
 * the EU, the diaspora). A stored code outside this list is still offered,
 * so editing never drops it.
 */
const OTHER_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'CA',
  'CH',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GE',
  'GR',
  'HR',
  'HU',
  'IE',
  'IL',
  'IT',
  'LT',
  'LU',
  'LV',
  'MD',
  'NL',
  'NO',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'TR',
  'US',
] as const

const displayNames = new Map<Locale, Intl.DisplayNames | null>()

/** Country name in the interface language; the code itself if unknown. */
export function countryName(code: string, locale: Locale): string {
  let names = displayNames.get(locale)
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([intlLocale(locale)], { type: 'region' })
    } catch {
      names = null
    }
    displayNames.set(locale, names)
  }
  try {
    return names?.of(code) ?? code
  } catch {
    return code
  }
}

export interface CountryOption {
  code: string
  name: string
}

/**
 * Countries for the address select: UA, GB, PL, then the rest alphabetically
 * in the interface language. `current` is added when it is not listed.
 */
export function customerCountryOptions(
  locale: Locale,
  current: string | null = null,
): CountryOption[] {
  const others: string[] = [...OTHER_COUNTRIES]
  if (
    current !== null &&
    current !== '' &&
    !(FIRST_COUNTRIES as readonly string[]).includes(current) &&
    !others.includes(current)
  )
    others.push(current)
  const option = (code: string) => ({ code, name: countryName(code, locale) })
  return [
    ...FIRST_COUNTRIES.map(option),
    ...others
      .map(option)
      .sort((left, right) =>
        left.name.localeCompare(right.name, intlLocale(locale)),
      ),
  ]
}

/** Form state of the address: every field a string, `''` when not set. */
export type CustomerAddressDraft = Record<CustomerAddressField, string>

export const customerAddressDraft = (
  address: Partial<CustomerAddress>,
): CustomerAddressDraft => ({
  countryCode: address.countryCode ?? '',
  city: address.city ?? '',
  street: address.street ?? '',
  building: address.building ?? '',
  postcode: address.postcode ?? '',
})

/**
 * The address as reading lines — street and building, postcode and city,
 * country — skipping what is not set. Empty when nothing is set.
 */
export function customerAddressLines(
  address: Partial<CustomerAddress>,
  locale: Locale,
): string[] {
  const join = (separator: string, ...parts: (string | null | undefined)[]) =>
    parts.filter((part): part is string => Boolean(part)).join(separator)
  return [
    join(', ', address.street, address.building),
    join(' ', address.postcode, address.city),
    address.countryCode ? countryName(address.countryCode, locale) : '',
  ].filter((line) => line !== '')
}
