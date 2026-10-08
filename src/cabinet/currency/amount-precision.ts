import { currencyFractionDigits, translate, type Locale } from '@/i18n'
import { currencyMessages } from './messages'

/**
 * Core's amount rule, mirrored so a form says what is wrong before saving.
 * Core never rounds: `CurrencyPrecision.IsValid` accepts an amount only when
 * rounding it to the currency's minor unit (JPY 0, every other supported
 * currency 2) leaves it unchanged, and anything else is refused with
 * `INVALID_CURRENCY_PRECISION` (cars, batches, parts, car expenses, orders
 * and their items, payments, till transactions and transfers). Its check
 * constraints also cap the magnitude: below 10^10 everywhere, 10^16 for a
 * batch's total cost.
 */
export const AMOUNT_LIMIT = 1e10
export const BATCH_COST_LIMIT = 1e16

export type AmountPrecisionProblem =
  | { kind: 'precision'; currency: string; digits: number }
  | { kind: 'too-large'; currency: string | null }

/**
 * Why Core would refuse `amount` in `currency`, or `null` when it accepts it.
 * Without a currency only the magnitude is checked.
 */
export function amountPrecisionProblem(
  amount: number,
  currency: string | null,
  { limit = AMOUNT_LIMIT }: { limit?: number } = {},
): AmountPrecisionProblem | null {
  if (!Number.isFinite(amount)) return null
  if (Math.abs(amount) >= limit) return { kind: 'too-large', currency }
  if (currency === null) return null
  const digits = currencyFractionDigits(currency)
  // Compare on the typed decimal text: binary floats cannot hold 0.1 exactly.
  const [, fraction = ''] = String(amount).split('.')
  if (/e/i.test(String(amount)) || fraction.length > digits)
    return { kind: 'precision', currency: currency.toUpperCase(), digits }
  return null
}

/** The problem in words, in `locale` (also usable outside React). */
export function amountPrecisionMessage(
  problem: AmountPrecisionProblem,
  locale: Locale,
): string {
  if (problem.kind === 'too-large')
    return translate(currencyMessages, locale, 'tooLarge')
  return translate(
    currencyMessages,
    locale,
    problem.digits === 0 ? 'precisionWhole' : 'precision',
    { code: problem.currency },
  )
}

/** `amountPrecisionProblem` as a message, or `null` when Core accepts it. */
export function amountPrecisionError(
  amount: number,
  currency: string | null,
  locale: Locale,
  options: { limit?: number } = {},
): string | null {
  const problem = amountPrecisionProblem(amount, currency, options)
  return problem === null ? null : amountPrecisionMessage(problem, locale)
}
