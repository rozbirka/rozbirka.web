import { useEffect, useState } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import { cn } from '@/lib/utils'
import { cashApi, type CashRegister, type CashTransaction } from '@/api/cash'
import type {
  DeliveryOrder,
  LinkDeliveryPayment,
  RecordDeliveryPayment,
} from '@/api/delivery'
import { commonMessages, useFormat, useLocale, useT, type Locale } from '@/i18n'
import {
  hryvnia,
  linkableTransactions,
  linkedGross,
  paymentOutcome,
  uah,
} from './delivery-money'
import { deliveryDrawerMessages } from './drawer-messages'
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
 */
export function PaymentDrawer({
  delivery,
  mode: initialMode,
  onClose,
  onLink,
  onRecord,
  orderNumber,
}: {
  delivery: DeliveryOrder
  mode: Mode
  onClose: () => void
  onLink: (input: LinkDeliveryPayment) => Promise<void>
  onRecord: (input: RecordDeliveryPayment) => Promise<void>
  orderNumber: number
}) {
  const { locale } = useLocale()
  const t = useT(deliveryDrawerMessages)
  const tc = useT(commonMessages)
  const format = useFormat()
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

  const submit = async () => {
    if (pending) return
    if (fee === null) {
      setError(t('feeError'))
      return
    }
    if (mode === 'record') {
      if (amount === null) {
        setError(t('amountError'))
        return
      }
      if (fee >= amount) {
        setError(t('feeTooHigh'))
        return
      }
    }
    if (mode === 'link' && receipt === null) {
      setError(t('pickReceipt'))
      return
    }
    if (outcome.over) {
      setError(outcomeNote)
      return
    }
    if (registerId === null) {
      setError(t('pickTill'))
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
          kind: 'prepayment',
        })
      if (mode === 'link' && receipt !== null)
        await onLink({
          cashTransactionId: receipt.id,
          feeUah: fee,
          kind: 'prepayment',
        })
      onClose()
    } catch (problem) {
      setError(deliveryProblemMessage(problem, locale))
      setPending(false)
    }
  }

  const registerName =
    registers?.find((item) => item.id === registerId)?.name ?? '—'
  const suggested = delivery.outstandingUah > 0 ? delivery.outstandingUah : null

  return (
    <Sheet
      eyebrow={t('eyebrowOrder', {
        number: String(orderNumber),
        part: t('partPayment'),
      })}
      footer={
        <>
          <p className="text-app-muted min-w-0 flex-1 truncate text-[13px]">
            {mode === 'record'
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
            {mode === 'record' ? t('savePayment') : t('saveLink')}
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      title={mode === 'record' ? t('recordPayment') : t('linkTransaction')}
    >
      <form
        className="grid gap-5"
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
            className="border-app-line bg-app-input grid grid-cols-2 gap-1 rounded-[12px] border p-1"
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
                className={cn(
                  'flex h-11 items-center justify-center rounded-[9px] text-[14px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  mode === value
                    ? 'bg-white/[0.09] text-white'
                    : 'text-app-muted hover:bg-white/[0.04]',
                )}
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
          <p className="text-app-muted text-[12px] leading-5 text-pretty">
            {mode === 'record' ? t('recordExplained') : t('linkExplained')}
          </p>
        </div>

        {registers !== null && registers.length === 0 && (
          <Notice tone="warn">{t('noTills')}</Notice>
        )}

        {registers !== null && registers.length > 0 && (
          <fieldset className="grid gap-2">
            <legend className="text-app-ink mb-2 text-[13px] font-bold">
              {mode === 'record' ? t('recordInto') : t('receiptTill')}
            </legend>
            {registers.map((register) => {
              const chosen = (registerId ?? registers[0]!.id) === register.id
              return (
                <label
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-[11px] border px-3.5 py-3 transition-colors',
                    chosen
                      ? 'border-app-line-2 bg-white/[0.05]'
                      : 'border-app-line bg-app-input hover:border-app-line-2',
                  )}
                  key={register.id}
                >
                  <input
                    checked={chosen}
                    className="accent-brand size-4 shrink-0"
                    name="delivery-payment-register"
                    onChange={() => {
                      setRegisterId(register.id)
                      setReceiptId(null)
                    }}
                    type="radio"
                    value={register.id}
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
                    {register.name}
                  </span>
                  <span className="text-app-muted font-mono text-[12px] whitespace-nowrap tabular-nums">
                    {held(register, locale)}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}

        {mode === 'record' ? (
          <>
            <Field label={t('grossAmount')}>
              <TextInput
                className={cn(
                  'h-[52px] rounded-[12px] px-4 font-mono text-[22px] tabular-nums',
                  amount === null ? 'border-brand/55' : '',
                )}
                inputMode="decimal"
                onChange={(event) => setAmountDraft(event.target.value)}
                placeholder="0,00"
                value={amountDraft}
              />
            </Field>

            {suggested === null ? null : (
              <div className="-mt-3 flex flex-wrap gap-1.5">
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
                className="font-mono tabular-nums"
                inputMode="decimal"
                onChange={(event) => setFeeDraft(event.target.value)}
                value={feeDraft}
              />
            </Field>
          </>
        ) : (
          <>
            <fieldset className="grid gap-2">
              <legend className="text-app-ink mb-2 text-[13px] font-bold">
                {t('receipts')}
              </legend>
              {receiptsError ? (
                <Notice tone="danger">{t('receiptsFailed')}</Notice>
              ) : options.length === 0 ? (
                <p className="text-app-muted border-app-line bg-app-input rounded-[11px] border px-3.5 py-3.5 text-[13px] leading-5 text-pretty">
                  {t('noReceipts')}
                </p>
              ) : (
                options.map((item) => {
                  const chosen = item.id === receiptId
                  return (
                    <button
                      aria-pressed={chosen}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-[11px] border px-3.5 py-3 text-left transition-colors',
                        chosen
                          ? 'border-app-line-2 bg-white/[0.05]'
                          : 'border-app-line bg-app-input hover:border-app-line-2',
                      )}
                      key={item.id}
                      onClick={() => setReceiptId(item.id)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-white">
                          {item.note ?? t('receiptNoNote')}
                        </span>
                        <span className="text-app-muted mt-0.5 block font-mono text-[11.5px]">
                          {when(item.createdAt)} · {item.createdByName}
                        </span>
                      </span>
                      <span className="text-app-ink font-mono text-[14px] whitespace-nowrap tabular-nums">
                        {uah(item.amount, locale)}
                      </span>
                    </button>
                  )
                })
              )}
              <p className="text-app-muted text-[12px] leading-5 text-pretty">
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
                className="font-mono tabular-nums"
                inputMode="decimal"
                onChange={(event) => setFeeDraft(event.target.value)}
                value={feeDraft}
              />
            </Field>
          </>
        )}

        {error !== null && <Notice tone="danger">{error}</Notice>}

        <dl className="border-app-line bg-app-raised grid grid-cols-[1fr_auto] items-baseline gap-y-2.5 rounded-[14px] border px-[18px] py-4 text-[14px]">
          <dt className="text-app-muted">{t('agreed')}</dt>
          <dd className="text-right font-mono tabular-nums">
            {uah(delivery.agreedTotalUah, locale)}
          </dd>
          <dt className="text-app-muted">{t('due')}</dt>
          <dd className="text-right font-mono tabular-nums">
            {uah(delivery.outstandingUah, locale)}
          </dd>
          <dt className="text-app-muted">{t('thisPayment')}</dt>
          <dd
            className={cn(
              'text-right font-mono tabular-nums',
              gross > 0 ? 'text-state-ok' : 'text-app-dim',
            )}
          >
            {gross > 0 ? uah(gross, locale) : '—'}
          </dd>
          <span aria-hidden className="bg-app-line col-span-2 h-px" />
          <dt className="font-bold">
            {outcome.over ? t('overpayment') : t('remaining')}
          </dt>
          <dd
            className={cn(
              'text-right font-mono text-[16px] tabular-nums',
              outcome.over
                ? 'text-state-danger'
                : gross === 0
                  ? 'text-app-muted'
                  : outcome.remaining === 0
                    ? 'text-state-ok'
                    : 'text-white',
            )}
          >
            {outcome.over
              ? uah(gross - delivery.outstandingUah, locale)
              : uah(outcome.remaining, locale)}
          </dd>
          <p className="col-span-2 -mt-1 grid gap-0.5 text-[12px] text-pretty">
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
            <span className="text-app-muted leading-5">{outcomeNote}</span>
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
    <button
      className="border-app-line text-app-muted hover:text-app-ink relative h-[30px] rounded-full border px-3 text-[12px] font-semibold whitespace-nowrap transition-colors hover:border-white/24 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']"
      onClick={onPick}
      type="button"
    >
      {children}
    </button>
  )
}
