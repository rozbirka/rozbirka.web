import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CreditCard, Plus } from 'lucide-react'
import { Button, TextArea, Thumbnail } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { customersApi, type CustomerDetail } from '@/api/customers'
import type { OrderDetail, OrderDetailItem } from '@/api/orders'
import { money, type OrderMoney } from './order-money'
import { orderCardMessages } from './order-cards-messages'
import type { OrderStep } from './order-steps'

/**
 * The 28-34px controls this card is drawn with. The visual box is the design's;
 * the hit area is grown back to the 44px the cabinet keeps everywhere with a
 * transparent overlay that costs the layout nothing.
 */
function SmallButton({
  children,
  disabled = false,
  label,
  onClick,
  title,
}: {
  children: ReactNode
  disabled?: boolean
  /** Says which block this control belongs to when two share a word. */
  label?: string
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      aria-label={label}
      className="border-app-line-2 text-app-muted hover:text-app-ink relative inline-flex h-7 items-center rounded-[8px] border px-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-55 after:absolute after:-inset-2 after:content-['']"
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

/** The frame every block of the order card shares. */
export function OrderCard({
  title,
  count,
  aside,
  children,
  className,
  padded = false,
}: {
  title: string
  /** Sits next to the title in mono: how many rows the card holds. */
  count?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  /** Cards whose body is prose rather than rows carry their own padding. */
  padded?: boolean
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'border-app-line bg-app-raised overflow-hidden rounded-[20px] border',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-6 pt-[18px]',
          padded ? 'pb-0' : 'pb-[18px]',
        )}
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <h2
            className="text-[17px] font-bold tracking-[-0.01em] text-white"
            id={titleId}
          >
            {title}
          </h2>
          {count === undefined ? null : (
            <span className="text-app-muted font-mono text-[12px] whitespace-nowrap">
              {count}
            </span>
          )}
        </div>
        {aside}
      </div>
      {padded ? <div className="px-6 pt-2.5 pb-5">{children}</div> : children}
    </section>
  )
}

/**
 * The life of the order as a row of steps. Only steps Core can date are drawn,
 * so the row is two columns for an open order and three for one that ended in
 * a refund — never a greyed-out stage the server cannot reach.
 */
