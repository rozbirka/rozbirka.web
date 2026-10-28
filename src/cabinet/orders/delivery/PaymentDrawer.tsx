import { useEffect, useRef, useState } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import { cn } from '@/lib/utils'
import { cashApi, type CashRegister, type CashTransaction } from '@/api/cash'
import type {
  DeliveryOrder,
  DeliveryPaymentKind,
  LinkDeliveryPayment,
  RecordDeliveryPayment,
} from '@/api/delivery'
import { normalizeApiProblem } from '@/api/errors'
import { commonMessages, useFormat, useLocale, useT, type Locale } from '@/i18n'
import {
  hryvnia,
  linkableTransactions,
  linkedGross,
  paymentOutcome,
  uah,
} from './delivery-money'
import { deliveryDrawerMessages } from './drawer-messages'
import { deliveryFlowMessages } from './flow-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'

type Mode = 'record' | 'link'

const FORM_ID = 'delivery-payment-form'

// Secondary text here stays at the muted step, never the dim one: the sheet
// sits on the lighter overlay surface, where dim measures just under 4.5:1.

const stampOptions: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}

/**
 * How a sum is offered for editing: two decimals with the interface
 * language's separator (a comma in Ukrainian and Polish). `hryvnia()` reads
 * either separator back.
 */
const editable = (value: number, locale: Locale) =>
  value.toFixed(2).replace('.', locale === 'en-GB' ? '.' : ',')

/** The hryvnia a till holds, or nothing when the module never named one. */
const held = (register: CashRegister, locale: Locale): string => {
  const value = register.balances['UAH']
  return value === undefined ? '—' : uah(value, locale)
}

/**
 * Money against a delivery order, in the two shapes Core accepts: a payment
 * recorded into a till, or a receipt already sitting in one. They look alike
 * and their arithmetic is opposite — a recorded gross loses the fee on the way
 * to the till, a linked receipt gains it on the way to the order — so each tab
 * says which way its own number moves.
 *
 * Opened for the carrier's post-payment (module 46, 9.8) it books the money
 * as `cod` against the waybill and says where the operation will show up. A
 * failed save keeps what was typed and says so at the top (9.9).
 */
