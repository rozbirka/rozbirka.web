import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { Button, Field, Notice, TextInput } from '@/components/app'
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
    <Dialog.Root
      onOpenChange={(next) => {
        if (busy && !next) return
        onOpenChange(next)
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px]" />
        <Dialog.Content className="bg-app-canvas border-app-line fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] overflow-hidden rounded-t-[24px] border-t text-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-none sm:w-full sm:max-w-[600px] sm:rounded-none sm:border-t-0 sm:border-l">
          <form
            aria-busy={busy}
            className="grid min-h-0 grid-rows-[auto_1fr_auto]"
            onSubmit={onSubmit}
          >
            <header className="border-app-line flex items-start justify-between gap-5 border-b px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-app-dim font-mono text-[10px] font-semibold tracking-[0.16em] uppercase">
                  Автомобілі · Витрати
                </p>
                <Dialog.Title className="mt-2 text-[26px] leading-none font-extrabold tracking-[-0.025em]">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="text-app-muted mt-2 text-sm leading-5">
                  {editing
                    ? 'Оновіть назву або суму. Прибутковість авто перерахується після збереження.'
                    : 'Додайте витрату понад ціну придбання автомобіля.'}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button
                  aria-label="Закрити"
                  disabled={busy}
                  size="icon"
                  type="button"
                  variant="quiet"
                >
                  <X aria-hidden />
                </Button>
              </Dialog.Close>
            </header>

            <div className="grid min-h-0 content-start gap-5 overflow-y-auto px-5 py-5 sm:px-6">
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
            </div>

            <footer className="border-app-line bg-app-canvas flex justify-end gap-2 border-t px-5 py-3 sm:px-6">
              <Dialog.Close asChild>
                <Button disabled={busy} type="button">
                  Скасувати
                </Button>
              </Dialog.Close>
              <Button
                aria-busy={busy}
                disabled={busy}
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
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
