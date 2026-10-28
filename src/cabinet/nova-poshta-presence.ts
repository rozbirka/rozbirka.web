import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { integrationsApi } from '@/api/integrations'
import { tenantSettings } from '@/api/tenant-settings'
import type { Tenant } from '@/api/types'
import type { TenantAccessSnapshot } from './access-types'
import {
  isNovaPoshtaAvailable,
  NOVA_POSHTA,
} from './integrations/integration-labels'
import { cabinetModules, type CabinetModuleKey } from './module-registry'

/**
 * Whether a tenant has Nova Poshta at all, for the modules that only make
 * sense with it (`requiresNovaPoshta`, today «Накладні НП»).
 *
 * The business country is known up front. The integration itself is not:
 * Core lists integrations only with «Налаштування інтеграцій», so the answer
 * is asked once per tenant and only by an account that may ask. Everyone else
 * keeps the item — the screen explains a missing integration on its own.
 */
type Presence = 'unknown' | 'present' | 'absent'

const answers = new Map<string, Presence>()
const pending = new Set<string>()
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function ask(tenantId: string) {
  if (answers.has(tenantId) || pending.has(tenantId)) return
  pending.add(tenantId)
  void integrationsApi
    .list()
    .then(
      (items) => {
        // A draft integration was never connected, so it holds no waybills.
        const nova = items.find((item) => item.code === NOVA_POSHTA)
        answers.set(
          tenantId,
          nova !== undefined && nova.status !== 'draft' ? 'present' : 'absent',
        )
      },
      () => {
        // A failed read is not «no Nova Poshta»; the screen reports the failure.
        answers.set(tenantId, 'present')
      },
    )
    .finally(() => {
      pending.delete(tenantId)
      notify()
    })
}

/** Asks again on next use — after Nova Poshta was connected or removed. */
export function forgetNovaPoshtaPresence() {
  answers.clear()
  notify()
}

/** The modules to leave out of the navigation and the command palette. */
export function useHiddenModules(
  tenant: Tenant,
  snapshot: TenantAccessSnapshot,
): ReadonlySet<CabinetModuleKey> {
  const country = isNovaPoshtaAvailable(tenantSettings(tenant).countryCode)
  const canAsk = country && snapshot.permissions.has('team.manage')
  const presence = useSyncExternalStore(
    subscribe,
    () => (canAsk ? (answers.get(tenant.id) ?? 'unknown') : 'present'),
    () => 'present',
  )
  useEffect(() => {
    if (canAsk) ask(tenant.id)
  }, [canAsk, tenant.id])

  return useMemo(() => {
    if (country && presence === 'present') return new Set()
    return new Set(
      Object.values(cabinetModules)
        .filter((definition) => definition.requiresNovaPoshta === true)
        .map((definition) => definition.key),
    )
  }, [country, presence])
}
