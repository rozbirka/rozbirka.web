import type { TenantAccessState } from '../access-types'
import { cabinetPath } from '../cabinet-paths'
import {
  cabinetModules,
  type CabinetModuleDefinition,
} from '../module-registry'
import { evaluateModuleAccess, type ModuleAccessOperation } from '../policy'
import type { StickerMode } from './sticker-route'

const locationDefinition: CabinetModuleDefinition = {
  ...cabinetModules.stickers,
  viewPermission: 'inventory.view',
  mutationPermission: 'inventory.view',
}
// Location output reads storage labels; it never consumes a parts quota.
delete locationDefinition.quotaResource

export function stickerAccessDefinition(
  mode: StickerMode,
): CabinetModuleDefinition {
  return mode === 'locations' ? locationDefinition : cabinetModules.stickers
}

export function stickerModeAccess(
  mode: StickerMode,
  access: TenantAccessState,
  operation: ModuleAccessOperation = 'view',
) {
  return evaluateModuleAccess(stickerAccessDefinition(mode), access, operation)
}

export function stickerNavigationTarget(
  tenantSlug: string,
  access: TenantAccessState,
): string | null {
  const base = cabinetPath(tenantSlug, 'stickers')
  if (stickerModeAccess('parts', access).kind === 'allowed') return base
  if (stickerModeAccess('locations', access).kind === 'allowed')
    return `${base}?type=locations`
  return null
}
