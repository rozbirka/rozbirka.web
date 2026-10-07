import { useState, type FormEvent } from 'react'
import type { CashRegister, CashTransactionInput } from '@/api/cash'
import {
  Button,
  Field,
  Notice,
  Segmented,
  Sheet,
  TextInput,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { commonMessages, useLocale, useT } from '@/i18n'
import { amountPrecisionError } from '../currency/amount-precision'
import { cashMessages } from './cash-messages'
import { tillCurrencies } from '../currency/catalog-order'

type MovementType = CashTransactionInput['type']

interface CashMovementDrawerProps {
  busy: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CashTransactionInput) => void
  open: boolean
  register: CashRegister
}

export function CashMovementDrawer(props: CashMovementDrawerProps) {
  if (!props.open) return null
  return <OpenCashMovementDrawer {...props} />
}

function OpenCashMovementDrawer({
  busy,
  error,
  onOpenChange,
  onSubmit,
  open,
  register,
}: CashMovementDrawerProps) {
  const t = useT(cashMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const currencies = tillCurrencies(register)
  const [type, setType] = useState<MovementType>('manual_in')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('')
  const [note, setNote] = useState('')
  const selectedCurrency = currencies.includes(currency)
    ? currency
    : currencies.length === 1
      ? (currencies[0] ?? '')
      : ''
  const numericAmount = Number(amount)
  const insufficientBalance =
    type === 'manual_out' &&
    selectedCurrency !== '' &&
    amount !== '' &&
    Number.isFinite(numericAmount) &&
    numericAmount > (register.balances[selectedCurrency] ?? 0)
  // Core refuses an amount finer than its currency allows (JPY: whole).
  const precision =
    amount !== '' && Number.isFinite(numericAmount) && numericAmount > 0
      ? amountPrecisionError(numericAmount, selectedCurrency || null, locale)
      : null
  const invalid =
    busy ||
    amount === '' ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    selectedCurrency === '' ||
    insufficientBalance ||
    precision !== null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (invalid) return
    onSubmit({
      type,
      amount: numericAmount,
      currency: selectedCurrency,
      note: note.trim() || null,
    })
  }

  return (
    <Sheet
      description={t('movementDescription')}
      eyebrow={t('eyebrowTill', { name: register.name })}
      footer={
        <>
          <Button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={invalid}
            form={CASH_MOVEMENT_FORM}
            type="submit"
            variant="primary"
          >
            {busy ? tc('saving') : t('recordMovement')}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (busy && !next) return
        onOpenChange(next)
      }}
      open={open}
      title={t('newOperation')}
    >
      <form
        aria-busy={busy}
        className="grid content-start gap-5"
        id={CASH_MOVEMENT_FORM}
        onSubmit={submit}
      >
        <Field label={t('movementType')}>
          <div
            aria-label={t('movementType')}
            className="grid grid-cols-2 gap-2"
            role="group"
          >
            <button
              aria-pressed={type === 'manual_in'}
              className={cn(
                'min-h-12 rounded-[12px] border px-4 text-sm font-bold transition-colors',
                type === 'manual_in'
                  ? 'border-state-ok/70 bg-state-ok/14 text-state-ok'
                  : 'border-state-ok/35 text-state-ok/75 hover:bg-state-ok/8',
              )}
              onClick={() => setType('manual_in')}
              type="button"
            >
              {t('mvIncome')}
            </button>
            <button
              aria-pressed={type === 'manual_out'}
              className={cn(
                'min-h-12 rounded-[12px] border px-4 text-sm font-bold transition-colors',
                type === 'manual_out'
                  ? 'border-state-danger/70 bg-state-danger/14 text-state-danger'
                  : 'border-state-danger/35 text-state-danger/75 hover:bg-state-danger/8',
              )}
              onClick={() => setType('manual_out')}
              type="button"
            >
              {t('mvExpense')}
            </button>
          </div>
        </Field>

        <Field label={t('colAmount')}>
          <div
            className={cn(
              'grid items-stretch gap-2',
              // Up to three codes fit beside the amount; more wrap under it
              // so no code is cut off.
              currencies.length <= 3 &&
                'grid-cols-[minmax(0,1fr)_minmax(7.25rem,auto)]',
            )}
          >
            <TextInput
              className="h-11 min-h-11 rounded-[10px] px-3.5 font-mono text-[17px] font-semibold tabular-nums"
              inputMode="decimal"
              min="0"
              numeric
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              required
              step="0.01"
              type="number"
              value={amount}
            />
            <Segmented
              className={cn(
                'rounded-[10px] p-1 [&>label]:rounded-[7px] [&>label]:px-2 [&>label]:font-mono',
                currencies.length <= 3
                  ? 'h-11 flex-nowrap [&>label]:h-full [&>label]:min-h-0 [&>label]:min-w-0'
                  : 'w-fit max-w-full flex-wrap [&>label]:min-h-9 [&>label]:min-w-14 [&>label]:flex-none',
              )}
              label={t('movementCurrency')}
              name="movement-currency"
              onChange={setCurrency}
              options={currencies.map((one) => ({
                label: one,
                value: one,
              }))}
              value={selectedCurrency}
            />
          </div>
        </Field>

        {amount !== '' && selectedCurrency !== '' ? (
          <div
            className={cn(
              'rounded-[14px] border px-4 py-3.5',
              type === 'manual_in'
                ? 'border-state-ok/45 bg-state-ok/8'
                : 'border-state-danger/45 bg-state-danger/8',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-app-muted text-[13.5px]">
                {type === 'manual_in'
                  ? t('incomeTo', { name: register.name })
                  : t('expenseFrom', { name: register.name })}
              </span>
              <span
                className={cn(
                  'font-mono text-[18px] font-semibold tabular-nums',
                  type === 'manual_in' ? 'text-state-ok' : 'text-state-danger',
                )}
              >
                {type === 'manual_in' ? '+' : '−'}
                {amount} {selectedCurrency}
              </span>
            </div>
          </div>
        ) : null}

        <Field hint={t('optional')} label={t('note')}>
          <TextInput
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </Field>
        {precision !== null ? <Notice tone="warn">{precision}</Notice> : null}
        {insufficientBalance ? (
          <Notice tone="warn">{t('insufficient')}</Notice>
        ) : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Sheet>
  )
}

const CASH_MOVEMENT_FORM = 'cash-movement-form'
