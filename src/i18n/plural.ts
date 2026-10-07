import { intlLocale, type Locale } from './locales'

const rulesCache = new Map<Locale, Intl.PluralRules>()

export function pluralRules(locale: Locale): Intl.PluralRules {
  let rules = rulesCache.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(intlLocale(locale))
    rulesCache.set(locale, rules)
  }
  return rules
}

/** CLDR plural category of `count` in `locale` (`one`, `few`, `many`, `other`). */
export function pluralCategory(
  locale: Locale,
  count: number,
): Intl.LDMLPluralRule {
  return pluralRules(locale).select(count)
}

/**
 * Forms per CLDR category; `other` is required because every locale uses it
 * (fractions in Ukrainian and Polish, everything but 1 in English).
 */
export type PluralForms = { readonly other: string } & Partial<
  Readonly<Record<Exclude<Intl.LDMLPluralRule, 'other'>, string>>
>

export function selectPlural(
  locale: Locale,
  count: number,
  forms: PluralForms,
): string {
  return forms[pluralCategory(locale, count)] ?? forms.other
}
