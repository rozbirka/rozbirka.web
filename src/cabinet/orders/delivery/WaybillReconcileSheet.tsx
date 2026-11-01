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
import {
  shippingApi,
  type Shipment,
  type ShipmentRecoveryCandidate,
  type ShipmentRecoveryCandidates,
  type ShippingContact,
} from '@/api/shipping'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import { formatPhone } from '@/lib/phone'
import { SheetGroup } from '../sheet-group'
import { uah } from './delivery-money'
import { deliveryProblemMessage } from './nova-poshta-availability'
import { recoveryMessages } from './recovery-messages'
import { SummaryList } from './WaybillCreateSheet'
import { waybillMessages } from './waybill-messages'
import { reconcileOperation } from './waybill-view'

interface Props {
  delivery: DeliveryOrder
  integrationId: string
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  onResolved: (shipment: Shipment) => void
  onWaiting: () => void
  orderId: string
  orderNumber: number
  shipment: Shipment
}

const operationPending = (problem: unknown) =>
  isProblemCode(problem, 'shipment_operation_in_progress') ||
  isProblemCode(problem, 'shipment_outcome_unknown') ||
  isProblemCode(problem, 'delivery_operation_in_progress')
const stillWaiting = (problem: unknown) =>
  operationPending(problem) ||
  ['network', 'timeout'].includes(normalizeApiProblem(problem).kind)

/** Cancellation keeps its existing reconciliation route; creation requires explicit candidate confirmation. */
export function WaybillReconcileSheet(props: Props) {
  return reconcileOperation(props.shipment) === 'create' ? (
    <CreateRecoverySheet {...props} />
  ) : (
    <CancelRecoverySheet {...props} />
  )
}

