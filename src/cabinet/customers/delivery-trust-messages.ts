export const deliveryTrustMessages = {
  uk: {
    title: 'Доставка Новою поштою',
    trusted: 'Довірений для доставки',
    ordinary: 'Передоплата за правилом розбірки',
    hint: 'Довіреному клієнту пропонуємо доставку без передоплати. У замовленні можна вимагати її окремо.',
    grant: 'Надати довіру',
    revoke: 'Скасувати довіру',
    reason: 'Причина',
    updated: 'Оновлено',
    reasonHint:
      'Коротко поясніть рішення. Воно діятиме для наступних оформлень доставки.',
    save: 'Зберегти',
    error:
      'Не вдалося зберегти зміну довіри. Перевірте актуальні дані та спробуйте ще раз.',
    unavailable: 'Налаштування довіри недоступне в поточній версії сервісу.',
    require: 'Вимагати мінімальну передоплату',
    waived:
      'Без обов’язкової передоплати — довірений клієнт. Несплачений залишок поїде післяплатою.',
    required:
      'ТТН можна створити після мінімальної передоплати. Отримані кошти зараховуються в оплату замовлення.',
    policyOff: 'Розбірка відправляє без обов’язкової передоплати.',
    editException:
      'Довірений клієнт: можна вимкнути передоплату в «Редагувати».',
  },
  'en-GB': {
    title: 'Nova Poshta delivery',
    trusted: 'Trusted for delivery',
    ordinary: 'Prepayment follows the yard policy',
    hint: 'Trusted customers are offered delivery without prepayment. You can require it for an individual order.',
    grant: 'Grant trust',
    revoke: 'Revoke trust',
    reason: 'Reason',
    updated: 'Updated',
    reasonHint:
      'Briefly explain the decision. It will apply to future delivery bookings.',
    save: 'Save',
    error:
      'Could not save the trust change. Check the current details and try again.',
    unavailable:
      'Delivery trust is unavailable in the current service version.',
    require: 'Require minimum prepayment',
    waived:
      'No required prepayment for this trusted customer. The unpaid balance will be collected on delivery.',
    required:
      'The waybill can be created after minimum prepayment. Money received counts towards the order payment.',
    policyOff: 'The yard dispatches without requiring prepayment.',
    editException:
      'Trusted customer: you can turn off required prepayment in “Edit”.',
  },
  pl: {
    title: 'Dostawa Nova Poshta',
    trusted: 'Zaufany do wysyłki',
    ordinary: 'Przedpłata zgodnie z zasadami firmy',
    hint: 'Zaufanym klientom proponujemy wysyłkę bez przedpłaty. Można jej wymagać dla konkretnego zamówienia.',
    grant: 'Nadaj zaufanie',
    revoke: 'Cofnij zaufanie',
    reason: 'Powód',
    updated: 'Zaktualizowano',
    reasonHint:
      'Krótko uzasadnij decyzję. Będzie obowiązywać przy kolejnych zleceniach wysyłki.',
    save: 'Zapisz',
    error:
      'Nie udało się zapisać zmiany zaufania. Sprawdź aktualne dane i spróbuj ponownie.',
    unavailable:
      'Zaufanie do wysyłki jest niedostępne w obecnej wersji usługi.',
    require: 'Wymagaj minimalnej przedpłaty',
    waived:
      'Brak wymaganej przedpłaty dla zaufanego klienta. Nieopłacona kwota zostanie pobrana przy odbiorze.',
    required:
      'List można utworzyć po minimalnej przedpłacie. Otrzymane środki zaliczają się na poczet zamówienia.',
    policyOff: 'Firma wysyła bez wymaganej przedpłaty.',
    editException:
      'Zaufany klient: możesz wyłączyć wymaganą przedpłatę w opcji „Edytuj”.',
  },
} as const
