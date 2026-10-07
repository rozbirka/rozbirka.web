import { translate, type Locale } from '@/i18n'
import { npFeedMessages } from './np-feed-messages'

/** Minutes are what an operator reads here, not a timestamp. */
export function waitedFor(
  from: string,
  locale: Locale,
  now: number = Date.now(),
): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(from)) / 60000))
  const say = (
    key: 'waitedMinutes' | 'waitedHours' | 'waitedDays',
    count: number,
  ) => translate(npFeedMessages, locale, key, { count })
  if (minutes < 60) return say('waitedMinutes', minutes)
  const hours = Math.floor(minutes / 60)
  return hours < 24
    ? say('waitedHours', hours)
    : say('waitedDays', Math.floor(hours / 24))
}
