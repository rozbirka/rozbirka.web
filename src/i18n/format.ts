import { currencyFractionDigits } from './currencies'
import { intlLocale, type Locale } from './locales'

/** Business time zone when the tenant has not told us its own. */
export const DEFAULT_TIME_ZONE = 'Europe/Kyiv'

const formatterCache = new Map<
  string,
  Intl.NumberFormat | Intl.DateTimeFormat
>()

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(
  key: string,
  create: () => T,
): T {
  let formatter = formatterCache.get(key) as T | undefined
  if (!formatter) {
    formatter = create()
    formatterCache.set(key, formatter)
  }
  return formatter
}

/** `true` when `Intl` knows the IANA zone; invalid zones fall back to Kyiv. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}

function safeTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(numeric) ? numeric : null
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date
}

/**
 * Locale number format (grouping and decimal separator from the locale; Polish
 * leaves four-digit numbers ungrouped). `null` for a missing or non-numeric
 * value so callers choose their own placeholder.
 */
export function formatNumber(
  value: number | string | null | undefined,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string | null {
  const numeric = toNumber(value)
  if (numeric === null) return null
  return cached(
    `n|${locale}|${JSON.stringify(options)}`,
    () => new Intl.NumberFormat(intlLocale(locale), options),
  ).format(numeric)
}

export interface MoneyFormatOptions {
  /** Override the currency precision (e.g. whole units on a dashboard). */
  fractionDigits?: number
}

/**
 * Amount with its ISO code after the number in every locale
 * (`12 480,00 USD`, `12,480.00 USD`, `12 480,00 USD`). Precision follows the
 * currency (JPY has none). Symbols like `$` are deliberately not used: CAD and
 * USD share one. A missing currency returns just the number.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string | null,
  locale: Locale,
  options: MoneyFormatOptions = {},
): string | null {
  const digits =
    options.fractionDigits ??
    (currency ? currencyFractionDigits(currency) : undefined)
  const number = formatNumber(
    amount,
    locale,
    digits === undefined
      ? {}
      : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  )
  if (number === null) return null
  return currency ? `${number}\u00a0${currency.toUpperCase()}` : number
}

export interface DateFormatOptions {
  /** IANA zone of the business (tenant `timeZoneId`); Kyiv when unknown. */
  timeZone?: string | null | undefined
  /** Include hours and minutes. */
  withTime?: boolean
}

/**
 * Numeric date (and time) in the business time zone: `07.10.2026, 14:30`
 * in Ukrainian, `07/10/2026, 14:30` in English (UK).
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  locale: Locale,
  { timeZone, withTime = false }: DateFormatOptions = {},
): string | null {
  const date = toDate(value)
  if (date === null) return null
  const zone = safeTimeZone(timeZone)
  return cached(
    `d|${locale}|${zone}|${String(withTime)}`,
    () =>
      new Intl.DateTimeFormat(intlLocale(locale), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        timeZone: zone,
      }),
  ).format(date)
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  locale: Locale,
  timeZone?: string | null,
): string | null {
  return formatDate(value, locale, { timeZone, withTime: true })
}

/** Hours and minutes only, in the business time zone. */
export function formatTime(
  value: Date | string | number | null | undefined,
  locale: Locale,
  timeZone?: string | null,
): string | null {
  const date = toDate(value)
  if (date === null) return null
  const zone = safeTimeZone(timeZone)
  return cached(
    `t|${locale}|${zone}`,
    () =>
      new Intl.DateTimeFormat(intlLocale(locale), {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: zone,
      }),
  ).format(date)
}

/**
 * Arbitrary `Intl.DateTimeFormat` options, still pinned to the business time
 * zone unless the options name one.
 */
export function formatDateWith(
  value: Date | string | number | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string | null,
): string | null {
  const date = toDate(value)
  if (date === null) return null
  const resolved = {
    ...options,
    timeZone: options.timeZone ?? safeTimeZone(timeZone),
  }
  return cached(
    `x|${locale}|${JSON.stringify(resolved)}`,
    () => new Intl.DateTimeFormat(intlLocale(locale), resolved),
  ).format(date)
}
