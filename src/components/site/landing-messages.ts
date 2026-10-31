import { defineMessages } from '@/i18n/messages'

/**
 * Landing v6 sections between the hero and the pricing: promo bar, product
 * demo cards, reviews, pains, steps, spotlights, comparison, the closing
 * lead form and the footer columns. Chrome shared with other pages stays in
 * `site-messages.ts`, module cards in `features-messages.ts`.
 * Lists use `|` between items so one key keeps one block in every language.
 */
export const landingMessages = defineMessages({
  uk: {
    promoText: 'Тариф Pro — 14 днів безкоштовно.',
    promoCta: 'Почати зараз →',
    headerCta: 'Спробувати',

    heroBadge: 'Програма для авторозбірки',
    heroDemo: 'Не готовий реєструватись? Покажемо демо в Telegram за 10 хвилин',
    heroStats:
      '14 днів=безкоштовно|9 модулів=в одному інтерфейсі|Веб + iOS=версія і застосунок',
    cardStatus: 'Профіль авто · онлайн',
    cardPaidOff: 'Окупилось',
    invested: 'Вклав',
    earned: 'Забрав',
    soldParts: 'Продано деталей',
    soldOf: '{sold} з {total}',
    heroSales: 'Двигун N47D20|Капот|Фара ліва',
    stickerPart: 'Фара ліва',
    stickerShelf: 'Полиця B3',

    ticker:
      'Нова Пошта=ТТН з замовлення|OLX=оголошення з картки деталі|Telegram=сповіщення про продажі|QR-стікери=друк на будь-якому принтері|Excel=імпорт складу|App Store=склад у телефоні',

    reviewsEyebrow: 'Вже користуються',
    reviewsTitle: 'Розбірки по всій Україні вже ведуть облік у rozbirka',
    trust:
      'розбірок користуються|авто в обліку|деталей зі стікерами|оцінка в App Store',
    review1:
      'Раніше рахували прибуток по авто раз на квартал і то приблизно. Тепер бачу по кожній машині, скільки ще треба продати, щоб вийти в плюс.',
    review1Name: 'Андрій',
    review1Role: 'Розбірка BMW, Київ',
    review2:
      'Наклеїли QR на всі деталі за тиждень. Новий продавець знаходить запчастину сам, без мене.',
    review2Name: 'Сергій',
    review2Role: 'Розбірка, Львів',
    review3:
      'Тримаємо гроші в гривнях і доларах, на готівці й на ФОП. Раніше в кінці місяця нічого не сходилось, тепер баланс кожної каси видно одразу.',
    review3Name: 'Ігор',
    review3Role: 'Розбірка японських авто, Дніпро',

    painEyebrow: 'Знайомо?',
    painTitle: 'Коли облік у зошиті й Excel, гроші губляться разом з деталями',
    painNow: 'Як зараз',
    painWith: 'З rozbirka',
    pains:
      'Все записано в зошиті, а зошит лишився на складі=Фото, документи, історія — без папок і Excel|Розібрав Пассат, а чи він відбився — хто зна=Точно знаєш скільки вклав і скільки забрав|Клієнт на телефоні, а я пів години шукаю фару по полицях=Кожна деталь на своєму місці — знаходиш за секунди|Долари в шухляді, гривні на ФОП — в кінці місяця не сходиться=Кілька кас на різні валюти й рахунки — не плутаєш|Продавець знає, за скільки я купив, і дає знижки як хоче=Без зайвих очей: продавець не бачить собівартість|Деталь зникла, і ніхто не знає, хто її продав=Бачиш хто і що зробив — повний журнал дій',
    trialNote: '14 днів на тарифі Pro',

    howTitle: 'Від VIN до останньої гайки — все в одному профілі',
    howIntro: 'Фото, документи, історія — без папок і Excel.',
    steps:
      'Партія=Закупив і додав=Закупив партію — додав одним рухом, без переписування|Авто=Розібрав=Розбирай авто — система рахує кожну деталь|Стікер=Наклеїв QR=Друкуєш стікер на кожну деталь: QR + назва|Продаж=Продав=Збираєш замовлення в кілька кліків: клієнт, деталь, ціна',

    carsEyebrow: 'Авто та партії',
    carsTitle: 'Прозорий прибуток по кожному кузову',
    carsPoints:
      'Точно знаєш скільки вклав і скільки забрав|Бачиш, яке авто окупилось найкраще|Прибуток по партії окремо — точно, без здогадок|Розумієш, який постачальник приніс найбільше',
    chartLabel: 'Чистий прибуток · 6 місяців',
    months: 'Тра|Чер|Лип|Сер|Вер|Жов',
    carsList: 'Авто на розбірці',
    currencyLabel: 'Валюта обліку · {code}',
    carInvested: 'Вклав {amount}',
    carEarned: 'Забрав {amount}',
    carParts: '{sold} з {total} деталей',

    stockEyebrow: 'Склад і стікери',
    stockTitle: 'Кожна деталь на своєму місці — знаходиш за секунди',
    stockPoints:
      'Друкуєш стікер на кожну деталь: QR + назва|Сканування з телефону — миттєво відкриває картку|Видно, що вільне, що зарезервовано, що в замовленні|Чітко бачиш скільки на складі і на яку суму',
    stickerCar: 'BMW 320d E90 · Полиця B3',
    statusTitle: 'Статус',
    statuses: 'Вільна|Зарезервована|В замовленні',
    stockValue: 'На складі на суму',

    ordersEyebrow: 'Замовлення і каси',
    ordersTitle: 'Оплата гнучка: кілька платежів, різні валюти й рахунки',
    orderTitle: 'Замовлення #1048',
    orderCustomer: 'Олег К.',
    orderReserved: '✓ Резерв',
    orderPaid: 'Оплачено',
    orderShipping: 'Відвантаження',
    orderLines: 'Фара ліва BMW E90|Дзеркало праве|Блок ABS',
    orderTotal: 'Разом',
    cashTitle: 'Каси',
    cashRows: 'Готівка|Рахунок ФОП|Готівка',
    cashNote: 'Бачиш баланс кожної каси в реальному часі',
    orderPoints:
      'Бачиш статус від резерву до відвантаження|Оплата автоматично заходить у потрібну касу|Переміщуєш гроші між касами в один клік|Клієнт привʼязаний — вся історія покупок під рукою|Швидкі чеки й накладні — без ручної рутини',

    teamEyebrow: 'Команда',
    teamTitle: 'Без зайвих очей: продавець не бачить собівартість',
    teamPoints:
      'Додаєш співробітників — кожному своя роль і доступ|Бачиш хто і що зробив — повний журнал дій|Розумієш хто скільки продав і заробив',
    permAccess: 'Доступ',
    permRoles: 'Власник|Менеджер|Продавець',
    permRows: 'Собівартість|Ціни продажу|Каси|Звіти|Журнал дій',
    permYes: '✓ Так',
    permNo: '— Ні',

    midTitle: 'Перевір на своїй розбірці — 14 днів безкоштовно',
    midBody: 'Додай перше авто, наклей стікери, проведи перше замовлення.',
    startFree: 'Почати безкоштовно',
    orderDemo: 'Замовити демо',

    compareEyebrow: 'Порівняння',
    compareTitle: 'Чому не Excel і не універсальна програма для автомагазину',
    compareCols: 'Excel / зошит|Універсальна ERP',
    compare:
      'Прибуток і ROI по кожному авто=Рахуєш вручну=Немає=Автоматично|Партії й собівартість деталі=Формули ламаються=Частково=З коробки|QR-стікер на кожну деталь=Немає=Штрих-коди товарів=QR + полиця + авто|Робота з телефону=Незручно=Складський додаток=Весь бізнес у телефоні|Приховати собівартість від продавця=Неможливо=Залежить від тарифу=Ролі й права|Створено саме для розбірки=Ні=Один із сегментів=Так',

    pricingEyebrow: 'Тарифи',
    pricingNote: '14 днів безкоштовно на тарифі Pro',
    faqTitle: 'Поширені питання',

    startTitle: 'Ти все ще ведеш облік вручну?',
    startBody:
      'Переходь на rozbirka: 14 днів безкоштовно, без картки. Авто, склад, замовлення й каси в одній системі. Є веб-версія і застосунок в App Store.',
    formTitle: 'Допоможемо почати',
    formIntro:
      'Залиш контакт — напишемо з Telegram-бота підтримки і допоможемо налаштувати розбірку.',
    formName: "Ім'я",
    formNamePlaceholder: 'Олег',
    formContact: 'Телефон або Telegram',
    formContactPlaceholder: '+380 або @nickname',
    formCars: 'Скільки авто зараз на розбірці',
    formCarsOptions: 'До 5|5–20|Понад 20',
    formSubmit: 'Отримати 14 днів безкоштовно',
    formTelegram: 'або одразу напиши в Telegram-бот →',
    formThanks: 'Дякуємо!',
    formThanksBody:
      "Зв'яжемось найближчим часом. А поки можна зареєструватись і додати перше авто.",
    formThanksCta: 'Перейти до реєстрації',

    appStoreLine1: 'Завантажте в',
    footerTagline:
      'Програма обліку для авторозбірки: авто, деталі, замовлення, каси й команда.',
    footerProduct: 'Продукт',
    footerSupport: 'Підтримка',
    footerSupportHint: 'Питання, демо, допомога з налаштуванням',
    footerPlatform: 'Платформа',
    footerWeb: 'Веб-версія',
  },
  'en-GB': {
    promoText: 'Pro plan — 14 days free.',
    promoCta: 'Start now →',
    headerCta: 'Try it',

    heroBadge: 'Software for car breakers',
    heroDemo:
      'Not ready to sign up? We’ll show you a demo on Telegram in 10 minutes',
    heroStats:
      '14 days=free|9 modules=in one interface|Web + iOS=web app and iPhone app',
    cardStatus: 'Car profile · live',
    cardPaidOff: 'Paid off',
    invested: 'Invested',
    earned: 'Earned',
    soldParts: 'Parts sold',
    soldOf: '{sold} of {total}',
    heroSales: 'N47D20 engine|Bonnet|Left headlight',
    stickerPart: 'Left headlight',
    stickerShelf: 'Shelf B3',

    ticker:
      'Nova Poshta=waybills from orders|OLX=listings from the part card|Telegram=sales notifications|QR stickers=print on any printer|Excel=stock import|App Store=your stock on your phone',

    reviewsEyebrow: 'Already on board',
    reviewsTitle:
      'Breakers across Ukraine already keep their books in rozbirka',
    trust: 'breakers use it|cars tracked|parts with stickers|App Store rating',
    review1:
      'We used to work out the profit per car once a quarter, and only roughly. Now I see for every car how much is left to sell before it breaks even.',
    review1Name: 'Andrii',
    review1Role: 'BMW breaker, Kyiv',
    review2:
      'We stuck QR codes on every part in a week. A new salesperson finds a part on their own, without me.',
    review2Name: 'Serhii',
    review2Role: 'Car breaker, Lviv',
    review3:
      'We keep money in hryvnias and dollars, in cash and in the business account. Nothing used to add up at the end of the month — now every till’s balance is right there.',
    review3Name: 'Ihor',
    review3Role: 'Japanese car breaker, Dnipro',

    painEyebrow: 'Sound familiar?',
    painTitle:
      'When your books live in a notebook and Excel, money goes missing along with the parts',
    painNow: 'Today',
    painWith: 'With rozbirka',
    pains:
      'It’s all in the notebook, and the notebook is back at the yard=Photos, documents, history — no folders, no Excel|I stripped the Passat, but did it pay off? Who knows=You know exactly what you put in and what you got out|A customer is on the phone and I spend half an hour hunting for a headlight=Every part in its place — found in seconds|Dollars in the drawer, hryvnias in the bank — nothing adds up at month end=Several tills for different currencies and accounts — no mix-ups|The salesperson knows what I paid and hands out discounts at will=No prying eyes: salespeople don’t see the cost price|A part went missing and nobody knows who sold it=See who did what — a full activity log',
    trialNote: '14 days on the Pro plan',

    howTitle: 'From VIN to the last nut — all in one profile',
    howIntro: 'Photos, documents, history — no folders, no Excel.',
    steps:
      'Batch=Bought and added=Bought a batch — add it in one go, no retyping|Car=Stripped=Strip a car — the system counts every part|Sticker=QR stuck on=Print a sticker for every part: QR + name|Sale=Sold=Build an order in a few clicks: customer, part, price',

    carsEyebrow: 'Cars and batches',
    carsTitle: 'Clear profit on every car',
    carsPoints:
      'You know exactly what you put in and what you got out|See which car paid off best|Profit per batch on its own — exact, no guesswork|Find out which supplier made you the most',
    chartLabel: 'Net profit · 6 months',
    months: 'May|Jun|Jul|Aug|Sep|Oct',
    carsList: 'Cars being stripped',
    currencyLabel: 'Accounting currency · {code}',
    carInvested: 'In {amount}',
    carEarned: 'Out {amount}',
    carParts: '{sold} of {total} parts',

    stockEyebrow: 'Stock and stickers',
    stockTitle: 'Every part in its place — found in seconds',
    stockPoints:
      'Print a sticker for every part: QR + name|Scan with your phone — the part card opens instantly|See what’s available, reserved or in an order|Know exactly how much is in stock and what it’s worth',
    stickerCar: 'BMW 320d E90 · Shelf B3',
    statusTitle: 'Status',
    statuses: 'Available|Reserved|In an order',
    stockValue: 'Stock value',

    ordersEyebrow: 'Orders and tills',
    ordersTitle:
      'Flexible payment: several payments, different currencies and accounts',
    orderTitle: 'Order #1048',
    orderCustomer: 'Oleh K.',
    orderReserved: '✓ Reserved',
    orderPaid: 'Paid',
    orderShipping: 'Shipping',
    orderLines: 'Left headlight BMW E90|Right mirror|ABS unit',
    orderTotal: 'Total',
    cashTitle: 'Tills',
    cashRows: 'Cash|Business account|Cash',
    cashNote: 'See every till’s balance in real time',
    orderPoints:
      'Track status from reservation to shipping|Payments land in the right till automatically|Move money between tills in one click|The customer is linked — their whole purchase history at hand|Quick receipts and invoices — no manual busywork',

    teamEyebrow: 'Team',
    teamTitle: 'No prying eyes: salespeople don’t see the cost price',
    teamPoints:
      'Add staff — each with their own role and access|See who did what — a full activity log|Know who sold and earned how much',
    permAccess: 'Access',
    permRoles: 'Owner|Manager|Salesperson',
    permRows: 'Cost price|Sale prices|Tills|Reports|Activity log',
    permYes: '✓ Yes',
    permNo: '— No',

    midTitle: 'Try it at your own yard — 14 days free',
    midBody: 'Add your first car, stick on the stickers, run your first order.',
    startFree: 'Start for free',
    orderDemo: 'Book a demo',

    compareEyebrow: 'Comparison',
    compareTitle: 'Why not Excel or a generic auto parts shop system',
    compareCols: 'Excel / notebook|Generic ERP',
    compare:
      'Profit and ROI per car=Worked out by hand=No=Automatic|Batches and cost per part=Formulas break=Partly=Out of the box|QR sticker on every part=No=Product barcodes=QR + shelf + car|Working from a phone=Awkward=Warehouse app=Your whole business on your phone|Hide cost price from salespeople=Impossible=Depends on the plan=Roles and permissions|Built for car breakers=No=One of many segments=Yes',

    pricingEyebrow: 'Pricing',
    pricingNote: '14 days free on the Pro plan',
    faqTitle: 'Frequently asked questions',

    startTitle: 'Still keeping your books by hand?',
    startBody:
      'Switch to rozbirka: 14 days free, no card needed. Cars, stock, orders and tills in one system. There’s a web app and an iPhone app on the App Store.',
    formTitle: 'We’ll help you get started',
    formIntro:
      'Leave your contact — our Telegram support bot will message you and help set up your yard.',
    formName: 'Name',
    formNamePlaceholder: 'Oleh',
    formContact: 'Phone or Telegram',
    formContactPlaceholder: '+44 or @nickname',
    formCars: 'How many cars are you stripping now',
    formCarsOptions: 'Up to 5|5–20|More than 20',
    formSubmit: 'Get 14 days free',
    formTelegram: 'or message the Telegram bot straight away →',
    formThanks: 'Thank you!',
    formThanksBody:
      'We’ll be in touch soon. Meanwhile you can sign up and add your first car.',
    formThanksCta: 'Go to sign-up',

    appStoreLine1: 'Download on the',
    footerTagline:
      'Accounting software for car breakers: cars, parts, orders, tills and team.',
    footerProduct: 'Product',
    footerSupport: 'Support',
    footerSupportHint: 'Questions, demos, help with setup',
    footerPlatform: 'Platform',
    footerWeb: 'Web app',
  },
  pl: {
    promoText: 'Plan Pro — 14 dni za darmo.',
    promoCta: 'Zacznij teraz →',
    headerCta: 'Wypróbuj',

    heroBadge: 'Program dla demontażu aut',
    heroDemo:
      'Nie chcesz się jeszcze rejestrować? Pokażemy demo na Telegramie w 10 minut',
    heroStats:
      '14 dni=za darmo|9 modułów=w jednym interfejsie|Web + iOS=wersja przeglądarkowa i aplikacja',
    cardStatus: 'Profil auta · online',
    cardPaidOff: 'Zwróciło się',
    invested: 'Włożone',
    earned: 'Odzyskane',
    soldParts: 'Sprzedane części',
    soldOf: '{sold} z {total}',
    heroSales: 'Silnik N47D20|Maska|Lewy reflektor',
    stickerPart: 'Lewy reflektor',
    stickerShelf: 'Półka B3',

    ticker:
      'Nova Poshta=listy przewozowe z zamówienia|OLX=ogłoszenia z karty części|Telegram=powiadomienia o sprzedaży|Naklejki QR=druk na dowolnej drukarce|Excel=import magazynu|App Store=magazyn w telefonie',

    reviewsEyebrow: 'Już korzystają',
    reviewsTitle:
      'Demontaże w całej Ukrainie już prowadzą ewidencję w rozbirka',
    trust:
      'demontaży korzysta|aut w ewidencji|części z naklejkami|ocena w App Store',
    review1:
      'Kiedyś liczyliśmy zysk z auta raz na kwartał i to w przybliżeniu. Teraz przy każdym aucie widzę, ile jeszcze trzeba sprzedać, żeby wyjść na plus.',
    review1Name: 'Andrij',
    review1Role: 'Demontaż BMW, Kijów',
    review2:
      'W tydzień nakleiliśmy QR na wszystkie części. Nowy sprzedawca sam znajduje część, beze mnie.',
    review2Name: 'Serhij',
    review2Role: 'Demontaż, Lwów',
    review3:
      'Trzymamy pieniądze w hrywnach i dolarach, w gotówce i na koncie firmowym. Kiedyś pod koniec miesiąca nic się nie zgadzało, teraz saldo każdej kasy widać od razu.',
    review3Name: 'Ihor',
    review3Role: 'Demontaż aut japońskich, Dniepr',

    painEyebrow: 'Znasz to?',
    painTitle:
      'Gdy ewidencja jest w zeszycie i Excelu, pieniądze giną razem z częściami',
    painNow: 'Teraz',
    painWith: 'Z rozbirka',
    pains:
      'Wszystko jest w zeszycie, a zeszyt został w magazynie=Zdjęcia, dokumenty, historia — bez teczek i Excela|Rozebrałem Passata, ale czy się zwrócił — kto wie=Dokładnie wiesz, ile włożyłeś i ile odzyskałeś|Klient czeka na telefonie, a ja pół godziny szukam reflektora po półkach=Każda część na swoim miejscu — znajdujesz w kilka sekund|Dolary w szufladzie, hrywny na koncie — pod koniec miesiąca nic się nie zgadza=Kilka kas na różne waluty i konta — nic się nie myli|Sprzedawca wie, za ile kupiłem, i daje rabaty, jak chce=Bez zbędnych oczu: sprzedawca nie widzi kosztu zakupu|Część zniknęła i nikt nie wie, kto ją sprzedał=Widzisz, kto co zrobił — pełny dziennik działań',
    trialNote: '14 dni na planie Pro',

    howTitle: 'Od VIN po ostatnią śrubkę — wszystko w jednym profilu',
    howIntro: 'Zdjęcia, dokumenty, historia — bez teczek i Excela.',
    steps:
      'Partia=Kupiłeś i dodałeś=Kupiłeś partię — dodajesz jednym ruchem, bez przepisywania|Auto=Rozebrałeś=Rozbierasz auto — system liczy każdą część|Naklejka=Nakleiłeś QR=Drukujesz naklejkę na każdą część: QR + nazwa|Sprzedaż=Sprzedałeś=Składasz zamówienie w kilka kliknięć: klient, część, cena',

    carsEyebrow: 'Auta i partie',
    carsTitle: 'Przejrzysty zysk z każdego auta',
    carsPoints:
      'Dokładnie wiesz, ile włożyłeś i ile odzyskałeś|Widzisz, które auto zwróciło się najlepiej|Zysk z partii osobno — dokładnie, bez zgadywania|Wiesz, który dostawca przyniósł najwięcej',
    chartLabel: 'Zysk netto · 6 miesięcy',
    months: 'Maj|Cze|Lip|Sie|Wrz|Paź',
    carsList: 'Auta w demontażu',
    currencyLabel: 'Waluta rozliczeniowa · {code}',
    carInvested: 'Włożone {amount}',
    carEarned: 'Odzyskane {amount}',
    carParts: '{sold} z {total} części',

    stockEyebrow: 'Magazyn i naklejki',
    stockTitle: 'Każda część na swoim miejscu — znajdujesz w kilka sekund',
    stockPoints:
      'Drukujesz naklejkę na każdą część: QR + nazwa|Skan telefonem — od razu otwiera kartę|Widać, co wolne, co zarezerwowane, co w zamówieniu|Dokładnie widzisz, ile jest na magazynie i za jaką kwotę',
    stickerCar: 'BMW 320d E90 · Półka B3',
    statusTitle: 'Status',
    statuses: 'Wolna|Zarezerwowana|W zamówieniu',
    stockValue: 'Wartość magazynu',

    ordersEyebrow: 'Zamówienia i kasy',
    ordersTitle: 'Elastyczna płatność: kilka wpłat, różne waluty i konta',
    orderTitle: 'Zamówienie #1048',
    orderCustomer: 'Ołeh K.',
    orderReserved: '✓ Rezerwacja',
    orderPaid: 'Opłacone',
    orderShipping: 'Wysyłka',
    orderLines: 'Lewy reflektor BMW E90|Prawe lusterko|Moduł ABS',
    orderTotal: 'Razem',
    cashTitle: 'Kasy',
    cashRows: 'Gotówka|Konto firmowe|Gotówka',
    cashNote: 'Widzisz saldo każdej kasy na bieżąco',
    orderPoints:
      'Widzisz status od rezerwacji do wysyłki|Płatność automatycznie trafia do właściwej kasy|Przenosisz pieniądze między kasami jednym kliknięciem|Klient jest przypisany — cała historia zakupów pod ręką|Szybkie paragony i faktury — bez ręcznej rutyny',

    teamEyebrow: 'Zespół',
    teamTitle: 'Bez zbędnych oczu: sprzedawca nie widzi kosztu zakupu',
    teamPoints:
      'Dodajesz pracowników — każdy ma swoją rolę i dostęp|Widzisz, kto co zrobił — pełny dziennik działań|Wiesz, kto ile sprzedał i zarobił',
    permAccess: 'Dostęp',
    permRoles: 'Właściciel|Menedżer|Sprzedawca',
    permRows: 'Koszt zakupu|Ceny sprzedaży|Kasy|Raporty|Dziennik działań',
    permYes: '✓ Tak',
    permNo: '— Nie',

    midTitle: 'Sprawdź u siebie — 14 dni za darmo',
    midBody:
      'Dodaj pierwsze auto, naklej naklejki, zrealizuj pierwsze zamówienie.',
    startFree: 'Zacznij za darmo',
    orderDemo: 'Zamów demo',

    compareEyebrow: 'Porównanie',
    compareTitle:
      'Dlaczego nie Excel i nie uniwersalny program dla sklepu motoryzacyjnego',
    compareCols: 'Excel / zeszyt|Uniwersalny ERP',
    compare:
      'Zysk i ROI z każdego auta=Liczysz ręcznie=Brak=Automatycznie|Partie i koszt części=Formuły się psują=Częściowo=Od razu|Naklejka QR na każdą część=Brak=Kody kreskowe towarów=QR + półka + auto|Praca z telefonu=Niewygodnie=Aplikacja magazynowa=Cały biznes w telefonie|Ukrycie kosztu zakupu przed sprzedawcą=Niemożliwe=Zależy od planu=Role i uprawnienia|Stworzony dla demontażu aut=Nie=Jeden z segmentów=Tak',

    pricingEyebrow: 'Cennik',
    pricingNote: '14 dni za darmo na planie Pro',
    faqTitle: 'Najczęstsze pytania',

    startTitle: 'Nadal prowadzisz ewidencję ręcznie?',
    startBody:
      'Przejdź na rozbirka: 14 dni za darmo, bez karty. Auta, magazyn, zamówienia i kasy w jednym systemie. Jest wersja przeglądarkowa i aplikacja w App Store.',
    formTitle: 'Pomożemy zacząć',
    formIntro:
      'Zostaw kontakt — napiszemy z bota wsparcia na Telegramie i pomożemy skonfigurować Twój demontaż.',
    formName: 'Imię',
    formNamePlaceholder: 'Ołeh',
    formContact: 'Telefon lub Telegram',
    formContactPlaceholder: '+48 lub @nickname',
    formCars: 'Ile aut masz teraz w demontażu',
    formCarsOptions: 'Do 5|5–20|Ponad 20',
    formSubmit: 'Odbierz 14 dni za darmo',
    formTelegram: 'albo napisz od razu do bota na Telegramie →',
    formThanks: 'Dziękujemy!',
    formThanksBody:
      'Skontaktujemy się wkrótce. A tymczasem możesz się zarejestrować i dodać pierwsze auto.',
    formThanksCta: 'Przejdź do rejestracji',

    appStoreLine1: 'Pobierz z',
    footerTagline:
      'Program do ewidencji dla demontażu aut: auta, części, zamówienia, kasy i zespół.',
    footerProduct: 'Produkt',
    footerSupport: 'Wsparcie',
    footerSupportHint: 'Pytania, demo, pomoc w konfiguracji',
    footerPlatform: 'Platforma',
    footerWeb: 'Wersja przeglądarkowa',
  },
})

/** Splits a `|`-separated list message; `=` splits an item into fields. */
export function listOf(value: string): string[] {
  return value.split('|')
}

export function rowsOf(value: string): string[][] {
  return listOf(value).map((item) => item.split('='))
}
