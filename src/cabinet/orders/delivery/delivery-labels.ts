import type { StatusTone } from '@/components/app'
import type { ShipmentDraft, Shipment } from '@/api/shipping'

/** Core refuses to create a waybill on a quote older than this. */
export const QUOTE_TTL_MS = 24 * 60 * 60 * 1000

const STATES: Record<string, { label: string; tone: StatusTone }> = {
  Draft: { label: 'Чернетка', tone: 'neutral' },
  Creating: { label: 'Створюємо ТТН', tone: 'info' },
  Created: { label: 'ТТН створено', tone: 'ok' },
  Unknown: { label: 'Результат невідомий', tone: 'warn' },
  Cancelling: { label: 'Скасовуємо', tone: 'info' },
  Cancelled: { label: 'Скасовано', tone: 'neutral' },
  CancelUnknown: { label: 'Скасування невідоме', tone: 'warn' },
}

export function shipmentStatePresentation(state: string): {
  label: string
  tone: StatusTone
} {
  return STATES[state] ?? { label: state, tone: 'neutral' }
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

export function quotePresentation(state: QuoteState): QuotePresentation {
  switch (state.kind) {
    case 'busy':
      return {
        title: 'Розрахунок виконується',
        note: 'Не закривайте панель. Введені дані збережені у формі.',
        tone: 'plain',
        showMoney: false,
        dimMoney: false,
        action: 'Розраховуємо…',
        canCreate: false,
      }
    case 'ready':
      return {
        title: 'Розрахунок отримано',
        note: 'Дані Нової пошти для цього відправлення.',
        tone: 'ok',
        showMoney: true,
        dimMoney: false,
        action: 'Перерахувати',
        canCreate: true,
      }
    case 'stale':
      return {
        title: 'Розрахунок застарів',
        note: 'Минуло більше 24 годин. Тарифи могли змінитися, тому передоплату потрібно підтвердити новим розрахунком.',
        tone: 'warn',
        showMoney: true,
        dimMoney: true,
        action: 'Перерахувати',
        canCreate: false,
      }
    case 'dirty':
      return {
        title: 'Дані доставки змінено',
        note: 'Після розрахунку ви змінили форму. Суми нижче більше не відповідають їй — збережіть і перерахуйте.',
        tone: 'warn',
        showMoney: true,
        dimMoney: true,
        action: 'Зберегти й перерахувати',
        canCreate: false,
      }
    case 'failed':
      return {
        title: 'Помилка розрахунку',
        note: state.message,
        tone: 'danger',
        showMoney: false,
        dimMoney: false,
        action: 'Повторити розрахунок',
        canCreate: false,
      }
    default:
      return {
        title: 'Вартість доставки',
        note: 'Розрахунок ще не виконувався. Заповніть посилки й оцінку повернення, щоб дізнатися орієнтовну вартість і потрібну передоплату.',
        tone: 'plain',
        showMoney: false,
        dimMoney: false,
        action: 'Розрахувати доставку',
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
  a.settlementId === b.settlementId &&
  a.divisionId === b.divisionId &&
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
    a.returnEstimateUah === b.returnEstimateUah &&
    a.payerType === b.payerType &&
    a.description === b.description &&
    (a.dispatchPointId ?? null) === (b.dispatchPointId ?? null)
  )
}

/** Core's own ceiling for an order total. */
const AGREED_TOTAL_MAX = 9_999_999_999

/**
 * The agreed order total as Core will take it, or null when what the manager
 * typed would be refused. A comma counts as the decimal separator: the cabinet
 * is Ukrainian and the numeric keypad offers one.
 */
export function agreedTotal(input: string): number | null {
  const text = input.trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null
  const value = Number(text.replace(',', '.'))
  return value > 0 && value <= AGREED_TOTAL_MAX ? value : null
}

/** Prepayment is delivery plus the return the manager estimated — not a tariff. */
export function prepayment(shipment: Shipment | null): number | null {
  if (shipment?.quoteUah === null || shipment === null) return null
  return shipment.quoteUah + shipment.returnEstimateUah
}
