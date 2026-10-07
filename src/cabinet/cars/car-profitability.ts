import type { CarProfitability } from '@/api/cars'
import { SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { carCardMessages } from './car-card-messages'

/**
 * Where a car stands against the money that went into it. Core reports
 * `remaining` as invested minus recouped, so it goes negative once the car has
 * made money — that sign, not a percentage, is what decides the state.
 */
export type PayoffKind = 'paid' | 'recouping' | 'idle'

export function payoffKind(profit: CarProfitability): PayoffKind {
  if (profit.recouped <= 0) return 'idle'
  // A car nobody paid for is past its investment the moment anything sells.
  if (profit.invested <= 0) return 'paid'
  return profit.remaining <= 0 ? 'paid' : 'recouping'
}

const PAYOFF_LABEL_KEY = {
  paid: 'payoffPaid',
  recouping: 'payoffRecouping',
  idle: 'payoffIdle',
} as const satisfies Record<PayoffKind, string>

/** The status pill of a car's payback, in the reader's language. */
export function payoffLabel(
  kind: PayoffKind,
  locale: Locale = SOURCE_LOCALE,
): string {
  return translate(carCardMessages, locale, PAYOFF_LABEL_KEY[kind])
}

/**
 * The payback bar, in percentages of its own track. The track is not the
 * investment but the larger of the two sums, so break-even keeps its place on
 * the bar and everything past it is visibly beyond the line.
 */
export interface PayoffScale {
  /** Break-even, as a share of the track. */
  marker: number
  /** What came back, up to break-even. */
  base: number
  /** What came back beyond break-even. */
  over: number
}

export function payoffScale(profit: CarProfitability): PayoffScale | null {
  const scale = Math.max(profit.invested, profit.recouped)
  // Nothing in and nothing out draws no bar: there is no ratio to show.
  if (scale <= 0) return null
  return {
    marker: (profit.invested / scale) * 100,
    base: (Math.min(profit.recouped, profit.invested) / scale) * 100,
    over: (Math.max(0, profit.recouped - profit.invested) / scale) * 100,
  }
}

/** The third tile: profit once the car is past break-even, the gap before it. */
export interface PayoffResult {
  label: string
  /** Always positive; `positive` says which way to read it. */
  amount: number
  positive: boolean
}

export function payoffResult(
  profit: CarProfitability,
  locale: Locale = SOURCE_LOCALE,
): PayoffResult {
  const paid = payoffKind(profit) === 'paid'
  return {
    label: translate(
      carCardMessages,
      locale,
      paid ? 'resultProfit' : 'resultToPayback',
    ),
    amount: Math.abs(profit.remaining),
    positive: paid,
  }
}

/**
 * How much the car earned over what it cost, as a percentage. Core's own
 * `recoupedPercent` counts recouped against invested; this counts only the
 * surplus, which is what a profit line means.
 */
export function surplusPercent(profit: CarProfitability): number | null {
  if (profit.invested <= 0) return null
  return Math.round((profit.recouped / profit.invested - 1) * 100)
}
