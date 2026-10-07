import { useMemo } from 'react'
import { tenantSettings, type TenantSettings } from '@/api/tenant-settings'
import { useAuth } from './AuthContext'

/**
 * Business settings of the current tenant (accounting currency, time zone,
 * document language, locks). Unknown values are `null`; the time zone falls
 * back to Europe/Kyiv with `timeZoneKnown: false`.
 */
export function useTenantSettings(): TenantSettings {
  const { tenant } = useAuth()
  return useMemo(() => tenantSettings(tenant), [tenant])
}
