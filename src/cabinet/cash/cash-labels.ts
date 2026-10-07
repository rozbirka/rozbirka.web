import { formatMoney, SOURCE_LOCALE } from '@/i18n'
import type { CashTransaction } from '@/api/cash'

/** The two kinds of till the API accepts when one is created. */
export const registerTypeLabels: Record<string, string> = {
  cash: 'Готівкова',
  bank: 'Безготівкова',
}

export const registerTypeHints: Record<string, string> = {
  cash: 'Фізичні гроші',
  bank: 'Рахунок або картка',
}

/** Movement kinds the ledger returns. Unknown codes are shown as they came. */
export const movementLabels: Record<string, string> = {
  manual_in: 'Надходження',
  manual_out: 'Витрата',
  transfer_in: 'Переказ',
  transfer_out: 'Переказ',
  sale_in: 'Продаж',
  order_payment: 'Оплата замовлення',
  order_refund: 'Повернення',
  refund_out: 'Повернення клієнту',
  intake_payment: 'Оплата приймання',
  car_purchase: 'Купівля авто',
  expense: 'Витрата',
}

export const movementText = (code: string) => movementLabels[code] ?? code

/**
 * Every currency keeps its own balance and the server never converts between
 * them, so each sum is formatted in its own currency and never added up. The
 * ISO code follows the number («142 300,00 UAH»): symbols cannot tell CAD
 * from USD. Precision is the currency's own (JPY has none).
 */
export const money = (amount: number, currency: string) =>
  formatMoney(amount, currency, SOURCE_LOCALE) ?? `${amount} ${currency}`

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
