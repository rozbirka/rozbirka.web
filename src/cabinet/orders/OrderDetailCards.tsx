import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Circle, CreditCard, Plus } from 'lucide-react'
import {
  Button,
  StatusPill,
  TextArea,
  Thumbnail,
  type StatusTone,
} from '@/components/app'
import { commonMessages, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { customersApi, type CustomerDetail } from '@/api/customers'
import type { OrderDetail, OrderDetailItem } from '@/api/orders'
import { money, type OrderMoney } from './order-money'
import { orderCardMessages } from './order-cards-messages'
import { orderMessages } from './messages'
import { paymentMessages } from './payment-messages'
import type { OrderStep } from './order-steps'

/**
 * A card-head action: `.rz-btn--sm` (24px). The hit area is grown back to the
 * 44px the cabinet keeps on touch with a transparent overlay that costs the
 * layout nothing.
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
    <Button
      aria-label={label}
      className="relative after:absolute after:-inset-2 after:content-['']"
      disabled={disabled}
      onClick={onClick}
      size="sm"
      title={title}
    >
      {children}
    </Button>
  )
}

/** The frame every block of the order card shares: `.rz-card` with its head. */
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
    <section aria-labelledby={titleId} className={cn('rz-card', className)}>
      <div className="rz-card__head py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="rz-h-card" id={titleId}>
            {title}
          </h2>
          {count === undefined ? null : (
            <span className="rz-dim font-mono text-caption whitespace-nowrap">
              {count}
            </span>
          )}
        </div>
        {aside}
      </div>
      {padded ? <div className="rz-card__body">{children}</div> : children}
    </section>
  )
}

/**
 * The life of the order as a row of steps (`.rz-steps`). Only steps Core can
 * date are drawn, so the row is two steps for an open order and three for one
 * that ended in a refund — never a greyed-out stage the server cannot reach.
 */
