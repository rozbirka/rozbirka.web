import { useCallback } from 'react'
import {
  currencyFractionDigits,
  formatNumber,
  useLocale,
  type Locale,
} from '@/i18n'

/**
 * Car money is in the tenant's accounting currency: a yard buys a car and
 * prices its parts in it. Shared so the detail screen and the profitability
 * card cannot drift apart on how a sum is written: the ISO code after the
 * number (never `$`), the currency's precision, and a round headline sum
 * without zero decimals («10 380 USD»). Without a known currency the number
 * stands alone rather than in a guessed one.
 */
export function carMoney(
  value: number,
  currency: string | null,
  locale: Locale,
): string {
  const digits = currency === null ? 2 : currencyFractionDigits(currency)
  const number =
    formatNumber(value, locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      trailingZeroDisplay: 'stripIfInteger',
    }) ?? String(value)
  return currency === null ? number : `${number}\u00a0${currency}`
}

/** `carMoney` bound to the current locale and the given currency. */
export function useCarMoney(
  currency: string | null,
): (value: number) => string {
  const { locale } = useLocale()
  return useCallback(
    (value: number) => carMoney(value, currency, locale),
    [currency, locale],
  )
}
