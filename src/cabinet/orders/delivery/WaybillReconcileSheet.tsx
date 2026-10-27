import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Field,
  Notice,
  Sheet,
  SkeletonRows,
  TextInput,
} from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import { shippingApi, type Shipment } from '@/api/shipping'
import { commonMessages, useLocale, useT } from '@/i18n'
import { SheetGroup } from '../sheet-group'
import { uah } from './delivery-money'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'
import { SummaryList } from './WaybillCreateSheet'
import { waybillMessages } from './waybill-messages'
import { contactLine, reconcileOperation, routeLine } from './waybill-view'

type Phase = 'checking' | 'candidate' | 'failed'

/**
 * Whether a failed check still means «no answer yet» rather than a refusal:
 * the call is still running, Core found no proof either way, or the check
 * itself got lost on the way.
 */
const stillWaiting = (problem: unknown) =>
  isProblemCode(problem, 'shipment_operation_in_progress') ||
  isProblemCode(problem, 'shipment_outcome_unknown') ||
  ['network', 'timeout'].includes(normalizeApiProblem(problem).kind)

/**
 * «Перевірка результату» (5.13–5.15): settles a create or a cancel Nova
 * Poshta never answered. The check starts as soon as the sheet opens. A
 * proven result closes it; no proof yet hands back «waiting» for the block
 * (5.15) — success is never shown without proof.
 *
 * For an unknown create Core does not search the carrier on its own: it asks
 * for the candidate's number and attaches it only when Nova Poshta confirms
 * it carries this order's id, sender and post-payment (5.14). The sheet
 * shows what the waybill must match so the person can compare it in the
 * carrier's cabinet before confirming.
 */
export function WaybillReconcileSheet({
  delivery,
  integrationId,
  onClose,
  onCloseAutoFocus,
  onResolved,
  onWaiting,
  orderId,
  orderNumber,
  shipment,
}: {
  delivery: DeliveryOrder
  integrationId: string
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  /** Core proved the outcome: the waybill as it now stands. */
  onResolved: (shipment: Shipment) => void
  /** No proof yet; the block keeps creating again out of reach. */
  onWaiting: () => void
  orderId: string
  orderNumber: number
  shipment: Shipment
}) {
  const { locale } = useLocale()
  const t = useT(waybillMessages)
  const td = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const operation = reconcileOperation(shipment)
  const [phase, setPhase] = useState<Phase>('checking')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [number, setNumber] = useState('')
  const [numberError, setNumberError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const started = useRef(false)

  const check = async () => {
    setPhase('checking')
    setBusy(true)
    setError(null)
    try {
      onResolved(await shippingApi.reconcile(integrationId, orderId))
    } catch (problem) {
      if (
        operation === 'create' &&
        isProblemCode(problem, 'shipment_candidate_required')
      ) {
        setPhase('candidate')
        window.requestAnimationFrame(() => inputRef.current?.focus())
      } else if (stillWaiting(problem)) {
        onWaiting()
      } else {
        setPhase('failed')
        setError(deliveryProblemMessage(problem, locale))
        window.requestAnimationFrame(() => alertRef.current?.focus())
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const digits = number.replace(/\D/g, '')

  const confirm = async () => {
    if (busy || digits.length < 10) return
    setBusy(true)
    setError(null)
    setNumberError(null)
    try {
      onResolved(await shippingApi.reconcile(integrationId, orderId, digits))
    } catch (problem) {
      if (
        isProblemCode(problem, 'shipment_identity_unverified') ||
        normalizeApiProblem(problem).kind === 'not-found'
      ) {
        setNumberError(
          normalizeApiProblem(problem).kind === 'not-found'
            ? t('notFound')
            : deliveryProblemMessage(problem, locale),
        )
        window.requestAnimationFrame(() => inputRef.current?.focus())
      } else if (stillWaiting(problem)) {
        onWaiting()
      } else {
        setError(deliveryProblemMessage(problem, locale))
        window.requestAnimationFrame(() => alertRef.current?.focus())
      }
    } finally {
      setBusy(false)
    }
  }

  const description =
    phase === 'candidate'
      ? t('candidateDescription', { number: String(orderNumber) })
      : operation === 'create'
        ? t('reconcileCreate', { number: String(orderNumber) })
        : t('reconcileCancel', { number: shipment.number ?? '' })

  return (
    <Sheet
      description={description}
      footer={
        phase === 'candidate' ? (
          <>
            <Button disabled={busy} onClick={onClose}>
              {tc('close')}
            </Button>
            <Button disabled={busy} onClick={onWaiting}>
              {t('candidateReject')}
            </Button>
            <Button
              aria-busy={busy}
              disabled={busy || digits.length < 10}
              onClick={() => void confirm()}
              variant="primary"
            >
              {busy ? t('checking') : t('candidateConfirm')}
            </Button>
          </>
        ) : (
          <>
            <Button disabled={busy} onClick={onClose}>
              {tc('close')}
            </Button>
            <Button
              aria-busy={busy}
              disabled={busy}
              onClick={() => void check()}
              variant="primary"
            >
              {busy ? t('checking') : t('checkAgain')}
            </Button>
          </>
        )
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title={t('reconcileTitle')}
    >
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {phase === 'checking' ? (
        <SkeletonRows label={t('reconciling')} rows={3} />
      ) : null}

      {phase === 'candidate' ? (
        <>
          <SheetGroup title={t('candidateGroup')}>
            <Field
              error={numberError ?? undefined}
              hint={td('attachHint')}
              label={t('candidateNumber')}
              required
            >
              <TextInput
                className="h-12 font-mono text-page tabular-nums"
                inputMode="numeric"
                onChange={(event) => {
                  setNumber(event.target.value)
                  setNumberError(null)
                }}
                placeholder="20451931 5540"
                readOnly={busy}
                ref={inputRef}
                value={number}
              />
            </Field>
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
                  label: t('groupCod'),
                  value: uah(
                    shipment.codUah ?? delivery.outstandingUah,
                    locale,
                  ),
                },
              ]}
            />
          </SheetGroup>
          <Notice tone="info">{t('candidateNote')}</Notice>
        </>
      ) : null}
    </Sheet>
  )
}