export function OrderSteps({ steps }: { steps: readonly OrderStep[] }) {
  const t = useT(orderCardMessages)
  return (
    <ol aria-label={t('stepsLabel')} className="rz-steps">
      {steps.map((step, index) => (
        <li
          {...(step.state === 'current'
            ? { 'aria-current': 'step' as const }
            : {})}
          className="h-auto min-h-7 py-1"
          data-state={step.state === 'done' ? 'done' : undefined}
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

/**
 * The parts on the order as a `.rz-table`: part, quantity, price, line sum,
 * with the total in the card foot. Each line carries the thing itself — its
 * photo, what car it came off — so the list reads as stock.
 */
export function OrderItemsCard({
  addPath,
  currency,
  editable,
  items,
  note,
  onEdit,
  partsPath,
  total,
}: {
  /** Where a new line is added, when this order may still be changed. */
  addPath: string | null
  /** The accounting currency line prices are kept in; `null` if unknown. */
  currency: string | null
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
  const to = useT(orderMessages)
  return (
    <OrderCard
      aside={
        !editable || addPath === null ? null : (
          <div className="rz-btn-row gap-1.5">
            <SmallButton label={t('editItems')} onClick={onEdit}>
              {t('edit')}
            </SmallButton>
            <Button
              asChild
              className="relative after:absolute after:-inset-2 after:content-['']"
              size="sm"
            >
              <Link to={addPath}>
                <Plus aria-hidden />
                {t('addItem')}
              </Link>
            </Button>
          </div>
        )
      }
      count={t('itemCount', { count: items.length })}
      title={t('items')}
    >
      {items.length === 0 ? (
        <p className="rz-card__body text-app-muted m-0">{t('noItems')}</p>
      ) : (
        <>
          <div className="rz-table-scroll">
            <table className="rz-table">
              <caption>{t('orderItems')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('columnPart')}</th>
                  <th className="rz-num" scope="col">
                    {to('quantity')}
                  </th>
                  <th className="rz-num" scope="col">
                    {to('price')}
                  </th>
                  <th className="rz-num" scope="col">
                    {t('columnTotal')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr className="h-auto" key={item.id}>
                    <th className="py-2" scope="row">
                      <OrderItemLine item={item} partsPath={partsPath} />
                    </th>
                    <td className="rz-num" data-label={to('quantity')}>
                      {String(item.quantity)}
                    </td>
                    <td
                      className="rz-num whitespace-nowrap"
                      data-label={to('price')}
                    >
                      {money(item.unitPrice, currency)}
                    </td>
                    <td
                      className="rz-num whitespace-nowrap"
                      data-label={t('columnTotal')}
                    >
                      {money(item.totalPrice, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rz-card__foot flex-wrap items-baseline">
            <span className="rz-muted">{t('total')}</span>
            <span className="grid justify-items-end gap-0.5">
              <span className="rz-mono rz-strong">
                {money(total, currency)}
              </span>
              {note === undefined ? null : (
                <span className="rz-caption text-pretty">{note}</span>
              )}
            </span>
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
  const name = <span className="block truncate">{item.partName}</span>

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {item.coverPhotoUrl === null ? (
        <span
          aria-hidden
          className="rz-photo size-control-lg shrink-0 font-mono text-micro"
        >
          {t('photo')}
        </span>
      ) : (
        <Thumbnail
          alt=""
          className="size-control-lg shrink-0 rounded-control"
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
            className="text-app-strong block"
            to={`${partsPath}/${item.partId}`}
          >
            {name}
          </Link>
        )}
        {item.partType === null && origin === '' ? null : (
          <span className="rz-dim block truncate font-mono text-caption font-normal">
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
          <span className="rz-mono rz-muted">{paidLine}</span>
        )
      }
      count={String(payments.length)}
      title={t('payments')}
    >
      {payments.length === 0 ? (
        <p className="rz-card__body text-app-muted m-0 text-pretty">
          {t('noPayments')}
        </p>
      ) : (
        <ul aria-label={t('orderPayments')}>
          {payments.map((payment) => (
            <li
              className="border-app-line flex items-center gap-2.5 border-t px-(--rz-card-p) py-2.5 first:border-t-0"
              key={payment.id}
            >
              <span aria-hidden className="rz-timeline__icon">
                <CreditCard />
              </span>
              <span className="min-w-0">
                <span className="rz-strong block font-medium">
                  {t('payment')}
                </span>
                <span className="rz-caption block truncate">
                  {payment.accountName} · {payment.currency}
                </span>
              </span>
              <span className="rz-num rz-strong ml-auto whitespace-nowrap">
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
          <div className="rz-btn-row mt-2.5 justify-end">
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
        <p className="text-app-ink m-0 whitespace-pre-line">{notes}</p>
      ) : (
        <p className="rz-dim m-0">{t('noNotes')}</p>
      )}
    </OrderCard>
  )
}

const DUE_TONE: Record<OrderMoney['tone'], StatusTone> = {
  ok: 'ok',
  warn: 'warn',
  info: 'info',
  dim: 'neutral',
}

const STATUS_KEY = {
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  refunded: 'statusRefunded',
  cancelled: 'statusCancelled',
  other: null,
} as const

/**
 * What the order is worth and what was actually paid (ROZ-162 board 3b): the
 * value in the accounting currency and each currency's payments, side by
 * side. No remaining sum, no debt or overpayment, no progress bar — the two
 * are not comparable without a rate, and full payment is the operator's
 * acknowledgement when confirming.
 */
export function OrderDueCard({
  accountingCurrency,
  actions,
  hint,
  summary,
  tills,
}: {
  accountingCurrency: string | null
  actions: ReactNode
  hint: string | null
  summary: OrderMoney
  /** The tills the payments went to, in the order recorded. */
  tills: readonly string[]
}) {
  const t = useT(paymentMessages)
  const { locale } = useLocale()
  const statusKey = STATUS_KEY[summary.status]

  return (
    <section aria-label={t('orderValue')} className="rz-card">
      <div className="rz-card__head py-2">
        <h2 className="rz-h-card">{t('orderValue')}</h2>
        {statusKey === null ? null : (
          <StatusPill tone={DUE_TONE[summary.tone]}>{t(statusKey)}</StatusPill>
        )}
      </div>
      <div className="rz-card__body grid gap-1.5">
        <p className="rz-display m-0">
          {money(summary.value, accountingCurrency, locale)}
        </p>
        <p className="rz-caption m-0">
          {accountingCurrency === null ? t('valueUnknown') : t('inAccounting')}
        </p>
      </div>
      <dl className="rz-facts border-app-line border-t">
        <div>
          <dt>{t('actualPayments')}</dt>
          <dd className="grid gap-1">
            {summary.paid.length === 0 ? (
              <span className="rz-dim">{t('noPayments')}</span>
            ) : (
              summary.paid.map((sum) => (
                <span className="rz-mono rz-strong" key={sum.currency}>
                  {money(sum.amount, sum.currency, locale)}
                </span>
              ))
            )}
            {tills.length === 0 ? null : (
              <span className="rz-caption">
                {`${t('till')} ${tills.join(', ')}`}
              </span>
            )}
          </dd>
        </div>
      </dl>
      {actions === null && hint === null ? null : (
        <div className="rz-card__foot grid justify-stretch gap-2">
          {actions === null ? null : (
            <div className="grid gap-2">{actions}</div>
          )}
          {hint === null ? null : (
            <p className="rz-caption m-0 text-center text-pretty">{hint}</p>
          )}
        </div>
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
  accountingCurrency,
  customerId,
  customerName,
  initials,
  onChange,
  to,
}: {
  /** What the customer's spending is counted in; `null` if unknown. */
  accountingCurrency: string | null
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
    <section aria-label={t('customer')} className="rz-card">
      <div className="rz-card__head py-2">
        <h2 className="rz-h-card">{t('customer')}</h2>
        {onChange === undefined ? null : (
          <SmallButton
            label={customerId === null ? t('addCustomer') : t('changeCustomer')}
            onClick={onChange}
          >
            {customerId === null ? t('add') : t('change')}
          </SmallButton>
        )}
      </div>
      <div className="rz-card__body py-2.5">
        {customerId === null ? (
          <p className="text-app-muted m-0">{t('noCustomer')}</p>
        ) : (
          <Link
            className="-mx-2 flex min-w-0 items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-app-hover"
            to={to}
          >
            <span aria-hidden className="rz-avatar rz-avatar--round size-8">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="rz-strong block truncate font-semibold">
                {customer?.name ?? customerName ?? t('noName')}
              </span>
              <span className="rz-dim block font-mono text-caption">
                {customer?.phone ?? t('customerCard')}
              </span>
            </span>
          </Link>
        )}
      </div>
      {customer === null ? null : (
        <dl className="rz-facts border-app-line border-t">
          <div>
            <dt>{t('customerOrders')}</dt>
            <dd className="rz-mono">{customer.ordersCount ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('customerSpent')}</dt>
            <dd className="rz-mono">
              {money(customer.totalAmount, accountingCurrency)}
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
    <OrderCard padded={ordered.length === 0} title={t('history')}>
      {ordered.length === 0 ? (
        <p className="text-app-muted m-0">{t('historyEmpty')}</p>
      ) : (
        <>
          <OrderTimeline
            label={t('historyLabel')}
            rows={visible}
            title={title}
            when={when}
          />
          {ordered.length > 3 ? (
            <div className="rz-card__foot">
              <Button
                className="justify-center"
                onClick={() => setExpanded((value) => !value)}
                size="wide"
                variant="quiet"
              >
                {expanded
                  ? t('historyCollapse')
                  : t('historyExpand', { count: ordered.length })}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </OrderCard>
  )
}

/**
 * Order events as `.rz-timeline`: what happened, who did it, and when — the
 * machine value stays in `dateTime`.
 */
export function OrderTimeline({
  label,
  rows,
  title,
  when,
}: {
  label: string
  rows: readonly (OrderDetail['history'][number] & { key?: string })[]
  title: (eventType: string) => string
  when: (timestamp: string) => string
}) {
  return (
    <ol aria-label={label} className="rz-timeline">
      {rows.map((entry, index) => (
        <li
          key={
            entry.key ??
            `${entry.createdAt}-${entry.eventType}-${String(index)}`
          }
        >
          <span aria-hidden className="rz-timeline__icon">
            <Circle />
          </span>
          <span className="min-w-0">
            <span className="rz-strong block font-medium">
              {title(entry.eventType)}
            </span>
            <span className="rz-dim block">{entry.userName}</span>
          </span>
          <time className="rz-timeline__date" dateTime={entry.createdAt}>
            {when(entry.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  )
}
