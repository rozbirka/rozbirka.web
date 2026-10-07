import { defineMessages } from '@/i18n'

/**
 * Text of a delivery order: the view-models in `delivery-view.ts` and
 * `delivery-labels.ts`, the order card and its body. The drawers have their
 * own namespace in `drawer-messages.ts`.
 */
export const deliveryMessages = defineMessages({
  uk: {
    countryUnavailable:
      'Доставка Новою поштою доступна лише для бізнесів в Україні.',

    // Lifecycle
    stepPaid: 'Оплачено',
    stepWaybill: 'ТТН',
    stepDispatched: 'Передано перевізнику',
    stepReceived: 'Отримано',
    stepReturned: 'Повернення',
    stamp: '{date} · {time}',

    // Chips
    chipReturned: 'Повернене',
    chipConfirmed: 'Підтверджене',
    chipPendingPaid: 'Очікує · оплачене',
    chipPendingDue: 'Очікує · є залишок',
    shipReceived: 'Отримано клієнтом',
    shipCreated: 'ТТН створена',
    shipCreating: 'ТТН створюється',
    shipUnknown: 'Результат невідомий',
    shipCancelled: 'ТТН скасована',
    shipNone: 'ТТН не створена',

    // Facts
    factNotCreated: 'не створена',
    factWithCod: 'буде з післяплатою',
    factCanCreate: 'можна створити',
    factCod: 'Післяплата',
    factCodMatches: 'дорівнює залишку',
    factCodMismatch: 'не дорівнює залишку',
    factParcel: 'Посилка',
    factParcelValue: {
      one: '{count} місце · {weight} кг',
      few: '{count} місця · {weight} кг',
      many: '{count} місць · {weight} кг',
      other: '{count} місця · {weight} кг',
    },
    factDimensions: '{length} × {width} × {height} см',
    factDeposit: 'Депозит',
    depositNotRequired: 'розбірка не вимагає депозиту',
    depositWaivedTrusted: 'знято для довіреного клієнта',
    depositAfterQuote: 'зʼявиться після розрахунку',
    depositPaid: 'внесено',
    depositShort: 'бракує {amount}',

    // Payment standing
    standingFull: 'Оплачено повністю',
    standingPartial: 'Оплачено частково',
    standingNone: 'Не оплачено',

    // Primary action
    returnedHint:
      'Замовлення повернене. Кошти повертаються окремо по кожному платежу.',
    actionCreate: 'Створити ТТН',
    createHintCod: 'Післяплата буде {amount} — рівно залишок.',
    createHintPaid: 'Замовлення оплачене, тож накладна піде без післяплати.',
    actionDispatch: 'Передати перевізнику',
    dispatchHint: 'Після передачі статус лишається «Очікує».',
    receiveHint: 'Замовлення стане «Підтверджене».',
    actionReturn: 'Оформити повернення',
    returnHint: 'Кошти повертаються окремо по кожному платежу.',

    // Readiness
    checkOutstandingCod: 'Залишок поїде післяплатою',
    checkOutstandingNone: 'Залишку немає — післяплати не буде',
    checkDeposit: 'Депозит за доставку внесено',
    depositStateNotRequired: 'розбірка не вимагає',
    depositStateWaived: 'знято',
    checkQuote: 'Розрахунок доставки свіжий',
    quoteNextStep: 'зробимо на наступному кроці',
    quoteUpdated: 'оновлено',
    quoteStaleNext: 'застарів — оновимо на наступному кроці',
    checkDispatchPoint: 'Точка відправлення активна',
    pointActive: 'активна',
    pointNone: 'не обрана',
    checkCarrier: 'Маршрут і габарити',
    carrierChecks: 'перевіряє Нова пошта під час створення',
    nextFixTitle: 'Спершу треба виправити налаштування',
    nextFixNote:
      '{label}: {state}. На наступному кроці це не змінюється — відкрийте налаштування інтеграції.',
    nextQuoteTitle: 'Наступний крок — розрахувати доставку',
    nextQuoteNote:
      'Далі заповнюєте отримувача й посилку та натискаєте «Розрахувати». Звідти ж стане відомий депозит.',
    nextDepositTitle: 'Депозит ще не внесено',
    nextDepositNote:
      'Накладну створити можна, але передати посилку перевізнику — лише після депозиту.',
    nextClearTitle: 'Перешкод не знайдено',
    nextClearNote:
      'Маршрут і габарити Нова пошта перевірить під час створення — відмова можлива вже там.',

    // Payment kinds
    kindPrepayment: 'Завдаток',
    kindOther: 'Оплата',

    // Shipment states (delivery-labels)
    stateDraft: 'Чернетка',
    stateCreating: 'Створюємо ТТН',
    stateCreated: 'ТТН створено',
    stateCancelling: 'Скасовуємо',
    stateCancelled: 'Скасовано',
    stateCancelUnknown: 'Скасування невідоме',

    // Quote presentation (delivery-labels)
    quoteBusyTitle: 'Розрахунок виконується',
    quoteBusyNote: 'Не закривайте панель. Введені дані збережені у формі.',
    quoteBusyAction: 'Розраховуємо…',
    quoteReadyTitle: 'Розрахунок отримано',
    quoteReadyNote: 'Дані Нової пошти для цього відправлення.',
    quoteRecalc: 'Перерахувати',
    quoteStaleTitle: 'Розрахунок застарів',
    quoteStaleNote:
      'Минуло більше 24 годин. Тарифи могли змінитися, тому передоплату потрібно підтвердити новим розрахунком.',
    quoteDirtyTitle: 'Дані доставки змінено',
    quoteDirtyNote:
      'Після розрахунку ви змінили форму. Суми нижче більше не відповідають їй — збережіть і перерахуйте.',
    quoteDirtyAction: 'Зберегти й перерахувати',
    quoteFailedTitle: 'Помилка розрахунку',
    quoteRetry: 'Повторити розрахунок',
    quoteNoneTitle: 'Вартість доставки',
    quoteNoneNote:
      'Розрахунок ще не виконувався. Заповніть посилки й оцінку повернення, щоб дізнатися орієнтовну вартість і потрібну передоплату.',
    quoteNoneAction: 'Розрахувати доставку',

    // Card
    lifecycleLabel: 'Етапи доставки',
    tabsLabel: 'Розділи замовлення',
    tabSales: 'Продажі',
    tabPaid: 'оплачено',
    tabBalance: 'залишок {amount}',
    tabShipping: 'Доставка',
    novaPoshta: 'Нова пошта',
    recipient: 'Отримувач',
    branchChosen: 'Відділення обрано',
    payments: 'Платежі',
    noPayments: 'Платежів ще немає.',
    orderPayments: 'Платежі замовлення',
    till: 'каса',
    fee: ' · комісія {amount}',
    due: 'До сплати',
    agreed: 'Погоджено за доставку',
    paid: 'Сплачено',
    recordPayment: 'Внести оплату',
    stepsTitle: 'Порядок дій',
    stepsShort: 'Коротко',
    stepsExplain: 'Що це означає',
    notePaid: 'ТТН не створюється, поки є будь-який залишок.',
    noteWaybill: 'Післяплата в накладній має дорівнювати залишку.',
    noteDispatched:
      'Фіксується дата передачі. Статус замовлення лишається «Очікує».',
    noteReceived:
      'Переводить замовлення в «Підтверджене» і вмикає звірку післяплати.',
    noteReturned:
      'Доступне лише після отримання. Ставить замовленню статус «Повернено».',
    gateCodTitle: 'ТТН буде з післяплатою',
    gateReadyTitle: 'ТТН можна створити',
    gateCodNote:
      'Нова пошта утримає з отримувача {amount} — рівно залишок за замовленням — і перекаже їх вам. Комісію переказу платить отримувач.',

    // Body
    linkTransaction: 'Прив’язати транзакцію',
    npNotConnected: 'Нову пошту не підключено.',
    npUnavailable: 'Нова пошта недоступна: {status}.',
    npDownNote:
      'Замовлення лишається доставковим: гроші й етапи працюють, а накладну не створити й не оновити, доки інтеграцію не відновлять.',
    openIntegrations: 'Відкрити інтеграції',
    waybillData: 'Дані ТТН',
    printLabel: 'Друк етикетки',
    copyNumber: 'Копіювати номер',
    refreshStatus: 'Оновити статус',
    startDelivery: 'Оформити доставку',
    continueDelivery: 'Продовжити оформлення',
    attachWaybill: 'Прив’язати накладну з кабінету НП',
    numberCopied: 'Номер ТТН скопійовано.',
    copyFailed: 'Не вдалося скопіювати номер ТТН.',

    // Configure card
    configureNote:
      'Замовлення поки не їде поштою. Оформіть доставку — отримувача, посилку й післяплату вкажете на наступному кроці.',
  },
  'en-GB': {
    countryUnavailable:
      'Nova Poshta delivery is only available for businesses in Ukraine.',

    stepPaid: 'Paid',
    stepWaybill: 'Waybill',
    stepDispatched: 'Handed to carrier',
    stepReceived: 'Received',
    stepReturned: 'Return',
    stamp: '{date} · {time}',

    chipReturned: 'Returned',
    chipConfirmed: 'Confirmed',
    chipPendingPaid: 'Pending · paid',
    chipPendingDue: 'Pending · balance due',
    shipReceived: 'Received by customer',
    shipCreated: 'Waybill created',
    shipCreating: 'Creating waybill',
    shipUnknown: 'Outcome unknown',
    shipCancelled: 'Waybill cancelled',
    shipNone: 'No waybill yet',

    factNotCreated: 'not created',
    factWithCod: 'will carry cash on delivery',
    factCanCreate: 'ready to create',
    factCod: 'Cash on delivery',
    factCodMatches: 'matches the balance',
    factCodMismatch: 'does not match the balance',
    factParcel: 'Parcel',
    factParcelValue: {
      one: '{count} piece · {weight} kg',
      other: '{count} pieces · {weight} kg',
    },
    factDimensions: '{length} × {width} × {height} cm',
    factDeposit: 'Deposit',
    depositNotRequired: 'the business does not require a deposit',
    depositWaivedTrusted: 'waived for a trusted customer',
    depositAfterQuote: 'available after the quote',
    depositPaid: 'paid',
    depositShort: '{amount} short',

    standingFull: 'Paid in full',
    standingPartial: 'Partly paid',
    standingNone: 'Not paid',

    returnedHint:
      'The order has been returned. Money is refunded separately for each payment.',
    actionCreate: 'Create waybill',
    createHintCod: 'Cash on delivery will be {amount} — exactly the balance.',
    createHintPaid:
      'The order is paid, so the waybill goes without cash on delivery.',
    actionDispatch: 'Hand to carrier',
    dispatchHint: 'After handover the status stays “Pending”.',
    receiveHint: 'The order will become “Confirmed”.',
    actionReturn: 'Process return',
    returnHint: 'Money is refunded separately for each payment.',

    checkOutstandingCod: 'The balance goes as cash on delivery',
    checkOutstandingNone: 'No balance — no cash on delivery',
    checkDeposit: 'Delivery deposit paid',
    depositStateNotRequired: 'not required by the business',
    depositStateWaived: 'waived',
    checkQuote: 'Delivery quote is up to date',
    quoteNextStep: 'done at the next step',
    quoteUpdated: 'up to date',
    quoteStaleNext: 'out of date — refreshed at the next step',
    checkDispatchPoint: 'Dispatch point is active',
    pointActive: 'active',
    pointNone: 'not chosen',
    checkCarrier: 'Route and dimensions',
    carrierChecks: 'checked by Nova Poshta on creation',
    nextFixTitle: 'Fix the settings first',
    nextFixNote:
      '{label}: {state}. This can’t be changed at the next step — open the integration settings.',
    nextQuoteTitle: 'Next step: get a delivery quote',
    nextQuoteNote:
      'Next, fill in the recipient and parcel and press “Get quote”. The deposit is worked out there too.',
    nextDepositTitle: 'Deposit not paid yet',
    nextDepositNote:
      'You can create the waybill, but the parcel can only be handed to the carrier once the deposit is paid.',
    nextClearTitle: 'No obstacles found',
    nextClearNote:
      'Nova Poshta checks the route and dimensions on creation — it may still refuse at that point.',

    kindPrepayment: 'Prepayment',
    kindOther: 'Payment',

    stateDraft: 'Draft',
    stateCreating: 'Creating waybill',
    stateCreated: 'Waybill created',
    stateCancelling: 'Cancelling',
    stateCancelled: 'Cancelled',
    stateCancelUnknown: 'Cancellation unknown',

    quoteBusyTitle: 'Getting a quote',
    quoteBusyNote: 'Don’t close the panel. What you entered stays in the form.',
    quoteBusyAction: 'Getting quote…',
    quoteReadyTitle: 'Quote received',
    quoteReadyNote: 'Nova Poshta’s figures for this shipment.',
    quoteRecalc: 'Re-quote',
    quoteStaleTitle: 'Quote out of date',
    quoteStaleNote:
      'More than 24 hours have passed. Rates may have changed, so the prepayment needs a fresh quote.',
    quoteDirtyTitle: 'Delivery details changed',
    quoteDirtyNote:
      'You changed the form after the quote. The amounts below no longer match it — save and re-quote.',
    quoteDirtyAction: 'Save and re-quote',
    quoteFailedTitle: 'Quote failed',
    quoteRetry: 'Try the quote again',
    quoteNoneTitle: 'Delivery cost',
    quoteNoneNote:
      'No quote yet. Fill in the parcels and the return estimate to see the approximate cost and the prepayment needed.',
    quoteNoneAction: 'Get delivery quote',

    lifecycleLabel: 'Delivery stages',
    tabsLabel: 'Order sections',
    tabSales: 'Sales',
    tabPaid: 'paid',
    tabBalance: '{amount} due',
    tabShipping: 'Delivery',
    novaPoshta: 'Nova Poshta',
    recipient: 'Recipient',
    branchChosen: 'Branch selected',
    payments: 'Payments',
    noPayments: 'No payments yet.',
    orderPayments: 'Order payments',
    till: 'till',
    fee: ' · fee {amount}',
    due: 'To pay',
    agreed: 'Agreed for delivery',
    paid: 'Paid',
    recordPayment: 'Record payment',
    stepsTitle: 'Order of steps',
    stepsShort: 'Less',
    stepsExplain: 'What this means',
    notePaid: 'No waybill is created while any balance remains.',
    noteWaybill: 'Cash on delivery on the waybill must equal the balance.',
    noteDispatched:
      'The handover date is recorded. The order status stays “Pending”.',
    noteReceived:
      'Moves the order to “Confirmed” and starts cash-on-delivery reconciliation.',
    noteReturned:
      'Available only after receipt. Sets the order status to “Returned”.',
    gateCodTitle: 'Waybill with cash on delivery',
    gateReadyTitle: 'Waybill can be created',
    gateCodNote:
      'Nova Poshta will collect {amount} from the recipient — exactly the order balance — and transfer it to you. The recipient pays the transfer fee.',

    linkTransaction: 'Link transaction',
    npNotConnected: 'Nova Poshta is not connected.',
    npUnavailable: 'Nova Poshta is unavailable: {status}.',
    npDownNote:
      'The order is still a delivery order: money and stages work, but the waybill can’t be created or updated until the integration is restored.',
    openIntegrations: 'Open integrations',
    waybillData: 'Waybill details',
    printLabel: 'Print label',
    copyNumber: 'Copy number',
    refreshStatus: 'Refresh status',
    startDelivery: 'Arrange delivery',
    continueDelivery: 'Continue booking',
    attachWaybill: 'Link a waybill from Nova Poshta',
    numberCopied: 'Waybill number copied.',
    copyFailed: 'Couldn’t copy the waybill number.',

    configureNote:
      'This order isn’t being shipped yet. Arrange delivery — you’ll add the recipient, parcel and cash on delivery at the next step.',
  },
  pl: {
    countryUnavailable:
      'Dostawa Nova Poshta jest dostępna tylko dla firm na Ukrainie.',

    stepPaid: 'Opłacone',
    stepWaybill: 'List przewozowy',
    stepDispatched: 'Przekazano przewoźnikowi',
    stepReceived: 'Odebrano',
    stepReturned: 'Zwrot',
    stamp: '{date} · {time}',

    chipReturned: 'Zwrócone',
    chipConfirmed: 'Potwierdzone',
    chipPendingPaid: 'Oczekuje · opłacone',
    chipPendingDue: 'Oczekuje · do dopłaty',
    shipReceived: 'Odebrane przez klienta',
    shipCreated: 'List przewozowy utworzony',
    shipCreating: 'Tworzenie listu przewozowego',
    shipUnknown: 'Wynik nieznany',
    shipCancelled: 'List przewozowy anulowany',
    shipNone: 'Brak listu przewozowego',

    factNotCreated: 'nie utworzono',
    factWithCod: 'będzie z pobraniem',
    factCanCreate: 'można utworzyć',
    factCod: 'Pobranie',
    factCodMatches: 'zgodne z saldem',
    factCodMismatch: 'niezgodne z saldem',
    factParcel: 'Przesyłka',
    factParcelValue: {
      one: '{count} paczka · {weight} kg',
      few: '{count} paczki · {weight} kg',
      many: '{count} paczek · {weight} kg',
      other: '{count} paczki · {weight} kg',
    },
    factDimensions: '{length} × {width} × {height} cm',
    factDeposit: 'Kaucja',
    depositNotRequired: 'firma nie wymaga kaucji',
    depositWaivedTrusted: 'zniesiona dla zaufanego klienta',
    depositAfterQuote: 'pojawi się po wycenie',
    depositPaid: 'wpłacona',
    depositShort: 'brakuje {amount}',

    standingFull: 'Opłacone w całości',
    standingPartial: 'Opłacone częściowo',
    standingNone: 'Nieopłacone',

    returnedHint:
      'Zamówienie zostało zwrócone. Pieniądze zwraca się osobno dla każdej płatności.',
    actionCreate: 'Utwórz list przewozowy',
    createHintCod: 'Pobranie wyniesie {amount} — dokładnie tyle, ile saldo.',
    createHintPaid:
      'Zamówienie jest opłacone, więc list przewozowy pójdzie bez pobrania.',
    actionDispatch: 'Przekaż przewoźnikowi',
    dispatchHint: 'Po przekazaniu status pozostaje „Oczekuje”.',
    receiveHint: 'Zamówienie otrzyma status „Potwierdzone”.',
    actionReturn: 'Przyjmij zwrot',
    returnHint: 'Pieniądze zwraca się osobno dla każdej płatności.',

    checkOutstandingCod: 'Saldo zostanie pobrane przy odbiorze',
    checkOutstandingNone: 'Brak salda — bez pobrania',
    checkDeposit: 'Kaucja za dostawę wpłacona',
    depositStateNotRequired: 'firma nie wymaga',
    depositStateWaived: 'zniesiona',
    checkQuote: 'Wycena dostawy jest aktualna',
    quoteNextStep: 'zrobimy w następnym kroku',
    quoteUpdated: 'aktualna',
    quoteStaleNext: 'nieaktualna — odświeżymy w następnym kroku',
    checkDispatchPoint: 'Punkt nadania jest aktywny',
    pointActive: 'aktywny',
    pointNone: 'nie wybrano',
    checkCarrier: 'Trasa i wymiary',
    carrierChecks: 'sprawdza Nova Poshta przy tworzeniu',
    nextFixTitle: 'Najpierw trzeba poprawić ustawienia',
    nextFixNote:
      '{label}: {state}. W następnym kroku tego się nie zmieni — otwórz ustawienia integracji.',
    nextQuoteTitle: 'Następny krok — wycena dostawy',
    nextQuoteNote:
      'Dalej uzupełniasz odbiorcę i przesyłkę i klikasz „Wyceń”. Tam też poznasz kaucję.',
    nextDepositTitle: 'Kaucja nie została jeszcze wpłacona',
    nextDepositNote:
      'List przewozowy można utworzyć, ale przesyłkę można przekazać przewoźnikowi dopiero po wpłacie kaucji.',
    nextClearTitle: 'Nie znaleziono przeszkód',
    nextClearNote:
      'Trasę i wymiary Nova Poshta sprawdzi przy tworzeniu — odmowa jest możliwa dopiero wtedy.',

    kindPrepayment: 'Przedpłata',
    kindOther: 'Płatność',

    stateDraft: 'Szkic',
    stateCreating: 'Tworzymy list przewozowy',
    stateCreated: 'List przewozowy utworzony',
    stateCancelling: 'Anulujemy',
    stateCancelled: 'Anulowano',
    stateCancelUnknown: 'Wynik anulowania nieznany',

    quoteBusyTitle: 'Trwa wycena',
    quoteBusyNote: 'Nie zamykaj panelu. Wprowadzone dane zostają w formularzu.',
    quoteBusyAction: 'Wyceniamy…',
    quoteReadyTitle: 'Wycena otrzymana',
    quoteReadyNote: 'Dane Nova Poshta dla tej przesyłki.',
    quoteRecalc: 'Przelicz ponownie',
    quoteStaleTitle: 'Wycena nieaktualna',
    quoteStaleNote:
      'Minęło ponad 24 godziny. Taryfy mogły się zmienić, więc przedpłatę trzeba potwierdzić nową wyceną.',
    quoteDirtyTitle: 'Dane dostawy zmienione',
    quoteDirtyNote:
      'Formularz zmienił się po wycenie. Kwoty poniżej już mu nie odpowiadają — zapisz i przelicz ponownie.',
    quoteDirtyAction: 'Zapisz i przelicz',
    quoteFailedTitle: 'Błąd wyceny',
    quoteRetry: 'Ponów wycenę',
    quoteNoneTitle: 'Koszt dostawy',
    quoteNoneNote:
      'Wyceny jeszcze nie było. Uzupełnij przesyłki i szacunek zwrotu, aby poznać orientacyjny koszt i wymaganą przedpłatę.',
    quoteNoneAction: 'Wyceń dostawę',

    lifecycleLabel: 'Etapy dostawy',
    tabsLabel: 'Sekcje zamówienia',
    tabSales: 'Sprzedaż',
    tabPaid: 'opłacone',
    tabBalance: 'do zapłaty {amount}',
    tabShipping: 'Dostawa',
    novaPoshta: 'Nova Poshta',
    recipient: 'Odbiorca',
    branchChosen: 'Oddział wybrany',
    payments: 'Płatności',
    noPayments: 'Brak płatności.',
    orderPayments: 'Płatności zamówienia',
    till: 'kasa',
    fee: ' · prowizja {amount}',
    due: 'Do zapłaty',
    agreed: 'Uzgodniono za dostawę',
    paid: 'Zapłacono',
    recordPayment: 'Dodaj płatność',
    stepsTitle: 'Kolejność działań',
    stepsShort: 'Krócej',
    stepsExplain: 'Co to oznacza',
    notePaid:
      'List przewozowy nie powstaje, dopóki zostaje jakiekolwiek saldo.',
    noteWaybill: 'Pobranie w liście przewozowym musi być równe saldu.',
    noteDispatched:
      'Zapisywana jest data przekazania. Status zamówienia pozostaje „Oczekuje”.',
    noteReceived:
      'Zmienia status zamówienia na „Potwierdzone” i włącza uzgadnianie pobrania.',
    noteReturned:
      'Dostępne dopiero po odbiorze. Ustawia zamówieniu status „Zwrócone”.',
    gateCodTitle: 'List przewozowy z pobraniem',
    gateReadyTitle: 'Można utworzyć list przewozowy',
    gateCodNote:
      'Nova Poshta pobierze od odbiorcy {amount} — dokładnie saldo zamówienia — i przekaże je firmie. Prowizję za przekaz płaci odbiorca.',

    linkTransaction: 'Powiąż transakcję',
    npNotConnected: 'Nova Poshta nie jest podłączona.',
    npUnavailable: 'Nova Poshta jest niedostępna: {status}.',
    npDownNote:
      'Zamówienie nadal jest zamówieniem z dostawą: płatności i etapy działają, ale listu przewozowego nie da się utworzyć ani zaktualizować, dopóki integracja nie zostanie przywrócona.',
    openIntegrations: 'Otwórz integracje',
    waybillData: 'Dane listu przewozowego',
    printLabel: 'Drukuj etykietę',
    copyNumber: 'Kopiuj numer',
    refreshStatus: 'Odśwież status',
    startDelivery: 'Zorganizuj dostawę',
    continueDelivery: 'Kontynuuj nadawanie',
    attachWaybill: 'Powiąż list przewozowy z konta Nova Poshta',
    numberCopied: 'Numer listu przewozowego skopiowany.',
    copyFailed: 'Nie udało się skopiować numeru listu przewozowego.',

    configureNote:
      'To zamówienie nie jest jeszcze wysyłane. Zorganizuj dostawę — odbiorcę, przesyłkę i pobranie podasz w następnym kroku.',
  },
})
