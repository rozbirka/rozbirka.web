import { intlLocale, SOURCE_LOCALE, type Locale } from './locales'
import { selectPlural, type PluralForms } from './plural'

/**
 * A message is either text with `{name}` placeholders or plural forms chosen
 * by the `count` parameter (CLDR categories, `other` required).
 */
export type Message = string | PluralForms

export type MessageParams = Readonly<Record<string, string | number>>

type MessageShape = Readonly<Record<string, Message>>

/** Every locale must provide every key the Ukrainian source defines. */
export type Translations<M extends MessageShape> = {
  readonly [K in keyof M]: Message
}

export interface MessageCatalog<M extends MessageShape = MessageShape> {
  readonly uk: M
  readonly 'en-GB': Translations<M>
  readonly pl: Translations<M>
}

export type MessageKey<C> =
  C extends MessageCatalog<infer M> ? keyof M & string : never

/**
 * Declare one feature's messages next to the feature, e.g.
 * `src/cabinet/business/messages.ts`:
 *
 * ```ts
 * export const businessMessages = defineMessages({
 *   uk: { save: 'Зберегти', parts: { one: '{count} деталь', few: '{count} деталі', many: '{count} деталей', other: '{count} деталі' } },
 *   'en-GB': { save: 'Save', parts: { one: '{count} part', other: '{count} parts' } },
 *   pl: { save: 'Zapisz', parts: { one: '{count} część', few: '{count} części', many: '{count} części', other: '{count} części' } },
 * })
 * ```
 *
 * A missing or extra key in any locale is a type error, so namespaces stay
 * complete without a shared dictionary file.
 */
export function defineMessages<const M extends MessageShape>(
  catalog: MessageCatalog<M>,
): MessageCatalog<M> {
  return catalog
}

const numberFormatters = new Map<Locale, Intl.NumberFormat>()

function formatParam(locale: Locale, value: string | number): string {
  if (typeof value === 'string') return value
  let formatter = numberFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale(locale))
    numberFormatters.set(locale, formatter)
  }
  return formatter.format(value)
}

/** Replace `{name}` placeholders; unknown placeholders stay visible. */
export function interpolate(
  template: string,
  locale: Locale,
  params: MessageParams = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : formatParam(locale, value)
  })
}

/**
 * Text of `key` in `locale`. Falls back to the Ukrainian source if a locale
 * somehow lacks the key at runtime. Numbers in params use the locale format.
 */
export function translate<M extends MessageShape>(
  catalog: MessageCatalog<M>,
  locale: Locale,
  key: keyof M & string,
  params?: MessageParams,
): string {
  const localized: Readonly<Record<string, Message | undefined>> =
    catalog[locale]
  const message = localized[key] ?? catalog[SOURCE_LOCALE][key]
  if (message === undefined) return key
  if (typeof message === 'string') return interpolate(message, locale, params)
  const count = params?.['count']
  const form = selectPlural(
    locale,
    typeof count === 'number' ? count : Number(count ?? 0),
    message,
  )
  return interpolate(form, locale, params)
}

export type Translate<M extends MessageShape> = (
  key: keyof M & string,
  params?: MessageParams,
) => string
