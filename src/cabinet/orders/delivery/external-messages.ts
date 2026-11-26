import { defineMessages } from '@/i18n'

export const externalMessages = defineMessages({
  uk: {
    authorizationFailed:
      'Нова пошта не дозволила перевірити накладну. Перевірте API-ключ у налаштуваннях інтеграції.',
    providerUnavailable:
      'Не вдалося перевірити накладну: сервіс Нової пошти тимчасово недоступний. Спробуйте пізніше.',
    providerInvalidResponse:
      'Нова пошта повернула некоректну відповідь. Спробуйте перевірити накладну пізніше.',
    providerRateLimited:
      'Нова пошта тимчасово обмежила запити. Повторіть перевірку за кілька хвилин.',
    notFound:
      'Накладну не знайдено у підключеному кабінеті Нової пошти. Перевірте номер і кабінет, у якому її створено.',
    legacyOperationsUnavailable:
      'Для цієї накладної НП не надала ідентифікатор для зміни чи скасування. Скористайтеся кабінетом НП.',
    amountHint:
      'Після перевірки ТТН підставимо контроль оплати НП та вже внесену передоплату, без віднімання комісії. Суму можна змінити.',
    amountRequired:
      'Вкажіть погоджену суму вручну: у ТТН немає додатного контролю оплати або вже записано післяплату.',
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
    authorizationFailed:
      'Nova Poshta did not authorize the waybill check. Check the API key in the integration settings.',
    providerUnavailable:
      'The waybill could not be checked: Nova Poshta is temporarily unavailable. Try again later.',
    providerInvalidResponse:
      'Nova Poshta returned an invalid response. Try checking the waybill again later.',
    providerRateLimited:
      'Nova Poshta has temporarily limited requests. Try checking again in a few minutes.',
    notFound:
      'The waybill was not found in the connected Nova Poshta account. Check its number and the account where it was created.',
    legacyOperationsUnavailable:
      'Nova Poshta did not provide an identifier for changing or cancelling this waybill. Use the Nova Poshta account.',
    amountHint:
      'After checking the waybill, we will fill the Nova Poshta COD plus recorded prepayment, without deducting fees. You can edit the total.',
    amountRequired:
      'Enter the agreed total manually: the waybill has no positive COD amount or a COD payment is already recorded.',
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
    authorizationFailed:
      'Nowa Poczta nie zezwoliła na sprawdzenie listu. Sprawdź klucz API w ustawieniach integracji.',
    providerUnavailable:
      'Nie udało się sprawdzić listu: Nowa Poczta jest tymczasowo niedostępna. Spróbuj później.',
    providerInvalidResponse:
      'Nowa Poczta zwróciła nieprawidłową odpowiedź. Spróbuj ponownie sprawdzić list później.',
    providerRateLimited:
      'Nowa Poczta tymczasowo ograniczyła zapytania. Spróbuj ponownie za kilka minut.',
    notFound:
      'Nie znaleziono listu na połączonym koncie Nowej Poczty. Sprawdź numer i konto, na którym go utworzono.',
    legacyOperationsUnavailable:
      'Nowa Poczta nie podała identyfikatora do zmiany lub anulowania tego listu. Skorzystaj z panelu Nowej Poczty.',
    amountHint:
      'Po sprawdzeniu listu uzupełnimy pobranie Nowej Poczty i zapisaną przedpłatę, bez potrącania prowizji. Kwotę można zmienić.',
    amountRequired:
      'Podaj uzgodnioną kwotę ręcznie: list nie ma dodatniej kwoty pobrania lub płatność za pobraniem została już zapisana.',
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
