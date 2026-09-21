import { describe, expect, it } from 'vitest'
import {
  addDraftItem,
  canContinueOrderStep,
  normalizeOrderNotes,
  normalizeOrderPrice,
  orderDraftTotal,
  parseOrderPrice,
  remainingPartQuantity,
  removeDraftItem,
  updateDraftPrice,
} from './order-create-model'

const part = {
  id: 'part-1',
  name: 'Ліхтар',
  photos: [],
  quantityTotal: 3,
  quantityReserved: 0,
  quantityAvailable: 3,
  quantitySoldTotal: 0,
  status: 'available',
  car: null,
  order: null,
} as const

describe('order create model', () => {
  it('normalizes money and accepts zero', () => {
    expect(normalizeOrderPrice('12,345abc')).toBe('12.34')
    expect(parseOrderPrice('0')).toBe(0)
    expect(parseOrderPrice('')).toBeUndefined()
    expect(parseOrderPrice('-1')).toBeUndefined()
    expect(parseOrderPrice('1.234')).toBeUndefined()
  })

  it('merges repeated parts without exceeding stock', () => {
    const first = addDraftItem([], part, 2, '10')
    expect(remainingPartQuantity(first, part)).toBe(1)
    expect(addDraftItem(first, part, 2, '12')).toEqual([
      expect.objectContaining({ quantity: 3, price: '12' }),
    ])
  })

  it('updates, totals and removes items', () => {
    const items = updateDraftPrice(
      addDraftItem([], part, 2, '10'),
      'part-1',
      '7.50',
    )
    expect(orderDraftTotal(items)).toBe(15)
    expect(removeDraftItem(items, 'part-1')).toEqual([])
  })

  it('validates each step and trims notes', () => {
    const items = addDraftItem([], part, 1, '')
    expect(canContinueOrderStep('parts', items)).toBe(true)
    expect(canContinueOrderStep('prices', items)).toBe(false)
    expect(normalizeOrderNotes('  дзвінок  ')).toBe('дзвінок')
    expect(normalizeOrderNotes('   ')).toBeNull()
  })
})
