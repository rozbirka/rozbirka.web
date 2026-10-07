import { SUPPORTED_CURRENCIES } from '@/i18n'

/** Position in the supported catalog; codes outside it go last. */
export const catalogRank = (code: string) => {
  const index = (SUPPORTED_CURRENCIES as readonly string[]).indexOf(
    code.toUpperCase(),
  )
  return index === -1 ? SUPPORTED_CURRENCIES.length : index
}

/** Compare currency codes in catalog order, then alphabetically. */
export const byCatalog = (left: string, right: string) =>
  catalogRank(left) - catalogRank(right) || left.localeCompare(right)

/**
 * Currencies a till keeps, in catalog order — never a «preferred» guess that
 * puts USD or UAH first.
 */
export function tillCurrencies(register: {
  balances: Readonly<Record<string, number>>
}): string[] {
  return Object.keys(register.balances).sort(byCatalog)
}
