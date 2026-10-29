import { useState, type ReactNode, type Ref } from 'react'
import { Check } from 'lucide-react'
import { Button, StatusPill, type StatusTone } from '@/components/app'
import { useFormat, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { isFullyPaid, uah } from './delivery-money'
import { deliveryMessages } from './messages'
import { waybillMessages } from './waybill-messages'
import {
  lifecycle,
  paymentKindLabel,
  shipmentChip,
  type LifecycleStep,
} from './delivery-view'
import type { DeliveryOrderState } from './use-delivery-order'

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
        delivery.agreedTotalUah <= 0
          ? t('standingUnknown')
          : isFullyPaid(delivery)
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

export interface ShipmentFactRow {
  key: string
  label: string
  value: ReactNode
  /** A short caption after the value: «створена …», «дорівнює залишку». */
  sub?: string
  mono?: boolean
  tone?: 'strong' | 'dim' | 'warn' | 'ok' | 'danger'
}

const FACT_TONE: Record<NonNullable<ShipmentFactRow['tone']>, string> = {
  strong: 'text-app-strong font-semibold',
  dim: 'text-app-dim',
  warn: 'text-state-warn',
  ok: 'text-state-ok',
  danger: 'text-state-danger',
}

/**
 * The order's «Доставка · Нова пошта» block (module 46 §4–6): a pill, the
 * carrier's last word under the title, the waybill facts, then the notices
 * and the buttons the waybill's stage allows. What goes in is decided by
 * `DeliveryShipmentBlock`; this only draws it.
 */
export function ShipmentCard({
  actions,
  caption,
  facts,
  hint,
  notices,
  numberRef,
  pill,
}: {
  actions: ReactNode
  /** One muted line above the buttons. */
  caption?: string | undefined
  facts: readonly ShipmentFactRow[] | null
  hint?: string | undefined
  notices?: ReactNode
  /** The waybill number, which takes focus once a waybill is created. */
  numberRef?: Ref<HTMLSpanElement> | undefined
  pill?: { label: string; tone: StatusTone } | null | undefined
}) {
  const t = useT(waybillMessages)
  const hasActions =
    actions !== null && actions !== undefined && actions !== false
  const hasForm =
    (notices !== undefined && notices !== null && notices !== false) ||
    (caption !== undefined && caption !== '') ||
    hasActions

  return (
    <section aria-labelledby="np-delivery-block" className="rz-card">
      <header className="rz-card__head py-2.5">
        <div className="grid min-w-0 gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="rz-h-card" id="np-delivery-block">
              {t('blockTitle')}
            </h2>
            {pill == null ? null : (
              <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
            )}
          </div>
          {hint === undefined || hint === '' ? null : (
            <p className="rz-caption m-0 text-pretty">{hint}</p>
          )}
        </div>
      </header>
      {facts === null ? null : (
        <dl className="rz-facts">
          {facts.map((fact) => (
            <div key={fact.key}>
              <dt>{fact.label}</dt>
              <dd>
                <span
                  className={cn(
                    fact.mono === true ? 'rz-mono' : undefined,
                    fact.tone === undefined ? undefined : FACT_TONE[fact.tone],
                  )}
                  {...(fact.key === 'number' && numberRef !== undefined
                    ? { ref: numberRef, tabIndex: -1 }
                    : {})}
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
      )}
      {hasForm ? (
        <div className="border-app-line grid gap-2.5 border-t px-(--rz-card-p) py-2.5">
          {notices}
          {caption === undefined || caption === '' ? null : (
            <p className="rz-caption m-0 text-pretty">{caption}</p>
          )}
          {hasActions ? <div className="rz-btn-row">{actions}</div> : null}
        </div>
      ) : null}
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
