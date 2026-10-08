import type { StatusTone } from '@/components/app'
import type { ShipmentDraft, Shipment } from '@/api/shipping'
import { translate, type Locale, type MessageKey } from '@/i18n'
import { hryvnia } from './delivery-money'
import { deliveryMessages } from './messages'

/** Core refuses to create a waybill on a quote older than this. */
export const QUOTE_TTL_MS = 24 * 60 * 60 * 1000

type DeliveryKey = MessageKey<typeof deliveryMessages>

const STATES: Record<string, { key: DeliveryKey; tone: StatusTone }> = {
  Draft: { key: 'stateDraft', tone: 'neutral' },
  Creating: { key: 'stateCreating', tone: 'info' },
  Created: { key: 'stateCreated', tone: 'ok' },
  Unknown: { key: 'shipUnknown', tone: 'warn' },
  Cancelling: { key: 'stateCancelling', tone: 'info' },
  Cancelled: { key: 'stateCancelled', tone: 'neutral' },
  CancelUnknown: { key: 'stateCancelUnknown', tone: 'warn' },
}

export function shipmentStatePresentation(
  state: string,
  locale: Locale,
): {
  label: string
  tone: StatusTone
} {
  const known = STATES[state]
  return known === undefined
    ? { label: state, tone: 'neutral' }
    : {
        label: translate(deliveryMessages, locale, known.key),
        tone: known.tone,
      }
}

/**
 * The six states the delivery form can be in around its quote. Core stores
 * only the quote and its timestamp — it clears the timestamp whenever the
 * draft is saved — so "the form no longer matches the quote" is something the
 * screen knows and the service cannot.
 */
export type QuoteState =
  | { kind: 'none' }
  | { kind: 'busy' }
  | { kind: 'ready'; at: string }
  | { kind: 'stale'; at: string }
  | { kind: 'dirty'; at: string }
  | { kind: 'failed'; message: string }

export function quoteState({
  shipment,
  dirty,
  busy,
  failure,
  now = Date.now(),
}: {
  shipment: Shipment | null
  dirty: boolean
  busy: boolean
  failure: string | null
  now?: number
}): QuoteState {
  if (busy) return { kind: 'busy' }
  if (failure !== null) return { kind: 'failed', message: failure }
  const at = shipment?.quoteAt ?? null
  if (at === null || shipment?.quoteUah === null) return { kind: 'none' }
  if (dirty) return { kind: 'dirty', at }
  return now - Date.parse(at) > QUOTE_TTL_MS
    ? { kind: 'stale', at }
    : { kind: 'ready', at }
}

export interface QuotePresentation {
  title: string
  note: string
  tone: 'plain' | 'ok' | 'warn' | 'danger'
  /** Shows the saved amounts, dimmed when they no longer answer the form. */
  showMoney: boolean
  dimMoney: boolean
  action: string
  canCreate: boolean
}

export function quotePresentation(
  state: QuoteState,
  locale: Locale,
): QuotePresentation {
  const t = (key: DeliveryKey) => translate(deliveryMessages, locale, key)
  switch (state.kind) {
    case 'busy':
      return {
        title: t('quoteBusyTitle'),
        note: t('quoteBusyNote'),
        tone: 'plain',
        showMoney: false,
        dimMoney: false,
        action: t('quoteBusyAction'),
        canCreate: false,
      }
    case 'ready':
      return {
        title: t('quoteReadyTitle'),
        note: t('quoteReadyNote'),
        tone: 'ok',
        showMoney: true,
        dimMoney: false,
        action: t('quoteRecalc'),
        canCreate: true,
      }
    case 'stale':
      return {
        title: t('quoteStaleTitle'),
        note: t('quoteStaleNote'),
        tone: 'warn',
        showMoney: true,
        dimMoney: true,
        action: t('quoteRecalc'),
        canCreate: false,
      }
    case 'dirty':
      return {
        title: t('quoteDirtyTitle'),
        note: t('quoteDirtyNote'),
        tone: 'warn',
        showMoney: true,
        dimMoney: true,
        action: t('quoteDirtyAction'),
        canCreate: false,
      }
    case 'failed':
      return {
        title: t('quoteFailedTitle'),
        note: state.message,
        tone: 'danger',
        showMoney: false,
        dimMoney: false,
        action: t('quoteRetry'),
        canCreate: false,
      }
    default:
      return {
        title: t('quoteNoneTitle'),
        note: t('quoteNoneNote'),
        tone: 'plain',
        showMoney: false,
        dimMoney: false,
        action: t('quoteNoneAction'),
        canCreate: false,
      }
  }
}

const sameContact = (
  a: ShipmentDraft['recipient'],
  b: ShipmentDraft['recipient'],
): boolean =>
  a.name === b.name &&
  a.phone === b.phone &&
  a.settlementRef === b.settlementRef &&
  a.warehouseRef === b.warehouseRef &&
  (a.companyName ?? null) === (b.companyName ?? null) &&
  (a.companyTin ?? null) === (b.companyTin ?? null)

/**
 * Field by field, because key order in a serialized draft is not a difference
 * a person made — comparing the two as text called every untouched form dirty
 * and demanded a pointless save before each quote.
 */
export function sameDraft(a: ShipmentDraft, b: ShipmentDraft): boolean {
  return (
    sameContact(a.recipient, b.recipient) &&
    a.parcels.length === b.parcels.length &&
    a.parcels.every((parcel, index) => {
      const other = b.parcels[index]
      return (
        parcel.weightKg === other?.weightKg &&
        parcel.lengthCm === other.lengthCm &&
        parcel.widthCm === other.widthCm &&
        parcel.heightCm === other.heightCm
      )
    }) &&
    a.declaredValueUah === b.declaredValueUah &&
    a.payerType === b.payerType &&
    a.description === b.description &&
    (a.dispatchPointId ?? null) === (b.dispatchPointId ?? null)
  )
}

/** Core's own ceiling for an order total. */
const AGREED_TOTAL_MAX = 9_999_999_999

/**
 * The agreed order total as Core will take it: an ordinary hryvnia figure that
 * also stays under Core's ceiling.
 */
export function agreedTotal(input: string): number | null {
  const value = hryvnia(input)
  return value !== null && value <= AGREED_TOTAL_MAX ? value : null
}

/** Prepayment is delivery plus the return the manager estimated — not a tariff. */
export function prepayment(shipment: Shipment | null): number | null {
  if (shipment?.quoteUah === null || shipment === null) return null
  return shipment.quoteUah + shipment.returnEstimateUah
}
