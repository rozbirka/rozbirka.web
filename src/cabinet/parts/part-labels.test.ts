import { expect, it } from 'vitest'
import {
  conditionLabel,
  conditionPhrase,
  historyDetails,
  historyLabel,
  originLabel,
  partStatusPresentation,
  sourceLabel,
  unitLabel,
} from './part-labels'
import {
  rowProblem,
  unknownBrandsMessage,
  YEAR_MAX,
  YEAR_MIN,
} from './compatibility-rows'

it('translates all current part history event names', () => {
  expect(historyLabel('reservationcancelled')).toBe('Резерв скасовано')
  expect(historyLabel('added')).toBe('Додано')
})

it('translates filter vocabulary regardless of server casing', () => {
  expect(conditionLabel('Good')).toBe('Хороший')
  expect(conditionLabel('Fair')).toBe('Задовільний')
  expect(conditionLabel('Scrap')).toBe('На запчастини')
  expect(originLabel('Car', 'Car')).toBe('З авто')
  expect(originLabel('Batch', 'Batch')).toBe('З партії')
})

it('says the vocabulary in the interface language when given one', () => {
  expect(conditionLabel('Good', 'en-GB')).toBe('Good')
  expect(conditionPhrase('scrap', 'en-GB')).toBe('For parts')
  expect(conditionPhrase('fair', 'pl')).toBe('Zadowalający stan')
  expect(originLabel('batch', 'batch', 'en-GB')).toBe('From an intake')
  expect(originLabel('free', 'Free', 'en-GB')).toBe('Free')
  expect(sourceLabel('car', 'pl')).toBe('Auto')
  expect(sourceLabel('other', 'en-GB')).toBe('Source unavailable')
  expect(partStatusPresentation('reserved', 'en-GB')).toEqual({
    label: 'Reserved',
    tone: 'warn',
  })
  expect(historyLabel('reservation_cancelled', 'en-GB')).toBe(
    'Reservation cancelled',
  )
  expect(historyLabel('mystery', 'en-GB')).toBe('mystery')
  expect(
    historyDetails('{"quantity":2,"unit_price":5,"bin_code":"A1"}', 'en-GB'),
  ).toEqual(['quantity 2', 'price 5', 'bin code A1'])
  expect(historyDetails('{"quantity":2}')).toEqual(['кількість 2'])
})

it('reads the stored pieces unit in each language and leaves others alone', () => {
  expect(unitLabel('шт')).toBe('шт')
  expect(unitLabel('шт', 'en-GB')).toBe('pcs')
  expect(unitLabel(null, 'pl')).toBe('szt.')
  expect(unitLabel('kg', 'en-GB')).toBe('kg')
})

it('words compatibility problems per locale', () => {
  const row = { key: 'r', brand: 'Ford', model: '', year: '19' }
  expect(rowProblem(row)).toBe(
    `Рік — чотири цифри від ${String(YEAR_MIN)} до ${String(YEAR_MAX)}.`,
  )
  expect(rowProblem(row, 'en-GB')).toBe(
    `Year must be four digits from ${String(YEAR_MIN)} to ${String(YEAR_MAX)}.`,
  )
  expect(rowProblem({ ...row, brand: '' }, 'pl')).toBe('Wybierz markę.')
  expect(unknownBrandsMessage(['Lada'])).toContain('немає марки: Lada')
  expect(unknownBrandsMessage(['Lada', 'ZAZ'])).toContain(
    'немає марок: Lada, ZAZ',
  )
  expect(unknownBrandsMessage(['Lada', 'ZAZ'], 'en-GB')).toBe(
    'Your business’s catalogue has no makes called Lada, ZAZ. Compatibility with them won’t be saved — remove these rows or choose another make.',
  )
})
