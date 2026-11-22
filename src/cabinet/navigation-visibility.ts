import { useMemo } from 'react'
import type { Tenant } from '@/api/types'
import type { TenantAccessSnapshot } from './access-types'
import { useNovaPoshtaHiddenModules } from './nova-poshta-presence'
import { useOlxNavigationVisible } from './olx/olx-navigation-presence'

export function useHiddenModules(
  tenant: Tenant,
  snapshot: TenantAccessSnapshot,
) {
  const hidden = useNovaPoshtaHiddenModules(tenant, snapshot)
  const olxVisible = useOlxNavigationVisible(snapshot)
  return useMemo(
    () => (olxVisible ? hidden : new Set([...hidden, 'olx'] as const)),
    [hidden, olxVisible],
  )
}
