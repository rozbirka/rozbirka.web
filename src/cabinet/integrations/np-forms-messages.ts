import { defineMessages } from '@/i18n'

/**
 * Nova Poshta forms: delivery preferences, dispatch points and the settlement
 * picker. NP is Ukrainian-only, so phones stay +380 and tax identifiers stay
 * Ukrainian (ЄДРПОУ/ІПН) in every language.
 */
export const npFormsMessages = defineMessages({
  uk: {
    loading: 'Завантажуємо…',
    noAccess: 'Дія недоступна: немає прав на налаштування команди.',
    novaPoshta: 'Нова пошта',
    // Delivery preferences
    sendersError: 'Не вдалося прочитати відправників із кабінету Нової пошти.',
    deliveryCard: 'Доставка',
    prefsSaved: 'Налаштування збережено.',
    senderHint:
      'Відправник із кабінету Нової пошти. Усі накладні йдуть від його імені.',
    senderLabel: 'Відправник',
    noSenders: 'Кабінет не повернув жодного відправника',
    notChosen: 'Не обрано',
    pickSenderFirst: 'Спершу оберіть відправника.',
    contactHint: 'Ця особа буде вказана в накладній як контакт відправника.',
    contactLabel: 'Контактна особа',
    tillNoneHint:
      'Без каси післяплату доведеться вносити вручну — замовлення чекатиме в черзі на звірку.',
    tillHint:
      'Щойно клієнт забере посилку, післяплата зарахується в цю касу автоматично.',
    tillLabel: 'Каса для післяплати',
    noUahTill: 'Немає активної каси з гривнею',
    manualEntry: 'Вносити вручну',
    // Dispatch point form
    formDescription:
      'Дані точки підставляються у відправника накладної під час оформлення доставки.',
    defaultCantDisable:
      'Типову точку не можна вимкнути — спершу зробіть типовою іншу.',
    deactivateHint:
      'Точка перестане пропонуватися при оформленні. Створені накладні не змінюються.',
    deactivate: 'Вимкнути точку',
    addPoint: 'Додати точку',
    saveChanges: 'Зберегти зміни',
    newPointTitle: 'Нова точка відправлення',
    pointTitle: 'Точка «{name}»',
    pointNameHint: 'Видно лише всередині Rozbirka.',
    pointNameLabel: 'Назва точки',
    pointNamePlaceholder: 'напр. Головний склад',
    savedSettlementHint:
      'Збережений пункт залишається, доки не виберете інший.',
    pickSettlementFirst: 'Спершу оберіть населений пункт.',
    sendingBranchesOnly:
      'Показані лише відділення, які приймають відправлення.',
    branchLabel: 'Відділення відправлення',
    pickBranch: 'Оберіть відділення',
    formSenderHint:
      'Відправник із кабінету Нової пошти. Створити нового тут не можна — тільки в кабінеті перевізника.',
    pickSender: 'Оберіть відправника',
    senderContactLabel: 'Контактна особа відправника',
    pickPerson: 'Оберіть особу',
    senderNameLabel: 'Ім’я відправника',
    senderNamePlaceholder: 'ПІБ контактної особи',
    phoneError: 'Телефон у міжнародному форматі, напр. +380672147730',
    phoneLabel: 'Телефон відправника',
    companyName: 'Назва компанії',
    companyNamePlaceholder: 'Юридична назва',
    companyTin: 'Ідентифікаційний код',
    companyTinPlaceholder: 'ЄДРПОУ або ІПН',
    isCompanyHint: 'Додає назву та ідентифікаційний код у накладну.',
    isCompanyLabel: 'Відправник — компанія',
    defaultHint:
      'Підставляється в оформлення доставки. Менеджер може вибрати іншу.',
    defaultLabel: 'Точка за замовчуванням',
    alreadyDefault:
      'Ця точка вже типова. Щоб змінити, зробіть типовою іншу точку.',
    activeHint: 'Неактивні точки не пропонуються під час оформлення.',
    active: 'Активна',
    inactive: 'Неактивна',
    // Dispatch points panel
    noBranchName:
      'Точку створили до переходу на український API Нової пошти, тож назви відділення в ній немає. Відкрийте точку й оберіть відділення ще раз.',
    pickBusinessPoints: 'Оберіть розбірку, щоб відкрити точки відправлення.',
    pointsIntro:
      'Звідки ви відправляєте посилки. Дані точки підставляються у відправника накладної, точка за замовчуванням — під час оформлення доставки.',
    pointsLoadError: 'Не вдалося завантажити точки. Дані точок не змінені —',
    tryAgainLower: 'спробувати ще раз',
    pointsLoading: 'Завантажуємо точки відправлення…',
    noPointsTitle: 'Точок відправлення ще немає',
    noPointsText:
      'Додайте хоча б одну точку, щоб оформлювати доставку із замовлень. Перша активна точка стане точкою за замовчуванням.',
    pointsTitle: 'Точки відправлення',
    defaultBadge: 'За замовчуванням',
    privateSender: 'Відправник — фізична особа',
    branchNameMissing: 'Назва відділення недоступна',
    change: 'Змінити',
    defaultFootnote:
      'Точка за замовчуванням підставляється під час оформлення. Менеджер може вибрати іншу.',
    // Settlement picker
    settlementLabel: 'Населений пункт',
    prohibitedSending: 'не приймає відправлень',
    prohibitedReceiving: 'не видає відправлень',
    pickedProhibited: 'Обрано з довідника. Цей пункт {rule}.',
    picked: 'Обрано з довідника Нової пошти.',
    startTypingHint:
      'Почніть вводити назву — підкажемо з довідника Нової пошти.',
    startTyping: 'Почніть вводити назву',
    directory: 'Довідник Нової пошти',
    directoryError: 'помилка',
    searching: 'Шукаємо…',
    matches: '{count} збіг.',
    noMatches: 'без збігів',
    directoryFailed:
      'Не вдалося завантажити довідник. Причину показано під полем.',
    directoryLoading: 'Завантажуємо довідник…',
    nothingFound:
      'У довіднику немає населеного пункту з такою назвою. Перевірте написання або введіть коротший запит.',
  },
  'en-GB': {
    loading: 'Loading…',
    noAccess:
      'Action unavailable: you don’t have permission to manage team settings.',
    novaPoshta: 'Nova Poshta',
    sendersError: 'Couldn’t read senders from the Nova Poshta account.',
    deliveryCard: 'Delivery',
    prefsSaved: 'Settings saved.',
    senderHint:
      'A sender from your Nova Poshta account. All waybills go out in their name.',
    senderLabel: 'Sender',
    noSenders: 'The account returned no senders',
    notChosen: 'Not selected',
    pickSenderFirst: 'Choose a sender first.',
    contactHint:
      'This person will be named on the waybill as the sender’s contact.',
    contactLabel: 'Contact person',
    tillNoneHint:
      'Without a till, cash on delivery has to be entered by hand — the order will wait in the reconciliation queue.',
    tillHint:
      'As soon as the customer collects the parcel, the cash on delivery is credited to this till automatically.',
    tillLabel: 'Till for cash on delivery',
    noUahTill: 'No active till holding hryvnia',
    manualEntry: 'Enter by hand',
    formDescription:
      'The point’s details fill in the waybill sender when a delivery is arranged.',
    defaultCantDisable:
      'The default point can’t be turned off — make another one the default first.',
    deactivateHint:
      'The point will no longer be offered when arranging delivery. Existing waybills don’t change.',
    deactivate: 'Turn off point',
    addPoint: 'Add point',
    saveChanges: 'Save changes',
    newPointTitle: 'New dispatch point',
    pointTitle: 'Point “{name}”',
    pointNameHint: 'Only visible inside Rozbirka.',
    pointNameLabel: 'Point name',
    pointNamePlaceholder: 'e.g. Main warehouse',
    savedSettlementHint: 'The saved place stays until you choose another.',
    pickSettlementFirst: 'Choose a town or city first.',
    sendingBranchesOnly: 'Only branches that accept parcels are shown.',
    branchLabel: 'Dispatch branch',
    pickBranch: 'Choose a branch',
    formSenderHint:
      'A sender from your Nova Poshta account. New senders can’t be created here — only in the carrier’s account.',
    pickSender: 'Choose a sender',
    senderContactLabel: 'Sender’s contact person',
    pickPerson: 'Choose a person',
    senderNameLabel: 'Sender’s name',
    senderNamePlaceholder: 'Contact person’s full name',
    phoneError: 'Phone in international format, e.g. +380672147730',
    phoneLabel: 'Sender’s phone',
    companyName: 'Company name',
    companyNamePlaceholder: 'Legal name',
    companyTin: 'Identification code',
    companyTinPlaceholder: 'EDRPOU or IPN',
    isCompanyHint: 'Adds the name and identification code to the waybill.',
    isCompanyLabel: 'Sender is a company',
    defaultHint:
      'Filled in when arranging delivery. A manager can choose another.',
    defaultLabel: 'Default point',
    alreadyDefault:
      'This point is already the default. To change it, make another point the default.',
    activeHint: 'Inactive points aren’t offered when arranging delivery.',
    active: 'Active',
    inactive: 'Inactive',
    noBranchName:
      'This point was created before the switch to Nova Poshta’s Ukrainian API, so it has no branch name. Open the point and choose the branch again.',
    pickBusinessPoints: 'Choose a business to open its dispatch points.',
    pointsIntro:
      'Where you send parcels from. A point’s details fill in the waybill sender; the default point is used when arranging delivery.',
    pointsLoadError:
      'Couldn’t load the points. Their details haven’t changed —',
    tryAgainLower: 'try again',
    pointsLoading: 'Loading dispatch points…',
    noPointsTitle: 'No dispatch points yet',
    noPointsText:
      'Add at least one point to arrange delivery from orders. The first active point becomes the default.',
    pointsTitle: 'Dispatch points',
    defaultBadge: 'Default',
    privateSender: 'Sender is a private individual',
    branchNameMissing: 'Branch name unavailable',
    change: 'Change',
    defaultFootnote:
      'The default point is filled in when arranging delivery. A manager can choose another.',
    settlementLabel: 'Town or city',
    prohibitedSending: 'doesn’t accept parcels',
    prohibitedReceiving: 'doesn’t hand out parcels',
    pickedProhibited: 'Chosen from the directory. This place {rule}.',
    picked: 'Chosen from the Nova Poshta directory.',
    startTypingHint:
      'Start typing a name — we’ll suggest places from the Nova Poshta directory.',
    startTyping: 'Start typing a name',
    directory: 'Nova Poshta directory',
    directoryError: 'error',
    searching: 'Searching…',
    matches: { one: '{count} match', other: '{count} matches' },
    noMatches: 'no matches',
    directoryFailed:
      'Couldn’t load the directory. The reason is shown below the field.',
    directoryLoading: 'Loading the directory…',
    nothingFound:
      'There’s no place with this name in the directory. Check the spelling or try a shorter search.',
  },
  pl: {
    loading: 'Wczytywanie…',
    noAccess: 'Czynność niedostępna: brak uprawnień do ustawień zespołu.',
    novaPoshta: 'Nova Poshta',
    sendersError: 'Nie udało się odczytać nadawców z panelu Nova Poshta.',
    deliveryCard: 'Dostawa',
    prefsSaved: 'Ustawienia zapisane.',
    senderHint:
      'Nadawca z panelu Nova Poshta. Wszystkie listy przewozowe są wystawiane w jego imieniu.',
    senderLabel: 'Nadawca',
    noSenders: 'Panel nie zwrócił żadnego nadawcy',
    notChosen: 'Nie wybrano',
    pickSenderFirst: 'Najpierw wybierz nadawcę.',
    contactHint:
      'Ta osoba zostanie podana w liście przewozowym jako kontakt nadawcy.',
    contactLabel: 'Osoba kontaktowa',
    tillNoneHint:
      'Bez kasy płatność za pobraniem trzeba będzie wprowadzić ręcznie — zamówienie poczeka w kolejce do uzgodnienia.',
    tillHint:
      'Gdy tylko klient odbierze paczkę, płatność za pobraniem trafi automatycznie do tej kasy.',
    tillLabel: 'Kasa dla płatności za pobraniem',
    noUahTill: 'Brak aktywnej kasy z hrywnami',
    manualEntry: 'Wprowadzać ręcznie',
    formDescription:
      'Dane punktu są wstawiane jako nadawca listu przewozowego przy zlecaniu dostawy.',
    defaultCantDisable:
      'Domyślnego punktu nie można wyłączyć — najpierw ustaw inny jako domyślny.',
    deactivateHint:
      'Punkt przestanie być proponowany przy zlecaniu dostawy. Utworzone listy przewozowe się nie zmienią.',
    deactivate: 'Wyłącz punkt',
    addPoint: 'Dodaj punkt',
    saveChanges: 'Zapisz zmiany',
    newPointTitle: 'Nowy punkt nadania',
    pointTitle: 'Punkt „{name}”',
    pointNameHint: 'Widoczna tylko w Rozbirka.',
    pointNameLabel: 'Nazwa punktu',
    pointNamePlaceholder: 'np. Magazyn główny',
    savedSettlementHint:
      'Zapisana miejscowość pozostaje, dopóki nie wybierzesz innej.',
    pickSettlementFirst: 'Najpierw wybierz miejscowość.',
    sendingBranchesOnly: 'Pokazano tylko oddziały przyjmujące przesyłki.',
    branchLabel: 'Oddział nadania',
    pickBranch: 'Wybierz oddział',
    formSenderHint:
      'Nadawca z panelu Nova Poshta. Nowego nie można tu utworzyć — tylko w panelu przewoźnika.',
    pickSender: 'Wybierz nadawcę',
    senderContactLabel: 'Osoba kontaktowa nadawcy',
    pickPerson: 'Wybierz osobę',
    senderNameLabel: 'Imię i nazwisko nadawcy',
    senderNamePlaceholder: 'Imię i nazwisko osoby kontaktowej',
    phoneError: 'Telefon w formacie międzynarodowym, np. +380672147730',
    phoneLabel: 'Telefon nadawcy',
    companyName: 'Nazwa firmy',
    companyNamePlaceholder: 'Nazwa prawna',
    companyTin: 'Kod identyfikacyjny',
    companyTinPlaceholder: 'EDRPOU lub IPN',
    isCompanyHint: 'Dodaje nazwę i kod identyfikacyjny do listu przewozowego.',
    isCompanyLabel: 'Nadawca jest firmą',
    defaultHint: 'Wstawiany przy zlecaniu dostawy. Menedżer może wybrać inny.',
    defaultLabel: 'Punkt domyślny',
    alreadyDefault:
      'Ten punkt jest już domyślny. Aby to zmienić, ustaw inny punkt jako domyślny.',
    activeHint: 'Nieaktywne punkty nie są proponowane przy zlecaniu dostawy.',
    active: 'Aktywny',
    inactive: 'Nieaktywny',
    noBranchName:
      'Punkt utworzono przed przejściem na ukraińskie API Nova Poshta, więc nie ma w nim nazwy oddziału. Otwórz punkt i wybierz oddział ponownie.',
    pickBusinessPoints: 'Wybierz firmę, aby otworzyć punkty nadania.',
    pointsIntro:
      'Skąd wysyłasz paczki. Dane punktu są wstawiane jako nadawca listu przewozowego, a punkt domyślny — przy zlecaniu dostawy.',
    pointsLoadError:
      'Nie udało się wczytać punktów. Dane punktów się nie zmieniły —',
    tryAgainLower: 'spróbuj ponownie',
    pointsLoading: 'Wczytywanie punktów nadania…',
    noPointsTitle: 'Nie ma jeszcze punktów nadania',
    noPointsText:
      'Dodaj co najmniej jeden punkt, aby zlecać dostawy z zamówień. Pierwszy aktywny punkt stanie się domyślnym.',
    pointsTitle: 'Punkty nadania',
    defaultBadge: 'Domyślny',
    privateSender: 'Nadawca jest osobą prywatną',
    branchNameMissing: 'Nazwa oddziału niedostępna',
    change: 'Zmień',
    defaultFootnote:
      'Punkt domyślny jest wstawiany przy zlecaniu dostawy. Menedżer może wybrać inny.',
    settlementLabel: 'Miejscowość',
    prohibitedSending: 'nie przyjmuje przesyłek',
    prohibitedReceiving: 'nie wydaje przesyłek',
    pickedProhibited: 'Wybrano z katalogu. Ta miejscowość {rule}.',
    picked: 'Wybrano z katalogu Nova Poshta.',
    startTypingHint:
      'Zacznij wpisywać nazwę — podpowiemy z katalogu Nova Poshta.',
    startTyping: 'Zacznij wpisywać nazwę',
    directory: 'Katalog Nova Poshta',
    directoryError: 'błąd',
    searching: 'Szukanie…',
    matches: {
      one: '{count} wynik',
      few: '{count} wyniki',
      many: '{count} wyników',
      other: '{count} wyniku',
    },
    noMatches: 'brak wyników',
    directoryFailed:
      'Nie udało się wczytać katalogu. Przyczynę pokazano pod polem.',
    directoryLoading: 'Wczytywanie katalogu…',
    nothingFound:
      'W katalogu nie ma miejscowości o takiej nazwie. Sprawdź pisownię lub wpisz krótsze zapytanie.',
  },
})
