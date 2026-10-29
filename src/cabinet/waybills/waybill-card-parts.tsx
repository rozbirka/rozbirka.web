import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  ArrowUpRight,
  Ban,
  Circle,
  FilePlus,
  PackageCheck,
  Truck,
  Unplug,
} from 'lucide-react'
import { Button, StatusPill } from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import type { Shipment, ShipmentEvent } from '@/api/shipping'
import { useFormat, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { uah } from '../orders/delivery/delivery-money'
import { waybillMessages } from '../orders/delivery/waybill-messages'
import {
  contactLine,
  dimensionsLine,
  parcelLine,
} from '../orders/delivery/waybill-view'
import {
  cardPaymentSignal,
  fullPlace,
  shortPlace,
  type Signal,
} from './waybill-presentation'
import { waybillsMessages } from './waybills-messages'

interface Fact {
  key: string
  label: string
  value: ReactNode
  sub?: string
  mono?: boolean
  tone?: 'warn'
}

function Facts({ rows }: { rows: readonly Fact[] }) {
  return (
    <dl className="rz-facts">
      {rows.map((fact) => (
        <div key={fact.key}>
          <dt>{fact.label}</dt>
          <dd className="m-0">
            <span
              className={cn(
                fact.mono === true && 'rz-mono',
                fact.tone === 'warn' && 'text-state-warn',
              )}
            >
              {fact.value}
            </span>
            {fact.sub === undefined || fact.sub === '' ? null : (
              <span className="rz-caption ml-2">{fact.sub}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** `.rz-card` whose status pill sits right after the title, as 8.x draws it. */
function TitledCard({
  title,
  pill: status,
  hint,
  padded = false,
  children,
}: {
  title: string
  pill?: ReactNode
  /** A muted line under the title. */
  hint?: string
  padded?: boolean
  children: ReactNode
}) {
  const titleId = useId()
  const heading = (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="rz-h-card" id={titleId}>
        {title}
      </h2>
      {status}
    </div>
  )
  return (
    <section aria-labelledby={titleId} className="rz-card">
      {hint === undefined ? (
        <div className="rz-card__head justify-start gap-2 py-2">
          <h2 className="rz-h-card" id={titleId}>
            {title}
          </h2>
          {status}
        </div>
      ) : (
        <div className="rz-card__head justify-start py-2">
          <div className="grid min-w-0 gap-0.5">
            {heading}
            <p className="rz-caption m-0 text-pretty">{hint}</p>
          </div>
        </div>
      )}
      {padded ? <div className="rz-card__body">{children}</div> : children}
    </section>
  )
}

const pill = (signal: Signal | null) =>
  signal === null ? (
    <StatusPill tone="neutral">—</StatusPill>
  ) : (
    <StatusPill tone={signal.tone}>{signal.label}</StatusPill>
  )

/** The registered sender a counter clerk reads: the company, else the person. */
const senderName = (shipment: Shipment): string => {
  const company = shipment.sender.companyName ?? ''
  if (company !== '') return company
  return shipment.sender.name === '' ? '—' : shipment.sender.name
}

/** «Накладна»: whose order, from where, to whom, what is in it. */
export function WaybillInfoCard({
  orderNumber,
  orderPath,
  shipment,
}: {
  orderNumber: number | null
  orderPath: string
  shipment: Shipment
}) {
  const t = useT(waybillsMessages)
  const tw = useT(waybillMessages)
  const { locale } = useLocale()
  const parcels = shipment.draft.parcels
  const dims = dimensionsLine(parcels)
  const parcel = parcelLine(parcels, locale)
  return (
    <TitledCard title={t('cardWaybill')}>
      <Facts
        rows={[
          {
            key: 'order',
            label: t('factOrder'),
            value: (
              <Link className="rz-mono" to={orderPath}>
                #{orderNumber ?? '—'}
              </Link>
            ),
          },
          {
            key: 'sender',
            label: tw('factSender'),
            value: senderName(shipment),
            sub: shortPlace(shipment.sender),
          },
          {
            key: 'recipient',
            label: t('factRecipient'),
            value: contactLine(shipment.draft.recipient) || '—',
          },
          {
            key: 'to',
            label: tw('factDestination'),
            value: fullPlace(shipment.draft.recipient),
          },
          {
            key: 'parcel',
            label: t('factParcel'),
            value:
              dims === '' || parcel === '—'
                ? parcel
                : tw('parcelWithDims', { parcel, dims }),
            mono: true,
          },
        ]}
      />
    </TitledCard>
  )
}

/**
 * «Доставка»: the carrier's last word and when it came. On a narrow screen
 * the waybill's actions sit here, under the status (8.9).
 */
export function WaybillDeliveryCard({
  actions,
  hint,
  notice,
  shipment,
  signal,
  stale,
}: {
  actions?: ReactNode
  /** «Останній відомий статус · …» once nothing refreshes it (2.18). */
  hint?: string
  notice?: ReactNode
  shipment: Shipment
  signal: Signal | null
  /** The status is not being refreshed: the time reads as a warning. */
  stale: boolean
}) {
  const t = useT(waybillsMessages)
  const format = useFormat()
  const draft = shipment.state === 'Draft'
  return (
    <TitledCard
      pill={pill(signal)}
      title={t('cardDelivery')}
      {...(hint === undefined ? {} : { hint })}
    >
      <Facts
        rows={[
          {
            key: 'status',
            label: t('factNpStatus'),
            value: draft
              ? t('notHandedOver')
              : (shipment.trackingStatus ?? t('noStatusYet')),
          },
          {
            key: 'updated',
            label: t('factUpdated'),
            value:
              shipment.lastTrackedAt === null
                ? '—'
                : (format.dateTime(shipment.lastTrackedAt) ??
                  shipment.lastTrackedAt),
            mono: true,
            ...(stale ? { tone: 'warn' as const } : {}),
          },
        ]}
      />
      {notice === undefined && actions === undefined ? null : (
        <div className="border-app-line grid gap-2.5 border-t px-(--rz-card-p) py-2.5">
          {notice}
          {actions}
        </div>
      )}
    </TitledCard>
  )
}

/**
 * «Оплата»: shown, never changed here — payments and refunds live in the
 * order. Without the finance right Core sends no amounts, and the card says
 * so rather than showing zeros.
 */
export function WaybillPaymentCard({
  delivery,
  finance,
  orderNumber,
  orderPath,
  shipment,
}: {
  delivery: DeliveryOrder | null
  finance: boolean
  orderNumber: number | null
  orderPath: string
  shipment: Shipment
}) {
  const t = useT(waybillsMessages)
  const { locale } = useLocale()
  const cancelled = shipment.state === 'Cancelled'
  const registered =
    delivery === null
      ? null
      : delivery.payments
          .filter(
            (payment) => payment.kind === 'cod' && payment.refundedAt === null,
          )
          .reduce((sum, payment) => sum + payment.amountUah, 0)
  const signal = finance
    ? cardPaymentSignal(shipment, delivery?.outstandingUah ?? null, locale)
    : null
  return (
    <TitledCard
      pill={signal === null ? undefined : pill(signal)}
      title={t('cardPayment')}
    >
      <Facts
        rows={[
          {
            key: 'cod',
            label: t('factCod'),
            value:
              !finance || cancelled || shipment.codUah === null
                ? '—'
                : uah(shipment.codUah, locale),
            mono: true,
          },
          {
            key: 'registered',
            label: t('factRegistered'),
            value:
              !finance || registered === null ? '—' : uah(registered, locale),
            mono: true,
          },
        ]}
      />
      <div className="border-app-line grid gap-2.5 border-t px-(--rz-card-p) py-2.5">
        {finance ? null : (
          <p className="rz-caption m-0 text-pretty">{t('payNoRight')}</p>
        )}
        <p className="rz-caption m-0 text-pretty">{t('payCaption')}</p>
        <div className="rz-btn-row">
          <Button asChild variant="quiet">
            <Link to={orderPath}>
              <ArrowUpRight aria-hidden />
              {t('openOrder', { number: String(orderNumber ?? '—') })}
            </Link>
          </Button>
        </div>
      </div>
    </TitledCard>
  )
}

const eventIcon = (event: ShipmentEvent) =>
  event.code === 'Created' ? (
    <FilePlus />
  ) : ['9', '10', '11', '106'].includes(event.code) ? (
    <PackageCheck />
  ) : event.code === '2' || event.code === 'Cancelled' ? (
    <Ban />
  ) : /^\d+$/.test(event.code) ? (
    <Truck />
  ) : (
    <Circle />
  )

interface HistoryRow {
  key: string
  at: string
  icon: ReactNode
  title: string
  detail: string | null
}

/**
 * «Історія»: what Nova Poshta reported, newest first. A switched-off
 * integration adds its own line among them (2.18), since from then on the
 * carrier's word stops arriving.
 */
export function WaybillHistoryCard({
  events,
  switchedOff = null,
}: {
  events: ShipmentEvent[]
  switchedOff?: { at: string; by: string | null } | null
}) {
  const t = useT(waybillsMessages)
  const format = useFormat()
  const rows: HistoryRow[] = events.map((event, index) => {
    const at = event.occurredAt ?? event.recordedAt
    return {
      key: `${at}-${event.code}-${String(index)}`,
      at,
      icon: eventIcon(event),
      title: event.name || event.code,
      detail: null,
    }
  })
  if (switchedOff !== null)
    rows.push({
      key: 'switched-off',
      at: switchedOff.at,
      icon: <Unplug />,
      title: t('historySwitchedOff'),
      detail:
        switchedOff.by === null
          ? null
          : t('historySwitchedOffDetail', { actor: switchedOff.by }),
    })
  const ordered = rows.sort((left, right) => right.at.localeCompare(left.at))
  return (
    <TitledCard padded={ordered.length === 0} title={t('cardHistory')}>
      {ordered.length === 0 ? (
        <p className="text-app-muted m-0">{t('historyEmpty')}</p>
      ) : (
        <ol aria-label={t('historyLabel')} className="rz-timeline">
          {ordered.map(({ at, detail, icon, key, title }) => (
            <li key={key}>
              <span aria-hidden className="rz-timeline__icon">
                {icon}
              </span>
              <span className="min-w-0">
                <span className="rz-strong block font-medium">{title}</span>
                {detail === null ? null : (
                  <span className="rz-caption block">{detail}</span>
                )}
              </span>
              <time className="rz-timeline__date" dateTime={at}>
                {format.dateTime(at) ?? at}
              </time>
            </li>
          ))}
        </ol>
      )}
    </TitledCard>
  )
}
