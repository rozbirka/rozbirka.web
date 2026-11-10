import { defineMessages } from '@/i18n'

export const messages = defineMessages({
  uk: {
    title: 'Синхронізація з НП',
    success: 'Остання успішна перевірка',
    error: 'Остання помилка',
    next: 'Наступна перевірка',
    never: 'Ще не перевірено',
    none: 'Помилок не зафіксовано',
    pending: 'Перевірка в черзі',
    paused: 'Призупинено',
    completed: 'Відстеження завершене',
    disabled: 'Інтеграцію відключено',
    soon: 'Найближчим часом',
    action: 'Оновити статус',
    stopped: 'Автоматичні перевірки призупинено.',
    count: 'Невдалих спроб: {count}.',
    resume:
      'Після усунення причини натисніть «{action}», щоб відновити перевірки.',
    unauthorized:
      'Нова пошта не приймає API-ключ. Перевірте підключення інтеграції.',
    actor:
      'Працівник, який налаштував підключення, більше не активний. Переналаштуйте підключення під активним працівником.',
    permission:
      'Працівнику, який налаштував підключення, бракує прав на замовлення. Відновіть його права.',
    access: 'Потрібно відновити доступ до підключення Нової пошти.',
    rejected: 'Нова пошта відхилила запит. Перевірте дані накладної.',
    source:
      'Дані повернення не відповідають початковій накладній. Перевірте зв’язок накладних.',
    notFound: 'Нова пошта не знайшла накладну або заявку. Перевірте її номер.',
    unavailable: 'Нова пошта тимчасово недоступна.',
    limited: 'Нова пошта обмежила кількість запитів.',
    malformed: 'Не вдалося прочитати відповідь Нової пошти.',
    lag: 'Статус API Нової пошти ще не узгоджений з отриманими подіями.',
    failed: 'Не вдалося завершити синхронізацію накладної.',
  },
  'en-GB': {
    title: 'Nova Poshta synchronisation',
    success: 'Last successful check',
    error: 'Last error',
    next: 'Next check',
    never: 'Not checked yet',
    none: 'No recorded errors',
    pending: 'Check queued',
    paused: 'Paused',
    completed: 'Tracking completed',
    disabled: 'Integration disconnected',
    soon: 'As soon as available',
    action: 'Refresh status',
    stopped: 'Automatic checks are paused.',
    count: 'Failed attempts: {count}.',
    resume: 'After fixing the cause, select “{action}” to resume checks.',
    unauthorized:
      'Nova Poshta rejected the API key. Check the integration connection.',
    actor:
      'The employee who configured the connection is inactive. Reconfigure it as an active employee.',
    permission:
      'The employee who configured the connection lacks order permissions. Restore their permissions.',
    access: 'Restore access to the Nova Poshta connection.',
    rejected: 'Nova Poshta rejected the request. Check the waybill details.',
    source:
      'The return does not match the original waybill. Check the linked waybills.',
    notFound:
      'Nova Poshta could not find the waybill or request. Check its number.',
    unavailable: 'Nova Poshta is temporarily unavailable.',
    limited: 'Nova Poshta has limited requests.',
    malformed: 'The Nova Poshta response could not be read.',
    lag: 'The Nova Poshta API status has not yet caught up with received events.',
    failed: 'Waybill synchronisation could not be completed.',
  },
  pl: {
    title: 'Synchronizacja Nova Poshta',
    success: 'Ostatnie udane sprawdzenie',
    error: 'Ostatni błąd',
    next: 'Następne sprawdzenie',
    never: 'Jeszcze nie sprawdzono',
    none: 'Brak zapisanych błędów',
    pending: 'Sprawdzenie w kolejce',
    paused: 'Wstrzymane',
    completed: 'Śledzenie zakończone',
    disabled: 'Integracja odłączona',
    soon: 'Wkrótce',
    action: 'Odśwież status',
    stopped: 'Automatyczne sprawdzanie jest wstrzymane.',
    count: 'Nieudane próby: {count}.',
    resume:
      'Po usunięciu przyczyny wybierz „{action}”, aby wznowić sprawdzanie.',
    unauthorized:
      'Nova Poshta odrzuciła klucz API. Sprawdź połączenie integracji.',
    actor:
      'Pracownik, który skonfigurował połączenie, jest nieaktywny. Skonfiguruj je ponownie jako aktywny pracownik.',
    permission:
      'Pracownik, który skonfigurował połączenie, nie ma uprawnień do zamówień. Przywróć jego uprawnienia.',
    access: 'Przywróć dostęp do połączenia z Nova Poshta.',
    rejected: 'Nova Poshta odrzuciła żądanie. Sprawdź dane listu przewozowego.',
    source:
      'Zwrot nie odpowiada pierwotnemu listowi przewozowemu. Sprawdź powiązane listy.',
    notFound:
      'Nova Poshta nie znalazła listu przewozowego lub wniosku. Sprawdź numer.',
    unavailable: 'Nova Poshta jest tymczasowo niedostępna.',
    limited: 'Nova Poshta ograniczyła liczbę żądań.',
    malformed: 'Nie udało się odczytać odpowiedzi Nova Poshta.',
    lag: 'Status API Nova Poshta nie uwzględnia jeszcze otrzymanych zdarzeń.',
    failed: 'Nie udało się zakończyć synchronizacji listu przewozowego.',
  },
})
export const reasons: Record<string, keyof typeof messages.uk> = {
  tracking_unauthorized: 'unauthorized',
  automation_actor_required: 'actor',
  automation_permission_required: 'permission',
  tracking_disabled: 'access',
  tracking_access_required: 'access',
  tracking_rejected: 'rejected',
  tracking_source_mismatch: 'source',
  tracking_not_found: 'notFound',
  tracking_unavailable: 'unavailable',
  tracking_rate_limited: 'limited',
  tracking_invalid_response: 'malformed',
  tracking_provider_lag: 'lag',
}
