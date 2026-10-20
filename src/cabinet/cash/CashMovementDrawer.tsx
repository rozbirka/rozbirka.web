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
        <div className="rz-field">
          {/* The group is named by its own legend; this is the visible label. */}
          <span aria-hidden className="rz-label">
            {t('movementType')}
          </span>
          <Segmented
            className="w-full"
            label={t('movementType')}
            name="movement-type"
            onChange={setType}
            options={[
              { label: t('mvIncome'), value: 'manual_in' },
              { label: t('mvExpense'), value: 'manual_out' },
            ]}
            value={type}
          />
        </div>

        <div className="grid items-start gap-3 sm:grid-cols-2">
          <Field label={t('colAmount')}>
            <TextInput
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
          </Field>
          <div className="rz-field">
            {/* The group is named by its own legend; this is the visible label. */}
            <span aria-hidden className="rz-label">
              {t('movementCurrency')}
            </span>
            <Segmented
              className="w-full font-mono"
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
        </div>

        {amount !== '' && selectedCurrency !== '' ? (
          <div className="rz-inset flex flex-wrap items-center justify-between gap-3">
            <span className="rz-muted">
              {type === 'manual_in'
                ? t('incomeTo', { name: register.name })
                : t('expenseFrom', { name: register.name })}
            </span>
            <span
              className={cn(
                'rz-mono font-semibold',
                type === 'manual_in' ? 'text-state-ok' : 'text-state-danger',
              )}
            >
              {type === 'manual_in' ? '+' : '−'}
              {amount} {selectedCurrency}
            </span>
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
