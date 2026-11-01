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

    heroBadge: 'Програма для авторозбірки — CRM і ERP',
    heroDemo: 'Не готовий реєструватись? Покажемо демо в Telegram за 10 хвилин',
    cardStatus: 'Профіль авто · онлайн',
    cardPaidOff: 'Окупилось',
    invested: 'Вклав',
    earned: 'Забрав',
    soldParts: 'Продано деталей',
    soldOf: '{sold} з {total}',
    heroSales: 'Двигун N47D20|Капот|Фара ліва',
    stickerPart: 'Фара ліва',

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
    pains:
      'Все записано в зошиті, а зошит лишився на складі=Фото, документи, історія — без папок і Excel|Розібрав Пассат, а чи він відбився — хто зна=Точно знаєш скільки вклав і скільки забрав|Клієнт на телефоні, а я пів години шукаю фару по полицях=Кожна деталь на своєму місці — знаходиш за секунди|Долари в шухляді, гривні на ФОП — в кінці місяця не сходиться=Кілька кас на різні валюти й рахунки — не плутаєш|Продавець знає, за скільки я купив, і дає знижки як хоче=Без зайвих очей: продавець не бачить собівартість|Деталь зникла, і ніхто не знає, хто її продав=Бачиш хто і що зробив — повний журнал дій',
    trialNote: '14 днів на тарифі Pro',

    howTitle: 'Шлях однієї деталі — від VIN до прибутку',
    howIntro: 'Один приклад: BMW 320d E90 і його ліва фара.',
    steps:
      'Авто=Привіз BMW E90=Додав авто за VIN і вказав, скільки за нього віддав|Стікер=Зняв ліву фару=Надрукував QR #A-0142 і поклав деталь на полицю B3|Продаж=Клієнт купив фару=Відсканував QR — фара вже в замовленні #1048|Прибуток=Авто окупилось=ROI по BMW оновився одразу після продажу',

    carsEyebrow: 'Авто',
    carsTitle: 'Прозорий прибуток по кожному кузову',

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

    teamEyebrow: 'Команда',
    teamTitle: 'Розбірка працює, навіть коли тебе немає на місці',
    teamLead: 'Кожен у команді бачить свою частину роботи. Ти бачиш усе.',
    teamPoints:
      'Додаєш співробітників і даєш кожному доступ лише до потрібного|Кожна дія в журналі: хто додав деталь, продав, змінив ціну чи зробив повернення|Видно, хто скільки продав за день і за місяць',
    teamLogTitle: 'Журнал дій · сьогодні',
    teamOnline: 'онлайн',
    teamLog:
      '09:12=Прийняв BMW 320d E90, наклеїв 46 стікерів=Олег · Майстер|10:40=Замовлення #1048 оплачено · {paid}=Ірина · Менеджер|11:05=Змінила ціну: Фара ліва {from} → {to}=Ірина · Менеджер|13:30=Двигун N47D20 → полиця C-04=Олег · Майстер|15:10=ТТН Нова Пошта для #1048=Ірина · Менеджер',
    teamSales: 'Продажі Ірини сьогодні',

    trialTitle: 'Перевір на своїй розбірці —',
    trialAccent: '14 днів безкоштовно',
    midBody: 'Додай перше авто, наклей стікери, проведи перше замовлення.',
    startFree: 'Почати безкоштовно',
    orderDemo: 'Замовити демо',

    pricingEyebrow: 'Тариф',
    pricingIncluded: 'Включено',
    pricingModules:
      'Авто|Партії|Запчастини|Стікери|Замовлення|Клієнти|Каси|Звіти|Команда|Інвентаризація|Склади|Нова Пошта|OLX',
    pricingAsk: 'Є питання — напиши в Telegram →',
    faqTitle: 'Поширені питання',

    startEyebrow: 'Старт за 1 день',
    startTitleStart: 'Ти все ще ведеш облік',
    startTitleAccent: 'вручну?',
    startBody:
      'Авто, склад, замовлення й каси в одній системі. Є веб-версія і застосунок в App Store.',
    startPoints:
      '14 днів безкоштовно|Без картки|Допоможемо налаштувати розбірку',
    formTitle: 'Допоможемо почати',
    formIntro:
      'Залиш контакт — менеджер напише в Telegram або зателефонує й допоможе налаштувати розбірку.',
    formName: "Ім'я",
    formNamePlaceholder: 'Олег',
    formContact: 'Телефон або Telegram',
    formContactPlaceholder: '+380 або @nickname',
    formSubmit: 'Отримати 14 днів безкоштовно',
    formSending: 'Надсилаємо…',
    formError:
      'Не вдалося надіслати заявку. Спробуй ще раз або напиши нам у Telegram.',
    formTelegram: 'або одразу напиши в Telegram-бот →',
    formThanks: 'Дякуємо!',
    formThanksBody:
      "Зв'яжемось найближчим часом. А поки можна зареєструватись і додати перше авто.",
    formThanksCta: 'Перейти до реєстрації',

    footerTagline:
      'CRM і ERP для авторозбірки: облік авто, деталей, замовлень, кас і команди.',
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

    heroBadge: 'Software for car breakers — CRM and ERP',
    heroDemo:
      'Not ready to sign up? We’ll show you a demo on Telegram in 10 minutes',
    cardStatus: 'Car profile · live',
    cardPaidOff: 'Paid off',
    invested: 'Invested',
    earned: 'Earned',
    soldParts: 'Parts sold',
    soldOf: '{sold} of {total}',
    heroSales: 'N47D20 engine|Bonnet|Left headlight',
    stickerPart: 'Left headlight',

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
    pains:
      'It’s all in the notebook, and the notebook is back at the yard=Photos, documents, history — no folders, no Excel|I stripped the Passat, but did it pay off? Who knows=You know exactly what you put in and what you got out|A customer is on the phone and I spend half an hour hunting for a headlight=Every part in its place — found in seconds|Dollars in the drawer, hryvnias in the bank — nothing adds up at month end=Several tills for different currencies and accounts — no mix-ups|The salesperson knows what I paid and hands out discounts at will=No prying eyes: salespeople don’t see the cost price|A part went missing and nobody knows who sold it=See who did what — a full activity log',
    trialNote: '14 days on the Pro plan',

    howTitle: 'The path of one part — from VIN to profit',
    howIntro: 'One example: a BMW 320d E90 and its left headlight.',
    steps:
      'Car=Brought in a BMW E90=Added the car by VIN and entered what you paid for it|Sticker=Took off the left headlight=Printed QR #A-0142 and put the part on shelf B3|Sale=A customer bought it=Scanned the QR — the headlight is already in order #1048|Profit=The car paid off=The BMW’s ROI updated right after the sale',

    carsEyebrow: 'Cars',
    carsTitle: 'Clear profit on every car',

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

    teamEyebrow: 'Team',
    teamTitle: 'Your yard keeps running even when you’re not there',
    teamLead:
      'Everyone on the team sees their part of the work. You see it all.',
    teamPoints:
      'Add staff and give each of them access only to what they need|Every action is logged: who added a part, sold it, changed a price or made a return|See who sold how much today and this month',
    teamLogTitle: 'Activity log · today',
    teamOnline: 'online',
    teamLog:
      '09:12=Took in a BMW 320d E90, put on 46 stickers=Oleh · Mechanic|10:40=Order #1048 paid · {paid}=Iryna · Manager|11:05=Changed a price: Left headlight {from} → {to}=Iryna · Manager|13:30=N47D20 engine → shelf C-04=Oleh · Mechanic|15:10=Nova Poshta waybill for #1048=Iryna · Manager',
    teamSales: 'Iryna’s sales today',

    trialTitle: 'Try it at your own yard —',
    trialAccent: '14 days free',
    midBody: 'Add your first car, stick on the stickers, run your first order.',
    startFree: 'Start for free',
    orderDemo: 'Book a demo',

    pricingEyebrow: 'Plan',
    pricingIncluded: 'Included',
    pricingModules:
      'Cars|Batches|Parts|Labels|Orders|Customers|Tills|Reports|Team|Stocktaking|Warehouses|Nova Poshta|OLX',
    pricingAsk: 'Questions? Message us on Telegram →',
    faqTitle: 'Frequently asked questions',

    startEyebrow: 'Up and running in a day',
    startTitleStart: 'Still keeping your books',
    startTitleAccent: 'by hand?',
    startBody:
      'Cars, stock, orders and tills in one system. There’s a web app and an iPhone app on the App Store.',
    startPoints: '14 days free|No card needed|We’ll help set up your yard',
    formTitle: 'We’ll help you get started',
    formIntro:
      'Leave your contact — a manager will message you on Telegram or call and help set up your yard.',
    formName: 'Name',
    formNamePlaceholder: 'Oleh',
    formContact: 'Phone or Telegram',
    formContactPlaceholder: '+44 or @nickname',
    formSubmit: 'Get 14 days free',
    formSending: 'Sending…',
    formError:
      'We couldn’t send your request. Try again or message us on Telegram.',
    formTelegram: 'or message the Telegram bot straight away →',
    formThanks: 'Thank you!',
    formThanksBody:
      'We’ll be in touch soon. Meanwhile you can sign up and add your first car.',
    formThanksCta: 'Go to sign-up',

    footerTagline:
      'CRM and ERP for car breakers: cars, parts, orders, tills and team.',
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

    heroBadge: 'Program do demontażu aut — CRM i ERP',
    heroDemo:
      'Nie chcesz się jeszcze rejestrować? Pokażemy demo na Telegramie w 10 minut',
    cardStatus: 'Profil auta · online',
    cardPaidOff: 'Zwróciło się',
    invested: 'Włożone',
    earned: 'Odzyskane',
    soldParts: 'Sprzedane części',
    soldOf: '{sold} z {total}',
    heroSales: 'Silnik N47D20|Maska|Lewy reflektor',
    stickerPart: 'Lewy reflektor',

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
    pains:
      'Wszystko jest w zeszycie, a zeszyt został w magazynie=Zdjęcia, dokumenty, historia — bez teczek i Excela|Rozebrałem Passata, ale czy się zwrócił — kto wie=Dokładnie wiesz, ile włożyłeś i ile odzyskałeś|Klient czeka na telefonie, a ja pół godziny szukam reflektora po półkach=Każda część na swoim miejscu — znajdujesz w kilka sekund|Dolary w szufladzie, hrywny na koncie — pod koniec miesiąca nic się nie zgadza=Kilka kas na różne waluty i konta — nic się nie myli|Sprzedawca wie, za ile kupiłem, i daje rabaty, jak chce=Bez zbędnych oczu: sprzedawca nie widzi kosztu zakupu|Część zniknęła i nikt nie wie, kto ją sprzedał=Widzisz, kto co zrobił — pełny dziennik działań',
    trialNote: '14 dni na planie Pro',

    howTitle: 'Droga jednej części — od VIN do zysku',
    howIntro: 'Jeden przykład: BMW 320d E90 i jego lewy reflektor.',
    steps:
      'Auto=Przywiozłeś BMW E90=Dodałeś auto po VIN i wpisałeś, ile za nie zapłaciłeś|Naklejka=Zdjąłeś lewy reflektor=Wydrukowałeś QR #A-0142 i odłożyłeś część na półkę B3|Sprzedaż=Klient kupił reflektor=Zeskanowałeś QR — reflektor jest już w zamówieniu #1048|Zysk=Auto się zwróciło=ROI dla BMW zaktualizował się zaraz po sprzedaży',

    carsEyebrow: 'Auta',
    carsTitle: 'Przejrzysty zysk z każdego auta',

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

    teamEyebrow: 'Zespół',
    teamTitle: 'Twój demontaż działa, nawet gdy cię nie ma na miejscu',
    teamLead: 'Każdy w zespole widzi swoją część pracy. Ty widzisz wszystko.',
    teamPoints:
      'Dodajesz pracowników i dajesz każdemu dostęp tylko do tego, czego potrzebuje|Każde działanie w dzienniku: kto dodał część, sprzedał, zmienił cenę albo przyjął zwrot|Widać, kto ile sprzedał w ciągu dnia i miesiąca',
    teamLogTitle: 'Dziennik działań · dziś',
    teamOnline: 'online',
    teamLog:
      '09:12=Przyjął BMW 320d E90, nakleił 46 naklejek=Ołeh · Mechanik|10:40=Zamówienie #1048 opłacone · {paid}=Iryna · Menedżerka|11:05=Zmieniła cenę: Lewy reflektor {from} → {to}=Iryna · Menedżerka|13:30=Silnik N47D20 → półka C-04=Ołeh · Mechanik|15:10=List przewozowy Nova Poshta do #1048=Iryna · Menedżerka',
    teamSales: 'Sprzedaż Iryny dziś',

    trialTitle: 'Sprawdź u siebie —',
    trialAccent: '14 dni za darmo',
    midBody:
      'Dodaj pierwsze auto, naklej naklejki, zrealizuj pierwsze zamówienie.',
    startFree: 'Zacznij za darmo',
    orderDemo: 'Zamów demo',

    pricingEyebrow: 'Plan',
    pricingIncluded: 'W cenie',
    pricingModules:
      'Auta|Partie|Części|Naklejki|Zamówienia|Klienci|Kasy|Raporty|Zespół|Inwentaryzacja|Magazyny|Nova Poshta|OLX',
    pricingAsk: 'Masz pytania? Napisz na Telegramie →',
    faqTitle: 'Najczęstsze pytania',

    startEyebrow: 'Start w 1 dzień',
    startTitleStart: 'Nadal prowadzisz ewidencję',
    startTitleAccent: 'ręcznie?',
    startBody:
      'Auta, magazyn, zamówienia i kasy w jednym systemie. Jest wersja przeglądarkowa i aplikacja w App Store.',
    startPoints:
      '14 dni za darmo|Bez karty|Pomożemy skonfigurować Twój demontaż',
    formTitle: 'Pomożemy zacząć',
    formIntro:
      'Zostaw kontakt — menedżer napisze na Telegramie lub zadzwoni i pomoże skonfigurować Twój demontaż.',
    formName: 'Imię',
    formNamePlaceholder: 'Ołeh',
    formContact: 'Telefon lub Telegram',
    formContactPlaceholder: '+48 lub @nickname',
    formSubmit: 'Odbierz 14 dni za darmo',
    formSending: 'Wysyłamy…',
    formError:
      'Nie udało się wysłać zgłoszenia. Spróbuj ponownie albo napisz do nas na Telegramie.',
    formTelegram: 'albo napisz od razu do bota na Telegramie →',
    formThanks: 'Dziękujemy!',
    formThanksBody:
      'Skontaktujemy się wkrótce. A tymczasem możesz się zarejestrować i dodać pierwsze auto.',
    formThanksCta: 'Przejdź do rejestracji',

    footerTagline:
      'CRM i ERP dla demontażu aut: auta, części, zamówienia, kasy i zespół.',
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
