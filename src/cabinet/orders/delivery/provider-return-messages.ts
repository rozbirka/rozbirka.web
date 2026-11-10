import { defineMessages } from '@/i18n'

export const providerReturnMessages = defineMessages({
  uk: {
    requestDetails: 'Дані заявки',
    statusPending: 'НП ще не передала статус повернення.',
    searchExternal: 'Знайти повернення в НП',
    confirmExternal: 'Це наше повернення',
    externalLinked: 'Прив’язано з НП',
    contact: 'Отримувач повернення',
    originalAddress: 'На початкову адресу',
    anotherBranch: 'В інше відділення',
    settlement: 'Населений пункт повернення',
    branch: 'Відділення повернення',
    chooseSettlement: 'Спершу оберіть населений пункт',
    branchesLoading: 'Завантажуємо відділення…',
    branchesFailed: 'Не вдалося завантажити відділення. Спробуйте ще раз.',
    moreBranches: 'Показати ще відділення',
    noBranches: 'Доступних відділень у цьому населеному пункті немає.',
    addressUnavailable:
      'Адреса повернення недоступна. Виберіть доступне відділення та повторіть розрахунок.',
    loading: 'Завантажуємо повернення…',
    requestStatus: 'Статус заявки НП',
    carrierStatus: 'Статус зворотної доставки',
    updated: 'Оновлено',
    checked: 'Перевірено',
    statusAt: 'Статус НП від',
    refreshing: 'Оновлюємо…',
    sourceChanged:
      'Дані накладної змінилися. Закрийте форму й відкрийте її знову, щоб перевірити актуальні дані.',
    nativeExists:
      'НП уже оформила повернення цієї посилки. Знайдіть наявну заявку й підтвердьте її прив’язку до замовлення.',
    title: 'Повернення посилки · Нова пошта',
    create: 'Оформити повернення НП',
    intro:
      'Якщо клієнт відмовився або не забирає посилку, подайте заявку на повернення відправнику.',
    scope: 'Після повернення й огляду посилки прийміть товар у замовленні.',
    source: 'Початкова ТТН',
    request: 'Заявка на повернення',
    reverse: 'Зворотна ТТН',
    waiting: 'НП ще не створила зворотну ТТН.',
    accepted: 'Заявку подано',
    unknown:
      'Результат оформлення ще невідомий. Повторне оформлення заблоковано, щоб не створити дві заявки. Перевірте результат у НП.',
    submitting: 'Заявка обробляється. Перевірте результат перед іншими діями.',
    rejected: 'НП не прийняла заявку. Перевірте дані перед новою спробою.',
    refresh: 'Оновити повернення',
    search: 'Знайти заявку в НП',
    empty:
      'Заявку не знайдено в перевіреній частині списку. Це не підтверджує, що її не створено. Перевірте кабінет НП.',
    confirmCandidate: 'Це наша заявка',
    candidateHint:
      'Звірте номер заявки, початкову ТТН і адресу повернення з кабінетом НП. Підтвердження прив’яже наявну заявку без повторного оформлення.',
    address: 'Куди повернути посилку',
    reason: 'Причина повернення',
    subtype: 'Уточнення причини',
    payment: 'Оплата повернення',
    cash: 'Готівкою',
    nonCash: 'Безготівково',
    note: 'Примітка для НП',
    choose: 'Оберіть значення',
    quote: 'Перевірити й розрахувати',
    confirm: 'Підтвердити повернення НП',
    cost: 'Вартість повернення за розрахунком НП',
    costHidden: 'Вартість доступна працівнику з правом перегляду фінансів.',
    confirmation:
      'Після підтвердження надішлемо заявку до Нової пошти. Зворотна ТТН з’явиться після її створення перевізником.',
    close: 'Закрити',
    back: 'Змінити дані',
    loadFailed: 'Не вдалося завантажити повернення.',
    retry: 'Спробувати ще раз',
    disconnected:
      'Інтеграцію відключено. Збережені дані доступні, дії з НП — після підключення.',
    received:
      'Посилку вже отримано. Повернення від покупця оформлюється окремо; цей сервіс НП призначений для відмови або неотримання.',
    blocked:
      'Оформлення повернення зараз недоступне. Оновіть статус початкової ТТН і перевірте можливість у кабінеті НП.',
    disabled:
      'Повернення доступне, коли посилка очікує отримувача або НП зафіксувала відмову.',
    error: 'Не вдалося виконати дію. Перевірте підключення і стан заявки у НП.',
  },
  'en-GB': {
    requestDetails: 'Request details',
    statusPending: 'Nova Poshta has not provided the return status yet.',
    searchExternal: 'Find return in Nova Poshta',
    confirmExternal: 'This is our return',
    externalLinked: 'Linked from Nova Poshta',
    contact: 'Return recipient',
    originalAddress: 'To the original address',
    anotherBranch: 'To another branch',
    settlement: 'Return city or town',
    branch: 'Return branch',
    chooseSettlement: 'Choose a city or town first',
    branchesLoading: 'Loading branches…',
    branchesFailed: 'Could not load branches. Try again.',
    moreBranches: 'Show more branches',
    noBranches: 'No available branches in this city or town.',
    addressUnavailable:
      'The return destination is unavailable. Choose an available branch and calculate again.',
    loading: 'Loading return…',
    requestStatus: 'Carrier request status',
    carrierStatus: 'Return delivery status',
    updated: 'Updated',
    checked: 'Checked',
    statusAt: 'Carrier status from',
    refreshing: 'Refreshing…',
    sourceChanged:
      'The waybill details changed. Close and reopen the form to check the current details.',
    nativeExists:
      'Nova Poshta has already arranged this return. Do not submit another request. Check the return waybill in the carrier account.',
    title: 'Parcel return · Nova Poshta',
    create: 'Arrange Nova Poshta return',
    intro:
      'If the customer refuses or does not collect the parcel, request a return to the sender.',
    scope:
      'After the parcel returns and is inspected, accept the goods in the order.',
    source: 'Original waybill',
    request: 'Return request',
    reverse: 'Return waybill',
    waiting: 'Nova Poshta has not created the return waybill yet.',
    accepted: 'Request submitted',
    unknown:
      'The result is still unknown. Resubmission is blocked to prevent duplicate requests. Check the result with Nova Poshta.',
    submitting:
      'The request is being processed. Check the result before taking another action.',
    rejected:
      'Nova Poshta rejected the request. Check the details before trying again.',
    refresh: 'Refresh return',
    search: 'Find request at Nova Poshta',
    empty:
      'No request was found in the checked portion of the list. This does not prove that it was not created. Check the carrier account.',
    confirmCandidate: 'This is our request',
    candidateHint:
      'Compare the request number, original waybill and return address with the carrier account. Confirming links the existing request without submitting another.',
    address: 'Return destination',
    reason: 'Return reason',
    subtype: 'Reason details',
    payment: 'Return payment method',
    cash: 'Cash',
    nonCash: 'Cashless',
    note: 'Note for Nova Poshta',
    choose: 'Choose an option',
    quote: 'Check and calculate',
    confirm: 'Confirm Nova Poshta return',
    cost: 'Return cost quoted by Nova Poshta',
    costHidden:
      'The cost is available to staff with finance viewing permission.',
    confirmation:
      'Confirming sends a request to Nova Poshta. The return waybill appears once the carrier creates it.',
    close: 'Close',
    back: 'Edit details',
    loadFailed: 'Could not load the return.',
    retry: 'Try again',
    disconnected:
      'The integration is disconnected. Saved details remain available; carrier actions require reconnection.',
    received:
      'The parcel has been collected. A return from the buyer is arranged separately; this carrier service is for refusal or non-collection.',
    blocked:
      'Return booking is unavailable. Refresh the original waybill status and check eligibility in the carrier account.',
    disabled:
      'Returns are available when the parcel awaits collection or Nova Poshta records a refusal.',
    error:
      'Could not complete the action. Check the connection and request status with Nova Poshta.',
  },
  pl: {
    requestDetails: 'Dane wniosku',
    statusPending: 'Nova Poshta nie przekazała jeszcze statusu zwrotu.',
    searchExternal: 'Znajdź zwrot w Nova Poshta',
    confirmExternal: 'To nasz zwrot',
    externalLinked: 'Powiązano z Nova Poshta',
    contact: 'Odbiorca zwrotu',
    originalAddress: 'Na pierwotny adres',
    anotherBranch: 'Do innego oddziału',
    settlement: 'Miejscowość zwrotu',
    branch: 'Oddział zwrotu',
    chooseSettlement: 'Najpierw wybierz miejscowość',
    branchesLoading: 'Ładowanie oddziałów…',
    branchesFailed: 'Nie udało się załadować oddziałów. Spróbuj ponownie.',
    moreBranches: 'Pokaż więcej oddziałów',
    noBranches: 'Brak dostępnych oddziałów w tej miejscowości.',
    addressUnavailable:
      'Adres zwrotu jest niedostępny. Wybierz dostępny oddział i oblicz ponownie.',
    loading: 'Wczytywanie zwrotu…',
    requestStatus: 'Status wniosku u przewoźnika',
    carrierStatus: 'Status dostawy zwrotnej',
    updated: 'Aktualizacja',
    checked: 'Sprawdzono',
    statusAt: 'Status przewoźnika z',
    refreshing: 'Odświeżanie…',
    sourceChanged:
      'Dane listu przewozowego zmieniły się. Zamknij i otwórz formularz ponownie, aby sprawdzić aktualne dane.',
    nativeExists:
      'Nova Poshta już zleciła ten zwrot. Nie składaj kolejnego wniosku. Sprawdź zwrotny list na koncie przewoźnika.',
    title: 'Zwrot przesyłki · Nova Poshta',
    create: 'Zleć zwrot w Nova Poshta',
    intro:
      'Jeśli klient odmówił lub nie odbiera przesyłki, złóż wniosek o zwrot do nadawcy.',
    scope: 'Po powrocie i sprawdzeniu przesyłki przyjmij towar w zamówieniu.',
    source: 'Pierwotny list przewozowy',
    request: 'Wniosek o zwrot',
    reverse: 'Zwrotny list przewozowy',
    waiting: 'Nova Poshta nie utworzyła jeszcze zwrotnego listu przewozowego.',
    accepted: 'Wniosek wysłany',
    unknown:
      'Wynik jest nieznany. Ponowne zlecenie zablokowano, aby uniknąć duplikatu. Sprawdź wynik w Nova Poshta.',
    submitting:
      'Wniosek jest przetwarzany. Sprawdź wynik przed kolejną czynnością.',
    rejected:
      'Nova Poshta odrzuciła wniosek. Sprawdź dane przed ponowną próbą.',
    refresh: 'Odśwież zwrot',
    search: 'Znajdź wniosek w Nova Poshta',
    empty:
      'Nie znaleziono wniosku w sprawdzonej części listy. Nie oznacza to, że go nie utworzono. Sprawdź konto przewoźnika.',
    confirmCandidate: 'To nasz wniosek',
    candidateHint:
      'Porównaj numer wniosku, pierwotny list i adres zwrotu z kontem przewoźnika. Potwierdzenie powiąże istniejący wniosek bez nowego zlecenia.',
    address: 'Adres zwrotu',
    reason: 'Powód zwrotu',
    subtype: 'Szczegóły powodu',
    payment: 'Płatność za zwrot',
    cash: 'Gotówka',
    nonCash: 'Bezgotówkowo',
    note: 'Uwagi dla Nova Poshta',
    choose: 'Wybierz opcję',
    quote: 'Sprawdź i oblicz',
    confirm: 'Potwierdź zwrot w Nova Poshta',
    cost: 'Koszt zwrotu według Nova Poshta',
    costHidden:
      'Koszt jest dostępny dla pracownika z uprawnieniami do finansów.',
    confirmation:
      'Potwierdzenie wysyła wniosek do Nova Poshta. Zwrotny list pojawi się po jego utworzeniu przez przewoźnika.',
    close: 'Zamknij',
    back: 'Zmień dane',
    loadFailed: 'Nie udało się wczytać zwrotu.',
    retry: 'Spróbuj ponownie',
    disconnected:
      'Integracja jest wyłączona. Zapisane dane są dostępne; działania wymagają ponownego połączenia.',
    received:
      'Przesyłkę już odebrano. Zwrot od kupującego wymaga osobnego procesu; ta usługa dotyczy odmowy lub nieodebrania.',
    blocked:
      'Zlecenie zwrotu jest niedostępne. Odśwież status pierwotnego listu i sprawdź możliwość na koncie przewoźnika.',
    disabled:
      'Zwrot jest dostępny, gdy przesyłka oczekuje na odbiór lub Nova Poshta zarejestruje odmowę.',
    error:
      'Nie udało się wykonać czynności. Sprawdź połączenie i stan wniosku w Nova Poshta.',
  },
})
