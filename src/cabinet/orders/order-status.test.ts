import { expect, it } from 'vitest'
import { orderStatusPresentation } from './order-status'

it.each([
  ['draft', 'Чернетка', 'neutral'],
  ['new', 'Нове', 'info'],
  ['pending', 'Очікує', 'warn'],
  ['processing', 'У роботі', 'info'],
  ['confirmed', 'Підтверджено', 'ok'],
  ['completed', 'Завершено', 'ok'],
  ['cancelled', 'Скасовано', 'danger'],
  ['refunded', 'Повернено', 'info'],
] as const)(
  'presents %s orders as %s with a %s tone',
  (status, label, tone) => {
    expect(orderStatusPresentation(status)).toEqual({ label, tone })
  },
)

it('normalizes status casing before selecting a tone', () => {
  expect(orderStatusPresentation('Confirmed')).toEqual({
    label: 'Підтверджено',
    tone: 'ok',
  })
})
