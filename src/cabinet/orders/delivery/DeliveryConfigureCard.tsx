import { Link2, Truck } from 'lucide-react'
import { Button, Card } from '@/components/app'
import { useT } from '@/i18n'
import { deliveryMessages } from './messages'
import { ShipmentCard } from './DeliveryOrderCard'
import { DeliveryConnectionCard } from './DeliveryConnectionCard'
import type { DeliveryOrderState } from './use-delivery-order'

/** Opens delivery setup without changing the order until the draft is saved. */
export function DeliveryConfigureCard({
  connection,
  integrationsPath,
  mutationsAllowed,
  novaPoshtaAvailable = true,
  onStart,
  onAttach,
}: {
  connection: Pick<
    DeliveryOrderState,
    'integrationId' | 'carrier' | 'disconnected'
  >
  integrationsPath: string | null
  mutationsAllowed: boolean
  /** False for a business outside Ukraine, where Core has no Nova Poshta. */
  novaPoshtaAvailable?: boolean
  onAttach: (() => void) | null
  onStart: () => void
}) {
  const t = useT(deliveryMessages)

  if (!novaPoshtaAvailable)
    return (
      <Card title={t('tabShipping')}>
        <p className="text-app-muted m-0">{t('countryUnavailable')}</p>
      </Card>
    )

  if (connection.integrationId === null)
    return (
      <DeliveryConnectionCard
        carrier={connection.carrier}
        disconnected={connection.disconnected}
        integrationsPath={integrationsPath}
      />
    )

  return (
    <ShipmentCard
      actions={
        mutationsAllowed ? (
          <>
            <Button onClick={onStart} variant="primary">
              <Truck aria-hidden />
              {t('startDelivery')}
            </Button>
            <Button
              disabled={onAttach === null}
              onClick={onAttach ?? undefined}
              variant="quiet"
            >
              <Link2 aria-hidden />
              {t('attachWaybill')}
            </Button>
          </>
        ) : null
      }
      facts={null}
      hint={t('configureNote')}
    />
  )
}
