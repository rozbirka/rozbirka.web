import { useEffect, useState } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import { cn } from '@/lib/utils'
import { cashApi, type CashRegister, type CashTransaction } from '@/api/cash'
import type {
  DeliveryOrder,
  LinkDeliveryPayment,
  RecordDeliveryPayment,
} from '@/api/delivery'
import { normalizeApiProblem } from '@/api/errors'
import {
  hryvnia,
  linkableTransactions,
  linkedGross,
  paymentOutcome,
  uah,
} from './delivery-money'

type Mode = 'record' | 'link'

const FORM_ID = 'delivery-payment-form'

// Secondary text here stays at the muted step, never the dim one: the sheet
// sits on the lighter overlay surface, where dim measures just under 4.5:1.

const when = (value: string) =>
  new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const balances = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })

/** How a sum is offered for editing: Ukrainian decimals use a comma. */
const editable = (value: number) => value.toFixed(2).replace('.', ',')

/** The hryvnia a till holds, or nothing when the module never named one. */
const held = (register: CashRegister): string => {
  const value = register.balances['UAH']
  return value === undefined ? '—' : `${balances.format(value)} ₴`
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

  const submit = async () => {
    if (pending) return
    if (fee === null) {
      setError('Комісія має бути числом у гривнях, не більше двох знаків.')
      return
    }
    if (mode === 'record') {
      if (amount === null) {
        setError('Вкажіть суму в гривнях, не більше двох знаків після коми.')
        return
      }
      if (fee >= amount) {
        setError(
          'Комісія не може дорівнювати сумі платежу або перевищувати її.',
        )
        return
      }
    }
    if (mode === 'link' && receipt === null) {
      setError('Виберіть надходження зі списку каси.')
      return
    }
    if (outcome.over) {
      setError(outcome.note)
      return
    }
    if (registerId === null) {
      setError('Виберіть касу.')
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
      setError(normalizeApiProblem(problem).message)
      setPending(false)
    }
  }

  const registerName =
    registers?.find((item) => item.id === registerId)?.name ?? '—'
  const suggested = delivery.outstandingUah > 0 ? delivery.outstandingUah : null

  return (
    <Sheet
      eyebrow={`Замовлення #${String(orderNumber)} · оплата`}
      footer={
        <>
          <p className="text-app-muted min-w-0 flex-1 truncate text-[13px]">
            {mode === 'record'
              ? `Каса: ${registerName}`
              : 'Прив’язка не створює платіж у касі'}
          </p>
          <Button disabled={pending} onClick={onClose}>
            Скасувати
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
            {mode === 'record' ? 'Зберегти платіж' : 'Зберегти прив’язку'}
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      size="lg"
      title={mode === 'record' ? 'Внести оплату' : 'Прив’язати транзакцію'}
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
            aria-label="Спосіб оплати"
            className="border-app-line bg-app-input grid grid-cols-2 gap-1 rounded-[12px] border p-1"
            role="group"
          >
            {(
              [
                ['record', 'Внести оплату'],
                ['link', 'Прив’язати транзакцію'],
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
            {mode === 'record'
              ? 'Брутто зменшує залишок за замовленням, у касу надходить брутто мінус комісія.'
              : 'Платіж не створюється: замовленню зараховується сума транзакції плюс комісія.'}
          </p>
        </div>

        {registers !== null && registers.length === 0 && (
          <Notice tone="warn">
            У розбірці немає активної каси. Створіть касу, щоб приймати оплату.
          </Notice>
        )}

        {registers !== null && registers.length > 0 && (
          <fieldset className="grid gap-2">
            <legend className="text-app-ink mb-2 text-[13px] font-bold">
              {mode === 'record' ? 'Куди зараховуємо' : 'Каса надходження'}
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
                    {held(register)}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}

        {mode === 'record' ? (
          <>
            <Field label="Сума, брутто">
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
                <Preset onPick={() => setAmountDraft(editable(suggested))}>
                  {`Увесь залишок · ${uah(suggested)}`}
                </Preset>
                <Preset onPick={() => setAmountDraft(editable(suggested / 2))}>
                  Половина
                </Preset>
              </div>
            )}

            <Field
              hint={
                fee !== null && fee > 0 && amount !== null && fee < amount
                  ? `У касу надійде ${uah(amount - fee)}.`
                  : 'Комісії немає.'
              }
              label="Комісія каси"
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
                Надходження
              </legend>
              {receiptsError ? (
                <Notice tone="danger">
                  Не вдалося прочитати надходження каси.
                </Notice>
              ) : options.length === 0 ? (
                <p className="text-app-muted border-app-line bg-app-input rounded-[11px] border px-3.5 py-3.5 text-[13px] leading-5 text-pretty">
                  У цій касі немає вільних надходжень. Виберіть іншу касу або
                  внесіть оплату на вкладці «Внести оплату».
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
                          {item.note ?? 'Надходження без призначення'}
                        </span>
                        <span className="text-app-muted mt-0.5 block font-mono text-[11.5px]">
                          {when(item.createdAt)} · {item.createdByName}
                        </span>
                      </span>
                      <span className="text-app-ink font-mono text-[14px] whitespace-nowrap tabular-nums">
                        {uah(item.amount)}
                      </span>
                    </button>
                  )
                })
              )}
              <p className="text-app-muted text-[12px] leading-5 text-pretty">
                Показані вхідні гривневі надходження цієї каси, які ще не
                віднесені до жодного замовлення.
              </p>
            </fieldset>

            <Field
              hint={
                receipt === null
                  ? 'Замовленню зараховується сума транзакції плюс комісія — тут формула протилежна до внесення платежу.'
                  : `Замовленню зарахується ${uah(gross)}.`
              }
              label="Комісія транзакції"
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
          <dt className="text-app-muted">Сума замовлення</dt>
          <dd className="text-right font-mono tabular-nums">
            {uah(delivery.agreedTotalUah)}
          </dd>
          <dt className="text-app-muted">До сплати</dt>
          <dd className="text-right font-mono tabular-nums">
            {uah(delivery.outstandingUah)}
          </dd>
          <dt className="text-app-muted">Цей платіж</dt>
          <dd
            className={cn(
              'text-right font-mono tabular-nums',
              gross > 0 ? 'text-state-ok' : 'text-app-dim',
            )}
          >
            {gross > 0 ? uah(gross) : '—'}
          </dd>
          <span aria-hidden className="bg-app-line col-span-2 h-px" />
          <dt className="font-bold">
            {outcome.over ? 'Переплата' : 'Залишиться'}
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
              ? uah(gross - delivery.outstandingUah)
              : uah(outcome.remaining)}
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
              {outcome.title}
            </span>
            <span className="text-app-muted leading-5">{outcome.note}</span>
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
