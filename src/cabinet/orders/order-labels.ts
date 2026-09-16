import type { StatusTone } from '@/components/app'

/**
 * An order's status said the way the yard says it, with the colour it is drawn
 * in. Kept in one place so an order reads the same on its own page, in the
 * list and on a customer's card; a status the vocabulary does not know is
 * shown as it came rather than guessed at.
 */
export const orderStatusPresentation = (
  status: string,
): { label: string; tone: StatusTone } => {
  if (status === 'confirmed') return { label: 'Підтверджено', tone: 'ok' }
  if (status === 'pending') return { label: 'Очікує', tone: 'warn' }
  if (status === 'cancelled') return { label: 'Скасовано', tone: 'neutral' }
  if (status === 'refunded') return { label: 'Повернено', tone: 'info' }
  return { label: status, tone: 'neutral' }
}
