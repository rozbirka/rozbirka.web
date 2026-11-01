import { useEffect, useRef, useState } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import type { DeliveryOrder } from '@/api/delivery'
import { isProblemCode, normalizeApiProblem } from '@/api/errors'
import {
  shippingApi,
  type ExternalShipmentPreview,
  type Shipment,
} from '@/api/shipping'
import { commonMessages, useLocale, useT } from '@/i18n'
import { SheetGroup } from '../sheet-group'
import { uah } from './delivery-money'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryMessages } from './messages'
import { deliveryProblemMessage } from './nova-poshta-availability'
import {
  SummaryList,
  TitledNotice,
  type SummaryRow,
} from './WaybillCreateSheet'
import { waybillMessages } from './waybill-messages'
import {
  contactLine,
  previewIncomplete,
  previewMismatch,
  routeLine,
  withKnownNames,
} from './waybill-view'

type Phase = 'entry' | 'checking' | 'preview' | 'confirming'

/** The delivery state a preview reports, in the module's words. */
const stateKey = (preview: ExternalShipmentPreview) =>
  preview.recordsReceipt
    ? ('stateReceived' as const)
    : preview.recordsDispatch
      ? ('stateSent' as const)
      : ('stateNotSent' as const)

/**
 * «Прив’язати наявну ТТН» (6.1–6.11): a waybill made in the Nova Poshta
 * cabinet becomes the order's. The number is checked first and its preview
 * shown with what attaching changes; nothing in the order is rewritten to
 * match it. Core attaches only the preview it showed — if the waybill moved
 * on in between, the sheet checks it again and says what changed (6.11).
 *
 * Core compares the waybill with the order's draft (recipient and dispatch
 * point), so an order without one is sent to the delivery form first.
 */
