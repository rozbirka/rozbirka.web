import { defineMessages } from '@/i18n'

/** The "Statuses" tab: the managed tracking subscription and the event queue. */
export const npFeedMessages = defineMessages({
  uk: {
    noAccess: 'Дія недоступна: немає прав на налаштування команди.',
    tryAgainLower: 'спробувати ще раз',
    connect: 'Підключити',
    connecting: 'Підключаємо…',
    retrying: 'Повторюємо…',
    keyPlaceholder: 'Вставте ключ з кабінету Нової пошти',
    // Tracking subscription
    callbackUnavailable:
      'У цьому середовищі автоматичні оновлення ще не налаштовані. Адресу прийому задає адміністратор сервісу — вводити її вручну не потрібно.',
    pasteKey: 'Вставте ключ із кабінету Нової пошти.',
    pickBusinessTracking:
      'Оберіть розбірку, щоб побачити автоматичні оновлення.',
    trackingTitle: 'Автоматичне оновлення доставки',
    trackingIntro:
      'Отримуйте оновлення статусів доставки від Нової пошти. Нові накладні підключатимуться автоматично.',
    readingState: 'Читаємо стан підписки…',
    denied:
      'Немає доступу до автоматичних оновлень: потрібні права на налаштування команди.',
    stateError:
      'Не вдалося прочитати стан автоматичних оновлень. На вже створені накладні це не впливає —',
    noUpdatesYet: 'оновлень ще не надходило',
    lastUpdate: 'останнє оновлення',
    pendingNumbers: 'Накладних у черзі підключення: {count}.',
    unconfirmed: {
      one: 'Для {count} накладної автоматичні оновлення не підтверджені. Періодична перевірка продовжується.',
      few: 'Для {count} накладних автоматичні оновлення не підтверджені. Періодична перевірка продовжується.',
      many: 'Для {count} накладних автоматичні оновлення не підтверджені. Періодична перевірка продовжується.',
      other:
        'Для {count} накладних автоматичні оновлення не підтверджені. Періодична перевірка продовжується.',
    },
    keyHint:
      'Ключ зберігається в сервісі зашифрованим і більше не показується.',
    keyLabel: 'API-ключ Нової пошти',
    hideKey: 'Приховати ключ',
    showKey: 'Показати ключ',
    enterKey: 'Ввести ключ',
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
      'Чи Rozbirka отримує події Нової пошти і що сталося з необробленими. Технічний блок для адміністратора.',
    refreshData: 'Оновити дані',
    queueError:
      'Не вдалося прочитати стан черги подій. На вже створені накладні це не впливає —',
    queueLoading: 'Збираємо дані про черги подій…',
    deadLettersWarn: {
      one: 'Прийом подій налаштований, але {count} подію не вдалося обробити після всіх спроб. Статуси цих відправлень оновлюються лише вручну.',
      few: 'Прийом подій налаштований, але {count} події не вдалося обробити після всіх спроб. Статуси цих відправлень оновлюються лише вручну.',
      many: 'Прийом подій налаштований, але {count} подій не вдалося обробити після всіх спроб. Статуси цих відправлень оновлюються лише вручну.',
      other:
        'Прийом подій налаштований, але {count} події не вдалося обробити після всіх спроб. Статуси цих відправлень оновлюються лише вручну.',
    },
    queueClean:
      'Прийом подій налаштований, черга чиста. Статуси відправлень оновлюються самі.',
    notConfigured:
      'Прийом подій не налаштований. Rozbirka не отримує події Нової пошти — статуси відправлень оновлюються тільки вручну, з картки замовлення.',
    kpiReceiving: 'Прийом подій',
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
    keyPlaceholder: 'Paste the key from your Nova Poshta account',
    callbackUnavailable:
      'Automatic updates aren’t set up in this environment yet. The receiving address is set by the service administrator — you don’t need to enter it.',
    pasteKey: 'Paste the key from your Nova Poshta account.',
    pickBusinessTracking: 'Choose a business to see automatic updates.',
    trackingTitle: 'Automatic delivery updates',
    trackingIntro:
      'Get delivery status updates from Nova Poshta. New waybills will be connected automatically.',
    readingState: 'Reading the subscription state…',
    denied:
      'No access to automatic updates: you need permission to manage team settings.',
    stateError:
      'Couldn’t read the state of automatic updates. Waybills already created aren’t affected —',
    noUpdatesYet: 'no updates received yet',
    lastUpdate: 'last update',
    pendingNumbers: 'Waybills waiting to be connected: {count}.',
    unconfirmed: {
      one: 'Automatic updates aren’t confirmed for {count} waybill. The periodic check continues.',
      other:
        'Automatic updates aren’t confirmed for {count} waybills. The periodic check continues.',
    },
    keyHint: 'The key is stored encrypted and is never shown again.',
    keyLabel: 'Nova Poshta API key',
    hideKey: 'Hide key',
    showKey: 'Show key',
    enterKey: 'Enter key',
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
      'Whether Rozbirka receives Nova Poshta events, and what happened to unprocessed ones. A technical section for the administrator.',
    refreshData: 'Refresh data',
    queueError:
      'Couldn’t read the event queue state. Waybills already created aren’t affected —',
    queueLoading: 'Gathering event queue data…',
    deadLettersWarn: {
      one: 'Event receiving is set up, but {count} event couldn’t be processed after all attempts. Statuses of these shipments are only updated by hand.',
      other:
        'Event receiving is set up, but {count} events couldn’t be processed after all attempts. Statuses of these shipments are only updated by hand.',
    },
    queueClean:
      'Event receiving is set up and the queue is clear. Shipment statuses update on their own.',
    notConfigured:
      'Event receiving isn’t set up. Rozbirka doesn’t receive Nova Poshta events — shipment statuses are only updated by hand, from the order card.',
    kpiReceiving: 'Event receiving',
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
    keyPlaceholder: 'Wklej klucz z panelu Nova Poshta',
    callbackUnavailable:
      'W tym środowisku automatyczne aktualizacje nie są jeszcze skonfigurowane. Adres odbioru ustawia administrator usługi — nie trzeba go wpisywać ręcznie.',
    pasteKey: 'Wklej klucz z panelu Nova Poshta.',
    pickBusinessTracking:
      'Wybierz firmę, aby zobaczyć automatyczne aktualizacje.',
    trackingTitle: 'Automatyczne aktualizacje dostaw',
    trackingIntro:
      'Otrzymuj aktualizacje statusów dostaw od Nova Poshta. Nowe listy przewozowe będą podłączane automatycznie.',
    readingState: 'Odczytywanie stanu subskrypcji…',
    denied:
      'Brak dostępu do automatycznych aktualizacji: potrzebne są uprawnienia do ustawień zespołu.',
    stateError:
      'Nie udało się odczytać stanu automatycznych aktualizacji. Nie wpływa to na utworzone listy przewozowe —',
    noUpdatesYet: 'nie otrzymano jeszcze aktualizacji',
    lastUpdate: 'ostatnia aktualizacja',
    pendingNumbers: 'Listy przewozowe w kolejce do podłączenia: {count}.',
    unconfirmed: {
      one: 'Automatyczne aktualizacje nie są potwierdzone dla {count} listu przewozowego. Okresowe sprawdzanie trwa nadal.',
      few: 'Automatyczne aktualizacje nie są potwierdzone dla {count} listów przewozowych. Okresowe sprawdzanie trwa nadal.',
      many: 'Automatyczne aktualizacje nie są potwierdzone dla {count} listów przewozowych. Okresowe sprawdzanie trwa nadal.',
      other:
        'Automatyczne aktualizacje nie są potwierdzone dla {count} listu przewozowego. Okresowe sprawdzanie trwa nadal.',
    },
    keyHint:
      'Klucz jest przechowywany w usłudze w postaci zaszyfrowanej i nie jest już wyświetlany.',
    keyLabel: 'Klucz API Nova Poshta',
    hideKey: 'Ukryj klucz',
    showKey: 'Pokaż klucz',
    enterKey: 'Wpisz klucz',
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
      'Czy Rozbirka otrzymuje zdarzenia Nova Poshta i co stało się z nieprzetworzonymi. Sekcja techniczna dla administratora.',
    refreshData: 'Odśwież dane',
    queueError:
      'Nie udało się odczytać stanu kolejki zdarzeń. Nie wpływa to na utworzone listy przewozowe —',
    queueLoading: 'Zbieranie danych o kolejkach zdarzeń…',
    deadLettersWarn: {
      one: 'Odbiór zdarzeń jest skonfigurowany, ale {count} zdarzenia nie udało się przetworzyć mimo wszystkich prób. Statusy tych przesyłek są aktualizowane tylko ręcznie.',
      few: 'Odbiór zdarzeń jest skonfigurowany, ale {count} zdarzeń nie udało się przetworzyć mimo wszystkich prób. Statusy tych przesyłek są aktualizowane tylko ręcznie.',
      many: 'Odbiór zdarzeń jest skonfigurowany, ale {count} zdarzeń nie udało się przetworzyć mimo wszystkich prób. Statusy tych przesyłek są aktualizowane tylko ręcznie.',
      other:
        'Odbiór zdarzeń jest skonfigurowany, ale {count} zdarzenia nie udało się przetworzyć mimo wszystkich prób. Statusy tych przesyłek są aktualizowane tylko ręcznie.',
    },
    queueClean:
      'Odbiór zdarzeń jest skonfigurowany, kolejka jest pusta. Statusy przesyłek aktualizują się same.',
    notConfigured:
      'Odbiór zdarzeń nie jest skonfigurowany. Rozbirka nie otrzymuje zdarzeń Nova Poshta — statusy przesyłek są aktualizowane tylko ręcznie, z karty zamówienia.',
    kpiReceiving: 'Odbiór zdarzeń',
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
