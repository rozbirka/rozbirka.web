import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_TIME_ZONE } from './format'
import { localePreference } from './locale-preference'
import {
  browserLanguages,
  resolveLocale,
  SOURCE_LOCALE,
  type Locale,
  type LocaleResolution,
} from './locales'

export interface LocaleContextValue {
  /** Interface locale for this subtree. */
  locale: Locale
  /** How the root locale was chosen (profile, device, browser or fallback). */
  resolution: LocaleResolution
  /** Business IANA time zone for dates; Kyiv when the tenant is unknown. */
  timeZone: string
  /** Choice stored in this browser; `null` means automatic. */
  devicePreference: Locale | null
  /** Remember a choice in this browser (`null` returns to automatic). */
  setDevicePreference: (locale: Locale | null) => void
  /** @internal used by `LocaleOverride` to keep `<html lang>` truthful. */
  registerDocumentLocale: (locale: Locale) => () => void
}

const sourceResolution: LocaleResolution = {
  locale: SOURCE_LOCALE,
  source: 'pinned',
  browserLanguage: null,
}

/**
 * Without a provider (unit tests, isolated components) everything renders in
 * the Ukrainian source locale and Kyiv time, matching the pre-i18n output.
 */
const LocaleContext = createContext<LocaleContextValue>({
  locale: SOURCE_LOCALE,
  resolution: sourceResolution,
  timeZone: DEFAULT_TIME_ZONE,
  devicePreference: null,
  setDevicePreference: () => undefined,
  registerDocumentLocale: () => () => undefined,
})

export interface LocaleProviderProps {
  children: ReactNode
  /** Personal language from the profile (unvalidated; unknown is ignored). */
  profileLanguage?: string | null | undefined
  /** Tenant `timeZoneId`; invalid or missing means Europe/Kyiv. */
  timeZone?: string | null | undefined
  /**
   * Pin the locale instead of resolving it — SSR/prerender (always `uk`),
   * tests and previews. Disables browser and storage reads.
   */
  locale?: Locale | undefined
  /** Keep `document.documentElement.lang` in sync (default true). */
  syncDocumentLang?: boolean | undefined
}

/**
 * Root locale owner. Resolution: profile language → language remembered in
 * this browser → first supported browser language → en-GB. SSR-safe: with no
 * `window` it never touches storage or navigator.
 */
export function LocaleProvider({
  children,
  profileLanguage,
  timeZone,
  locale: pinned,
  syncDocumentLang = true,
}: LocaleProviderProps) {
  const [devicePreference, setDevicePreferenceState] = useState<Locale | null>(
    () => (pinned ? null : localePreference.get()),
  )
  const [browser] = useState<readonly string[]>(() =>
    pinned ? [] : browserLanguages(),
  )

  const resolution = useMemo<LocaleResolution>(
    () =>
      pinned
        ? { locale: pinned, source: 'pinned', browserLanguage: null }
        : resolveLocale({
            profile: profileLanguage,
            device: devicePreference,
            browser,
          }),
    [browser, devicePreference, pinned, profileLanguage],
  )

  const setDevicePreference = useCallback((next: Locale | null) => {
    localePreference.set(next)
    setDevicePreferenceState(next)
  }, [])

  const [overrides, setOverrides] = useState<
    readonly { id: number; locale: Locale }[]
  >([])
  const nextOverrideId = useRef(0)
  const registerDocumentLocale = useCallback((locale: Locale) => {
    const id = nextOverrideId.current++
    setOverrides((list) => [...list, { id, locale }])
    return () => setOverrides((list) => list.filter((item) => item.id !== id))
  }, [])

  const documentLocale = overrides.at(-1)?.locale ?? resolution.locale
  useEffect(() => {
    if (!syncDocumentLang || typeof document === 'undefined') return
    document.documentElement.lang = documentLocale
  }, [documentLocale, syncDocumentLang])

  const zone = timeZone?.trim() ? timeZone : DEFAULT_TIME_ZONE
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: resolution.locale,
      resolution,
      timeZone: zone,
      devicePreference,
      setDevicePreference,
      registerDocumentLocale,
    }),
    [
      devicePreference,
      registerDocumentLocale,
      resolution,
      setDevicePreference,
      zone,
    ],
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

/**
 * Render a subtree in a fixed locale and keep `<html lang>` on it while
 * mounted — for pages that exist in one language only (the Ukrainian landing
 * and legal pages) and for prerendered routes, so hydration matches the
 * server output whatever the browser prefers.
 */
export function LocaleOverride({
  locale,
  children,
}: {
  locale: Locale
  children: ReactNode
}) {
  const parent = useContext(LocaleContext)
  const { registerDocumentLocale } = parent
  useEffect(
    () => registerDocumentLocale(locale),
    [locale, registerDocumentLocale],
  )
  const value = useMemo(() => ({ ...parent, locale }), [locale, parent])
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext)
}
