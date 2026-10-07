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
import { commonMessages, useLocale, useT } from '@/i18n'
import { amountPrecisionError } from '../currency/amount-precision'
import { tillCurrencies } from '../currency/catalog-order'
import { cashMessages } from './cash-messages'

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
  const t = useT(cashMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
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
  const precisionMessage =
    (amountOut !== '' && Number.isFinite(amountOutNumber) && fromCurrency
      ? amountPrecisionError(amountOutNumber, fromCurrency, locale)
      : null) ??
    (amountIn !== '' && Number.isFinite(amountInNumber) && toCurrency
      ? amountPrecisionError(amountInNumber, toCurrency, locale)
      : null)
  const validationMessage =
    precisionMessage ??
    (sourceSupportsCurrency &&
    amountOut !== '' &&
    Number.isFinite(amountOutNumber) &&
    amountOutNumber > (source.balances[fromCurrency] ?? 0)
      ? t('errSourceInsufficient')
      : fromCurrency !== '' && !sourceSupportsCurrency
        ? t('errSourceCurrency')
        : toCurrency !== '' && !destinationSupportsCurrency
          ? t('errDestinationCurrency')
          : fromCurrency !== '' &&
              fromCurrency === toCurrency &&
              amountOut !== '' &&
              amountIn !== '' &&
              amountOutNumber !== amountInNumber
            ? t('errSameCurrency')
            : null)
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
      description={t('transferDescription')}
      eyebrow={t('crumb')}
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
            form={CASH_TRANSFER_FORM}
            type="submit"
            variant="primary"
          >
            {busy ? t('transferring') : t('transferSubmit')}
          </Button>
        </>
      }
      onOpenChange={(next) => {
        if (busy && !next) return
        onOpenChange(next)
      }}
      open={open}
      title={t('transfer')}
    >
      <form
        aria-busy={busy}
        className="grid content-start gap-4"
        id={CASH_TRANSFER_FORM}
        onSubmit={submit}
      >
        {activeRegisters.length < 2 ? (
          <Notice role="status" tone="info">
            {t('needSecondTill')}
          </Notice>
        ) : (
          <>
            <section className="border-app-line bg-app-raised rounded-[16px] grid gap-4 border p-4">
              <p className={eyebrowClass}>{t('fromHeading')}</p>
              <Field label={t('sourceTill')}>
                <Segmented
                  className="w-fit max-w-full border-0 bg-transparent p-0 [&>label]:min-h-10 [&>label]:flex-none [&>label]:border [&>label]:border-app-line-2 [&>label]:bg-app-input [&>label]:px-3.5"
                  label={t('sourceTill')}
                  name="transfer-from-register"
                  onChange={(registerId) => {
                    setFromRegisterId(registerId)
                    setFromCurrency('')
                    setToRegisterId('')
                    setToCurrency('')
                  }}
                  options={activeRegisters.map((register) => ({
                    label: register.name,
                    srLabel: t('sourceTillSr'),
                    value: register.id,
                  }))}
                  selectionTone="brand"
                  value={selectedFromId}
                />
              </Field>
              <Field label={t('amountOut')}>
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
                    label={t('currencyOut')}
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
                  {t('availableHere', {
                    amount: `${source.balances[fromCurrency] ?? '—'} ${fromCurrency}`,
                  })}
                </p>
              ) : null}
            </section>

            <div aria-hidden className="flex items-center gap-3">
              <span className="bg-app-line h-px flex-1" />
              <ArrowDown className="text-app-dim size-4 shrink-0" />
              <span className="bg-app-line h-px flex-1" />
            </div>

            <section className="border-app-line bg-app-raised rounded-[16px] grid gap-4 border p-4">
              <p className={eyebrowClass}>{t('toHeading')}</p>
              <Field label={t('destinationTill')}>
                <Segmented
                  className="w-fit max-w-full border-0 bg-transparent p-0 [&>label]:min-h-10 [&>label]:flex-none [&>label]:border [&>label]:border-app-line-2 [&>label]:bg-app-input [&>label]:px-3.5"
                  label={t('destinationTill')}
                  name="transfer-to-register"
                  onChange={(registerId) => {
                    setToRegisterId(registerId)
                    setToCurrency('')
                  }}
                  options={destinations.map((register) => ({
                    label: register.name,
                    srLabel: t('destinationTillSr'),
                    value: register.id,
                  }))}
                  selectionTone="brand"
                  value={toRegisterId}
                />
              </Field>
              <Field label={t('amountIn')}>
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
                    label={t('currencyIn')}
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
                  {t('destinationBalance', {
                    amount: `${destination.balances[toCurrency] ?? '—'} ${toCurrency}`,
                  })}
                </p>
              ) : null}
            </section>

            <Field hint={t('optional')} label={t('transferNote')}>
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
