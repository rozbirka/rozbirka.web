import type { StatusTone } from '@/components/app'
import type { ApiProblem } from '@/api/contracts'
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

/**
 * The managed tracking subscription's lifecycle, as Core names it. The pill is
 * short enough to sit beside a heading; the sentence says what the yard should
 * expect next, because half of these states resolve on their own.
 */
const TRACKING_STATES: Record<
  string,
  { label: string; tone: StatusTone; detail: string }
> = {
  Disabled: {
    label: 'Не підключено',
    tone: 'neutral',
    detail:
      'Автоматичні оновлення вимкнені. Статуси доставки оновлюються періодичною перевіркою.',
  },
  Connecting: {
    label: 'Підключаємо',
    tone: 'warn',
    detail: 'Підключаємо оновлення — реєструємо підписку в Новій пошті.',
  },
  AwaitingVerification: {
    label: 'Очікуємо підтвердження',
    tone: 'warn',
    detail:
      'Очікуємо підтвердження від Нової пошти: перше оновлення на нашу адресу ще не надійшло.',
  },
  Connected: {
    label: 'Підключено',
    tone: 'ok',
    detail: 'Нові накладні підключатимуться автоматично.',
  },
  RetryPending: {
    label: 'Спроба не вдалася',
    tone: 'warn',
    detail: 'Не вдалося завершити дію. Повторимо автоматично.',
  },
  NeedsCredentials: {
    label: 'Перевірте API-ключ',
    tone: 'danger',
    detail:
      'Нова пошта не прийняла ключ. Введіть діючий ключ, щоб продовжити підключення.',
  },
  NeedsReview: {
    label: 'Потрібна перевірка',
    tone: 'danger',
    detail: 'Підключення потребує перевірки.',
  },
  Disconnecting: {
    label: 'Відключаємо',
    tone: 'neutral',
    detail: 'Відключаємо оновлення — чекаємо підтвердження від Нової пошти.',
  },
}

/** States that change on their own, so the screen keeps asking while in one. */
const TRACKING_TRANSITIONAL = new Set([
  'Connecting',
  'AwaitingVerification',
  'Disconnecting',
  'RetryPending',
])

export function trackingStatePresentation(state: string): {
  label: string
  tone: StatusTone
  detail: string
} {
  return (
    TRACKING_STATES[state] ?? {
      label: 'Стан невідомий',
      tone: 'neutral',
      detail:
        'Сервіс повернув стан, якого ця версія кабінету не знає. Оновіть стан — нічого не зламано.',
    }
  )
}

export function isTrackingTransitional(state: string): boolean {
  return TRACKING_TRANSITIONAL.has(state)
}

/**
 * Why Core stopped, in `reasonCode`. Two families arrive here: what our own
 * reconciliation found, and `provider_*` — the carrier's refusal, named after
 * its failure kind.
 */
const TRACKING_REASONS: Record<string, string> = {
  callback_not_received:
    'Нова пошта не надіслала жодного оновлення на нашу адресу. Перевірте, чи ключ має доступ до підписок, і повторіть спробу.',
  ambiguous_subscription:
    'У кабінеті Нової пошти знайдено кілька підписок на ту саму адресу. Приберіть зайві в кабінеті перевізника, тоді повторіть.',
  subscription_not_confirmed:
    'Нова пошта не підтвердила створення підписки. Повторіть спробу — якщо повториться, перевірте підписки в кабінеті перевізника.',
  integration_inactive:
    'Інтеграція вимкнена. Увімкніть її, щоб отримувати оновлення.',
  provider_unauthorized:
    'Нова пошта не прийняла ключ — він недійсний або відкликаний.',
  provider_rejected: 'Нова пошта відхилила запит на підписку.',
  provider_notfound: 'Нова пошта не знайшла цієї підписки.',
  provider_unavailable: 'Нова пошта не відповідає. Спробуємо ще раз.',
  provider_ratelimited:
    'Нова пошта обмежила частоту запитів. Спробуємо ще раз пізніше.',
  provider_invalidresponse:
    'Нова пошта відповіла у незрозумілому форматі. Спробуємо ще раз.',
  provider_notsubmitted:
    'Запит до Нової пошти не був надісланий. Нічого не створено.',
  provider_outcomeunknown:
    'Не вдалося підтвердити результат запиту до Нової пошти.',
  provider_disabled: 'Інтеграцію Нової пошти вимкнено або не налаштовано.',
}

/** Null when there is nothing to explain, so a caller can skip the line. */
export function trackingReasonMessage(code: string | null): string | null {
  if (code === null) return null
  return (
    TRACKING_REASONS[code] ??
    'Сервіс не завершив дію й не назвав причини, яку ми вміємо пояснити. Спробуйте повторити.'
  )
}

/**
 * A failed command, in Ukrainian. Core answers in its own words — sometimes
 * English, always about its internals — so the code decides the text and the
 * body is never shown.
 */
export function trackingProblemMessage(problem: ApiProblem): string {
  const code = problem.code?.toLowerCase() ?? ''
  const byCode: Record<string, string> = {
    tracking_credentials_required:
      'Потрібен API-ключ Нової пошти — збереженого ключа для підписок немає.',
    tracking_credentials_invalid:
      'Такий ключ не підходить. Скопіюйте ключ із кабінету Нової пошти ще раз.',
    tracking_callback_not_configured:
      'У цьому середовищі автоматичні оновлення ще не налаштовані.',
    tracking_busy:
      'Ця дія вже виконується. Стан оновлено — перевірте його за кілька секунд.',
    tracking_manual_webhook_configured:
      'Для цієї інтеграції вже налаштований ручний вебхук. Приберіть збережений секрет нижче — самі ми його не вимикаємо.',
    tracking_disconnect_required:
      'Спершу завершіть відключення попередньої підписки, тоді підключайте нову.',
    tracking_retry_unavailable:
      'Повторювати вже нічого: стан підписки змінився. Оновіть стан.',
    nova_poshta_unauthorized:
      'Нова пошта не прийняла ключ — він недійсний або відкликаний.',
    nova_poshta_rejected: 'Нова пошта відхилила запит на підписку.',
    nova_poshta_ratelimited:
      'Нова пошта обмежила частоту запитів. Спробуйте за кілька хвилин.',
    nova_poshta_unavailable:
      'Нова пошта зараз недоступна. Спробуйте за кілька хвилин.',
    nova_poshta_disabled: 'Інтеграція Нової пошти вимкнена або не налаштована.',
  }
  if (byCode[code] !== undefined) return byCode[code]
  if (problem.kind === 'forbidden')
    return 'Немає доступу: потрібні права на налаштування команди.'
  if (problem.kind === 'not-found')
    return 'Підписки для цієї інтеграції немає. Оновіть стан.'
  if (problem.kind === 'network' || problem.kind === 'timeout')
    return 'Немає звʼязку з сервером. Ми не повторюємо дію самі — перевірте стан і за потреби натисніть ще раз.'
  return 'Не вдалося виконати дію. Перевірте стан і спробуйте ще раз.'
}
