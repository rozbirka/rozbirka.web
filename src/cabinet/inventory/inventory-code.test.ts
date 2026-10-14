import { expect, it } from 'vitest'
import { inventoryCodeFromName } from './inventory-code'

it('makes an ASCII inventory code from a Ukrainian shelf name', () => {
  expect(inventoryCodeFromName('Тестова полиця A1-1')).toBe(
    'testova-polytsya-a1-1',
  )
  expect(inventoryCodeFromName('Їхня ґанкова полиця')).toBe(
    'yikhnya-gankova-polytsya',
  )
})

it('normalizes Polish letters and repeated separators', () => {
  expect(inventoryCodeFromName('Półka  Łódź -- 2')).toBe('polka-lodz-2')
})
