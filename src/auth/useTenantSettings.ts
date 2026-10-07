import { useMemo } from 'react'
import { tenantSettings, type TenantSettings } from '@/api/tenant-settings'
import { useAuth, type AuthContextValue } from './AuthContext'

/**
 * The auth context, or `null` outside `AuthProvider` (isolated screens and
 * tests). `useAuth` always reads the context first, so hook order is stable.
 */
export function useAuthOrNull(): AuthContextValue | null {
  try {
    return useAuth()
  } catch {
    return null
  }
}

/**
 * Business settings of the current tenant (accounting currency, time zone,
 * document language, locks). Unknown values are `null`; the time zone falls
 * back to Europe/Kyiv with `timeZoneKnown: false`. Outside `AuthProvider`
 * everything is unknown.
 */
export function useTenantSettings(): TenantSettings {
  const tenant = useAuthOrNull()?.tenant ?? null
  return useMemo(() => tenantSettings(tenant), [tenant])
}
