import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDown } from 'lucide-react'
import type { CashRegister, CashTransferInput } from '@/api/cash'
import {
  Button,
  Field,
  Notice,
  Segmented,
  Sheet,
  TextInput,
} from '@/components/app'
import { tillCurrencies } from '../currency/catalog-order'

const eyebrowClass =
  'text-app-dim font-mono text-[11.5px] tracking-[0.12em] uppercase'
/** A till's own currencies (catalog order); a transfer never invents one. */
const currencyOptions = (register: CashRegister | undefined) =>
  register === undefined
    ? []
    : tillCurrencies(register).map((code) => ({ label: code, value: code }))

interface CashTransferDrawerProps {
  busy: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CashTransferInput) => void
  open: boolean
  registers: CashRegister[]
}

export function CashTransferDrawer(props: CashTransferDrawerProps) {
  if (!props.open) return null
  return <OpenCashTransferDrawer {...props} />
}

function OpenCashTransferDrawer({
  busy,
  error,
  onOpenChange,
  onSubmit,
  open,
  registers,
}: CashTransferDrawerProps) {
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
    <Sheet
      description="Вкажіть, звідки списати кошти та куди їх зарахувати."
      eyebrow="Гроші · Каси"
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
            form={CASH_TRANSFER_FORM}
            type="submit"
            variant="primary"
          >
            {busy ? 'Переказуємо…' : 'Переказати кошти'}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (busy && !next) return
        onOpenChange(next)
      }}
      open={open}
      title="Переказ між касами"
    >
      <form
        aria-busy={busy}
        className="grid content-start gap-4"
        id={CASH_TRANSFER_FORM}
        onSubmit={submit}
      >
        {activeRegisters.length < 2 ? (
          <Notice role="status" tone="info">
            Переказ потребує ще однієї активної каси. Створіть другу касу або
            активуйте наявну.
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
                <div className="grid gap-2">
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
                    className="w-fit max-w-full flex-wrap rounded-[10px] p-1 [&>label]:min-h-9 [&>label]:min-w-14 [&>label]:flex-none [&>label]:rounded-[7px] [&>label]:px-2 [&>label]:font-mono"
                    label="Валюта списання"
                    name="transfer-from-currency"
                    onChange={setFromCurrency}
                    options={currencyOptions(source)}
                    selectionTone="brand"
                    value={fromCurrency}
                  />
                </div>
              </Field>
              {source && fromCurrency ? (
                <p className="text-app-dim text-[12.5px] tabular-nums">
                  Доступно в цій касі: {source.balances[fromCurrency] ?? '—'}{' '}
                  {fromCurrency}
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
                <div className="grid gap-2">
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
                    className="w-fit max-w-full flex-wrap rounded-[10px] p-1 [&>label]:min-h-9 [&>label]:min-w-14 [&>label]:flex-none [&>label]:rounded-[7px] [&>label]:px-2 [&>label]:font-mono"
                    label="Валюта зарахування"
                    name="transfer-to-currency"
                    onChange={setToCurrency}
                    options={currencyOptions(destination)}
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
      </form>
    </Sheet>
  )
}

const CASH_TRANSFER_FORM = 'cash-transfer-form'
