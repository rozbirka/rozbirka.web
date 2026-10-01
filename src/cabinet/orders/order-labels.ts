import type { StatusTone } from '@/components/app'

/**
 * An order's status said the way the yard says it, with the colour it is drawn
 * in. Kept in one place so an order reads the same on its own page, in the
 * list and on a customer's card; a status the vocabulary does not know is
 * shown as it came rather than guessed at.
 */
export const orderStatusPresentation = (
  status: string,
): { label: string; tone: StatusTone } => {
  if (status === 'confirmed') return { label: 'Підтверджено', tone: 'ok' }
  if (status === 'pending') return { label: 'Очікує', tone: 'warn' }
  if (status === 'cancelled') return { label: 'Скасовано', tone: 'neutral' }
  if (status === 'refunded') return { label: 'Повернено', tone: 'info' }
  // The dashboard summary speaks of an order's money rather than its state.
  if (status === 'paid') return { label: 'Оплачено', tone: 'ok' }
  if (status === 'reserved') return { label: 'Резерв', tone: 'warn' }
  return { label: status, tone: 'neutral' }
}

/**
 * What Core calls a change to an order, said in Ukrainian. A code the
 * vocabulary does not know reads as a plain update rather than as raw text.
 */
const ORDER_EVENTS: Record<string, string> = {
  created: 'Замовлення створено',
  itemsupdated: 'Позиції оновлено',
  itemupdated: 'Позицію оновлено',
  notesupdated: 'Нотатки оновлено',
  customerset: 'Клієнта змінено',
  customerchanged: 'Клієнта змінено',
  confirmed: 'Замовлення підтверджено',
  paymentaccepted: 'Платіж прийнято',
  cancelled: 'Замовлення скасовано',
  refunded: 'Кошти повернено',
}

export const orderEventTitle = (eventType: string) =>
  ORDER_EVENTS[eventType.toLowerCase().replace(/[^a-z0-9]/g, '')] ??
  'Замовлення оновлено'
