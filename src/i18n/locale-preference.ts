import { isLocale, type Locale } from './locales'

const LOCALE_KEY = 'rozbirka.locale'
const SITE_LOCALE_KEY = 'rozbirka.site-locale'

/**
 * One remembered language in this browser. Storage failures (private mode,
 * SSR) read as "no choice" rather than breaking the app.
 */
function storedLocale(key: string) {
  return {
    get(): Locale | null {
      try {
        const value = globalThis.localStorage?.getItem(key)
        return isLocale(value) ? value : null
      } catch {
        return null
      }
    },

    /** `null` returns to automatic selection. */
    set(locale: Locale | null) {
      try {
        if (locale === null) globalThis.localStorage?.removeItem(key)
        else globalThis.localStorage?.setItem(key, locale)
      } catch {
        /* storage unavailable: the choice lasts for this page only */
      }
    },
  }
}

/**
 * Cabinet (interface) language chosen in this browser — Profile «Мова
 * інтерфейсу» mirrors its saved choice here so sign-in opens in it. Used
 * until the profile carries a personal language. Never written by the public
 * site.
 */
export const localePreference = storedLocale(LOCALE_KEY)

/**
 * Public-site language chosen with the landing switcher. Read by auth screens
 * and public pages without their own language (the privacy policy); it never
 * changes the cabinet language, and the cabinet never changes it.
 */
export const siteLocalePreference = storedLocale(SITE_LOCALE_KEY)
