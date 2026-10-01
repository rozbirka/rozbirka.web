import type { CompatibilityRow } from './compatibility-rows'

/**
 * Creating a car or intake from the part form leaves the form. The typed part
 * travels in session storage and the source-create screen sends the user back
 * with the new source chosen. Photos are files and do not survive the trip.
 */
const DRAFT_KEY = 'rozbirka:part-create-draft'
export const RETURN_PARAM = 'return_to'
export const DRAFT_PARAM = 'draft'

export interface PartCreateDraft<Values> {
  root: string
  values: Values
  compatibility: CompatibilityRow[]
}

export function savePartDraft<Values>(draft: PartCreateDraft<Values>) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Storage may be unavailable; the user then retypes the part.
  }
}

export function readPartDraft<Values>(
  root: string,
): PartCreateDraft<Values> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as PartCreateDraft<Values>
    return draft.root === root ? draft : null
  } catch {
    return null
  }
}

export function clearPartDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** `root` is the tenant's cabinet path, e.g. `/app/acme`. */
export function sourceCreateHref(
  root: string,
  kind: 'cars' | 'intakes',
  returnTo: string,
) {
  return `${root}/${kind}/new?${RETURN_PARAM}=${encodeURIComponent(returnTo)}`
}

/**
 * The part form to go back to, with the new source chosen. Only a path inside
 * the same tenant's cabinet is accepted, so the parameter cannot redirect away.
 */
export function sourceReturnPath(
  search: URLSearchParams,
  root: string,
  source?: { carId?: string; intakeId?: string },
): string | null {
  const target = search.get(RETURN_PARAM)
  if (!target || !target.startsWith(`${root}/`) || target.startsWith('//'))
    return null
  const url = new URL(target, 'http://return.local')
  if (url.origin !== 'http://return.local') return null
  url.searchParams.delete('car_id')
  url.searchParams.delete('intake_id')
  if (source?.carId) url.searchParams.set('car_id', source.carId)
  else if (source?.intakeId) url.searchParams.set('intake_id', source.intakeId)
  url.searchParams.set(DRAFT_PARAM, '1')
  return `${url.pathname}${url.search}`
}
