import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { CashRegister, CashTransactionInput } from '@/api/cash'
import { Button, Field, Notice, Segmented, TextInput } from '@/components/app'
import { cn } from '@/lib/utils'

type MovementType = CashTransactionInput['type']

export function CashMovementDrawer({
  busy,
  error,
  onOpenChange,
  onSubmit,
  open,
  register,
}: {
  busy: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CashTransactionInput) => void
  open: boolean
  register: CashRegister
}) {
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
            onSubmit={submit}
          >
            <header className="border-app-line flex items-start justify-between gap-5 border-b px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-app-dim font-mono text-[10px] font-semibold tracking-[0.16em] uppercase">
                  Гроші · {register.name}
                </p>
                <Dialog.Title className="mt-2 text-[26px] leading-none font-extrabold tracking-[-0.025em]">
                  Нова операція
                </Dialog.Title>
                <Dialog.Description className="text-app-muted mt-2 text-sm">
                  Запис у журнал цієї каси без переказу та документа.
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
                        type === 'manual_in'
                          ? 'text-state-ok'
                          : 'text-state-danger',
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
            </div>

            <footer className="border-app-line bg-app-canvas flex justify-end gap-2 border-t px-5 py-3 sm:px-6">
              <Dialog.Close asChild>
                <Button disabled={busy} type="button">
                  Скасувати
                </Button>
              </Dialog.Close>
              <Button
                aria-busy={busy}
                disabled={invalid}
                type="submit"
                variant="primary"
              >
                {busy ? 'Зберігаємо…' : 'Записати операцію'}
              </Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
