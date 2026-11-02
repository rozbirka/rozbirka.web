import { defineMessages } from '@/i18n/messages'

/**
 * Decorative CRM window of «Можливості»: per module a KPI (`label=value`) and
 * four live events (`title=meta=status`, separated by `|`). Demo figures stay
 * in the currencies of the mock-up (a sale in USD, a transfer in UAH).
 */
export const featuresStoryMessages = defineMessages({
  uk: {
    events: 'Події',
    live: 'оновлюється наживо',
    times: 'щойно|2 хв|6 хв|11 хв',
    whereWeb: 'Веб',
    whereWebPhone: 'Веб + iPhone',

    carsKpi: 'Окупність · Tesla Model Y 2021=102 %',
    carsEvents:
      'Продано: Фара ліва=+180 USD=Продано|Продано: Дзеркало праве=+95 USD=Продано|Витрата: Доставка=2 000 USD=Витрата|Запчастин з авто=76 продано · 139 на складі=Запчастини',
    intakesKpi: 'Партія #14 · Литва · 120 запчастин=64 % продано',
    intakesEvents:
      'Прийнято: Фара LED ліва × 6=партія #14=Прийнято|Прийнято: Блок ABS × 4=партія #14=Прийнято|Продано: Блок ABS=з партії #14 · 240 USD=Продано|Прибуток партії=+1 830 USD=Прибуток',
    partsKpi: 'Доступно на складі=942 поз.',
    partsEvents:
      'Цапфа RL Rivian=Полиця B-12=Доступно|Цапфа RR MY=Полиця A-04=У резерві|Обшивка багажника RL=Полиця C-02=У резерві|Карта дверей FR=Полиця A-01=Продано',
    warehousesKpi: 'Складів у системі=3',
    warehousesEvents:
      'Основний склад=612 поз.=Активний|Склад Львів=287 поз.=Активний|Двигун N47D20=Основний → Львів=Переміщення|Точка видачі=43 поз.=Активний',
    stocktakingKpi: 'Перевірено скануванням=184 / 210',
    stocktakingEvents:
      'Скан QR: Стартер=Полиця B-03=Знайдено|Скан QR: Генератор=Полиця B-03=Знайдено|Радіатор=немає на C-01=Нестача|Фара права=зайва на A-02=Зайве',
    stickersKpi: 'Черга друку=6 з 6',
    stickersEvents:
      'Цапфа FL Rivian gen1=QR · 40×58 мм=Надруковано|Цапфа FR Rivian gen1=QR · 40×58 мм=Надруковано|Цапфа FL M3=QR · 40×58 мм=Надруковано|Цапфа FR M3=QR · 40×58 мм=Друкується',
    ordersKpi: 'Замовлення #285=2 500 USD',
    ordersEvents:
      'Стійка R MY M3 × 1=2 500 USD=Резерв|Платіж · Готівка=1 000 USD=Оплачено|Платіж · ФОП Privat 24=46 500 UAH=Оплачено|Створено → Підтверджено=10.10.2026=Підтверджено',
    customersKpi: 'Клієнтів у базі=94',
    customersEvents:
      'Діма=85 замовлень=Постійний|Ігор=7 замовлень=Постійний|Стас=2 замовлення=Разовий|Нове замовлення з картки=#286=Створено',
    cashKpi: 'Надходження за місяць=46 500 UAH · 1 000 USD',
    cashEvents:
      'Каса Готівка=+1 000 USD=Надходження|ФОП Privat 24=+46 500 UAH=Надходження|Готівка → Сейф=500 USD=Переміщення|Доставка авто=2 000 USD=Витрата',
    reportsKpi: 'Звіт 26.10 – 01.11=PDF',
    reportsEvents:
      'Продажі за період=31 замовлення=Готово|Залишки складу=979 поз.=Готово|Рухи по касах=за тиждень=Формується|Звіт 23.07 – 30.09=строк зберігання минув=Прострочений',
    teamKpi: 'Співробітників=4',
    teamEvents:
      'Дмитро=власник=Повний доступ|Любомир=комірник=Запчастини|Олег=продавець=Без собівартості|Любомир додав деталь=Цапфа FL M3 · 14:07=Журнал',
    novaPoshtaKpi: 'ТТН із замовлення #285=Створено',
    novaPoshtaEvents:
      'Отримувач=з картки клієнта=Заповнено|Відділення №12, Львів=доставка до відділення=Заповнено|ТТН 20450 1234 5678=привʼязано до #285=Створено|Статус посилки=прямує до відділення=В дорозі',
    olxKpi: 'Активних оголошень=128',
    olxEvents:
      'Фара ліва BMW E90=180 USD=Опубліковано|Блок ABS Audi A6=240 USD=Опубліковано|Дзеркало праве=продано в Rozbirka=Знято|Фото, ціна й опис=з картки деталі=Авто',
  },
  'en-GB': {
    events: 'Events',
    live: 'updating live',
    times: 'just now|2 min|6 min|11 min',
    whereWeb: 'Web',
    whereWebPhone: 'Web + iPhone',

    carsKpi: 'Payback · Tesla Model Y 2021=102%',
    carsEvents:
      'Sold: Left headlight=+180 USD=Sold|Sold: Right mirror=+95 USD=Sold|Expense: Delivery=2,000 USD=Expense|Parts from this car=76 sold · 139 in stock=Parts',
    intakesKpi: 'Batch #14 · Lithuania · 120 parts=64% sold',
    intakesEvents:
      'Received: Left LED headlight × 6=batch #14=Received|Received: ABS unit × 4=batch #14=Received|Sold: ABS unit=from batch #14 · 240 USD=Sold|Batch profit=+1,830 USD=Profit',
    partsKpi: 'Available in stock=942 items',
    partsEvents:
      'Rivian RL knuckle=Shelf B-12=Available|MY RR knuckle=Shelf A-04=Reserved|Boot trim RL=Shelf C-02=Reserved|Door card FR=Shelf A-01=Sold',
    warehousesKpi: 'Warehouses in the system=3',
    warehousesEvents:
      'Main warehouse=612 items=Active|Lviv warehouse=287 items=Active|N47D20 engine=Main → Lviv=Transfer|Collection point=43 items=Active',
    stocktakingKpi: 'Checked by scanning=184 / 210',
    stocktakingEvents:
      'QR scan: Starter motor=Shelf B-03=Found|QR scan: Alternator=Shelf B-03=Found|Radiator=missing from C-01=Missing|Right headlight=extra on A-02=Extra',
    stickersKpi: 'Print queue=6 of 6',
    stickersEvents:
      'Rivian gen1 FL knuckle=QR · 40×58 mm=Printed|Rivian gen1 FR knuckle=QR · 40×58 mm=Printed|M3 FL knuckle=QR · 40×58 mm=Printed|M3 FR knuckle=QR · 40×58 mm=Printing',
    ordersKpi: 'Order #285=2,500 USD',
    ordersEvents:
      'Strut R MY M3 × 1=2,500 USD=Reserved|Payment · Cash=1,000 USD=Paid|Payment · Privat 24 business=46,500 UAH=Paid|Created → Confirmed=10/10/2026=Confirmed',
    customersKpi: 'Customers on file=94',
    customersEvents:
      'Dima=85 orders=Regular|Ihor=7 orders=Regular|Stas=2 orders=One-off|New order from the card=#286=Created',
    cashKpi: 'Income this month=46,500 UAH · 1,000 USD',
    cashEvents:
      'Cash till=+1,000 USD=Income|Privat 24 business=+46,500 UAH=Income|Cash → Safe=500 USD=Transfer|Car delivery=2,000 USD=Expense',
    reportsKpi: 'Report 26/10 – 01/11=PDF',
    reportsEvents:
      'Sales for the period=31 orders=Ready|Stock levels=979 items=Ready|Till movements=for the week=Generating|Report 23/07 – 30/09=retention period over=Expired',
    teamKpi: 'Staff=4',
    teamEvents:
      'Dmytro=owner=Full access|Liubomyr=storekeeper=Parts|Oleh=seller=No cost prices|Liubomyr added a part=M3 FL knuckle · 14:07=Log',
    novaPoshtaKpi: 'Waybill from order #285=Created',
    novaPoshtaEvents:
      'Recipient=from the customer card=Filled in|Branch No. 12, Lviv=delivery to the branch=Filled in|Waybill 20450 1234 5678=linked to #285=Created|Parcel status=on its way to the branch=In transit',
    olxKpi: 'Active listings=128',
    olxEvents:
      'BMW E90 left headlight=180 USD=Published|Audi A6 ABS unit=240 USD=Published|Right mirror=sold in Rozbirka=Removed|Photos, price and description=from the part card=Auto',
  },
  pl: {
    events: 'Zdarzenia',
    live: 'aktualizuje się na żywo',
    times: 'przed chwilą|2 min|6 min|11 min',
    whereWeb: 'Web',
    whereWebPhone: 'Web + iPhone',

    carsKpi: 'Zwrot · Tesla Model Y 2021=102 %',
    carsEvents:
      'Sprzedano: Lampa lewa=+180 USD=Sprzedano|Sprzedano: Lusterko prawe=+95 USD=Sprzedano|Wydatek: Transport=2 000 USD=Wydatek|Części z auta=76 sprzedanych · 139 w magazynie=Części',
    intakesKpi: 'Partia #14 · Litwa · 120 części=64 % sprzedane',
    intakesEvents:
      'Przyjęto: Lampa LED lewa × 6=partia #14=Przyjęto|Przyjęto: Moduł ABS × 4=partia #14=Przyjęto|Sprzedano: Moduł ABS=z partii #14 · 240 USD=Sprzedano|Zysk z partii=+1 830 USD=Zysk',
    partsKpi: 'Dostępne w magazynie=942 poz.',
    partsEvents:
      'Zwrotnica RL Rivian=Półka B-12=Dostępna|Zwrotnica RR MY=Półka A-04=Zarezerwowana|Boczek bagażnika RL=Półka C-02=Zarezerwowana|Boczek drzwi FR=Półka A-01=Sprzedana',
    warehousesKpi: 'Magazyny w systemie=3',
    warehousesEvents:
      'Magazyn główny=612 poz.=Aktywny|Magazyn Lwów=287 poz.=Aktywny|Silnik N47D20=Główny → Lwów=Przeniesienie|Punkt odbioru=43 poz.=Aktywny',
    stocktakingKpi: 'Sprawdzono skanem=184 / 210',
    stocktakingEvents:
      'Skan QR: Rozrusznik=Półka B-03=Znaleziono|Skan QR: Alternator=Półka B-03=Znaleziono|Chłodnica=brak na C-01=Brak|Lampa prawa=nadmiar na A-02=Nadmiar',
    stickersKpi: 'Kolejka druku=6 z 6',
    stickersEvents:
      'Zwrotnica FL Rivian gen1=QR · 40×58 mm=Wydrukowano|Zwrotnica FR Rivian gen1=QR · 40×58 mm=Wydrukowano|Zwrotnica FL M3=QR · 40×58 mm=Wydrukowano|Zwrotnica FR M3=QR · 40×58 mm=Drukuje się',
    ordersKpi: 'Zamówienie #285=2 500 USD',
    ordersEvents:
      'Kolumna R MY M3 × 1=2 500 USD=Rezerwacja|Płatność · Gotówka=1 000 USD=Opłacono|Płatność · FOP Privat 24=46 500 UAH=Opłacono|Utworzone → Potwierdzone=10.10.2026=Potwierdzone',
    customersKpi: 'Klientów w bazie=94',
    customersEvents:
      'Dima=85 zamówień=Stały|Ihor=7 zamówień=Stały|Stas=2 zamówienia=Jednorazowy|Nowe zamówienie z karty=#286=Utworzone',
    cashKpi: 'Wpływy w tym miesiącu=46 500 UAH · 1 000 USD',
    cashEvents:
      'Kasa Gotówka=+1 000 USD=Wpływ|FOP Privat 24=+46 500 UAH=Wpływ|Gotówka → Sejf=500 USD=Przeniesienie|Transport auta=2 000 USD=Wydatek',
    reportsKpi: 'Raport 26.10 – 01.11=PDF',
    reportsEvents:
      'Sprzedaż za okres=31 zamówień=Gotowy|Stany magazynowe=979 poz.=Gotowy|Ruchy w kasach=za tydzień=W przygotowaniu|Raport 23.07 – 30.09=okres przechowywania minął=Wygasł',
    teamKpi: 'Pracowników=4',
    teamEvents:
      'Dmytro=właściciel=Pełny dostęp|Lubomyr=magazynier=Części|Oleh=sprzedawca=Bez kosztu zakupu|Lubomyr dodał część=Zwrotnica FL M3 · 14:07=Dziennik',
    novaPoshtaKpi: 'List przewozowy z zamówienia #285=Utworzony',
    novaPoshtaEvents:
      'Odbiorca=z karty klienta=Uzupełniono|Oddział nr 12, Lwów=dostawa do oddziału=Uzupełniono|List 20450 1234 5678=przypisany do #285=Utworzony|Status przesyłki=w drodze do oddziału=W drodze',
    olxKpi: 'Aktywne ogłoszenia=128',
    olxEvents:
      'Lampa lewa BMW E90=180 USD=Opublikowano|Moduł ABS Audi A6=240 USD=Opublikowano|Lusterko prawe=sprzedane w Rozbirka=Zdjęto|Zdjęcia, cena i opis=z karty części=Auto',
  },
})
