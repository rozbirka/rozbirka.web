import type { Ref } from 'react'
import { Link } from 'react-router'
import {
  Ban,
  Calculator,
  Copy,
  ExternalLink,
  FilePlus,
  FileText,
  KeyRound,
  PackageCheck,
  Link2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Button, Notice, type StatusTone } from '@/components/app'
import type { NovaPoshtaDispatchPoint } from '@/api/integrations'
import type { DeliveryOrder } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'
import { useFormat, useLocale, useT } from '@/i18n'
import { npRecoveryMessages } from '../../integrations/np-recovery-messages'
import { ShipmentCard, type ShipmentFactRow } from './DeliveryOrderCard'
import { uah } from './delivery-money'
import { deliveryFlowMessages } from './flow-messages'
import { deliveryMessages } from './messages'
import { TitledNotice } from './WaybillCreateSheet'
import { waybillMessages } from './waybill-messages'
import {
  contactLine,
  createdAt,
  destinationLine,
  parcelLine,
  routeLine,
  type WaybillStage,
} from './waybill-view'

/** A waybill cancelled in this session, kept on screen until the next step. */
export interface CancelledWaybill {
  shipment: Shipment
  at: string
  /** Cancelled to apply a change; the new waybill is still to come (5.6). */
  recreate: boolean
}

export interface ShipmentBlockActions {
  start: () => void
  edit: () => void
  check: () => void
  attach: () => void
  recheck: () => void
  reconcile: () => void
  print: () => void
  refresh: () => void
  copy: () => void
  editWaybill: () => void
  cancelWaybill: () => void
  createNew: () => void
  changeDelivery: () => void
  payDeposit: () => void
  recover: () => void
  /** The two steps Core also takes by hand: handed over, then received. */
  dispatch: () => void
  receive: () => void
}

/**
 * The order's Nova Poshta block for each waybill stage, with the buttons the
 * state×action matrix of module 46 (section 11) allows. Without «Керування
 * замовленнями» the create, edit, cancel, attach and check buttons are not
 * shown at all; printing and reading stay.
 */
