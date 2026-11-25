import { defineMessages } from '@/i18n'

export const externalMessages = defineMessages({
  uk: {
    amountHint:
      'Вкажіть погоджену з покупцем суму товарів. Оплати залишаться без змін.',
    amountError: 'Вкажіть погоджену суму в гривнях від 0 до 9 999 999 999.',
    codMismatch:
      'Післяплата НП не збігається із залишком замовлення. Перевірте суму та вже внесені оплати.',
    currencyMismatch:
      'У замовленні є оплати в іншій валюті. Спочатку звірте їх: автоматичне перерахування у гривні недоступне.',
    identityIncomplete:
      'НП не надала повних даних відправника, отримувача, маршруту або післяплати. Перевірте накладну в кабінеті НП.',
    unknown: 'Немає даних',
    provider: 'Стан у Новій пошті',
    declared: 'Оголошена вартість',
    parcels: 'Місця та вага',
    amount: 'Погоджена сума замовлення',
    review: 'Перевірте дані накладної та погоджену суму перед прив’язуванням.',
  },
  'en-GB': {
    amountHint:
      'Enter the goods total agreed with the customer. Existing payments stay unchanged.',
    amountError: 'Enter an agreed total in UAH from 0 to 9,999,999,999.',
    codMismatch:
      'Nova Poshta COD does not match the order balance. Check the agreed total and existing payments.',
    currencyMismatch:
      'This order has payments in another currency. Reconcile them first: automatic conversion to UAH is unavailable.',
    identityIncomplete:
      'Nova Poshta did not provide complete sender, recipient, route or COD details. Check the waybill in the carrier cabinet.',
    unknown: 'Unavailable',
    provider: 'Nova Poshta status',
    declared: 'Declared value',
    parcels: 'Parcels and weight',
    amount: 'Agreed order total',
    review: 'Review the waybill details and agreed total before attaching.',
  },
  pl: {
    amountHint:
      'Podaj kwotę towarów uzgodnioną z kupującym. Dotychczasowe płatności pozostaną bez zmian.',
    amountError: 'Podaj uzgodnioną kwotę w UAH od 0 do 9 999 999 999.',
    codMismatch:
      'Pobranie Nowej Poczty nie odpowiada saldu zamówienia. Sprawdź uzgodnioną kwotę i dotychczasowe płatności.',
    currencyMismatch:
      'Zamówienie ma płatności w innej walucie. Najpierw je uzgodnij: automatyczne przeliczenie na UAH jest niedostępne.',
    identityIncomplete:
      'Nowa Poczta nie podała pełnych danych nadawcy, odbiorcy, trasy lub pobrania. Sprawdź list w panelu przewoźnika.',
    unknown: 'Brak danych',
    provider: 'Status w Nowej Poczcie',
    declared: 'Wartość deklarowana',
    parcels: 'Paczki i waga',
    amount: 'Uzgodniona kwota zamówienia',
    review: 'Sprawdź dane listu i uzgodnioną kwotę przed powiązaniem.',
  },
})
