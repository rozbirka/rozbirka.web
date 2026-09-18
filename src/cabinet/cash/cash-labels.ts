import type { CashTransaction } from '@/api/cash'

/** The two kinds of till the API accepts when one is created. */
export const registerTypeLabels: Record<string, string> = {
  cash: 'Готівкова',
  bank: 'Безготівкова',
  safe: 'Сейф',
}

export const registerTypeHints: Record<string, string> = {
  cash: 'Фізичні гроші',
  bank: 'Рахунок або картка',
  safe: 'Готівкові кошти',
}

/** Movement kinds the ledger returns. Unknown codes are shown as they came. */
export const movementLabels: Record<string, string> = {
  manual_in: 'Надходження',
  manual_out: 'Витрата',
  transfer_in: 'Переказ',
  transfer_out: 'Переказ',
  order_payment: 'Оплата замовлення',
  order_refund: 'Повернення',
  intake_payment: 'Оплата приймання',
  car_purchase: 'Купівля авто',
  expense: 'Витрата',
  sale_in: 'Продаж',
}

export const movementText = (code: string) => movementLabels[code] ?? code

/**
 * Every currency keeps its own balance and the server never converts between
 * them, so each sum is formatted in its own currency and never added up.
 */
export const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // An unexpected code (the server accepts any three letters) still has to
    // render as a number rather than throw the screen away.
    return `${amount.toFixed(2)} ${currency}`
  }
}

/** A signed amount reads as money first and as a direction second. */
export const signedMoney = (entry: CashTransaction) =>
  `${entry.direction === 'out' ? '−' : '+'}${money(Math.abs(entry.amount), entry.currency)}`

export const moment = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
}

export const day = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

export const count = (value: number) =>
  value.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')
