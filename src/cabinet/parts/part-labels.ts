/**
 * Server vocabularies said the way the yard says them. Kept in one place so a
 * part reads the same on its own screen, in the scanner and in a list.
 */
export const conditionLabel = (value: string) =>
  ({
    new: 'Нова',
    used: 'Вживана',
    good: 'б/в',
    fair: 'Задовільна',
    scrap: 'Під відновлення',
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
