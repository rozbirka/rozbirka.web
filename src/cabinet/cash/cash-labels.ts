import { useMemo } from 'react'
import {
  formatDateWith,
  formatMoney,
  formatNumber,
  useLocale,
  useT,
  type MessageKey,
} from '@/i18n'
import type { CashTransaction } from '@/api/cash'
import { cashMessages } from './cash-messages'

type CashKey = MessageKey<typeof cashMessages>

/** The two kinds of till the API accepts when one is created. */
const REGISTER_TYPE: Readonly<Record<string, CashKey>> = {
  cash: 'typeCash',
  bank: 'typeBank',
}

const REGISTER_HINT: Readonly<Record<string, CashKey>> = {
  cash: 'typeCashHint',
  bank: 'typeBankHint',
}

/** Movement kinds the ledger returns. Unknown codes are shown as they came. */
const MOVEMENT: Readonly<Record<string, CashKey>> = {
  manual_in: 'mvIncome',
  manual_out: 'mvExpense',
  transfer_in: 'mvTransfer',
  transfer_out: 'mvTransfer',
  sale_in: 'mvSale',
  order_payment: 'mvOrderPayment',
  order_refund: 'mvOrderRefund',
  refund_out: 'mvRefundOut',
  intake_payment: 'mvIntakePayment',
  car_purchase: 'mvCarPurchase',
  expense: 'mvExpense',
}

export interface CashText {
  /**
   * Every currency keeps its own balance and the server never converts
   * between them, so each sum is formatted in its own currency and never
   * added up. The ISO code follows the number («142 300,00 UAH»): symbols
   * cannot tell CAD from USD. Precision is the currency's own (JPY has none).
   */
  money: (amount: number, currency: string) => string
  /** A signed amount reads as money first and as a direction second. */
  signedMoney: (entry: CashTransaction) => string
  /** Day, month and time in the business time zone. */
  moment: (value: string) => string
  count: (value: number) => string
  movementText: (code: string) => string
  registerType: (type: string) => string
  registerHint: (type: string) => string | null
}

/** Cash formatting and vocabulary in the interface language. */
export function useCashText(): CashText {
  const { locale, timeZone } = useLocale()
  const t = useT(cashMessages)
  return useMemo<CashText>(() => {
    const money = (amount: number, currency: string) =>
      formatMoney(amount, currency, locale) ?? `${amount} ${currency}`
    const label = (map: Readonly<Record<string, CashKey>>, code: string) => {
      const key = map[code]
      return key === undefined ? null : t(key)
    }
    return {
      money,
      signedMoney: (entry) =>
        `${entry.direction === 'out' ? '−' : '+'}${money(Math.abs(entry.amount), entry.currency)}`,
      moment: (value) =>
        formatDateWith(
          value,
          locale,
          {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          },
          timeZone,
        ) ?? value,
      count: (value) => formatNumber(value, locale) ?? String(value),
      movementText: (code) => label(MOVEMENT, code) ?? code,
      registerType: (type) => label(REGISTER_TYPE, type) ?? type,
      registerHint: (type) => label(REGISTER_HINT, type),
    }
  }, [locale, t, timeZone])
}
