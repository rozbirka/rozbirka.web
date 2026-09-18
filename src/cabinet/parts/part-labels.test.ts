import { expect, it } from 'vitest'
import { conditionLabel, historyLabel, originLabel } from './part-labels'

it('translates all current part history event names', () => {
  expect(historyLabel('reservationcancelled')).toBe('Резерв скасовано')
  expect(historyLabel('added')).toBe('Додано')
})

it('translates filter vocabulary regardless of server casing', () => {
  expect(conditionLabel('Good')).toBe('б/в')
  expect(conditionLabel('Fair')).toBe('Задовільна')
  expect(conditionLabel('Scrap')).toBe('Під відновлення')
  expect(originLabel('Car', 'Car')).toBe('З авто')
  expect(originLabel('Batch', 'Batch')).toBe('З партії')
})
