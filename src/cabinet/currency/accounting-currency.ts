import { normalizeApiProblem } from '@/api/errors'
import type { TenantSettings } from '@/api/tenant-settings'
import type { SupportedCurrency } from '@/i18n'

/**
 * Where the tenant's accounting currency stands (REQ-SINGLE-BUSINESS-CURRENCY
 * r9). There is no default: `not-chosen` is a real state, and `unknown` is a
 * contract that does not report the setting at all — neither is ever shown as
 * USD or as «0 USD».
 */
export type AccountingCurrencyStatus =
  | { kind: 'unknown' }
  | { kind: 'not-chosen' }
  | {
      kind: 'chosen'
      currency: SupportedCurrency
      /** `null` when Core did not report the lock. */
      locked: boolean | null
    }

export function accountingCurrencyStatus(
  settings: Pick<TenantSettings, 'accountingCurrency' | 'currencyLocked'>,
): AccountingCurrencyStatus {
  if (settings.accountingCurrency !== null) {
    return {
      kind: 'chosen',
      currency: settings.accountingCurrency,
      locked: settings.currencyLocked,
    }
  }
  // A contract that knows the setting always reports the lock flag; without
  // it there is nothing to say about the currency either.
  return settings.currencyLocked === null
    ? { kind: 'unknown' }
    : { kind: 'not-chosen' }
}

/** The currency amounts are kept in, when it is known. */
export const statusCurrency = (
  status: AccountingCurrencyStatus,
): SupportedCurrency | null =>
  status.kind === 'chosen' ? status.currency : null

/** Core's system owner role; the only one that may set the currency. */
export const isOwnerRole = (role: string | null | undefined): boolean =>
  typeof role === 'string' && role.trim().toLowerCase() === 'owner'

/** Which variant of the settings block (board 1a–1e) to show. */
export type CurrencySettingsView =
  | 'unknown'
  | 'choose'
  | 'change'
  | 'locked'
  | 'read-only'

export function currencySettingsView(
  status: AccountingCurrencyStatus,
  owner: boolean,
): CurrencySettingsView {
  if (status.kind === 'unknown') return 'unknown'
  if (status.kind === 'chosen' && status.locked !== false) return 'locked'
  if (!owner) return 'read-only'
  return status.kind === 'chosen' ? 'change' : 'choose'
}

/**
 * Whether a typed price is a price. A saved 0 is a price and locks the
 * currency (EC-1); an empty field is not.
 */
export function isPriceValue(
  value: string | number | null | undefined,
): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return Number.isFinite(value)
  const text = value.trim()
  if (text === '') return false
  return Number.isFinite(Number(text.replace(/\s/g, '').replace(',', '.')))
}

/** How a price field behaves before anything is typed (board 2a/2b). */
export type PriceGate =
  /** Pre-currency contract: the field works as before, without a code. */
  | { kind: 'legacy' }
  | { kind: 'ready'; currency: SupportedCurrency }
  | { kind: 'blocked'; reason: 'choose' | 'ask-owner' }

export function priceGate(
  status: AccountingCurrencyStatus,
  owner: boolean,
): PriceGate {
  if (status.kind === 'unknown') return { kind: 'legacy' }
  if (status.kind === 'not-chosen')
    return { kind: 'blocked', reason: owner ? 'choose' : 'ask-owner' }
  return { kind: 'ready', currency: status.currency }
}

/**
 * The currency a save would lock, if this save is the first price: shown next
 * to the save action (board 2a). Only while Core says it is not locked yet.
 */
export function willLockCurrency(
  status: AccountingCurrencyStatus,
  hasPrice: boolean,
): SupportedCurrency | null {
  return hasPrice && status.kind === 'chosen' && status.locked === false
    ? status.currency
    : null
}

/** A write whose outcome the client cannot know: the request may have landed. */
export const isUnknownOutcome = (error: unknown): boolean => {
  const kind = normalizeApiProblem(error).kind
  return kind === 'network' || kind === 'timeout'
}

/** Core refused a currency change because a price was saved first. */
export const isCurrencyLockedError = (error: unknown): boolean =>
  normalizeApiProblem(error).code?.toUpperCase() === 'BUSINESS_SETTINGS_LOCKED'

/** Core refused a price because no accounting currency is chosen. */
export const isCurrencyRequiredError = (error: unknown): boolean =>
  normalizeApiProblem(error).code?.toUpperCase() ===
  'ACCOUNTING_CURRENCY_REQUIRED'
