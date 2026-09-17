/**
 * Named filter sets for a list screen.
 *
 * Every list already keeps its filters in the URL, so a saved view is nothing
 * but that query string with a name on it. There is no endpoint for user
 * preferences, so views live in this browser only — scoped per user, per
 * tenant and per screen, the way the sticker queue is. Screens that offer them
 * say so out loud rather than letting someone believe their view followed them
 * to another machine.
 */

export interface SavedView {
  id: string
  name: string
  /** The list's query string without a leading "?" — "status=reserved&page=1". */
  query: string
}

export interface SavedViewScope {
  userId: string
  tenantId: string
  /** The list these views belong to: "parts", "intakes". */
  screen: string
}

const MAX_VIEWS = 12
const MAX_NAME = 60

const storageKey = ({ userId, tenantId, screen }: SavedViewScope) =>
  `rozbirka.views.v1:${userId}:${tenantId}:${screen}`

const validView = (value: unknown): value is SavedView => {
  if (typeof value !== 'object' || value === null) return false
  const view = value as Record<string, unknown>
  return (
    typeof view['id'] === 'string' &&
    view['id'].length > 0 &&
    typeof view['name'] === 'string' &&
    view['name'].trim().length > 0 &&
    view['name'].length <= MAX_NAME &&
    typeof view['query'] === 'string'
  )
}

export function readSavedViews(scope: SavedViewScope): SavedView[] {
  if (typeof window === 'undefined') return []
  const key = storageKey(scope)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const stored: unknown = JSON.parse(raw)
    if (
      typeof stored !== 'object' ||
      stored === null ||
      (stored as { version?: unknown }).version !== 1 ||
      !Array.isArray((stored as { views?: unknown }).views) ||
      !(stored as { views: unknown[] }).views.every(validView)
    ) {
      localStorage.removeItem(key)
      return []
    }
    return (stored as { views: SavedView[] }).views.slice(0, MAX_VIEWS)
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage is unavailable; the screen runs without saved views.
    }
    return []
  }
}

export function writeSavedViews(
  scope: SavedViewScope,
  views: readonly SavedView[],
) {
  if (typeof window === 'undefined') return
  const key = storageKey(scope)
  try {
    if (views.length === 0) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, views: views.slice(0, MAX_VIEWS) }),
    )
  } catch {
    // Storage can be blocked or full; the views held in memory still work for
    // this visit.
  }
}

/** How many views one screen may hold before saving is refused. */
export const savedViewLimit = MAX_VIEWS

/**
 * Two query strings describe the same view when they carry the same parameters,
 * whatever order they were written in. Page number is not part of the identity:
 * a view is a filter, and paging through it does not make it a different view.
 */
export function sameView(left: string, right: string) {
  const normalize = (query: string) =>
    [...new URLSearchParams(query).entries()]
      .filter(([key]) => key !== 'page')
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('&')
  return normalize(left) === normalize(right)
}
