import type { StatusTone } from '@/components/app'
import type { Shipment, ShippingContact } from '@/api/shipping'
import { translate, type Locale, type MessageKey } from '@/i18n'
import { deliveryMessages } from '../orders/delivery/messages'
import { waybillsMessages } from './waybills-messages'

type Key = MessageKey<typeof waybillsMessages>

export interface Signal {
  label: string
  tone: StatusTone
}

const tr = (locale: Locale, key: Key) =>
  translate(waybillsMessages, locale, key)

/**
 * Nova Poshta's own tracking codes, grouped into the few words a clerk says
 * about a parcel. Codes the carrier adds later read «Відправлено»: the parcel
 * left, which is all the cabinet can tell.
 */
const RECEIVED = new Set(['9', '10', '11', '106'])
const ARRIVED = new Set(['7', '8'])
const MOVING = new Set(['4', '41', '5', '6', '101', '104', '112'])
const DELETED = new Set(['2'])

/** The «Доставка» filter: one carrier code per choice, as Core filters. */
export const DELIVERY_FILTERS = [
  { code: '1', key: 'deliveryCreated' },
  { code: '5', key: 'deliveryMoving' },
  { code: '7', key: 'deliveryArrived' },
  { code: '9', key: 'deliveryReceived' },
] as const satisfies readonly { code: string; key: Key }[]

const UNRESOLVED = new Set([
  'Unknown',
  'CancelUnknown',
  'Creating',
  'Cancelling',
])

/** Whether a carrier operation was left without an answer. */
export const unresolvedState = (state: string) => UNRESOLVED.has(state)

/**
 * The last known delivery status: the carrier's code where it gave one, the
 * waybill's own state otherwise. Null for a draft, which the carrier has
 * never seen (the design draws «—»).
 */
export function trackingSignal(
  state: string,
  code: string | null,
  receivedAt: string | null,
  locale: Locale,
): Signal | null {
  if (state === 'Draft') return null
  if (state === 'Cancelled' || (code !== null && DELETED.has(code)))
    return { label: tr(locale, 'deliveryCancelled'), tone: 'neutral' }
  if (receivedAt !== null || (code !== null && RECEIVED.has(code)))
    return { label: tr(locale, 'deliveryReceived'), tone: 'ok' }
  if (code !== null && ARRIVED.has(code))
    return { label: tr(locale, 'deliveryArrived'), tone: 'info' }
  if (code !== null && MOVING.has(code))
    return { label: tr(locale, 'deliveryMoving'), tone: 'info' }
  if (code === null || code === '1') {
    if (state === 'Unknown' || state === 'Creating') return null
    return { label: tr(locale, 'deliveryCreated'), tone: 'info' }
  }
  return { label: tr(locale, 'deliverySent'), tone: 'info' }
}

/** The «Доставка» column and card pill: unresolved operations read «Невідомо». */
export function deliverySignal(
  state: string,
  code: string | null,
  receivedAt: string | null,
  locale: Locale,
): Signal | null {
  if (unresolvedState(state))
    return { label: tr(locale, 'deliveryUnknown'), tone: 'warn' }
  return trackingSignal(state, code, receivedAt, locale)
}

/** The line under the COD amount in the list, from Core's payment summary. */
export function listCodNote(
  state: string,
  paymentState: string | null,
  locale: Locale,
): { text: string; tone?: 'ok' | 'warn' } | null {
  if (state === 'Draft') return { text: tr(locale, 'codNotCreated') }
  switch (paymentState) {
    case 'Paid':
    case 'Reconciled':
      return { text: tr(locale, 'codPaid'), tone: 'ok' }
    case 'AwaitingTransfer':
      return { text: tr(locale, 'codAwaiting') }
    case 'NeedsReconciliation':
      return { text: tr(locale, 'codReconcile'), tone: 'warn' }
    case 'CashRegisterRequired':
    case 'PermissionRequired':
      return { text: tr(locale, 'codManual'), tone: 'warn' }
    case 'LatePaymentNeedsRefund':
    case 'LateRefundRequired':
      return { text: tr(locale, 'codRefund'), tone: 'warn' }
    case 'LateRefunded':
    case 'Refunded':
      return { text: tr(locale, 'codRefunded') }
    default:
      return null
  }
}

/**
 * The card's «Оплата» pill. Core keeps how the carrier's payout was booked;
 * before any payout the order's balance tells paid from awaited.
 */
export function cardPaymentSignal(
  shipment: Pick<Shipment, 'state' | 'paymentState' | 'codUah'>,
  outstandingUah: number | null,
  locale: Locale,
): Signal {
  if (shipment.state === 'Draft')
    return { label: tr(locale, 'payUnpaid'), tone: 'neutral' }
  if (shipment.state === 'Cancelled')
    return { label: tr(locale, 'payNotApplicable'), tone: 'neutral' }
  switch (shipment.paymentState) {
    case 'Reconciled':
      return { label: tr(locale, 'payPaid'), tone: 'ok' }
    case 'NeedsReconciliation':
      return { label: tr(locale, 'payReconcile'), tone: 'warn' }
    case 'CashRegisterRequired':
    case 'PermissionRequired':
      return { label: tr(locale, 'payManual'), tone: 'warn' }
    case 'LatePaymentNeedsRefund':
    case 'LateRefundRequired':
      return { label: tr(locale, 'payRefund'), tone: 'warn' }
    case 'LateRefunded':
      return { label: tr(locale, 'payRefunded'), tone: 'neutral' }
  }
  if (outstandingUah !== null && outstandingUah <= 0)
    return { label: tr(locale, 'payPaid'), tone: 'ok' }
  if ((shipment.codUah ?? 0) > 0)
    return { label: tr(locale, 'payAwaiting'), tone: 'warn' }
  return { label: tr(locale, 'payUnpaid'), tone: 'neutral' }
}

/** The second header chip of an unresolved waybill (8.4). */
export function unresolvedSignal(state: string, locale: Locale): Signal {
  return {
    label: translate(
      deliveryMessages,
      locale,
      state === 'CancelUnknown' || state === 'Cancelling'
        ? 'stateCancelUnknown'
        : 'shipUnknown',
    ),
    tone: 'warn',
  }
}

/** `Київ` out of `м. Київ, Київська обл.` — the town a clerk says. */
export const townOf = (name: string | null | undefined): string =>
  (name ?? '')
    .split(',')[0]
    ?.replace(/^(м\.|с\.|смт)\s*/u, '')
    .trim() ?? ''

/** `№12` out of `Відділення №12 (до 30 кг): вул. Богатирська, 6`. */
const branchOf = (name: string | null | undefined): string =>
  /№\s*\d+/u.exec(name ?? '')?.[0].replace(/\s+/gu, '') ?? ''

/** `Львів · №5`, how the list and the sender fact name a branch. */
export const shortPlace = (contact: ShippingContact): string =>
  [townOf(contact.settlementName), branchOf(contact.warehouseName)]
    .filter((part) => part !== '')
    .join(' · ') || '—'

/** `Львів · Відділення №5: вул. Городоцька, 120`, the card's «Куди». */
export const fullPlace = (contact: ShippingContact): string =>
  [townOf(contact.settlementName), contact.warehouseName ?? '']
    .filter((part) => part !== '')
    .join(' · ') || '—'
