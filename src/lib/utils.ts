import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { pluralCategory } from '@/i18n/plural'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ukrainian counts take three forms: 1 деталь, 2 деталі, 5 деталей. Screens
 * that write a count next to a noun need all three or they read as machine
 * output. Backed by `Intl.PluralRules('uk')`; new and translated text should
 * use plural messages (`defineMessages`) or `selectPlural` from `@/i18n`.
 */
export function plural(count: number, forms: [string, string, string]) {
  switch (pluralCategory('uk', count)) {
    case 'one':
      return forms[0]
    case 'few':
      return forms[1]
    default:
      return forms[2]
  }
}
