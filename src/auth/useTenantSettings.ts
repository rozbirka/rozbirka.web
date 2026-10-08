import { useMemo } from 'react'
import { tenantSettings, type TenantSettings } from '@/api/tenant-settings'
import { useOptionalAuth } from './AuthContext'

/**
 * Business settings of the current tenant (accounting currency, time zone,
 * document language, locks). Unknown values are `null`; the time zone falls
 * back to Europe/Kyiv with `timeZoneKnown: false`. Outside `AuthProvider`
 * everything is unknown.
 */
export function useTenantSettings(): TenantSettings {
  const tenant = useOptionalAuth()?.tenant ?? null
  return useMemo(() => tenantSettings(tenant), [tenant])
}
