import { useState } from 'react'
import { Truck } from 'lucide-react'
import { Button, Card, Notice } from '@/components/app'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { normalizeApiProblem } from '@/api/errors'

/**
 * The one step that turns an ordinary order into a delivery order.
 *
 * It asks for nothing. Saying that an order ships is not the same decision as
 * saying what the recipient still owes on it — goods that are already paid for
 * owe nothing at all — and the hryvnia figure is taken later, where the
 * post-payment is actually set.
 */
export function DeliveryConfigureCard({
  mutationsAllowed,
  onConfigured,
  orderId,
}: {
  mutationsAllowed: boolean
  onConfigured: (delivery: DeliveryOrder) => void
  orderId: string
}) {
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
        setError(normalizeApiProblem(problem).message)
      })
      .finally(() => setBusy(false))
  }

  return (
    <Card title="Доставка">
      <div className="grid gap-3.5">
        <p className="text-app-muted text-sm">
          Замовлення поки не їде поштою. Оформіть доставку — отримувача, посилку
          й післяплату вкажете на наступному кроці.
        </p>
        {error === null ? null : <Notice tone="danger">{error}</Notice>}
        {mutationsAllowed && (
          <Button
            aria-busy={busy}
            className="justify-center"
            disabled={busy}
            onClick={configure}
            variant="primary"
          >
            <Truck aria-hidden />
            Оформити доставку
          </Button>
        )}
      </div>
    </Card>
  )
}
