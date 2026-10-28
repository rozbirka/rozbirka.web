import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Notice, Sheet, SkeletonRows } from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import { shippingApi, type Shipment } from '@/api/shipping'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { SheetGroup } from '../sheet-group'
import { wholeUah, uah } from './delivery-money'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryMessages } from './messages'
import { deliveryProblemMessage } from './nova-poshta-availability'
import { waybillMessages } from './waybill-messages'
import {
  contactLine,
  dimensionsLine,
  parcelLine,
  quoteFresh,
  routeLine,
} from './waybill-view'

type Phase = 'idle' | 'estimating' | 'creating' | 'refused' | 'unknown'

export interface SummaryRow {
  label: string
  value: ReactNode
  tone?: 'ok' | 'warn' | 'danger' | 'dim'
}

const ROW_TONE = {
  ok: 'text-state-ok',
  warn: 'text-state-warn',
  danger: 'text-state-danger',
  dim: 'text-app-dim',
} as const

/**
 * A titled summary inside a sheet (the `dl` groups of module 46): label on
 * the left, mono value on the right, an optional bold total and a caption.
 * The create, reconcile and attach sheets all print their facts this way.
 */
export function SummaryList({
  foot,
  rows,
  total,
}: {
  foot?: { text: string; tone?: 'warn' } | undefined
  rows: readonly SummaryRow[]
  total?: SummaryRow | undefined
}) {
  return (
    <div className="border-app-line grid min-h-fit rounded-rz-md border bg-(--rz-sheet-field) px-3 py-1">
      <dl className="m-0 grid">
        {[...rows, ...(total === undefined ? [] : [total])].map(
          (row, index) => (
            <div
              className="border-app-line flex items-baseline justify-between gap-4 border-t py-1.5 first:border-t-0"
              key={`${row.label}-${String(index)}`}
            >
              <dt className="text-app-muted">{row.label}</dt>
              <dd
                className={cn(
                  'm-0 text-right font-mono text-pretty',
                  row === total ? 'font-bold' : '',
                  row.tone === undefined
                    ? row === total
                      ? 'text-app-strong'
                      : 'text-app-ink'
                    : ROW_TONE[row.tone],
                )}
              >
                {row.value}
              </dd>
            </div>
          ),
        )}
      </dl>
      {foot === undefined ? null : (
        <p
          className={cn(
            'border-app-line m-0 border-t py-1.5 text-caption font-semibold text-pretty',
            foot.tone === 'warn' ? 'text-state-warn' : 'text-app-muted',
          )}
        >
          {foot.text}
        </p>
      )}
    </div>
  )
}

/** A notice with a bold first line, as the module draws titled notices. */
export function TitledNotice({
  children,
  title,
  tone,
}: {
  children: ReactNode
  title: string
  tone: 'ok' | 'warn' | 'danger' | 'info'
}) {
  return (
    <Notice block tone={tone}>
      <p className="rz-strong m-0 font-semibold">{title}</p>
      <p className="m-0 mt-1">{children}</p>
    </Notice>
  )
}

/**
 * «Створити ТТН» (4.7–4.11): the draft read back, the carrier's quote and
 * the one manual step that creates the waybill. A quote older than 24 hours
 * blocks creation until it is taken again (4.8). While Nova Poshta works the
 * sheet cannot be closed (4.9); a refusal keeps the draft (4.10); an answer
 * that never came leaves the waybill unknown, and creating again stays out
 * of reach until the result is checked (4.11).
 */
