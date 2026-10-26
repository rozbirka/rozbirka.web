import { cabinetModules, type CabinetModuleKey } from './module-registry'

export interface LoadingLayout {
  kind:
    | 'list'
    | 'record'
    | 'form'
    | 'dashboard'
    | 'settings'
    | 'reports'
    | 'plans'
  form?: 'part' | 'intake' | 'car'
  rows: number
  columns: readonly string[]
  stats: number
  thumbnails: boolean
  photo: boolean
}

const list = (columns: readonly string[], rows = 6): LoadingLayout => ({
  kind: 'list',
  columns,
  rows,
  stats: 0,
  thumbnails: false,
  photo: false,
})

/** Shapes only: no record data, totals, permissions or network behaviour. */
const layouts: Record<CabinetModuleKey, LoadingLayout> = {
  dashboard: { ...list(['2fr', '1fr'], 4), kind: 'dashboard', stats: 4 },
  warehouses: { ...list(['4fr', '1fr', '1fr'], 3), stats: 2 },
  inventory: { ...list(['3fr', '1fr', '1fr', '1fr']), stats: 3 },
  cars: { ...list(['3fr', '1fr', '1fr', '1fr', '1fr']), thumbnails: true },
  parts: { ...list(['4fr', '1fr', '1fr', '1fr', '1fr'], 8), thumbnails: true },
  customers: list(['3fr', '2fr', '1fr', '1fr']),
  orders: list(['2fr', '3fr', '1fr', '1fr', '1fr'], 8),
  team: list(['3fr', '1fr', '1fr', '1fr']),
  cash: { ...list(['3fr', '1fr', '1fr', '1fr']), stats: 3 },
  intakes: list(['3fr', '1fr', '1fr', '1fr']),
  stickers: { ...list(['3fr', '1fr'], 4), kind: 'form' },
  reports: { ...list(['2fr', '1fr', '3fr'], 3), kind: 'reports' },
  billing: { ...list(['2fr', '1fr'], 3), kind: 'settings' },
  plans: { ...list(['1fr', '1fr', '1fr'], 3), kind: 'plans' },
  payments: list(['2fr', '1fr', '1fr', '1fr'], 4),
  profile: { ...list(['2fr', '1fr'], 3), kind: 'settings' },
  business: { ...list(['2fr', '1fr'], 3), kind: 'settings' },
  integrations: list(['3fr', '2fr', '1fr'], 3),
}

export function loadingModule(pathname: string): CabinetModuleKey {
  const route = `/${pathname.split('/').filter(Boolean).slice(2).join('/')}`
  return (
    Object.values(cabinetModules)
      .filter(
        ({ routeSegment }) =>
          route === routeSegment || route.startsWith(`${routeSegment}/`),
      )
      .sort(
        (left, right) => right.routeSegment.length - left.routeSegment.length,
      )[0]?.key ?? 'dashboard'
  )
}

export function loadingLayout(
  module: CabinetModuleKey,
  pathname: string,
): LoadingLayout {
  const baseSegments = cabinetModules[module].routeSegment
    .split('/')
    .filter(Boolean).length
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .slice(2 + baseSegments)
  const base = layouts[module]
  const orderItemDrawer =
    module === 'orders' &&
    segments.length === 3 &&
    segments[1] === 'items' &&
    segments[2] === 'new'
  if (
    !orderItemDrawer &&
    segments.some((segment) => segment === 'new' || segment === 'edit')
  )
    return {
      ...base,
      kind: 'form',
      stats: 0,
      ...(module === 'parts' &&
      (segments[0] === 'new' || segments[1] === 'edit')
        ? { form: 'part' as const }
        : module === 'cars'
          ? { form: 'car' as const }
          : module === 'intakes'
            ? {
                form: segments.includes('parts')
                  ? ('part' as const)
                  : ('intake' as const),
              }
            : {}),
    }
  if (module === 'parts' && segments.includes('inventory'))
    return { ...base, kind: 'form', stats: 0, photo: false }
  if (module === 'parts' && segments[0] === 'imports')
    return {
      ...base,
      kind: segments.length > 1 ? 'form' : 'list',
      rows: 4,
      thumbnails: false,
      photo: false,
    }
  if (module === 'integrations' && segments.length > 0) {
    if (segments.includes('dispatch-points')) return base
    if (segments.includes('webhook'))
      return { ...base, kind: 'dashboard', stats: 3 }
    return {
      ...base,
      kind: segments.includes('settings') ? 'form' : 'settings',
      stats: segments.includes('settings') ? 0 : 4,
    }
  }
  if (module === 'warehouses') {
    if (segments.includes('unassigned')) return { ...layouts.parts, stats: 0 }
    if (
      segments[0] === 'zones' ||
      segments[0] === 'sections' ||
      segments[0] === 'shelves'
    )
      return { ...base, rows: 6, columns: ['5fr', '1fr'], stats: 0 }
    return segments.length > 0 ? { ...base, rows: 6 } : base
  }
  if (
    segments.length > 0 &&
    [
      'cars',
      'parts',
      'customers',
      'orders',
      'intakes',
      'cash',
      'inventory',
    ].includes(module)
  )
    return {
      ...base,
      kind: 'record',
      columns: ['3fr', '1fr'],
      thumbnails: false,
      stats: module === 'cars' ? 4 : 0,
      photo: module === 'parts' || module === 'cars',
    }
  return base
}

/** Development-only inspection; deployed builds must ignore this parameter. */
export function loadingPreview(
  search: string,
  development: boolean,
): number | 'hold' | null {
  if (!development) return null
  const value = new URLSearchParams(search).get('loadingPreview')
  if (value === 'hold') return 'hold'
  if (!value || !/^\d+$/.test(value)) return null
  const duration = Number(value)
  return duration >= 100 && duration <= 30000 ? duration : null
}
