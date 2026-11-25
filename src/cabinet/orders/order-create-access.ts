import type { TenantAccessSnapshot } from '../access-types'
import {
  cabinetModules,
  type CabinetModuleDefinition,
} from '../module-registry'
import { evaluateModuleAccess } from '../policy'

export function canCreateOrder(
  snapshot: TenantAccessSnapshot | null,
  definition: CabinetModuleDefinition = cabinetModules.orders,
) {
  if (!snapshot) return false
  const access = { status: 'ready' as const, snapshot, error: null }
  return (
    snapshot.permissions.has('parts.view') &&
    snapshot.permissions.has('customers.view') &&
    evaluateModuleAccess(definition, access, 'view').kind === 'allowed' &&
    evaluateModuleAccess(definition, access, 'mutation').kind === 'allowed'
  )
}
