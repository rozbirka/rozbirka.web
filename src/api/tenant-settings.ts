import { parseCurrency, type SupportedCurrency } from '../i18n/currencies'
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '../i18n/format'
import { isLocale, type Locale } from '../i18n/locales'
import type { Tenant } from './types'

/** Countries a business can operate in (Core `Tenant.ConfigureRegion`). */
export const BUSINESS_COUNTRIES = ['UA', 'GB', 'PL'] as const
export type BusinessCountry = (typeof BUSINESS_COUNTRIES)[number]

export function parseBusinessCountry(value: unknown): BusinessCountry | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return (BUSINESS_COUNTRIES as readonly string[]).includes(code)
    ? (code as BusinessCountry)
    : null
}

export function parseTimeZoneId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && isValidTimeZone(value)
    ? value
    : null
}

export function parseDocumentLanguage(value: unknown): Locale | null {
  return isLocale(value) ? value : null
}

const parseFlag = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null

/**
 * Validate the business-settings fields of a tenant DTO. Core adds them on an
 * unpinned branch, so each may be absent or carry a value this build does not
 * know: those become `null` (unknown / unsupported), never a guessed default
 * and never a crash.
 */
export function normalizeTenant(raw: Tenant): Tenant {
  const source: RawBusinessSettings = raw
  return {
    ...raw,
    countryCode: parseBusinessCountry(source.countryCode),
    timeZoneId: parseTimeZoneId(source.timeZoneId),
    documentLanguage: parseDocumentLanguage(source.documentLanguage),
    accountingCurrency: parseCurrency(source.accountingCurrency),
    regionLocked: parseFlag(source.regionLocked),
    currencyLocked: parseFlag(source.currencyLocked),
  }
}

/** What the wire may actually carry, whatever `Tenant` promises. */
interface RawBusinessSettings {
  countryCode?: unknown
  timeZoneId?: unknown
  documentLanguage?: unknown
  accountingCurrency?: unknown
  regionLocked?: unknown
  currencyLocked?: unknown
}

export interface TenantSettings {
  countryCode: BusinessCountry | null
  /** Tenant zone when known and valid, else Europe/Kyiv (pre-i18n default). */
  timeZone: string
  /** `false` when `timeZone` is the default rather than the tenant's own. */
  timeZoneKnown: boolean
  documentLanguage: Locale | null
  /** `null` means not chosen yet (or unsupported) — there is no default. */
  accountingCurrency: SupportedCurrency | null
  /** `null` when Core has not reported the lock (older contract). */
  regionLocked: boolean | null
  currencyLocked: boolean | null
}

/** Business settings of `tenant` with display defaults applied. */
export function tenantSettings(
  tenant: Tenant | null | undefined,
): TenantSettings {
  const zone = parseTimeZoneId(tenant?.timeZoneId)
  return {
    countryCode: parseBusinessCountry(tenant?.countryCode),
    timeZone: zone ?? DEFAULT_TIME_ZONE,
    timeZoneKnown: zone !== null,
    documentLanguage: parseDocumentLanguage(tenant?.documentLanguage),
    accountingCurrency: parseCurrency(tenant?.accountingCurrency),
    regionLocked: parseFlag(tenant?.regionLocked),
    currencyLocked: parseFlag(tenant?.currencyLocked),
  }
}
