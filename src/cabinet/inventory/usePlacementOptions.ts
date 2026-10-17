import { useEffect, useState } from 'react'
import { inventoryApi } from '@/api/inventory'
import type { PlacementOptions } from './part-placement-state'

type ScopedOptions = Omit<PlacementOptions, 'retry'> & {
  tenantId: string | null
}

export function usePlacementOptions(
  enabled: boolean,
  tenantId?: string,
): PlacementOptions {
  const [data, setData] = useState<ScopedOptions>({
    tenantId: null,
    zones: [],
    sections: [],
    shelves: [],
    loading: enabled,
    error: false,
  })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled || !tenantId) return
    const controller = new AbortController()
    // Load once for the form: batch rows share the same tenant-scoped lists.
    Promise.all([
      inventoryApi.getZones({ activeOnly: true, signal: controller.signal }),
      inventoryApi.getSections(undefined, { signal: controller.signal }),
      inventoryApi.getShelves(undefined, { signal: controller.signal }),
    ]).then(
      ([zones, sections, shelves]) => {
        if (!controller.signal.aborted)
          setData({
            tenantId,
            zones,
            sections,
            shelves,
            loading: false,
            error: false,
          })
      },
      () => {
        if (!controller.signal.aborted)
          setData({
            tenantId,
            zones: [],
            sections: [],
            shelves: [],
            loading: false,
            error: true,
          })
      },
    )
    return () => controller.abort()
  }, [enabled, tenantId, attempt])
  return {
    ...(enabled && data.tenantId === tenantId
      ? data
      : {
          zones: [],
          sections: [],
          shelves: [],
          loading: enabled,
          error: false,
        }),
    retry: () => {
      setData((current) => ({ ...current, loading: true, error: false }))
      setAttempt((current) => current + 1)
    },
  }
}
