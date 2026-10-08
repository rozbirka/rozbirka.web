import { SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { dashboardMessages } from './dashboard-messages'

/**
 * What the server calls the last thing that happened, said in the interface
 * language. An unknown code falls through as itself rather than disappearing
 * — a new server event should be visible, not silently blank.
 */
export function activityLabel(
  type: string,
  locale: Locale = SOURCE_LOCALE,
): string {
  const key = `activity.${type}`
  return Object.prototype.hasOwnProperty.call(dashboardMessages.uk, key)
    ? translate(
        dashboardMessages,
        locale,
        key as keyof (typeof dashboardMessages)['uk'],
      )
    : type
}
