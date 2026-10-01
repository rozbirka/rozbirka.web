import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Field,
  Notice,
  Sheet,
  SkeletonRows,
  TextInput,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { cashApi, type CashRegister } from '@/api/cash'
import { normalizeApiProblem } from '@/api/errors'
import type { ConfirmPayment } from '@/api/orders'
import { money } from './order-money'

/** The order's own money. A payment in anything else is not subtracted from it. */
const ORDER_CURRENCY = 'USD'

/** Which currency a yard reads first when a till keeps more than one. */
const PREFERRED = ['USD', 'UAH']

/**
 * The equivalent the design asks the operator to type has nowhere to be
 * stored: `ConfirmPaymentRequest` carries one amount in one currency and
 * nothing else, and `OrderPayment` has no column for what a foreign payment is
 * worth to the order. Until Core gains one, the field is shown disabled rather
 * than taking a number that would be dropped on save.
 */
const EQUIVALENT_NOT_STORED =
  'Сервіс не зберігає еквівалент: платіж записується у валюті каси, а залишок за замовленням у доларах лишається незмінним.'

interface Till {
  key: string
  registerId: string
  name: string
  currency: string
  balance: number
}

const tills = (registers: readonly CashRegister[]): Till[] =>
  registers
    .filter((register) => register.isActive)
    .flatMap((register) =>
      Object.entries(register.balances).map(([currency, balance]) => ({
        key: `${register.id}:${currency}`,
        registerId: register.id,
        name: register.name,
        currency,
        balance,
      })),
    )

const rank = (currency: string) => {
  const index = PREFERRED.indexOf(currency)
  return index === -1 ? PREFERRED.length : index
}

const balances = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })

/** How a sum is offered for editing: Ukrainian decimals use a comma. */
const editable = (value: number) => value.toFixed(2).replace('.', ',')

