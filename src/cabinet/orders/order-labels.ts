import type { StatusTone } from '@/components/app'
import { SOURCE_LOCALE, translate, type Locale, type MessageKey } from '@/i18n'
import { orderMessages } from './messages'

type OrderKey = MessageKey<typeof orderMessages>

const STATUSES: Record<string, { key: OrderKey; tone: StatusTone }> = {
  confirmed: { key: 'statusConfirmed', tone: 'ok' },
  pending: { key: 'statusPending', tone: 'warn' },
  cancelled: { key: 'statusCancelled', tone: 'neutral' },
  refunded: { key: 'statusRefunded', tone: 'info' },
  // The dashboard summary speaks of an order's money rather than its state.
  paid: { key: 'statusPaid', tone: 'ok' },
  reserved: { key: 'statusReserved', tone: 'warn' },
}

/**
 * An order's status said the way the yard says it, with the colour it is drawn
 * in. Kept in one place so an order reads the same on its own page, in the
 * list and on a customer's card; a status the vocabulary does not know is
 * shown as it came rather than guessed at. Ukrainian unless a locale is given
 * (screens pass `useLocale().locale`).
 */
export const orderStatusPresentation = (
  status: string,
  locale: Locale = SOURCE_LOCALE,
): { label: string; tone: StatusTone } => {
  const known = STATUSES[status]
  return known === undefined
    ? { label: status, tone: 'neutral' }
    : { label: translate(orderMessages, locale, known.key), tone: known.tone }
}

/**
 * What Core calls a change to an order, in words. A code the vocabulary does
 * not know reads as a plain update rather than as raw text.
 */
const ORDER_EVENTS: Record<string, OrderKey> = {
  created: 'eventCreated',
  itemsupdated: 'eventItemsUpdated',
  itemupdated: 'eventItemUpdated',
  notesupdated: 'eventNotesUpdated',
  customerset: 'eventCustomerChanged',
  customerchanged: 'eventCustomerChanged',
  confirmed: 'eventConfirmed',
  paymentaccepted: 'eventPaymentAccepted',
  cancelled: 'eventCancelled',
  refunded: 'eventRefunded',
}

export const orderEventTitle = (
  eventType: string,
  locale: Locale = SOURCE_LOCALE,
) =>
  translate(
    orderMessages,
    locale,
    ORDER_EVENTS[eventType.toLowerCase().replace(/[^a-z0-9]/g, '')] ??
      'eventUpdated',
  )
