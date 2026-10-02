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
  const currencies = Object.keys(register.balances).sort((left, right) => {
    const priority = (currency: string) =>
      currency === 'UAH' ? 0 : currency === 'USD' ? 1 : 2
    return priority(left) - priority(right) || left.localeCompare(right)
  })
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
  const invalid =
    busy ||
    amount === '' ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    selectedCurrency === '' ||
    insufficientBalance

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
      description="Запис у журнал цієї каси без переказу та документа."
      eyebrow={`Гроші · ${register.name}`}
      footer={
        <>
          <Button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Скасувати
          </Button>
          <Button
            aria-busy={busy}
            disabled={invalid}
            form={CASH_MOVEMENT_FORM}
            type="submit"
            variant="primary"
          >
            {busy ? 'Зберігаємо…' : 'Записати операцію'}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (busy && !next) return
        onOpenChange(next)
      }}
      open={open}
      title="Нова операція"
    >
      <form
        aria-busy={busy}
        className="grid content-start gap-5"
        id={CASH_MOVEMENT_FORM}
        onSubmit={submit}
      >
        <Field label="Тип операції">
          <div
            aria-label="Тип операції"
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
              Надходження
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
              Витрата
            </button>
          </div>
        </Field>

        <Field label="Сума">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(7.25rem,auto)] items-stretch gap-2">
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
              className="h-11 flex-nowrap rounded-[10px] p-1 [&>label]:h-full [&>label]:min-h-0 [&>label]:min-w-0 [&>label]:rounded-[7px] [&>label]:px-2"
              label="Валюта операції"
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
                  ? `Надходження до каси «${register.name}»`
                  : `Витрата з каси «${register.name}»`}
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

        <Field hint="Необовʼязково" label="Нотатка">
          <TextInput
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </Field>
        {insufficientBalance ? (
          <Notice tone="warn">
            У касі недостатньо коштів для цієї витрати.
          </Notice>
        ) : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Sheet>
  )
}

const CASH_MOVEMENT_FORM = 'cash-movement-form'
