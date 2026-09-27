import type { DeliveryOrder } from '@/api/delivery'
import type { CashTransaction } from '@/api/cash'

const hryvniaFormat = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 2,
})

/** Delivery money is hryvnia only — Core refuses any other currency here. */
export const uah = (value: number): string => hryvniaFormat.format(value)

/**
 * A hryvnia figure the way the cabinet is typed: a comma is a decimal
 * separator, and Core takes at most two decimals. Null when what was typed
 * would be refused, so a caller never has to repeat the rule.
 */
export function hryvnia(
  input: string,
  { allowZero = false }: { allowZero?: boolean } = {},
): number | null {
  const text = input.trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null
  const value = Number(text.replace(',', '.'))
  return value > 0 || allowZero ? value : null
}

/**
 * What the order's money means for the waybill. Core will not create a
 * Ukrainian waybill while anything is still owed — the post-payment contract
 * is unconfirmed — so an outstanding balance is not merely a number on the
 * card, it is the thing standing between the manager and a shipment.
 */
export interface DeliveryGate {
  blocked: boolean
  title: string
  amount: number
  note: string
}

export function deliveryGate(delivery: DeliveryOrder): DeliveryGate {
  return delivery.outstandingUah > 0
    ? {
        blocked: true,
        title: 'Залишок блокує створення ТТН',
        amount: delivery.outstandingUah,
        note: 'Поки залишок не нульовий, накладну можна лише створити в кабінеті Нової пошти й прив’язати — з післяплатою рівно на цю суму.',
      }
    : {
        blocked: false,
        title: 'Залишку немає',
        amount: 0,
        note: 'Накладну можна створювати. Післяплата в ній буде нульова — рівно залишок.',
      }
}

/**
 * The deposit is a threshold on the same payments, not separate money: Core
 * counts it satisfied once the order's payments reach it. Before a carrier
 * quote exists it is zero, and zero means "not established", which blocks a
 * waybill just as firmly as a shortfall.
 */
export interface DepositState {
  kind: 'unknown' | 'short' | 'covered' | 'waived'
  label: string
  note: string
}

export function depositState(delivery: DeliveryOrder): DepositState {
  if (delivery.depositWaived)
    return {
      kind: 'waived',
      label: 'знято',
      note: 'Клієнт має ознаку довіри, тож депозит не вимагається.',
    }
  if (delivery.requiredDepositUah <= 0)
    return {
      kind: 'unknown',
      label: 'ще не визначений',
      note: 'Депозит дорівнює вартості доставки плюс оцінка повернення, тож він зʼявиться після розрахунку в панелі доставки. Без нього накладна не створюється.',
    }
  return delivery.depositSatisfied
    ? {
        kind: 'covered',
        label: 'внесено',
        note: 'Покриває ризик розбірки, якщо посилку не отримають. Це не частка суми замовлення, а вартість доставки плюс оцінка повернення.',
      }
    : {
        kind: 'short',
        label: `бракує ${uah(delivery.depositShortfallUah)}`,
        note: 'Депозит зараховується з тих самих платежів за замовленням — окремо його вносити не треба.',
      }
}

/** Where the order stands in the shipping lifecycle, as Core records it. */
export type DeliveryStage = 'open' | 'dispatched' | 'received' | 'returned'

export function deliveryStage(delivery: DeliveryOrder): DeliveryStage {
  if (delivery.returnedAt !== null) return 'returned'
  if (delivery.receivedAt !== null) return 'received'
  return delivery.dispatchedAt === null ? 'open' : 'dispatched'
}

/**
 * A recorded payment's own amount is the gross, and the till receives it minus
 * the fee. A linked transaction works the other way round: the receipt already
 * sits in the till, so the fee is added on top to reach the gross. The two
 * formulas are opposite and they sit behind one drawer, which is exactly how
 * the wrong one gets used.
 */
export function linkedGross(transaction: number, fee: number): number {
  return transaction + fee
}

export interface PaymentOutcome {
  gross: number
  over: boolean
  remaining: number
  title: string
  note: string
}

export function paymentOutcome(
  gross: number,
  outstanding: number,
): PaymentOutcome {
  if (gross > outstanding)
    return {
      gross,
      over: true,
      remaining: 0,
      title: 'Переплата — запис відмовить',
      note: 'Брутто не може перевищувати залишок за замовленням: і запис платежу, і прив’язка транзакції падають. Зменшіть суму або комісію.',
    }
  const remaining = outstanding - gross
  return {
    gross,
    over: false,
    remaining,
    title: remaining === 0 ? 'Залишок буде закритий' : 'Залишок лишиться',
    note:
      remaining === 0
        ? 'Після збереження залишок стане нульовим і накладна піде без післяплати.'
        : 'Залишок не заважає створити ТТН — він поїде післяплатою, яку Нова пошта утримає з отримувача.',
  }
}

/**
 * Receipts Core will accept for linking. It takes an incoming UAH transaction
 * that no order has claimed; `referenceId` is how a claimed one shows, and
 * cash summaries and withdrawals are not receipts at all.
 */
export function linkableTransactions(
  transactions: CashTransaction[],
): CashTransaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.direction === 'in' &&
      transaction.currency === 'UAH' &&
      transaction.amount > 0 &&
      transaction.referenceId === null &&
      (transaction.type === 'manual_in' || transaction.type === 'sale_in'),
  )
}
