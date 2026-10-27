import { defineMessages } from '@/i18n'

export const placementJobMessages = defineMessages({
  uk: {
    dismiss: 'Прибрати повідомлення про розміщення',
    unavailable:
      'Операція розміщення недоступна або немає права на її перегляд.',
    queued: 'Розміщення в черзі',
    running: 'Розміщення триває',
    completed: 'Розміщення завершено',
    failed: 'Розміщення зупинено',
    background: 'Можна закрити це вікно — розміщення продовжиться у фоні.',
    refreshFailed:
      'Не вдалося оновити прогрес. Операція може продовжуватися на сервері.',
    listFailed: 'Не вдалося завантажити останні операції розміщення.',
    open: 'Переглянути розміщення',
    minimize: 'Згорнути',
    recent: 'Останні розміщення',
    progress: 'Опрацьовано: {count} із {total}',
    placed: 'Розміщено',
    skipped: 'Пропущено',
    itemFailed: 'Не розміщено',
    noStock: 'Немає залишку на складі. Розміщення недоступне.',
    moved: 'Деталь уже переміщено. Її розміщення не змінено.',
    conflictingLocation: 'Деталь має секцію або полицю в іншій зоні.',
    locked: 'Деталь заблокована інвентаризацією.',
    notFound: 'Деталь не знайдена або недоступна.',
    genericFailure: 'Не вдалося розмістити деталь.',
    jobFailed:
      'Операцію зупинено. Можна повторити для невдалих і ще не опрацьованих деталей.',
    limit: 'За одну операцію можна розмістити до 1000 деталей.',
    launchUnknown:
      'Не вдалося підтвердити запуск. Повторна спроба перевірить ту саму операцію без дублювання.',
  },
  'en-GB': {
    dismiss: 'Dismiss placement notification',
    unavailable:
      'The placement operation is unavailable or you do not have access to it.',
    queued: 'Placement queued',
    running: 'Placement in progress',
    completed: 'Placement complete',
    failed: 'Placement stopped',
    background:
      'You can close this window. Placement will continue in the background.',
    refreshFailed:
      'Could not refresh progress. The operation may still be running on the server.',
    listFailed: 'Could not load recent placement operations.',
    open: 'View placement',
    minimize: 'Minimise',
    recent: 'Recent placements',
    progress: 'Processed: {count} of {total}',
    placed: 'Placed',
    skipped: 'Skipped',
    itemFailed: 'Not placed',
    noStock: 'No stock remains. Placement is unavailable.',
    moved: 'The part has already moved. Its placement was not changed.',
    conflictingLocation: 'The part has a section or shelf in another zone.',
    locked: 'The part is locked by a stocktake.',
    notFound: 'The part was not found or is unavailable.',
    genericFailure: 'Could not place the part.',
    jobFailed: 'The operation stopped. Retry failed and unprocessed parts.',
    limit: 'One operation can place up to 1000 parts.',
    launchUnknown:
      'Could not confirm the start. Retrying will check the same operation without duplicating it.',
  },
  pl: {
    dismiss: 'Ukryj powiadomienie o rozmieszczeniu',
    unavailable:
      'Operacja rozmieszczania jest niedostępna lub nie masz do niej dostępu.',
    queued: 'Rozmieszczenie w kolejce',
    running: 'Trwa rozmieszczanie',
    completed: 'Rozmieszczenie zakończone',
    failed: 'Rozmieszczanie zatrzymane',
    background:
      'Możesz zamknąć to okno. Rozmieszczanie będzie kontynuowane w tle.',
    refreshFailed:
      'Nie udało się odświeżyć postępu. Operacja może nadal trwać na serwerze.',
    listFailed: 'Nie udało się wczytać ostatnich operacji rozmieszczania.',
    open: 'Pokaż rozmieszczenie',
    minimize: 'Zwiń',
    recent: 'Ostatnie rozmieszczenia',
    progress: 'Przetworzono: {count} z {total}',
    placed: 'Umieszczono',
    skipped: 'Pominięto',
    itemFailed: 'Nie umieszczono',
    noStock: 'Brak stanu magazynowego. Rozmieszczenie jest niedostępne.',
    moved:
      'Część została już przeniesiona. Jej lokalizacja nie została zmieniona.',
    conflictingLocation: 'Część ma sekcję lub półkę w innej strefie.',
    locked: 'Część jest zablokowana przez inwentaryzację.',
    notFound: 'Część nie została znaleziona lub jest niedostępna.',
    genericFailure: 'Nie udało się umieścić części.',
    jobFailed:
      'Operacja została zatrzymana. Ponów dla błędnych i nieprzetworzonych części.',
    limit: 'Jedna operacja może obejmować maksymalnie 1000 części.',
    launchUnknown:
      'Nie udało się potwierdzić uruchomienia. Ponowienie sprawdzi tę samą operację bez duplikowania.',
  },
})
