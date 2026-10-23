import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import { localizeApiError } from '@/api/error-localization'
import type { BusinessCountry } from '@/api/tenant-settings'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { translate, type Locale } from '@/i18n'
import { isPhoneCountry, phoneExample as examplePhone } from '@/lib/phone'
import {
  INTEGRATION_COUNTRY_UNAVAILABLE,
  isNovaPoshtaAvailable,
} from '../../integrations/integration-labels'
import { deliveryMessages } from './messages'

export { INTEGRATION_COUNTRY_UNAVAILABLE }

/**
 * Nova Poshta serves Ukrainian businesses only; Core refuses it elsewhere with
 * `integration_country_unavailable` and hides the integration. A tenant whose
 * country is not known yet is an older tenant — those are all Ukrainian — so
 * it keeps the pre-region behaviour.
 */
export const novaPoshtaAvailableIn = isNovaPoshtaAvailable

/** An international number a person in that country would recognise. */
export const phoneExample = (country: BusinessCountry | null): string =>
  examplePhone(isPhoneCountry(country) ? country : 'UA')

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
 * A delivery API failure in the interface language, with the cabinet's wording
 * for a country refusal.
 */
export function deliveryProblemMessage(
  problem: unknown,
  locale: Locale,
): string {
  if (isProblemCode(problem, INTEGRATION_COUNTRY_UNAVAILABLE))
    return translate(deliveryMessages, locale, 'countryUnavailable')
  return localizeApiError(normalizeApiProblem(problem), locale)
}
