import type { StatusTone } from '@/components/app'
import { SOURCE_LOCALE, translate, type Locale, type MessageKey } from '@/i18n'
import { partLabelMessages } from './part-labels-messages'

/**
 * Server vocabularies said the way the yard says them. Kept in one place so a
 * part reads the same on its own screen, in the scanner and in a list. Every
 * helper takes the interface locale (Ukrainian when omitted); screens pass
 * `useLocale().locale`.
 */
type LabelKey = MessageKey<typeof partLabelMessages>

const label = (locale: Locale, key: LabelKey) =>
  translate(partLabelMessages, locale, key)

const PHRASE_KEYS: Readonly<Record<string, LabelKey>> = {
  good: 'phraseGood',
  fair: 'phraseFair',
  scrap: 'phraseScrap',
  new: 'conditionNew',
  used: 'conditionUsed',
  refurbished: 'conditionRefurbished',
  damaged: 'conditionDamaged',
}

const CONDITION_KEYS: Readonly<Record<string, LabelKey>> = {
  new: 'conditionNew',
  used: 'conditionUsed',
  good: 'conditionGood',
  fair: 'conditionFair',
  scrap: 'conditionScrap',
  refurbished: 'conditionRefurbished',
  damaged: 'conditionDamaged',
}

/**
 * The condition as a phrase, not a word with "стан" glued on: «На запчастини
 * стан» is not Ukrainian, and neither is «Вживана стан».
 */
export const conditionPhrase = (
  value: string,
  locale: Locale = SOURCE_LOCALE,
) => {
  const key = PHRASE_KEYS[value.toLowerCase()]
  return key ? label(locale, key) : conditionLabel(value, locale)
}

export const conditionLabel = (
  value: string,
  locale: Locale = SOURCE_LOCALE,
) => {
  const key = CONDITION_KEYS[value.toLowerCase()]
  return key ? label(locale, key) : value
}

export const sourceLabel = (value: string, locale: Locale = SOURCE_LOCALE) => {
  const kind = value.toLowerCase()
  return label(
    locale,
    kind === 'car'
      ? 'sourceCar'
      : kind === 'batch'
        ? 'sourceBatch'
        : 'sourceUnavailable',
  )
}

export const originLabel = (
  id: string,
  name: string,
  locale: Locale = SOURCE_LOCALE,
) => {
  const kind = id.toLowerCase()
  if (kind === 'car') return label(locale, 'originCar')
  if (kind === 'batch') return label(locale, 'originBatch')
  return name || id
}

/**
 * A facet value in the interface language. The server sends the code and its
 * own name; where we know the code, our word wins, otherwise the server's name
 * stands.
 */
export const conditionFacetLabel = (
  id: string,
  name: string,
  locale: Locale = SOURCE_LOCALE,
) => {
  const known = conditionLabel(id, locale)
  return known === id ? name || id : known
}

/**
 * The three states a part can be in, with the colour the yard expects:
 * available is green, reserved is amber, sold is red — sold is the state that
 * takes a part off the shelf, and grey made it read as "nothing happened".
 */
export const partStatusPresentation = (
  status: string,
  locale: Locale = SOURCE_LOCALE,
): { label: string; tone: StatusTone } => {
  if (status === 'available')
    return { label: label(locale, 'statusAvailable'), tone: 'ok' }
  if (status === 'reserved')
    return { label: label(locale, 'statusReserved'), tone: 'warn' }
  if (status === 'sold')
    return { label: label(locale, 'statusSold'), tone: 'danger' }
  return { label: status, tone: 'neutral' }
}

/**
 * The unit every part is counted in. Core stores the Ukrainian «шт», so that
 * value (or none) reads as pieces in the interface language; any other unit
 * the server sends is shown as it came.
 */
export const PIECES_UNIT = 'шт'

export const unitLabel = (
  unit: string | null | undefined,
  locale: Locale = SOURCE_LOCALE,
) => (!unit || unit === PIECES_UNIT ? label(locale, 'unitPieces') : unit)

/** The dot that stands in for the pill in a filter row. */
export const partStatusDot = {
  available: 'bg-state-ok',
  reserved: 'bg-state-warn',
  sold: 'bg-state-danger',
} as const

