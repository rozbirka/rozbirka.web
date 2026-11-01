import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Field,
  Notice,
  SelectInput,
  Sheet,
  TextArea,
  TextInput,
} from '@/components/app'
import { cashApi, type CashRegister, type CashTransaction } from '@/api/cash'
import type { DeliveryRefundSource, LateCarrierPayment } from '@/api/delivery'
import { normalizeApiProblem } from '@/api/errors'
import type { Shipment } from '@/api/shipping'
import { commonMessages, useFormat, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { SheetGroup } from '../sheet-group'
import { hryvnia, linkableTransactions, uah } from './delivery-money'
import { deliveryFlowMessages } from './flow-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'

type Mode = 'record' | 'link'

/**
 * «Зафіксувати надходження» / «Прив’язати операцію» (10.16): a post-payment
 * the carrier paid out after the order was cancelled. Core books it as a new
 * receipt or ties one already in a till, and then the money is owed back. A
 * payout that differs from the waybill's post-payment, carries a fee or came
 * through manual reconciliation needs the basis written down.
 */
export function LatePaymentSheet({
  mode: initialMode,
  onClose,
  onCloseAutoFocus,
  onConfirm,
  orderNumber,
  shipment,
}: {
  mode: Mode
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  onConfirm: (
    payment: LateCarrierPayment & DeliveryRefundSource,
  ) => Promise<void>
  orderNumber: number
  shipment: Shipment
}) {
  const { locale } = useLocale()
  const format = useFormat()
  const t = useT(deliveryFlowMessages)
  const tc = useT(commonMessages)
  const expected = shipment.codUah ?? 0
  const [mode, setMode] = useState<Mode>(initialMode)
  const [tills, setTills] = useState<CashRegister[] | null>(null)
  const [tillId, setTillId] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<{
    tillId: string
    items: CashTransaction[]
  } | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [amountDraft, setAmountDraft] = useState(
    expected > 0 ? String(expected) : '',
  )
  const [feeDraft, setFeeDraft] = useState('0')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const reasonRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void cashApi.list(true, { signal: controller.signal }).then(
      (list) => {
        if (controller.signal.aborted) return
        setTills(list)
        setTillId((current) => current ?? list[0]?.id ?? null)
      },
      () => {
        if (!controller.signal.aborted) setTills([])
      },
    )
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (mode !== 'link' || tillId === null) return
    const controller = new AbortController()
    void cashApi
      .transactions(
        tillId,
        { currency: 'UAH', pageSize: 50 },
        { signal: controller.signal },
      )
      .then(
        (page) => {
          if (!controller.signal.aborted)
            setReceipts({ tillId, items: linkableTransactions(page.items) })
        },
        () => {
          if (!controller.signal.aborted) setReceipts({ tillId, items: [] })
        },
      )
    return () => controller.abort()
  }, [mode, tillId])

  const amount = hryvnia(amountDraft)
  const fee = hryvnia(feeDraft, { allowZero: true })
  const feeError =
    amount !== null && fee !== null && fee >= amount
      ? t('lateFeeInvalid')
      : null
  // Core's own rule: a different sum, a fee or a manual reconciliation each
  // need a written basis.
  const reasonNeeded =
    shipment.paymentState === 'NeedsReconciliation' ||
    amount !== expected ||
    (fee ?? 0) !== 0
  const options = (receipts?.tillId === tillId ? receipts.items : []).filter(
    (item) => amount === null || item.amount + (fee ?? 0) === amount,
  )
  const receipt = options.find((item) => item.id === receiptId) ?? null

  const submit = async () => {
    if (pending || amount === null || fee === null || feeError !== null) return
    if (reasonNeeded && reason.trim() === '') {
      setReasonError(true)
      reasonRef.current?.focus()
      return
    }
    if (mode === 'record' ? tillId === null : receipt === null) return
    setPending(true)
    setError(null)
    const base: LateCarrierPayment = {
      shipmentId: shipment.id,
      amountUah: amount,
      feeUah: fee,
      ...(reason.trim() === '' ? {} : { verificationNote: reason.trim() }),
    }
    try {
      await onConfirm(
        mode === 'record'
          ? { ...base, accountId: tillId! }
          : { ...base, existingCashTransactionId: receipt!.id },
      )
    } catch (problem) {
      const kind = normalizeApiProblem(problem).kind
      setError(
        kind === 'network' || kind === 'timeout'
          ? t('saveFailed')
          : deliveryProblemMessage(problem, locale),
      )
      setPending(false)
      window.requestAnimationFrame(() => alertRef.current?.focus())
    }
  }

  const blocked =
    pending ||
    amount === null ||
    fee === null ||
    feeError !== null ||
    (mode === 'record' ? tillId === null : receipt === null)

  return (
    <Sheet
      description={t('lateDescription', {
        number: String(orderNumber),
        waybill: shipment.number ?? '—',
      })}
      footer={
        <>
          <span className="min-w-0 flex-1" />
          <Button disabled={pending} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={blocked}
            onClick={() => void submit()}
            variant="primary"
          >
            {pending
              ? tc('saving')
              : mode === 'record'
                ? t('lateRecord')
                : t('lateLink')}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      title={mode === 'record' ? t('lateRecord') : t('lateLink')}
    >
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <SheetGroup title={t('method')}>
        <div
          aria-label={t('method')}
          className="rz-seg flex w-full"
          role="group"
        >
          {(
            [
              ['record', t('methodCreate')],
              ['link', t('methodLink')],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={mode === value}
              className="flex-1 justify-center"
              disabled={pending}
              key={value}
              onClick={() => setMode(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </SheetGroup>

      {tills !== null && tills.length === 0 ? (
        <Notice tone="warn">{t('noTills')}</Notice>
      ) : null}

      <SheetGroup>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            error={
              amountDraft !== '' && amount === null
                ? t('amountInvalid')
                : undefined
            }
            label={t('lateAmount')}
            required
          >
            <TextInput
              inputMode="decimal"
              numeric
              onChange={(event) => setAmountDraft(event.target.value)}
              readOnly={pending}
              value={amountDraft}
            />
          </Field>
          <Field
            error={fee === null ? t('amountInvalid') : (feeError ?? undefined)}
            label={t('lateFee')}
          >
            <TextInput
              inputMode="decimal"
              numeric
              onChange={(event) => setFeeDraft(event.target.value)}
              readOnly={pending}
              value={feeDraft}
            />
          </Field>
          <Field className="sm:col-span-2" label={t('tillLabel')} required>
            <SelectInput
              disabled={pending || tills === null || tills.length === 0}
              onChange={(event) => {
                setTillId(event.target.value)
                setReceiptId(null)
              }}
              value={tillId ?? ''}
            >
              {(tills ?? []).map((till) => (
                <option key={till.id} value={till.id}>
                  {t('tillOption', { name: till.name })}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </SheetGroup>

      {mode === 'link' ? (
        <SheetGroup title={t('lateReceipt')}>
          {options.length === 0 ? (
            <p className="rz-inset text-app-muted m-0 text-pretty">
              {t('lateNoReceipts')}
            </p>
          ) : (
            <div className="grid gap-1.5">
              {options.map((item) => {
                const chosen = item.id === receiptId
                return (
                  <button
                    aria-pressed={chosen}
                    className={cn(
                      'border-app-line flex min-h-11 w-full items-center gap-3 rounded-rz-md border bg-(--rz-sheet-field) px-3 py-2 text-left',
                      chosen &&
                        'border-brand bg-(--rz-row-selected) shadow-[inset_2px_0_0_var(--rz-brand)]',
                    )}
                    disabled={pending}
                    key={item.id}
                    onClick={() => setReceiptId(item.id)}
                    type="button"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="rz-strong block truncate font-medium">
                        {item.note ?? item.id}
                      </span>
                      <span className="text-app-muted block font-mono text-micro">
                        {format.date(item.createdAt) ?? item.createdAt} ·{' '}
                        {item.createdByName}
                      </span>
                    </span>
                    <span className="rz-mono rz-strong whitespace-nowrap">
                      {uah(item.amount, locale)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </SheetGroup>
      ) : null}

      <SheetGroup>
        <Field
          error={reasonError ? t('lateReasonRequired') : undefined}
          hint={t('lateReasonHint', { amount: uah(expected, locale) })}
          label={t('lateReason')}
          required={reasonNeeded}
        >
          <TextArea
            onChange={(event) => {
              setReason(event.target.value)
              setReasonError(false)
            }}
            readOnly={pending}
            ref={reasonRef}
            rows={3}
            value={reason}
          />
        </Field>
      </SheetGroup>
    </Sheet>
  )
}
