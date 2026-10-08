import { useCallback, useMemo } from 'react'
import {
  formatDate,
  formatDateTime,
  formatDateWith,
  formatMoney,
  formatNumber,
  formatTime,
  type MoneyFormatOptions,
} from './format'
import { useLocale } from './LocaleProvider'
import {
  translate,
  type Message,
  type MessageCatalog,
  type MessageParams,
  type Translate,
} from './messages'
import { selectPlural, type PluralForms } from './plural'

/**
 * Translator for one feature namespace in the current locale:
 *
 * ```tsx
 * const t = useT(businessMessages)
 * t('save'); t('parts', { count: 3 })
 * ```
 */
export function useT<M extends Readonly<Record<string, Message>>>(
  catalog: MessageCatalog<M>,
): Translate<M> {
  const { locale } = useLocale()
  return useCallback(
    (key: keyof M & string, params?: MessageParams) =>
      translate(catalog, locale, key, params),
    [catalog, locale],
  )
}

type DateInput = Date | string | number | null | undefined

export interface Formatters {
  number: (
    value: number | string | null | undefined,
    options?: Intl.NumberFormatOptions,
  ) => string | null
  money: (
    amount: number | string | null | undefined,
    currency: string | null,
    options?: MoneyFormatOptions,
  ) => string | null
  date: (value: DateInput) => string | null
  dateTime: (value: DateInput) => string | null
  time: (value: DateInput) => string | null
  dateWith: (
    value: DateInput,
    options: Intl.DateTimeFormatOptions,
  ) => string | null
  plural: (count: number, forms: PluralForms) => string
}

/**
 * Formatters bound to the current locale and business time zone. Each
 * returns `null` for missing input, so the caller picks the placeholder.
 */
export function useFormat(): Formatters {
  const { locale, timeZone } = useLocale()
  return useMemo<Formatters>(
    () => ({
      number: (value, options) => formatNumber(value, locale, options),
      money: (amount, currency, options) =>
        formatMoney(amount, currency, locale, options),
      date: (value) => formatDate(value, locale, { timeZone }),
      dateTime: (value) => formatDateTime(value, locale, timeZone),
      time: (value) => formatTime(value, locale, timeZone),
      dateWith: (value, options) =>
        formatDateWith(value, locale, options, timeZone),
      plural: (count, forms) => selectPlural(locale, count, forms),
    }),
    [locale, timeZone],
  )
}