const HISTORY_KEYS: Readonly<Record<string, LabelKey>> = {
  created: 'historyCreated',
  updated: 'historyUpdated',
  edited: 'historyUpdated',
  reserved: 'historyReserved',
  reservationcancelled: 'historyReservationCancelled',
  reservation_cancelled: 'historyReservationCancelled',
  added: 'historyAdded',
  released: 'historyReleased',
  sold: 'historySold',
  returned: 'historyReturned',
  moved: 'historyMoved',
  placed: 'historyPlaced',
  unplaced: 'historyUnplaced',
  deleted: 'historyDeleted',
}

/** Event names from the part history, in plain words. */
export const historyLabel = (value: string, locale: Locale = SOURCE_LOCALE) => {
  const key = HISTORY_KEYS[value]
  return key ? label(locale, key) : value
}

const HISTORY_FIELD_KEYS: Readonly<Record<string, LabelKey>> = {
  quantity: 'fieldQuantity',
  price: 'fieldPrice',
  unit_price: 'fieldPrice',
  sale_price: 'fieldSalePrice',
  status: 'fieldStatus',
  name: 'fieldName',
  condition: 'fieldCondition',
  zone: 'fieldZone',
  location: 'fieldLocation',
}

const fieldLabel = (key: string, locale: Locale) => {
  const known = HISTORY_FIELD_KEYS[key]
  return known ? label(locale, known) : key.replaceAll('_', ' ')
}

/**
 * History events carry their payload as a JSON string. Printed raw it puts
 * storage ids and braces on screen; this turns it into the two or three facts
 * a person actually reads, and says nothing when the payload is empty.
 *
 * Ids are dropped on purpose — the order is already a link on the same row.
 */
export const historyDetails = (
  raw: string | null,
  locale: Locale = SOURCE_LOCALE,
): string[] => {
  const trimmed = raw?.trim()
  if (!trimmed) return []
  if (!trimmed.startsWith('{')) return [trimmed]
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return [trimmed]
  }
  if (typeof parsed !== 'object' || parsed === null) return [trimmed]
  return Object.entries(parsed as Record<string, unknown>)
    .filter(
      ([key, value]) =>
        value !== null &&
        value !== '' &&
        typeof value !== 'object' &&
        !/(^|_)id$/.test(key) &&
        key !== 'order_number',
    )
    .map(([key, value]) => `${fieldLabel(key, locale)} ${String(value)}`)
}

/**
 * Which part of a part's life an event belongs to, so the history can be
 * filtered the way a person thinks about it. Price lives in the payload, not
 * in the event name, so a generic edit that moved a price counts as a price
 * event.
 */
export type HistoryKind = 'sale' | 'price' | 'stock'

const SALE_EVENTS = new Set([
  'reserved',
  'reservationcancelled',
  'reservation_cancelled',
  'released',
  'sold',
  'returned',
])

const PRICE_KEYS = /price/i

export const historyKind = (
  eventType: string,
  raw: string | null,
): HistoryKind => {
  if (SALE_EVENTS.has(eventType)) return 'sale'
  const payload = raw?.trim()
  if (payload?.startsWith('{') === true && PRICE_KEYS.test(payload))
    return 'price'
  return 'stock'
}

/**
 * A before-and-after pair from the payload, when the server sent one. Only a
 * real pair earns the arrow — a lone value stays an ordinary fact.
 */
export const historyChange = (
  raw: string | null,
): { from: string; to: string } | null => {
  const trimmed = raw?.trim()
  if (trimmed?.startsWith('{') !== true) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const entries = parsed as Record<string, unknown>
  const pairs: [string, string][] = [
    ['from', 'to'],
    ['old', 'new'],
    ['old_price', 'new_price'],
    ['previous', 'current'],
  ]
  for (const [fromKey, toKey] of pairs) {
    const from = entries[fromKey]
    const to = entries[toKey]
    if (
      (typeof from === 'string' ||
        typeof from === 'number' ||
        typeof from === 'boolean') &&
      (typeof to === 'string' ||
        typeof to === 'number' ||
        typeof to === 'boolean')
    )
      return { from: String(from), to: String(to) }
  }
  return null
}