function CreateRecoverySheet({
  integrationId,
  onClose,
  onCloseAutoFocus,
  onResolved,
  onWaiting,
  orderId,
  orderNumber,
}: Props) {
  const { locale } = useLocale()
  const format = useFormat()
  const t = useT(recoveryMessages)
  const tc = useT(commonMessages)
  const [pending, setPending] = useState<
    'search' | 'preview' | 'confirm' | null
  >('search')
  const [result, setResult] = useState<ShipmentRecoveryCandidates | null>(null)
  const [rejected, setRejected] = useState<string[]>([])
  const [number, setNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [numberError, setNumberError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)
  const request = useRef(0)
  const inFlight = useRef(false)
  const busy = pending !== null
  const digits = number.replace(/\D/g, '')
  const focus = (target: 'input' | 'alert' | 'result') =>
    window.requestAnimationFrame(() => {
      if (target === 'input') inputRef.current?.focus()
      else if (target === 'alert') alertRef.current?.focus()
      else resultRef.current?.focus()
    })
  const failureMessage = (problem: unknown) => {
    const normalized = normalizeApiProblem(problem)
    if (
      [
        'nova_poshta_unauthorized',
        'nova_poshta_access_denied',
        'shipment_connection_unavailable',
        'shipment_connection_changed',
        'nova_poshta_invalid_api_key',
        'np_historical_access_unavailable',
      ].some((code) => isProblemCode(problem, code))
    )
      return t('accessFailed')
    if (isProblemCode(problem, 'integration_inactive')) return t('inactive')
    if (normalized.kind === 'forbidden')
      return deliveryProblemMessage(problem, locale)
    return t('searchFailed')
  }
  const lookup = async (manual = false) => {
    if (inFlight.current || (manual && digits.length < 10)) return
    inFlight.current = true
    const current = ++request.current
    setPending(manual ? 'preview' : 'search')
    setError(null)
    setNumberError(null)
    setResult(null)
    setRejected([])
    try {
      const next = manual
        ? await shippingApi.previewRecoveryCandidate(
            integrationId,
            orderId,
            digits,
          )
        : await shippingApi.searchRecoveryCandidates(integrationId, orderId)
      if (current !== request.current) return
      setResult(next)
      focus(next.candidates.length === 0 ? 'input' : 'result')
    } catch (problem) {
      if (current !== request.current) return
      if (operationPending(problem)) onWaiting()
      else if (
        manual &&
        (normalizeApiProblem(problem).kind === 'not-found' ||
          isProblemCode(problem, 'nova_poshta_notfound'))
      ) {
        setNumberError(t('notFound'))
        focus('input')
      } else if (
        manual &&
        (isProblemCode(problem, 'shipment_identity_unverified') ||
          isProblemCode(problem, 'shipment_number_invalid'))
      ) {
        setNumberError(
          t(
            isProblemCode(problem, 'shipment_number_invalid')
              ? 'invalidNumber'
              : 'identityUnverified',
          ),
        )
        focus('input')
      } else {
        setError(failureMessage(problem))
        focus('alert')
      }
    } finally {
      if (current === request.current) {
        inFlight.current = false
        setPending(null)
      }
    }
  }
  useEffect(() => {
    void lookup()
    return () => {
      // This is a request generation counter, not a DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      request.current++
      inFlight.current = false
    }
    // Search once on opening. Request IDs discard results after dismissal and StrictMode replays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirm = async (candidate: ShipmentRecoveryCandidate) => {
    if (inFlight.current || result === null || !candidate.canConfirm) return
    inFlight.current = true
    const current = ++request.current
    setPending('confirm')
    setError(null)
    try {
      const resolved = await shippingApi.confirmRecoveryCandidate(
        integrationId,
        orderId,
        {
          number: candidate.number,
          fingerprint: candidate.fingerprint,
          shipmentVersion: result.shipmentVersion,
        },
      )
      if (current === request.current) onResolved(resolved)
    } catch (problem) {
      if (current !== request.current) return
      // Any failed confirmation invalidates the displayed proof before another attempt.
      setResult(null)
      if (stillWaiting(problem)) onWaiting()
      else {
        setError(
          [
            'shipment_preview_stale',
            'shipment_version_conflict',
            'shipment_concurrency_conflict',
            'shipment_recovery_stale',
          ].some((code) => isProblemCode(problem, code))
            ? t('stale')
            : normalizeApiProblem(problem).kind === 'forbidden'
              ? deliveryProblemMessage(problem, locale)
              : t('confirmFailed'),
        )
        focus('alert')
      }
    } finally {
      if (current === request.current) {
        inFlight.current = false
        setPending(null)
      }
    }
  }
  const available = (value: string | null | undefined) =>
    value == null || value.trim() === '' ? t('unavailable') : value.trim()
  const contact = (value: ShippingContact | null) =>
    value === null
      ? t('unavailable')
      : `${available(value.name)} · ${value.phone.trim() === '' ? t('unavailable') : formatPhone(value.phone)}`
  const location = (value: ShippingContact | null) =>
    value === null
      ? t('unavailable')
      : `${available(value.settlementName)} · ${available(value.warehouseName)}`
  const candidates =
    result?.candidates.filter(
      (candidate) => !rejected.includes(candidate.number),
    ) ?? []

  return (
    <Sheet
      open
      title={t('title')}
      description={t('description', { number: String(orderNumber) })}
      pending={busy}
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {tc('close')}
          </Button>
          <Button
            aria-busy={pending === 'search'}
            disabled={busy}
            onClick={() => void lookup()}
          >
            {t('retry')}
          </Button>
        </>
      }
    >
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {pending === 'search' ? (
        <SkeletonRows label={t('searching')} rows={3} />
      ) : null}
      {result === null ? null : (
        <div ref={resultRef} tabIndex={-1} className="grid min-w-0 gap-3.5">
          <Notice
            tone={
              result.status === 'Incomplete' || result.status === 'Limited'
                ? 'warn'
                : 'info'
            }
          >
            {t(
              result.status === 'NotFound'
                ? 'notFound'
                : result.status === 'Incomplete'
                  ? 'incomplete'
                  : result.status === 'Limited'
                    ? 'limited'
                    : 'found',
            )}
          </Notice>
          {candidates.map((candidate) => (
            <section
              key={candidate.number}
              aria-label={t('candidateTitle', { number: candidate.number })}
              className="border-app-line grid min-w-0 gap-3 rounded-rz-md border p-3"
            >
              <h3 className="rz-h-card m-0 wrap-anywhere">
                {t('candidateTitle', { number: candidate.number })}
              </h3>
              <SummaryList
                rows={[
                  {
                    label: t('createdAt'),
                    value:
                      format.dateTime(candidate.createdAt) ?? t('unavailable'),
                  },
                  { label: t('sender'), value: contact(candidate.sender) },
                  { label: t('from'), value: location(candidate.sender) },
                  {
                    label: t('recipient'),
                    value: contact(candidate.recipient),
                  },
                  { label: t('to'), value: location(candidate.recipient) },
                  {
                    label: t('cod'),
                    value:
                      candidate.codUah === null
                        ? t('unavailable')
                        : uah(candidate.codUah, locale),
                  },
                ]}
              />
              {candidate.codUah === null ? (
                <p className="rz-caption m-0">{t('financeUnavailable')}</p>
              ) : null}
              {candidate.canConfirm ? null : (
                <Notice tone="warn">{t('cannotConfirm')}</Notice>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => {
                    setRejected((previous) => [...previous, candidate.number])
                    focus('input')
                  }}
                >
                  {t('reject')}
                </Button>
                <Button
                  className="h-auto min-h-10 whitespace-normal"
                  disabled={busy || !candidate.canConfirm}
                  aria-busy={pending === 'confirm'}
                  onClick={() => void confirm(candidate)}
                  variant="primary"
                >
                  {pending === 'confirm' ? t('confirming') : t('confirm')}
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}
      <Notice tone="info">{t('unknown')}</Notice>
      <SheetGroup>
        <form
          className="grid min-w-0 gap-2.5"
          onSubmit={(event) => {
            event.preventDefault()
            void lookup(true)
          }}
        >
          <Field
            error={numberError ?? undefined}
            hint={t('manualHint')}
            label={t('manual')}
          >
            <TextInput
              autoComplete="off"
              className="h-12 font-mono text-page tabular-nums"
              inputMode="numeric"
              dir="ltr"
              ref={inputRef}
              readOnly={busy}
              value={number}
              onChange={(event) => {
                setNumber(event.target.value)
                setNumberError(null)
              }}
            />
          </Field>
          <Button
            type="submit"
            disabled={busy || digits.length < 10}
            aria-busy={pending === 'preview'}
          >
            {pending === 'preview' ? t('previewing') : t('preview')}
          </Button>
        </form>
      </SheetGroup>
    </Sheet>
  )
}

function CancelRecoverySheet({
  integrationId,
  onClose,
  onCloseAutoFocus,
  onResolved,
  onWaiting,
  orderId,
  shipment,
}: Props) {
  const { locale } = useLocale()
  const t = useT(waybillMessages)
  const tc = useT(commonMessages)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const started = useRef(false)
  const check = async () => {
    setBusy(true)
    setError(null)
    try {
      onResolved(await shippingApi.reconcile(integrationId, orderId))
    } catch (problem) {
      if (stillWaiting(problem)) onWaiting()
      else {
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
  return (
    <Sheet
      open
      pending={busy}
      title={t('reconcileTitle')}
      description={t('reconcileCancel', { number: shipment.number ?? '' })}
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      footer={
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
      }
    >
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {busy ? <SkeletonRows label={t('reconciling')} rows={3} /> : null}
    </Sheet>
  )
}
