import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  Notice,
  StatusPill,
  useOptionalToast,
} from '@/components/app'
import {
  integrationsApi,
  type NovaPoshtaDispatchPoint,
} from '@/api/integrations'
import { shippingApi, type Shipment } from '@/api/shipping'
import { customersApi } from '@/api/customers'
import { normalizeApiProblem } from '@/api/errors'
import { NOVA_POSHTA } from '../../integrations/integration-labels'
import { DeliveryDrawer } from './DeliveryDrawer'
import { prepayment, shipmentStatePresentation } from './delivery-labels'

const uah = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

const when = (value: string) =>
  new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

interface Ready {
  integrationId: string
  points: NovaPoshtaDispatchPoint[]
  shipment: Shipment | null
  customerPhone: string | null
}

/**
 * Delivery for one order. The section exists only when the yard actually has
 * an active Nova Poshta integration — without one there is nothing truthful
 * to show, so the order card stays as it was.
 */
export function DeliverySection({
  customerId,
  customerName,
  mutationsAllowed,
  orderId,
  totalAmount,
}: {
  customerId: string | null
  customerName: string | null
  mutationsAllowed: boolean
  orderId: string
  totalAmount: number | null
}) {
  // Toasts are a courtesy here: the card works without a provider around it.
  const toast = useOptionalToast()
  const [ready, setReady] = useState<Ready | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      const integrations = await integrationsApi.list({
        signal: controller.signal,
      })
      const nova = integrations.find(
        (item) => item.code === NOVA_POSHTA && item.status === 'active',
      )
      if (nova === undefined) return null
      const [shipment, points, customer] = await Promise.all([
        shippingApi.get(nova.id, orderId, { signal: controller.signal }),
        integrationsApi
          .dispatchPoints(nova.id, { signal: controller.signal })
          .catch(() => [] as NovaPoshtaDispatchPoint[]),
        customerId === null
          ? Promise.resolve(null)
          : customersApi
              .getById(customerId, { signal: controller.signal })
              .catch(() => null),
      ])
      return {
        integrationId: nova.id,
        points: points.filter((point) => point.isActive),
        shipment,
        customerPhone: customer?.phone ?? null,
      }
    }
    void load().then(
      (result) => {
        if (!controller.signal.aborted) setReady(result)
      },
      () => {
        // Delivery is an addition to the order card: when the integration or
        // the shipment cannot be read, the order itself must still open.
        if (!controller.signal.aborted) setReady(null)
      },
    )
    return () => controller.abort()
  }, [customerId, orderId])

  if (ready === null) return null

  const { integrationId, points, shipment, customerPhone } = ready
  const state = shipment?.state ?? 'Draft'
  const presentation = shipmentStatePresentation(state)
  const created = state === 'Created'
  const total = prepayment(shipment)

  const run = async (action: () => Promise<Shipment | null | void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (!mountedRef.current) return
      setReady({
        integrationId,
        points,
        customerPhone,
        shipment: result ?? null,
      })
    } catch (problem) {
      if (mountedRef.current) setError(normalizeApiProblem(problem).message)
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }

  const copyNumber = async () => {
    if (shipment?.number == null) return
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(shipment.number)
      toast?.show({ tone: 'ok', message: 'Номер ТТН скопійовано.' })
    } catch {
      setError('Не вдалося скопіювати номер ТТН.')
    }
  }

  return (
    <Card
      aside={
        shipment === null ? null : (
          <StatusPill tone={presentation.tone}>{presentation.label}</StatusPill>
        )
      }
      title="Доставка"
    >
      <div className="grid gap-3.5">
        {error !== null && <Notice tone="danger">{error}</Notice>}

        {state === 'Unknown' && (
          <Notice tone="warn">
            Нова пошта не відповіла на запит створення. Накладна могла
            створитися, тому повторне створення заблоковане — перевірте
            результат.
          </Notice>
        )}

        {created && shipment?.number != null ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[22px] font-medium tracking-[-0.01em] text-white">
                {shipment.number}
              </span>
              <Button
                className="min-h-9 px-2.5 text-xs"
                onClick={() => void copyNumber()}
              >
                Копіювати
              </Button>
            </div>
            <dl className="grid gap-2.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">Статус перевізника</dt>
                <dd className="text-app-ink text-right font-medium">
                  {shipment.trackingStatus ?? 'ще не надходив'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">Посилок</dt>
                <dd className="text-app-ink text-right font-mono">
                  {shipment.draft.parcels.length}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">Збережена передоплата</dt>
                <dd className="text-app-ink text-right font-mono">
                  {total === null ? '—' : uah.format(total)}
                </dd>
              </div>
            </dl>
            {shipment.events.length > 0 && (
              <ol aria-label="Статуси відправлення" className="grid gap-2">
                {shipment.events.map((event) => (
                  <li
                    className="flex items-baseline justify-between gap-3 text-[13px]"
                    key={`${event.recordedAt}-${event.code}`}
                  >
                    <span className="text-app-ink min-w-0 text-pretty">
                      {event.name}
                    </span>
                    <span className="text-app-dim font-mono text-[12px] whitespace-nowrap">
                      {when(event.occurredAt ?? event.recordedAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-app-dim text-[12.5px] leading-5 text-pretty">
              Статус доставки й статус оплати не повʼязані: отримання посилки не
              зараховує гроші в касу.
            </p>
          </>
        ) : (
          <p className="text-app-muted text-[13px] leading-5 text-pretty">
            {state === 'Draft' && shipment !== null
              ? 'Чернетку доставки збережено. Відкрийте панель, щоб розрахувати вартість і створити ТТН.'
              : state === 'Creating'
                ? 'Створюємо ТТН у Новій пошті. Не повторюйте дію — оновіть стан за кілька секунд.'
                : state === 'Cancelled'
                  ? 'Доставку скасовано. Можна оформити нову.'
                  : 'Доставка ще не оформлена.'}
          </p>
        )}

        <div className="flex flex-wrap gap-2.5">
          {created || state === 'Creating' || state === 'Unknown' ? (
            <>
              <Button
                aria-busy={busy}
                disabled={busy}
                onClick={() =>
                  void run(() => shippingApi.refresh(integrationId, orderId))
                }
                variant={state === 'Unknown' ? 'primary' : 'ghost'}
              >
                {state === 'Unknown'
                  ? 'Перевірити результат'
                  : 'Оновити статус'}
              </Button>
              {created && shipment?.number != null && (
                <Button asChild variant="ghost">
                  <a
                    href={`https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(shipment.number)}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Відкрити в Новій пошті
                  </a>
                </Button>
              )}
              {created && mutationsAllowed && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await shippingApi.cancel(integrationId, orderId)
                      return await shippingApi.get(integrationId, orderId)
                    })
                  }
                  variant="danger"
                >
                  Скасувати доставку
                </Button>
              )}
            </>
          ) : (
            mutationsAllowed && (
              <Button onClick={() => setOpen(true)} variant="primary">
                {shipment === null
                  ? 'Оформити доставку'
                  : 'Продовжити оформлення'}
              </Button>
            )
          )}
        </div>
      </div>

      {open && (
        <DeliveryDrawer
          customerName={customerName}
          customerPhone={customerPhone}
          declaredValue={totalAmount}
          dispatchPoints={points}
          integrationId={integrationId}
          onChanged={(next) => {
            setReady({
              integrationId,
              points,
              customerPhone,
              shipment: next,
            })
            if (next.state !== 'Draft') setOpen(false)
          }}
          onClose={() => setOpen(false)}
          orderId={orderId}
          shipment={shipment}
        />
      )}
    </Card>
  )
}