export function WaybillCreateSheet({
  delivery,
  integrationId,
  onClose,
  onCloseAutoFocus,
  onCreated,
  onReconcile,
  onShipment,
  orderId,
  orderNumber,
  shipment,
}: {
  delivery: DeliveryOrder
  integrationId: string
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  onCreated: (shipment: Shipment) => void
  /** Opens the result check for a waybill left unknown. */
  onReconcile: () => void
  /** The draft as Core holds it after a quote or a failed attempt. */
  onShipment: (shipment: Shipment) => void
  orderId: string
  orderNumber: number
  shipment: Shipment
}) {
  const { locale } = useLocale()
  const format = useFormat()
  const t = useT(waybillMessages)
  const td = useT(deliveryDrawerMessages)
  const tm = useT(deliveryMessages)
  const tc = useT(commonMessages)
  const unresolved =
    shipment.state === 'Unknown' || shipment.state === 'Creating'
  const [phase, setPhase] = useState<Phase>(unresolved ? 'unknown' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const started = useRef(false)

  const fresh = quoteFresh(shipment)
  const stale = shipment.quoteAt !== null && !fresh
  const busy = phase === 'estimating' || phase === 'creating'
  const depositShort =
    delivery.depositRequired &&
    !delivery.depositWaived &&
    delivery.requiredDepositUah > 0 &&
    !delivery.depositSatisfied

  const fail = (message: string) => {
    setError(message)
    window.requestAnimationFrame(() => alertRef.current?.focus())
  }

  const estimate = async () => {
    setPhase('estimating')
    setError(null)
    try {
      onShipment(await shippingApi.estimate(integrationId, orderId))
    } catch (problem) {
      fail(deliveryProblemMessage(problem, locale))
    } finally {
      setPhase('idle')
    }
  }

  // The readiness check promised the quote on this step, so a draft that has
  // none is quoted as soon as the sheet opens.
  useEffect(() => {
    if (started.current || unresolved || shipment.quoteAt !== null) return
    started.current = true
    void estimate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async () => {
    setPhase('creating')
    setError(null)
    try {
      onCreated(await shippingApi.create(integrationId, orderId))
    } catch (problem) {
      // Core keeps the draft for a refusal it is sure of and marks the
      // waybill unknown for an answer that never came: only the stored state
      // tells the two apart.
      const latest = await shippingApi
        .get(integrationId, orderId)
        .catch(() => null)
      if (latest !== null) onShipment(latest)
      const ambiguous =
        latest === null
          ? ['network', 'timeout'].includes(normalizeApiProblem(problem).kind)
          : latest.state === 'Unknown' || latest.state === 'Creating'
      if (ambiguous) {
        setPhase('unknown')
        window.requestAnimationFrame(() => alertRef.current?.focus())
        return
      }
      if (isProblemCode(problem, 'nova_poshta_rejected')) {
        setPhase('refused')
        window.requestAnimationFrame(() => alertRef.current?.focus())
        return
      }
      setPhase('idle')
      fail(deliveryProblemMessage(problem, locale))
    }
  }

  const parcels = shipment.draft.parcels
  const dims = dimensionsLine(parcels)
  const quotedAt =
    shipment.quoteAt === null
      ? ''
      : (format.dateTime(shipment.quoteAt) ?? shipment.quoteAt)
  const money = (value: number | null) =>
    value === null ? '—' : wholeUah(value, locale)

  const top =
    phase === 'unknown' ? (
      <TitledNotice title={t('unknownTitle')} tone="warn">
        {t('unknownCreate')}
      </TitledNotice>
    ) : phase === 'refused' ? (
      <TitledNotice title={t('refusedTitle')} tone="danger">
        {t('refusedText')}
      </TitledNotice>
    ) : error !== null ? (
      <Notice tone="danger">{error}</Notice>
    ) : null

  const submitBlocked = stale || shipment.quoteAt === null || depositShort

  return (
    <Sheet
      description={t('confirmDescription', { number: String(orderNumber) })}
      footer={
        <>
          <p className="text-state-warn m-0 min-w-0 flex-1">
            {phase === 'unknown'
              ? t('repeatBlocked')
              : phase === 'creating'
                ? t('keepOpen')
                : ''}
          </p>
          {stale && phase !== 'unknown' ? (
            <Button
              aria-busy={phase === 'estimating'}
              disabled={busy}
              onClick={() => void estimate()}
            >
              {tm('quoteRecalc')}
            </Button>
          ) : null}
          <Button disabled={busy} onClick={onClose}>
            {phase === 'unknown' ? tc('close') : t('back')}
          </Button>
          {phase === 'unknown' ? (
            <Button onClick={onReconcile} variant="primary">
              {t('checkResult')}
            </Button>
          ) : (
            <Button
              aria-busy={phase === 'creating'}
              disabled={busy || submitBlocked}
              onClick={() => void create()}
              title={
                stale || shipment.quoteAt === null
                  ? td('createNeedsQuote')
                  : depositShort
                    ? t('depositFirst')
                    : undefined
              }
              variant="primary"
            >
              {phase === 'creating' ? t('creating') : td('createWaybill')}
            </Button>
          )}
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onEscapeKeyDown={(event) => {
        if (busy) event.preventDefault()
      }}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title={td('createWaybill')}
    >
      {top === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          {top}
        </div>
      )}

      <SheetGroup title={t('groupWaybill')}>
        <SummaryList
          rows={[
            {
              label: t('groupRecipient'),
              value: contactLine(shipment.draft.recipient),
            },
            {
              label: t('factRoute'),
              value: routeLine(shipment.sender, shipment.draft.recipient),
            },
            {
              label: tm('factParcel'),
              value:
                dims === ''
                  ? parcelLine(parcels, locale)
                  : t('parcelWithDims', {
                      parcel: parcelLine(parcels, locale),
                      dims,
                    }),
            },
            {
              label: tm('factCod'),
              value: uah(delivery.outstandingUah, locale),
              tone: 'ok',
            },
          ]}
        />
      </SheetGroup>

      <SheetGroup title={stale ? tm('quoteStaleTitle') : tm('quoteReadyTitle')}>
        {phase === 'estimating' ? (
          <SkeletonRows label={tm('quoteBusyAction')} rows={3} />
        ) : (
          <SummaryList
            foot={
              stale
                ? { text: tm('quoteStaleNote'), tone: 'warn' }
                : shipment.quoteAt === null
                  ? undefined
                  : { text: t('quoteSource', { when: quotedAt }) }
            }
            rows={[
              {
                label: t('quoteDelivery'),
                value: money(shipment.quoteUah),
                ...(stale ? { tone: 'dim' as const } : {}),
              },
              {
                label: t('quoteReturn'),
                value:
                  shipment.quoteUah === null
                    ? '—'
                    : wholeUah(shipment.returnEstimateUah, locale),
                ...(stale ? { tone: 'dim' as const } : {}),
              },
            ]}
            total={{
              label: t('quoteDeposit'),
              ...(stale || shipment.quoteAt === null
                ? { value: '—', tone: 'dim' as const }
                : !delivery.depositRequired
                  ? { value: tm('depositStateNotRequired') }
                  : delivery.depositWaived
                    ? { value: tm('depositStateWaived'), tone: 'ok' as const }
                    : depositShort
                      ? {
                          value: tm('depositShort', {
                            amount: wholeUah(
                              delivery.depositShortfallUah,
                              locale,
                            ),
                          }),
                          tone: 'warn' as const,
                        }
                      : {
                          value: t('depositPaidValue', {
                            amount: wholeUah(
                              delivery.requiredDepositUah,
                              locale,
                            ),
                          }),
                          tone: 'ok' as const,
                        }),
            }}
          />
        )}
      </SheetGroup>
    </Sheet>
  )
}
