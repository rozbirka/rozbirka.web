import { useEffect, useState } from 'react'
import { cashApi, type CashRegister } from '@/api/cash'
import { intakesApi, type IntakeListItem } from '@/api/intakes'
import { ordersApi, type OrderListItem } from '@/api/orders'
import { useCabinet } from '../CabinetContext'

export type DashboardExtraLoadable<T> =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: null }

interface DashboardExtrasState {
  cashBalances: DashboardExtraLoadable<Record<string, number>>
  recentOrders: DashboardExtraLoadable<OrderListItem[]>
  recentIntakes: DashboardExtraLoadable<IntakeListItem[]>
}

const loading = { status: 'loading', data: null } as const

export function useDashboardExtras({
  cashEnabled,
  intakesEnabled,
  ordersEnabled,
}: {
  cashEnabled: boolean
  intakesEnabled: boolean
  ordersEnabled: boolean
}): DashboardExtrasState {
  const cabinet = useCabinet()
  const scope =
    cabinet.status === 'ready' && cabinet.snapshot !== null
      ? `${cabinet.snapshot.userId}:${cabinet.snapshot.tenantId}:${cabinet.snapshot.generation}`
      : null
  const [state, setState] = useState<DashboardExtrasState>({
    cashBalances: loading,
    recentOrders: loading,
    recentIntakes: loading,
  })

  useEffect(() => {
    let active = true
    if (scope === null) {
      queueMicrotask(() => {
        if (active) {
          setState({
            cashBalances: loading,
            recentOrders: loading,
            recentIntakes: loading,
          })
        }
      })
      return () => {
        active = false
      }
    }

    const controller = new AbortController()
    if (!cashEnabled && !ordersEnabled && !intakesEnabled) {
      return () => {
        active = false
        controller.abort()
      }
    }
    queueMicrotask(() => {
      if (!active) return
      setState({
        cashBalances: cashEnabled ? loading : { status: 'ready', data: {} },
        recentOrders: ordersEnabled ? loading : { status: 'ready', data: [] },
        recentIntakes: intakesEnabled ? loading : { status: 'ready', data: [] },
      })
    })

    if (cashEnabled) {
      void cashApi
        .list(true, { signal: controller.signal })
        .then((registers) => {
          if (controller.signal.aborted) return
          setState((current) => ({
            ...current,
            cashBalances: {
              status: 'ready',
              data: totalCashBalances(registers),
            },
          }))
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setState((current) => ({
            ...current,
            cashBalances: { status: 'error', data: null },
          }))
        })
    }

    if (ordersEnabled) {
      void ordersApi
        .list({ page: 1, pageSize: 4 }, { signal: controller.signal })
        .then((page) => {
          if (controller.signal.aborted) return
          setState((current) => ({
            ...current,
            recentOrders: { status: 'ready', data: page.items },
          }))
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setState((current) => ({
            ...current,
            recentOrders: { status: 'error', data: null },
          }))
        })
    }

    if (intakesEnabled) {
      void intakesApi
        .list({ page: 1, pageSize: 3 }, { signal: controller.signal })
        .then((page) => {
          if (controller.signal.aborted) return
          setState((current) => ({
            ...current,
            recentIntakes: { status: 'ready', data: page.items },
          }))
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setState((current) => ({
            ...current,
            recentIntakes: { status: 'error', data: null },
          }))
        })
    }

    return () => {
      active = false
      controller.abort()
    }
  }, [cashEnabled, intakesEnabled, ordersEnabled, scope])

  return state
}

function totalCashBalances(registers: CashRegister[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const register of registers) {
    for (const [currency, balance] of Object.entries(register.balances)) {
      if (!Number.isFinite(balance)) continue
      totals[currency] = (totals[currency] ?? 0) + balance
    }
  }
  return totals
}
