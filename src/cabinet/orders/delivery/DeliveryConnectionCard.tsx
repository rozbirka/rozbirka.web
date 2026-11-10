import { Link } from 'react-router'
import { Plug } from 'lucide-react'
import { Button, Card, Notice } from '@/components/app'
import { useLocale, useT } from '@/i18n'
import {
  integrationErrorMessage,
  integrationStatusPresentation,
} from '../../integrations/integration-labels'
import { deliveryMessages } from './messages'
import type { CarrierState, DisconnectedCarrier } from './use-delivery-order'

/** Entry to shipping setup, before this order has a parcel or delivery history. */
export function DeliveryConnectionCard({
  carrier,
  disconnected,
  integrationsPath,
}: {
  carrier: CarrierState | null
  disconnected: DisconnectedCarrier | null
  integrationsPath: string | null
}) {
  const t = useT(deliveryMessages)
  const { locale } = useLocale()
  const failed = carrier?.status === 'error'
  const path =
    integrationsPath === null || disconnected === null
      ? integrationsPath
      : `${integrationsPath}/${encodeURIComponent(disconnected.integrationId)}`

  return (
    <Card title={t('connectionTitle')} bodyClassName="grid gap-3">
      {failed ? (
        <Notice block tone="danger">
          <p className="m-0">
            {t('npUnavailable', {
              status: integrationStatusPresentation(
                carrier.status,
                locale,
              ).label.toLocaleLowerCase(locale),
            })}
          </p>
          {carrier.errorCode === null ? null : (
            <p className="m-0 mt-1">
              {integrationErrorMessage(carrier.errorCode, locale)}
            </p>
          )}
        </Notice>
      ) : (
        <p className="rz-caption m-0 text-pretty">
          {disconnected === null ? t('connectionNote') : t('offNoWaybill')}
        </p>
      )}
      {path === null ? (
        <p className="rz-caption m-0 text-pretty">{t('connectionAskAdmin')}</p>
      ) : (
        <div className="rz-btn-row">
          <Button asChild>
            <Link to={path}>
              <Plug aria-hidden />
              {failed
                ? t('openIntegrations')
                : disconnected === null
                  ? t('connectIntegration')
                  : t('openIntegration')}
            </Link>
          </Button>
        </div>
      )}
    </Card>
  )
}
