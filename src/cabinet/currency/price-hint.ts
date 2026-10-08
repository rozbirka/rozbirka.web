import { currencyName, useLocale, useT, type SupportedCurrency } from '@/i18n'
import { currencyMessages } from './messages'

/**
 * Field hint naming the accounting currency («У валюті обліку: USD, Долар
 * США»). The suffix in `MoneyInput` is decorative, so the name a screen
 * reader announces with the field comes from here.
 */
export function usePriceHint(): (
  currency: SupportedCurrency | null,
) => string | undefined {
  const t = useT(currencyMessages)
  const { locale } = useLocale()
  return (currency) =>
    currency === null
      ? undefined
      : t('priceHint', { code: currency, name: currencyName(currency, locale) })
}
