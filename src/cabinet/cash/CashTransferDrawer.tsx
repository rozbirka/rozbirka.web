import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { CashRegister, CashTransferInput } from '@/api/cash'
import { Button, Field, Notice, Segmented, TextInput } from '@/components/app'

const eyebrowClass =
  'text-app-dim font-mono text-[11.5px] tracking-[0.12em] uppercase'
const transferCurrencies = [
  { label: 'UAH', value: 'UAH' },
  { label: 'USD', value: 'USD' },
] as const

export function CashTransferDrawer({
  busy,
  error,
  onOpenChange,
  onSubmit,
  open,
  registers,
}: {
  busy: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CashTransferInput) => void
  open: boolean
  registers: CashRegister[]
}) {
  const activeRegisters = useMemo(
    () => registers.filter((register) => register.isActive),
    [registers],
  )
  const [fromRegisterId, setFromRegisterId] = useState('')
  const [toRegisterId, setToRegisterId] = useState('')
  const [fromCurrency, setFromCurrency] = useState('')
  const [toCurrency, setToCurrency] = useState('')
  const [amountOut, setAmountOut] = useState('')
  const [amountIn, setAmountIn] = useState('')
  const [note, setNote] = useState('')

  const selectedFromId = activeRegisters.some(
    (register) => register.id === fromRegisterId,
  )
    ? fromRegisterId
    : (activeRegisters[0]?.id ?? '')
  const source = activeRegisters.find(
    (register) => register.id === selectedFromId,
  )
  const destinations = activeRegisters.filter(
    (register) => register.id !== selectedFromId,
  )
  const destination = destinations.find(
    (register) => register.id === toRegisterId,
  )
  const amountOutNumber = Number(amountOut)
  const amountInNumber = Number(amountIn)
  const sourceSupportsCurrency =
    source !== undefined &&
    fromCurrency !== '' &&
    Object.hasOwn(source.balances, fromCurrency)
  const destinationSupportsCurrency =
    destination !== undefined &&
    toCurrency !== '' &&
    Object.hasOwn(destination.balances, toCurrency)
  const validationMessage =
    sourceSupportsCurrency &&
    amountOut !== '' &&
    Number.isFinite(amountOutNumber) &&
    amountOutNumber > (source.balances[fromCurrency] ?? 0)
      ? 'У касі-відправнику недостатньо коштів для цього переказу.'
      : fromCurrency !== '' && !sourceSupportsCurrency
        ? 'Обрана валюта недоступна в касі-відправнику.'
        : toCurrency !== '' && !destinationSupportsCurrency
          ? 'Обрана валюта недоступна в касі-отримувачі.'
          : fromCurrency !== '' &&
              fromCurrency === toCurrency &&
              amountOut !== '' &&
              amountIn !== '' &&
              amountOutNumber !== amountInNumber
            ? 'Для переказу без конвертації суми списання і зарахування мають збігатися.'
            : null
  const invalid =
    busy ||
    !source ||
    !destination ||
    !fromCurrency ||
    !toCurrency ||
    !amountOut ||
    !amountIn ||
    !Number.isFinite(amountOutNumber) ||
    !Number.isFinite(amountInNumber) ||
    amountOutNumber <= 0 ||
    amountInNumber <= 0 ||
    !sourceSupportsCurrency ||
    !destinationSupportsCurrency ||
    validationMessage !== null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (invalid) return
    onSubmit({
      fromRegisterId: selectedFromId,
      fromCurrency,
      toRegisterId,
      toCurrency,
      amountOut: Number(amountOut),
      amountIn: Number(amountIn),
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
                  Гроші · Каси
                </p>
                <Dialog.Title className="mt-2 text-[26px] leading-none font-extrabold tracking-[-0.025em]">
                  Переказ між касами
                </Dialog.Title>
                <Dialog.Description className="text-app-muted mt-2 text-sm">
                  Вкажіть, звідки списати кошти та куди їх зарахувати.
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

            <div className="grid min-h-0 content-start gap-4 overflow-y-auto px-5 py-5 sm:px-6">
              {activeRegisters.length < 2 ? (
                <Notice role="status" tone="info">
                  Переказ потребує ще однієї активної каси. Створіть другу касу
                  або активуйте наявну.
                </Notice>
              ) : (
                <>
                  <section className="border-app-line bg-app-raised rounded-[16px] grid gap-4 border p-4">
                    <p className={eyebrowClass}>Звідки</p>
                    <Field label="Каса-відправник">
                      <Segmented
                        className="w-fit max-w-full border-0 bg-transparent p-0 [&>label]:min-h-10 [&>label]:flex-none [&>label]:border [&>label]:border-app-line-2 [&>label]:bg-app-input [&>label]:px-3.5"
                        label="Каса-відправник"
                        name="transfer-from-register"
                        onChange={(registerId) => {
                          setFromRegisterId(registerId)
                          setFromCurrency('')
                          setToRegisterId('')
                          setToCurrency('')
                        }}
                        options={activeRegisters.map((register) => ({
                          label: register.name,
                          srLabel: 'каса-відправник',
                          value: register.id,
                        }))}
                        selectionTone="brand"
                        value={selectedFromId}
                      />
                    </Field>
                    <Field label="Сума списання">
                      <div className="grid grid-cols-[minmax(0,1fr)_7.25rem] items-stretch gap-2">
                        <TextInput
                          className="h-11 min-h-11 rounded-[10px] px-3.5 font-mono text-[17px] font-semibold tabular-nums"
                          inputMode="decimal"
                          min="0"
                          numeric
                          onChange={(event) => setAmountOut(event.target.value)}
                          placeholder="0"
                          required
                          step="0.01"
                          type="number"
                          value={amountOut}
                        />
                        <Segmented
                          className="h-11 flex-nowrap rounded-[10px] p-1 [&>label]:h-full [&>label]:min-h-0 [&>label]:min-w-0 [&>label]:rounded-[7px] [&>label]:px-2"
                          label="Валюта списання"
                          name="transfer-from-currency"
                          onChange={setFromCurrency}
                          options={transferCurrencies.map((currency) => ({
                            ...currency,
                            disabled:
                              source === undefined ||
                              !Object.hasOwn(source.balances, currency.value),
                          }))}
                          selectionTone="brand"
                          value={fromCurrency}
                        />
                      </div>
                    </Field>
                    {source && fromCurrency ? (
                      <p className="text-app-dim text-[12.5px] tabular-nums">
                        Доступно в цій касі:{' '}
                        {source.balances[fromCurrency] ?? '—'} {fromCurrency}
                      </p>
                    ) : null}
                  </section>

                  <div aria-hidden className="flex items-center gap-3">
                    <span className="bg-app-line h-px flex-1" />
                    <ArrowDown className="text-app-dim size-4 shrink-0" />
                    <span className="bg-app-line h-px flex-1" />
                  </div>

                  <section className="border-app-line bg-app-raised rounded-[16px] grid gap-4 border p-4">
                    <p className={eyebrowClass}>Куди</p>
                    <Field label="Каса-отримувач">
                      <Segmented
                        className="w-fit max-w-full border-0 bg-transparent p-0 [&>label]:min-h-10 [&>label]:flex-none [&>label]:border [&>label]:border-app-line-2 [&>label]:bg-app-input [&>label]:px-3.5"
                        label="Каса-отримувач"
                        name="transfer-to-register"
                        onChange={(registerId) => {
                          setToRegisterId(registerId)
                          setToCurrency('')
                        }}
                        options={destinations.map((register) => ({
                          label: register.name,
                          srLabel: 'каса-отримувач',
                          value: register.id,
                        }))}
                        selectionTone="brand"
                        value={toRegisterId}
                      />
                    </Field>
                    <Field label="Сума зарахування">
                      <div className="grid grid-cols-[minmax(0,1fr)_7.25rem] items-stretch gap-2">
                        <TextInput
                          className="h-11 min-h-11 rounded-[10px] px-3.5 font-mono text-[17px] font-semibold tabular-nums"
                          inputMode="decimal"
                          min="0"
                          numeric
                          onChange={(event) => setAmountIn(event.target.value)}
                          placeholder="0"
                          required
                          step="0.01"
                          type="number"
                          value={amountIn}
                        />
                        <Segmented
                          className="h-11 flex-nowrap rounded-[10px] p-1 [&>label]:h-full [&>label]:min-h-0 [&>label]:min-w-0 [&>label]:rounded-[7px] [&>label]:px-2"
                          label="Валюта зарахування"
                          name="transfer-to-currency"
                          onChange={setToCurrency}
                          options={transferCurrencies.map((currency) => ({
                            ...currency,
                            disabled:
                              destination === undefined ||
                              !Object.hasOwn(
                                destination.balances,
                                currency.value,
                              ),
                          }))}
                          selectionTone="brand"
                          value={toCurrency}
                        />
                      </div>
                    </Field>
                    {destination && toCurrency ? (
                      <p className="text-app-dim text-[12.5px] tabular-nums">
                        Баланс каси-отримувача:{' '}
                        {destination.balances[toCurrency] ?? '—'} {toCurrency}
                      </p>
                    ) : null}
                  </section>

                  <Field hint="Необовʼязково" label="Нотатка переказу">
                    <TextInput
                      onChange={(event) => setNote(event.target.value)}
                      value={note}
                    />
                  </Field>
                  {validationMessage ? (
                    <Notice tone="warn">{validationMessage}</Notice>
                  ) : null}
                </>
              )}
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
                {busy ? 'Переказуємо…' : 'Переказати кошти'}
              </Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
