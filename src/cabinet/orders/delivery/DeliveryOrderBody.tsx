import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { Plus } from 'lucide-react'
import { Button, Notice, useOptionalToast } from '@/components/app'
import { cashApi, type CashRegister } from '@/api/cash'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { shippingApi, type Shipment, type ShipmentDraft } from '@/api/shipping'
import { normalizeApiProblem } from '@/api/errors'
import type { OrderDetail } from '@/api/orders'
import type { BusinessCountry } from '@/api/tenant-settings'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import {
  integrationErrorMessage,
  integrationStatusPresentation,
} from '../../integrations/integration-labels'
import { NpAccessRecoverySheet } from '../../integrations/NpAccessRecoverySheet'
import { npRecoveryMessages } from '../../integrations/np-recovery-messages'
import {
  lostAccessConnection,
  useNpConnections,
} from '../../integrations/use-np-connections'
import {
  OrderCustomerCard,
  OrderHistoryCard,
  OrderItemsCard,
} from '../OrderDetailCards'
import { orderEventTitle } from '../order-labels'
import { DeliveryDrawer } from './DeliveryDrawer'
import {
  DeliveryDueCard,
  DeliveryLifecycle,
  DeliveryPaymentsCard,
  DeliverySteps,
  DeliveryTabs,
  type DeliveryTab,
} from './DeliveryOrderCard'
import {
  DeliveryShipmentBlock,
  type CancelledWaybill,
} from './DeliveryShipmentBlock'
import { DeliveryStepDrawer, type DeliveryStep } from './DeliveryStepDrawer'
import { ExternalWaybillSheet } from './ExternalWaybillSheet'
import { PaymentDrawer } from './PaymentDrawer'
import { WaybillCreateSheet } from './WaybillCreateSheet'
import { WaybillCancelDialog, WaybillRecreateDialog } from './WaybillDialogs'
import { WaybillLabelDrawer, WaybillReadinessDrawer } from './WaybillDrawers'
import { WaybillEditSheet, type RecreateReason } from './WaybillEditSheet'
import { WaybillReconcileSheet } from './WaybillReconcileSheet'
import { lifecycle } from './delivery-view'
import { deliveryMessages } from './messages'
import { deliveryProblemMessage } from './nova-poshta-availability'
import type { DeliveryOrderLoad } from './use-delivery-order'
import { waybillMessages } from './waybill-messages'
import { liveWaybillStage, unresolvedStage, waybillStage } from './waybill-view'

type Drawer =
  | { kind: 'pay'; mode: 'record' | 'link' }
  /** The delivery form; `then` says whether the readiness check follows. */
  | { kind: 'form'; then: 'close' | 'check'; prefill: ShipmentDraft | null }
  | { kind: 'readiness' }
  | { kind: 'create' }
  | { kind: 'reconcile' }
  | { kind: 'edit' }
  | { kind: 'attach' }
  | { kind: 'label' }
  | { kind: 'step'; step: DeliveryStep }

type WaybillDialog =
  | { kind: 'cancel' }
  | { kind: 'recreate'; draft: ShipmentDraft; reason: RecreateReason }

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

/**
 * A delivery order, whole.
 *
 * It is one order with two halves that answer different questions — what was
 * sold and what is owed, against where the parcel is — so the card is tabbed
 * rather than a single column the eye has to search. The money half is Core's
 * alone and keeps working whatever the carrier is doing; only the waybill half
 * waits on Nova Poshta.
 *
 * The waybill half is module 46 §4–6: the «Доставка · Нова пошта» block and
 * the sheets that create, edit, cancel, reconcile and attach a waybill. Its
 * stage is read once (`waybillStage`) and every button follows from it.
 *
 * Outside Ukraine there is no Nova Poshta: an existing delivery order stays
 * readable, but nothing that books, prints or tracks a waybill is offered.
 */
