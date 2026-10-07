import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useCabinet } from '../CabinetContext'
import { CURRENCY_DRAFT_PARAM } from './return-path'

/**
 * A price form's draft that survives the trip to the accounting-currency
 * setting and back — the approach of the part form (`source-return.ts`),
 * for every other price form (cars, car expenses, batches, batch positions,
 * orders and order items).
 *
 * The draft lives in session storage under the form's `kind`, scoped to the
 * tenant's cabinet. It is offered back only when the return path carries
 * `draft=1` (set by `currencyReturnPath`) and is removed once read, so a
 * later visit starts clean. Files (photos) are not kept.
 */
const PREFIX = 'rozbirka:currency-draft:'

interface StoredDraft<Values> {
  root: string
  values: Values
}

export function saveCurrencyDraft<Values>(
  kind: string,
  root: string,
  values: Values,
) {
  try {
    const draft: StoredDraft<Values> = { root, values }
    sessionStorage.setItem(PREFIX + kind, JSON.stringify(draft))
  } catch {
    // Storage unavailable: the user retypes the form.
  }
}

export function takeCurrencyDraft<Values>(
  kind: string,
  root: string,
): Values | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + kind)
    if (!raw) return null
    const draft = JSON.parse(raw) as StoredDraft<Values>
    return draft.root === root ? draft.values : null
  } catch {
    return null
  }
}

export function clearCurrencyDraft(kind: string) {
  try {
    sessionStorage.removeItem(PREFIX + kind)
  } catch {
    // Nothing to clear.
  }
}

/**
 * Drafts already taken out of storage on this return, so a form that mounts
 * twice (a loading state in between) still gets it; a fresh trip replaces it.
 */
const restored = new Map<string, unknown>()

/**
 * The draft of one price form: `initial` is what was typed before leaving
 * for the currency setting (only on the way back), `keep` stores the current
 * values right before leaving.
 */
export function useCurrencyDraft<Values>(kind: string): {
  initial: Values | null
  keep: (values: Values) => void
} {
  const [searchParams] = useSearchParams()
  const { targetTenant } = useCabinet()
  const root = `/app/${targetTenant?.slug ?? ''}`
  const [initial] = useState<Values | null>(() => {
    if (searchParams.get(CURRENCY_DRAFT_PARAM) !== '1') return null
    const key = `${root}|${kind}`
    const stored = takeCurrencyDraft<Values>(kind, root)
    if (stored !== null) restored.set(key, stored)
    return (restored.get(key) as Values | undefined) ?? null
  })
  useEffect(() => {
    if (initial !== null) clearCurrencyDraft(kind)
  }, [initial, kind])
  const keep = useCallback(
    (values: Values) => {
      restored.delete(`${root}|${kind}`)
      saveCurrencyDraft(kind, root, values)
    },
    [kind, root],
  )
  return { initial, keep }
}
