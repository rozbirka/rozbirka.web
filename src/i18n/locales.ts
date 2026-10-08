/**
 * Interface locales. `uk` is the source language every message is written in
 * first; `en-GB` is the fallback for a browser language we do not support.
 * Personal (interface) language is not the tenant's document language.
 */
export const SUPPORTED_LOCALES = ['uk', 'en-GB', 'pl'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** Language the product is written in; prerendered public pages use it. */
export const SOURCE_LOCALE: Locale = 'uk'

/** Used when neither the profile nor the browser names a supported language. */
export const FALLBACK_LOCALE: Locale = 'en-GB'

/** Language names are always shown in their own language, with `lang` set. */
export const LOCALE_NATIVE_NAMES: Readonly<Record<Locale, string>> = {
  uk: 'Українська',
  'en-GB': 'English (UK)',
  pl: 'Polski',
}

/** BCP 47 tag handed to `Intl` so formats carry the expected region. */
const INTL_TAGS: Readonly<Record<Locale, string>> = {
  uk: 'uk-UA',
  'en-GB': 'en-GB',
  pl: 'pl-PL',
}

export function intlLocale(locale: Locale): string {
  return INTL_TAGS[locale]
}

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  )
}

/**
 * Map any BCP 47 tag (`uk-UA`, `en-US`, `pl`) onto a supported locale by its
 * language subtag, or `null` when the language is not one we support. Every
 * English variant maps to `en-GB`, the only English we ship.
 */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null
  const language = tag.trim().toLowerCase().split(/[-_]/)[0]
  switch (language) {
    case 'uk':
      return 'uk'
    case 'en':
      return 'en-GB'
    case 'pl':
      return 'pl'
    default:
      return null
  }
}

/**
 * Where the active locale came from — the profile screen explains it.
 * `pinned` is a locale fixed by the caller (SSR/prerender, tests).
 */
export type LocaleSource =
  | 'profile'
  | 'device'
  | 'browser'
  | 'fallback'
  | 'pinned'

export interface LocaleResolution {
  locale: Locale
  source: LocaleSource
  /**
   * First browser language tag, kept so the fallback hint can name the
   * unsupported language (`Intl.DisplayNames`). `null` when unknown.
   */
  browserLanguage: string | null
}

export interface LocaleInputs {
  /** Saved personal language from the user profile (pending Identity field). */
  profile?: string | null | undefined
  /** Choice remembered in this browser while the profile has none. */
  device?: string | null | undefined
  /** `navigator.languages`, most preferred first. */
  browser?: readonly string[] | undefined
}

/**
 * Fallback chain: profile language → device preference → first supported
 * browser language → `en-GB`. Unsupported values at any step are skipped,
 * never guessed into a nearby locale.
 */
export function resolveLocale({
  profile,
  device,
  browser = [],
}: LocaleInputs): LocaleResolution {
  const browserLanguage = browser[0] ?? null
  if (isLocale(profile))
    return { locale: profile, source: 'profile', browserLanguage }
  if (isLocale(device))
    return { locale: device, source: 'device', browserLanguage }
  for (const tag of browser) {
    const matched = matchLocale(tag)
    if (matched) return { locale: matched, source: 'browser', browserLanguage }
  }
  return { locale: FALLBACK_LOCALE, source: 'fallback', browserLanguage }
}

/** Browser languages, or an empty list where there is no navigator (SSR). */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  if (navigator.languages.length > 0) return navigator.languages
  return navigator.language ? [navigator.language] : []
}
