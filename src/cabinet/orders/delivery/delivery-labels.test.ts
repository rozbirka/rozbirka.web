import { expect, it } from 'vitest'
import { agreedTotal, shipmentStatePresentation } from './delivery-labels'

it('names every waybill state and leaves an unknown one readable', () => {
  expect(shipmentStatePresentation('CancelUnknown', 'uk')).toEqual({
    label: 'Скасування невідоме',
    tone: 'warn',
  })
  expect(shipmentStatePresentation('Archived', 'uk')).toEqual({
    label: 'Archived',
    tone: 'neutral',
  })
})

it('takes an agreed total the way a Ukrainian keypad types it', () => {
  expect(agreedTotal(' 4280,50 ')).toBe(4280.5)
  expect(agreedTotal('4280.5')).toBe(4280.5)
})

it('refuses an agreed total Core would reject anyway', () => {
  expect(agreedTotal('')).toBeNull()
  expect(agreedTotal('0')).toBeNull()
  expect(agreedTotal('-10')).toBeNull()
  expect(agreedTotal('4 280')).toBeNull()
  expect(agreedTotal('4280,505')).toBeNull()
  expect(agreedTotal('99999999999')).toBeNull()
})
