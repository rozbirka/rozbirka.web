import { isLocale, type Locale } from './locales'

const LOCALE_KEY = 'rozbirka.locale'

/**
 * Interface language chosen in this browser. Used until the Identity profile
 * carries a personal language; storage failures (private mode, SSR) read as
 * "no choice" rather than breaking the app.
 */
export const localePreference = {
  get(): Locale | null {
    try {
      const value = globalThis.localStorage?.getItem(LOCALE_KEY)
      return isLocale(value) ? value : null
    } catch {
      return null
    }
  },

  /** `null` returns to automatic selection. */
  set(locale: Locale | null) {
    try {
      if (locale === null) globalThis.localStorage?.removeItem(LOCALE_KEY)
      else globalThis.localStorage?.setItem(LOCALE_KEY, locale)
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
  },
}
