import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { cashApi, type CashRegister } from '@/api/cash'
import type { ConfirmPayment } from '@/api/orders'
import {
  Button,
  Field,
  Notice,
  Segmented,
  SkeletonRows,
  TextInput,
} from '@/components/app'
import { normalizeApiProblem } from '@/api/errors'

interface PaymentDraft {
  accountId: string
  amount: string
  currency: string
}

export interface PendingOrderPayment extends ConfirmPayment {
  accountName: string
}

const newPayment = (amount = ''): PaymentDraft => ({
  accountId: '',
  amount,
  currency: '',
})

const amountText = (value: number | null) =>
  value === null || !Number.isFinite(value) ? '' : String(Math.max(0, value))

const paymentMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${String(amount)} ${currency}`
  }
}

const paymentKind = (register: CashRegister | undefined) =>
  register?.type === 'bank'
    ? `Безготівкове надходження · ${register.name}`
    : register
      ? 'Надходження в касу готівкою'
      : 'Оберіть касу'

export function OrderPaymentDialog({
  busy,
  error,
  initialPayments,
  onSave,
  onOpenChange,
  open,
  orderNumber,
  totalAmount,
}: {
  busy: boolean
  error: string | null
  initialPayments: PendingOrderPayment[]
  onSave: (payments: PendingOrderPayment[]) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  orderNumber: number
  totalAmount: number | null
}) {
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [drafts, setDrafts] = useState<PaymentDraft[]>(() =>
    initialPayments.length > 0
      ? initialPayments.map(({ accountId, amount, currency }) => ({
          accountId,
          amount: String(amount),
          currency,
        }))
      : [newPayment(amountText(totalAmount))],
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void cashApi
      .list(true, { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted)
          setRegisters(items.filter((item) => item.isActive))
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setLoadError(normalizeApiProblem(reason).message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [open])

  const invalid =
    loading ||
    registers.length === 0 ||
    drafts.length === 0 ||
    drafts.some((draft) => {
      const amount = Number(draft.amount)
      return (
        !draft.accountId ||
        !draft.currency ||
        draft.amount === '' ||
        !Number.isFinite(amount) ||
        amount <= 0
      )
    })

  const updateDraft = (index: number, patch: Partial<PaymentDraft>) =>
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (invalid) return
    onSave(
      drafts.map((draft) => ({
        accountId: draft.accountId,
        accountName:
          registers.find((register) => register.id === draft.accountId)?.name ??
          draft.accountId,
        amount: Number(draft.amount),
        currency: draft.currency,
      })),
    )
  }

  const contributed = drafts.reduce<Record<string, number>>((totals, draft) => {
    const amount = Number(draft.amount)
    if (draft.currency && Number.isFinite(amount) && amount > 0)
      totals[draft.currency] = (totals[draft.currency] ?? 0) + amount
    return totals
  }, {})
  const contributedEntries = Object.entries(contributed).sort(
    ([left], [right]) => {
      const priority = (currency: string) =>
        currency === 'USD' ? 0 : currency === 'UAH' ? 1 : 2
      return priority(left) - priority(right) || left.localeCompare(right)
    },
  )

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
        <Dialog.Content className="bg-app-canvas border-app-line fixed inset-x-0 bottom-0 z-50 grid max-h-[92dvh] grid-rows-[1fr] overflow-hidden rounded-t-[24px] border-t text-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-none sm:w-full sm:max-w-[600px] sm:rounded-none sm:border-t-0 sm:border-l">
          <form
            aria-busy={busy}
            className="grid min-h-0 grid-rows-[auto_auto_1fr_auto]"
            onSubmit={submit}
          >
            <header className="border-app-line flex items-start justify-between gap-5 border-b px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-app-dim font-mono text-[10px] font-semibold tracking-[0.16em] uppercase">
                  Замовлення #{orderNumber} · Оплата
                </p>
                <Dialog.Title className="mt-2 text-[26px] leading-none font-extrabold tracking-[-0.025em]">
                  Додати платіж
                </Dialog.Title>
                <Dialog.Description className="text-app-muted mt-2 text-sm">
                  Можна внести кілька платежів у різні каси й валюти.
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

            <section
              aria-label="Зведення платежів"
              className="border-app-line grid grid-cols-2 border-b"
            >
              <div className="border-app-line border-r px-5 py-4 sm:px-6">
                <p className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
                  Сума замовлення
                </p>
                <p className="mt-2 text-[24px] font-extrabold text-white tabular-nums">
                  {totalAmount === null
                    ? '—'
                    : paymentMoney(totalAmount, 'USD')}
                </p>
              </div>
              <div className="px-5 py-4 sm:px-6">
                <p className="text-app-dim font-mono text-[10px] tracking-[0.14em] uppercase">
                  Вносять зараз
                </p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[20px] font-extrabold text-white tabular-nums">
                  {contributedEntries.length === 0
                    ? '—'
                    : contributedEntries.map(([currency, amount]) => (
                        <span key={currency}>
                          {paymentMoney(amount, currency)}
                        </span>
                      ))}
                </p>
                <p className="text-app-dim mt-1 text-xs">
                  {drafts.length} {drafts.length === 1 ? 'платіж' : 'платежі'}
                </p>
              </div>
            </section>

            <div className="grid min-h-0 content-start gap-3 overflow-y-auto px-5 py-4 sm:px-6">
              {(loadError ?? error) ? (
                <Notice tone="danger">{loadError ?? error}</Notice>
              ) : null}
              {loading ? (
                <SkeletonRows label="Завантажуємо каси…" rows={2} />
              ) : registers.length === 0 && loadError === null ? (
                <Notice tone="warn">Немає активної каси для оплати.</Notice>
              ) : (
                <>
                  {drafts.map((draft, index) => {
                    const register = registers.find(
                      (item) => item.id === draft.accountId,
                    )
                    const currencies = register
                      ? Object.keys(register.balances).sort()
                      : []
                    const numericAmount = Number(draft.amount)
                    return (
                      <fieldset
                        className="border-app-line bg-app-raised rounded-[16px] border p-4"
                        key={index}
                      >
                        <legend className="sr-only">Платіж {index + 1}</legend>
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="flex items-center gap-2.5 text-sm font-bold text-white">
                            <span className="bg-white/[0.07] text-app-muted grid size-7 place-items-center rounded-lg font-mono text-xs">
                              {index + 1}
                            </span>
                            Платіж {index + 1}
                          </p>
                          <Button
                            aria-label={`Прибрати платіж ${index + 1}`}
                            className="min-h-8 px-2.5 text-xs"
                            onClick={() =>
                              setDrafts((current) =>
                                current.filter(
                                  (_, draftIndex) => draftIndex !== index,
                                ),
                              )
                            }
                            type="button"
                            variant="quiet"
                          >
                            <Trash2 aria-hidden />
                            Прибрати
                          </Button>
                        </div>
                        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-[minmax(0,1fr)_minmax(250px,0.9fr)] sm:items-start">
                          <Field label="Каса" className="min-w-0">
                            <Segmented
                              className="w-fit max-w-full border-0 bg-transparent p-0 [&>label]:min-h-10 [&>label]:flex-none [&>label]:border [&>label]:border-app-line-2 [&>label]:bg-app-input [&>label]:px-3.5"
                              label={`Каса платежу ${index + 1}`}
                              name={`payment-account-${index}`}
                              onChange={(accountId) => {
                                const nextRegister = registers.find(
                                  (item) => item.id === accountId,
                                )
                                const nextCurrencies = nextRegister
                                  ? Object.keys(nextRegister.balances).sort()
                                  : []
                                updateDraft(index, {
                                  accountId,
                                  currency:
                                    nextCurrencies.length === 1
                                      ? (nextCurrencies[0] ?? '')
                                      : nextCurrencies.includes(draft.currency)
                                        ? draft.currency
                                        : '',
                                })
                              }}
                              options={registers.map((item) => ({
                                label: item.name,
                                value: item.id,
                              }))}
                              selectionTone="brand"
                              value={draft.accountId}
                            />
                          </Field>
                          <Field label="Сума" className="min-w-0">
                            <div className="grid grid-cols-[minmax(0,1fr)_7.25rem] items-stretch gap-2">
                              <TextInput
                                aria-label={
                                  index === 0
                                    ? 'Сума платежу'
                                    : `Сума платежу ${index + 1}`
                                }
                                inputMode="decimal"
                                min="0"
                                onChange={(event) =>
                                  updateDraft(index, {
                                    amount: event.target.value,
                                  })
                                }
                                step="0.01"
                                type="number"
                                value={draft.amount}
                                numeric
                                className="h-11 min-h-11 rounded-[10px] px-3.5 font-mono text-[17px] font-semibold tabular-nums"
                              />
                              {currencies.length === 0 ? (
                                <div className="border-app-line-2 bg-app-input text-app-dim flex h-11 items-center justify-center rounded-[10px] border px-3 text-xs">
                                  Валюта
                                </div>
                              ) : (
                                <Segmented
                                  className="h-11 flex-nowrap rounded-[10px] p-1 [&>label]:h-full [&>label]:min-h-0 [&>label]:min-w-0 [&>label]:rounded-[7px] [&>label]:px-2"
                                  label={`Валюта платежу ${index + 1}`}
                                  name={`payment-currency-${index}`}
                                  onChange={(currency) =>
                                    updateDraft(index, { currency })
                                  }
                                  options={currencies.map((currency) => ({
                                    label: currency,
                                    value: currency,
                                  }))}
                                  selectionTone="brand"
                                  value={draft.currency}
                                />
                              )}
                            </div>
                          </Field>
                        </div>
                        <div className="border-app-line mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                          <p className="text-app-dim text-xs">
                            {paymentKind(register)}
                          </p>
                          <p className="text-app-muted font-mono text-sm tabular-nums">
                            {draft.currency &&
                            Number.isFinite(numericAmount) &&
                            numericAmount > 0
                              ? paymentMoney(numericAmount, draft.currency)
                              : '—'}
                          </p>
                        </div>
                      </fieldset>
                    )
                  })}
                  <Button
                    className="w-full justify-center border-dashed"
                    onClick={() =>
                      setDrafts((current) => [...current, newPayment()])
                    }
                    type="button"
                    variant="quiet"
                  >
                    <Plus aria-hidden />
                    Новий платіж
                  </Button>
                </>
              )}
            </div>

            <footer className="border-app-line bg-app-canvas flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
              <p className="text-app-muted min-w-0 flex-1 text-xs tabular-nums">
                {drafts.length} {drafts.length === 1 ? 'платіж' : 'платежі'}
                {contributedEntries.length > 0 ? ': ' : ''}
                {contributedEntries.map(([currency, amount], index) => (
                  <span key={currency}>
                    {index > 0 ? ' · ' : ''}
                    {paymentMoney(amount, currency)}
                  </span>
                ))}
              </p>
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <Button disabled={busy} type="button">
                    Скасувати
                  </Button>
                </Dialog.Close>
                <Button
                  aria-busy={busy}
                  disabled={busy || invalid}
                  type="submit"
                  variant="primary"
                >
                  Зберегти платежі
                </Button>
              </div>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
