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
              'min-w-0 flex-1 truncate text-[13px]',
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
          <p className="font-semibold">{t('refusedTitle')}</p>
          <p className="mt-1 text-[13px] text-pretty">{outcome.message}</p>
          {amount !== null && active !== null ? (
            <p className="text-app-muted mt-1 text-[13px]">
              {t('refusedKept', {
                amount: format.money(amount, active) ?? typedAmount,
              })}
            </p>
          ) : null}
        </Notice>
      ) : outcome.kind === 'checking' ? (
        <Notice block tone="warn">
          <p className="font-semibold">{t('unknownTitle')}</p>
          <p className="mt-1 text-[13px] text-pretty">{t('unknownBody')}</p>
          <p className="text-app-muted mt-1 text-[13px]">{t('refreshing')}</p>
        </Notice>
      ) : outcome.kind === 'not-recorded' ? (
        <Notice tone="warn">{t('notRecorded')}</Notice>
      ) : (
        <Notice tone="danger">{t('checkFailed')}</Notice>
      )}
      {loadError === null ? null : <Notice tone="danger">{loadError}</Notice>}

      <section
        aria-labelledby={`${groupId}-value`}
        className="border-app-line bg-app-raised grid gap-1 rounded-[14px] border px-[18px] py-4"
      >
        <h3
          className="text-app-muted text-[13px] font-semibold"
          id={`${groupId}-value`}
        >
          {t('orderValue')}
        </h3>
        <p className="font-mono text-[22px] font-bold text-white tabular-nums">
          {accountingCurrency === null
            ? (format.number(orderValue) ?? '—')
            : (format.money(orderValue, accountingCurrency) ?? '—')}
        </p>
        <p className="text-app-dim text-[12px]">
          {accountingCurrency === null ? t('valueUnknown') : t('inAccounting')}
        </p>
      </section>

      <section aria-labelledby={`${groupId}-paid`} className="grid gap-4">
        <h3
          className="text-app-ink text-[15px] font-bold"
          id={`${groupId}-paid`}
        >
          {t('actualPayment')}
        </h3>
        {loading ? (
          <SkeletonRows label={t('loadingTills')} rows={3} />
        ) : tills.length === 0 ? (
          <Notice tone="warn">{t('noTills')}</Notice>
        ) : (
          <>
            <fieldset className="grid gap-2">
              <legend className="text-app-ink mb-2 text-[13px] font-bold">
                {t('till')}
              </legend>
              {tills.map((option) => {
                const chosen = till?.id === option.id
                return (
                  <label
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-[11px] border px-3.5 py-3 transition-colors',
                      chosen
                        ? 'border-app-line-2 bg-white/[0.05]'
                        : 'border-app-line bg-app-input hover:border-app-line-2',
                    )}
                    key={option.id}
                  >
                    <input
                      checked={chosen}
                      className="accent-brand size-4 shrink-0"
                      name={`${groupId}-till`}
                      onChange={() => pickTill(option)}
                      type="radio"
                      value={option.id}
                    />
                    <span className="min-w-0 flex-1 text-[14px] font-semibold text-pretty text-white">
                      {option.name}
                    </span>
                    <span className="text-app-muted font-mono text-[12px] whitespace-nowrap">
                      {tillCurrencies(option).join(', ')}
                    </span>
                  </label>
                )
              })}
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
              <div className="grid gap-1.5">
                <p className="text-app-muted text-[13.5px]">{t('currency')}</p>
                <p className="text-app-ink text-[14px]">
                  <span className="font-mono font-bold">{available[0]}</span>
                  <span className="sr-only">
                    {` (${currencyNameOf(available[0], locale)})`}
                  </span>
                </p>
              </div>
            ) : (
              <fieldset>
                <legend className="text-app-ink mb-2 text-[13px] font-bold">
                  {t('currency')}
                </legend>
                <div
                  className={cn(
                    'bg-app-input grid gap-1 rounded-[12px] border p-1',
                    reselectFrom === null
                      ? 'border-app-line'
                      : 'border-state-warn/50',
                  )}
                  style={{
                    gridTemplateColumns: `repeat(auto-fit, minmax(72px, 1fr))`,
                  }}
                >
                  {available.map((code) => (
                    <button
                      aria-label={`${code} (${currencyNameOf(code, locale)})`}
                      aria-pressed={active === code}
                      className={cn(
                        'flex h-11 items-center justify-center rounded-[9px] font-mono text-[14px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                        active === code
                          ? 'bg-white/[0.09] text-white'
                          : 'text-app-muted hover:bg-white/[0.04]',
                      )}
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
                className="h-[52px] rounded-[12px] px-4 font-mono text-[22px] tabular-nums"
                currency={active}
                inputMode="decimal"
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