export function DeliveryShipmentBlock({
  actions,
  attachedAt,
  awaitingCod = false,
  busy,
  canManage,
  canPay,
  cancelled,
  carrierReady,
  delivery,
  lost,
  numberRef,
  points,
  recoverRef,
  shipment,
  stage,
  waiting,
  waybillPath,
}: {
  actions: ShipmentBlockActions
  /** When the waybill was attached from the carrier's cabinet here (6.12). */
  attachedAt: string | null
  /** Received, the post-payment not yet in (9.2): the pill says both. */
  awaitingCod?: boolean
  busy: boolean
  canManage: boolean
  canPay: boolean
  cancelled: CancelledWaybill | null
  /** False while Nova Poshta is not usable: nothing that calls it is offered. */
  carrierReady: boolean
  delivery: DeliveryOrder
  /** The waybill's carrier cabinet lost its key (3.2). */
  lost: boolean
  numberRef: Ref<HTMLSpanElement>
  points: readonly NovaPoshtaDispatchPoint[]
  recoverRef: Ref<HTMLButtonElement>
  shipment: Shipment | null
  stage: WaybillStage
  /** A result check found no proof yet (5.15). */
  waiting: boolean
  /** The waybill card (module 46 §8); null when it cannot be opened. */
  waybillPath: string | null
}) {
  const { locale } = useLocale()
  const format = useFormat()
  const t = useT(waybillMessages)
  const tm = useT(deliveryMessages)
  const tr = useT(npRecoveryMessages)
  const tf = useT(deliveryFlowMessages)
  const when = (value: string | null) =>
    value === null ? '' : (format.dateTime(value) ?? value)
  const manage = canManage && carrierReady

  const facts = (
    source: Shipment,
    number: { value: string; sub: string } | null,
  ): ShipmentFactRow[] => {
    const created = number !== null
    const cod = created ? source.codUah : delivery.outstandingUah
    return [
      {
        key: 'number',
        label: tm('stepWaybill'),
        value: number?.value ?? tm('factNotCreated'),
        sub: number?.sub ?? '',
        mono: true,
        tone: created ? 'strong' : 'dim',
      },
      {
        key: 'recipient',
        label: t('groupRecipient'),
        value: contactLine(source.draft.recipient),
      },
      {
        key: 'route',
        label: t('factRoute'),
        value: routeLine(source.sender, source.draft.recipient),
      },
      {
        key: 'parcel',
        label: tm('factParcel'),
        value: parcelLine(source.draft.parcels, locale),
        mono: true,
      },
      {
        key: 'cod',
        label: tm('factCod'),
        value: cod === null ? '—' : uah(cod, locale),
        sub:
          cod === null
            ? ''
            : cod === delivery.outstandingUah
              ? tm('factCodMatches')
              : tm('factCodMismatch'),
        mono: true,
      },
    ]
  }

  const createDisabled = (
    <Button disabled>
      <FilePlus aria-hidden />
      {tm('actionCreate')}
    </Button>
  )
  const checkResult = (primary = true) => (
    <Button
      disabled={busy}
      onClick={actions.reconcile}
      variant={primary ? 'primary' : 'ghost'}
    >
      <SearchCheck aria-hidden />
      {primary ? t('checkResult') : t('checkNow')}
    </Button>
  )

  // Cancelled here: the number stays on screen with what can come next.
  if (stage === 'none' && cancelled !== null)
    return (
      <ShipmentCard
        actions={
          manage ? (
            <>
              <Button
                disabled={busy}
                onClick={actions.createNew}
                variant="primary"
              >
                <FilePlus aria-hidden />
                {t('createNew')}
              </Button>
              {cancelled.recreate ? null : (
                <Button disabled={busy} onClick={actions.changeDelivery}>
                  <Pencil aria-hidden />
                  {t('changeDelivery')}
                </Button>
              )}
            </>
          ) : null
        }
        facts={facts(cancelled.shipment, {
          value: cancelled.shipment.number ?? '—',
          sub: t('cancelledSub', { when: when(cancelled.at) }),
        })}
        notices={
          cancelled.recreate ? (
            <TitledNotice title={t('recreateTitle')} tone="warn">
              {t('recreateText')}
            </TitledNotice>
          ) : (
            <Notice tone="info">{t('cancelledNotice')}</Notice>
          )
        }
        pill={{ label: tm('shipCancelled'), tone: 'neutral' }}
      />
    )

  if (stage === 'none' || shipment === null)
    return (
      <ShipmentCard
        actions={
          manage ? (
            <>
              <Button disabled={busy} onClick={actions.start} variant="primary">
                <Truck aria-hidden />
                {tm('startDelivery')}
              </Button>
              <Button disabled={busy} onClick={actions.attach} variant="quiet">
                <Link2 aria-hidden />
                {tm('attachWaybill')}
              </Button>
            </>
          ) : null
        }
        facts={null}
        hint={tm('configureNote')}
      />
    )

  if (stage === 'draftStale') {
    const point = points.find((item) => item.isDefault) ?? points[0] ?? null
    return (
      <ShipmentCard
        actions={
          manage ? (
            <>
              <Button
                disabled={busy}
                onClick={actions.recheck}
                variant="primary"
              >
                <Calculator aria-hidden />
                {t('checkAndQuote')}
              </Button>
              <Button disabled>
                <FilePlus aria-hidden />
                {t('createInvoice')}
              </Button>
            </>
          ) : null
        }
        facts={[
          {
            key: 'recipient',
            label: t('groupRecipient'),
            value: contactLine(shipment.draft.recipient),
          },
          {
            key: 'to',
            label: t('factDestination'),
            value: destinationLine(shipment.draft.recipient),
          },
          {
            key: 'sender',
            label: t('factSender'),
            value:
              point?.companyName ?? point?.senderName ?? shipment.sender.name,
            tone: 'warn',
          },
          {
            key: 'cost',
            label: t('factDeliveryCost'),
            value: '—',
            sub: t('quoteDropped'),
            mono: true,
            tone: 'dim',
          },
        ]}
        notices={
          <TitledNotice title={t('staleSenderTitle')} tone="warn">
            {t('staleSenderText')}
          </TitledNotice>
        }
        pill={{ label: tm('stateDraft'), tone: 'neutral' }}
      />
    )
  }

  if (stage === 'draft') {
    const depositShort =
      delivery.depositRequired &&
      !delivery.depositWaived &&
      delivery.requiredDepositUah > 0 &&
      !delivery.depositSatisfied
    return (
      <ShipmentCard
        actions={
          manage ? (
            <>
              <Button disabled={busy} onClick={actions.check} variant="primary">
                <ShieldCheck aria-hidden />
                {t('checkAndCreate')}
              </Button>
              {depositShort && canPay ? (
                <Button disabled={busy} onClick={actions.payDeposit}>
                  <Plus aria-hidden />
                  {t('payDeposit')}
                </Button>
              ) : (
                <Button disabled={busy} onClick={actions.edit}>
                  <Pencil aria-hidden />
                  {t('edit')}
                </Button>
              )}
              <Button disabled={busy} onClick={actions.attach} variant="quiet">
                <Link2 aria-hidden />
                {tm('attachWaybill')}
              </Button>
            </>
          ) : null
        }
        caption={depositShort ? undefined : t('draftCaption')}
        facts={facts(shipment, null)}
        notices={
          depositShort ? (
            <TitledNotice title={tm('nextDepositTitle')} tone="warn">
              {t('depositNotice', {
                required: uah(delivery.requiredDepositUah, locale),
                paid: uah(
                  Math.max(
                    0,
                    delivery.requiredDepositUah - delivery.depositShortfallUah,
                  ),
                  locale,
                ),
              })}
            </TitledNotice>
          ) : null
        }
        pill={{ label: tm('stateDraft'), tone: 'neutral' }}
      />
    )
  }

  if (stage === 'creating' || stage === 'unknown') {
    return (
      <ShipmentCard
        actions={
          manage ? (
            <>
              {waiting ? checkResult(false) : checkResult()}
              {createDisabled}
            </>
          ) : null
        }
        facts={facts(shipment, null)}
        notices={
          waiting ? (
            <TitledNotice title={t('waitTitle')} tone="warn">
              {t('waitCreate')}
            </TitledNotice>
          ) : stage === 'creating' ? (
            <Notice tone="info">{t('busyCreating')}</Notice>
          ) : (
            <TitledNotice title={t('unknownTitle')} tone="warn">
              {t('unknownCreate')}
            </TitledNotice>
          )
        }
        pill={
          stage === 'creating'
            ? { label: tm('shipCreating'), tone: 'warn' }
            : { label: tm('shipUnknown'), tone: 'warn' }
        }
      />
    )
  }

  const numberFact = {
    value: shipment.number ?? '—',
    sub:
      attachedAt !== null
        ? t('attachedSub', { when: when(attachedAt) })
        : createdAt(shipment) === null
          ? ''
          : t('createdSub', { when: when(createdAt(shipment)) }),
  }
  const hint =
    shipment.trackingStatus === null
      ? t('npStatusNone')
      : shipment.lastTrackedAt === null
        ? t('npStatusNoTime', { status: shipment.trackingStatus })
        : t('npStatus', {
            status: shipment.trackingStatus,
            time: format.time(shipment.lastTrackedAt) ?? '',
          })

  if (stage === 'cancelling' || stage === 'cancelUnknown') {
    return (
      <ShipmentCard
        actions={
          manage ? (
            <>
              {waiting ? checkResult(false) : checkResult()}
              <Button disabled>
                <Pencil aria-hidden />
                {t('edit')}
              </Button>
              <Button disabled variant="quiet">
                <Ban aria-hidden />
                {t('cancelWaybill')}
              </Button>
            </>
          ) : null
        }
        facts={facts(shipment, numberFact)}
        hint={hint}
        notices={
          waiting ? (
            <TitledNotice title={t('waitTitle')} tone="warn">
              {t('waitCancel')}
            </TitledNotice>
          ) : stage === 'cancelling' ? (
            <Notice tone="info">{t('busyCancelling')}</Notice>
          ) : (
            <TitledNotice title={t('unknownTitle')} tone="warn">
              {t('unknownCancel')}
            </TitledNotice>
          )
        }
        numberRef={numberRef}
        pill={{
          label:
            stage === 'cancelling'
              ? tm('stateCancelling')
              : tm('stateCancelUnknown'),
          tone: 'warn',
        }}
      />
    )
  }

  if (stage === 'cancelled')
    return (
      <ShipmentCard
        actions={null}
        facts={facts(shipment, numberFact)}
        pill={{ label: tm('shipCancelled'), tone: 'neutral' }}
      />
    )

  // A live waybill: created, sent or received.
  if (lost)
    return (
      <ShipmentCard
        actions={
          carrierReady ? (
            <>
              <Button
                disabled={busy}
                onClick={actions.recover}
                ref={recoverRef}
                variant="primary"
              >
                <KeyRound aria-hidden />
                {tr('recover')}
              </Button>
              {waybillPath === null ? null : (
                <Button asChild variant="quiet">
                  <Link to={waybillPath}>
                    <ExternalLink aria-hidden />
                    {tr('openWaybill')}
                  </Link>
                </Button>
              )}
            </>
          ) : null
        }
        facts={facts(shipment, numberFact)}
        notices={
          <Notice tone="danger">
            {tr('statusStale', { number: shipment.number ?? '' })}
          </Notice>
        }
        numberRef={numberRef}
        pill={{ label: tr('noAccess'), tone: 'danger' }}
      />
    )

  const pill: { label: string; tone: StatusTone } =
    stage === 'received'
      ? awaitingCod
        ? { label: tf('deliveredAwaitingCod'), tone: 'warn' }
        : { label: tm('shipReceived'), tone: 'ok' }
      : stage === 'sent'
        ? { label: t('pillSent'), tone: 'info' }
        : attachedAt !== null
          ? { label: t('pillAttached'), tone: 'ok' }
          : { label: tm('stateCreated'), tone: 'ok' }

  return (
    <ShipmentCard
      actions={
        carrierReady ? (
          <>
            <Button disabled={busy} onClick={actions.print} variant="primary">
              <Printer aria-hidden />
              {tm('printLabel')}
            </Button>
            {waybillPath === null ? null : (
              <Button asChild>
                <Link to={waybillPath}>
                  <FileText aria-hidden />
                  {tm('waybillData')}
                </Link>
              </Button>
            )}
            <Button
              aria-busy={busy}
              disabled={busy}
              onClick={actions.refresh}
              variant="quiet"
            >
              <RefreshCw aria-hidden />
              {tm('refreshStatus')}
            </Button>
            <Button disabled={busy} onClick={actions.copy} variant="quiet">
              <Copy aria-hidden />
              {tm('copyNumber')}
            </Button>
            {manage && stage === 'created' && delivery.dispatchedAt === null ? (
              <Button disabled={busy} onClick={actions.dispatch}>
                <Truck aria-hidden />
                {tm('actionDispatch')}
              </Button>
            ) : null}
            {manage && stage === 'sent' && delivery.receivedAt === null ? (
              <Button disabled={busy} onClick={actions.receive}>
                <PackageCheck aria-hidden />
                {tm('shipReceived')}
              </Button>
            ) : null}
            {manage && stage === 'created' ? (
              <>
                <Button disabled={busy} onClick={actions.editWaybill}>
                  <Pencil aria-hidden />
                  {t('edit')}
                </Button>
                <Button
                  disabled={busy}
                  onClick={actions.cancelWaybill}
                  variant="quiet"
                >
                  <Ban aria-hidden />
                  {t('cancelWaybill')}
                </Button>
              </>
            ) : null}
          </>
        ) : null
      }
      facts={facts(shipment, numberFact)}
      hint={hint}
      notices={
        stage === 'created' ? null : (
          <Notice tone="info">{t('sentNotice')}</Notice>
        )
      }
      numberRef={numberRef}
      pill={pill}
    />
  )
}
