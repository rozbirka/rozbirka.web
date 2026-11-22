const states: Record<string, string> = {
  new: 'Очікує модерації',
  active: 'Активне',
  inactive: 'Зняте',
  rejected: 'Відхилене',
  payment_required: 'Потрібна оплата',
  removed: 'Видалено на OLX',
  available: 'Доступна',
  reserved: 'У резерві',
  sold: 'Продана',
  deleted: 'Видалена',
  draft: 'Ще не опубліковано',
  synced: 'Операцію виконано',
  blocked: 'Потрібне виправлення',
  unknown: 'Результат створення невідомий',
  awaiting_deactivation: 'Зняття ще не підтверджене',
}
export const olxStatus = (value: string | null | undefined) =>
  value ? (states[value] ?? `Невідомий статус: ${value}`) : 'Не перевірено'
const errors: Record<string, string> = {
  category_confirmation_required: 'Вибери й підтвердь категорію.',
  condition_required: 'Вибери стан запчастини.',
  price_required: 'Додай ціну більше нуля в картці запчастини.',
  currency_unsupported: 'Валюта ціни не підтримується тестовим каталогом.',
  photo_required: 'Додай фото в картці запчастини.',
  photo_limit: 'Тестовий каталог дозволяє до 8 фото.',
  part_not_available: 'Запчастина недоступна для публікації.',
  excluded: 'Запчастину виключено з публікації.',
  payment_required: 'Потрібна оплата. Автоматична оплата вимкнена.',
  rejected: 'Оголошення відхилено.',
  removed: 'Оголошення видалено. Заміна автоматично не створюється.',
  create_response_unknown:
    'Створення могло відбутися. Онови статус для відновлення зв’язку без дубля.',
  advert_not_confirmed: 'Спочатку перевір результат створення.',
}
export const olxError = (value: string) =>
  errors[value] ?? 'Операцію не виконано. Перевір дані та спробуй ще раз.'
