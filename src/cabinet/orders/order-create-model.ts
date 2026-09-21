import type { PartListItem } from '@/api/parts'

export const ORDER_NOTES_MAX_LENGTH = 1000

export type OrderCreateStep = 'parts' | 'prices' | 'customer' | 'summary'

export interface OrderDraftItem {
  part: PartListItem
  quantity: number
  price: string
}

export const normalizeOrderPrice = (value: string) => {
  const cleaned = value.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const [integer = '', ...fractions] = cleaned.split('.')
  const fraction = fractions.join('').slice(0, 2)
  return cleaned.includes('.')
    ? `${integer.slice(0, 10)}.${fraction}`
    : integer.slice(0, 10)
}

export const parseOrderPrice = (value: string) => {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const normalizeOrderNotes = (value: string) => {
  const trimmed = value.slice(0, ORDER_NOTES_MAX_LENGTH).trim()
  return trimmed === '' ? null : trimmed
}

export const remainingPartQuantity = (
  items: readonly OrderDraftItem[],
  part: PartListItem,
) =>
  Math.max(
    0,
    part.quantityAvailable -
      (items.find((item) => item.part.id === part.id)?.quantity ?? 0),
  )

export const addDraftItem = (
  items: readonly OrderDraftItem[],
  part: PartListItem,
  quantity: number,
  price: string,
): OrderDraftItem[] => {
  const existing = items.find((item) => item.part.id === part.id)
  const availableToAdd = remainingPartQuantity(items, part)
  const addition = Math.min(availableToAdd, Math.max(1, Math.floor(quantity)))
  if (addition === 0) return [...items]
  const normalizedPrice = normalizeOrderPrice(price)
  if (!existing)
    return [...items, { part, quantity: addition, price: normalizedPrice }]
  return items.map((item) =>
    item.part.id === part.id
      ? {
          ...item,
          quantity: item.quantity + addition,
          price: normalizedPrice,
        }
      : item,
  )
}

export const removeDraftItem = (
  items: readonly OrderDraftItem[],
  partId: string,
) => items.filter((item) => item.part.id !== partId)

export const updateDraftPrice = (
  items: readonly OrderDraftItem[],
  partId: string,
  price: string,
) =>
  items.map((item) =>
    item.part.id === partId
      ? { ...item, price: normalizeOrderPrice(price) }
      : item,
  )

export const orderDraftTotal = (items: readonly OrderDraftItem[]) =>
  items.reduce(
    (total, item) => total + item.quantity * (parseOrderPrice(item.price) ?? 0),
    0,
  )

export const canContinueOrderStep = (
  step: OrderCreateStep,
  items: readonly OrderDraftItem[],
) => {
  if (step === 'parts') return items.length > 0
  if (step === 'prices')
    return (
      items.length > 0 &&
      items.every((item) => {
        const price = parseOrderPrice(item.price)
        return price !== undefined && price >= 0
      })
    )
  return true
}
