import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { Plus, Printer } from 'lucide-react'
import { Button, Notice, useOptionalToast } from '@/components/app'
import { cashApi, type CashRegister } from '@/api/cash'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { shippingApi, type Shipment } from '@/api/shipping'
import { normalizeApiProblem } from '@/api/errors'
import type { OrderDetail } from '@/api/orders'
import {
  integrationErrorMessage,
  integrationStatusPresentation,
} from '../../integrations/integration-labels'
import {
  OrderCustomerCard,
  OrderHistoryCard,
  OrderItemsCard,
} from '../OrderDetailCards'
import { orderEventTitle } from '../order-labels'
import { DeliveryDrawer } from './DeliveryDrawer'
import {
  DeliveryDueCard,
  DeliveryGateCard,
  DeliveryLifecycle,
  DeliveryPaymentsCard,
  DeliverySteps,
  DeliveryTabs,
  RecipientCard,
  ShipmentCard,
  type DeliveryTab,
} from './DeliveryOrderCard'
import { DeliveryStepDrawer, type DeliveryStep } from './DeliveryStepDrawer'
import { PaymentDrawer } from './PaymentDrawer'
import {
  WaybillAttachDrawer,
  WaybillDataDrawer,
  WaybillLabelDrawer,
  WaybillReadinessDrawer,
} from './WaybillDrawers'
import { hasWaybill, lifecycle } from './delivery-view'
import type { DeliveryOrderLoad } from './use-delivery-order'

type Drawer =
  | { kind: 'pay'; mode: 'record' | 'link' }
  | { kind: 'readiness' }
  | { kind: 'booking' }
  | { kind: 'waybill' }
  | { kind: 'attach' }
  | { kind: 'label' }
  | { kind: 'step'; step: DeliveryStep }

type PaymentOperation = 'delivery-payment' | 'delivery-link'

const ambiguousMutationFailure = (problem: unknown) => {
  const kind = normalizeApiProblem(problem).kind
  return kind === 'network' || kind === 'timeout'
}

const usePaymentIdempotencyKeys = () => {
  const keys = useRef(
    new Map<PaymentOperation, { signature: string; key: string }>(),
  )
  return {
    forPayload(operation: PaymentOperation, payload: unknown) {
      const signature = JSON.stringify(payload)
      const current = keys.current.get(operation)
      if (current?.signature === signature) return current.key
      const key = `${operation}-${crypto.randomUUID()}`
      keys.current.set(operation, { signature, key })
      return key
    },
    clear(operation: PaymentOperation) {
      keys.current.delete(operation)
    },
  }
}

const when = (value: string) => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(value)
  return parts ? `${parts[1]}-${parts[2]}-${parts[3]} ${parts[4]}` : value
}

/**
 * A delivery order, whole.
 *
 * It is one order with two halves that answer different questions — what was
 * sold and what is owed, against where the parcel is — so the card is tabbed
 * rather than a single column the eye has to search. The money half is Core's
 * alone and keeps working whatever the carrier is doing; only the waybill half
 * waits on Nova Poshta.
 */
