import type { PartPickerItem } from '@/components/parts/PartSearchPicker'
import type { Locale, SupportedCurrency } from '@/i18n'
import { amountPrecisionError } from '../currency/amount-precision'

export interface OrderDraftItem {
  part: PartPickerItem
  quantity: number
  unitPrice: string
  /** Previous confirmed price while its replacement is being entered. */
  priceBeforeEdit?: string | undefined
}

/** Accept older currency-return drafts without losing their unfinished edits. */
export function restoreOrderItems(
  draft:
    | {
        draftItems?: readonly {
          part: PartPickerItem
          quantity: number
          unitPrice: string | number
          priceBeforeEdit?: string | undefined
        }[]
        selectedPartDraft?: PartPickerItem | null
        quantity?: string
        unitPrice?: string
        editingPartId?: string | null
      }
    | null
    | undefined,
): OrderDraftItem[] {
  const items = (draft?.draftItems ?? []).map((item) => ({
    ...item,
    unitPrice: String(item.unitPrice),
    priceBeforeEdit:
      item.priceBeforeEdit ??
      (String(item.unitPrice).trim() === '' ? '' : undefined),
  }))
  const part = draft?.selectedPartDraft
  if (!part) return items
  const selected = {
    part,
    quantity: draft.quantity ? Number(draft.quantity) : 1,
    unitPrice: draft.unitPrice ?? String(part.effectiveSalePrice ?? ''),
  }
  if (draft.editingPartId)
    return items.map((item) =>
      item.part.id === draft.editingPartId ? selected : item,
    )
  return items.some((item) => item.part.id === part.id)
    ? items
    : [...items, selected]
}

export function orderItemPrice(value: string): number | null {
  return value.trim() === '' ? null : Number(value.replace(',', '.'))
}

export function validOrderDraftItem(
  item: OrderDraftItem,
  currency: SupportedCurrency | null,
  locale: Locale,
) {
  const price = orderItemPrice(item.unitPrice)
  return (
    item.priceBeforeEdit === undefined &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= item.part.quantityAvailable &&
    price !== null &&
    Number.isFinite(price) &&
    price >= 0 &&
    amountPrecisionError(price, currency, locale) === null
  )
}