export function OrderSteps({ steps }: { steps: readonly OrderStep[] }) {
  const t = useT(orderCardMessages)
  return (
    <ol
      aria-label={t('stepsLabel')}
      className="grid gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${String(steps.length)}, minmax(0, 1fr))`,
      }}
    >
      {steps.map((step) => (
        <li className="min-w-0" key={step.key}>
          <span
            aria-hidden
            className={cn(
              'block h-1 rounded-full',
              step.state === 'current'
                ? 'bg-brand'
                : step.state === 'done'
                  ? 'bg-white/35'
                  : 'bg-white/[0.08]',
            )}
          />
          <span className="mt-2.5 flex flex-col gap-[3px]">
            <span
              className={cn(
                'truncate text-[14px] font-bold',
                step.state === 'upcoming' ? 'text-app-dim' : 'text-white',
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

/**
 * The parts on the order. Each line carries the thing itself — its photo, what
 * car it came off — so the list reads as stock rather than as a set of rows.
 */
export function OrderItemsCard({
  addPath,
  currency = 'USD',
  editable,
  items,
  note,
  onEdit,
  partsPath,
  total,
}: {
  /** Where a new line is added, when this order may still be changed. */
  addPath: string | null
  /** What the line prices are kept in. Core prices an order's items in USD. */
  currency?: string
  editable: boolean
  items: readonly OrderDetailItem[]
  /** One line under the total, when the total needs explaining. */
  note?: string
  onEdit: () => void
  /** The parts module, when this account may open a part's own card. */
  partsPath: string | null
  total: number | null
}) {
  const t = useT(orderCardMessages)
  return (
    <OrderCard
      aside={
        !editable || addPath === null ? null : (
          <div className="flex flex-wrap items-center gap-2.5">
            <SmallButton label={t('editItems')} onClick={onEdit}>
              {t('edit')}
            </SmallButton>
            <Link
              className="border-app-line-2 text-app-ink relative inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors hover:bg-white/[0.06] after:absolute after:-inset-1.5 after:content-['']"
              to={addPath}
            >
              <Plus aria-hidden className="text-brand size-4" />
              {t('addItem')}
            </Link>
          </div>
        )
      }
      count={t('itemCount', { count: items.length })}
      title={t('items')}
    >
      {items.length === 0 ? (
        <p className="border-app-line text-app-muted border-t px-6 py-5 text-[14px]">
          {t('noItems')}
        </p>
      ) : (
        <>
          <div className="border-app-line text-app-muted grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-y px-6 py-2.5 font-mono text-[10px] tracking-[0.14em] uppercase">
            <span>{t('columnPart')}</span>
            <span className="text-right">{t('columnTotal')}</span>
          </div>
          <ul aria-label={t('orderItems')}>
            {items.map((item) => (
              <li
                className="border-app-line grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b px-6 py-3.5 transition-colors last:border-b-0 hover:bg-white/[0.02]"
                key={item.id}
              >
                <OrderItemLine item={item} partsPath={partsPath} />
                <span className="text-right">
                  <span className="block text-[15px] font-bold whitespace-nowrap text-white">
                    {money(item.totalPrice, currency)}
                  </span>
                  <span className="text-app-muted mt-1 block font-mono text-[12px] whitespace-nowrap">
                    {String(item.quantity)} × {money(item.unitPrice, currency)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-end gap-2 px-6 pt-4 pb-[18px]">
            <span className="flex items-baseline gap-5">
              <span className="text-app-muted text-[14px] font-semibold">
                {t('total')}
              </span>
              <span className="min-w-[104px] text-right text-[22px] font-extrabold tracking-[-0.02em] text-white tabular-nums">
                {money(total, currency)}
              </span>
            </span>
            {note === undefined ? null : (
              <span className="text-app-dim text-[12px] text-pretty">
                {note}
              </span>
            )}
          </div>
        </>
      )}
    </OrderCard>
  )
}

function OrderItemLine({
  item,
  partsPath,
}: {
  item: OrderDetailItem
  partsPath: string | null
}) {
  const t = useT(orderCardMessages)
  const origin = [
    [item.carBrand, item.carModel].filter(Boolean).join(' '),
    item.carCode,
  ]
    .filter((part) => part !== null && part !== '')
    .join(' · ')
  const name = (
    <span className="block text-[15px] leading-[1.35] font-bold tracking-[-0.01em] text-pretty text-white">
      {item.partName}
    </span>
  )

  return (
    <span className="flex min-w-0 items-center gap-3.5">
      {item.coverPhotoUrl === null ? (
        <span
          aria-hidden
          className="border-app-line bg-app-input text-app-dim grid size-12 shrink-0 place-items-center rounded-[10px] border font-mono text-[9px]"
        >
          {t('photo')}
        </span>
      ) : (
        <Thumbnail
          alt=""
          className="size-12 shrink-0 rounded-[10px]"
          photo={{
            url: item.coverPhotoUrl,
            thumbnailUrl: item.coverPhotoUrl,
          }}
        />
      )}
      <span className="min-w-0">
        {partsPath === null ? (
          name
        ) : (
          <Link
            className="hover:text-brand block"
            to={`${partsPath}/${item.partId}`}
          >
            {name}
          </Link>
        )}
        {item.partType === null && origin === '' ? null : (
          <span className="text-app-muted mt-1 block font-mono text-[12px] leading-[1.5]">
            {[item.partType, origin].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </span>
  )
}

/** Money already taken against the order, one line per receipt. */
export function OrderPaymentsCard({
  paidLine,
  payments,
}: {
  paidLine: string | null
  payments: OrderDetail['payments']
}) {
  const t = useT(orderCardMessages)
  return (
    <OrderCard
      aside={
        paidLine === null ? null : (
          <span className="text-app-muted font-mono text-[13px]">
            {paidLine}
          </span>
        )
      }
      count={String(payments.length)}
      title={t('payments')}
    >
      {payments.length === 0 ? (
        <p className="border-app-line text-app-muted border-t px-6 pt-4 pb-[18px] text-[14px] text-pretty">
          {t('noPayments')}
        </p>
      ) : (
        <ul aria-label={t('orderPayments')}>
          {payments.map((payment) => (
            <li
              className="border-app-line flex items-center gap-3.5 border-t px-6 py-3.5"
              key={payment.id}
            >
              <span className="bg-state-ok-soft text-state-ok grid size-[34px] shrink-0 place-items-center rounded-[10px]">
                <CreditCard aria-hidden className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-white">
                  {t('payment')}
                </span>
                <span className="text-app-muted mt-0.5 block truncate text-[13px]">
                  {payment.accountName} · {payment.currency}
                </span>
              </span>
              <span className="ml-auto font-mono text-[15px] font-medium whitespace-nowrap text-white tabular-nums">
                {money(payment.amount, payment.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </OrderCard>
  )
}

/** The note on the order, edited where it is read. */
export function OrderNotesCard({
  busy,
  editable,
  notes,
  onSave,
}: {
  busy: boolean
  editable: boolean
  notes: string | null
  onSave: (value: string) => void
}) {
  const t = useT(orderCardMessages)
  const tc = useT(commonMessages)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes ?? '')
  const hasNote = notes !== null && notes !== ''

  return (
    <OrderCard
      aside={
        editable && !editing ? (
          <SmallButton
            label={hasNote ? t('editNotes') : t('addNotes')}
            onClick={() => {
              setDraft(notes ?? '')
              setEditing(true)
            }}
          >
            {hasNote ? t('edit') : t('add')}
          </SmallButton>
        ) : null
      }
      padded
      title={t('notes')}
    >
      {editing ? (
        <>
          <TextArea
            aria-label={t('orderNotes')}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('notesPlaceholder')}
            rows={3}
            value={draft}
          />
          <div className="mt-2.5 flex flex-wrap justify-end gap-2">
            <Button
              aria-label={t('cancelNotes')}
              onClick={() => setEditing(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              aria-label={t('saveNotes')}
              disabled={busy}
              onClick={() => {
                onSave(draft)
                setEditing(false)
              }}
              variant="primary"
            >
              {tc('save')}
            </Button>
          </div>
        </>
      ) : hasNote ? (
        <p className="text-app-ink text-[15px] leading-[1.55] whitespace-pre-line">
          {notes}
        </p>
      ) : (
        <p className="text-app-dim text-[14px]">{t('noNotes')}</p>
      )}
    </OrderCard>
  )
}

const DUE_TONE: Record<OrderMoney['tone'], string> = {
  ok: 'text-state-ok',
  warn: 'text-state-warn',
  info: 'text-state-info',
  dim: 'text-app-dim',
}

/** What is still owed, and the one or two moves that can be made about it. */
export function OrderDueCard({
  actions,
  hint,
  summary,
}: {
  actions: ReactNode
  hint: string | null
  summary: OrderMoney
}) {
  const t = useT(orderCardMessages)
  const headline = summary.remaining ?? summary.totalUsd

  return (
    <section
      aria-label={t('due')}
      className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-[22px] pb-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
          {t('due')}
        </h2>
        <p className={cn('text-[13px] font-bold', DUE_TONE[summary.tone])}>
          {summary.label}
        </p>
      </div>
      <p className="mt-3 text-[38px] leading-none font-extrabold tracking-[-0.03em] text-white tabular-nums">
        {money(headline, 'USD')}
      </p>
      <span aria-hidden className="mt-4.5 flex gap-0.5">
        <span
          className="bg-state-ok h-[5px] rounded-l-full"
          style={{ flex: summary.paidPercent }}
        />
        <span
          className="h-[5px] rounded-r-full bg-white/[0.08]"
          style={{ flex: 100 - summary.paidPercent }}
        />
      </span>
      <dl className="mt-4 grid grid-cols-[1fr_auto] items-baseline gap-y-2.5">
        <dt className="text-app-muted text-[14px]">{t('orderTotal')}</dt>
        <dd className="font-mono text-[14px] text-white tabular-nums">
          {money(summary.totalUsd, 'USD')}
        </dd>
        <dt className="text-app-muted text-[14px]">{t('paid')}</dt>
        <dd
          className={cn(
            'font-mono text-[14px] tabular-nums',
            summary.paid !== null && summary.paid > 0
              ? 'text-state-ok'
              : 'text-app-muted',
          )}
        >
          {summary.paid === null
            ? '—'
            : money(summary.paid, summary.paidCurrency ?? 'USD')}
        </dd>
      </dl>
      <div className="mt-5 grid gap-2">{actions}</div>
      {hint === null ? null : (
        <p className="text-app-dim mt-3 text-center text-[12px] leading-[1.5] text-pretty">
          {hint}
        </p>
      )}
    </section>
  )
}

/**
 * Who the order is for. The name comes with the order; the phone and what the
 * customer has spent are read from the customer's own record, and the card
 * stays a name until they arrive.
 */
export function OrderCustomerCard({
  customerId,
  customerName,
  initials,
  onChange,
  to,
}: {
  customerId: string | null
  customerName: string | null
  initials: string
  /** Opens the picker; absent when the order can no longer be changed. */
  onChange?: (() => void) | undefined
  to: string
}) {
  const t = useT(orderCardMessages)
  const [loadedCustomer, setLoadedCustomer] = useState<{
    id: string
    detail: CustomerDetail
  } | null>(null)
  const customer =
    loadedCustomer?.id === customerId ? loadedCustomer.detail : null

  useEffect(() => {
    if (customerId === null) return
    const controller = new AbortController()
    void customersApi.getById(customerId, { signal: controller.signal }).then(
      (detail) => {
        if (!controller.signal.aborted) {
          setLoadedCustomer({ id: customerId, detail })
        }
      },
      () => {
        // The name on the order still stands; the extra facts are a bonus.
      },
    )
    return () => controller.abort()
  }, [customerId])

  return (
    <section
      aria-label={t('customer')}
      className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
    >
      <div className="flex items-center gap-3 px-[22px] py-[18px]">
        {customerId === null ? (
          <p className="text-app-muted min-w-0 flex-1 text-[15px]">
            {t('noCustomer')}
          </p>
        ) : (
          <Link
            className="-m-2 flex min-w-0 flex-1 items-center gap-3.5 rounded-[12px] p-2 transition-colors hover:bg-white/[0.03]"
            to={to}
          >
            <span className="bg-brand/15 text-brand grid size-[42px] shrink-0 place-items-center rounded-full text-[14px] font-bold">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-bold tracking-[-0.015em] text-white">
                {customer?.name ?? customerName ?? t('noName')}
              </span>
              <span className="text-app-muted mt-[3px] block font-mono text-[12px]">
                {customer?.phone ?? t('customerCard')}
              </span>
            </span>
          </Link>
        )}
        {onChange === undefined ? null : (
          <SmallButton
            label={customerId === null ? t('addCustomer') : t('changeCustomer')}
            onClick={onChange}
          >
            {customerId === null ? t('add') : t('change')}
          </SmallButton>
        )}
      </div>
      {customer === null ? null : (
        <dl className="border-app-line grid grid-cols-2 border-t">
          <div className="border-app-line border-r px-[22px] py-3">
            <dt className="text-app-muted text-[12px]">
              {t('customerOrders')}
            </dt>
            <dd className="mt-[3px] font-mono text-[14px] text-white tabular-nums">
              {customer.ordersCount ?? '—'}
            </dd>
          </div>
          <div className="px-[22px] py-3">
            <dt className="text-app-muted text-[12px]">{t('customerSpent')}</dt>
            <dd className="mt-[3px] font-mono text-[14px] text-white tabular-nums">
              {money(customer.totalAmount, 'USD')}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}

/**
 * What happened to the order, newest first. Core writes one row per change,
 * so the list grows long on a busy order and stays folded until asked.
 */
export function OrderHistoryCard({
  rows,
  title = (eventType: string) => eventType,
  when,
}: {
  rows: readonly OrderDetail['history'][number][]
  /** The event name in words; unknown codes fall through as themselves. */
  title?: (eventType: string) => string
  when: (timestamp: string) => string
}) {
  const t = useT(orderCardMessages)
  const [expanded, setExpanded] = useState(false)
  const ordered = [...rows].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
  const visible = expanded ? ordered : ordered.slice(0, 3)

  return (
    <OrderCard padded title={t('history')}>
      {ordered.length === 0 ? (
        <p className="text-app-muted text-[14px]">{t('historyEmpty')}</p>
      ) : (
        <>
          <ol aria-label={t('historyLabel')} className="grid">
            {visible.map((entry, index) => (
              <li
                className="flex gap-3.5"
                key={`${entry.createdAt}-${entry.eventType}-${String(index)}`}
              >
                <span aria-hidden className="flex flex-col items-center">
                  <span className="bg-app-muted mt-1.5 size-2.5 rounded-full" />
                  {index < visible.length - 1 ? (
                    <span className="bg-app-line w-px flex-1" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 pb-4">
                  <span className="block text-[14px] font-bold text-white">
                    {title(entry.eventType)}
                  </span>
                  <span className="text-app-muted mt-1 block text-[12px]">
                    {entry.userName} ·{' '}
                    <time dateTime={entry.createdAt}>
                      {when(entry.createdAt)}
                    </time>
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {ordered.length > 3 ? (
            <button
              className="border-app-line-2 text-app-muted hover:border-brand/60 hover:text-brand w-full rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-colors"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded
                ? t('historyCollapse')
                : t('historyExpand', { count: ordered.length })}
            </button>
          ) : null}
        </>
      )}
    </OrderCard>
  )
}
