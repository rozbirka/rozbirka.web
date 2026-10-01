import type { FormEvent } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import type { CarExpense } from '@/api/cars'

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
}) {
  const title = editing ? 'Редагувати витрату' : 'Додати витрату'

  return (
    <Sheet
      description={
        editing
          ? 'Оновіть назву або суму. Прибутковість авто перерахується після збереження.'
          : 'Додайте витрату понад ціну придбання автомобіля.'
      }
      eyebrow="Автомобілі · Витрати"
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
            disabled={busy}
            form={CAR_EXPENSE_FORM}
            type="submit"
            variant="primary"
          >
            {busy
              ? editing
                ? 'Зберігаємо…'
                : 'Додаємо…'
              : editing
                ? 'Зберегти витрату'
                : 'Додати витрату'}
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
        <Field label="Назва витрати">
          <TextInput
            autoFocus
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Наприклад, транспортування"
            value={name}
          />
        </Field>
        <Field hint="У доларах" label="Сума витрати">
          <TextInput
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
      </form>
    </Sheet>
  )
}

const CAR_EXPENSE_FORM = 'car-expense-form'
