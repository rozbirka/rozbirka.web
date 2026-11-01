import { defineMessages } from '@/i18n/messages'

/**
 * Hero of the landing: the two pills above the heading, the lead and the
 * app preview with its four tabs (cars, stock, orders, reports). The heading,
 * CTA and Telegram line stay in `site-messages.ts` / `landing-messages.ts`.
 * Lists use `|` between items and `=` between fields; list positions match
 * the figures in `hero.tsx`.
 */
export const heroMessages = defineMessages({
  uk: {
    pillProduct: 'Програма для авторозбірки',
    pillTrial: '14 днів безкоштовно',
    lead: "Застосунок, який об'єднує фінанси, функції та управління в одному інтерфейсі.",

    tabsLabel: 'Розділи застосунку',
    tabs: 'Авто|Склад|Замовлення|Звіти',
    side: 'Авто|Партії|Склад|Стікери|Замовлення|Клієнти|Каси|Звіти|Команда',
    caption: 'Інтерфейс rozbirka. Дані вигадані.',

    feedPool:
      'Блок ABS|Дзеркало праве|Стартер|Двері передні праві|Генератор|Радіатор|Бампер задній|Фара права|Кермова рейка',
    allCars: 'Усі авто',

    search: 'фара e90',
    scanQr: 'Сканувати QR',
    stockColumns: 'Деталь|Авто|Полиця|Статус|Ціна',
    stockParts:
      'Фара ліва|Фара права|Капот|Двигун N47D20|Дзеркало праве|Блок ABS',
    workshop: 'Цех',
    statusFree: 'Вільна',
    statusReserved: 'Резерв',
    statusInOrder: 'В замовленні',
    statusNew: 'Новий',
    statusPaid: 'Оплачено',
    statusSent: 'Відправлено',

    ordersToday: 'Замовлення · сьогодні',
    orders:
      'Андрій М.=Блок ABS · Camry 50|Олег К.=Фара ліва, дзеркало, ABS|Ігор Д.=Двигун N47D20|Сергій Л.=Капот · BMW E90',
    orderTitle: 'Замовлення #{number}',
    orderReserved: '✓ Резерв',
    orderShipping: 'Нова Пошта · ТТН',
    orderLines: 'Фара ліва BMW E90|Дзеркало праве|Блок ABS',
    orderTotal: 'Разом',

    kpiProfit: 'Чистий прибуток · 6 міс',
    kpiStock: 'На складі',
    kpiBest: 'Найкраще авто',
    salesByMonth: 'Продажі по місяцях',
    months: 'Тра|Чер|Лип|Сер|Вер|Жов',
  },
  'en-GB': {
    pillProduct: 'Software for car breakers',
    pillTrial: '14 days free',
    lead: 'One app that brings your finances, tools and management together in a single interface.',

    tabsLabel: 'App sections',
    tabs: 'Cars|Stock|Orders|Reports',
    side: 'Cars|Batches|Stock|Labels|Orders|Customers|Tills|Reports|Team',
    caption: 'The rozbirka interface. Sample data.',

    feedPool:
      'ABS unit|Right mirror|Starter motor|Front right door|Alternator|Radiator|Rear bumper|Right headlight|Steering rack',
    allCars: 'All cars',

    search: 'headlight e90',
    scanQr: 'Scan QR',
    stockColumns: 'Part|Car|Shelf|Status|Price',
    stockParts:
      'Left headlight|Right headlight|Bonnet|N47D20 engine|Right mirror|ABS unit',
    workshop: 'Workshop',
    statusFree: 'Available',
    statusReserved: 'Reserved',
    statusInOrder: 'In an order',
    statusNew: 'New',
    statusPaid: 'Paid',
    statusSent: 'Shipped',

    ordersToday: 'Orders · today',
    orders:
      'Andrii M.=ABS unit · Camry 50|Oleh K.=Left headlight, mirror, ABS|Ihor D.=N47D20 engine|Serhii L.=Bonnet · BMW E90',
    orderTitle: 'Order #{number}',
    orderReserved: '✓ Reserved',
    orderShipping: 'Nova Poshta · waybill',
    orderLines: 'Left headlight BMW E90|Right mirror|ABS unit',
    orderTotal: 'Total',

    kpiProfit: 'Net profit · 6 mo',
    kpiStock: 'In stock',
    kpiBest: 'Best car',
    salesByMonth: 'Sales by month',
    months: 'May|Jun|Jul|Aug|Sep|Oct',
  },
  pl: {
    pillProduct: 'Program do demontażu aut',
    pillTrial: '14 dni za darmo',
    lead: 'Aplikacja, która łączy finanse, narzędzia i zarządzanie w jednym interfejsie.',

    tabsLabel: 'Sekcje aplikacji',
    tabs: 'Auta|Magazyn|Zamówienia|Raporty',
    side: 'Auta|Partie|Magazyn|Naklejki|Zamówienia|Klienci|Kasy|Raporty|Zespół',
    caption: 'Interfejs rozbirka. Dane przykładowe.',

    feedPool:
      'Moduł ABS|Lusterko prawe|Rozrusznik|Drzwi przednie prawe|Alternator|Chłodnica|Zderzak tylny|Reflektor prawy|Przekładnia kierownicza',
    allCars: 'Wszystkie auta',

    search: 'reflektor e90',
    scanQr: 'Skanuj QR',
    stockColumns: 'Część|Auto|Półka|Status|Cena',
    stockParts:
      'Lewy reflektor|Prawy reflektor|Maska|Silnik N47D20|Lusterko prawe|Moduł ABS',
    workshop: 'Warsztat',
    statusFree: 'Dostępna',
    statusReserved: 'Rezerwacja',
    statusInOrder: 'W zamówieniu',
    statusNew: 'Nowe',
    statusPaid: 'Opłacone',
    statusSent: 'Wysłane',

    ordersToday: 'Zamówienia · dziś',
    orders:
      'Andrij M.=Moduł ABS · Camry 50|Ołeh K.=Lewy reflektor, lusterko, ABS|Ihor D.=Silnik N47D20|Serhij L.=Maska · BMW E90',
    orderTitle: 'Zamówienie #{number}',
    orderReserved: '✓ Rezerwacja',
    orderShipping: 'Nova Poshta · list przewozowy',
    orderLines: 'Lewy reflektor BMW E90|Lusterko prawe|Moduł ABS',
    orderTotal: 'Razem',

    kpiProfit: 'Zysk netto · 6 mies.',
    kpiStock: 'W magazynie',
    kpiBest: 'Najlepsze auto',
    salesByMonth: 'Sprzedaż według miesięcy',
    months: 'Maj|Cze|Lip|Sie|Wrz|Paź',
  },
})
