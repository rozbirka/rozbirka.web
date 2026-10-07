import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import type { BusinessCountry } from '@/api/tenant-settings'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { translate, type Locale } from '@/i18n'
import { deliveryMessages } from './messages'

/** Core's answer when the tenant's country has no Nova Poshta. */
export const INTEGRATION_COUNTRY_UNAVAILABLE = 'integration_country_unavailable'

/**
 * Nova Poshta serves Ukrainian businesses only; Core refuses it elsewhere with
 * `integration_country_unavailable` and hides the integration. A tenant whose
 * country is not known yet is an older tenant — those are all Ukrainian — so
 * it keeps the pre-region behaviour.
 */
export const novaPoshtaAvailableIn = (
  country: BusinessCountry | null,
): boolean => country === null || country === 'UA'

/** An international number a person in that country would recognise. */
export const phoneExample = (country: BusinessCountry | null): string =>
  country === 'GB'
    ? '+44 7700 900123'
    : country === 'PL'
      ? '+48 512 345 678'
      : '+380 67 123 45 67'

export interface NovaPoshtaAvailability {
  available: boolean
  countryCode: BusinessCountry | null
}

/** Whether the current tenant may use Nova Poshta at all. */
export function useNovaPoshtaAvailability(): NovaPoshtaAvailability {
  const { countryCode } = useTenantSettings()
  return { available: novaPoshtaAvailableIn(countryCode), countryCode }
}

/**
 * A delivery API failure said to a person. Core's own message is shown as it
 * came, except for the country refusal, which gets the cabinet's wording.
 */
export function deliveryProblemMessage(
  problem: unknown,
  locale: Locale,
): string {
  if (isProblemCode(problem, INTEGRATION_COUNTRY_UNAVAILABLE))
    return translate(deliveryMessages, locale, 'countryUnavailable')
  return normalizeApiProblem(problem).message
}
