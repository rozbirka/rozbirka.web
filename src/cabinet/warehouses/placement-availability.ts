/** Positions with a positive physical balance, including reserved units. */
export const warehouseStockStatuses = ['available', 'reserved']

/** Reserved units are still physically present; a zero balance cannot be placed. */
export function hasPlacementStock(part: {
  status?: string
  quantity?: number
  quantityTotal?: number
}) {
  return (
    part.status !== 'sold' && (part.quantity ?? part.quantityTotal ?? 0) > 0
  )
}
