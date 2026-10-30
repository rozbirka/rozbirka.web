import type { ReactNode } from 'react'
import { Ban, PackageCheck, SearchCheck, Undo2 } from 'lucide-react'
import { Button, Notice, StatusPill } from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'
import { useFormat, useLocale, useT } from '@/i18n'
import { NpChecks, type NpCheck } from '../../integrations/np-checks'
import { orderMessages } from '../messages'
import { uah } from './delivery-money'
import {
  cancellationPending,
  latePayout,
  refundTotals,
  RETURN_STEPS,
  returnProgress,
  type ReturnStep,
} from './delivery-flow'
import { deliveryFlowMessages } from './flow-messages'
import { TitledNotice } from './WaybillCreateSheet'
import { waybillMessages } from './waybill-messages'
import { place } from './waybill-view'

/**
 * A cancellation started here, kept for the steps Core does not record: the
 * waybill it cancelled (Core stops returning it) and whether Nova Poshta
 * confirmed that cancel (10.14).
 */
export interface CancelFlow {
  waybill: string | null
  waybillState: 'done' | 'unknown'
}

export interface FlowCardActions {
  accept: () => void
  refund: () => void
  reconcile: () => void
  cancelOrder: () => void
}

const STEP_KEY = {
  started: 'stepStarted',
  awaitGoods: 'stepAwaitGoods',
  accepted: 'stepAccepted',
  refunded: 'stepRefunded',
  cancelled: 'stepCancelledOrder',
} as const satisfies Record<ReturnStep, string>

/**
 * «Повернення» / «Скасування замовлення» (module 46 §10): the steps of a
 * return or a cancellation, done ones checked, the current one «зараз», with
 * the one move it waits for. A done step never offers its action again.
 * Nothing is drawn for an order in neither.
 */