export function DeliveryOrderBody({
  countryCode = null,
  accountingCurrency = null,
  customerPath,
  customerSearchAllowed = false,
  delivery,
  financeAllowed,
  integrationsPath,
  load,
  mutationsAllowed,
  novaPoshtaAvailable = true,
  order,
  partsPath,
  waybillsPath = null,
}: {
  /** The tenant's country; kept for callers, the form is Ukrainian only. */
  countryCode?: BusinessCountry | null
  /** The order lines' currency; `null` when not chosen or not reported. */
  accountingCurrency?: string | null
  customerPath: string | null
  customerSearchAllowed?: boolean
  delivery: DeliveryOrder
  financeAllowed: boolean
  integrationsPath: string | null
  load: DeliveryOrderLoad
  /** «Керування замовленнями»: create, edit, cancel and attach waybills. */
  mutationsAllowed: boolean
  /** False for a business outside Ukraine. */
  novaPoshtaAvailable?: boolean
  order: OrderDetail
  partsPath: string | null
  /** «Накладні НП»; «Дані ТТН» and «Відкрити ТТН» open the waybill card there. */
  waybillsPath?: string | null
}) {
  void countryCode
  const toast = useOptionalToast()
  const { locale, timeZone } = useLocale()
  const t = useT(deliveryMessages)
  const tw = useT(waybillMessages)
  const tc = useT(commonMessages)
  const tr = useT(npRecoveryMessages)
  const format = useFormat()
  const when = (value: string) => format.dateTime(value) ?? value
  // The body is only mounted once the money record exists, so the load has
  // certainly settled by now.
  const state = load.state!
  const { carrier, integrationId, points, shipment } = state

  const [tab, setTab] = useState<DeliveryTab>('sales')
  const [drawer, setDrawer] = useState<Drawer | null>(null)
  const [dialog, setDialog] = useState<WaybillDialog | null>(null)
  const [dialogPending, setDialogPending] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tills, setTills] = useState<CashRegister[]>([])
  // Session facts Core does not keep on the waybill: a cancelled waybill is
  // no longer returned for the order, an attached one looks like a created
  // one, and «no proof yet» is only known from the last check.
  const [cancelled, setCancelled] = useState<CancelledWaybill | null>(null)
  const [nextDraft, setNextDraft] = useState<ShipmentDraft | null>(null)
  const [attachedAt, setAttachedAt] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const paymentKeys = usePaymentIdempotencyKeys()
  // Focus goes back to the control that opened a sheet, or to the waybill
  // number once one was created (module 46, section 11).
  const openerRef = useRef<HTMLElement | null>(null)
  const focusNumber = useRef(false)
  const numberRef = useRef<HTMLSpanElement | null>(null)

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

  const stage = waybillStage(
    delivery,
    shipment,
    points.map((point) => point.id),
  )
  const live = liveWaybillStage(stage)

  // A waybill of an earlier carrier cabinet whose key no longer works (3.2).
  // Core lists cabinets only with the integrations right — the same right the
  // integrations link needs — so without it the state cannot be told apart.
  const canRecover = integrationsPath !== null
  const npConnections = useNpConnections(
    integrationId,
    canRecover && live && shipment?.connectionId != null,
  )
  const lost = live
    ? lostAccessConnection(npConnections.connections, shipment?.connectionId)
    : null
  const [recoverOpen, setRecoverOpen] = useState(false)
  const recoverRef = useRef<HTMLButtonElement | null>(null)
  const settingsPath =
    integrationsPath === null || integrationId === null
      ? integrationsPath
      : `${integrationsPath}/${integrationId}`

  const open = (next: Drawer) => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setDrawer(next)
  }
  const restoreFocus = (event: Event) => {
    event.preventDefault()
    if (focusNumber.current) {
      focusNumber.current = false
      window.requestAnimationFrame(() => numberRef.current?.focus())
      return
    }
    const opener = openerRef.current
    if (opener?.isConnected === true) opener.focus()
  }

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
      setError(deliveryProblemMessage(problem, locale))
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
      toast?.show({ tone: 'ok', message: t('numberCopied') })
    } catch {
      if (toast) toast.show({ tone: 'danger', message: t('copyFailed') })
      else setError(t('copyFailed'))
    }
  }

  /** A created waybill: the toast, and focus on its number in the block. */
  const created = (next: Shipment) => {
    setWaiting(false)
    setCancelled(null)
    setNextDraft(null)
    load.setShipment(next)
    focusNumber.current = true
    setDrawer(null)
    toast?.show({
      tone: 'ok',
      message: tw('createdToast', { number: next.number ?? '' }),
    })
  }

  const cancelWaybill = async (recreate: ShipmentDraft | null) => {
    if (integrationId === null || shipment === null) return
    setDialogPending(true)
    setDialogError(null)
    try {
      await shippingApi.cancel(integrationId, order.id)
      setCancelled({
        shipment: { ...shipment, state: 'Cancelled' },
        at: new Date().toISOString(),
        recreate: recreate !== null,
      })
      setNextDraft(recreate)
      setAttachedAt(null)
      load.setShipment(null)
      setDialog(null)
      toast?.show({ tone: 'info', message: tw('cancelledToast') })
    } catch (problem) {
      // An answer that never came leaves the cancel unknown: the block then
      // asks for the result check instead of a second cancel.
      const latest = await shippingApi
        .get(integrationId, order.id)
        .catch(() => null)
      if (
        latest !== null &&
        (latest.state === 'CancelUnknown' || latest.state === 'Cancelling')
      ) {
        load.setShipment(latest)
        setDialog(null)
      } else setDialogError(deliveryProblemMessage(problem, locale))
    } finally {
      setDialogPending(false)
    }
  }

  const blockActions = {
    start: () => open({ kind: 'form', then: 'close', prefill: null }),
    edit: () => open({ kind: 'form', then: 'close', prefill: null }),
    check: () => open({ kind: 'readiness' }),
    attach: () => open({ kind: 'attach' }),
    recheck: () => open({ kind: 'form', then: 'check', prefill: null }),
    reconcile: () => open({ kind: 'reconcile' }),
    print: () => open({ kind: 'label' }),
    refresh: () => {
      if (integrationId !== null)
        void runShipment(() => shippingApi.refresh(integrationId, order.id))
    },
    copy: () => void copyNumber(),
    editWaybill: () => open({ kind: 'edit' }),
    cancelWaybill: () => {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      setDialogError(null)
      setDialog({ kind: 'cancel' })
    },
    createNew: () =>
      open({
        kind: 'form',
        then: 'check',
        prefill: nextDraft ?? cancelled?.shipment.draft ?? null,
      }),
    changeDelivery: () =>
      open({
        kind: 'form',
        then: 'close',
        prefill: cancelled?.shipment.draft ?? null,
      }),
    payDeposit: () => open({ kind: 'pay', mode: 'record' }),
    recover: () => setRecoverOpen(true),
  }

  const primary = (kind: string) => {
    if (kind === 'pay') open({ kind: 'pay', mode: 'record' })
    if (kind === 'create') {
      if (stage === 'none') blockActions.start()
      else if (stage === 'draftStale') blockActions.recheck()
      else if (unresolvedStage(stage)) blockActions.reconcile()
      else blockActions.check()
    }
    if (kind === 'dispatch') open({ kind: 'step', step: 'dispatch' })
    if (kind === 'receive') open({ kind: 'step', step: 'receive' })
    if (kind === 'return') open({ kind: 'step', step: 'return' })
  }

  const tillName = (accountId: string) =>
    tills.find((till) => till.id === accountId)?.name ?? null

  return (
    <>
      <DeliveryLifecycle
        steps={lifecycle(delivery, shipment, locale, timeZone)}
      />

      <DeliveryTabs
        delivery={delivery}
        onChange={setTab}
        shipment={shipment}
        tab={tab}
      />

      {error === null ? null : <Notice tone="danger">{error}</Notice>}
      {load.error === null ? null : (
        <Notice
          action={
            <Button onClick={load.reload} size="sm">
              {tc('retry')}
            </Button>
          }
          tone="danger"
        >
          {load.error}
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="grid min-w-0 flex-[1_1_480px] gap-4">
          {tab === 'sales' ? (
            <>
              <OrderItemsCard
                addPath={null}
                currency={accountingCurrency}
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
                        onClick={() => open({ kind: 'pay', mode: 'link' })}
                      >
                        {t('linkTransaction')}
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() => open({ kind: 'pay', mode: 'record' })}
                      >
                        <Plus aria-hidden />
                        {t('recordPayment')}
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
              {novaPoshtaAvailable ? null : (
                <Notice tone="info">{t('countryUnavailable')}</Notice>
              )}
              {novaPoshtaAvailable &&
              integrationId === null &&
              carrier !== null ? (
                <Notice block tone="warn">
                  <p className="rz-strong m-0 font-semibold">
                    {carrier.status === 'missing'
                      ? t('npNotConnected')
                      : t('npUnavailable', {
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
                  <p className="m-0 mt-1">{t('npDownNote')}</p>
                  {integrationsPath === null ? null : (
                    <p className="m-0 mt-2">
                      <RouterLink className="font-medium" to={integrationsPath}>
                        {t('openIntegrations')}
                      </RouterLink>
                    </p>
                  )}
                </Notice>
              ) : null}

              <DeliveryShipmentBlock
                actions={blockActions}
                attachedAt={attachedAt}
                busy={busy}
                canManage={mutationsAllowed}
                canPay={financeAllowed}
                cancelled={cancelled}
                carrierReady={novaPoshtaAvailable && integrationId !== null}
                delivery={delivery}
                lost={lost !== null}
                numberRef={numberRef}
                points={points}
                recoverRef={recoverRef}
                shipment={shipment}
                stage={stage}
                waiting={waiting}
                waybillPath={
                  waybillsPath === null || shipment === null
                    ? null
                    : `${waybillsPath}/${encodeURIComponent(shipment.id)}`
                }
              />

              <DeliverySteps delivery={delivery} shipment={shipment} />
            </>
          )}
        </div>

        <aside className="grid max-w-full min-w-0 flex-[1_1_280px] gap-4 lg:sticky lg:top-(--rz-topbar-h) lg:max-w-95">
          <DeliveryDueCard
            busy={busy}
            delivery={delivery}
            novaPoshtaAvailable={novaPoshtaAvailable}
            onPrimary={primary}
            shipment={shipment}
          />
          <OrderCustomerCard
            accountingCurrency={accountingCurrency}
            customerId={order.customerId}
            customerName={order.customerName}
            initials={initials(order.customerName ?? '—')}
            to={customerPath ?? '#'}
          />
          <OrderHistoryCard
            rows={order.history}
            title={(eventType) => orderEventTitle(eventType, locale)}
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

      {drawer?.kind === 'form' && integrationId !== null && (
        <DeliveryDrawer
          customerName={order.customerName}
          customerPhone={state.customerPhone}
          customerSearchAllowed={customerSearchAllowed}
          delivery={delivery}
          dispatchPoints={points}
          integrationId={integrationId}
          onClose={() => setDrawer(null)}
          onCloseAutoFocus={restoreFocus}
          onMoneyChanged={load.setMoney}
          onSaved={(next) => {
            load.setShipment(next)
            setCancelled(null)
            setNextDraft(null)
            setDrawer(drawer.then === 'check' ? { kind: 'readiness' } : null)
          }}
          orderId={order.id}
          orderNumber={order.number}
          prefill={drawer.prefill}
          shipment={shipment}
        />
      )}

      {drawer?.kind === 'readiness' && novaPoshtaAvailable && (
        <WaybillReadinessDrawer
          busy={busy}
          delivery={delivery}
          dispatchPointActive={
            shipment === null
              ? points.length > 0
              : points.some((point) => point.id === shipment.dispatchPointId)
          }
          onClose={() => setDrawer(null)}
          onCloseAutoFocus={restoreFocus}
          onContinue={() => setDrawer({ kind: 'create' })}
          orderNumber={order.number}
          settingsPath={settingsPath}
          shipment={shipment}
        />
      )}

      {drawer?.kind === 'create' &&
        integrationId !== null &&
        shipment !== null && (
          <WaybillCreateSheet
            delivery={delivery}
            integrationId={integrationId}
            onClose={() => setDrawer(null)}
            onCloseAutoFocus={restoreFocus}
            onCreated={created}
            onReconcile={() => setDrawer({ kind: 'reconcile' })}
            onShipment={(next) => {
              load.setShipment(next)
              // A refused or failed attempt may have moved the deposit.
              void deliveryApi
                .get(order.id)
                .then(load.setMoney)
                .catch(() => undefined)
            }}
            orderId={order.id}
            orderNumber={order.number}
            shipment={shipment}
          />
        )}

      {drawer?.kind === 'reconcile' &&
        integrationId !== null &&
        shipment !== null && (
          <WaybillReconcileSheet
            delivery={delivery}
            integrationId={integrationId}
            onClose={() => setDrawer(null)}
            onCloseAutoFocus={restoreFocus}
            onResolved={(next) => {
              setWaiting(false)
              if (next.state === 'Cancelled') {
                setCancelled({
                  shipment: next,
                  at: new Date().toISOString(),
                  recreate: nextDraft !== null,
                })
                load.setShipment(null)
                setDrawer(null)
                toast?.show({ tone: 'info', message: tw('cancelledToast') })
              } else if (next.number !== null && next.state === 'Created') {
                created(next)
              } else {
                load.setShipment(next)
                setDrawer(null)
              }
            }}
            onWaiting={() => {
              setWaiting(true)
              setDrawer(null)
            }}
            orderId={order.id}
            orderNumber={order.number}
            shipment={shipment}
          />
        )}

      {drawer?.kind === 'edit' &&
        integrationId !== null &&
        shipment !== null && (
          <WaybillEditSheet
            integrationId={integrationId}
            onClose={() => setDrawer(null)}
            onCloseAutoFocus={restoreFocus}
            onRecreate={(draft, reason) => {
              setDrawer(null)
              setDialogError(null)
              setDialog({ kind: 'recreate', draft, reason })
            }}
            onSaved={(next) => {
              load.setShipment(next)
              setDrawer(null)
              toast?.show({ tone: 'ok', message: tw('editConfirmed') })
            }}
            orderId={order.id}
            shipment={shipment}
          />
        )}

      {drawer?.kind === 'attach' && integrationId !== null && (
        <ExternalWaybillSheet
          delivery={delivery}
          integrationId={integrationId}
          onAttached={(money) => {
            load.setMoney(money)
            setAttachedAt(new Date().toISOString())
            setCancelled(null)
            setDrawer(null)
            focusNumber.current = true
            toast?.show({
              tone: 'ok',
              message: tw('attachedToast', { number: String(order.number) }),
            })
            void shippingApi
              .get(integrationId, order.id)
              .then(load.setShipment)
              .catch(() => load.reload())
          }}
          onClose={() => setDrawer(null)}
          onCloseAutoFocus={restoreFocus}
          onStartDelivery={
            mutationsAllowed
              ? () => setDrawer({ kind: 'form', then: 'close', prefill: null })
              : null
          }
          orderId={order.id}
          orderNumber={order.number}
          shipment={shipment}
        />
      )}

      {shipment?.number != null ? (
        <WaybillCancelDialog
          error={dialogError}
          number={shipment.number}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current?.focus()
          }}
          onConfirm={() => void cancelWaybill(null)}
          onOpenChange={(next) => {
            if (!next) setDialog(null)
          }}
          open={dialog?.kind === 'cancel'}
          orderNumber={order.number}
          pending={dialogPending}
        />
      ) : null}

      {shipment?.number != null && dialog?.kind === 'recreate' ? (
        <WaybillRecreateDialog
          error={dialogError}
          number={shipment.number}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current?.focus()
          }}
          onConfirm={() => void cancelWaybill(dialog.draft)}
          onOpenChange={(next) => {
            if (!next) setDialog(null)
          }}
          open
          pending={dialogPending}
          reason={dialog.reason}
        />
      ) : null}

      {lost !== null && integrationId !== null ? (
        <NpAccessRecoverySheet
          canRecover={canRecover}
          connection={lost}
          integrationId={integrationId}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            recoverRef.current?.focus()
          }}
          onOpenChange={setRecoverOpen}
          onRecovered={(_result, count) => {
            toast?.show({ tone: 'ok', message: tr('recovered', { count }) })
            npConnections.reload()
            load.reload()
          }}
          open={recoverOpen}
          waybills={
            shipment?.number == null
              ? []
              : [
                  {
                    number: shipment.number,
                    caption: `#${String(order.number)} · ${
                      shipment.trackingStatus ?? shipment.state
                    }`,
                  },
                ]
          }
        />
      ) : null}

      {drawer?.kind === 'label' &&
        integrationId !== null &&
        shipment?.number != null && (
          <WaybillLabelDrawer
            integrationId={integrationId}
            onClose={() => setDrawer(null)}
            onCloseAutoFocus={restoreFocus}
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
