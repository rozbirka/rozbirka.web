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
import { agreedTotal as parseAgreedTotal } from './delivery-labels'
import { trackingSignal } from '../../waybills/waybill-presentation'
import { deliveryDrawerMessages } from './drawer-messages'
import { externalMessages } from './external-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'
import { SummaryList, TitledNotice } from './WaybillCreateSheet'
import { waybillMessages } from './waybill-messages'
import {
  contactLine,
  importedParcelLine,
  previewIncomplete,
  routeLine,
  shipmentRecipient,
  withKnownNames,
} from './waybill-view'

type Phase = 'entry' | 'checking' | 'preview' | 'confirming'
const stateKey = (preview: ExternalShipmentPreview) =>
  preview.recordsReceipt
    ? ('stateReceived' as const)
    : preview.recordsDispatch
      ? ('stateSent' as const)
      : ('stateNotSent' as const)

/** Preview is read-only. Only explicit confirmation imports carrier facts. */
export function ExternalWaybillSheet({
  delivery,
  integrationId,
  onAttached,
  onClose,
  onCloseAutoFocus,
  orderId,
  orderNumber,
  shipment,
}: {
  delivery: DeliveryOrder | null
  integrationId: string
  onAttached: (money: DeliveryOrder) => void
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  orderId: string
  orderNumber: number
  shipment: Shipment | null
}) {
  const { locale } = useLocale()
  const t = useT(waybillMessages)
  const td = useT(deliveryDrawerMessages)
  const te = useT(externalMessages)
  const tc = useT(commonMessages)
  const [number, setNumber] = useState('')
  const [amount, setAmount] = useState(
    delivery != null && delivery.agreedTotalUah > 0
      ? String(delivery.agreedTotalUah)
      : '',
  )
  const [carrierAmount, setCarrierAmount] = useState(false)
  const [amountVisible, setAmountVisible] = useState(false)
  const [phase, setPhase] = useState<Phase>('entry')
  const [preview, setPreview] = useState<ExternalShipmentPreview | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      mounted.current = false
      window.cancelAnimationFrame(frame)
    }
  }, [])
  const digits = number.replace(/\D/g, '')
  const agreedTotal = parseAgreedTotal(amount, { allowZero: true })
  const busy = phase === 'checking' || phase === 'confirming'
  const valid =
    digits.length === 14 && (amount.trim() === '' || agreedTotal !== null)
  const fail = (message: string) => {
    setError(message)
    window.requestAnimationFrame(() => alertRef.current?.focus())
  }
  const problemMessage = (problem: unknown) =>
    isProblemCode(problem, 'shipment_amount_required')
      ? te('amountRequired')
      : isProblemCode(problem, 'shipment_cod_mismatch')
        ? te('codMismatch')
        : isProblemCode(problem, 'shipment_payment_currency_mismatch')
          ? te('currencyMismatch')
          : isProblemCode(problem, 'shipment_identity_unverified')
            ? te('identityIncomplete')
            : deliveryProblemMessage(problem, locale)
  const invalidate = () => {
    setPreview(null)
    setPhase('entry')
    setChanged(false)
    setFieldError(null)
    setError(null)
  }
  const check = async (stale = false) => {
    if (!valid || (pending.current && !stale)) return
    pending.current = true
    setPhase('checking')
    setFieldError(null)
    setError(null)
    try {
      const next = await shippingApi.previewExternal(
        integrationId,
        orderId,
        digits,
        agreedTotal,
      )
      if (!mounted.current) return
      setAmountVisible(true)
      if (amount.trim() === '') {
        setAmount(String(next.agreedTotalUah))
        setCarrierAmount(true)
      }
      setPreview(next)
      setChanged(stale)
      setPhase('preview')
    } catch (problem) {
      if (!mounted.current) return
      setPreview(null)
      setChanged(false)
      setPhase('entry')
      const normalized = normalizeApiProblem(problem)
      if (
        isProblemCode(problem, 'shipment_amount_required') ||
        isProblemCode(problem, 'shipment_cod_mismatch')
      )
        setAmountVisible(true)
      if (
        normalized.status === 404 ||
        normalized.kind === 'not-found' ||
        isProblemCode(problem, 'nova_poshta_notfound')
      )
        setFieldError(t('notFound'))
      else if (isProblemCode(problem, 'shipment_already_linked'))
        setFieldError(t('alreadyLinked'))
      else {
        fail(problemMessage(problem))
        return
      }
      window.requestAnimationFrame(() => inputRef.current?.focus())
    } finally {
      pending.current = false
    }
  }
  const confirm = async () => {
    if (preview === null || pending.current) return
    pending.current = true
    setPhase('confirming')
    setError(null)
    try {
      const attached = await shippingApi.confirmExternal(
        integrationId,
        orderId,
        preview,
      )
      if (mounted.current) onAttached(attached)
    } catch (problem) {
      if (!mounted.current) return
      if (isProblemCode(problem, 'shipment_preview_stale')) {
        await check(true)
        return
      }
      setPhase('preview')
      fail(problemMessage(problem))
    } finally {
      pending.current = false
    }
  }
  const incomplete = preview !== null && previewIncomplete(preview)
  const codMismatch =
    delivery !== null &&
    preview?.codAmountUah != null &&
    !preview.recordsReceipt &&
    preview.codAmountUah !==
      Math.max(
        0,
        Math.round((preview.agreedTotalUah - delivery.appliedUah) * 100) / 100,
      )
  const blockedWhy = incomplete
    ? t('incompleteWhy')
    : codMismatch
      ? te('codMismatch')
      : undefined
  const showPreview = preview !== null && phase !== 'entry'
  const recipient =
    preview === null
      ? null
      : withKnownNames(
          preview.recipient,
          shipment === null ? null : shipmentRecipient(shipment),
        )
  const sender =
    preview === null ? null : withKnownNames(preview.sender, shipment?.sender)
  const details = preview?.importedDetails
  const parcels = importedParcelLine(details ?? null, locale)
  return (
    <Sheet
      open
      title={td('attachTitle')}
      description={t('attachDescription', { number: String(orderNumber) })}
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {tc('cancel')}
          </Button>
          {showPreview ? (
            <Button
              aria-busy={phase === 'confirming'}
              disabled={busy || blockedWhy !== undefined}
              title={blockedWhy}
              onClick={() => void confirm()}
              variant="primary"
            >
              {td('attachSubmit')}
            </Button>
          ) : (
            <Button
              aria-busy={phase === 'checking'}
              disabled={busy || !valid}
              onClick={() => void check()}
              variant="primary"
            >
              {phase === 'checking' ? t('checking') : t('attachCheck')}
            </Button>
          )}
        </>
      }
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
      <Field
        error={fieldError ?? undefined}
        hint={td('attachHint')}
        label={td('attachNumber')}
        required
      >
        <TextInput
          className="h-12 font-mono text-page tabular-nums"
          inputMode="numeric"
          disabled={busy}
          ref={inputRef}
          value={number}
          placeholder="20451931 5540"
          onChange={(event) => {
            setNumber(event.target.value)
            setAmountVisible(false)
            if (carrierAmount || agreedTotal === null) {
              setAmount('')
              setCarrierAmount(false)
            }
            invalidate()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !busy && !showPreview && valid) {
              event.preventDefault()
              void check()
            }
          }}
        />
      </Field>
      {amountVisible ? (
        <Field
          label={td('goodsLabel')}
          hint={te('amountHint')}
          required
          error={
            amount !== '' && agreedTotal === null
              ? te('amountError')
              : undefined
          }
        >
          <TextInput
            className="font-mono text-left"
            dir="ltr"
            inputMode="decimal"
            value={amount}
            disabled={busy}
            onChange={(event) => {
              setAmount(event.target.value)
              setCarrierAmount(false)
              invalidate()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy && !showPreview && valid) {
                event.preventDefault()
                void check()
              }
            }}
          />
        </Field>
      ) : null}
      {showPreview &&
      preview !== null &&
      recipient !== null &&
      sender !== null ? (
        <>
          <SheetGroup title={t('previewGroup')}>
            <SummaryList
              rows={[
                {
                  label: t('factSender'),
                  value: contactLine(sender) || te('unknown'),
                },
                {
                  label: t('groupRecipient'),
                  value: contactLine(recipient) || te('unknown'),
                },
                { label: t('factRoute'), value: routeLine(sender, recipient) },
                {
                  label: te('provider'),
                  value: /^\d+$/.test(preview.providerStatus)
                    ? (trackingSignal(
                        'Created',
                        preview.providerStatus,
                        null,
                        locale,
                      )?.label ?? te('unknown'))
                    : preview.providerStatus || te('unknown'),
                },
                { label: te('parcels'), value: parcels },
                {
                  label: te('declared'),
                  value:
                    details?.declaredValueUah == null
                      ? te('unknown')
                      : uah(details.declaredValueUah, locale),
                },
                {
                  label: te('amount'),
                  value: uah(preview.agreedTotalUah, locale),
                },
                {
                  label: t('groupCod'),
                  value:
                    preview.codAmountUah === null
                      ? te('unknown')
                      : uah(preview.codAmountUah, locale),
                },
                { label: t('previewState'), value: t(stateKey(preview)) },
              ]}
            />
          </SheetGroup>
          {blockedWhy === undefined ? null : (
            <Notice tone="danger">{blockedWhy}</Notice>
          )}
          <Notice tone="info">
            {preview.recordsReceipt
              ? t('effectReceived')
              : preview.recordsDispatch
                ? t('effectSent')
                : t('effectNotSent')}
          </Notice>
        </>
      ) : amountVisible ? (
        <Notice tone="info">{te('review')}</Notice>
      ) : null}
    </Sheet>
  )
}
