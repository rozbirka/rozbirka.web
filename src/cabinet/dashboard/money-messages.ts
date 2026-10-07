import { defineMessages } from '@/i18n'

/** Dashboard money (ROZ-162 board 4a/4b). */
export const dashboardMoneyMessages = defineMessages({
  uk: {
    confirmedValue: 'Вартість підтверджених замовлень',
    accountingValue: 'Облікова вартість · {code}',
    valuePending:
      'Сервер ще не рахує облікову вартість підтверджених замовлень, тому її тут немає.',
    notSet: 'Валюту обліку ще не обрано',
    chooseCurrency: 'Обрати валюту',
    receipts: 'Фактичні надходження',
    receiptsToday: 'Надходження сьогодні',
    byCurrency: 'Окремо за валютами',
    noReceipts: 'За обраний період надходжень не було.',
    perDay: 'сер. {amount}/день',
    period: 'Фактичні надходження · {period}',
    balances: 'Залишки кас',
  },
  'en-GB': {
    confirmedValue: 'Value of confirmed orders',
    accountingValue: 'Accounting value · {code}',
    valuePending:
      'The server doesn’t calculate the accounting value of confirmed orders yet, so it isn’t shown here.',
    notSet: 'No accounting currency chosen yet',
    chooseCurrency: 'Choose a currency',
    receipts: 'Actual receipts',
    receiptsToday: 'Receipts today',
    byCurrency: 'Separately by currency',
    noReceipts: 'No receipts in the selected period.',
    perDay: 'avg {amount}/day',
    period: 'Actual receipts · {period}',
    balances: 'Cash desk balances',
  },
  pl: {
    confirmedValue: 'Wartość potwierdzonych zamówień',
    accountingValue: 'Wartość rozliczeniowa · {code}',
    valuePending:
      'Serwer nie liczy jeszcze wartości rozliczeniowej potwierdzonych zamówień, dlatego jej tu nie ma.',
    notSet: 'Nie wybrano jeszcze waluty rozliczeniowej',
    chooseCurrency: 'Wybierz walutę',
    receipts: 'Faktyczne wpływy',
    receiptsToday: 'Wpływy dzisiaj',
    byCurrency: 'Osobno dla każdej waluty',
    noReceipts: 'W wybranym okresie nie było wpływów.',
    perDay: 'śr. {amount}/dzień',
    period: 'Faktyczne wpływy · {period}',
    balances: 'Salda kas',
  },
})
