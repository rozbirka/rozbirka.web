import { useEffect, useState } from 'react'
import { Check, Dot, X } from 'lucide-react'
import {
  Button,
  Field,
  Notice,
  Sheet,
  SkeletonRows,
  TextInput,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { shippingApi, type Shipment } from '@/api/shipping'
import type { DeliveryOrder } from '@/api/delivery'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import { uah } from './delivery-money'
import {
  readiness,
  readinessBlocks,
  readinessNextStep,
  type ReadinessCheck,
} from './delivery-view'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'

/** `Замовлення #12 · накладна`, in the drawer's own words. */
function useEyebrow() {
  const t = useT(deliveryDrawerMessages)
  return (orderNumber: number, part: string) =>
    t('eyebrowOrder', { number: String(orderNumber), part })
}

/** One line of a checklist: what was checked, what was found, and whether it passed. */
function CheckRow({ check }: { check: ReadinessCheck }) {
  return (
    <li className="border-app-line flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t px-3 py-2 first:border-t-0">
      <span
        aria-hidden
        className={cn(
          'rz-timeline__icon shrink-0',
          check.deferred === true || check.pending === true
            ? 'text-app-dim'
            : check.ok
              ? 'bg-state-ok-soft text-state-ok'
              : 'bg-state-danger-soft text-state-danger',
        )}
      >
        {check.deferred === true ? null : check.ok ? (
          <Check />
        ) : check.pending === true ? (
          <Dot />
        ) : (
          <X />
        )}
      </span>
      <span className="rz-strong min-w-0 flex-1 font-medium text-pretty">
        {check.label}
      </span>
      <span
        className={cn(
          'ml-auto font-mono text-caption tabular-nums',
          check.deferred === true || check.pending === true
            ? 'text-app-muted'
            : check.ok
              ? 'text-state-ok'
              : 'text-state-danger',
        )}
      >
        {check.state}
      </span>
    </li>
  )
}

/**
 * Everything the cabinet can check before asking Nova Poshta for a waybill.
 *
 * Core refuses a Ukrainian waybill while the order owes anything, and the
 * carrier refuses one whose route or parcel it does not like — the first is
 * knowable here, the second is not, and the list says which is which rather
 * than promising a pass.
 */
export function WaybillReadinessDrawer({
  busy,
  delivery,
  dispatchPointActive,
  onClose,
  onContinue,
  orderNumber,
  shipment,
}: {
  busy: boolean
  delivery: DeliveryOrder
  dispatchPointActive: boolean
  onClose: () => void
  onContinue: () => void
  orderNumber: number
  shipment: Shipment | null
}) {
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const eyebrow = useEyebrow()
  const checks = readiness(delivery, shipment, dispatchPointActive, locale)
  // The quote and the deposit are done on the next screen, so they cannot be
  // what keeps the order off it.
  const blocking = readinessBlocks(checks)
  const passed = blocking.length === 0
  const next = readinessNextStep(checks, locale)

  return (
    <Sheet
      eyebrow={eyebrow(orderNumber, t('partCheck'))}
      footer={
        <>
          <p
            className={cn(
              'm-0 min-w-0 flex-1',
              passed ? 'text-app-muted' : 'text-state-warn',
            )}
          >
            {passed
              ? t('readinessContinue')
              : t('readinessBlocked', { count: blocking.length })}
          </p>
          <Button disabled={busy} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            disabled={busy || !passed}
            onClick={onContinue}
            title={passed ? undefined : t('readinessFixElsewhere')}
            variant="primary"
          >
            {t('continueBooking')}
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title={t('readinessTitle')}
    >
      <Notice block tone={passed ? 'ok' : 'warn'}>
        <p className="rz-strong m-0 font-semibold">{next.title}</p>
        <p className="m-0 mt-1">{next.note}</p>
      </Notice>

      <section className="grid gap-2">
        <h3 className="rz-h-card">{t('readinessChecks')}</h3>
        <ul className="m-0 grid list-none overflow-hidden rounded-panel border border-app-line bg-app-raised p-0">
          {checks.map((check) => (
            <CheckRow check={check} key={check.key} />
          ))}
        </ul>
        <p className="rz-caption m-0 text-pretty">{t('readinessLastRow')}</p>
      </section>
    </Sheet>
  )
}

/** The waybill as Core stored it, read-only, with the money beside it. */
export function WaybillDataDrawer({
  delivery,
  onClose,
  orderNumber,
  shipment,
}: {
  delivery: DeliveryOrder
  onClose: () => void
  orderNumber: number
  shipment: Shipment
}) {
  const t = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const format = useFormat()
  const { locale } = useLocale()
  const eyebrow = useEyebrow()
  const when = (value: string | null) =>
    value === null ? '—' : (format.dateTime(value) ?? value)
  const codMatches =
    shipment.codUah != null && shipment.codUah === delivery.outstandingUah
  const parcels = shipment.draft.parcels
  const weight = parcels.reduce((sum, parcel) => sum + parcel.weightKg, 0)

  const rows: { label: string; value: string; tone?: 'ok' | 'danger' }[] = [
    { label: t('rowNumber'), value: shipment.number ?? '—' },
    {
      label: t('rowCreated'),
      value: when(
        shipment.events.find((event) => event.code === 'Created')?.recordedAt ??
          null,
      ),
    },
    {
      label: t('rowSenderBranch'),
      value: shipment.sender.warehouseName ?? '—',
    },
    {
      label: t('rowRecipient'),
      value: `${shipment.draft.recipient.name} · ${shipment.draft.recipient.warehouseName ?? t('rowBranchChosen')}`,
    },
    {
      label: t('rowCod'),
      value: shipment.codUah == null ? '—' : uah(shipment.codUah, locale),
      ...(codMatches ? { tone: 'ok' as const } : { tone: 'danger' as const }),
    },
    {
      label: t('rowBalance'),
      value: uah(delivery.outstandingUah, locale),
      ...(codMatches ? { tone: 'ok' as const } : { tone: 'danger' as const }),
    },
    {
      label: t('rowDeclared'),
      value: uah(shipment.draft.declaredValueUah, locale),
    },
    {
      label: t('rowParcel'),
      value: t('rowParcelValue', { count: parcels.length, weight }),
    },
    {
      label: t('rowCarrierStatus'),
      value: shipment.trackingStatus ?? t('rowNoStatus'),
    },
  ]

  return (
    <Sheet
      eyebrow={eyebrow(orderNumber, t('partWaybill'))}
      footer={
        <Button onClick={onClose} variant="primary">
          {tc('close')}
        </Button>
      }
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      open
      title={t('waybillTitle')}
    >
      {codMatches ? null : <Notice tone="danger">{t('codMismatch')}</Notice>}
      <dl className="rz-facts rz-card px-(--rz-card-p)">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd
              className={cn(
                'font-mono',
                row.tone === 'ok'
                  ? 'text-state-ok'
                  : row.tone === 'danger'
                    ? 'text-state-danger'
                    : 'text-app-strong',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {shipment.events.length === 0 ? null : (
        <ol aria-label={t('shipmentStatuses')} className="rz-timeline rz-card">
          {shipment.events.map((event) => (
            <li key={`${event.recordedAt}-${event.code}`}>
              <span aria-hidden className="rz-timeline__icon">
                <Dot />
              </span>
              <span className="text-app-ink min-w-0 text-pretty">
                {event.name}
              </span>
              <span className="rz-timeline__date">
                {when(event.occurredAt ?? event.recordedAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  )
}

/**
 * Taking over a waybill made in the carrier's own cabinet. The post-payment on
 * it has to equal what the order owes — Core checks that and refuses anything
 * else, so the drawer says the figure before the attempt rather than after.
 */
export function WaybillAttachDrawer({
  delivery,
  integrationId,
  onAttached,
  onClose,
  orderId,
  orderNumber,
}: {
  delivery: DeliveryOrder
  integrationId: string
  onAttached: (shipment: Shipment) => void
  onClose: () => void
  orderId: string
  orderNumber: number
}) {
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const eyebrow = useEyebrow()
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const digits = number.replace(/\D/g, '')
  const valid = digits.length >= 10

  const attach = () => {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    void shippingApi
      .attach(integrationId, orderId, digits)
      .then((shipment) => {
        onAttached(shipment)
        onClose()
      })
      .catch((problem: unknown) => {
        setError(deliveryProblemMessage(problem, locale))
      })
      .finally(() => setBusy(false))
  }

  return (
    <Sheet
      description={t('attachDescription')}
      eyebrow={eyebrow(orderNumber, t('partWaybill'))}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !valid}
            onClick={attach}
            variant="primary"
          >
            {t('attachSubmit')}
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title={t('attachTitle')}
    >
      {error === null ? null : <Notice tone="danger">{error}</Notice>}

      <Field hint={t('attachHint')} label={t('attachNumber')} required>
        <TextInput
          className="font-mono tabular-nums"
          inputMode="numeric"
          onChange={(event) => setNumber(event.target.value)}
          placeholder="20451931 5540"
          value={number}
        />
      </Field>

      <Notice block tone={delivery.outstandingUah > 0 ? 'warn' : 'ok'}>
        <p className="rz-strong m-0 font-semibold">{t('attachConditions')}</p>
        <ul className="m-0 mt-1.5 grid list-none gap-1 p-0">
          <li>
            {t('attachCodEquals')}{' '}
            <span className="font-mono">
              {uah(delivery.outstandingUah, locale)}
            </span>
          </li>
          <li>{t('attachSamePoint')}</li>
          <li>{t('attachNotLinked')}</li>
        </ul>
      </Notice>
    </Sheet>
  )
}

/**
 * The carrier's label. Core proxies the PDF so the browser never holds an API
 * key; the blob it hands back lives only while this drawer is open.
 */
export function WaybillLabelDrawer({
  integrationId,
  onClose,
  orderId,
  orderNumber,
  waybillNumber,
}: {
  integrationId: string
  onClose: () => void
  orderId: string
  orderNumber: number
  waybillNumber: string
}) {
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const eyebrow = useEyebrow()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let created: string | null = null
    void shippingApi
      .label(integrationId, orderId, { signal: controller.signal })
      .then((blob) => {
        if (controller.signal.aborted) return
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch((problem: unknown) => {
        if (!controller.signal.aborted)
          setError(deliveryProblemMessage(problem, locale))
      })
    return () => {
      controller.abort()
      if (created !== null) URL.revokeObjectURL(created)
    }
  }, [integrationId, locale, orderId])

  return (
    <Sheet
      eyebrow={eyebrow(orderNumber, t('partLabel'))}
      footer={
        <>
          <p className="rz-muted m-0 min-w-0 flex-1 font-mono">
            {waybillNumber}
          </p>
          <Button onClick={onClose}>{tc('close')}</Button>
          {url === null ? null : (
            <Button asChild variant="primary">
              <a href={url} rel="noopener noreferrer" target="_blank">
                {t('openPdf')}
              </a>
            </Button>
          )}
        </>
      }
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      open
      title={t('labelTitle')}
    >
      {error === null ? null : <Notice tone="danger">{error}</Notice>}
      {url === null && error === null ? (
        <SkeletonRows label={t('labelLoading')} rows={3} />
      ) : null}
      {url === null ? null : (
        <object
          aria-label={t('labelAria')}
          className="border-app-line h-[60vh] w-full rounded-panel border"
          data={url}
          type="application/pdf"
        >
          <p className="text-app-muted m-0 p-4">{t('labelFallback')}</p>
        </object>
      )}
    </Sheet>
  )
}
