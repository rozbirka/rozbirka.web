import { expect, it } from 'vitest'
import type { CarProfitability } from '@/api/cars'
import {
  payoffKind,
  payoffResult,
  payoffScale,
  surplusPercent,
} from './car-profitability'

const profit = (over: Partial<CarProfitability> = {}): CarProfitability => ({
  invested: 13760,
  recouped: 18401,
  remaining: 13760 - 18401,
  recoupedPercent: 134,
  partsTotal: 194,
  partsAvailable: 115,
  partsSold: 79,
  ...over,
})

it('separates a car that paid off from one still working towards it', () => {
  expect(payoffKind(profit())).toBe('paid')
  expect(payoffKind(profit({ recouped: 9870, remaining: 13760 - 9870 }))).toBe(
    'recouping',
  )
  expect(payoffKind(profit({ recouped: 0, remaining: 13760 }))).toBe('idle')
})

it('counts breaking even exactly as paid off', () => {
  expect(payoffKind(profit({ recouped: 13760, remaining: 0 }))).toBe('paid')
})

it('does not call a car without sales paid off just because nothing went in', () => {
  expect(payoffKind(profit({ invested: 0, recouped: 0, remaining: 0 }))).toBe(
    'idle',
  )
})

it('puts break-even where it falls rather than at the end of the bar', () => {
  const scale = payoffScale(profit())

  // The track is the larger sum, so break-even sits at 13 760 of 18 401.
  expect(scale?.marker).toBeCloseTo(74.78, 1)
  expect(scale?.base).toBeCloseTo(74.78, 1)
  expect(scale?.over).toBeCloseTo(25.22, 1)
})

it('fills the bar only as far as what came back, before break-even', () => {
  const scale = payoffScale(profit({ recouped: 9870, remaining: 3890 }))

  expect(scale?.marker).toBe(100)
  expect(scale?.base).toBeCloseTo(71.73, 1)
  expect(scale?.over).toBe(0)
})

it('draws no bar when there is neither money in nor money out', () => {
  expect(payoffScale(profit({ invested: 0, recouped: 0 }))).toBeNull()
})

it('reads the third figure as profit once the car is past break-even', () => {
  expect(payoffResult(profit())).toEqual({
    label: 'Прибуток',
    amount: 4641,
    positive: true,
  })
  expect(payoffResult(profit({ recouped: 9870, remaining: 3890 }))).toEqual({
    label: 'До окупності',
    amount: 3890,
    positive: false,
  })
})

it('reports the surplus over what went in, not the share returned', () => {
  // Core's own recoupedPercent is 134; the surplus is the 34 above it.
  expect(surplusPercent(profit())).toBe(34)
  expect(surplusPercent(profit({ invested: 0 }))).toBeNull()
})
