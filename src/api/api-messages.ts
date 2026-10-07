import {
  defineMessages,
  requestLocale,
  SOURCE_LOCALE,
  translate,
  type MessageKey,
  type MessageParams,
} from '@/i18n'

/**
 * Text the API layer produces itself (fallbacks when the server sent no
 * message). Built outside React, so it follows the interface locale the
 * requests carry (`requestLocale`), Ukrainian before the provider mounts.
 */
export const apiMessages = defineMessages({
  uk: {
    cancelled: 'Запит скасовано.',
    network: 'Немає з’єднання з мережею.',
    timeout: 'Час очікування запиту минув.',
    'session-expired': 'Сеанс завершився. Увійдіть знову.',
    forbidden: 'У вас немає доступу до цієї дії.',
    'not-found': 'Ресурс не знайдено.',
    validation: 'Перевірте правильність введених даних.',
    conflict: 'Не вдалося виконати дію через конфлікт даних.',
    server: 'Сталася помилка сервера. Спробуйте пізніше.',
    unknown: 'Сталася непередбачена помилка. Спробуйте ще раз.',
    carCatalogFailed: 'Не вдалося завантажити каталог автомобілів.',
    carCatalogInvalid: 'Некоректна відповідь каталогу автомобілів.',
    intakeFallbackName: 'Партія',
  },
  'en-GB': {
    cancelled: 'The request was cancelled.',
    network: 'No network connection.',
    timeout: 'The request timed out.',
    'session-expired': 'Your session has ended. Please log in again.',
    forbidden: 'You don’t have access to this action.',
    'not-found': 'Not found.',
    validation: 'Check that the details you entered are correct.',
    conflict: 'Couldn’t complete the action because of a data conflict.',
    server: 'A server error occurred. Please try again later.',
    unknown: 'An unexpected error occurred. Please try again.',
    carCatalogFailed: 'Couldn’t load the car catalogue.',
    carCatalogInvalid: 'The car catalogue sent an invalid response.',
    intakeFallbackName: 'Batch',
  },
  pl: {
    cancelled: 'Żądanie anulowano.',
    network: 'Brak połączenia z siecią.',
    timeout: 'Upłynął czas oczekiwania na żądanie.',
    'session-expired': 'Sesja wygasła. Zaloguj się ponownie.',
    forbidden: 'Nie masz dostępu do tej czynności.',
    'not-found': 'Nie znaleziono zasobu.',
    validation: 'Sprawdź poprawność wprowadzonych danych.',
    conflict: 'Nie udało się wykonać działania z powodu konfliktu danych.',
    server: 'Wystąpił błąd serwera. Spróbuj później.',
    unknown: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
    carCatalogFailed: 'Nie udało się wczytać katalogu samochodów.',
    carCatalogInvalid: 'Nieprawidłowa odpowiedź katalogu samochodów.',
    intakeFallbackName: 'Partia',
  },
})

/** API-layer text in the locale requests are currently sent with. */
export function apiMessage(
  key: MessageKey<typeof apiMessages>,
  params?: MessageParams,
): string {
  return translate(
    apiMessages,
    requestLocale.get() ?? SOURCE_LOCALE,
    key,
    params,
  )
}
