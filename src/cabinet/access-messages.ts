import { defineMessages } from '@/i18n'

/**
 * Screens shown instead of a module: no permission, plan or subscription
 * gates, quota, access errors and the cabinet 404.
 */
export const accessMessages = defineMessages({
  uk: {
    loadingModule: 'Завантажуємо модуль…',
    checkingAccess: 'Перевіряємо доступ…',
    deniedTitle: 'Недостатньо прав',
    deniedBody:
      'Доступ до цього розділу відкриває власник розбірки в «Команді».',
    quotaTitle: 'Ліміт вичерпано',
    quotaBody:
      'Ліміт тарифу вичерпано: {used} з {max}. Підвищте тариф або звільніть місце.',
    accessErrorTitle: 'Не вдалося перевірити доступ',
    accessErrorBody:
      'Не вдалося отримати ваші права для цієї розбірки. Оновіть сторінку та спробуйте ще раз.',
    comparePlans: 'Порівняти тарифи',
    unavailableTitle: 'Розділ поки недоступний',
    unavailableBody:
      '{module} поки недоступний у вашій розбірці. Посилання запрацює, щойно розділ увімкнуть.',
    toDashboard: 'До головної',
    notInCurrentPlan: 'Недоступно у поточному тарифі',
    notInPlan: 'Недоступно у тарифі {plan}',
    notIncludedTitle: 'Розділ «{module}» не входить у ваш тариф',
    includedInTitle: 'Розділ «{module}» входить у тариф {plan}',
    planLockedBody:
      'Розділ вимкнений тарифом — дані розбірки від цього не змінюються й нікуди не зникають. Щойно тариф дозволить, усе буде на місці.',
    planWithModule: 'Тариф із цим модулем',
    planRequired: 'Потрібен тариф',
    findingPlan: 'Дивимось, який тариф відкриває цей розділ…',
    noPlanInCatalogue:
      'Каталог тарифів не називає тарифу з цим модулем — подивіться повний перелік.',
    currentPlan: 'Зараз у вас «{plan}».',
    noProration:
      'Скільки доплатити за залишок періоду, кабінет не рахує — сума буде видна в рахунку Mono.',
    switchToPlan: 'Перейти на {plan}',
    noPlanPitch:
      'Тариф описаний переліком можливостей і лімітів — розгорнутого опису в ньому немає.',
    onlyThisModule: 'Потрібен лише цей модуль?',
    writeToUs: 'Напишіть нам',
    weWillHelp: '— підберемо варіант.',
    'state.pastDue.chip': 'Оплата прострочена',
    'state.pastDue.title': 'Платіж не пройшов',
    'state.pastDue.body':
      'Списання за підписку не вдалося. Поки платіж не пройде, частина розділів працює лише на перегляд — дані розбірки лишаються на місці.',
    'state.blocked.chip': 'Кабінет у режимі перегляду',
    'state.blocked.title': 'Підписка неактивна — дані лише для читання',
    'state.blocked.body':
      'Склад, замовлення й історія грошей збереглися повністю, але створювати й змінювати записи не можна, доки підписка не відновиться.',
    'state.cancelled.chip': 'Підписку скасовано',
    'state.cancelled.title': 'Підписка скасована — доступ діє до кінця періоду',
    'state.cancelled.body':
      'Списань більше не буде. Коли сплачений період завершиться, кабінет перейде в режим перегляду.',
    'state.none.chip': 'Підписки ще немає',
    'state.none.title': 'Щоб відкрити цей розділ, потрібна підписка',
    'state.none.body':
      'Оформіть тариф — усе, що вже є в розбірці, лишиться на місці й стане доступним одразу після оплати.',
    'state.other.chip': 'Підписка потребує уваги',
    'state.other.title': 'Розділ доступний лише після оплати',
    'state.other.body':
      'Поки підписка неактивна, цей розділ закритий. Історія платежів і тарифи лишаються відкритими.',
    triedToOpen: 'Ви намагалися відкрити «{module}».',
    amountDue: 'Сума до сплати',
    planNotSet: 'тариф не вказано',
    nextCharge: 'Наступне списання',
    noRetryDate:
      'Дати наступної спроби списання кабінет не показує — є лише дата, на яку призначене списання.',
    accessUntil: 'Доступ до',
    noRetention:
      'До якої дати зберігаються дані після зупинки підписки — питання до підтримки.',
    toSubscription: 'Перейти до підписки',
    paymentHistory: 'Історія платежів',
    availableNow: 'Що доступно зараз',
    moduleOpen: 'доступний',
    moduleClosed: 'закритий',
    availableNowNote:
      'Перелік зібраний з тих самих правил, за якими кабінет пускає в розділ, — це не обіцянка, а те, що застосується прямо зараз.',
    paymentQuestions: 'Питання щодо оплати —',
    notFoundEyebrow: 'Помилка 404',
    notFoundTitle: 'Сторінку не знайдено',
    notFoundBody:
      'Можливо, запис видалили або посилання неповне. Спробуйте знайти деталь за номером — або поверніться на головну.',
    searchParts: 'Пошук запчастин',
    searchPartsPlaceholder: 'Номер деталі, назва, VIN',
    find: 'Знайти',
    toHome: 'На головну',
    frequentSections: 'Часті розділи',
  },
  'en-GB': {
    loadingModule: 'Loading module…',
    checkingAccess: 'Checking access…',
    deniedTitle: 'Not enough permissions',
    deniedBody: 'The business owner grants access to this section in Team.',
    quotaTitle: 'Limit reached',
    quotaBody:
      'Your plan limit is used up: {used} of {max}. Upgrade your plan or free up space.',
    accessErrorTitle: 'Couldn’t check access',
    accessErrorBody:
      'Couldn’t get your permissions for this business. Refresh the page and try again.',
    comparePlans: 'Compare plans',
    unavailableTitle: 'Section not available yet',
    unavailableBody:
      '{module} isn’t available for your business yet. The link will work as soon as the section is switched on.',
    toDashboard: 'Go to home',
    notInCurrentPlan: 'Not available on your current plan',
    notInPlan: 'Not available on the {plan} plan',
    notIncludedTitle: '{module} isn’t included in your plan',
    includedInTitle: '{module} is included in the {plan} plan',
    planLockedBody:
      'Your plan has this section switched off — your business data isn’t changed or lost. As soon as your plan allows it, everything will be there.',
    planWithModule: 'Plan with this module',
    planRequired: 'Plan required',
    findingPlan: 'Finding the plan that opens this section…',
    noPlanInCatalogue:
      'The plan catalogue doesn’t list a plan with this module — see the full list.',
    currentPlan: 'You’re currently on “{plan}”.',
    noProration:
      'The cabinet doesn’t calculate the top-up for the rest of the period — you’ll see the amount on the Mono invoice.',
    switchToPlan: 'Switch to {plan}',
    noPlanPitch:
      'A plan is described by its features and limits — there’s no longer description.',
    onlyThisModule: 'Only need this module?',
    writeToUs: 'Write to us',
    weWillHelp: 'and we’ll find an option.',
    'state.pastDue.chip': 'Payment overdue',
    'state.pastDue.title': 'Payment failed',
    'state.pastDue.body':
      'The subscription charge didn’t go through. Until it does, some sections are view-only — your business data stays where it is.',
    'state.blocked.chip': 'Cabinet in view-only mode',
    'state.blocked.title': 'Subscription inactive — data is read-only',
    'state.blocked.body':
      'Stock, orders and money history are fully kept, but you can’t create or change records until the subscription is restored.',
    'state.cancelled.chip': 'Subscription cancelled',
    'state.cancelled.title':
      'Subscription cancelled — access lasts until the end of the period',
    'state.cancelled.body':
      'There will be no more charges. When the paid period ends, the cabinet will switch to view-only mode.',
    'state.none.chip': 'No subscription yet',
    'state.none.title': 'You need a subscription to open this section',
    'state.none.body':
      'Choose a plan — everything already in your business stays put and becomes available straight after payment.',
    'state.other.chip': 'Subscription needs attention',
    'state.other.title': 'This section is available only after payment',
    'state.other.body':
      'While the subscription is inactive, this section is closed. Payment history and plans stay open.',
    triedToOpen: 'You tried to open {module}.',
    amountDue: 'Amount due',
    planNotSet: 'plan not set',
    nextCharge: 'Next charge',
    noRetryDate:
      'The cabinet doesn’t show the next retry date — only the date the charge is scheduled for.',
    accessUntil: 'Access until',
    noRetention:
      'Ask support how long data is kept after a subscription stops.',
    toSubscription: 'Go to subscription',
    paymentHistory: 'Payment history',
    availableNow: 'What’s available now',
    moduleOpen: 'available',
    moduleClosed: 'closed',
    availableNowNote:
      'This list comes from the same rules the cabinet uses to let you into a section — it’s not a promise, it’s what applies right now.',
    paymentQuestions: 'Payment questions:',
    notFoundEyebrow: 'Error 404',
    notFoundTitle: 'Page not found',
    notFoundBody:
      'The record may have been deleted or the link is incomplete. Try finding a part by its number — or go back to the home page.',
    searchParts: 'Search parts',
    searchPartsPlaceholder: 'Part number, name, VIN',
    find: 'Find',
    toHome: 'Go to home',
    frequentSections: 'Frequent sections',
  },
  pl: {
    loadingModule: 'Wczytujemy moduł…',
    checkingAccess: 'Sprawdzamy dostęp…',
    deniedTitle: 'Brak uprawnień',
    deniedBody:
      'Dostęp do tej sekcji nadaje właściciel firmy w sekcji „Zespół”.',
    quotaTitle: 'Limit wyczerpany',
    quotaBody:
      'Limit planu wyczerpany: {used} z {max}. Zmień plan na wyższy lub zwolnij miejsce.',
    accessErrorTitle: 'Nie udało się sprawdzić dostępu',
    accessErrorBody:
      'Nie udało się pobrać Twoich uprawnień dla tej firmy. Odśwież stronę i spróbuj ponownie.',
    comparePlans: 'Porównaj plany',
    unavailableTitle: 'Sekcja jeszcze niedostępna',
    unavailableBody:
      'Sekcja „{module}” nie jest jeszcze dostępna w Twojej firmie. Link zadziała, gdy tylko sekcja zostanie włączona.',
    toDashboard: 'Na stronę główną',
    notInCurrentPlan: 'Niedostępne w obecnym planie',
    notInPlan: 'Niedostępne w planie {plan}',
    notIncludedTitle: 'Sekcja „{module}” nie wchodzi w Twój plan',
    includedInTitle: 'Sekcja „{module}” wchodzi w plan {plan}',
    planLockedBody:
      'Sekcja jest wyłączona przez plan — dane firmy się nie zmieniają i nigdzie nie znikają. Gdy plan na to pozwoli, wszystko będzie na miejscu.',
    planWithModule: 'Plan z tym modułem',
    planRequired: 'Wymagany plan',
    findingPlan: 'Sprawdzamy, który plan otwiera tę sekcję…',
    noPlanInCatalogue:
      'Katalog planów nie wymienia planu z tym modułem — zobacz pełną listę.',
    currentPlan: 'Obecnie masz „{plan}”.',
    noProration:
      'Panel nie wylicza dopłaty za resztę okresu — kwota będzie widoczna na rachunku Mono.',
    switchToPlan: 'Przejdź na {plan}',
    noPlanPitch:
      'Plan jest opisany listą funkcji i limitów — nie ma w nim szerszego opisu.',
    onlyThisModule: 'Potrzebujesz tylko tego modułu?',
    writeToUs: 'Napisz do nas',
    weWillHelp: '— dobierzemy wariant.',
    'state.pastDue.chip': 'Zaległa płatność',
    'state.pastDue.title': 'Płatność nie przeszła',
    'state.pastDue.body':
      'Nie udało się pobrać opłaty za subskrypcję. Dopóki płatność nie przejdzie, część sekcji działa tylko w trybie podglądu — dane firmy zostają na miejscu.',
    'state.blocked.chip': 'Panel w trybie podglądu',
    'state.blocked.title': 'Subskrypcja nieaktywna — dane tylko do odczytu',
    'state.blocked.body':
      'Magazyn, zamówienia i historia finansów zachowały się w całości, ale nie można tworzyć ani zmieniać wpisów, dopóki subskrypcja nie zostanie przywrócona.',
    'state.cancelled.chip': 'Subskrypcja anulowana',
    'state.cancelled.title':
      'Subskrypcja anulowana — dostęp działa do końca okresu',
    'state.cancelled.body':
      'Nie będzie więcej obciążeń. Po zakończeniu opłaconego okresu panel przejdzie w tryb podglądu.',
    'state.none.chip': 'Brak subskrypcji',
    'state.none.title': 'Aby otworzyć tę sekcję, potrzebna jest subskrypcja',
    'state.none.body':
      'Wybierz plan — wszystko, co już jest w firmie, zostanie na miejscu i będzie dostępne od razu po opłaceniu.',
    'state.other.chip': 'Subskrypcja wymaga uwagi',
    'state.other.title': 'Sekcja dostępna dopiero po opłaceniu',
    'state.other.body':
      'Dopóki subskrypcja jest nieaktywna, ta sekcja jest zamknięta. Historia płatności i plany pozostają otwarte.',
    triedToOpen: 'Próbowano otworzyć sekcję „{module}”.',
    amountDue: 'Kwota do zapłaty',
    planNotSet: 'plan nie podany',
    nextCharge: 'Następne obciążenie',
    noRetryDate:
      'Panel nie pokazuje daty kolejnej próby obciążenia — jest tylko data, na którą obciążenie zaplanowano.',
    accessUntil: 'Dostęp do',
    noRetention:
      'Do kiedy dane są przechowywane po zatrzymaniu subskrypcji — zapytaj wsparcie.',
    toSubscription: 'Przejdź do subskrypcji',
    paymentHistory: 'Historia płatności',
    availableNow: 'Co jest teraz dostępne',
    moduleOpen: 'dostępna',
    moduleClosed: 'zamknięta',
    availableNowNote:
      'Lista pochodzi z tych samych reguł, według których panel wpuszcza do sekcji — to nie obietnica, tylko to, co obowiązuje teraz.',
    paymentQuestions: 'Pytania o płatności —',
    notFoundEyebrow: 'Błąd 404',
    notFoundTitle: 'Nie znaleziono strony',
    notFoundBody:
      'Wpis mógł zostać usunięty albo link jest niepełny. Spróbuj znaleźć część po numerze — albo wróć na stronę główną.',
    searchParts: 'Szukaj części',
    searchPartsPlaceholder: 'Numer części, nazwa, VIN',
    find: 'Znajdź',
    toHome: 'Na stronę główną',
    frequentSections: 'Częste sekcje',
  },
})
