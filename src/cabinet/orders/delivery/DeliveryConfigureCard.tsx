import { useState } from 'react'
import { Truck } from 'lucide-react'
import { Button, Card, Notice } from '@/components/app'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { useLocale, useT } from '@/i18n'
import { deliveryMessages } from './messages'
import { deliveryProblemMessage } from './nova-poshta-availability'

/**
 * The one step that turns an ordinary order into a delivery order.
 *
 * It asks for nothing. Saying that an order ships is not the same decision as
 * saying what the recipient still owes on it — goods that are already paid for
 * owe nothing at all — and the hryvnia figure is taken later, where the
 * post-payment is actually set.
 *
 * A delivery order is a Nova Poshta order, so outside Ukraine the card only
 * says why it is not offered.
 */
export function DeliveryConfigureCard({
  mutationsAllowed,
  novaPoshtaAvailable = true,
  onConfigured,
  orderId,
}: {
  mutationsAllowed: boolean
  /** False for a business outside Ukraine, where Core has no Nova Poshta. */
  novaPoshtaAvailable?: boolean
  onConfigured: (delivery: DeliveryOrder) => void
  orderId: string
}) {
  const { locale } = useLocale()
  const t = useT(deliveryMessages)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const configure = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    void deliveryApi
      .configure(orderId)
      .then(onConfigured)
      .catch((problem: unknown) => {
        setError(deliveryProblemMessage(problem, locale))
      })
      .finally(() => setBusy(false))
  }

  if (!novaPoshtaAvailable)
    return (
      <Card title={t('tabShipping')}>
        <p className="text-app-muted m-0">{t('countryUnavailable')}</p>
      </Card>
    )

  return (
    <Card
      aside={
        mutationsAllowed ? (
          <Button
            aria-busy={busy}
            className="relative after:absolute after:-inset-2 after:content-['']"
            disabled={busy}
            onClick={configure}
            size="sm"
          >
            <Truck aria-hidden />
            {t('startDelivery')}
          </Button>
        ) : undefined
      }
      headerClassName="py-2"
      title={t('tabShipping')}
    >
      <div className="grid gap-3">
        <p className="text-app-muted m-0">{t('configureNote')}</p>
        {error === null ? null : <Notice tone="danger">{error}</Notice>}
      </div>
    </Card>
  )
}
