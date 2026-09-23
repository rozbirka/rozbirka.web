import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  Field,
  Notice,
  StatusPill,
  TextInput,
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
import {
  agreedTotal,
  prepayment,
  shipmentStatePresentation,
} from './delivery-labels'

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
  /** Core has no agreed total for this order yet, so no shipment may exist. */
  needsSetup: boolean
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
  const [reloads, setReloads] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [totalDraft, setTotalDraft] = useState('')
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
      const [delivery, points, customer] = await Promise.all([
        shippingApi.get(nova.id, orderId, { signal: controller.signal }).then(
          (shipment) => ({ needsSetup: false, shipment }),
          (problem: unknown) => {
            if (normalizeApiProblem(problem).code !== 'delivery_not_configured')
              throw problem
            return { needsSetup: true, shipment: null }
          },
        ),
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
        ...delivery,
        integrationId: nova.id,
        points: points.filter((point) => point.isActive),
        customerPhone: customer?.phone ?? null,
      }
    }
    void load().then(
      (result) => {
        if (!controller.signal.aborted) setReady(result)
      },
      (problem: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(normalizeApiProblem(problem).message)
      },
    )
    return () => controller.abort()
  }, [customerId, orderId, reloads])

  if (loadError !== null)
    return (
      <Card title="Доставка">
        <Notice tone="danger">{loadError}</Notice>
        <Button
          onClick={() => {
            setLoadError(null)
            setReloads((value) => value + 1)
          }}
        >
          Повторити
        </Button>
      </Card>
    )
  if (ready === null) return null

  if (ready.needsSetup) {
    const configure = async () => {
      if (busy) return
      const total = agreedTotal(totalDraft)
      if (total === null) {
        setError(
          'Вкажіть додатну суму в гривнях, не більше двох знаків після коми.',
        )
        return
      }
      setBusy(true)
      setError(null)
      try {
        await shippingApi.configureOrder(orderId, total)
        if (mountedRef.current) setReloads((count) => count + 1)
      } catch (problem) {
        if (mountedRef.current) setError(normalizeApiProblem(problem).message)
      } finally {
        if (mountedRef.current) setBusy(false)
      }
    }

    return (
      <Card title="Доставка">
        <div className="grid gap-3.5">
          <p className="text-app-muted text-sm">
            Доставка для цього замовлення ще не налаштована.
          </p>
          {error !== null && <Notice tone="danger">{error}</Notice>}
          {mutationsAllowed && (
            <form
              className="grid gap-3.5"
              onSubmit={(event) => {
                event.preventDefault()
                void configure()
              }}
            >
              <Field
                hint="Вартість товарів, погоджена з клієнтом. Вартість доставки розраховується окремо."
                label="Погоджена сума замовлення, грн"
                required
              >
                <TextInput
                  disabled={busy}
                  inputMode="decimal"
                  onChange={(event) => setTotalDraft(event.target.value)}
                  value={totalDraft}
                />
              </Field>
              <Button aria-busy={busy} disabled={busy} type="submit">
                Налаштувати доставку
              </Button>
            </form>
          )}
        </div>
      </Card>
    )
  }

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
        needsSetup: false,
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
              needsSetup: false,
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