export function ExternalWaybillSheet({
  delivery,
  integrationId,
  onAttached,
  onClose,
  onCloseAutoFocus,
  onStartDelivery,
  orderId,
  orderNumber,
  shipment,
}: {
  delivery: DeliveryOrder
  integrationId: string
  /** Core attached it; the order's money summary as it now stands. */
  onAttached: (money: DeliveryOrder) => void
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  /** Opens the delivery form when there is no draft to compare with. */
  onStartDelivery: (() => void) | null
  orderId: string
  orderNumber: number
  /** The order's draft, which the waybill is compared with. */
  shipment: Shipment | null
}) {
  const { locale } = useLocale()
  const t = useT(waybillMessages)
  const td = useT(deliveryDrawerMessages)
  const tm = useT(deliveryMessages)
  const tc = useT(commonMessages)
  const draft = shipment?.state === 'Draft' ? shipment : null
  const [number, setNumber] = useState('')
  const [phase, setPhase] = useState<Phase>('entry')
  const [preview, setPreview] = useState<ExternalShipmentPreview | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (draft === null) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const digits = number.replace(/\D/g, '')
  const busy = phase === 'checking' || phase === 'confirming'

  const fail = (message: string) => {
    setError(message)
    window.requestAnimationFrame(() => alertRef.current?.focus())
  }

  const check = async (stale = false) => {
    setPhase('checking')
    setFieldError(null)
    setUnverified(false)
    setError(null)
    try {
      const next = await shippingApi.previewExternal(
        integrationId,
        orderId,
        digits,
      )
      setPreview(next)
      setChanged(stale)
      setPhase('preview')
    } catch (problem) {
      setPreview(null)
      setChanged(false)
      setPhase('entry')
      const normalized = normalizeApiProblem(problem)
      if (
        normalized.status === 404 ||
        normalized.kind === 'not-found' ||
        isProblemCode(problem, 'nova_poshta_notfound')
      )
        setFieldError(t('notFound'))
      else if (isProblemCode(problem, 'shipment_already_linked'))
        setFieldError(t('alreadyLinked'))
      else if (isProblemCode(problem, 'shipment_identity_unverified'))
        setUnverified(true)
      else {
        fail(deliveryProblemMessage(problem, locale))
        return
      }
      window.requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  const confirm = async () => {
    if (preview === null) return
    setPhase('confirming')
    setError(null)
    try {
      onAttached(
        await shippingApi.confirmExternal(integrationId, orderId, preview),
      )
    } catch (problem) {
      if (isProblemCode(problem, 'shipment_preview_stale')) {
        await check(true)
        return
      }
      setPhase('preview')
      fail(deliveryProblemMessage(problem, locale))
    }
  }

  const reset = () => {
    setPreview(null)
    setChanged(false)
    setPhase('entry')
    setNumber('')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const incomplete = preview !== null && previewIncomplete(preview)
  const mismatch =
    preview === null
      ? { recipient: false, cod: false }
      : previewMismatch(preview, draft?.draft ?? null, delivery)
  const mismatched = mismatch.recipient || mismatch.cod
  const blockedWhy = incomplete
    ? t('incompleteWhy')
    : mismatched
      ? t('diffWhy')
      : undefined
  const showPreview = preview !== null && phase !== 'entry'

  const previewRows = (value: ExternalShipmentPreview): SummaryRow[] => {
    const recipient = withKnownNames(value.recipient, draft?.draft.recipient)
    const sender = withKnownNames(value.sender, draft?.sender)
    const state: SummaryRow = {
      label: t('previewState'),
      value: t(stateKey(value)),
      ...(changed ? { tone: 'warn' as const } : {}),
    }
    if (changed) return [state]
    if (incomplete)
      return [
        { label: t('groupRecipient'), value: contactLine(recipient) },
        {
          label: t('factRoute'),
          value: routeLine(sender, recipient),
          tone: 'danger',
        },
        {
          label: t('groupCod'),
          value:
            value.codAmountUah === null ? '—' : uah(value.codAmountUah, locale),
        },
      ]
    return [
      { label: t('groupRecipient'), value: contactLine(recipient), tone: 'ok' },
      {
        label: t('factRoute'),
        value: routeLine(sender, recipient),
        tone: 'ok',
      },
      {
        label: t('groupCod'),
        value:
          value.codAmountUah === null
            ? '—'
            : value.recordsDispatch
              ? uah(value.codAmountUah, locale)
              : t('codMatchesValue', {
                  amount: uah(value.codAmountUah, locale),
                }),
        tone: 'ok',
      },
      state,
    ]
  }

  const effect = (value: ExternalShipmentPreview) =>
    changed ? (
      <Notice tone="warn">{t('effectNoPayment')}</Notice>
    ) : incomplete ? (
      <Notice tone="warn">{t('incompleteText')}</Notice>
    ) : value.recordsReceipt ? (
      <Notice tone="warn">{t('effectReceived')}</Notice>
    ) : value.recordsDispatch ? (
      <Notice tone="info">{t('effectSent')}</Notice>
    ) : (
      <Notice tone="info">{t('effectNotSent')}</Notice>
    )

  return (
    <Sheet
      description={t('attachDescription', { number: String(orderNumber) })}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {tc('cancel')}
          </Button>
          {draft === null && onStartDelivery !== null ? (
            <Button onClick={onStartDelivery}>{tm('startDelivery')}</Button>
          ) : null}
          {showPreview ? (
            <Button disabled={busy} onClick={reset}>
              {t('attachOther')}
            </Button>
          ) : null}
          {showPreview ? (
            <Button
              aria-busy={phase === 'confirming'}
              disabled={busy || blockedWhy !== undefined}
              onClick={() => void confirm()}
              title={blockedWhy}
              variant="primary"
            >
              {td('attachSubmit')}
            </Button>
          ) : (
            <Button
              aria-busy={phase === 'checking'}
              disabled={busy || draft === null || digits.length < 10}
              onClick={() => void check()}
              variant="primary"
            >
              {phase === 'checking' ? t('checking') : t('attachCheck')}
            </Button>
          )}
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      open
      title={td('attachTitle')}
    >
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {changed && preview !== null ? (
        <TitledNotice title={t('staleTitle')} tone="warn">
          {t('staleText', { state: t(stateKey(preview)) })}
        </TitledNotice>
      ) : null}
      {draft === null ? (
        <Notice tone="warn">{t('attachNeedsDraft')}</Notice>
      ) : null}

      <Field
        error={fieldError ?? undefined}
        hint={td('attachHint')}
        label={td('attachNumber')}
        required
      >
        <TextInput
          className="h-12 font-mono text-page tabular-nums"
          disabled={draft === null}
          inputMode="numeric"
          onChange={(event) => {
            setNumber(event.target.value)
            setFieldError(null)
            setUnverified(false)
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !busy &&
              !showPreview &&
              digits.length >= 10
            )
              void check()
          }}
          placeholder="20451931 5540"
          readOnly={busy || showPreview}
          ref={inputRef}
          value={number}
        />
      </Field>

      {unverified ? (
        <TitledNotice title={t('diffTitle')} tone="danger">
          {t('diffText')}
        </TitledNotice>
      ) : null}

      {!showPreview && !unverified && draft !== null ? (
        <TitledNotice title={td('attachConditions')} tone="warn">
          {t('attachConditionsText', {
            amount: uah(delivery.outstandingUah, locale),
          })}
        </TitledNotice>
      ) : null}

      {showPreview && preview !== null && mismatched && !incomplete ? (
        <>
          <SheetGroup title={t('diffGroup')}>
            <SummaryList
              rows={[
                ...(mismatch.recipient
                  ? [
                      {
                        label: t('diffRecipientWaybill'),
                        value: preview.recipient.name,
                        tone: 'danger' as const,
                      },
                      {
                        label: t('diffRecipientOrder'),
                        value: draft?.draft.recipient.name ?? '—',
                      },
                    ]
                  : []),
                ...(mismatch.cod && preview.codAmountUah !== null
                  ? [
                      {
                        label: t('diffCodWaybill'),
                        value: uah(preview.codAmountUah, locale),
                        tone: 'danger' as const,
                      },
                      {
                        label: t('diffCodOrder'),
                        value: uah(delivery.outstandingUah, locale),
                      },
                    ]
                  : []),
              ]}
            />
          </SheetGroup>
          <TitledNotice title={t('diffTitle')} tone="danger">
            {t('diffText')}
          </TitledNotice>
        </>
      ) : showPreview && preview !== null ? (
        <>
          <SheetGroup title={t('previewGroup')}>
            <SummaryList rows={previewRows(preview)} />
          </SheetGroup>
          <SheetGroup title={t('previewChanges')}>{effect(preview)}</SheetGroup>
        </>
      ) : null}
    </Sheet>
  )
}
