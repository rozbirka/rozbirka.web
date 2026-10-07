import { defineMessages } from '@/i18n'

export const paymentsMessages = defineMessages({
  uk: {
    crumb: 'Налаштування · Підписка · Платежі',
    title: 'Платежі',
    lead: 'Оплати за підписку, їх стан і спосіб оплати.',
    segmentAll: 'Усі',
    segmentSuccess: 'Оплачені',
    segmentPending: 'Очікують',
    segmentFailed: 'Невдалі',
    noReceiptFile:
      'Чек як файл кабінет не видає — у платежі є лише номер рахунку провайдера.',
    noStatusFilter:
      'Платежі не фільтруються за статусом: сегменти впорядковують завантажену сторінку, і лічильники рахують її ж.',
    noCardList:
      'Підписка тримає одну картку — бренд і чотири цифри. Ні додати другу, ні зробити основною, ні видалити тут не можна.',
    noPaymentsExport:
      'Вивантаження платежів у файл поки немає — є тільки перелік по сторінках.',
    noInvoiceDetails:
      'Реквізитів для чеків — назви платника, коду й адреси — у білінгу немає, і змінювати їх нема де. Чеки формує Mono за даними картки.',
    cancelledButReloadFailed:
      'Платіж скасовано, але не вдалося оновити список. Оновіть сторінку, щоб побачити актуальні платежі.',
    cancelled: 'Платіж скасовано.',
    loadFailedTitle: 'Платежі не завантажилися',
    checkoutExpired:
      'Строк оплати рахунку минув. Оберіть тариф, щоб створити новий рахунок.',
    kpiTotal: 'Платежів усього',
    kpiTotalAll: 'усі, що є в кабінеті',
    kpiTotalNewest: 'показано {count} найновіших',
    kpiPaid: 'Сплачено на сторінці',
    kpiPaidMixed: 'на сторінці кілька валют — сума не складається',
    kpiPaidMeta: 'сума успішних платежів цієї сторінки',
    kpiPending: 'Очікують оплати',
    kpiPendingNone: 'незавершених рахунків немає',
    kpiPendingSome: 'рахунок можна доплатити або скасувати',
    invoiceDetails: 'Реквізити для чеків',
    changeInvoiceDetails: 'Змінити реквізити',
    paymentStatus: 'Статус платежу',
    shownOnPage: 'Показано {shown} з {total} на цій сторінці',
    history: 'Історія платежів',
    noneForFilter: 'Платежів за цим фільтром на цій сторінці немає.',
    columnDate: 'Дата',
    columnDescription: 'Опис',
    columnAmount: 'Сума',
    columnStatus: 'Статус',
    columnReceipt: 'Чек',
    continuePayment: 'Продовжити оплату',
    loadNetwork:
      'Не вдалося завантажити платежі: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.',
    loadForbidden:
      'У вас немає доступу до платежів цієї розбірки. Попросіть власника надати доступ до білінгу.',
    loadFailed: 'Не вдалося завантажити платежі. Спробуйте ще раз.',
    cancelForbidden:
      'У вас більше немає права скасувати цей платіж. Попросіть власника розбірки надати доступ до білінгу.',
    cancelConflict: 'Статус платежу вже змінився. Оновіть список платежів.',
    cancelNetwork:
      'Не вдалося скасувати платіж: немає з’єднання з мережею. Перевірте інтернет і спробуйте ще раз.',
    cancelFailed: 'Не вдалося скасувати платіж. Спробуйте ще раз.',
    paymentMethod: 'Спосіб оплати',
    methodByProvider:
      'Спосіб оплати керується {provider}. Змініть картку в налаштуваннях магазину.',
    methodUnavailable:
      'Інформація про спосіб оплати наразі недоступна. Оновіть сторінку.',
    cardAuthorised: 'Авторизована для регулярних списань',
    noCard:
      'Картка ще не привʼязана. Активуйте підписку — і карту запитає Monobank під час оплати.',
    addPaymentMethod: 'Додати спосіб оплати',
    exportCsv: 'Експорт CSV',
  },
  'en-GB': {
    crumb: 'Settings · Subscription · Payments',
    title: 'Payments',
    lead: 'Subscription payments, their status and the payment method.',
    segmentAll: 'All',
    segmentSuccess: 'Paid',
    segmentPending: 'Pending',
    segmentFailed: 'Failed',
    noReceiptFile:
      'Receipts aren’t available as files — a payment only has the provider’s invoice number.',
    noStatusFilter:
      'Payments aren’t filtered by status on the server: the segments sort the loaded page, and the counters count that page.',
    noCardList:
      'A subscription holds one card — its brand and last four digits. You can’t add a second one, make one primary or remove it here.',
    noPaymentsExport:
      'Payments can’t be exported to a file yet — there’s only the paged list.',
    noInvoiceDetails:
      'Billing has no receipt details — payer name, tax code or address — and nowhere to change them. Mono issues receipts from the card details.',
    cancelledButReloadFailed:
      'The payment was cancelled, but the list couldn’t be refreshed. Refresh the page to see the latest payments.',
    cancelled: 'Payment cancelled.',
    loadFailedTitle: 'Payments didn’t load',
    checkoutExpired:
      'The invoice has expired. Choose a plan to create a new invoice.',
    kpiTotal: 'Total payments',
    kpiTotalAll: 'everything in the account',
    kpiTotalNewest: 'showing the {count} most recent',
    kpiPaid: 'Paid on this page',
    kpiPaidMixed: 'several currencies on this page — no total',
    kpiPaidMeta: 'total of successful payments on this page',
    kpiPending: 'Awaiting payment',
    kpiPendingNone: 'no unfinished invoices',
    kpiPendingSome: 'an invoice can be paid or cancelled',
    invoiceDetails: 'Receipt details',
    changeInvoiceDetails: 'Change details',
    paymentStatus: 'Payment status',
    shownOnPage: 'Showing {shown} of {total} on this page',
    history: 'Payment history',
    noneForFilter: 'No payments match this filter on this page.',
    columnDate: 'Date',
    columnDescription: 'Description',
    columnAmount: 'Amount',
    columnStatus: 'Status',
    columnReceipt: 'Receipt',
    continuePayment: 'Continue payment',
    loadNetwork:
      'Couldn’t load payments: no network connection. Check your internet and try again.',
    loadForbidden:
      'You don’t have access to this business’s payments. Ask the owner for billing access.',
    loadFailed: 'Couldn’t load payments. Please try again.',
    cancelForbidden:
      'You can no longer cancel this payment. Ask the business owner for billing access.',
    cancelConflict:
      'The payment status has already changed. Refresh the payment list.',
    cancelNetwork:
      'Couldn’t cancel the payment: no network connection. Check your internet and try again.',
    cancelFailed: 'Couldn’t cancel the payment. Please try again.',
    paymentMethod: 'Payment method',
    methodByProvider:
      'The payment method is managed by {provider}. Change the card in the store settings.',
    methodUnavailable:
      'Payment method details are unavailable right now. Refresh the page.',
    cardAuthorised: 'Authorised for recurring charges',
    noCard:
      'No card linked yet. Activate the subscription and Monobank will ask for a card at checkout.',
    addPaymentMethod: 'Add payment method',
    exportCsv: 'Export CSV',
  },
  pl: {
    crumb: 'Ustawienia · Subskrypcja · Płatności',
    title: 'Płatności',
    lead: 'Płatności za subskrypcję, ich stan i metoda płatności.',
    segmentAll: 'Wszystkie',
    segmentSuccess: 'Opłacone',
    segmentPending: 'Oczekujące',
    segmentFailed: 'Nieudane',
    noReceiptFile:
      'Paragonu jako pliku nie ma — płatność ma tylko numer rachunku dostawcy.',
    noStatusFilter:
      'Płatności nie są filtrowane po statusie na serwerze: segmenty porządkują wczytaną stronę, a liczniki liczą tę samą stronę.',
    noCardList:
      'Subskrypcja ma jedną kartę — markę i cztery ostatnie cyfry. Nie można tu dodać drugiej, ustawić jej jako główną ani jej usunąć.',
    noPaymentsExport:
      'Eksportu płatności do pliku jeszcze nie ma — jest tylko lista stronicowana.',
    noInvoiceDetails:
      'Rozliczenia nie mają danych do paragonów — nazwy płatnika, NIP-u ani adresu — i nie ma gdzie ich zmienić. Paragony wystawia Mono na podstawie danych karty.',
    cancelledButReloadFailed:
      'Płatność anulowano, ale nie udało się odświeżyć listy. Odśwież stronę, aby zobaczyć aktualne płatności.',
    cancelled: 'Płatność anulowana.',
    loadFailedTitle: 'Nie udało się wczytać płatności',
    checkoutExpired:
      'Termin opłacenia rachunku minął. Wybierz plan, aby utworzyć nowy rachunek.',
    kpiTotal: 'Płatności łącznie',
    kpiTotalAll: 'wszystkie na koncie',
    kpiTotalNewest: 'pokazano {count} najnowszych',
    kpiPaid: 'Zapłacono na stronie',
    kpiPaidMixed: 'na stronie jest kilka walut — brak sumy',
    kpiPaidMeta: 'suma udanych płatności z tej strony',
    kpiPending: 'Czekają na opłatę',
    kpiPendingNone: 'brak niedokończonych rachunków',
    kpiPendingSome: 'rachunek można opłacić lub anulować',
    invoiceDetails: 'Dane do paragonów',
    changeInvoiceDetails: 'Zmień dane',
    paymentStatus: 'Status płatności',
    shownOnPage: 'Pokazano {shown} z {total} na tej stronie',
    history: 'Historia płatności',
    noneForFilter: 'Brak płatności dla tego filtra na tej stronie.',
    columnDate: 'Data',
    columnDescription: 'Opis',
    columnAmount: 'Kwota',
    columnStatus: 'Status',
    columnReceipt: 'Paragon',
    continuePayment: 'Kontynuuj płatność',
    loadNetwork:
      'Nie udało się wczytać płatności: brak połączenia z siecią. Sprawdź internet i spróbuj ponownie.',
    loadForbidden:
      'Nie masz dostępu do płatności tej firmy. Poproś właściciela o dostęp do rozliczeń.',
    loadFailed: 'Nie udało się wczytać płatności. Spróbuj ponownie.',
    cancelForbidden:
      'Nie masz już uprawnień do anulowania tej płatności. Poproś właściciela firmy o dostęp do rozliczeń.',
    cancelConflict:
      'Status płatności już się zmienił. Odśwież listę płatności.',
    cancelNetwork:
      'Nie udało się anulować płatności: brak połączenia z siecią. Sprawdź internet i spróbuj ponownie.',
    cancelFailed: 'Nie udało się anulować płatności. Spróbuj ponownie.',
    paymentMethod: 'Metoda płatności',
    methodByProvider:
      'Metodą płatności zarządza {provider}. Zmień kartę w ustawieniach sklepu.',
    methodUnavailable:
      'Informacje o metodzie płatności są teraz niedostępne. Odśwież stronę.',
    cardAuthorised: 'Autoryzowana do płatności cyklicznych',
    noCard:
      'Karta nie jest jeszcze powiązana. Aktywuj subskrypcję, a Monobank poprosi o kartę podczas płatności.',
    addPaymentMethod: 'Dodaj metodę płatności',
    exportCsv: 'Eksport CSV',
  },
})