export function PaymentDrawer({
  codWaybill = null,
  delivery,
  mode: initialMode,
  onClose,
  onCloseAutoFocus,
  onLink,
  onRecord,
  orderNumber,
}: {
  /** The waybill whose post-payment this records; null for a prepayment. */
  codWaybill?: string | null
  delivery: DeliveryOrder
  mode: Mode
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  onClose: () => void
  onLink: (input: LinkDeliveryPayment) => Promise<void>
  onRecord: (input: RecordDeliveryPayment) => Promise<void>
  orderNumber: number
}) {
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tf = useT(deliveryFlowMessages)
  const tc = useT(commonMessages)
  const format = useFormat()
  const kind: DeliveryPaymentKind = codWaybill === null ? 'prepayment' : 'cod'
  const alertRef = useRef<HTMLDivElement | null>(null)
  const when = (value: string) => format.dateWith(value, stampOptions) ?? value
  const [mode, setMode] = useState<Mode>(initialMode)
  const [registers, setRegisters] = useState<CashRegister[] | null>(null)
  const [registerId, setRegisterId] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<{
    registerId: string
    items: CashTransaction[]
  } | null>(null)
  const [receiptsError, setReceiptsError] = useState(false)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [amountDraft, setAmountDraft] = useState(
    delivery.outstandingUah > 0 ? String(delivery.outstandingUah) : '',
  )
  const [feeDraft, setFeeDraft] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void cashApi.list(true, { signal: controller.signal }).then(
      (list) => {
        if (controller.signal.aborted) return
        setRegisters(list)
        setRegisterId((current) => current ?? list[0]?.id ?? null)
      },
      () => {
        if (!controller.signal.aborted) setRegisters([])
      },
    )
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (mode !== 'link' || registerId === null) return
    const controller = new AbortController()
    void cashApi
      .transactions(
        registerId,
        { currency: 'UAH', pageSize: 20 },
        { signal: controller.signal },
      )
      .then(
        (page) => {
          if (controller.signal.aborted) return
          setReceipts({
            registerId,
            items: linkableTransactions(page.items),
          })
          setReceiptsError(false)
        },
        () => {
          if (!controller.signal.aborted) setReceiptsError(true)
        },
      )
    return () => controller.abort()
  }, [mode, registerId])

  const fee = hryvnia(feeDraft, { allowZero: true })
  const amount = hryvnia(amountDraft)
  const options = receipts?.registerId === registerId ? receipts.items : []
  const receipt = options.find((item) => item.id === receiptId) ?? null
  const gross =
    mode === 'record'
      ? (amount ?? 0)
      : receipt === null
        ? 0
        : linkedGross(receipt.amount, fee ?? 0)
  const outcome = paymentOutcome(gross, delivery.outstandingUah)
  const outcomeTitle = outcome.over
    ? t('outcomeOverTitle')
    : outcome.remaining === 0
      ? t('outcomeClosedTitle')
      : t('outcomeLeftTitle')
  const outcomeNote = outcome.over
    ? t('outcomeOverNote')
    : outcome.remaining === 0
      ? t('outcomeClosedNote')
      : t('outcomeLeftNote')

  const fail = (message: string) => {
    setError(message)
    window.requestAnimationFrame(() => alertRef.current?.focus())
  }

  const submit = async () => {
    if (pending) return
    if (fee === null) {
      fail(t('feeError'))
      return
    }
    if (mode === 'record') {
      if (amount === null) {
        fail(t('amountError'))
        return
      }
      if (fee >= amount) {
        fail(t('feeTooHigh'))
        return
      }
    }
    if (mode === 'link' && receipt === null) {
      fail(t('pickReceipt'))
      return
    }
    if (outcome.over) {
      fail(outcomeNote)
      return
    }
    if (registerId === null) {
      fail(t('pickTill'))
      return
    }
    setPending(true)
    setError(null)
    try {
      if (mode === 'record' && amount !== null)
        await onRecord({
          accountId: registerId,
          amountUah: amount,
          feeUah: fee,
          kind,
        })
      if (mode === 'link' && receipt !== null)
        await onLink({
          cashTransactionId: receipt.id,
          feeUah: fee,
          kind,
        })
      onClose()
    } catch (problem) {
      const failure = normalizeApiProblem(problem).kind
      fail(
        failure === 'network' || failure === 'timeout' || failure === 'server'
          ? tf('paymentSaveFailed')
          : deliveryProblemMessage(problem, locale),
      )
      setPending(false)
    }
  }

  const registerName =
    registers?.find((item) => item.id === registerId)?.name ?? '—'
  const suggested = delivery.outstandingUah > 0 ? delivery.outstandingUah : null

  return (
    <Sheet
      {...(codWaybill === null
        ? {
            eyebrow: t('eyebrowOrder', {
              number: String(orderNumber),
              part: t('partPayment'),
            }),
          }
        : {
            description: tf('codDescription', {
              number: String(orderNumber),
              waybill: codWaybill,
            }),
          })}
      footer={
        <>
          <p className="rz-muted m-0 min-w-0 flex-1 truncate">
            {codWaybill !== null
              ? tf('codFooter')
              : mode === 'record'
                ? t('tillFooter', { name: registerName })
                : t('linkFooter')}
          </p>
          <Button disabled={pending} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending || outcome.over}
            form={FORM_ID}
            type="submit"
            variant="primary"
          >
            {/* Not the tab's own words: two buttons in one dialog must not
                answer to the same name. */}
            {mode === 'link'
              ? t('saveLink')
              : codWaybill !== null && amount !== null
                ? tf('codSubmit', { amount: uah(amount, locale) })
                : t('savePayment')}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      title={mode === 'record' ? t('recordPayment') : t('linkTransaction')}
    >
      {error === null ? null : (
        <div className="mb-4" ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <form
        className="grid gap-4"
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="grid gap-2">
          <div
            aria-label={t('paymentMethod')}
            className="rz-seg flex w-full"
            role="group"
          >
            {(
              [
                ['record', t('recordPayment')],
                ['link', t('linkTransaction')],
              ] as const
            ).map(([value, label]) => (
              <button
                aria-pressed={mode === value}
                className="flex-1 justify-center"
                key={value}
                onClick={() => {
                  setMode(value)
                  setError(null)
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="rz-caption m-0 text-pretty">
            {mode === 'record' ? t('recordExplained') : t('linkExplained')}
          </p>
        </div>

        {registers !== null && registers.length === 0 && (
          <Notice tone="warn">{t('noTills')}</Notice>
        )}

        {registers !== null && registers.length > 0 && (
          <fieldset className="m-0 grid min-h-fit gap-2 border-0 p-0">
            <legend className="rz-label mb-2 p-0">
              {mode === 'record' ? t('recordInto') : t('receiptTill')}
            </legend>
            <div className="border-app-line grid overflow-hidden rounded-rz-md border bg-(--rz-sheet-field)">
              {registers.map((register) => {
                const chosen = (registerId ?? registers[0]!.id) === register.id
                return (
                  <label
                    className={cn(
                      'border-app-line flex min-h-11 cursor-pointer items-center gap-3 border-t px-3 py-2 first:border-t-0',
                      chosen
                        ? 'bg-(--rz-row-selected) shadow-[inset_2px_0_0_var(--rz-brand)]'
                        : 'hover:bg-app-hover',
                    )}
                    key={register.id}
                  >
                    <input
                      checked={chosen}
                      className="rz-radio shrink-0"
                      name="delivery-payment-register"
                      onChange={() => {
                        setRegisterId(register.id)
                        setReceiptId(null)
                      }}
                      type="radio"
                      value={register.id}
                    />
                    <span className="rz-strong min-w-0 flex-1 truncate font-semibold">
                      {register.name}
                    </span>
                    <span className="rz-strong font-mono whitespace-nowrap tabular-nums">
                      {held(register, locale)}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        {mode === 'record' ? (
          <>
            <Field label={t('grossAmount')}>
              <TextInput
                className="h-12 text-page"
                inputMode="decimal"
                numeric
                onChange={(event) => setAmountDraft(event.target.value)}
                placeholder="0,00"
                value={amountDraft}
              />
            </Field>

            {suggested === null ? null : (
              <div className="-mt-2 flex flex-wrap gap-1.5">
                <Preset
                  onPick={() => setAmountDraft(editable(suggested, locale))}
                >
                  {t('wholeBalance', { amount: uah(suggested, locale) })}
                </Preset>
                <Preset
                  onPick={() => setAmountDraft(editable(suggested / 2, locale))}
                >
                  {t('half')}
                </Preset>
              </div>
            )}

            <Field
              hint={
                fee !== null && fee > 0 && amount !== null && fee < amount
                  ? t('tillReceives', { amount: uah(amount - fee, locale) })
                  : t('noFee')
              }
              label={t('tillFee')}
            >
              <TextInput
                inputMode="decimal"
                numeric
                onChange={(event) => setFeeDraft(event.target.value)}
                value={feeDraft}
              />
            </Field>
          </>
        ) : (
          <>
            <fieldset className="m-0 grid min-h-fit gap-2 border-0 p-0">
              <legend className="rz-label mb-2 p-0">{t('receipts')}</legend>
              {receiptsError ? (
                <Notice tone="danger">{t('receiptsFailed')}</Notice>
              ) : options.length === 0 ? (
                <p className="rz-inset text-app-muted m-0 text-pretty">
                  {t('noReceipts')}
                </p>
              ) : (
                options.map((item) => {
                  const chosen = item.id === receiptId
                  return (
                    <button
                      aria-pressed={chosen}
                      className={cn(
                        'border-app-line flex min-h-11 w-full items-center gap-3 rounded-rz-md border bg-(--rz-sheet-field) px-3 py-2 text-left',
                        chosen &&
                          'border-brand bg-(--rz-row-selected) shadow-[inset_2px_0_0_var(--rz-brand)]',
                      )}
                      key={item.id}
                      onClick={() => setReceiptId(item.id)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="rz-strong block truncate font-medium">
                          {item.note ?? t('receiptNoNote')}
                        </span>
                        <span className="rz-dim block font-mono text-micro">
                          {when(item.createdAt)} · {item.createdByName}
                        </span>
                      </span>
                      <span className="rz-mono rz-strong whitespace-nowrap">
                        {uah(item.amount, locale)}
                      </span>
                    </button>
                  )
                })
              )}
              <p className="rz-caption m-0 text-pretty">
                {t('receiptsExplained')}
              </p>
            </fieldset>

            <Field
              hint={
                receipt === null
                  ? t('linkHint')
                  : t('linkCredited', { amount: uah(gross, locale) })
              }
              label={t('transactionFee')}
            >
              <TextInput
                inputMode="decimal"
                numeric
                onChange={(event) => setFeeDraft(event.target.value)}
                value={feeDraft}
              />
            </Field>
          </>
        )}

        <dl className="rz-inset m-0 grid min-h-fit grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2">
          <dt className="text-app-muted">{t('agreed')}</dt>
          <dd className="rz-num m-0">{uah(delivery.agreedTotalUah, locale)}</dd>
          <dt className="text-app-muted">{t('due')}</dt>
          <dd className="rz-num m-0">{uah(delivery.outstandingUah, locale)}</dd>
          <dt className="text-app-muted">{t('thisPayment')}</dt>
          <dd className={cn('rz-num m-0', gross > 0 ? 'rz-strong' : 'rz-dim')}>
            {gross > 0 ? uah(gross, locale) : '—'}
          </dd>
          <span aria-hidden className="bg-app-line col-span-2 h-px" />
          <dt className="rz-strong font-semibold">
            {outcome.over ? t('overpayment') : t('remaining')}
          </dt>
          <dd
            className={cn(
              'rz-num m-0 font-semibold',
              outcome.over
                ? 'text-state-danger'
                : gross === 0
                  ? 'text-app-muted'
                  : 'text-app-strong',
            )}
          >
            {outcome.over
              ? uah(gross - delivery.outstandingUah, locale)
              : uah(outcome.remaining, locale)}
          </dd>
          <p className="col-span-2 m-0 grid gap-0.5 text-caption text-pretty">
            <span
              className={cn(
                'font-semibold',
                outcome.over
                  ? 'text-state-danger'
                  : outcome.remaining === 0
                    ? 'text-state-ok'
                    : 'text-state-warn',
              )}
            >
              {outcomeTitle}
            </span>
            <span className="text-app-muted">{outcomeNote}</span>
          </p>
        </dl>
      </form>
    </Sheet>
  )
}

function Preset({
  children,
  onPick,
}: {
  children: string
  onPick: () => void
}) {
  return (
    <Button
      className="relative after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']"
      onClick={onPick}
      size="sm"
    >
      {children}
    </Button>
  )
}
