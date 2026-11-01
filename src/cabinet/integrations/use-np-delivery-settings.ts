import { useCallback, useEffect, useState } from 'react'
import { cashApi, type CashRegister } from '@/api/cash'
import {
  integrationsApi,
  type NovaPoshtaContact,
  type NovaPoshtaCounterparty,
  type NovaPoshtaDispatchPoint,
  type NovaPoshtaPreferences,
} from '@/api/integrations'
import { uahTills } from './np-setup-model'

export interface NpDeliverySettings {
  preferences: NovaPoshtaPreferences
  /** Null when the carrier could not be read; names then fall back to the point. */
  senders: NovaPoshtaCounterparty[] | null
  /** Active points only: an inactive one is not offered anywhere. */
  points: NovaPoshtaDispatchPoint[]
  /** Hryvnia tills; empty when the cash module is not readable. */
  tills: CashRegister[]
}

export type NpDeliverySettingsState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: NpDeliverySettings }
  | { kind: 'error' }

/**
 * What the integration dispatches with today: the sender and contact it was
 * set up with, the default point and the till. The overview names them and
 * the settings tab edits them, so both read the same load.
 */
export function useNpDeliverySettings(
  integrationId: string,
  enabled: boolean,
): { state: NpDeliverySettingsState; reload: () => void } {
  const [state, setState] = useState<NpDeliverySettingsState>({
    kind: 'loading',
  })
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    if (!enabled || integrationId === '') return
    const controller = new AbortController()
    const signal = controller.signal
    void Promise.allSettled([
      integrationsApi.preferences(integrationId, { signal }),
      integrationsApi.senders(integrationId, { signal }),
      integrationsApi.dispatchPoints(integrationId, { signal }),
      cashApi.list(true, { signal }),
    ]).then(([preferences, senders, points, tills]) => {
      if (signal.aborted) return
      if (preferences.status === 'rejected' || points.status === 'rejected') {
        setState({ kind: 'error' })
        return
      }
      setState({
        kind: 'ready',
        data: {
          preferences: preferences.value,
          senders: senders.status === 'fulfilled' ? senders.value : null,
          points: points.value.filter((point) => point.isActive),
          tills: tills.status === 'fulfilled' ? uahTills(tills.value) : [],
        },
      })
    })
    return () => controller.abort()
  }, [enabled, integrationId, reloads])

  const reload = useCallback(() => setReloads((value) => value + 1), [])
  return { state, reload }
}

/** The contact people of one sender, read through the stored key. */
export function useSenderContacts(
  integrationId: string,
  senderRef: string | null,
): NovaPoshtaContact[] | null {
  const [loaded, setLoaded] = useState<{
    senderRef: string
    items: NovaPoshtaContact[]
  } | null>(null)

  useEffect(() => {
    if (senderRef === null || integrationId === '') return
    const controller = new AbortController()
    void integrationsApi
      .senderContacts(integrationId, senderRef, { signal: controller.signal })
      .then(
        (items) => {
          if (!controller.signal.aborted) setLoaded({ senderRef, items })
        },
        () => {
          if (!controller.signal.aborted) setLoaded({ senderRef, items: [] })
        },
      )
    return () => controller.abort()
  }, [integrationId, senderRef])

  return senderRef !== null && loaded?.senderRef === senderRef
    ? loaded.items
    : null
}

/** The point new waybills leave from: the default one, else the first. */
export const defaultPoint = (
  points: readonly NovaPoshtaDispatchPoint[],
): NovaPoshtaDispatchPoint | null =>
  points.find((point) => point.isDefault) ?? points[0] ?? null
