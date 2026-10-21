import { useCallback } from 'react'
import { teamApi } from '@/api/team'
import { useLoad, usePermission } from './use-stock-resource'

/** Team failures never replace stocktake data with an empty screen or list. */
export function useInventoryTeam() {
  const allowed = usePermission('team.view')
  const loader = useCallback(
    async (signal: AbortSignal) => {
      if (!allowed) return []
      const members = await teamApi.listMembers({ signal })
      return members.map(({ userId, name }) => ({ userId, name }))
    },
    [allowed],
  )
  const resource = useLoad(loader, 'inventory-team')
  const { refresh: refreshData } = resource
  const refresh = useCallback(() => {
    if (allowed) refreshData()
  }, [allowed, refreshData])
  return {
    ...resource,
    refresh,
    allowed,
    people:
      allowed && resource.state.kind === 'ready' ? resource.state.data : [],
    empty:
      allowed &&
      resource.state.kind === 'ready' &&
      !resource.state.refreshError &&
      resource.state.data.length === 0,
  }
}
