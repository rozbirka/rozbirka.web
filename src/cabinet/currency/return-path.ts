/**
 * The owner leaves a price form to choose the accounting currency and comes
 * back to it. Same mechanism as the part source flow (`source-return.ts`):
 * the form path travels in `return_to` and only a path inside the same
 * tenant's cabinet is accepted on the way back.
 */
export const CURRENCY_RETURN_PARAM = 'return_to'
/** Set on the way back so a form that keeps a draft restores it. */
export const CURRENCY_DRAFT_PARAM = 'draft'

export function currencySettingsHref(settingsPath: string, returnTo: string) {
  return `${settingsPath}?${CURRENCY_RETURN_PARAM}=${encodeURIComponent(returnTo)}`
}

/** `root` is the tenant's cabinet path, e.g. `/app/acme`. */
export function currencyReturnPath(
  search: URLSearchParams,
  root: string,
): string | null {
  const target = search.get(CURRENCY_RETURN_PARAM)
  if (!target || !target.startsWith(`${root}/`) || target.startsWith('//'))
    return null
  const url = new URL(target, 'http://return.local')
  if (url.origin !== 'http://return.local') return null
  if (!url.pathname.startsWith(`${root}/`)) return null
  url.searchParams.set(CURRENCY_DRAFT_PARAM, '1')
  return `${url.pathname}${url.search}`
}
