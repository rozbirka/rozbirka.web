import { expect, it } from 'vitest'
import { payoffLabel, payoffResult } from './car-profitability'
import { formatDay } from './day'

const normalize = (value: string) => value.replace(/\s/g, ' ')

it('writes a day in the reader’s language', () => {
  expect(formatDay('2026-08-01T12:00:00Z', 'en-GB')).toBe('1 Aug 2026')
  expect(normalize(formatDay('2026-08-01T12:00:00Z', 'uk'))).toBe(
    '1 серп. 2026 р.',
  )
  expect(formatDay('2026-08-01T12:00:00Z', 'pl')).toBe('1 sie 2026')
})

it('keeps a bare calendar day on its own date in any time zone', () => {
  expect(formatDay('2026-08-01', 'en-GB', 'America/Los_Angeles')).toBe(
    '1 Aug 2026',
  )
})

it('shows a timestamp on the business day', () => {
  // 23:30 UTC on 31 July is already 1 August in Kyiv.
  expect(formatDay('2026-07-31T23:30:00Z', 'en-GB', 'Europe/Kyiv')).toBe(
    '1 Aug 2026',
  )
})

it('shows an unparsable value as it came', () => {
  expect(formatDay('soon', 'en-GB')).toBe('soon')
})

it('names the payback state in the given locale', () => {
  expect(payoffLabel('paid', 'en-GB')).toBe('Paid off')
  expect(payoffLabel('idle', 'pl')).toBe('Bez sprzedaży')
  expect(payoffLabel('recouping')).toBe('Окупається')
  expect(
    payoffResult(
      {
        invested: 100,
        recouped: 150,
        remaining: -50,
        recoupedPercent: 150,
        partsTotal: 2,
        partsAvailable: 0,
        partsSold: 2,
      },
      'en-GB',
    ).label,
  ).toBe('Profit')
})
