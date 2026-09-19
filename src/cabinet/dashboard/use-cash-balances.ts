import { useEffect, useState } from 'react'
import { cashApi } from '@/api/cash'
import { useCabinet } from '../CabinetContext'

/**
 * Cash balances for the summary tile, per currency.
 *
 * The dashboard payload carries one figure — `totalBalanceUah` — so a yard that
 * also keeps dollars saw only half of its money there. The till list has every
 * currency, and totals are added up within a currency and never across one:
 * there is no rate anywhere in the cabinet, and inventing one would be worse
 * than showing two numbers.
 *
 * Without `finance.view` the request is never made; a failure leaves the tile
 * on the figure the dashboard itself reported.
 */
export function useCashBalances(): Record<string, number> | null {
  const { snapshot } = useCabinet()
  const tenantId = snapshot?.tenantId ?? null
  const generation = snapshot?.generation ?? null
  const allowed = snapshot?.permissions.has('finance.view') === true
  const [balances, setBalances] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!allowed || tenantId === null) return
    const controller = new AbortController()
    void cashApi
      .list(undefined, { signal: controller.signal })
      .then((registers) => {
        if (controller.signal.aborted) return
        const totals: Record<string, number> = {}
        for (const register of registers)
          for (const [currency, amount] of Object.entries(register.balances))
            totals[currency] = (totals[currency] ?? 0) + amount
        setBalances(totals)
      })
      .catch(() => {
        if (!controller.signal.aborted) setBalances(null)
      })
    return () => controller.abort()
  }, [allowed, generation, tenantId])

  return allowed ? balances : null
}
