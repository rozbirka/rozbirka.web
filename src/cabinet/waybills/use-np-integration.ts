import { useEffect, useState } from 'react'
import { integrationsApi } from '@/api/integrations'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useLocale } from '@/i18n'
import {
  isNovaPoshtaAvailable,
  NOVA_POSHTA,
} from '../integrations/integration-labels'
import { deliveryProblemMessage } from '../orders/delivery/nova-poshta-availability'

/** When Nova Poshta was switched off and by whom, as Core recorded it. */
export interface SwitchedOff {
  at: string
  by: string | null
}

export type NpIntegrationState =
  | { kind: 'loading' }
  | {
      kind: 'ready'
      integrationId: string
      /** Set while the integration is switched off (module 46 §2.18). */
      switchedOff: SwitchedOff | null
    }
  /** Outside Ukraine, or a tenant that never connected Nova Poshta. */
  | { kind: 'unavailable'; reason: 'country' | 'missing' }
  | { kind: 'error'; message: string }

/**
 * The tenant's Nova Poshta integration — there is one per tenant — which every
 * waybill call hangs off. A switched-off integration still owns its waybills,
 * so only a draft one (never connected) counts as missing.
 */
export function useNpIntegration(attempt = 0): NpIntegrationState {
  const { countryCode } = useTenantSettings()
  const { locale } = useLocale()
  const available = isNovaPoshtaAvailable(countryCode)
  const [state, setState] = useState<NpIntegrationState>({ kind: 'loading' })

  useEffect(() => {
    if (!available) return
    const controller = new AbortController()
    void integrationsApi.list({ signal: controller.signal }).then(
      (items) => {
        if (controller.signal.aborted) return
        const nova = items.find((item) => item.code === NOVA_POSHTA)
        setState(
          nova === undefined || nova.status === 'draft'
            ? { kind: 'unavailable', reason: 'missing' }
            : {
                kind: 'ready',
                integrationId: nova.id,
                switchedOff:
                  nova.status === 'inactive' && nova.deactivatedAt !== null
                    ? { at: nova.deactivatedAt, by: nova.deactivatedBy }
                    : null,
              },
        )
      },
      (problem: unknown) => {
        if (!controller.signal.aborted)
          setState({
            kind: 'error',
            message: deliveryProblemMessage(problem, locale),
          })
      },
    )
    return () => controller.abort()
    // The message is chosen when the request fails, not re-run per locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, attempt])

  return available ? state : { kind: 'unavailable', reason: 'country' }
}
