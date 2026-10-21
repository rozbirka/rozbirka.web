import { useEffect, useId, useMemo, useState } from 'react'
import { Button, Field, Notice, Sheet, SkeletonRows } from '@/components/app'
import { cn } from '@/lib/utils'
import { cashApi, type CashRegister } from '@/api/cash'
import { normalizeApiProblem } from '@/api/errors'
import type { ConfirmPayment } from '@/api/orders'
import {
  currencyName,
  parseCurrency,
  useFormat,
  useLocale,
  useT,
  type Locale,
} from '@/i18n'
import { MoneyInput } from '../currency/price-currency'
import { amountPrecisionError } from '../currency/amount-precision'
import { paymentMessages } from './payment-messages'
import {
  choosePaymentCurrency,
  parseAmount,
  tillCurrencies,
} from './payment-policy'

/** How the last attempt to record a payment ended (board 3c). */
export type PaymentOutcome =
  | { kind: 'refused'; message: string }
  | { kind: 'checking' }
  | { kind: 'not-recorded' }
  | { kind: 'check-failed' }

/**
 * «Додати платіж» (ROZ-162 board 3a). Two separate blocks: what the order is
 * worth in the accounting currency, and the actual payment — a till, one of
 * the currencies it keeps, and the sum received. No rate, no converted sum,
 * no remaining balance: the till receives exactly what was typed (AC-11).
 */
