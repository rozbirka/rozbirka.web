import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { CloudOff, Truck } from 'lucide-react'
import { Button, StateScreen } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { evaluateModuleAccess } from '../policy'
import { deliveryMessages } from '../orders/delivery/messages'
import { WaybillCard } from './WaybillCard'
import { WaybillList } from './WaybillList'
import { useNpIntegration, type NpIntegrationState } from './use-np-integration'
import { waybillsMessages } from './waybills-messages'

/** What the signed-in account may do with waybills (module 46 §11 «Права»). */
export interface WaybillRights {
  /** «Керування замовленнями»: edit, cancel, check a result. */
  manage: boolean
  /** «Фінанси»: COD amounts and their filter. */
  finance: boolean
  /** «Налаштування інтеграцій»: recover access, open the integration. */
  integrations: boolean
}

/**
 * «Накладні НП» (module 46 §7–8): the list at `/sales/waybills`, one waybill
 * at `/sales/waybills/:shipmentId`. Both read the tenant's single Nova Poshta
 * integration first — every waybill call hangs off it.
 */
export function WaybillsScreen({ definition }: CabinetModuleScreenProps) {
  const { shipmentId } = useParams()
  const cabinet = useCabinet()
  const [attempt, setAttempt] = useState(0)
  const np = useNpIntegration(attempt)
  const snapshot = cabinet.snapshot
  const rights: WaybillRights = {
    manage:
      snapshot !== null &&
      evaluateModuleAccess(
        definition,
        { status: 'ready', snapshot, error: null },
        'mutation',
      ).kind === 'allowed',
    finance: snapshot?.permissions.has('finance.view') === true,
    integrations: snapshot?.permissions.has('team.manage') === true,
  }
  const slug = cabinet.targetTenant?.slug ?? null
  if (slug === null) return null

  const fallback =
    np.kind === 'unavailable' || np.kind === 'error' ? (
      <IntegrationState
        np={np}
        onRetry={() => setAttempt((value) => value + 1)}
        integrationsPath={
          rights.integrations ? cabinetPath(slug, 'integrations') : null
        }
      />
    ) : null
  const integrationId = np.kind === 'ready' ? np.integrationId : null

  return shipmentId === undefined ? (
    <WaybillList
      fallback={fallback}
      integrationId={integrationId}
      rights={rights}
      slug={slug}
    />
  ) : (
    <WaybillCard
      fallback={fallback}
      integrationId={integrationId}
      rights={rights}
      shipmentId={shipmentId}
      slug={slug}
      switchedOff={np.kind === 'ready' ? np.switchedOff : null}
    />
  )
}

/** Nova Poshta out of reach: outside Ukraine, not connected, or unreadable. */
function IntegrationState({
  np,
  onRetry,
  integrationsPath,
}: {
  np: Extract<NpIntegrationState, { kind: 'unavailable' | 'error' }>
  onRetry: () => void
  integrationsPath: string | null
}) {
  const t = useT(waybillsMessages)
  const td = useT(deliveryMessages)
  const tc = useT(commonMessages)
  if (np.kind === 'error')
    return (
      <StateScreen
        actions={<Button onClick={onRetry}>{tc('retry')}</Button>}
        description={np.message}
        icon={<CloudOff aria-hidden />}
        role="alert"
        title={t('errorTitle')}
        tone="danger"
      />
    )
  return (
    <StateScreen
      actions={
        np.reason === 'missing' && integrationsPath !== null ? (
          <Button asChild>
            <Link to={integrationsPath}>{td('openIntegrations')}</Link>
          </Button>
        ) : undefined
      }
      description={
        np.reason === 'country'
          ? td('countryUnavailable')
          : td('npNotConnected')
      }
      icon={<Truck aria-hidden />}
      title={t('unavailableTitle')}
    />
  )
}
