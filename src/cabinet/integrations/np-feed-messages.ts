import { defineMessages } from '@/i18n'

/** The "Statuses" tab: the managed tracking subscription and the event queue. */
export const npFeedMessages = defineMessages({
  uk: {
    noAccess: 'Дія недоступна: немає прав на налаштування команди.',
    tryAgainLower: 'спробувати ще раз',
    connect: 'Підключити',
    connecting: 'Підключаємо…',
    retrying: 'Повторюємо…',
    keyPlaceholder: 'Вставте API-ключ NovaPost v1',
    // Tracking subscription
    callbackUnavailable:
      'У цьому середовищі автоматичні оновлення ще не налаштовані: потрібна публічна HTTPS-адреса прийому подій. Її задає адміністратор сервісу. Періодична перевірка статусів продовжується.',
    pasteKey: 'Вставте ключ із кабінету Нової пошти.',
    pickBusinessTracking:
      'Оберіть розбірку, щоб побачити автоматичні оновлення.',
    trackingTitle: 'Автоматичне оновлення доставки',
    trackingIntro:
      'Підписка отримує події Нової пошти через NovaPost v1. Нові накладні додаються автоматично. Збережений ключ НП використовується для вебхуків, якщо API v1 його приймає; інакше потрібен окремий ключ v1.',
    callbackEvidence:
      'Callback може бути тестовим. Отримання реальних змін статусу ТТН потрібно перевірити окремо.',
    queuePending: 'У вхідній черзі є події, які ще очікують обробки.',
    readingState: 'Читаємо стан підписки…',
    denied:
      'Немає доступу до автоматичних оновлень: потрібні права на налаштування команди.',
    stateError:
      'Не вдалося прочитати стан автоматичних оновлень. На вже створені накладні це не впливає —',
    noUpdatesYet: 'callback ще не надходив',
    lastUpdate: 'Останній callback',
    pendingNumbers: 'Накладних у черзі підключення: {count}.',
    unconfirmed: {
      one: 'Для {count} накладної автоматичні оновлення не підтверджені. Періодична перевірка продовжується.',
      few: 'Для {count} накладних автоматичні оновлення не підтверджені. Періодична перевірка продовжується.',
      many: 'Для {count} накладних автоматичні оновлення не підтверджені. Періодична перевірка продовжується.',
      other:
        'Для {count} накладних автоматичні оновлення не підтверджені. Періодична перевірка продовжується.',
    },
    keyHint:
      'Введіть ключ, який приймає API v1, якщо збережений ключ не підійшов. Ключ v2 для створення ТТН не змінюється. Зберігаємо зашифрованим і більше не показуємо.',
    keyLabel: 'API-ключ NovaPost v1',
    hideKey: 'Приховати ключ',
    showKey: 'Показати ключ',
    checkConnection: 'Перевірити підключення НП',
    retryNow: 'Повторити зараз',
    disconnect: 'Відключити',
    refreshState: 'Оновити стан',
    disconnectConsequence:
      'Накладні й історія залишаться. Періодична перевірка статусів продовжить працювати.',
    disconnectTitle: 'Відключити автоматичні оновлення доставки?',
    // Event queue
    noEventDetail:
      'Сервіс повертає тільки ідентифікатори подій — ні номера накладної, ні причини, ні часу по кожній з них немає.',
    noFeedStats:
      'Скільки подій оброблено за добу й скільки відхилено через підпис — сервіс не рахує.',
    events: { one: 'подія', few: 'події', many: 'подій', other: 'події' },
    waitedMinutes: '{count} хв',
    waitedHours: '{count} год',
    waitedDays: '{count} дн',
    pickBusinessDiagnostics: 'Оберіть розбірку, щоб відкрити діагностику.',
    retriedAll: 'Повторено подій: {done}.',
    retriedSome: 'Повторено {done} із {total}. Не вдалося: {failed}.',
    urlCopied: 'Адресу прийому скопійовано.',
    copyFailed: 'Не вдалося скопіювати адресу прийому.',
    webhookIntro:
      'Вхідна черга вебхуків Нової пошти: події, що очікують обробки, та вичерпані спроби. Це не всі фонові черги Rozbirka.',
    refreshData: 'Оновити дані',
    queueError:
      'Не вдалося прочитати стан черги подій. На вже створені накладні це не впливає —',
    queueLoading: 'Збираємо дані про черги подій…',
    deadLettersWarn: {
      one: 'Прийом подій налаштований, але {count} подію не вдалося обробити після всіх спроб. Періодична перевірка статусів продовжується.',
      few: 'Прийом подій налаштований, але {count} події не вдалося обробити після всіх спроб. Періодична перевірка статусів продовжується.',
      many: 'Прийом подій налаштований, але {count} подій не вдалося обробити після всіх спроб. Періодична перевірка статусів продовжується.',
      other:
        'Прийом подій налаштований, але {count} події не вдалося обробити після всіх спроб. Періодична перевірка статусів продовжується.',
    },
    queueClean:
      'У вхідній черзі немає необроблених подій. Порожня черга не підтверджує отримання змін статусу ТТН.',
    notConfigured:
      'Прийом подій ще не налаштований. Періодична перевірка статусів продовжується; також можна оновити статус із картки замовлення.',
    kpiReceiving: 'Перевірка підпису',
    secretSavedMeta: 'Секрет збережено, підпис перевіряється',
    secretMissingMeta: 'Секрет не збережено',
    kpiPending: 'Очікують обробки',
    queueEmpty: 'Черга порожня',
    inQueue: 'Обробляються за чергою',
    kpiOldest: 'Найстаріша необроблена',
    noUnprocessed: 'Необроблених подій немає',
    eventFrom: 'Подія від',
    kpiExhausted: 'Спроби вичерпані',
    noErrors: 'Без помилок',
    manualRetryNeeded: 'Потрібне ручне повторення',
    exhaustedTitle: 'Події з вичерпаними спробами',
    retryAll: 'Повторити всі',
    noProcessingErrors: 'Помилок обробки немає',
    listExplain:
      'Список заповнюється лише тоді, коли спроби обробити подію вичерпані.',
    eventLabel: 'Подія {id}',
    retry: 'Повторити',
    deadListNote:
      'Сервіс не повідомляє, якої накладної стосується подія і чому її не вдалося обробити. Показано до 20 найстаріших.',
    secretCard: 'Секрет для перевірки підпису',
    secretHint: 'Після збереження секрет буде приховано.',
    newSecret: 'Новий секрет',
    saveSecret: 'Зберегти секрет',
    secretNotSaved: 'секрет не збережено',
    replaceSecret: 'Замінити секрет',
    addSecret: 'Додати секрет',
    copyUrl: 'Скопіювати адресу прийому',
    secretWarn:
      'Збереження секрету в Rozbirka не реєструє підписку в Новій пошті — її налаштовують окремо, у кабінеті перевізника.',
    feedStatsNote:
      'Скільки подій оброблено за добу й скільки відхилено через підпис — тут не показуємо: сервіс цього не рахує.',
  },
  'en-GB': {
    noAccess:
      'Action unavailable: you don’t have permission to manage team settings.',
    tryAgainLower: 'try again',
    connect: 'Connect',
    connecting: 'Connecting…',
    retrying: 'Retrying…',
    keyPlaceholder: 'Paste the NovaPost v1 API key',
    callbackUnavailable:
      'Automatic updates aren’t set up in this environment yet. The receiving address is set by the service administrator — you don’t need to enter it.',
    pasteKey: 'Paste the NovaPost v1 API key.',
    pickBusinessTracking: 'Choose a business to see automatic updates.',
    trackingTitle: 'Automatic delivery updates',
    trackingIntro:
      'Receives Nova Poshta events through NovaPost v1. New waybills are added automatically. The saved Nova Poshta key is reused if API v1 accepts it; otherwise a separate v1 key is needed.',
    callbackEvidence:
      'A callback may be a test. Receipt of real shipment status changes must be verified separately.',
    queuePending: 'Inbox events are still awaiting processing.',
    readingState: 'Reading the subscription state…',
    denied:
      'No access to automatic updates: you need permission to manage team settings.',
    stateError:
      'Couldn’t read the state of automatic updates. Waybills already created aren’t affected —',
    noUpdatesYet: 'no callback received yet',
    lastUpdate: 'Last callback',
    pendingNumbers: 'Waybills waiting to be connected: {count}.',
    unconfirmed: {
      one: 'Automatic updates aren’t confirmed for {count} waybill. The periodic check continues.',
      other:
        'Automatic updates aren’t confirmed for {count} waybills. The periodic check continues.',
    },
    keyHint:
      'Enter a key accepted by API v1 if the saved key was not accepted. The v2 key for creating waybills stays unchanged. Stored encrypted and never shown again.',
    keyLabel: 'NovaPost v1 API key',
    hideKey: 'Hide key',
    showKey: 'Show key',
    checkConnection: 'Check Nova Poshta connection',
    retryNow: 'Retry now',
    disconnect: 'Disconnect',
    refreshState: 'Refresh state',
    disconnectConsequence:
      'Waybills and history stay. The periodic status check will keep running.',
    disconnectTitle: 'Disconnect automatic delivery updates?',
    noEventDetail:
      'The service returns only event IDs — no waybill number, reason or time for any of them.',
    noFeedStats:
      'The service doesn’t count how many events were processed in a day or rejected because of their signature.',
    events: { one: 'event', other: 'events' },
    waitedMinutes: '{count} min',
    waitedHours: '{count} h',
    waitedDays: '{count} d',
    pickBusinessDiagnostics: 'Choose a business to open diagnostics.',
    retriedAll: 'Events retried: {done}.',
    retriedSome: 'Retried {done} of {total}. Failed: {failed}.',
    urlCopied: 'Receiving address copied.',
    copyFailed: 'Couldn’t copy the receiving address.',
    webhookIntro:
      'Nova Poshta webhook inbox: pending events and exhausted attempts. These counters do not cover all Rozbirka background queues.',
    refreshData: 'Refresh data',
    queueError:
      'Couldn’t read the event queue state. Waybills already created aren’t affected —',
    queueLoading: 'Gathering event queue data…',
    deadLettersWarn: {
      one: 'Event receiving is set up, but {count} event couldn’t be processed after all attempts. Periodic status checks continue.',
      other:
        'Event receiving is set up, but {count} events couldn’t be processed after all attempts. Periodic status checks continue.',
    },
    queueClean:
      'There are no unprocessed inbox events. An empty inbox does not confirm receipt of shipment status changes.',
    notConfigured:
      'Event receiving is not set up yet. Periodic status checks continue; you can also refresh a status from the order card.',
    kpiReceiving: 'Signature verification',
    secretSavedMeta: 'Secret saved, signature is checked',
    secretMissingMeta: 'No secret saved',
    kpiPending: 'Awaiting processing',
    queueEmpty: 'The queue is empty',
    inQueue: 'Processed in turn',
    kpiOldest: 'Oldest unprocessed',
    noUnprocessed: 'No unprocessed events',
    eventFrom: 'Event from',
    kpiExhausted: 'Attempts used up',
    noErrors: 'No errors',
    manualRetryNeeded: 'Needs a manual retry',
    exhaustedTitle: 'Events with no attempts left',
    retryAll: 'Retry all',
    noProcessingErrors: 'No processing errors',
    listExplain:
      'The list only fills up once all attempts to process an event are used up.',
    eventLabel: 'Event {id}',
    retry: 'Retry',
    deadListNote:
      'The service doesn’t say which waybill an event concerns or why it couldn’t be processed. Up to the 20 oldest are shown.',
    secretCard: 'Signature verification secret',
    secretHint: 'Once saved, the secret will be hidden.',
    newSecret: 'New secret',
    saveSecret: 'Save secret',
    secretNotSaved: 'no secret saved',
    replaceSecret: 'Replace secret',
    addSecret: 'Add secret',
    copyUrl: 'Copy receiving address',
    secretWarn:
      'Saving the secret in Rozbirka doesn’t register a subscription with Nova Poshta — that is set up separately, in the carrier’s account.',
    feedStatsNote:
      'How many events were processed in a day or rejected because of their signature isn’t shown here: the service doesn’t count it.',
  },
  pl: {
    noAccess: 'Czynność niedostępna: brak uprawnień do ustawień zespołu.',
    tryAgainLower: 'spróbuj ponownie',
    connect: 'Połącz',
    connecting: 'Łączenie…',
    retrying: 'Ponawianie…',
    keyPlaceholder: 'Wklej klucz API NovaPost v1',
    callbackUnavailable:
      'W tym środowisku automatyczne aktualizacje nie są jeszcze skonfigurowane. Adres odbioru ustawia administrator usługi — nie trzeba go wpisywać ręcznie.',
    pasteKey: 'Wklej klucz API NovaPost v1.',
    pickBusinessTracking:
      'Wybierz firmę, aby zobaczyć automatyczne aktualizacje.',
    callbackEvidence:
      'Callback może być testowy. Odbiór rzeczywistych zmian statusów przesyłek wymaga osobnej weryfikacji.',
    queuePending: 'Zdarzenia w skrzynce nadal oczekują na przetworzenie.',
    trackingTitle: 'Automatyczne aktualizacje dostaw',
    trackingIntro:
      'Odbiera zdarzenia Nova Poshta przez NovaPost v1. Nowe listy przewozowe są dodawane automatycznie. Zapisany klucz NP jest używany, jeśli API v1 go akceptuje; w przeciwnym razie potrzebny jest osobny klucz v1.',
    readingState: 'Odczytywanie stanu subskrypcji…',
    denied:
      'Brak dostępu do automatycznych aktualizacji: potrzebne są uprawnienia do ustawień zespołu.',
    stateError:
      'Nie udało się odczytać stanu automatycznych aktualizacji. Nie wpływa to na utworzone listy przewozowe —',
    noUpdatesYet: 'nie otrzymano jeszcze callbacku',
    lastUpdate: 'Ostatni callback',
    pendingNumbers: 'Listy przewozowe w kolejce do podłączenia: {count}.',
    unconfirmed: {
      one: 'Automatyczne aktualizacje nie są potwierdzone dla {count} listu przewozowego. Okresowe sprawdzanie trwa nadal.',
      few: 'Automatyczne aktualizacje nie są potwierdzone dla {count} listów przewozowych. Okresowe sprawdzanie trwa nadal.',
      many: 'Automatyczne aktualizacje nie są potwierdzone dla {count} listów przewozowych. Okresowe sprawdzanie trwa nadal.',
      other:
        'Automatyczne aktualizacje nie są potwierdzone dla {count} listu przewozowego. Okresowe sprawdzanie trwa nadal.',
    },
    keyHint:
      'Wprowadź klucz akceptowany przez API v1, jeśli zapisany klucz nie został przyjęty. Klucz v2 do tworzenia listów pozostaje bez zmian. Przechowujemy go zaszyfrowany i nie wyświetlamy ponownie.',
    keyLabel: 'Klucz API NovaPost v1',
    hideKey: 'Ukryj klucz',
    showKey: 'Pokaż klucz',
    checkConnection: 'Sprawdź połączenie Nova Poshta',
    retryNow: 'Ponów teraz',
    disconnect: 'Odłącz',
    refreshState: 'Odśwież stan',
    disconnectConsequence:
      'Listy przewozowe i historia pozostaną. Okresowe sprawdzanie statusów będzie nadal działać.',
    disconnectTitle: 'Odłączyć automatyczne aktualizacje dostaw?',
    noEventDetail:
      'Usługa zwraca tylko identyfikatory zdarzeń — bez numeru listu przewozowego, przyczyny ani czasu dla żadnego z nich.',
    noFeedStats:
      'Usługa nie liczy, ile zdarzeń przetworzono w ciągu doby i ile odrzucono z powodu podpisu.',
    events: {
      one: 'zdarzenie',
      few: 'zdarzenia',
      many: 'zdarzeń',
      other: 'zdarzenia',
    },
    waitedMinutes: '{count} min',
    waitedHours: '{count} godz.',
    waitedDays: '{count} dn.',
    pickBusinessDiagnostics: 'Wybierz firmę, aby otworzyć diagnostykę.',
    retriedAll: 'Ponowiono zdarzeń: {done}.',
    retriedSome: 'Ponowiono {done} z {total}. Nie udało się: {failed}.',
    urlCopied: 'Adres odbioru skopiowany.',
    copyFailed: 'Nie udało się skopiować adresu odbioru.',
    webhookIntro:
      'Skrzynka webhooków Nova Poshta: zdarzenia oczekujące i wyczerpane próby. Liczniki nie obejmują wszystkich kolejek zadań Rozbirka.',
    refreshData: 'Odśwież dane',
    queueError:
      'Nie udało się odczytać stanu kolejki zdarzeń. Nie wpływa to na utworzone listy przewozowe —',
    queueLoading: 'Zbieranie danych o kolejkach zdarzeń…',
    deadLettersWarn: {
      one: 'Odbiór zdarzeń jest skonfigurowany, ale {count} zdarzenia nie udało się przetworzyć mimo wszystkich prób. Okresowe sprawdzanie statusów trwa nadal.',
      few: 'Odbiór zdarzeń jest skonfigurowany, ale {count} zdarzeń nie udało się przetworzyć mimo wszystkich prób. Okresowe sprawdzanie statusów trwa nadal.',
      many: 'Odbiór zdarzeń jest skonfigurowany, ale {count} zdarzeń nie udało się przetworzyć mimo wszystkich prób. Okresowe sprawdzanie statusów trwa nadal.',
      other:
        'Odbiór zdarzeń jest skonfigurowany, ale {count} zdarzenia nie udało się przetworzyć mimo wszystkich prób. Okresowe sprawdzanie statusów trwa nadal.',
    },
    queueClean:
      'Brak nieprzetworzonych zdarzeń w skrzynce. Pusta skrzynka nie potwierdza odbioru zmian statusów przesyłek.',
    notConfigured:
      'Odbiór zdarzeń nie jest jeszcze skonfigurowany. Okresowe sprawdzanie statusów trwa nadal; status można też odświeżyć z karty zamówienia.',
    kpiReceiving: 'Weryfikacja podpisu',
    secretSavedMeta: 'Sekret zapisany, podpis jest sprawdzany',
    secretMissingMeta: 'Sekret nie jest zapisany',
    kpiPending: 'Oczekują na przetworzenie',
    queueEmpty: 'Kolejka jest pusta',
    inQueue: 'Przetwarzane po kolei',
    kpiOldest: 'Najstarsze nieprzetworzone',
    noUnprocessed: 'Brak nieprzetworzonych zdarzeń',
    eventFrom: 'Zdarzenie z',
    kpiExhausted: 'Próby wyczerpane',
    noErrors: 'Bez błędów',
    manualRetryNeeded: 'Wymaga ręcznego ponowienia',
    exhaustedTitle: 'Zdarzenia z wyczerpanymi próbami',
    retryAll: 'Ponów wszystkie',
    noProcessingErrors: 'Brak błędów przetwarzania',
    listExplain:
      'Lista zapełnia się dopiero wtedy, gdy wyczerpią się próby przetworzenia zdarzenia.',
    eventLabel: 'Zdarzenie {id}',
    retry: 'Ponów',
    deadListNote:
      'Usługa nie podaje, którego listu przewozowego dotyczy zdarzenie ani dlaczego nie udało się go przetworzyć. Pokazano do 20 najstarszych.',
    secretCard: 'Sekret do weryfikacji podpisu',
    secretHint: 'Po zapisaniu sekret zostanie ukryty.',
    newSecret: 'Nowy sekret',
    saveSecret: 'Zapisz sekret',
    secretNotSaved: 'sekret nie jest zapisany',
    replaceSecret: 'Wymień sekret',
    addSecret: 'Dodaj sekret',
    copyUrl: 'Kopiuj adres odbioru',
    secretWarn:
      'Zapisanie sekretu w Rozbirka nie rejestruje subskrypcji w Nova Poshta — konfiguruje się ją osobno, w panelu przewoźnika.',
    feedStatsNote:
      'Ile zdarzeń przetworzono w ciągu doby i ile odrzucono z powodu podpisu — tu nie pokazujemy: usługa tego nie liczy.',
  },
})
