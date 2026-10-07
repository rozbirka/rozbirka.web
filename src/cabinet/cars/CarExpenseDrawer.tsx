import type { FormEvent } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import type { CarExpense } from '@/api/cars'
import { commonMessages, useT } from '@/i18n'
import { carCardMessages } from './car-card-messages'
import { MoneyInput } from '../currency/price-currency'
import type { PriceSlots } from '../currency/use-price-slots'

export function CarExpenseDrawer({
  amount,
  busy,
  editing,
  error,
  name,
  onAmountChange,
  onNameChange,
  onOpenChange,
  onSubmit,
  open,
  price,
}: {
  amount: string
  busy: boolean
  editing: CarExpense | null
  error: string | null
  name: string
  onAmountChange: (value: string) => void
  onNameChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  /** Accounting currency of the amount: suffix, notes and lock warning. */
  price: PriceSlots
}) {
  const t = useT(carCardMessages)
  const tc = useT(commonMessages)
  const title = editing ? t('expenseEditTitle') : t('expenseAddTitle')

  return (
    <Sheet
      description={
        editing ? t('expenseEditDescription') : t('expenseAddDescription')
      }
      eyebrow={t('expenseEyebrow')}
      footer={
        <>
          <div className="basis-full empty:hidden">{price.saveNotes}</div>
          <Button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={busy}
            disabled={busy || price.disabled}
            form={CAR_EXPENSE_FORM}
            type="submit"
            variant="primary"
          >
            {busy
              ? editing
                ? tc('saving')
                : t('expenseAdding')
              : editing
                ? t('expenseSave')
                : t('expenseAddTitle')}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (busy && !next) return
        onOpenChange(next)
      }}
      open={open}
      title={title}
    >
      <form
        aria-busy={busy}
        className="grid content-start gap-5"
        id={CAR_EXPENSE_FORM}
        onSubmit={onSubmit}
      >
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Field label={t('expenseName')}>
          <TextInput
            autoFocus
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t('expenseNamePlaceholder')}
            value={name}
          />
        </Field>
        <Field hint={price.hint} label="Сума витрати">
          <MoneyInput
            currency={price.currency}
            disabled={price.disabled}
            inputMode="decimal"
            min="0"
            numeric
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0"
            step="0.01"
            type="number"
            value={amount}
          />
        </Field>
        {price.note}
      </form>
    </Sheet>
  )
}

const CAR_EXPENSE_FORM = 'car-expense-form'
