import { defineMessages } from '@/i18n'

/**
 * The Nova Poshta connection wizard (design module 46 §1): five steps from an
 * API key to a working integration. Tax identifiers and +380 phones stay as
 * the carrier returns them in every language.
 */
export const npConnectMessages = defineMessages({
  uk: {
    exit: 'Вийти з підключення',
    title: 'Підключення Нової пошти',
    stepOf: 'Крок {step} з 5 · {name}',
    stepKey: 'API-ключ',
    stepSender: 'Відправник і контакт',
    stepTill: 'Каса для післяплати',
    stepPoint: 'Точка відправлення',
    stepReview: 'Перевірка',
    progressTitle: 'Кроки підключення',
    progressHint: 'Введене зберігається між кроками й після «Назад».',
    progressNow: 'зараз',
    progressKey: 'Ключ перевірено',
    back: 'Назад',
    next: 'Продовжити',
    // Step 1
    keyTitle: 'API-ключ Нової пошти',
    keyLead: 'Ключ пов’язує Rozbirka з вашим бізнес-кабінетом Нової пошти.',
    keyHelp:
      'У бізнес-кабінеті Нової пошти відкрийте «Налаштування» → «Безпека» → «API-ключ» і скопіюйте ключ. Ключ створює власник кабінету.',
    keyLabel: 'API-ключ',
    keyHint: 'Після збереження ключ буде приховано.',
    keyVerify: 'Перевірити й продовжити',
    keyVerifying: 'Перевіряємо…',
    keyVerifyingNote: 'Перевіряємо ключ у Новій пошті. Це займе кілька секунд.',
    keyEmptyNote: 'Вставте ключ, щоб перевірити його.',
    keyRejected:
      'Нова пошта не прийняла ключ. Перевірте, чи скопійовано його повністю, і спробуйте ще раз.',
    // Step 2
    senderTitle: 'Відправник і контактна особа',
    senderLead: 'Від імені відправника йдуть усі нові накладні.',
    senderWaiting: 'Очікує вибору відправника',
    senderUnavailable: 'Недоступно',
    sendersEmptyNote:
      'Додайте відправника в бізнес-кабінеті Нової пошти, а потім оновіть список.',
    sendersErrorNote:
      'Не вдалося прочитати відправників із кабінету Нової пошти. Ключ збережено — спробуйте ще раз.',
    contactsErrorNote:
      'Не вдалося прочитати контакти відправника. Ключ збережено — спробуйте ще раз.',
    senderResetNote:
      'Відправника змінено, тому контактну особу скинуто. Оберіть контакт нового відправника.',
    refreshList: 'Оновити список',
    // Step 3
    tillTitle: 'Каса для післяплати',
    tillLead: 'Куди зараховувати післяплату, коли клієнт забере посилку.',
    tillAuto: 'UAH · післяплата зарахується автоматично',
    tillCurrency: 'UAH',
    tillNone: 'Продовжити без каси',
    tillNoneHint: 'Вносити вручну',
    tillNoneNote:
      'Без каси післяплату потрібно буде вносити вручну в замовлення.',
    tillCaption:
      'Показано лише активні каси з гривнею. Касу можна змінити пізніше в налаштуваннях інтеграції.',
    tillsError:
      'Не вдалося прочитати каси. Можна продовжити без каси й обрати її пізніше.',
    // Step 4
    pointTitle: 'Точка відправлення',
    pointLead:
      'Звідки ви відправляєте посилки. Підставляється у відправника накладної.',
    divisionsError:
      'Не вдалося завантажити відділення. Місто збережено — спробуйте ще раз.',
    retry: 'Спробувати ще раз',
    // Step 5
    reviewTitle: 'Перевірте дані підключення',
    reviewLead:
      'Натисніть «Змінити», щоб повернутися до кроку. Введене на інших кроках не зміниться.',
    reviewKey: '{mask} · перевірено',
    reviewSender: 'Відправник',
    reviewContact: 'Контактна особа',
    reviewNoTill: 'Без каси · післяплату вносять вручну',
    change: 'Змінити',
    reviewCaption:
      'Після підключення доставку можна оформлювати з картки замовлення. Накладні створюються лише вручну.',
    complete: 'Завершити підключення',
    completing: 'Підключаємо…',
    completeError:
      'Не вдалося завершити підключення. Усі введені дані збережено — спробуйте ще раз.',
    connected:
      'Нову пошту підключено. Доставку можна оформлювати із замовлень.',
    // Exit dialog
    exitTitle: 'Вийти з підключення?',
    exitConsequence: 'Нова пошта залишиться непідключеною.',
    exitConfirm: 'Вийти',
    exitKeyKept:
      'Перевірений ключ збережено — наступного разу почнете з кроку 2.',
    exitSelectionLost: 'Вибраний відправник і контакт не збережуться.',
    sessionExpired:
      'Перевірка ключа застаріла. Вставте ключ ще раз — вибране на інших кроках залишиться.',
  },
  'en-GB': {
    exit: 'Leave setup',
    title: 'Connect Nova Poshta',
    stepOf: 'Step {step} of 5 · {name}',
    stepKey: 'API key',
    stepSender: 'Sender and contact',
    stepTill: 'Till for cash on delivery',
    stepPoint: 'Dispatch point',
    stepReview: 'Review',
    progressTitle: 'Setup steps',
    progressHint: 'What you enter is kept between steps and after “Back”.',
    progressNow: 'now',
    progressKey: 'Key verified',
    back: 'Back',
    next: 'Continue',
    keyTitle: 'Nova Poshta API key',
    keyLead: 'The key links Rozbirka to your Nova Poshta business account.',
    keyHelp:
      'In your Nova Poshta business account open “Settings” → “Security” → “API key” and copy the key. The key is created by the account owner.',
    keyLabel: 'API key',
    keyHint: 'Once saved, the key is hidden.',
    keyVerify: 'Verify and continue',
    keyVerifying: 'Verifying…',
    keyVerifyingNote:
      'Checking the key with Nova Poshta. This takes a few seconds.',
    keyEmptyNote: 'Paste the key to verify it.',
    keyRejected:
      'Nova Poshta did not accept the key. Check that it was copied in full and try again.',
    senderTitle: 'Sender and contact person',
    senderLead: 'All new waybills are sent in the sender’s name.',
    senderWaiting: 'Waiting for a sender',
    senderUnavailable: 'Unavailable',
    sendersEmptyNote:
      'Add a sender in your Nova Poshta business account, then refresh the list.',
    sendersErrorNote:
      'Could not read senders from your Nova Poshta account. The key is saved — try again.',
    contactsErrorNote:
      'Could not read the sender’s contacts. The key is saved — try again.',
    senderResetNote:
      'The sender changed, so the contact person was cleared. Choose a contact of the new sender.',
    refreshList: 'Refresh list',
    tillTitle: 'Till for cash on delivery',
    tillLead:
      'Where cash on delivery goes once the customer collects the parcel.',
    tillAuto: 'UAH · cash on delivery is booked automatically',
    tillCurrency: 'UAH',
    tillNone: 'Continue without a till',
    tillNoneHint: 'Record manually',
    tillNoneNote:
      'Without a till, cash on delivery has to be recorded manually in the order.',
    tillCaption:
      'Only active tills holding hryvnia are shown. You can change the till later in the integration settings.',
    tillsError:
      'Could not read the tills. You can continue without a till and choose one later.',
    pointTitle: 'Dispatch point',
    pointLead:
      'Where you send parcels from. It is filled into the waybill sender.',
    divisionsError:
      'Could not load the branches. The city is kept — try again.',
    retry: 'Try again',
    reviewTitle: 'Check the connection details',
    reviewLead:
      'Press “Change” to go back to a step. What you entered on other steps stays.',
    reviewKey: '{mask} · verified',
    reviewSender: 'Sender',
    reviewContact: 'Contact person',
    reviewNoTill: 'No till · cash on delivery recorded manually',
    change: 'Change',
    reviewCaption:
      'Once connected, delivery can be arranged from the order card. Waybills are only created manually.',
    complete: 'Finish setup',
    completing: 'Connecting…',
    completeError:
      'Could not finish the setup. Everything you entered is kept — try again.',
    connected:
      'Nova Poshta is connected. Delivery can now be arranged from orders.',
    exitTitle: 'Leave setup?',
    exitConsequence: 'Nova Poshta will stay disconnected.',
    exitConfirm: 'Leave',
    exitKeyKept: 'The verified key is kept — next time you start from step 2.',
    exitSelectionLost: 'The chosen sender and contact will not be kept.',
    sessionExpired:
      'The key check has expired. Paste the key again — your choices on other steps stay.',
  },
  pl: {
    exit: 'Wyjdź z konfiguracji',
    title: 'Podłączenie Nowej Poczty',
    stepOf: 'Krok {step} z 5 · {name}',
    stepKey: 'Klucz API',
    stepSender: 'Nadawca i kontakt',
    stepTill: 'Kasa za pobranie',
    stepPoint: 'Punkt nadania',
    stepReview: 'Sprawdzenie',
    progressTitle: 'Kroki konfiguracji',
    progressHint: 'Wpisane dane są zachowywane między krokami i po „Wstecz”.',
    progressNow: 'teraz',
    progressKey: 'Klucz sprawdzony',
    back: 'Wstecz',
    next: 'Dalej',
    keyTitle: 'Klucz API Nowej Poczty',
    keyLead: 'Klucz łączy Rozbirkę z Twoim kontem firmowym Nowej Poczty.',
    keyHelp:
      'Na koncie firmowym Nowej Poczty otwórz „Ustawienia” → „Bezpieczeństwo” → „Klucz API” i skopiuj klucz. Klucz tworzy właściciel konta.',
    keyLabel: 'Klucz API',
    keyHint: 'Po zapisaniu klucz zostanie ukryty.',
    keyVerify: 'Sprawdź i kontynuuj',
    keyVerifying: 'Sprawdzamy…',
    keyVerifyingNote:
      'Sprawdzamy klucz w Nowej Poczcie. To potrwa kilka sekund.',
    keyEmptyNote: 'Wklej klucz, aby go sprawdzić.',
    keyRejected:
      'Nowa Poczta nie przyjęła klucza. Sprawdź, czy został skopiowany w całości, i spróbuj ponownie.',
    senderTitle: 'Nadawca i osoba kontaktowa',
    senderLead: 'Wszystkie nowe listy przewozowe idą w imieniu nadawcy.',
    senderWaiting: 'Czeka na wybór nadawcy',
    senderUnavailable: 'Niedostępne',
    sendersEmptyNote:
      'Dodaj nadawcę na koncie firmowym Nowej Poczty, a potem odśwież listę.',
    sendersErrorNote:
      'Nie udało się odczytać nadawców z konta Nowej Poczty. Klucz jest zapisany — spróbuj ponownie.',
    contactsErrorNote:
      'Nie udało się odczytać kontaktów nadawcy. Klucz jest zapisany — spróbuj ponownie.',
    senderResetNote:
      'Nadawca się zmienił, więc osoba kontaktowa została wyczyszczona. Wybierz kontakt nowego nadawcy.',
    refreshList: 'Odśwież listę',
    tillTitle: 'Kasa za pobranie',
    tillLead: 'Gdzie księgować pobranie, gdy klient odbierze paczkę.',
    tillAuto: 'UAH · pobranie zaksięguje się automatycznie',
    tillCurrency: 'UAH',
    tillNone: 'Kontynuuj bez kasy',
    tillNoneHint: 'Wpisywać ręcznie',
    tillNoneNote:
      'Bez kasy pobranie trzeba będzie wpisywać ręcznie w zamówieniu.',
    tillCaption:
      'Pokazano tylko aktywne kasy z hrywną. Kasę można zmienić później w ustawieniach integracji.',
    tillsError:
      'Nie udało się odczytać kas. Możesz kontynuować bez kasy i wybrać ją później.',
    pointTitle: 'Punkt nadania',
    pointLead: 'Skąd wysyłasz paczki. Trafia do nadawcy listu przewozowego.',
    divisionsError:
      'Nie udało się wczytać oddziałów. Miejscowość jest zachowana — spróbuj ponownie.',
    retry: 'Spróbuj ponownie',
    reviewTitle: 'Sprawdź dane podłączenia',
    reviewLead:
      'Naciśnij „Zmień”, aby wrócić do kroku. Dane z innych kroków się nie zmienią.',
    reviewKey: '{mask} · sprawdzony',
    reviewSender: 'Nadawca',
    reviewContact: 'Osoba kontaktowa',
    reviewNoTill: 'Bez kasy · pobranie wpisywane ręcznie',
    change: 'Zmień',
    reviewCaption:
      'Po podłączeniu dostawę można zlecać z karty zamówienia. Listy przewozowe tworzy się tylko ręcznie.',
    complete: 'Zakończ podłączenie',
    completing: 'Podłączamy…',
    completeError:
      'Nie udało się zakończyć podłączenia. Wszystkie dane są zachowane — spróbuj ponownie.',
    connected: 'Nowa Poczta jest podłączona. Dostawę można zlecać z zamówień.',
    exitTitle: 'Wyjść z konfiguracji?',
    exitConsequence: 'Nowa Poczta pozostanie niepodłączona.',
    exitConfirm: 'Wyjdź',
    exitKeyKept:
      'Sprawdzony klucz jest zapisany — następnym razem zaczniesz od kroku 2.',
    exitSelectionLost: 'Wybrany nadawca i kontakt nie zostaną zapisani.',
    sessionExpired:
      'Sprawdzenie klucza wygasło. Wklej klucz ponownie — wybory z innych kroków zostaną.',
  },
})
