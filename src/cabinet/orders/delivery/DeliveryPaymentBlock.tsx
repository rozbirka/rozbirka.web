import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Link2, Plus, Undo2 } from 'lucide-react'
import { Button, Notice, StatusPill, type StatusTone } from '@/components/app'
import type { DeliveryOrder, DeliveryPayment } from '@/api/delivery'
import type { Shipment } from '@/api/shipping'
import { useFormat, useLocale, useT, type MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'
import { hasDepositWaiver, minimumPrepayment, uah } from './delivery-money'
import { paymentStanding } from './delivery-view'
import {
  livePayments,
  orderClosing,
  paymentState,
  refundTotals,
} from './delivery-flow'
import { deliveryFlowMessages } from './flow-messages'
import { deliveryMessages } from './messages'
import { TitledNotice } from './WaybillCreateSheet'

type FlowKey = MessageKey<typeof deliveryFlowMessages>

/**
 * The till the carrier's post-payment is booked into, as far as the cabinet
 * can tell: `undefined` when it cannot read the integration's settings,
 * `null` when none is chosen.
 */
export type CodTill = { name: string; active: boolean } | null | undefined

export interface PaymentBlockActions {
  /** «Внести оплату»; the post-payment once the parcel was received. */
  record: () => void
  refund: () => void
  late: (mode: 'record' | 'link') => void
}

const KIND: Record<string, FlowKey> = {
  prepayment: 'subDeposit',
  cod: 'subCod',
  late_cod: 'subCod',
}

/**
 * «Оплата» (module 46 §9): the money half of a delivery order, apart from the
 * parcel. «Отримано» there never means «Оплачено» here — the order completes
 * only when both blocks say so. The next move for the money is in this block;
 * without «Фінанси» it has no buttons, only the reason why.
 */
export function DeliveryPaymentBlock({
  actions,
  busy,
  canPay,
  codTill,
  delivery,
  financePath,
  shipment,
  tillName,
}: {
  actions: PaymentBlockActions
  busy: boolean
  canPay: boolean
  codTill: CodTill
  delivery: DeliveryOrder
  /** «Фінанси», where an ambiguous payout is reconciled (9.6). */
  financePath: string | null
  shipment: Shipment | null
  tillName: (accountId: string) => string | null
}) {
  const { locale } = useLocale()
  const format = useFormat()
  const t = useT(deliveryFlowMessages)
  const tm = useT(deliveryMessages)
  const state = paymentState(delivery, shipment)
  // A return in progress takes no new money until it is settled.
  const open = !orderClosing(delivery)
  const totals = refundTotals(delivery)
  const live = livePayments(delivery)
  const money = (value: number) => uah(value, locale)

  const kindLabel = (payment: DeliveryPayment) =>
    t(payment.kind === null ? 'subOther' : (KIND[payment.kind] ?? 'subOther'))
  // «завдаток · Основна каса» for one payment, «завдаток + післяплата» for more.
  const paidSub = (): string => {
    if (state === 'refundPartial' || state === 'refunded')
      return t('subRefunded', { amount: money(totals.refunded) })
    if (state === 'late') return t('subLate')
    if (live.length === 1) {
      const only = live[0]!
      const till = tillName(only.accountId)
      return till === null ? kindLabel(only) : `${kindLabel(only)} · ${till}`
    }
    return [...new Set(live.map(kindLabel))].join(' + ')
  }

  const standing = paymentStanding(delivery, locale)
  const pill: { label: string; tone: StatusTone } = {
    unpriced: { label: standing.label, tone: 'neutral' as const },
    paid: { label: t('pillPaid'), tone: 'ok' as const },
    awaitingCod: { label: t('pillAwaitingCod'), tone: 'warn' as const },
    manual: { label: t('pillManual'), tone: 'warn' as const },
    reconcile: { label: t('pillReconcile'), tone: 'warn' as const },
    due: {
      label: standing.label,
      tone: standing.tone === 'dim' ? ('neutral' as const) : standing.tone,
    },
    refundDue: { label: t('pillAwaitingRefund'), tone: 'warn' as const },
    refundPartial: { label: t('pillRefundedPart'), tone: 'warn' as const },
    refunded: { label: t('pillRefunded'), tone: 'neutral' as const },
    retained: { label: t('pillRetained'), tone: 'neutral' as const },
    notApplicable: { label: t('pillNotApplicable'), tone: 'neutral' as const },
    late: { label: t('pillLate'), tone: 'danger' as const },
  }[state]

  // Core books the carrier's payout as a `cod` payment; the newest is it.
  const autoCod =
    shipment?.paymentState === 'Reconciled'
      ? (live.filter((payment) => payment.kind === 'cod').at(-1) ?? null)
      : null
  const left = money(delivery.outstandingUah)

  let notice: ReactNode = null
  if (state === 'unpriced')
    notice = <Notice tone="info">{t('noteTotalUnknown')}</Notice>
  else if (state === 'paid' && autoCod !== null)
    notice = (
      <Notice tone="ok">
        {t('noteAutoBooked', {
          amount: money(autoCod.amountUah),
          till: tillName(autoCod.accountId) ?? tm('till'),
          date: format.date(autoCod.createdAt) ?? autoCod.createdAt,
        })}
      </Notice>
    )
  else if (state === 'paid' && open && delivery.receivedAt === null)
    notice = <Notice tone="info">{t('notePaidEarly')}</Notice>
  else if (state === 'awaitingCod')
    notice =
      codTill === null ? (
        <Notice tone="warn">{t('noteNoTill')}</Notice>
      ) : (
        <Notice tone="info">
          {codTill === undefined
            ? t('noteAwaitingCodBare')
            : t('noteAwaitingCod', { till: codTill.name })}
        </Notice>
      )
  else if (state === 'manual') {
    // Core says only that a till was needed: none chosen, or one archived.
    const tillMissing = shipment?.paymentState === 'CashRegisterRequired'
    notice = (
      <Notice tone="warn">
        {tillMissing && codTill === null
          ? t('noteNoTill')
          : tillMissing && codTill != null && !codTill.active
            ? t('noteAutoFailedTill', { till: codTill.name })
            : t('noteAutoFailed')}
      </Notice>
    )
  } else if (state === 'reconcile')
    notice = (
      <TitledNotice title={t('reconcileTitle')} tone="warn">
        {t('noteReconcile', { left })}
      </TitledNotice>
    )
  else if (state === 'late')
    notice = (
      <Notice tone="danger">
        {t('lateNote', { amount: money(shipment?.codUah ?? 0) })}
      </Notice>
    )

  const recordButton = (primary: boolean) => (
    <Button
      disabled={busy}
      onClick={actions.record}
      variant={primary ? 'primary' : 'ghost'}
    >
      <Plus aria-hidden />
      {tm('recordPayment')}
    </Button>
  )

  // Return and cancellation refunds start from their own card; only a
  // cancelled order, which has no card step left, refunds from here.
  let buttons: ReactNode = null
  if (canPay) {
    if (state === 'manual' && open) buttons = recordButton(true)
    else if ((state === 'awaitingCod' || state === 'due') && open)
      buttons = recordButton(codTill === null && state === 'awaitingCod')
    else if (state === 'reconcile' && financePath !== null)
      buttons = (
        <Button asChild variant="primary">
          <Link to={financePath}>
            <ArrowUpRight aria-hidden />
            {t('reconcileAction')}
          </Link>
        </Button>
      )
    else if (state === 'late')
      buttons = (
        <>
          <Button
            disabled={busy}
            onClick={() => actions.late('record')}
            variant="primary"
          >
            <Plus aria-hidden />
            {t('lateRecord')}
          </Button>
          <Button disabled={busy} onClick={() => actions.late('link')}>
            <Link2 aria-hidden />
            {t('lateLink')}
          </Button>
        </>
      )
    else if (
      delivery.workflowState === 'Cancelled' &&
      (state === 'refundDue' || state === 'refundPartial')
    )
      buttons = (
        <Button disabled={busy} onClick={actions.refund} variant="primary">
          <Undo2 aria-hidden />
          {state === 'refundPartial' ? t('refundRest') : t('refundAction')}
        </Button>
      )
  }
  const askable =
    ((state === 'manual' || state === 'awaitingCod' || state === 'due') &&
      open) ||
    state === 'reconcile' ||
    state === 'late' ||
    (delivery.workflowState === 'Cancelled' && totals.due > 0)
  const hint = !canPay && askable ? t('noFinance') : null

  const facts: { key: string; label: string; value: string; sub?: string }[] = [
    {
      key: 'due',
      label: t('factDue'),
      value: delivery.agreedTotalUah > 0 ? money(delivery.agreedTotalUah) : '—',
    },
    {
      key: 'paid',
      label: t('factPaid'),
      value: money(
        state === 'late'
          ? (shipment?.codUah ?? 0)
          : state === 'refundPartial' ||
              state === 'refunded' ||
              state === 'retained'
            ? totals.booked
            : delivery.appliedUah,
      ),
      sub:
        live.length === 0 && state !== 'late' && totals.refunded === 0
          ? ''
          : paidSub(),
    },
    {
      key: 'left',
      label: t('factLeft'),
      value:
        state === 'late' || state === 'unpriced'
          ? '—'
          : orderClosingLeft(state)
            ? money(0)
            : left,
    },
  ]

  // Keep the required minimum separate from the actual customer payment above.
  if (open && delivery.dispatchedAt === null && shipment?.quoteAt != null) {
    const required = delivery.depositRequired && !hasDepositWaiver(delivery)
    facts.push({
      key: 'deposit',
      label: tm('factDeposit'),
      value: !delivery.depositRequired
        ? tm('depositStateNotRequired')
        : hasDepositWaiver(delivery)
          ? tm('depositStateWaived')
          : minimumPrepayment(delivery) <= 0
            ? tm('depositAfterQuote')
            : money(minimumPrepayment(delivery)),
      ...(required && minimumPrepayment(delivery) > 0
        ? {
            sub: delivery.depositSatisfied
              ? tm('depositNoAdditional')
              : tm('depositShort', {
                  amount: money(delivery.depositShortfallUah),
                }),
          }
        : {}),
    })
  }

  if (totals.retained > 0) {
    facts.push({
      key: 'retained',
      label: t('refundRetained'),
      value: money(totals.retained),
    })
    facts.push({
      key: 'refunded',
      label: t('factRefunded'),
      value: money(totals.refunded),
    })
  }

  return (
    <section aria-labelledby="np-payment-block" className="rz-card">
      <header className="rz-card__head min-h-0 border-b-0 px-4 pt-3.5 pb-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="rz-h-card" id="np-payment-block">
            {t('paymentTitle')}
          </h2>
          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
        </div>
      </header>
      <dl className="rz-facts [&_dt]:text-app-muted">
        {facts.map((fact) => (
          <div key={fact.key}>
            <dt>{fact.label}</dt>
            <dd>
              <span
                className={cn(
                  'rz-mono',
                  fact.key === 'left' && 'text-app-strong font-semibold',
                )}
              >
                {fact.value}
              </span>
              {fact.sub === undefined || fact.sub === '' ? null : (
                <span className="rz-caption ml-2 font-mono">{fact.sub}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {notice === null && buttons === null && hint === null ? null : (
        <div className="grid gap-3 px-4 pt-3.5 pb-4">
          {notice}
          {hint === null ? null : (
            <p className="rz-caption m-0 text-pretty">{hint}</p>
          )}
          {buttons === null ? null : (
            <div className="rz-btn-row">{buttons}</div>
          )}
        </div>
      )}
    </section>
  )
}

/** In a refund the balance owed by the customer is settled: nothing is due. */
const orderClosingLeft = (state: ReturnType<typeof paymentState>) =>
  state === 'refundDue' ||
  state === 'refundPartial' ||
  state === 'refunded' ||
  state === 'notApplicable' ||
  state === 'retained'