export function DeliveryFlowCard({
  actions,
  busy,
  cancelFlow,
  cancelledAt,
  canManage,
  canPay,
  delivery,
  shipment,
  units,
  unresolvedCancel,
}: {
  actions: FlowCardActions
  busy: boolean
  cancelFlow: CancelFlow | null
  /** When Core cancelled the order (the order record keeps it). */
  cancelledAt: string | null
  canManage: boolean
  canPay: boolean
  delivery: DeliveryOrder
  shipment: Shipment | null
  /** Units the order holds — what a full return put back in stock. */
  units: number
  /** The waybill cancel is still without an answer (10.14). */
  unresolvedCancel: boolean
}) {
  const { locale } = useLocale()
  const format = useFormat()
  const t = useT(deliveryFlowMessages)
  const tw = useT(waybillMessages)
  const to = useT(orderMessages)
  const totals = refundTotals(delivery)
  const money = (value: number) => uah(value, locale)
  const refundHint = <p className="rz-caption m-0">{t('noFinance')}</p>

  const progress = returnProgress(delivery)
  if (progress !== null) {
    const late = latePayout(delivery, shipment)
    const since =
      cancelledAt === null
        ? null
        : t('stepSince', { date: format.date(cancelledAt) ?? cancelledAt })
    const items: NpCheck[] = RETURN_STEPS.map((step, index) => ({
      label:
        step === 'refunded'
          ? index >= progress
            ? t('settlementStep')
            : totals.retained > 0
              ? t('stepSettled')
              : t(STEP_KEY[step])
          : t(STEP_KEY[step]),
      value:
        index < progress
          ? step === 'refunded' && totals.retained > 0
            ? totals.refunded > 0
              ? t('subRefunded', { amount: money(totals.refunded) })
              : t('noCashRefund')
            : step === 'accepted'
              ? t('inStock', { count: units })
              : step === 'cancelled' && late && since !== null
                ? since
                : t('stepDone')
          : index === progress
            ? t('stepNow')
            : '',
      state: index < progress ? 'ok' : index === progress ? 'pending' : 'none',
    }))
    const current = RETURN_STEPS[Math.min(progress, RETURN_STEPS.length - 1)]!
    const returnNumber = shipment?.relatedNumbers[0] ?? null
    const toPlace = shipment === null ? '' : place(shipment.sender)

    let form: ReactNode = null
    if (progress === 1)
      form = (
        <>
          <Notice tone="info">
            {returnNumber === null
              ? t('waitNoteBare')
              : toPlace === ''
                ? t('waitNoteNumber', { number: returnNumber })
                : t('waitNote', { number: returnNumber, place: toPlace })}
          </Notice>
          {canManage ? (
            <div className="rz-btn-row">
              <Button
                disabled={busy}
                onClick={actions.accept}
                variant="primary"
              >
                <PackageCheck aria-hidden />
                {t('acceptAction')}
              </Button>
            </div>
          ) : null}
        </>
      )
    if (progress === 3)
      form = (
        <>
          <Notice tone="warn">
            {totals.refunded > 0
              ? t('partialNote', {
                  done: money(totals.refunded),
                  total: money(totals.booked),
                  left: money(totals.due),
                })
              : t('awaitRefundNote', { amount: money(totals.due) })}
          </Notice>
          {canPay ? (
            <div className="rz-btn-row">
              <Button
                disabled={busy}
                onClick={actions.refund}
                variant="primary"
              >
                <Undo2 aria-hidden />
                {totals.refunded > 0 ? t('refundRest') : t('refundAction')}
              </Button>
            </div>
          ) : (
            refundHint
          )}
        </>
      )

    if (totals.retained > 0)
      form = (
        <>
          {form}
          <Notice tone="info">
            {t('retainedNote', { amount: money(totals.retained) })}
            {delivery.deliveryRetentionNote ? (
              <> {delivery.deliveryRetentionNote}</>
            ) : null}
          </Notice>
        </>
      )

    return (
      <FlowCard
        form={form}
        items={items}
        pill={{
          label:
            current === 'refunded' ? t('settlementStep') : t(STEP_KEY[current]),
          done: progress >= RETURN_STEPS.length,
        }}
        title={t('returnTitle')}
      />
    )
  }

  // Cancelling an order that never left (10.13–10.14).
  const cancelled = delivery.workflowState === 'Cancelled'
  const pending = cancellationPending(delivery)
  if (!cancelled && !pending && cancelFlow === null) return null
  if (cancelled && delivery.dispatchedAt !== null) return null

  const waybill = cancelFlow?.waybill ?? null
  const unknown = cancelFlow?.waybillState === 'unknown' && unresolvedCancel
  // The waybill is cancelled but the order not yet: one more confirm.
  const resume = cancelFlow !== null && !unknown && !pending && !cancelled
  const items: NpCheck[] = []
  if (waybill !== null || unknown)
    items.push({
      label:
        waybill === null
          ? t('cancelStepWaybillBare')
          : t('cancelStepWaybill', { number: waybill }),
      value: unknown ? t('stepUnconfirmed') : t('stepCancelled'),
      state: unknown ? 'pending' : 'ok',
    })
  if (totals.booked > 0)
    items.push({
      label: t('cancelStepRefund', { amount: money(totals.booked) }),
      value: cancelled ? t('stepDone') : pending ? t('stepNow') : '',
      state: cancelled ? 'ok' : pending ? 'pending' : 'none',
    })
  items.push({
    label: t('cancelStepOrder'),
    value: cancelled ? t('stepDone') : resume ? t('stepNow') : '',
    state: cancelled ? 'ok' : resume ? 'pending' : 'none',
  })

  let form: ReactNode = null
  if (unknown)
    form = (
      <>
        <TitledNotice title={tw('unknownTitle')} tone="warn">
          {t('unknownCancelNote')}
        </TitledNotice>
        {canManage ? (
          <div className="rz-btn-row">
            <Button
              disabled={busy}
              onClick={actions.reconcile}
              variant="primary"
            >
              <SearchCheck aria-hidden />
              {tw('checkResult')}
            </Button>
          </div>
        ) : null}
      </>
    )
  else if (pending)
    form = (
      <>
        <TitledNotice title={t('oneStepTitle')} tone="warn">
          {waybill === null
            ? t('oneStepNoteBare', { amount: money(totals.due) })
            : t('oneStepNote', { amount: money(totals.due) })}
        </TitledNotice>
        {canPay ? (
          <div className="rz-btn-row">
            <Button disabled={busy} onClick={actions.refund} variant="primary">
              <Undo2 aria-hidden />
              {t('refundAction')}
            </Button>
          </div>
        ) : (
          refundHint
        )}
      </>
    )
  else if (resume)
    form = (
      <>
        <Notice tone="info">{t('continueNote')}</Notice>
        {canManage ? (
          <div className="rz-btn-row">
            <Button
              disabled={busy}
              onClick={actions.cancelOrder}
              variant="primary"
            >
              <Ban aria-hidden />
              {to('cancelOrder')}
            </Button>
          </div>
        ) : null}
      </>
    )

  return (
    <FlowCard form={form} items={items} pill={null} title={t('cancelCard')} />
  )
}

function FlowCard({
  form,
  items,
  pill,
  title,
}: {
  form: ReactNode
  items: readonly NpCheck[]
  pill: { label: string; done: boolean } | null
  title: string
}) {
  return (
    <section aria-labelledby="np-flow-card" className="rz-card">
      <header className="rz-card__head py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="rz-h-card" id="np-flow-card">
            {title}
          </h2>
          {pill === null ? null : (
            <StatusPill tone={pill.done ? 'neutral' : 'warn'}>
              {pill.label}
            </StatusPill>
          )}
        </div>
      </header>
      <div className="px-(--rz-card-p) py-1">
        <NpChecks items={items} label={title} />
      </div>
      {form === null ? null : (
        <div className="border-app-line grid gap-2.5 border-t px-(--rz-card-p) py-2.5">
          {form}
        </div>
      )}
    </section>
  )
}
