import { useEffect, useState } from 'react'
import { carsApi, type CarListItem } from '@/api/cars'
import { cashApi, type CashRegister } from '@/api/cash'
import { intakesApi, type IntakeListItem } from '@/api/intakes'
import { ordersApi, type OrderListItem } from '@/api/orders'
import { partsApi, type PartsSummary } from '@/api/parts'
import { useCabinet } from '../CabinetContext'

/**
 * The dashboard's panels each read the module they belong to, the same way the
 * list screens read it. They are deliberately separate from the `/dashboard`
 * payload: that endpoint carries counters, not rows, and a panel that has
 * nothing to show is better than a panel that shows an invented row.
 *
 * Every one of these is silent on failure — the board still stands without a
 * single panel, and an error banner per card would drown the screen.
 */
function useResource<T>(
  enabled: boolean,
  load: (signal: AbortSignal) => Promise<T>,
  /** Values that make the request a different request. */
  key: string,
): T | null {
  const { snapshot } = useCabinet()
  const generation = snapshot?.generation ?? null
  const tenantId = snapshot?.tenantId ?? null
  const [value, setValue] = useState<T | null>(null)

  useEffect(() => {
    if (!enabled || tenantId === null) {
      return
    }
    const controller = new AbortController()
    void load(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setValue(result)
      },
      () => {
        if (!controller.signal.aborted) setValue(null)
      },
    )
    return () => controller.abort()
    // `load` is rebuilt on every render; `key` is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, generation, tenantId, key])

  return enabled ? value : null
}

export function useRecentOrders(
  enabled: boolean,
  limit: number,
): OrderListItem[] | null {
  return useResource(
    enabled,
    (signal) =>
      ordersApi
        .list({ pageSize: limit }, { signal })
        .then((page) => page.items),
    `orders:${String(limit)}`,
  )
}

export interface PayoffCars {
  items: CarListItem[]
  /** How many active cars there are in total, for the «Усі N» link. */
  total: number
}

export function usePayoffCars(
  enabled: boolean,
  limit: number,
): PayoffCars | null {
  return useResource(
    enabled,
    (signal) =>
      carsApi
        .list({ status: 'active', pageSize: limit }, { signal })
        .then((page) => ({ items: page.items, total: page.total })),
    `cars:${String(limit)}`,
  )
}

export function useCashRegisters(enabled: boolean): CashRegister[] | null {
  return useResource(
    enabled,
    (signal) => cashApi.list(true, { signal }),
    'cash',
  )
}

export function useRecentIntakes(
  enabled: boolean,
  limit: number,
): IntakeListItem[] | null {
  return useResource(
    enabled,
    (signal) =>
      intakesApi
        .list({ pageSize: limit }, { signal })
        .then((page) => page.items),
    `intakes:${String(limit)}`,
  )
}

export function usePartsSummary(enabled: boolean): PartsSummary | null {
  return useResource(enabled, (signal) => partsApi.summary({ signal }), 'parts')
}
