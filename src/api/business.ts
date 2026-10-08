import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import { normalizeTenant } from './tenant-settings'
import type { Tenant } from './types'
import type { SupportedCurrency } from '../i18n/currencies'
import type { Locale } from '../i18n/locales'

export interface UpdateBusinessRequest {
  name?: string
  city?: string | null
  logoUrl?: string | null
  /** Omitted leaves the delivery deposit policy as it is. */
  requireDeliveryDeposit?: boolean
  /*
   * Business settings (Core `UpdateTenantRequest`). Omitted leaves the value
   * as it is. Core rejects country/time-zone changes after `regionLocked` and
   * currency changes after `currencyLocked` with `BUSINESS_SETTINGS_LOCKED`;
   * the document language stays editable. Region needs owner rights.
   */
  countryCode?: 'UA' | 'GB' | 'PL'
  timeZoneId?: string
  documentLanguage?: Locale
  accountingCurrency?: SupportedCurrency
}

const requestConfig = (options: RequestOptions) =>
  options.signal ? { signal: options.signal } : {}

export const businessApi = {
  async update(
    tenantId: string,
    request: UpdateBusinessRequest,
    options: RequestOptions = {},
  ): Promise<Tenant> {
    const response = await apiClient.patch<Tenant>(
      `/tenants/${tenantId}`,
      request,
      requestConfig(options),
    )
    return normalizeTenant(response.data)
  },
}
