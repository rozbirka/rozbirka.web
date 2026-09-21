import type { StatusTone } from '@/components/app'
import type { Integration, IntegrationStatus } from '@/api/integrations'

export const NOVA_POSHTA = 'nova_poshta'

const STATUS: Record<IntegrationStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Не налаштована', tone: 'neutral' },
  active: { label: 'Підключена', tone: 'ok' },
  inactive: { label: 'Вимкнена', tone: 'neutral' },
  error: { label: 'Помилка', tone: 'danger' },
}

/** An unknown status is shown as it came, not guessed into a colour. */
export function integrationStatusPresentation(status: string): {
  label: string
  tone: StatusTone
} {
  return (
    STATUS[status as IntegrationStatus] ?? { label: status, tone: 'neutral' }
  )
}

const MARKS: Record<string, string> = { [NOVA_POSHTA]: 'НП' }

/** The square badge in the list. Two letters, so a long name never wraps it. */
export function integrationMark(code: string): string {
  return MARKS[code] ?? code.slice(0, 2).toUpperCase()
}

const KINDS: Record<string, string> = { [NOVA_POSHTA]: 'Доставка' }

export function integrationKind(code: string): string | null {
  return KINDS[code] ?? null
}

/**
 * Codes Core returns in `lastErrorCode`. Anything unknown keeps the code
 * itself — an invented explanation would be worse than an honest one.
 */
const ERRORS: Record<string, string> = {
  integration_not_configured:
    'Ключ доступу ще не збережено. Додайте його, щоб перевірити підключення.',
  integration_settings_invalid:
    'Збережені дані підключення не підходять. Замініть ключ доступу.',
  integration_account_unverified:
    'Сервіс відхилив ключ: він недійсний або відкликаний у кабінеті перевізника.',
  integration_provider_unavailable:
    'Сервіс не відповів на запит. Дані збережені — спробуйте перевірити ще раз за кілька хвилин.',
  integration_verification_required:
    'Підключення потрібно перевірити, перш ніж вмикати інтеграцію.',
  integration_operation_in_progress:
    'Попередня дія ще виконується. Дочекайтеся її завершення.',
  integration_already_exists: 'Таку інтеграцію вже підключено.',
  dispatch_point_required:
    'Немає точки відправлення за замовчуванням — оформити доставку буде неможливо.',
  dispatch_point_unavailable:
    'Відділення точки відправлення не приймає відправлень.',
  division_not_found: 'Відділення точки відправлення більше не знайдено.',
}

export function integrationErrorMessage(code: string): string {
  return ERRORS[code] ?? `Сервіс повернув помилку: ${code}`
}

const CHECKS: Record<string, string> = {
  configuration: 'Ключ доступу збережено',
  authorization: 'Ключ приймає сервіс',
  default_dispatch_point: 'Є точка відправлення за замовчуванням',
  sender_division: 'Відділення відправника приймає відправлення',
}

export function diagnosticCheckLabel(code: string): string {
  return CHECKS[code] ?? code
}

/** Nova Poshta is the only provider Core can back today. */
export function isSupportedIntegration(integration: Integration): boolean {
  return integration.code === NOVA_POSHTA
}
