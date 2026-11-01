import { defineMessages } from '@/i18n/messages'

/**
 * «LIVE ДЕМО» players of the landing: the cars demo («Авто») and
 * the orders demo («Замовлення і каси»). Lists use `|` between items and `=`
 * between fields (see `listOf` / `rowsOf` in `landing-messages.ts`).
 * Captions list one text per moment of a chapter; the moments themselves
 * live next to the animation in `cars-demo.tsx` / `orders-demo.tsx`.
 */
export const demoMessages = defineMessages({
  uk: {
    live: 'LIVE ДЕМО',
    play: 'Відтворити',
    pause: 'Пауза',
    demoLabel: 'Демо: {title}',

    carsIntro: 'Подивись, як це працює: 4 кроки, пів хвилини.',
    carsChapters:
      'Додаєш авто за VIN|Вказуєш, скільки вклав|Продаєш деталі — прибуток росте|Порівнюєш авто між собою',
    carsCaptions0:
      'Створюєш нове авто|Вводиш VIN-код|Система розшифровує марку, модель і двигун',
    carsCaptions1:
      'Вказуєш, скільки віддав за авто|Зберіг — облік прибутку по авто почався',
    carsCaptions2:
      'Продаєш деталі — кожен продаж іде в профіль авто|Продажі перекрили закупівлю — авто окупилось',
    carsCaptions3:
      'Порівнюєш, яке авто заробило найбільше|І бачиш, які моделі варто брати ще',
    newCar: 'Нове авто',
    vinLabel: 'VIN-код',
    decodeVin: 'Розшифрувати VIN',
    vinSpecs:
      'Марка і модель=BMW 320d E90|Рік=2008|Двигун=N47D20 · 2.0 дизель|Кузов=Седан',
    purchasePrice: 'Ціна закупівлі',
    save: 'Зберегти',
    saved: '✓ Збережено. Тепер система рахує прибуток по цьому авто',
    invested: 'Вклав',
    earned: 'Забрав',
    payback: 'Окупність',
    paidOffRoi: 'Окупилось · ROI',
    soldParts:
      'Двигун N47D20|КПП|Турбіна|Блок ABS|Двері передні|Фара ліва|Капот|Дзеркало',
    allCars: 'Усі авто',

    ordersIntro:
      'Кілька платежів у різних валютах — і кожен видно в потрібній касі.',
    ordersChapters:
      'Збираєш замовлення скануванням QR|Платіж у гривнях|Доплата в доларах|Бачиш платіж у касі',
    ordersCaptions0:
      'Скануєш QR на деталі — вона одразу в замовленні|Деталі зарезервовані за клієнтом',
    ordersCaptions1:
      'Обираєш валюту платежу — гривня|Вводиш суму в гривнях|Платіж проведено в касу «Готівка · UAH»',
    ordersCaptions2:
      'Доплату приймаєш у доларах|Замовлення оплачене двома платежами в різних валютах',
    ordersCaptions3:
      'Відкриваєш каси|Обираєш «Готівка · USD»|Бачиш платіж саме з цього замовлення',
    orderHead: 'Замовлення #1050',
    tillsHead: 'Каси',
    customer: 'Клієнт',
    customerName: 'Олег Коваленко',
    scanQr: '⌗ Сканувати QR',
    orderItems: 'Фара ліва BMW E90|Дзеркало праве|Блок ABS',
    total: 'Разом',
    chipReserved: 'Резерв',
    chipPaid: 'Оплачено',
    orderSum: 'Сума замовлення',
    received: 'Отримано',
    receivedPaid: 'Отримано · оплачено',
    newPayment: 'Новий платіж',
    post: 'Провести',
    tillLabel: 'Каса:',
    cashTill: 'Готівка · {code}',
    businessTill: 'Рахунок ФОП · UAH',
    noteUah: 'платіж у гривнях',
    noteUsd: 'платіж у доларах',
    pickTill: 'Оберіть касу',
    tillMoves: 'Рухи · Готівка USD',
    tillTransactions:
      'Замовлення #1050=Олег К. · щойно|Замовлення #1044=Ігор Д. · вчора|Переміщення в ФОП=2 дні тому',
  },
  'en-GB': {
    live: 'LIVE DEMO',
    play: 'Play',
    pause: 'Pause',
    demoLabel: 'Demo: {title}',

    carsIntro: 'See how it works: 4 steps, half a minute.',
    carsChapters:
      'Add a car by VIN|Enter what you paid|Sell parts — profit grows|Compare cars side by side',
    carsCaptions0:
      'Create a new car|Type in the VIN|The system decodes the make, model and engine',
    carsCaptions1:
      'Enter what you paid for the car|Saved — profit tracking for this car has started',
    carsCaptions2:
      'Sell parts — every sale goes into the car’s profile|Sales have covered the purchase — the car has paid off',
    carsCaptions3:
      'Compare which car earned the most|And see which models are worth buying again',
    newCar: 'New car',
    vinLabel: 'VIN',
    decodeVin: 'Decode VIN',
    vinSpecs:
      'Make and model=BMW 320d E90|Year=2008|Engine=N47D20 · 2.0 diesel|Body=Saloon',
    purchasePrice: 'Purchase price',
    save: 'Save',
    saved: '✓ Saved. The system now tracks profit on this car',
    invested: 'In',
    earned: 'Out',
    payback: 'Payback',
    paidOffRoi: 'Paid off · ROI',
    soldParts:
      'N47D20 engine|Gearbox|Turbo|ABS unit|Front door|Left headlight|Bonnet|Mirror',
    allCars: 'All cars',

    ordersIntro:
      'Several payments in different currencies — each one shows up in the right till.',
    ordersChapters:
      'Build an order by scanning QR codes|A payment in hryvnias|The balance in dollars|See the payment in the till',
    ordersCaptions0:
      'Scan the QR on a part — it’s in the order straight away|The parts are reserved for the customer',
    ordersCaptions1:
      'Choose the payment currency — hryvnia|Enter the amount in hryvnias|Payment posted to the «Cash · UAH» till',
    ordersCaptions2:
      'Take the balance in dollars|The order is paid with two payments in different currencies',
    ordersCaptions3:
      'Open the tills|Choose «Cash · USD»|See the payment from this very order',
    orderHead: 'Order #1050',
    tillsHead: 'Tills',
    customer: 'Customer',
    customerName: 'Oleh Kovalenko',
    scanQr: '⌗ Scan QR',
    orderItems: 'Left headlight BMW E90|Right mirror|ABS unit',
    total: 'Total',
    chipReserved: 'Reserved',
    chipPaid: 'Paid',
    orderSum: 'Order total',
    received: 'Received',
    receivedPaid: 'Received · paid',
    newPayment: 'New payment',
    post: 'Post',
    tillLabel: 'Till:',
    cashTill: 'Cash · {code}',
    businessTill: 'Business account · UAH',
    noteUah: 'payment in hryvnias',
    noteUsd: 'payment in dollars',
    pickTill: 'Choose a till',
    tillMoves: 'Movements · Cash USD',
    tillTransactions:
      'Order #1050=Oleh K. · just now|Order #1044=Ihor D. · yesterday|Transfer to business account=2 days ago',
  },
  pl: {
    live: 'DEMO NA ŻYWO',
    play: 'Odtwórz',
    pause: 'Pauza',
    demoLabel: 'Demo: {title}',

    carsIntro: 'Zobacz, jak to działa: 4 kroki, pół minuty.',
    carsChapters:
      'Dodajesz auto po VIN|Wpisujesz, ile zapłaciłeś|Sprzedajesz części — zysk rośnie|Porównujesz auta między sobą',
    carsCaptions0:
      'Tworzysz nowe auto|Wpisujesz numer VIN|System odczytuje markę, model i silnik',
    carsCaptions1:
      'Wpisujesz, ile dałeś za auto|Zapisane — liczenie zysku z auta ruszyło',
    carsCaptions2:
      'Sprzedajesz części — każda sprzedaż trafia do profilu auta|Sprzedaż pokryła zakup — auto się zwróciło',
    carsCaptions3:
      'Porównujesz, które auto zarobiło najwięcej|I widzisz, które modele warto brać znowu',
    newCar: 'Nowe auto',
    vinLabel: 'Numer VIN',
    decodeVin: 'Odczytaj VIN',
    vinSpecs:
      'Marka i model=BMW 320d E90|Rok=2008|Silnik=N47D20 · 2.0 diesel|Nadwozie=Sedan',
    purchasePrice: 'Cena zakupu',
    save: 'Zapisz',
    saved: '✓ Zapisano. System liczy teraz zysk z tego auta',
    invested: 'Włożyłeś',
    earned: 'Odzyskałeś',
    payback: 'Zwrot',
    paidOffRoi: 'Zwróciło się · ROI',
    soldParts:
      'Silnik N47D20|Skrzynia biegów|Turbosprężarka|Moduł ABS|Drzwi przednie|Lewy reflektor|Maska|Lusterko',
    allCars: 'Wszystkie auta',

    ordersIntro:
      'Kilka wpłat w różnych walutach — każdą widać we właściwej kasie.',
    ordersChapters:
      'Kompletujesz zamówienie, skanując QR|Wpłata w hrywnach|Dopłata w dolarach|Widzisz wpłatę w kasie',
    ordersCaptions0:
      'Skanujesz QR na części — od razu jest w zamówieniu|Części są zarezerwowane dla klienta',
    ordersCaptions1:
      'Wybierasz walutę wpłaty — hrywna|Wpisujesz kwotę w hrywnach|Wpłata zaksięgowana w kasie «Gotówka · UAH»',
    ordersCaptions2:
      'Dopłatę przyjmujesz w dolarach|Zamówienie opłacone dwiema wpłatami w różnych walutach',
    ordersCaptions3:
      'Otwierasz kasy|Wybierasz «Gotówka · USD»|Widzisz wpłatę właśnie z tego zamówienia',
    orderHead: 'Zamówienie #1050',
    tillsHead: 'Kasy',
    customer: 'Klient',
    customerName: 'Ołeh Kowalenko',
    scanQr: '⌗ Skanuj QR',
    orderItems: 'Lewy reflektor BMW E90|Prawe lusterko|Moduł ABS',
    total: 'Razem',
    chipReserved: 'Rezerwacja',
    chipPaid: 'Opłacone',
    orderSum: 'Kwota zamówienia',
    received: 'Otrzymano',
    receivedPaid: 'Otrzymano · opłacone',
    newPayment: 'Nowa wpłata',
    post: 'Zaksięguj',
    tillLabel: 'Kasa:',
    cashTill: 'Gotówka · {code}',
    businessTill: 'Konto firmowe · UAH',
    noteUah: 'wpłata w hrywnach',
    noteUsd: 'wpłata w dolarach',
    pickTill: 'Wybierz kasę',
    tillMoves: 'Ruchy · Gotówka USD',
    tillTransactions:
      'Zamówienie #1050=Ołeh K. · przed chwilą|Zamówienie #1044=Ihor D. · wczoraj|Przeniesienie na konto firmowe=2 dni temu',
  },
})
