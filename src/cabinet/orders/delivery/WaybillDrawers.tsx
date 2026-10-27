import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { Button, Notice, Sheet, SkeletonRows } from '@/components/app'
import { cn } from '@/lib/utils'
import { shippingApi, type Shipment } from '@/api/shipping'
import type { DeliveryOrder } from '@/api/delivery'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import { uah } from './delivery-money'
import { NpChecks } from '../../integrations/np-checks'
import { SheetGroup } from '../sheet-group'
import { readiness, readinessBlocks } from './delivery-view'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryMessages } from './messages'
import { waybillMessages } from './waybill-messages'

/** `Замовлення #12 · накладна`, in the drawer's own words. */
function useEyebrow() {
  const t = useT(deliveryDrawerMessages)
  return (orderNumber: number, part: string) =>
    t('eyebrowOrder', { number: String(orderNumber), part })
}

/**
 * «Перевірка перед створенням ТТН» (4.5–4.6): everything the cabinet can
 * check before the quote. The route and the parcel are the carrier's call,
 * and that row says so rather than claiming a pass. Only what has to be
 * fixed elsewhere — an inactive dispatch point lives in the integration's
 * settings — keeps the order off the next step, and the notice says where.
 */
export function WaybillReadinessDrawer({
  busy,
  delivery,
  dispatchPointActive,
  onClose,
  onCloseAutoFocus,
  onContinue,
  orderNumber,
  settingsPath,
  shipment,
}: {
  busy: boolean
  delivery: DeliveryOrder
  dispatchPointActive: boolean
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  onContinue: () => void
  orderNumber: number
  /** The integration's settings; null without the right to open them. */
  settingsPath: string | null
  shipment: Shipment | null
}) {
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tw = useT(waybillMessages)
  const tm = useT(deliveryMessages)
  const tc = useT(commonMessages)
  const checks = readiness(delivery, shipment, dispatchPointActive, locale)
  const blocking = readinessBlocks(checks)
  const passed = blocking.length === 0
  const first = blocking[0]

  return (
    <Sheet
      description={tw('readinessDescription', { number: String(orderNumber) })}
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
          {passed || settingsPath === null ? null : (
            <Button asChild>
              <RouterLink to={settingsPath}>{tw('openSettings')}</RouterLink>
            </Button>
          )}
          <Button disabled={busy} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            disabled={busy || !passed}
            onClick={onContinue}
            title={passed ? undefined : tw('fixSettings')}
            variant="primary"
          >
            {t('continueBooking')}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title={t('readinessTitle')}
    >
      <Notice block tone={passed ? 'ok' : 'warn'}>
        <p className="rz-strong m-0 font-semibold">
          {first === undefined ? tm('nextClearTitle') : tm('nextFixTitle')}
        </p>
        <p className="m-0 mt-1">
          {first === undefined
            ? tm('nextClearNote')
            : tm('nextFixNote', { label: first.label, state: first.state })}
        </p>
      </Notice>

      <SheetGroup title={t('readinessChecks')}>
        <NpChecks
          items={checks.map((check) => ({
            label: check.label,
            value: check.state,
            state:
              check.deferred === true
                ? 'none'
                : check.pending === true && !check.ok
                  ? 'pending'
                  : check.ok
                    ? 'ok'
                    : 'fail',
          }))}
        />
      </SheetGroup>
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
      <dl className="border-app-line m-0 grid min-h-fit rounded-rz-md border bg-(--rz-sheet-field) px-3 py-1">
        {rows.map((row) => (
          <div
            className="border-app-line grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-baseline gap-3 border-t py-2 first:border-t-0"
            key={row.label}
          >
            <dt className="text-app-muted">{row.label}</dt>
            <dd
              className={cn(
                'm-0 text-right font-mono text-pretty',
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
        <section className="grid min-h-fit gap-2.5">
          <h3 aria-hidden className="rz-h-card">
            {t('shipmentStatuses')}
          </h3>
          <ol
            aria-label={t('shipmentStatuses')}
            className="border-app-line m-0 grid list-none rounded-rz-md border bg-(--rz-sheet-field) px-3 py-1"
          >
            {shipment.events.map((event) => (
              <li
                className="border-app-line flex items-baseline justify-between gap-3 border-t py-2 first:border-t-0"
                key={`${event.recordedAt}-${event.code}`}
              >
                <span className="text-app-muted min-w-0 text-pretty">
                  {event.name}
                </span>
                <span className="text-app-strong font-mono whitespace-nowrap">
                  {when(event.occurredAt ?? event.recordedAt)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Sheet>
  )
}

/**
 * «Друк етикетки» (5.10–5.11): the carrier's own label. Core proxies the PDF
 * so the browser never holds an API key; the blob lives only while the sheet
 * is open. A label Nova Poshta did not hand over does not make the waybill
 * any less valid, and the sheet says so next to the retry.
 */
export function WaybillLabelDrawer({
  integrationId,
  onClose,
  onCloseAutoFocus,
  orderId,
  orderNumber,
  waybillNumber,
}: {
  integrationId: string
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  orderId: string
  orderNumber: number
  waybillNumber: string
}) {
  const t = useT(deliveryDrawerMessages)
  const tw = useT(waybillMessages)
  const tc = useT(commonMessages)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    attempt: number
    url: string | null
    failed: boolean
  } | null>(null)
  const current = result?.attempt === attempt ? result : null
  const url = current?.url ?? null
  const failed = current?.failed === true

  useEffect(() => {
    const controller = new AbortController()
    let created: string | null = null
    void shippingApi
      .label(integrationId, orderId, { signal: controller.signal })
      .then((blob) => {
        if (controller.signal.aborted) return
        created = URL.createObjectURL(blob)
        setResult({ attempt, url: created, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ attempt, url: null, failed: true })
      })
    return () => {
      controller.abort()
      if (created !== null) URL.revokeObjectURL(created)
    }
  }, [attempt, integrationId, orderId])

  return (
    <Sheet
      description={tw('labelDescription', { number: String(orderNumber) })}
      footer={
        <>
          <p className="rz-muted m-0 min-w-0 flex-1 font-mono">
            {waybillNumber}
          </p>
          <Button onClick={onClose}>{tc('close')}</Button>
          {failed ? (
            <Button
              onClick={() => setAttempt((value) => value + 1)}
              variant="primary"
            >
              {tw('tryAgain')}
            </Button>
          ) : url === null ? (
            <Button disabled variant="primary">
              {t('openPdf')}
            </Button>
          ) : (
            <Button asChild variant="primary">
              <a href={url} rel="noopener noreferrer" target="_blank">
                {t('openPdf')}
              </a>
            </Button>
          )}
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      open
      title={t('labelTitle')}
    >
      {failed ? <Notice tone="danger">{tw('labelFailed')}</Notice> : null}
      {url === null && !failed ? (
        <SkeletonRows label={t('labelLoading')} rows={3} />
      ) : null}
      {url === null ? null : (
        <object
          aria-label={t('labelAria')}
          className="border-app-line h-[60vh] w-full rounded-rz-md border"
          data={url}
          type="application/pdf"
        >
          <p className="text-app-muted m-0 p-4">{t('labelFallback')}</p>
        </object>
      )}
    </Sheet>
  )
}
