import { useMemo } from 'react'
import type { InventorySession } from '@/api/inventory'
import {
  formatDateWith,
  formatTime,
  translate,
  useLocale,
  type Locale,
} from '@/i18n'
import { inventoryMessages } from './messages'

export type SessionStatus = InventorySession['status']

export type SessionTone = 'neutral' | 'warn' | 'info' | 'ok' | 'danger'

const STATUS: Record<
  SessionStatus,
  [
    (
      | 'statusDraft'
      | 'statusInProgress'
      | 'statusReview'
      | 'statusCompleted'
      | 'statusCancelled'
    ),
    SessionTone,
  ]
> = {
  draft: ['statusDraft', 'neutral'],
  inProgress: ['statusInProgress', 'warn'],
  review: ['statusReview', 'info'],
  completed: ['statusCompleted', 'ok'],
  cancelled: ['statusCancelled', 'danger'],
}

/** Label and pill tone of a session status in `locale`. */
export const sessionStatus = (
  status: SessionStatus,
  locale: Locale,
): [string, SessionTone] => {
  const [key, tone] = STATUS[status]
  return [translate(inventoryMessages, locale, key), tone]
}

/** Short date and time in the business time zone; `—` when missing. */
export const inventoryDate = (
  value: string | null | undefined,
  locale: Locale,
  timeZone?: string | null,
) =>
  formatDateWith(
    value,
    locale,
    { dateStyle: 'short', timeStyle: 'short' },
    timeZone,
  ) ?? '—'

/** The day alone — a check is remembered by its date, not by its minute. */
export const inventoryDay = (
  value: string | null | undefined,
  locale: Locale,
  timeZone?: string | null,
) => formatDateWith(value, locale, { dateStyle: 'short' }, timeZone) ?? '—'

/** Hours and minutes of a scan; an unreadable value is shown as it came. */
export const inventoryTime = (
  value: string,
  locale: Locale,
  timeZone?: string | null,
) => formatTime(value, locale, timeZone) ?? value

/** Date helpers and the status label bound to the current locale. */
export function useInventoryFormat() {
  const { locale, timeZone } = useLocale()
  return useMemo(
    () => ({
      locale,
      date: (value?: string | null) => inventoryDate(value, locale, timeZone),
      day: (value?: string | null) => inventoryDay(value, locale, timeZone),
      timeOfDay: (value: string) => inventoryTime(value, locale, timeZone),
      sessionStatus: (status: SessionStatus) => sessionStatus(status, locale),
    }),
    [locale, timeZone],
  )
}
