import type { Locale } from './locales'

/**
 * Currencies Core accepts as a tenant's accounting currency (Core `Currency`
 * enum, appended in order). The ISO code is never translated.
 */
export const SUPPORTED_CURRENCIES = [
  'UAH',
  'USD',
  'EUR',
  'PLN',
  'GBP',
  'CZK',
  'CHF',
  'CAD',
  'TRY',
  'JPY',
] as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export interface CurrencyInfo {
  code: SupportedCurrency
  /** Minor-unit digits shown for amounts (ISO 4217); JPY has none. */
  fractionDigits: number
  names: Readonly<Record<Locale, string>>
}

const CATALOG: Readonly<Record<SupportedCurrency, CurrencyInfo>> = {
  UAH: {
    code: 'UAH',
    fractionDigits: 2,
    names: {
      uk: 'Українська гривня',
      'en-GB': 'Ukrainian hryvnia',
      pl: 'hrywna ukraińska',
    },
  },
  USD: {
    code: 'USD',
    fractionDigits: 2,
    names: { uk: 'Долар США', 'en-GB': 'US dollar', pl: 'dolar amerykański' },
  },
  EUR: {
    code: 'EUR',
    fractionDigits: 2,
    names: { uk: 'Євро', 'en-GB': 'Euro', pl: 'euro' },
  },
  PLN: {
    code: 'PLN',
    fractionDigits: 2,
    names: {
      uk: 'Польський злотий',
      'en-GB': 'Polish złoty',
      pl: 'złoty polski',
    },
  },
  GBP: {
    code: 'GBP',
    fractionDigits: 2,
    names: {
      uk: 'Фунт стерлінгів',
      'en-GB': 'Pound sterling',
      pl: 'funt szterling',
    },
  },
  CZK: {
    code: 'CZK',
    fractionDigits: 2,
    names: { uk: 'Чеська крона', 'en-GB': 'Czech koruna', pl: 'korona czeska' },
  },
  CHF: {
    code: 'CHF',
    fractionDigits: 2,
    names: {
      uk: 'Швейцарський франк',
      'en-GB': 'Swiss franc',
      pl: 'frank szwajcarski',
    },
  },
  CAD: {
    code: 'CAD',
    fractionDigits: 2,
    names: {
      uk: 'Канадський долар',
      'en-GB': 'Canadian dollar',
      pl: 'dolar kanadyjski',
    },
  },
  TRY: {
    code: 'TRY',
    fractionDigits: 2,
    names: { uk: 'Турецька ліра', 'en-GB': 'Turkish lira', pl: 'lira turecka' },
  },
  JPY: {
    code: 'JPY',
    fractionDigits: 0,
    names: { uk: 'Японська єна', 'en-GB': 'Japanese yen', pl: 'jen japoński' },
  },
}

/**
 * Narrow an API value to a supported currency. Core serialises enums in
 * camelCase (`uah`) in places and upper case in others, so the comparison
 * ignores case; anything else is unsupported, never coerced.
 */
export function parseCurrency(value: unknown): SupportedCurrency | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return isSupportedCurrency(code) ? code : null
}

export function isSupportedCurrency(
  value: unknown,
): value is SupportedCurrency {
  return (
    typeof value === 'string' &&
    (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  )
}

export function currencyInfo(code: SupportedCurrency): CurrencyInfo {
  return CATALOG[code]
}

export function currencyName(code: SupportedCurrency, locale: Locale): string {
  return CATALOG[code].names[locale]
}

/**
 * Digits after the decimal separator for `currency`. Unknown codes use the
 * `Intl` ISO 4217 data, then 2.
 */
export function currencyFractionDigits(currency: string): number {
  const supported = parseCurrency(currency)
  if (supported) return CATALOG[supported].fractionDigits
  try {
    return (
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    )
  } catch {
    return 2
  }
}

const normalizeSearch = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')

/**
 * Currencies matching `query` by ISO code or by name in the given locale
 * (any word prefix, accent-insensitive: «зл», «pl», «фунт», «zloty»). Code
 * matches come first; an empty query returns the full list in catalog order.
 */
export function searchCurrencies(
  query: string,
  locale: Locale,
): CurrencyInfo[] {
  const needle = normalizeSearch(query)
  const all = SUPPORTED_CURRENCIES.map((code) => CATALOG[code])
  if (!needle) return all
  const byCode = all.filter((info) =>
    info.code.toLowerCase().startsWith(needle),
  )
  const byName = all.filter((info) => {
    if (byCode.includes(info)) return false
    const name = normalizeSearch(info.names[locale])
    return (
      name.startsWith(needle) ||
      name.split(/\s+/).some((word) => word.startsWith(needle))
    )
  })
  return [...byCode, ...byName]
}
