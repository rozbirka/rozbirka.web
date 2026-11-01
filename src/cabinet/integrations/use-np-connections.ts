import { useCallback, useEffect, useState } from 'react'
import {
  novaPoshtaSetupApi,
  type NovaPoshtaConnection,
} from '@/api/nova-poshta-setup'

/**
 * Every carrier cabinet the integration has been connected to. Core lists
 * them only with the integrations right, so without it (or without an
 * integration) nothing is asked and the list stays `null`.
 */
export function useNpConnections(
  integrationId: string | null,
  enabled: boolean,
): { connections: NovaPoshtaConnection[] | null; reload: () => void } {
  const [loaded, setLoaded] = useState<{
    key: string
    items: NovaPoshtaConnection[]
  } | null>(null)
  const [reloads, setReloads] = useState(0)
  const key = `${integrationId ?? ''}:${String(enabled)}`

  useEffect(() => {
    if (!enabled || integrationId === null) return
    const controller = new AbortController()
    void novaPoshtaSetupApi
      .connections(integrationId, { signal: controller.signal })
      .then(
        (items) => {
          if (!controller.signal.aborted)
            setLoaded({ key: `${integrationId}:true`, items })
        },
        () => {
          // An unreadable list is not a lost cabinet: show nothing extra.
        },
      )
    return () => controller.abort()
  }, [enabled, integrationId, reloads])

  const reload = useCallback(() => setReloads((value) => value + 1), [])
  return {
    connections: enabled && loaded?.key === key ? loaded.items : null,
    reload,
  }
}

/**
 * The cabinet a waybill was created in, when that cabinet's key no longer
 * works — the «Втрачено доступ / Немає доступу» state. A waybill older than
 * connection tracking (`connectionId: null`) belongs to the current cabinet.
 */
export function lostAccessConnection(
  connections: readonly NovaPoshtaConnection[] | null,
  connectionId: string | null | undefined,
): NovaPoshtaConnection | null {
  if (connections === null || connectionId == null) return null
  const found = connections.find((item) => item.id === connectionId)
  return found !== undefined && !found.hasVerifiedAccess ? found : null
}
