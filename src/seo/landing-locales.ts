// Relative imports: scripts/ (tsconfig.node, no path aliases) import this file.
import { SUPPORTED_LOCALES, type Locale } from '../i18n/locales'

/**
 * Public landing URL per language. `/` stays Ukrainian (the original,
 * canonical and x-default page); other languages get a short prefix route.
 * There is no automatic redirect between them.
 */
export const LANDING_PATHS = {
  uk: '/',
  'en-GB': '/en',
  pl: '/pl',
} as const satisfies Readonly<Record<Locale, string>>

export type LandingPath = (typeof LANDING_PATHS)[Locale]

/** Short code shown on the site language button (same width in every UI). */
export const LOCALE_CODES: Readonly<Record<Locale, string>> = {
  uk: 'UK',
  'en-GB': 'EN',
  pl: 'PL',
}

/** `og:locale` value per language. */
export const OG_LOCALES: Readonly<Record<Locale, string>> = {
  uk: 'uk_UA',
  'en-GB': 'en_GB',
  pl: 'pl_PL',
}

export const SITE_ORIGIN = 'https://rozbirka.pro'

export function landingPathFor(locale: Locale): LandingPath {
  return LANDING_PATHS[locale]
}

/** Absolute landing URL, e.g. `https://rozbirka.pro/en`. */
export function landingUrlFor(locale: Locale): string {
  const path = LANDING_PATHS[locale]
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`
}

/** Language of a landing pathname, or `null` for any other page. */
export function landingLocaleForPath(pathname: string): Locale | null {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  return (
    SUPPORTED_LOCALES.find((locale) => LANDING_PATHS[locale] === normalized) ??
    null
  )
}

export interface HreflangAlternate {
  hreflang: Locale | 'x-default'
  href: string
}

/** `hreflang` set shared by every landing document; x-default is `/`. */
export const LANDING_ALTERNATES: readonly HreflangAlternate[] = [
  ...SUPPORTED_LOCALES.map((locale) => ({
    hreflang: locale,
    href: landingUrlFor(locale),
  })),
  { hreflang: 'x-default', href: landingUrlFor('uk') },
]
