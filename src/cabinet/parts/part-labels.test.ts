import { expect, it } from 'vitest'
import { historyLabel } from './part-labels'

it('translates all current part history event names', () => {
  expect(historyLabel('reservationcancelled')).toBe('Резерв скасовано')
  expect(historyLabel('added')).toBe('Додано')
})