export function DeliveryOrderBody({
  customerPath,
  delivery,
  financeAllowed,
  integrationsPath,
  load,
  mutationsAllowed,
  order,
  partsPath,
}: {
  customerPath: string | null
  delivery: DeliveryOrder
  financeAllowed: boolean
  integrationsPath: string | null
  load: DeliveryOrderLoad
  mutationsAllowed: boolean
  order: OrderDetail
  partsPath: string | null
}) {
  const toast = useOptionalToast()
  // The body is only mounted once the money record exists, so the load has
  // certainly settled by now.
  const state = load.state!
  const { carrier, integrationId, points, shipment } = state

  const [tab, setTab] = useState<DeliveryTab>('sales')
  const [drawer, setDrawer] = useState<Drawer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tills, setTills] = useState<CashRegister[]>([])
  const paymentKeys = usePaymentIdempotencyKeys()

  useEffect(() => {
    if (!financeAllowed) return
    const controller = new AbortController()
    void cashApi
      .list(undefined, { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) setTills(items)
      })
      .catch(() => {
        // Payment rows fall back to «каса»; a missing name is not an error.
      })
    return () => controller.abort()
  }, [financeAllowed])

  const created = hasWaybill(shipment)

  const runMoney = async (action: () => Promise<DeliveryOrder>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      load.setMoney(await action())
    } finally {
      setBusy(false)
    }
  }

  const runPayment = async (
    operation: PaymentOperation,
    payload: unknown,
    action: (idempotencyKey: string) => Promise<DeliveryOrder>,
  ) => {
    const idempotencyKey = paymentKeys.forPayload(operation, [
      order.id,
      payload,
    ])
    try {
      await runMoney(() => action(idempotencyKey))
      paymentKeys.clear(operation)
    } catch (problem) {
      if (!ambiguousMutationFailure(problem)) paymentKeys.clear(operation)
      throw problem
    }
  }

  const runShipment = async (action: () => Promise<Shipment | null | void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      load.setShipment((await action()) ?? null)
    } catch (problem) {
      setError(normalizeApiProblem(problem).message)
    } finally {
      setBusy(false)
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

  const primary = (kind: string) => {
    if (kind === 'pay') setDrawer({ kind: 'pay', mode: 'record' })
    if (kind === 'create') setDrawer({ kind: 'readiness' })
    if (kind === 'dispatch') setDrawer({ kind: 'step', step: 'dispatch' })
    if (kind === 'receive') setDrawer({ kind: 'step', step: 'receive' })
    if (kind === 'return') setDrawer({ kind: 'step', step: 'return' })
  }

  const tillName = (accountId: string) =>
    tills.find((till) => till.id === accountId)?.name ?? null

  return (
    <>
      <DeliveryLifecycle steps={lifecycle(delivery, shipment)} />

      <DeliveryTabs
        delivery={delivery}
        onChange={setTab}
        shipment={shipment}
        tab={tab}
      />

      {error === null ? null : <Notice tone="danger">{error}</Notice>}
      {load.error === null ? null : (
        <Notice tone="danger">
          {load.error}
          <Button className="mt-2.5" onClick={load.reload}>
            Повторити
          </Button>
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="grid min-w-0 gap-5">
          {tab === 'sales' ? (
            <>
              <OrderItemsCard
                addPath={null}
                editable={false}
                items={order.items}
                onEdit={() => undefined}
                partsPath={partsPath}
                total={order.items.reduce(
                  (sum, item) => sum + item.totalPrice,
                  0,
                )}
              />
              <DeliveryPaymentsCard
                actions={
                  !financeAllowed || delivery.outstandingUah <= 0 ? null : (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() => setDrawer({ kind: 'pay', mode: 'link' })}
                      >
                        Прив’язати транзакцію
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          setDrawer({ kind: 'pay', mode: 'record' })
                        }
                      >
                        <Plus aria-hidden />
                        Внести оплату
                      </Button>
                    </>
                  )
                }
                delivery={delivery}
                tillName={tillName}
              />
            </>
          ) : (
            <>
              {integrationId === null && carrier !== null ? (
                <Notice tone="warn">
                  <p className="font-semibold">
                    {carrier.status === 'missing'
                      ? 'Нову пошту не підключено.'
                      : `Нова пошта недоступна: ${integrationStatusPresentation(carrier.status).label.toLowerCase()}.`}
                  </p>
                  {carrier.errorCode === null ? null : (
                    <p className="mt-1">
                      {integrationErrorMessage(carrier.errorCode)}
                    </p>
                  )}
                  <p className="mt-1">
                    Замовлення лишається доставковим: гроші й етапи працюють, а
                    накладну не створити й не оновити, доки інтеграцію не
                    відновлять.
                  </p>
                  {integrationsPath === null ? null : (
                    <p className="mt-2">
                      <RouterLink
                        className="text-brand hover:text-brand-hover font-semibold"
                        to={integrationsPath}
                      >
                        Відкрити інтеграції
                      </RouterLink>
                    </p>
                  )}
                </Notice>
              ) : null}

              <ShipmentCard
                actions={
                  integrationId === null ? null : created ? (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() => setDrawer({ kind: 'waybill' })}
                      >
                        Дані ТТН
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() => setDrawer({ kind: 'label' })}
                      >
                        <Printer aria-hidden />
                        Друк етикетки
                      </Button>
                      <Button disabled={busy} onClick={() => void copyNumber()}>
                        Копіювати номер
                      </Button>
                      <Button
                        aria-busy={busy}
                        disabled={busy}
                        onClick={() =>
                          void runShipment(() =>
                            shippingApi.refresh(integrationId, order.id),
                          )
                        }
                      >
                        Оновити статус
                      </Button>
                    </>
                  ) : (
                    mutationsAllowed && (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() => setDrawer({ kind: 'readiness' })}
                          variant="primary"
                        >
                          {shipment === null
                            ? 'Оформити доставку'
                            : 'Продовжити оформлення'}
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() => setDrawer({ kind: 'attach' })}
                        >
                          Прив’язати накладну з кабінету НП
                        </Button>
                      </>
                    )
                  )
                }
                delivery={delivery}
                shipment={shipment}
              />

              {created ? null : <DeliveryGateCard delivery={delivery} />}

              <RecipientCard phone={state.customerPhone} shipment={shipment} />

              <DeliverySteps delivery={delivery} shipment={shipment} />
            </>
          )}
        </div>

        <aside className="grid min-w-0 gap-5 lg:sticky lg:top-24">
          <DeliveryDueCard
            busy={busy}
            delivery={delivery}
            onPrimary={primary}
            shipment={shipment}
          />
          <OrderCustomerCard
            customerId={order.customerId}
            customerName={order.customerName}
            initials={initials(order.customerName ?? '—')}
            to={customerPath ?? '#'}
          />
          <OrderHistoryCard
            rows={order.history}
            title={orderEventTitle}
            when={when}
          />
        </aside>
      </div>

      {drawer?.kind === 'pay' && (
        <PaymentDrawer
          delivery={delivery}
          mode={drawer.mode}
          onClose={() => setDrawer(null)}
          onLink={(input) =>
            runPayment('delivery-link', input, (idempotencyKey) =>
              deliveryApi.linkPayment(order.id, input, { idempotencyKey }),
            )
          }
          onRecord={(input) =>
            runPayment('delivery-payment', input, (idempotencyKey) =>
              deliveryApi.recordPayment(order.id, input, { idempotencyKey }),
            )
          }
          orderNumber={order.number}
        />
      )}

      {drawer?.kind === 'readiness' && (
        <WaybillReadinessDrawer
          busy={busy}
          delivery={delivery}
          dispatchPointActive={points.length > 0}
          onClose={() => setDrawer(null)}
          onContinue={() => setDrawer({ kind: 'booking' })}
          orderNumber={order.number}
          shipment={shipment}
        />
      )}

      {drawer?.kind === 'booking' && integrationId !== null && (
        <DeliveryDrawer
          customerName={order.customerName}
          customerPhone={state.customerPhone}
          declaredValue={delivery.agreedTotalUah}
          delivery={delivery}
          dispatchPoints={points}
          paid={
            order.totalPaid !== null &&
            order.totalPaid > 0 &&
            order.paymentCurrency !== null
              ? { amount: order.totalPaid, currency: order.paymentCurrency }
              : null
          }
          integrationId={integrationId}
          onChanged={(next) => {
            load.setShipment(next)
            if (next.state !== 'Draft') setDrawer(null)
          }}
          onClose={() => setDrawer(null)}
          onMoneyChanged={load.setMoney}
          orderId={order.id}
          shipment={shipment}
        />
      )}

      {drawer?.kind === 'waybill' && shipment !== null && (
        <WaybillDataDrawer
          delivery={delivery}
          onClose={() => setDrawer(null)}
          orderNumber={order.number}
          shipment={shipment}
        />
      )}

      {drawer?.kind === 'attach' && integrationId !== null && (
        <WaybillAttachDrawer
          delivery={delivery}
          integrationId={integrationId}
          onAttached={load.setShipment}
          onClose={() => setDrawer(null)}
          orderId={order.id}
          orderNumber={order.number}
        />
      )}

      {drawer?.kind === 'label' &&
        integrationId !== null &&
        shipment?.number != null && (
          <WaybillLabelDrawer
            integrationId={integrationId}
            onClose={() => setDrawer(null)}
            orderId={order.id}
            orderNumber={order.number}
            waybillNumber={shipment.number}
          />
        )}

      {drawer?.kind === 'step' && (
        <DeliveryStepDrawer
          delivery={delivery}
          onClose={() => setDrawer(null)}
          onConfirm={() =>
            runMoney(() =>
              drawer.step === 'dispatch'
                ? deliveryApi.dispatch(order.id)
                : drawer.step === 'receive'
                  ? deliveryApi.receive(order.id)
                  : deliveryApi.acceptReturn(order.id),
            )
          }
          step={drawer.step}
        />
      )}
    </>
  )
}

/** Two initials for the avatar chip; a single word gives one. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => /\p{L}/u.exec(part)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .map((letter) => letter.toUpperCase())
    .join('') || '?'
