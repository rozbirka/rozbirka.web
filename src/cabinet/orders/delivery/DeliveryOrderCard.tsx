import { useState, type ReactNode } from 'react'
import { Check, Plus, Truck } from 'lucide-react'
import { Button, Notice, StatusPill } from '@/components/app'
import { useFormat, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { uah } from './delivery-money'
import { deliveryMessages } from './messages'
import {
  lifecycle,
  paymentKindLabel,
  paymentStanding,
  primaryAction,
  shipmentChip,
  shipmentFacts,
  type LifecycleStep,
  type PrimaryAction,
  type ShipmentFact,
} from './delivery-view'
import type { DeliveryOrderState } from './use-delivery-order'

const TONE: Record<ShipmentFact['tone'], string> = {
  ink: 'text-app-strong',
  ok: 'text-state-ok',
  warn: 'text-state-warn',
  danger: 'text-state-danger',
  dim: 'text-app-dim',
}

/** The four moments of a delivery order, drawn as one rail across the card. */
export function DeliveryLifecycle({
  steps,
}: {
  steps: readonly LifecycleStep[]
}) {
  const t = useT(deliveryMessages)
  return (
    <ol aria-label={t('lifecycleLabel')} className="rz-steps">
      {steps.map((step, index) => (
        <li
          {...(step.current ? { 'aria-current': 'step' as const } : {})}
          className="h-auto min-h-7 py-1"
          data-state={step.done && !step.current ? 'done' : undefined}
          key={step.key}
        >
          <span aria-hidden className="rz-steps__n">
            {String(index + 1)}
          </span>
          <span className="grid min-w-0">
            <span className="truncate">{step.label}</span>
            {step.meta === '' ? null : (
              <span className="rz-dim font-mono text-micro font-normal whitespace-nowrap">
                {step.meta}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

export type DeliveryTab = 'sales' | 'shipping'

/**
 * The two halves of a delivery order. They are one order, but two different
 * questions — what was sold and what is owed, against where the parcel is —
 * and a manager is only ever answering one of them at a time.
 */
export function DeliveryTabs({
  delivery,
  onChange,
  shipment,
  tab,
}: {
  delivery: NonNullable<DeliveryOrderState['money']>
  onChange: (tab: DeliveryTab) => void
  shipment: DeliveryOrderState['shipment']
  tab: DeliveryTab
}) {
  const { locale } = useLocale()
  const t = useT(deliveryMessages)
  const parcel = shipmentChip(delivery, shipment, locale)
  const options: { key: DeliveryTab; label: string; meta: string }[] = [
    {
      key: 'sales',
      label: t('tabSales'),
      meta:
        delivery.outstandingUah === 0
          ? t('tabPaid')
          : t('tabBalance', { amount: uah(delivery.outstandingUah, locale) }),
    },
    { key: 'shipping', label: t('tabShipping'), meta: parcel.label },
  ]

  return (
    <div aria-label={t('tabsLabel')} className="rz-tabs" role="tablist">
      {options.map((option) => (
        <button
          aria-selected={tab === option.key}
          className={cn(
            'flex cursor-pointer flex-col items-start gap-0.5 border-0 bg-transparent px-2.5 py-1.5 text-left font-medium whitespace-nowrap transition-colors',
            tab === option.key
              ? 'text-app-strong font-semibold shadow-[inset_0_-2px_0_var(--rz-brand)]'
              : 'text-app-muted hover:text-app-strong',
          )}
          key={option.key}
          onClick={() => onChange(option.key)}
          role="tab"
          type="button"
        >
          <span>{option.label}</span>
          <span className="rz-caption font-normal">{option.meta}</span>
        </button>
      ))}
    </div>
  )
}

/** The carrier half: the waybill, the parcel, and what the money allows. */
export function ShipmentCard({
  actions,
  delivery,
  shipment,
}: {
  actions: ReactNode
  delivery: NonNullable<DeliveryOrderState['money']>
  shipment: DeliveryOrderState['shipment']
}) {
  const { locale } = useLocale()
  const t = useT(deliveryMessages)
  const parcel = shipmentChip(delivery, shipment, locale)
  const facts = shipmentFacts(delivery, shipment, locale)

  return (
    <section aria-label={t('novaPoshta')} className="rz-card">
      <div className="rz-card__head py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="rz-h-card">{t('novaPoshta')}</h2>
          <StatusPill tone={parcel.tone}>{parcel.label}</StatusPill>
        </div>
      </div>
      <dl className="rz-kpis m-0 rounded-none border-0">
        {facts.map((fact) => (
          <div className="rz-kpi" key={fact.key}>
            <dt className="rz-kpi__label">{fact.label}</dt>
            <dd className="m-0 grid gap-1">
              <span className={cn('rz-mono', TONE[fact.tone])}>
                {fact.value}
              </span>
              {fact.note === '' ? null : (
                <span className="rz-kpi__meta text-pretty">{fact.note}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {actions === null ? null : (
        <div className="rz-btn-row border-app-line border-t px-(--rz-card-p) py-2.5">
          {actions}
        </div>
      )}
    </section>
  )
}

/** Who the parcel goes to, as the waybill draft records it. */
export function RecipientCard({
  phone,
  shipment,
}: {
  phone: string | null
  shipment: DeliveryOrderState['shipment']
}) {
  const t = useT(deliveryMessages)
  const recipient = shipment?.draft.recipient ?? null
  if (recipient === null) return null

  return (
    <section aria-label={t('recipient')} className="rz-card">
      <div className="rz-card__head py-2">
        <h2 className="rz-h-card">{t('recipient')}</h2>
      </div>
      <div className="rz-card__body grid gap-1">
        <p className="rz-strong m-0 font-semibold">{recipient.name}</p>
        <p className="rz-muted m-0 font-mono">
          {recipient.phone || (phone ?? '—')}
        </p>
        {/* The carrier identifies a branch by a GUID, so the draft carries the
            name it was chosen by — that is the only readable form there is. */}
        <p className="rz-dim m-0">
          {recipient.warehouseName ?? t('branchChosen')}
        </p>
      </div>
    </section>
  )
}

/** Money already taken against the order, with the fee each till kept. */
export function DeliveryPaymentsCard({
  actions,
  delivery,
  tillName,
}: {
  actions: ReactNode
  delivery: NonNullable<DeliveryOrderState['money']>
  /** Names the till behind an account id, when the cash module is readable. */
  tillName: (accountId: string) => string | null
}) {
  const { locale } = useLocale()
  const t = useT(deliveryMessages)
  const format = useFormat()
  const live = delivery.payments.filter(
    (payment) => payment.refundedAt === null,
  )

  return (
    <section aria-label={t('payments')} className="rz-card">
      <div className="rz-card__head py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="rz-h-card">{t('payments')}</h2>
          <span className="rz-dim font-mono text-caption">
            {String(live.length)}
          </span>
        </div>
        <div className="rz-btn-row gap-1.5">{actions}</div>
      </div>
      {live.length === 0 ? (
        <p className="rz-card__body text-app-muted m-0">{t('noPayments')}</p>
      ) : (
        <ul aria-label={t('orderPayments')} className="m-0 list-none p-0">
          {live.map((payment) => (
            <li
              className="border-app-line flex items-center gap-2.5 border-t px-(--rz-card-p) py-2.5 first:border-t-0"
              key={payment.id}
            >
              <span aria-hidden className="rz-timeline__icon">
                <Check />
              </span>
              <span className="min-w-0">
                <span className="rz-strong block font-medium">
                  {paymentKindLabel(payment.kind, locale)}
                </span>
                <span className="rz-caption block truncate">
                  {tillName(payment.accountId) ?? t('till')} ·{' '}
                  {format.dateTime(payment.createdAt) ?? payment.createdAt}
                  {payment.feeUah > 0
                    ? t('fee', { amount: uah(payment.feeUah, locale) })
                    : ''}
                </span>
              </span>
              <span className="rz-num rz-strong ml-auto whitespace-nowrap">
                {uah(payment.amountUah, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** What is owed and the single move the order is waiting for. */
export function DeliveryDueCard({
  busy,
  delivery,
  novaPoshtaAvailable = true,
  onPrimary,
  shipment,
}: {
  busy: boolean
  delivery: NonNullable<DeliveryOrderState['money']>
  onPrimary: (
    kind: NonNullable<ReturnType<typeof primaryAction>['kind']>,
  ) => void
  shipment: DeliveryOrderState['shipment']
  /**
   * False outside Ukraine: there is no carrier to book with, so the waybill
   * is not offered as the next move.
   */
  novaPoshtaAvailable?: boolean
}) {
  const { locale } = useLocale()
  const t = useT(deliveryMessages)
  const proposed = primaryAction(delivery, shipment, locale)
  const action: PrimaryAction =
    !novaPoshtaAvailable && proposed.kind === 'create'
      ? { kind: null, label: '', hint: t('countryUnavailable') }
      : proposed
  const paidPercent =
    delivery.agreedTotalUah <= 0
      ? 0
      : Math.min(
          100,
          Math.round((delivery.appliedUah / delivery.agreedTotalUah) * 100),
        )
  const standing = paymentStanding(delivery, locale)

  return (
    <section aria-label={t('due')} className="rz-card">
      <div className="rz-card__head py-2">
        <h2 className="rz-h-card">{t('due')}</h2>
        <StatusPill tone={standing.tone === 'dim' ? 'neutral' : standing.tone}>
          {standing.label}
        </StatusPill>
      </div>
      <div className="rz-card__body grid gap-3">
        <p className="rz-display m-0">{uah(delivery.outstandingUah, locale)}</p>
        <span aria-hidden className="rz-meter">
          <span style={{ width: `${String(paidPercent)}%` }} />
        </span>
      </div>
      <dl className="rz-facts border-app-line border-t">
        <div>
          <dt>{t('agreed')}</dt>
          <dd className="rz-mono">{uah(delivery.agreedTotalUah, locale)}</dd>
        </div>
        <div>
          <dt>{t('paid')}</dt>
          <dd className="rz-mono">{uah(delivery.appliedUah, locale)}</dd>
        </div>
      </dl>
      <div className="rz-card__foot grid justify-stretch gap-2">
        {action.kind === null ? null : (
          <Button
            disabled={busy}
            onClick={() => onPrimary(action.kind!)}
            size="wide"
            variant="primary"
          >
            {action.kind === 'create' ? <Truck aria-hidden /> : null}
            {action.kind === 'pay' ? <Plus aria-hidden /> : null}
            {action.label}
          </Button>
        )}
        {/* Taking money is no longer the step the order waits for, but a yard
            still takes a deposit over the counter, so the way to record one has
            to stay in reach — just not as the thing being asked for. */}
        {delivery.outstandingUah > 0 && action.kind !== 'pay' ? (
          <Button disabled={busy} onClick={() => onPrimary('pay')} size="wide">
            <Plus aria-hidden />
            {t('recordPayment')}
          </Button>
        ) : null}
        <p className="rz-caption m-0 text-center text-pretty">{action.hint}</p>
      </div>
    </section>
  )
}

/** The readiness rail on the delivery tab: five steps, in Core's order. */
export function DeliverySteps({
  delivery,
  shipment,
}: {
  delivery: NonNullable<DeliveryOrderState['money']>
  shipment: DeliveryOrderState['shipment']
}) {
  const { locale, timeZone } = useLocale()
  const t = useT(deliveryMessages)
  // The rail at the top of the card is the four moments an order passes
  // through; this list adds the one it may end on, which is never reached in
  // the ordinary course of things and so is not a step of the rail.
  const steps = [
    ...lifecycle(delivery, shipment, locale, timeZone),
    {
      key: 'returned',
      label: t('stepReturned'),
      meta: '',
      done: delivery.returnedAt !== null,
      current: delivery.receivedAt !== null && delivery.returnedAt === null,
    },
  ]
  const [expanded, setExpanded] = useState(false)
  const notes: Record<string, string> = {
    paid: t('notePaid'),
    waybill: t('noteWaybill'),
    dispatched: t('noteDispatched'),
    received: t('noteReceived'),
    returned: t('noteReturned'),
  }

  return (
    <section aria-label={t('stepsTitle')} className="rz-card">
      <div className="rz-card__head py-2">
        <h2 className="rz-h-card">{t('stepsTitle')}</h2>
        <Button
          className="relative after:absolute after:-inset-2 after:content-['']"
          onClick={() => setExpanded((value) => !value)}
          size="sm"
          variant="quiet"
        >
          {expanded ? t('stepsShort') : t('stepsExplain')}
        </Button>
      </div>
      <ol className="rz-timeline">
        {steps.map((step) => (
          <li key={step.key}>
            <span
              aria-hidden
              className={cn(
                'rz-timeline__icon',
                step.done
                  ? 'bg-state-ok-soft text-state-ok'
                  : step.current
                    ? 'bg-state-warn-soft text-state-warn'
                    : 'bg-transparent shadow-[inset_0_0_0_1px_var(--rz-border-strong)]',
              )}
            >
              {step.done ? <Check /> : null}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block font-medium',
                  step.done || step.current ? 'rz-strong' : 'rz-dim',
                )}
              >
                {step.label}
              </span>
              {expanded && notes[step.key] !== undefined ? (
                <span className="rz-caption block text-pretty">
                  {notes[step.key]}
                </span>
              ) : null}
            </span>
            <span className="rz-timeline__date">{step.meta || '—'}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The one sentence standing between this order and a waybill. */
export function DeliveryGateCard({
  delivery,
}: {
  delivery: NonNullable<DeliveryOrderState['money']>
}) {
  const t = useT(deliveryMessages)
  const { locale } = useLocale()
  const blocked = delivery.outstandingUah > 0
  return (
    <Notice block tone={blocked ? 'warn' : 'ok'}>
      <p className="rz-strong m-0 font-semibold">
        {blocked ? t('gateCodTitle') : t('gateReadyTitle')}
      </p>
      <p className="m-0 mt-1">
        {blocked
          ? t('gateCodNote', { amount: uah(delivery.outstandingUah, locale) })
          : t('createHintPaid')}
      </p>
    </Notice>
  )
}
