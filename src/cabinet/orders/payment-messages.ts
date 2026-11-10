import { defineMessages } from '@/i18n'

/**
 * Order value, actual payments and confirmation (ROZ-162 board 3a–3c). Copy
 * from the board table where it has the key; the rest follows its wording.
 */
export const paymentMessages = defineMessages({
  uk: {
    carrierFee: 'Перевізник утримав комісію',
    feeAmount: 'Утримана комісія, грн',
    feeHint:
      'Вкажіть підтверджену комісію з виписки. Це витрата розбірки, а не борг клієнта.',
    feeInvalid:
      'Вкажіть невід’ємну комісію, меншу за суму оплати, до двох знаків після коми.',
    customerGrossHint:
      'Сума, яку клієнт сплатив за замовлення, до утримання комісії.',
    netReceipt: 'У касу надійшло: {amount}',

    eyebrow: 'Замовлення #{number} · оплата',
    title: 'Додати платіж',
    orderValue: 'Вартість замовлення',
    inAccounting: 'У валюті обліку',
    valueUnknown: 'Валюту обліку ще не обрано',
    actualPayment: 'Фактична оплата',
    actualPayments: 'Фактичні оплати',
    noPayments: 'Оплат ще немає',
    till: 'Каса',
    currency: 'Валюта',
    amount: 'Сума',
    reselect: 'Каса «{till}» не приймає {code}. Оберіть валюту оплати ще раз.',
    amountKept: 'Суму {amount} не змінено й не перераховано.',
    summary: 'Каса {till} · {amount}',
    summaryNoCurrency: 'Каса {till} · оберіть валюту',
    enterAmount: 'Вкажіть суму',
    noTills:
      'Активних кас немає. Створіть касу у «Фінансах», щоб записати оплату.',
    loadingTills: 'Завантажуємо каси…',
    cancel: 'Скасувати',
    record: 'Записати оплату',
    recording: 'Записуємо…',
    refusedTitle: 'Оплату не записано',
    refusedKept: 'Введену суму {amount} збережено у формі.',
    unknownTitle: 'Не знаємо, чи записано оплату',
    unknownBody:
      'Звʼязок перервався. Перевіряємо оплати замовлення, щоб не записати її двічі.',
    refreshing: 'Оновлюємо…',
    notRecorded:
      'Оплати в замовленні немає — її не записано. Можна записати ще раз.',
    checkFailed:
      'Не вдалося перевірити оплати замовлення. Оновіть сторінку, перш ніж записувати оплату ще раз.',
    saved: 'Оплату записано.',
    confirmNote:
      'Підтверджуючи замовлення, ви визнаєте його повністю оплаченим.',
    statusPending: 'Очікує підтвердження',
    statusConfirmed: 'Підтверджено',
    statusRefunded: 'Кошти повернено',
    statusCancelled: 'Замовлення скасовано',
    payment: 'Платіж',
    refundLabel: 'Повернути',
    refundNothing: 'Оформити повернення',
    refundNoPayments:
      'Платежів за замовленням немає — з каси нічого не списується',
    refundReturns: {
      one: '{amounts} повернеться клієнту з каси: {tills}',
      few: '{amounts} повернеться клієнту з кас: {tills}',
      many: '{amounts} повернеться клієнту з кас: {tills}',
      other: '{amounts} повернеться клієнту з кас: {tills}',
    },
    refundPositions: {
      one: '{count} позиція повернеться на склад',
      few: '{count} позиції повернуться на склад',
      many: '{count} позицій повернеться на склад',
      other: '{count} позиції повернеться на склад',
    },
    refundStatus: 'Статус замовлення зміниться на «{status}»',
    and: ' і ',
  },
  'en-GB': {
    carrierFee: 'The carrier withheld a fee',
    feeAmount: 'Withheld fee, UAH',
    feeHint:
      'Enter the confirmed statement fee. It is the yard’s expense, not customer debt.',
    feeInvalid:
      'Enter a nonnegative fee smaller than the payment, with up to two decimal places.',
    customerGrossHint:
      'The amount the customer paid for the order before the fee was withheld.',
    netReceipt: 'Received in the till: {amount}',

    eyebrow: 'Order #{number} · payment',
    title: 'Add payment',
    orderValue: 'Order value',
    inAccounting: 'In the accounting currency',
    valueUnknown: 'No accounting currency chosen yet',
    actualPayment: 'Actual payment',
    actualPayments: 'Actual payments',
    noPayments: 'No payments yet',
    till: 'Till',
    currency: 'Currency',
    amount: 'Amount',
    reselect:
      '“{till}” doesn’t accept {code}. Choose the payment currency again.',
    amountKept: 'The amount {amount} is unchanged and not converted.',
    summary: 'Till {till} · {amount}',
    summaryNoCurrency: 'Till {till} · choose a currency',
    enterAmount: 'Enter the amount',
    noTills: 'No active tills. Create one in Finance to record a payment.',
    loadingTills: 'Loading tills…',
    cancel: 'Cancel',
    record: 'Record payment',
    recording: 'Recording…',
    refusedTitle: 'Payment not recorded',
    refusedKept: 'The amount {amount} is kept in the form.',
    unknownTitle: 'We don’t know whether the payment was recorded',
    unknownBody:
      'The connection dropped. Checking the order’s payments so it isn’t recorded twice.',
    refreshing: 'Refreshing…',
    notRecorded:
      'The order has no such payment — it wasn’t recorded. You can record it again.',
    checkFailed:
      'Couldn’t check the order’s payments. Refresh the page before recording the payment again.',
    saved: 'Payment recorded.',
    confirmNote: 'By confirming the order, you acknowledge it as paid in full.',
    statusPending: 'Awaiting confirmation',
    statusConfirmed: 'Confirmed',
    statusRefunded: 'Refunded',
    statusCancelled: 'Order cancelled',
    payment: 'Payment',
    refundLabel: 'Refund',
    refundNothing: 'Process refund',
    refundNoPayments:
      'The order has no payments — nothing is taken from a till',
    refundReturns: {
      one: '{amounts} goes back to the customer from the till: {tills}',
      other: '{amounts} goes back to the customer from the tills: {tills}',
    },
    refundPositions: {
      one: '{count} item goes back to stock',
      other: '{count} items go back to stock',
    },
    refundStatus: 'The order status will change to “{status}”',
    and: ' and ',
  },
  pl: {
    carrierFee: 'Przewoźnik potrącił prowizję',
    feeAmount: 'Potrącona prowizja, UAH',
    feeHint:
      'Podaj potwierdzoną prowizję z wyciągu. To koszt firmy, a nie dług klienta.',
    feeInvalid:
      'Podaj nieujemną prowizję mniejszą od płatności, do dwóch miejsc po przecinku.',
    customerGrossHint:
      'Kwota zapłacona przez klienta za zamówienie przed potrąceniem prowizji.',
    netReceipt: 'Wpłynęło do kasy: {amount}',

    eyebrow: 'Zamówienie #{number} · płatność',
    title: 'Dodaj płatność',
    orderValue: 'Wartość zamówienia',
    inAccounting: 'W walucie rozliczeniowej',
    valueUnknown: 'Nie wybrano jeszcze waluty rozliczeniowej',
    actualPayment: 'Faktyczna płatność',
    actualPayments: 'Faktyczne płatności',
    noPayments: 'Brak płatności',
    till: 'Kasa',
    currency: 'Waluta',
    amount: 'Kwota',
    reselect:
      'Kasa „{till}” nie przyjmuje {code}. Wybierz ponownie walutę płatności.',
    amountKept: 'Kwota {amount} nie została zmieniona ani przeliczona.',
    summary: 'Kasa {till} · {amount}',
    summaryNoCurrency: 'Kasa {till} · wybierz walutę',
    enterAmount: 'Podaj kwotę',
    noTills:
      'Brak aktywnych kas. Utwórz kasę w „Finansach”, aby zapisać płatność.',
    loadingTills: 'Wczytywanie kas…',
    cancel: 'Anuluj',
    record: 'Zapisz płatność',
    recording: 'Zapisywanie…',
    refusedTitle: 'Nie zapisano płatności',
    refusedKept: 'Kwota {amount} została zachowana w formularzu.',
    unknownTitle: 'Nie wiemy, czy płatność została zapisana',
    unknownBody:
      'Połączenie zostało przerwane. Sprawdzamy płatności zamówienia, aby nie zapisać jej dwa razy.',
    refreshing: 'Odświeżanie…',
    notRecorded:
      'W zamówieniu nie ma tej płatności — nie została zapisana. Możesz zapisać ją ponownie.',
    checkFailed:
      'Nie udało się sprawdzić płatności zamówienia. Odśwież stronę, zanim zapiszesz płatność ponownie.',
    saved: 'Zapisano płatność.',
    confirmNote: 'Potwierdzając zamówienie, uznajesz je za w pełni opłacone.',
    statusPending: 'Oczekuje na potwierdzenie',
    statusConfirmed: 'Potwierdzono',
    statusRefunded: 'Zwrócono środki',
    statusCancelled: 'Zamówienie anulowane',
    payment: 'Płatność',
    refundLabel: 'Zwróć',
    refundNothing: 'Przeprowadź zwrot',
    refundNoPayments:
      'Zamówienie nie ma płatności — z kasy nic nie zostanie pobrane',
    refundReturns: {
      one: '{amounts} wróci do klienta z kasy: {tills}',
      few: '{amounts} wróci do klienta z kas: {tills}',
      many: '{amounts} wróci do klienta z kas: {tills}',
      other: '{amounts} wróci do klienta z kas: {tills}',
    },
    refundPositions: {
      one: '{count} pozycja wróci do magazynu',
      few: '{count} pozycje wrócą do magazynu',
      many: '{count} pozycji wróci do magazynu',
      other: '{count} pozycji wróci do magazynu',
    },
    refundStatus: 'Status zamówienia zmieni się na „{status}”',
    and: ' i ',
  },
})
