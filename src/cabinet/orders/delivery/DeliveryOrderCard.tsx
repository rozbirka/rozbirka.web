import { useState, type ReactNode } from 'react'
import { Check, Plus, Truck } from 'lucide-react'
import { Button, Notice, StatusPill } from '@/components/app'
import { cn } from '@/lib/utils'
import { uah } from './delivery-money'
import {
  lifecycle,
  paymentKindLabel,
  paymentStanding,
  primaryAction,
  shipmentChip,
  shipmentFacts,
  type LifecycleStep,
  type ShipmentFact,
} from './delivery-view'
import type { DeliveryOrderState } from './use-delivery-order'

const TONE: Record<ShipmentFact['tone'], string> = {
  ink: 'text-white',
  ok: 'text-state-ok',
  warn: 'text-state-warn',
  danger: 'text-state-danger',
  dim: 'text-app-dim',
}

const when = (value: string) => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(value)
  return parts ? `${parts[3]}.${parts[2]}.${parts[1]}, ${parts[4]}` : value
}

/** The four moments of a delivery order, drawn as one rail across the card. */
export function DeliveryLifecycle({
  steps,
}: {
  steps: readonly LifecycleStep[]
}) {
  return (
    <ol
      aria-label="Етапи доставки"
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
    >
      {steps.map((step) => (
        <li className="min-w-0" key={step.key}>
          <span
            aria-hidden
            className={cn(
              'block h-1 rounded-full',
              step.current
                ? 'bg-state-ok'
                : step.done
                  ? 'bg-white/35'
                  : 'bg-white/[0.08]',
            )}
          />
          <span className="mt-2.5 flex flex-col gap-[3px]">
            <span
              className={cn(
                'truncate text-[14px] font-bold',
                step.done ? 'text-white' : 'text-app-dim',
              )}
            >
              {step.label}
            </span>
            <span className="text-app-dim min-h-[15px] font-mono text-[11px] whitespace-nowrap">
              {step.meta}
            </span>
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
  const parcel = shipmentChip(delivery, shipment)
  const options: { key: DeliveryTab; label: string; meta: string }[] = [
    {
      key: 'sales',
      label: 'Продажі',
      meta:
        delivery.outstandingUah === 0
          ? 'оплачено'
          : `залишок ${uah(delivery.outstandingUah)}`,
    },
    { key: 'shipping', label: 'Доставка', meta: parcel.label },
  ]

  return (
    <div
      aria-label="Розділи замовлення"
      className="border-app-line flex gap-6 border-b"
      role="tablist"
    >
      {options.map((option) => (
        <button
          aria-selected={tab === option.key}
          className={cn(
            'relative -mb-px flex flex-col items-start gap-0.5 border-b-2 pt-1 pb-3 text-left transition-colors',
            tab === option.key
              ? 'border-brand text-white'
              : 'text-app-muted hover:text-app-ink border-transparent',
          )}
          key={option.key}
          onClick={() => onChange(option.key)}
          role="tab"
          type="button"
        >
          <span className="text-[15px] font-bold tracking-[-0.01em]">
            {option.label}
          </span>
          <span
            className={cn(
              'text-[12px]',
              tab === option.key ? 'text-app-muted' : 'text-app-dim',
            )}
          >
            {option.meta}
          </span>
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
  const parcel = shipmentChip(delivery, shipment)
  const facts = shipmentFacts(delivery, shipment)

  return (
    <section
      aria-label="Нова пошта"
      className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-6 pt-5 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
            Нова пошта
          </h2>
          <StatusPill tone={parcel.tone}>{parcel.label}</StatusPill>
        </div>
      </div>
      <dl className="border-app-line bg-app-line grid grid-cols-2 gap-px border-y lg:grid-cols-4">
        {facts.map((fact) => (
          <div className="bg-app-raised px-6 py-3.5" key={fact.key}>
            <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              {fact.label}
            </dt>
            <dd>
              <span
                className={cn(
                  'mt-2 block font-mono text-[15px] tabular-nums',
                  TONE[fact.tone],
                )}
              >
                {fact.value}
              </span>
              {fact.note === '' ? null : (
                <span className="text-app-dim mt-1 block text-[12px] text-pretty">
                  {fact.note}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2.5 px-6 py-4">{actions}</div>
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
  const recipient = shipment?.draft.recipient ?? null
  if (recipient === null) return null

  return (
    <section
      aria-label="Отримувач"
      className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-5 pb-5"
    >
      <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
        Отримувач
      </h2>
      <p className="mt-3 text-[15px] font-bold text-white">{recipient.name}</p>
      <p className="text-app-muted mt-1 font-mono text-[13px]">
        {recipient.phone || (phone ?? '—')}
      </p>
      {/* The carrier identifies a branch by a GUID, so the draft carries the
          name it was chosen by — that is the only readable form there is. */}
      <p className="text-app-dim mt-2 text-[13px]">
        {recipient.warehouseName ?? 'Відділення обрано'}
      </p>
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
  const live = delivery.payments.filter(
    (payment) => payment.refundedAt === null,
  )

  return (
    <section
      aria-label="Платежі"
      className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-6 pt-5 pb-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
            Платежі
          </h2>
          <span className="text-app-muted font-mono text-[12px]">
            {String(live.length)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      </div>
      {live.length === 0 ? (
        <p className="border-app-line text-app-muted border-t px-6 pt-4 pb-5 text-[14px]">
          Платежів ще немає.
        </p>
      ) : (
        <ul aria-label="Платежі замовлення">
          {live.map((payment) => (
            <li
              className="border-app-line flex items-center gap-3.5 border-t px-6 py-3.5"
              key={payment.id}
            >
              <span className="bg-state-ok-soft text-state-ok grid size-[34px] shrink-0 place-items-center rounded-[10px]">
                <Check aria-hidden className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-white">
                  {paymentKindLabel(payment.kind)}
                </span>
                <span className="text-app-muted mt-0.5 block truncate text-[13px]">
                  {tillName(payment.accountId) ?? 'каса'} ·{' '}
                  {when(payment.createdAt)}
                  {payment.feeUah > 0
                    ? ` · комісія ${uah(payment.feeUah)}`
                    : ''}
                </span>
              </span>
              <span className="ml-auto font-mono text-[15px] font-medium whitespace-nowrap text-white tabular-nums">
                {uah(payment.amountUah)}
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
  onPrimary,
  shipment,
}: {
  busy: boolean
  delivery: NonNullable<DeliveryOrderState['money']>
  onPrimary: (
    kind: NonNullable<ReturnType<typeof primaryAction>['kind']>,
  ) => void
  shipment: DeliveryOrderState['shipment']
}) {
  const action = primaryAction(delivery, shipment)
  const paidPercent =
    delivery.agreedTotalUah <= 0
      ? 0
      : Math.min(
          100,
          Math.round((delivery.appliedUah / delivery.agreedTotalUah) * 100),
        )
  const standing = paymentStanding(delivery)

  return (
    <section
      aria-label="До сплати"
      className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-[22px] pb-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
          До сплати
        </h2>
        <p
          className={cn(
            'text-[13px] font-bold',
            standing.tone === 'ok'
              ? 'text-state-ok'
              : standing.tone === 'warn'
                ? 'text-state-warn'
                : 'text-app-dim',
          )}
        >
          {standing.label}
        </p>
      </div>
      <p className="mt-3 text-[38px] leading-none font-extrabold tracking-[-0.03em] text-white tabular-nums">
        {uah(delivery.outstandingUah)}
      </p>
      <span aria-hidden className="mt-4.5 flex gap-0.5">
        <span
          className="bg-state-ok h-[5px] rounded-l-full"
          style={{ flex: paidPercent }}
        />
        <span
          className="h-[5px] rounded-r-full bg-white/[0.08]"
          style={{ flex: 100 - paidPercent }}
        />
      </span>
      <dl className="mt-4 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
        <dt className="text-app-muted text-[14px]">Сума замовлення</dt>
        <dd className="font-mono text-[14px] text-white tabular-nums">
          {uah(delivery.agreedTotalUah)}
        </dd>
        <dt className="text-app-muted text-[14px]">Сплачено</dt>
        <dd className="text-state-ok font-mono text-[14px] tabular-nums">
          {uah(delivery.appliedUah)}
        </dd>
      </dl>
      {action.kind === null ? null : (
        <Button
          className="mt-5 w-full justify-center"
          disabled={busy}
          onClick={() => onPrimary(action.kind!)}
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
        <Button
          className="mt-2.5 w-full justify-center"
          disabled={busy}
          onClick={() => onPrimary('pay')}
        >
          <Plus aria-hidden />
          Внести оплату
        </Button>
      ) : null}
      <p className="text-app-dim mt-3 text-center text-[12px] leading-[1.5] text-pretty">
        {action.hint}
      </p>
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
  // The rail at the top of the card is the four moments an order passes
  // through; this list adds the one it may end on, which is never reached in
  // the ordinary course of things and so is not a step of the rail.
  const steps = [
    ...lifecycle(delivery, shipment),
    {
      key: 'returned',
      label: 'Повернення',
      meta: '',
      done: delivery.returnedAt !== null,
      current: delivery.receivedAt !== null && delivery.returnedAt === null,
    },
  ]
  const [expanded, setExpanded] = useState(false)
  const notes: Record<string, string> = {
    paid: 'ТТН не створюється, поки є будь-який залишок.',
    waybill: 'Післяплата в накладній має дорівнювати залишку.',
    dispatched:
      'Фіксується дата передачі. Статус замовлення лишається «Очікує».',
    received:
      'Переводить замовлення в «Підтверджене» і вмикає звірку післяплати.',
    returned:
      'Доступне лише після отримання. Ставить замовленню статус «Повернено».',
  }

  return (
    <section
      aria-label="Порядок дій"
      className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-5 pb-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
          Порядок дій
        </h2>
        <button
          className="text-app-muted hover:text-app-ink relative text-[12px] font-semibold transition-colors after:absolute after:-inset-2 after:content-['']"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? 'Коротко' : 'Що це означає'}
        </button>
      </div>
      <ol className="mt-4 grid gap-3.5">
        {steps.map((step) => (
          <li className="flex gap-3" key={step.key}>
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border',
                step.done
                  ? 'bg-state-ok border-transparent text-black'
                  : step.current
                    ? 'border-state-warn/50'
                    : 'border-app-line-2',
              )}
            >
              {step.done ? <Check className="size-3" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span
                  className={cn(
                    'text-[14px] font-bold',
                    step.done
                      ? 'text-white'
                      : step.current
                        ? 'text-state-warn'
                        : 'text-app-dim',
                  )}
                >
                  {step.label}
                </span>
                <span className="text-app-dim font-mono text-[12px]">
                  {step.meta || '—'}
                </span>
              </span>
              {expanded && notes[step.key] !== undefined ? (
                <span className="text-app-dim mt-1 block text-[12px] leading-[1.5] text-pretty">
                  {notes[step.key]}
                </span>
              ) : null}
            </span>
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
  const blocked = delivery.outstandingUah > 0
  return (
    <Notice tone={blocked ? 'warn' : 'ok'}>
      <p className="font-semibold">
        {blocked ? 'ТТН буде з післяплатою' : 'ТТН можна створити'}
      </p>
      <p className="mt-1">
        {blocked
          ? `Нова пошта утримає з отримувача ${uah(delivery.outstandingUah)} — рівно залишок за замовленням — і перекаже їх вам. Комісію переказу платить отримувач.`
          : 'Замовлення оплачене, тож накладна піде без післяплати.'}
      </p>
    </Notice>
  )
}
