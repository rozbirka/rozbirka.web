import type { Locale } from './locales'

let current: Locale | null = null

/**
 * Interface locale sent to the API as `Accept-Language`, so server messages,
 * OTP SMS and validation errors arrive in the language the person reads.
 * Set by the root `LocaleProvider`; `null` leaves the browser default.
 */
export const requestLocale = {
  get: (): Locale | null => current,
  set: (locale: Locale | null) => {
    current = locale
  },
}