export function OrderPaymentDrawer({
  accountingCurrency,
  busy,
  existing,
  onOpenChange,
  onSave,
  open,
  orderNumber,
  orderValue,
  outcome,
}: {
  /** `null` when no accounting currency is chosen (or reported). */
  accountingCurrency: string | null
  busy: boolean
  /** Payments the order already holds; the save replaces the whole set. */
  existing: readonly ConfirmPayment[]
  onOpenChange: (open: boolean) => void
  onSave: (payments: ConfirmPayment[], added: ConfirmPayment) => void
  open: boolean
  orderNumber: number
  /** The order's value in the accounting currency. */
  orderValue: number | null
  outcome: PaymentOutcome | null
}) {
  const t = useT(paymentMessages)
  const format = useFormat()
  const { locale } = useLocale()
  const groupId = useId()
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tillId, setTillId] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [reselectFrom, setReselectFrom] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

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

  const tills = useMemo(
    () =>
      registers.filter(
        (register) =>
          register.isActive && Object.keys(register.balances).length > 0,
      ),
    [registers],
  )
  const till = tills.find((item) => item.id === tillId) ?? tills[0]
  const available = till === undefined ? [] : tillCurrencies(till)
  // A till with a single currency fixes it, unless the user still has to
  // re-pick after a switch (the explanation stays until they do).
  const active =
    currency ??
    (reselectFrom === null && available.length === 1
      ? (available[0] ?? null)
      : null)
  const amount = parseAmount(draft)
  // A payment keeps to its own currency's precision (Core refuses the rest).
  const precision =
    amount !== null && amount > 0
      ? amountPrecisionError(amount, active, locale)
      : null
  const valid =
    till !== undefined &&
    active !== null &&
    amount !== null &&
    amount > 0 &&
    precision === null

  const pickTill = (next: CashRegister) => {
    if (next.id === till?.id) return
    const choice = choosePaymentCurrency(active, tillCurrencies(next))
    setTillId(next.id)
    setCurrency(choice.currency)
    setReselectFrom(choice.reselectFrom)
  }

  const typedAmount = format.number(amount ?? draft) ?? draft
  const footerText =
    till === undefined
      ? null
      : active === null
        ? t('summaryNoCurrency', { till: till.name })
        : amount === null || amount <= 0
          ? t('enterAmount')
          : t('summary', {
              till: till.name,
              amount: format.money(amount, active) ?? '',
            })

  return (
    <Sheet
      eyebrow={t('eyebrow', { number: String(orderNumber) })}
      footer={
        <>
          <p
            className={cn(
              'm-0 min-w-0 flex-1 truncate',
              valid ? 'text-app-muted' : 'text-app-dim',
            )}
          >
            {footerText}
          </p>
          <Button disabled={busy} onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || !valid || outcome?.kind === 'checking'}
            onClick={() => {
              if (!valid) return
              const added = {
                accountId: till.id,
                amount,
                currency: active,
              }
              onSave(
                [
                  ...existing.map(
                    ({ accountId, amount: sum, currency: code }) => ({
                      accountId,
                      amount: sum,
                      currency: code,
                    }),
                  ),
                  added,
                ],
                added,
              )
            }}
            variant="primary"
          >
            {busy ? t('recording') : t('record')}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (busy && !next) return
        onOpenChange(next)
      }}
      open={open}
      title={t('title')}
    >
      {outcome === null ? null : outcome.kind === 'refused' ? (
        <Notice block tone="danger">
          <p className="rz-strong m-0 font-semibold">{t('refusedTitle')}</p>
          <p className="m-0 mt-1 text-pretty">{outcome.message}</p>
          {amount !== null && active !== null ? (
            <p className="text-app-muted m-0 mt-1">
              {t('refusedKept', {
                amount: format.money(amount, active) ?? typedAmount,
              })}
            </p>
          ) : null}
        </Notice>
      ) : outcome.kind === 'checking' ? (
        <Notice block tone="warn">
          <p className="rz-strong m-0 font-semibold">{t('unknownTitle')}</p>
          <p className="m-0 mt-1 text-pretty">{t('unknownBody')}</p>
          <p className="text-app-muted m-0 mt-1">{t('refreshing')}</p>
        </Notice>
      ) : outcome.kind === 'not-recorded' ? (
        <Notice tone="warn">{t('notRecorded')}</Notice>
      ) : (
        <Notice tone="danger">{t('checkFailed')}</Notice>
      )}
      {loadError === null ? null : <Notice tone="danger">{loadError}</Notice>}

      <section
        aria-labelledby={`${groupId}-value`}
        className="rz-inset grid min-h-fit gap-1"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="rz-muted m-0 font-normal" id={`${groupId}-value`}>
            {t('orderValue')}
          </h3>
          <p className="rz-mono rz-strong m-0 font-semibold">
            {accountingCurrency === null
              ? (format.number(orderValue) ?? '—')
              : (format.money(orderValue, accountingCurrency) ?? '—')}
          </p>
        </div>
        <p className="rz-muted m-0 text-caption font-semibold">
          {accountingCurrency === null ? t('valueUnknown') : t('inAccounting')}
        </p>
      </section>

      <section aria-labelledby={`${groupId}-paid`} className="grid gap-3.5">
        <h3 className="rz-h-card m-0" id={`${groupId}-paid`}>
          {t('actualPayment')}
        </h3>
        {loading ? (
          <SkeletonRows label={t('loadingTills')} rows={3} />
        ) : tills.length === 0 ? (
          <Notice tone="warn">{t('noTills')}</Notice>
        ) : (
          <>
            <fieldset className="m-0 grid min-h-fit gap-2 border-0 p-0">
              <legend className="rz-label mb-2 p-0">{t('till')}</legend>
              <div className="border-app-line grid overflow-hidden rounded-rz-md border bg-(--rz-sheet-field)">
                {tills.map((option) => {
                  const chosen = till?.id === option.id
                  return (
                    <label
                      className={cn(
                        'border-app-line flex min-h-11 cursor-pointer items-center gap-3 border-t px-3 py-2 first:border-t-0',
                        chosen
                          ? 'bg-(--rz-row-selected) shadow-[inset_2px_0_0_var(--rz-brand)]'
                          : 'hover:bg-app-hover',
                      )}
                      key={option.id}
                    >
                      <input
                        checked={chosen}
                        className="rz-radio shrink-0"
                        name={`${groupId}-till`}
                        onChange={() => pickTill(option)}
                        type="radio"
                        value={option.id}
                      />
                      <span className="rz-strong min-w-0 flex-1 font-semibold text-pretty">
                        {option.name}
                      </span>
                      <span className="rz-muted font-mono text-caption whitespace-nowrap">
                        {tillCurrencies(option).join(', ')}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {reselectFrom !== null && till !== undefined ? (
              <Notice tone="warn">
                {t('reselect', { till: till.name, code: reselectFrom })}
                {draft.trim() === ''
                  ? null
                  : ` ${t('amountKept', { amount: typedAmount })}`}
              </Notice>
            ) : null}

            {available.length === 1 && reselectFrom === null ? (
              <div className="rz-inset flex min-h-fit items-center justify-between gap-3">
                <p className="rz-muted m-0">{t('currency')}</p>
                <p className="text-app-strong m-0">
                  <span className="font-mono font-semibold">
                    {available[0]}
                  </span>
                  <span className="sr-only">
                    {` (${currencyNameOf(available[0], locale)})`}
                  </span>
                </p>
              </div>
            ) : (
              <fieldset>
                <legend className="rz-label mb-1.5 p-0">{t('currency')}</legend>
                <div
                  className={cn(
                    'rz-seg flex w-full flex-wrap',
                    reselectFrom !== null && 'border-state-warn/30',
                  )}
                >
                  {available.map((code) => (
                    <button
                      aria-label={`${code} (${currencyNameOf(code, locale)})`}
                      aria-pressed={active === code}
                      className="flex-1 justify-center font-mono"
                      key={code}
                      onClick={() => {
                        setCurrency(code)
                        setReselectFrom(null)
                      }}
                      type="button"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <Field error={precision ?? undefined} label={t('amount')}>
              <MoneyInput
                className="h-12 text-page"
                currency={active}
                inputMode="decimal"
                numeric
                onChange={(event) => setDraft(event.target.value)}
                placeholder="0"
                value={draft}
              />
            </Field>
          </>
        )}
      </section>
    </Sheet>
  )
}

function currencyNameOf(code: string | undefined, locale: Locale) {
  const supported = parseCurrency(code)
  return supported === null ? (code ?? '') : currencyName(supported, locale)
}
