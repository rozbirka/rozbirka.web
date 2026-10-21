import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@/i18n/format'

/** Calendar days in the business zone, including 23/25-hour DST days. */
export function activityDayDifference(
  value: string | null | undefined,
  now: number,
  timeZone: string,
): number | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.valueOf())) return null
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const day = (instant: Date) => {
    const parts = formatter.formatToParts(instant)
    const part = (type: string) =>
      Number(parts.find((one) => one.type === type)?.value)
    return Date.UTC(part('year'), part('month') - 1, part('day')) / 86_400_000
  }
  return day(new Date(now)) - day(date)
}
