import type { Tenant } from '../api/types'
import { readPlanCode } from '../lib/plan-selection'
import {
  cabinetModules,
  type CabinetModuleKey,
  type RegisteredFeatureModule,
} from './module-registry'

export const CABINET_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62})$/

export function cabinetPath(
  slug: string,
  module: CabinetModuleKey,
  suffix?: string,
): string {
  if (!CABINET_SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid tenant slug: ${slug}`)
  }

  const base = `/app/${slug}${cabinetModules[module].routeSegment}`
  if (suffix === undefined || suffix === '') return base

  const segments = suffix.replace(/^\/+|\/+$/g, '').split('/')
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    throw new Error(`Invalid cabinet path suffix: ${suffix}`)
  }

  return `${base}/${segments.map(encodeURIComponent).join('/')}`
}

export function resolveAccountDestination(
  tenant: Pick<Tenant, 'slug'>,
  search: string,
): string {
  const params = new URLSearchParams(search)

  switch (params.get('section')) {
    case 'subscription':
      return cabinetPath(tenant.slug, 'billing')
    case 'plans': {
      const plan = readPlanCode(search)
      const destination = cabinetPath(tenant.slug, 'plans')
      return plan === null ? destination : `${destination}?plan=${plan}`
    }
    case 'payment':
    case 'billing':
      return cabinetPath(tenant.slug, 'payments')
    default: {
      const destination = cabinetPath(tenant.slug, 'dashboard')
      const scan = params.get('scan')
      return scan !== null && /^[A-Za-z0-9._~-]{1,256}$/.test(scan)
        ? `${destination}?scan=${encodeURIComponent(scan)}`
        : destination
    }
  }
}

type ModuleFeatureDestination =
  | { kind: 'list' }
  | { kind: 'view'; id: string }
  | { kind: 'create'; partId: string }

export function moduleFeaturePath(
  slug: string,
  entry: RegisteredFeatureModule,
  destination: ModuleFeatureDestination,
): string {
  if (
    !CABINET_SLUG_PATTERN.test(slug) ||
    !/^[a-z][a-z0-9-]{0,31}$/.test(entry.code)
  ) {
    throw new Error('Invalid module destination')
  }
  const base = `/app/${slug}/modules/${entry.code}/parts`
  if (destination.kind === 'list') return base
  const id = destination.kind === 'view' ? destination.id : destination.partId
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new Error('Invalid module resource ID')
  }
  return destination.kind === 'view'
    ? `${base}/${id}`
    : `${base}/new?partId=${id}`
}
