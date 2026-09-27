import type { StatusTone } from '@/components/app'

/**
 * Server vocabularies said the way the yard says them. Kept in one place so a
 * part reads the same on its own screen, in the scanner and in a list.
 */
/**
 * The condition as a phrase, not a word with "стан" glued on: «На запчастини
 * стан» is not Ukrainian, and neither is «Вживана стан».
 */
export const conditionPhrase = (value: string) =>
  ({
    good: 'Хороший стан',
    fair: 'Задовільний стан',
    scrap: 'На запчастини',
    new: 'Нова',
    used: 'Вживана',
    refurbished: 'Відновлена',
    damaged: 'Пошкоджена',
  })[value.toLowerCase()] ?? conditionLabel(value)

export const conditionLabel = (value: string) =>
  ({
    new: 'Нова',
    used: 'Вживана',
    good: 'Хороший',
    fair: 'Задовільний',
    scrap: 'На запчастини',
    refurbished: 'Відновлена',
    damaged: 'Пошкоджена',
  })[value.toLowerCase()] ?? value

export const sourceLabel = (value: string) =>
  ({ car: 'Авто', batch: 'Приймання', free: 'Без джерела' })[
    value.toLowerCase()
  ] ?? value

export const originLabel = (id: string, name: string) =>
  (({ car: 'З авто', batch: 'З партії', free: 'Вільна' })[id.toLowerCase()] ??
    name) ||
  id

/**
 * A facet value said in Ukrainian. The server sends the code and its own name;
 * where we know the code, our word wins, otherwise the server's name stands.
 */
export const conditionFacetLabel = (id: string, name: string) => {
  const known = conditionLabel(id)
  return known === id ? name || id : known
}

/**
 * The three states a part can be in, with the colour the yard expects:
 * available is green, reserved is amber, sold is red — sold is the state that
 * takes a part off the shelf, and grey made it read as "nothing happened".
 */
export const partStatusPresentation = (
  status: string,
): { label: string; tone: StatusTone } => {
  if (status === 'available') return { label: 'Доступна', tone: 'ok' }
  if (status === 'reserved') return { label: 'У резерві', tone: 'warn' }
  if (status === 'sold') return { label: 'Продана', tone: 'danger' }
  return { label: status, tone: 'neutral' }
}

/** The dot that stands in for the pill in a filter row. */
export const partStatusDot = {
  available: 'bg-state-ok',
  reserved: 'bg-state-warn',
  sold: 'bg-state-danger',
} as const

/** Event names from the part history, in plain words. */
export const historyLabel = (value: string) =>
  ({
    created: 'Створено',
    updated: 'Змінено',
    edited: 'Змінено',
    reserved: 'Зарезервовано',
    reservationcancelled: 'Резерв скасовано',
    reservation_cancelled: 'Резерв скасовано',
    added: 'Додано',
    released: 'Резерв знято',
    sold: 'Продано',
    returned: 'Повернено',
    moved: 'Переміщено',
    placed: 'Розміщено',
    unplaced: 'Знято з місця',
    deleted: 'Видалено',
  })[value] ?? value

const historyFieldLabels: Record<string, string> = {
  quantity: 'кількість',
  price: 'ціна',
  unit_price: 'ціна',
  sale_price: 'ціна продажу',
  status: 'статус',
  name: 'назва',
  condition: 'стан',
  zone: 'зона',
  location: 'місце',
}

/**
 * History events carry their payload as a JSON string. Printed raw it puts
 * storage ids and braces on screen; this turns it into the two or three facts
 * a person actually reads, and says nothing when the payload is empty.
 *
 * Ids are dropped on purpose — the order is already a link on the same row.
 */
export const historyDetails = (raw: string | null): string[] => {
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
    .map(
      ([key, value]) =>
        `${historyFieldLabels[key] ?? key.replaceAll('_', ' ')} ${String(value)}`,
    )
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
