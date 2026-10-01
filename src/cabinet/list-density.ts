/**
 * How tightly a list packs its rows.
 *
 * Someone who opens the stock list twice a day wants it readable; someone who
 * lives in it wants to see forty rows without scrolling. This is a personal
 * setting, not a filter, so it does not belong in the URL — and with no
 * endpoint for user preferences it stays in this browser, scoped per user,
 * tenant and screen the way saved views are.
 */

export type ListDensity = 'comfortable' | 'compact'

export interface DensityScope {
  userId: string
  tenantId: string
  /** The list this setting belongs to: "parts", "intakes". */
  screen: string
}

const storageKey = ({ userId, tenantId, screen }: DensityScope) =>
  `rozbirka.density.v1:${userId}:${tenantId}:${screen}`

export const isListDensity = (value: unknown): value is ListDensity =>
  value === 'comfortable' || value === 'compact'

export function readDensity(scope: DensityScope | null): ListDensity {
  if (scope === null || typeof window === 'undefined') return 'comfortable'
  try {
    const stored = localStorage.getItem(storageKey(scope))
    return isListDensity(stored) ? stored : 'comfortable'
  } catch {
    // Storage is unavailable; the roomy default is the safe one to fall back to.
    return 'comfortable'
  }
}

export function writeDensity(scope: DensityScope | null, density: ListDensity) {
  if (scope === null || typeof window === 'undefined') return
  try {
    if (density === 'comfortable') localStorage.removeItem(storageKey(scope))
    else localStorage.setItem(storageKey(scope), density)
  } catch {
    // Storage can be blocked or full; the choice still holds for this visit.
  }
}
