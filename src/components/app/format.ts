import { formatNumber } from '@/i18n/format'
import { defineMessages, translate } from '@/i18n/messages'
import { SOURCE_LOCALE, type Locale } from '@/i18n/locales'

/** Example of a feature namespace: units next to a localized number. */
export const fileSizeMessages = defineMessages({
  uk: { bytes: '{size} Б', kilobytes: '{size} КБ', megabytes: '{size} МБ' },
  'en-GB': {
    bytes: '{size} B',
    kilobytes: '{size} KB',
    megabytes: '{size} MB',
  },
  pl: { bytes: '{size} B', kilobytes: '{size} KB', megabytes: '{size} MB' },
})

const oneDecimal = { maximumFractionDigits: 1 }

/**
 * File size in the unit a person would say out loud. Ukrainian unless a
 * locale is given (screens pass `useLocale().locale`).
 */
export function formatFileSize(
  bytes: number,
  locale: Locale = SOURCE_LOCALE,
): string {
  if (bytes < 1024) {
    return translate(fileSizeMessages, locale, 'bytes', {
      size: String(bytes),
    })
  }
  const [key, value] =
    bytes < 1024 * 1024
      ? (['kilobytes', bytes / 1024] as const)
      : (['megabytes', bytes / (1024 * 1024)] as const)
  return translate(fileSizeMessages, locale, key, {
    size: formatNumber(value, locale, oneDecimal) ?? '',
  })
}
