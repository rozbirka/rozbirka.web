import { formatDateWith, type Locale } from '@/i18n'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A day as people read it (`5 серп. 2026 р.`, `5 Aug 2026`). Timestamps are
 * shown in the business time zone; a bare `YYYY-MM-DD` is a calendar day with
 * no zone, so it is read as written rather than shifted by one. Anything
 * unparsable is shown as it came.
 */
export function formatDay(
  value: string,
  locale: Locale,
  timeZone?: string | null,
): string {
  return (
    formatDateWith(
      value,
      locale,
      DATE_ONLY.test(value)
        ? { dateStyle: 'medium', timeZone: 'UTC' }
        : { dateStyle: 'medium' },
      timeZone,
    ) ?? value
  )
}
