import { useCallback } from 'react'
import {
  currencyFractionDigits,
  formatNumber,
  useLocale,
  type Locale,
} from '@/i18n'

/**
 * An accounting sum as text: the ISO code after the number (never `$`), the
 * currency's precision, and a round headline sum without zero decimals
 * («10 380 USD», «6 120,50 USD»). Without a known currency the number
 * stands alone rather than in a guessed one.
 */
export function wholeMoney(
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

/** `wholeMoney` bound to the current locale and the given currency. */
export function useWholeMoney(
  currency: string | null,
): (value: number) => string {
  const { locale } = useLocale()
  return useCallback(
    (value: number) => wholeMoney(value, currency, locale),
    [currency, locale],
  )
}