const amount = (value: string) => {
  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * One payment at a time, against what the order still owes.
 *
 * Currency is chosen first, because it decides everything after it: which
 * tills can take the money, what the amount is counted in, and whether the
 * order's outstanding dollar balance moves at all.
 */
export function OrderPaymentDrawer({
  busy,
  error,
  existing,
  onOpenChange,
  onSave,
  open,
  orderNumber,
  outstanding,
}: {
  busy: boolean
  error: string | null
  /** Payments the order already holds; the save replaces the whole set. */
  existing: readonly ConfirmPayment[]
  onOpenChange: (open: boolean) => void
  onSave: (payments: ConfirmPayment[]) => void
  open: boolean
  orderNumber: number
  /** What is still owed in the order's own currency, when it can be known. */
  outstanding: number | null
}) {
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  // `null` means nobody has touched the field, so it still offers the
  // outstanding sum; an empty string is a field cleared on purpose.
  const [draft, setDraft] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void cashApi
      .list(true, { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) setRegisters(items)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(normalizeApiProblem(reason).message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [open])

  const options = useMemo(() => tills(registers), [registers])
  const currencies = useMemo(
    () =>
      [...new Set(options.map((option) => option.currency))].sort(
        (left, right) => rank(left) - rank(right) || left.localeCompare(right),
      ),
    [options],
  )
  const active = currency ?? currencies[0] ?? ORDER_CURRENCY
  const inCurrency = options.filter((option) => option.currency === active)
  const till =
    inCurrency.find((option) => option.key === selected) ?? inCurrency[0]

  const foreign = active !== ORDER_CURRENCY
  const suggested =
    !foreign && outstanding !== null && outstanding > 0 ? outstanding : null
  const value = draft ?? (suggested === null ? '' : editable(suggested))
  const paying = amount(value)
  const valid = till !== undefined && paying > 0

  // Only a payment in the order's own currency moves its balance: a hryvnia
  // receipt is real money in a real till, but nothing here can say what it is
  // worth in dollars.
  const credited = foreign ? 0 : paying
  const after = outstanding === null ? null : outstanding - credited
  const verdict = outcome(paying, foreign, after)

  return (
    <Sheet
      eyebrow={`Замовлення #${String(orderNumber)} · оплата`}
      footer={
        <>
          <p
            className={cn(
              'min-w-0 flex-1 truncate text-[13px]',
              valid ? 'text-app-muted' : 'text-app-dim',
            )}
          >
            {till === undefined
              ? 'Активних кас немає'
              : valid
                ? `${money(paying, active)} → ${till.name} · ${active}`
                : 'Вкажіть суму'}
          </p>
          <Button disabled={busy} onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !valid}
            onClick={() => {
              if (!valid) return
              onSave([
                ...existing.map(
                  ({ accountId, amount: sum, currency: code }) => ({
                    accountId,
                    amount: sum,
                    currency: code,
                  }),
                ),
                {
                  accountId: till.registerId,
                  amount: paying,
                  currency: active,
                },
              ])
            }}
            variant="primary"
          >
            Зберегти платіж
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (busy && !next) return
        if (!next) setDraft(null)
        onOpenChange(next)
      }}
      open={open}
      title="Додати платіж"
    >
      {error === null ? null : <Notice tone="danger">{error}</Notice>}
      {loadError === null ? null : <Notice tone="danger">{loadError}</Notice>}

      {loading ? (
        <SkeletonRows label="Завантажуємо каси…" rows={3} />
      ) : options.length === 0 ? (
        <Notice tone="warn">
          Активних кас немає. Створіть касу у «Фінансах», щоб внести платіж.
        </Notice>
      ) : (
        <>
          {currencies.length < 2 ? null : (
            <fieldset>
              <legend className="text-app-ink mb-2 text-[13px] font-bold">
                Валюта платежу
              </legend>
              <div
                className="border-app-line bg-app-input grid gap-1 rounded-[12px] border p-1"
                style={{
                  gridTemplateColumns: `repeat(${String(currencies.length)}, minmax(0, 1fr))`,
                }}
              >
                {currencies.map((code) => (
                  <button
                    aria-pressed={active === code}
                    className={cn(
                      'flex h-11 items-center justify-center gap-2 rounded-[9px] text-[14px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                      active === code
                        ? 'bg-white/[0.09] text-white'
                        : 'text-app-muted hover:bg-white/[0.04]',
                    )}
                    key={code}
                    onClick={() => {
                      setCurrency(code)
                      setSelected(null)
                      setDraft(null)
                    }}
                    type="button"
                  >
                    {code}
                    {code === ORDER_CURRENCY ? (
                      <span className="text-app-dim text-[11px] font-semibold">
                        як у замовленні
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="grid gap-2">
            <legend className="text-app-ink mb-2 text-[13px] font-bold">
              Куди зараховуємо
            </legend>
            {inCurrency.map((option) => {
              const chosen = till?.key === option.key
              return (
                <label
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-[11px] border px-3.5 py-3 transition-colors',
                    chosen
                      ? 'border-app-line-2 bg-white/[0.05]'
                      : 'border-app-line bg-app-input hover:border-app-line-2',
                  )}
                  key={option.key}
                >
                  <input
                    checked={chosen}
                    className="accent-brand size-4 shrink-0"
                    name="order-payment-till"
                    onChange={() => {
                      setSelected(option.key)
                      setDraft(null)
                    }}
                    type="radio"
                    value={option.key}
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
                    {option.name}
                  </span>
                  <span className="text-app-muted font-mono text-[12px] whitespace-nowrap tabular-nums">
                    {balances.format(option.balance)} {option.currency}
                  </span>
                </label>
              )
            })}
          </fieldset>

          <Field label={`Сума, ${active}`}>
            <TextInput
              className={cn(
                'h-[52px] rounded-[12px] px-4 font-mono text-[22px] tabular-nums',
                paying > 0 ? '' : 'border-brand/55',
              )}
              inputMode="decimal"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="0,00"
              value={value}
            />
          </Field>

          {suggested === null ? null : (
            <div className="flex flex-wrap gap-1.5">
              <Preset onPick={() => setDraft(editable(suggested))}>
                {`Уся сума · ${money(suggested, ORDER_CURRENCY)}`}
              </Preset>
              <Preset onPick={() => setDraft(editable(suggested / 2))}>
                Завдаток 50%
              </Preset>
            </div>
          )}

          {foreign ? (
            <div className="border-state-warn/25 bg-state-warn/[0.06] rounded-[12px] border px-4 pt-3.5 pb-4">
              <Field
                hint={EQUIVALENT_NOT_STORED}
                label="Скільки зарахувати в замовлення, $"
              >
                <TextInput
                  className="font-mono"
                  disabled
                  placeholder="0,00"
                  title={EQUIVALENT_NOT_STORED}
                  value=""
                />
              </Field>
            </div>
          ) : null}

          <dl className="border-app-line bg-app-raised grid grid-cols-[1fr_auto] items-baseline gap-y-2.5 rounded-[14px] border px-[18px] py-4 text-[14px]">
            <dt className="text-app-muted">До сплати</dt>
            <dd className="text-right font-mono tabular-nums">
              {outstanding === null ? '—' : money(outstanding, ORDER_CURRENCY)}
            </dd>
            <dt className="text-app-muted">Цей платіж</dt>
            <dd
              className={cn(
                'text-right font-mono tabular-nums',
                paying > 0 ? 'text-state-ok' : 'text-app-dim',
              )}
            >
              {paying > 0 ? money(paying, active) : '—'}
            </dd>
            {foreign ? (
              <>
                <dt className="text-app-muted">Зараховано в замовлення</dt>
                <dd className="text-state-warn text-right font-mono">
                  не зараховується
                </dd>
              </>
            ) : null}
            <span aria-hidden className="bg-app-line col-span-2 h-px" />
            <dt className="font-bold">
              {after !== null && after < 0 ? 'Переплата' : 'Залишиться'}
            </dt>
            <dd
              className={cn(
                'text-right font-mono text-[16px] tabular-nums',
                after === null
                  ? 'text-app-dim'
                  : credited === 0
                    ? 'text-app-muted'
                    : after < 0
                      ? 'text-state-warn'
                      : after === 0
                        ? 'text-state-ok'
                        : 'text-white',
              )}
            >
              {after === null ? '—' : money(Math.abs(after), ORDER_CURRENCY)}
            </dd>
            <p
              className={cn(
                'col-span-2 -mt-1 text-[12px] text-pretty',
                verdict.tone,
              )}
            >
              {verdict.text}
            </p>
          </dl>
        </>
      )}
    </Sheet>
  )
}

/** What the drawer says will happen when this payment is saved. */
function outcome(
  paying: number,
  foreign: boolean,
  after: number | null,
): { text: string; tone: string } {
  if (paying <= 0) return { text: 'Вкажіть суму платежу', tone: 'text-app-dim' }
  if (foreign)
    return {
      text: 'Платіж потрапить у касу, але залишок за замовленням не зміниться: курсу в кабінеті немає.',
      tone: 'text-state-warn',
    }
  if (after === null)
    return {
      text: 'Платежі в різних валютах — залишок не рахується.',
      tone: 'text-app-muted',
    }
  if (after < 0)
    return { text: 'Сума більша за залишок до сплати', tone: 'text-state-warn' }
  if (after === 0)
    return { text: 'Замовлення буде оплачено повністю', tone: 'text-state-ok' }
  return { text: 'Часткова оплата', tone: 'text-app-muted' }
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
      className="border-app-line text-app-muted hover:text-app-ink relative h-[30px] rounded-full border px-3 text-[12px] font-semibold whitespace-nowrap transition-colors hover:border-white/24 after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']"
      onClick={onPick}
      type="button"
    >
      {children}
    </button>
  )
}
