import type { StatusTone } from '@/components/app'

const presentations: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: 'Чернетка', tone: 'neutral' },
  new: { label: 'Нове', tone: 'info' },
  pending: { label: 'Очікує', tone: 'warn' },
  processing: { label: 'У роботі', tone: 'info' },
  confirmed: { label: 'Підтверджено', tone: 'ok' },
  completed: { label: 'Завершено', tone: 'ok' },
  cancelled: { label: 'Скасовано', tone: 'danger' },
  refunded: { label: 'Повернено', tone: 'info' },
}

export const orderStatusPresentation = (status: string) =>
  presentations[status.toLowerCase()] ?? {
    label: status,
    tone: 'neutral' as const,
  }
