import type { StatusTone } from '@/components/app'
import type { PaymentDto, PaymentStatus } from '@/api/types'

/** Plan feature codes, читані людиною. Unknown codes are shown as they came. */
const featureLabels: Record<string, string> = {
  intake_management: 'Приймання партій',
  'reports.advanced': 'Розширені звіти',
  bulk_export: 'Масовий експорт',
  team_collaboration: 'Спільна робота команди',
  advanced_analytics: 'Поглиблена аналітика',
  compat_suggest: 'Підбір сумісності',
  multi_cash_registers: 'Декілька кас',
  extended_photos: 'Більше фото на позицію',
  qr_codes: 'QR-коди',
}

export const featureLabel = (code: string) => featureLabels[code] ?? code

/** The five limits every plan and every subscription reports, in one order. */
export const LIMIT_LABELS = [
  { key: 'cars', label: 'Авто' },
  { key: 'intakes', label: 'Партії' },
  { key: 'parts', label: 'Запчастини' },
  { key: 'users', label: 'Команда' },
  { key: 'cashRegisters', label: 'Каси' },
] as const

export const intervalLabel = (interval: string) => {
  if (/^1m$/i.test(interval)) return 'за місяць'
  if (/^(1y|12m)$/i.test(interval)) return 'за рік'
  if (/^3m$/i.test(interval)) return 'за квартал'
  return `за ${interval}`
}

/** Whole days from now to an ISO instant; negative when it is already past. */
export const daysUntil = (iso: string | null): number | null => {
  if (iso === null) return null
  const target = new Date(iso).valueOf()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86_400_000)
}

export const dayWord = (value: number): string => {
  const last = Math.abs(value) % 10
  const lastTwo = Math.abs(value) % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'днів'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дні'
  return 'днів'
}

/** Payment vocabulary shared by the subscription history and the ledger. */
export const paymentStatusMeta: Record<
  PaymentStatus,
  { label: string; tone: StatusTone }
> = {
  success: { label: 'Оплачено', tone: 'ok' },
  pending: { label: 'Очікує', tone: 'warn' },
  failed: { label: 'Помилка', tone: 'danger' },
  reversed: { label: 'Повернено', tone: 'neutral' },
  cancelled: { label: 'Скасовано', tone: 'neutral' },
}

export function paymentTypeLabel(type: PaymentDto['type']): string {
  switch (type) {
    case 'checkout':
      return 'Перший платіж'
    case 'recurring':
      return 'Регулярне списання'
    case 'verification':
      return 'Верифікація'
    default:
      return type
  }
}
