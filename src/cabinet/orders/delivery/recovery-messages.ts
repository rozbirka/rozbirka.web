import { defineMessages } from '@/i18n'

export const recoveryMessages = defineMessages({
  uk: {
    title: 'Перевірити створення ТТН',
    description:
      'Замовлення #{number}. Відповідь НП могла перерватися. Знайдену накладну потрібно підтвердити.',
    searching: 'Шукаємо накладну в кабінеті Нової пошти…',
    found:
      'Звірте дані Нової пошти й підтвердьте лише накладну цього замовлення.',
    notFound:
      'Накладну не знайдено. Повторіть пошук або перевірте номер із кабінету НП.',
    incomplete:
      'Не всі дані накладної підтверджено або вони не збігаються із замовленням. Перевірте номер у кабінеті НП або повторіть пошук.',
    limited:
      'Пошук обмежено. Показано не всі можливі накладні. Перевірте номер у кабінеті НП.',
    unknown:
      'Результат створення залишається невідомим. Повторне створення ТТН недоступне до підтвердження.',
    searchFailed:
      'Не вдалося перевірити створення ТТН. Повторіть пошук або перевірте номер із кабінету НП.',
    accessFailed:
      'Немає доступу до кабінету НП початкової операції. Відновіть доступ у налаштуваннях інтеграції та повторіть пошук.',
    inactive:
      'Інтеграцію НП вимкнено. Увімкніть її в налаштуваннях та повторіть пошук.',
    invalidNumber:
      'НП не розпізнала номер ТТН. Перевірте номер у її кабінеті та введіть його знову.',
    identityUnverified:
      'Не вдалося підтвердити належність ТТН цьому замовленню. Перевірте номер і дані в кабінеті НП.',
    manual: 'Номер ТТН із кабінету НП',
    manualHint:
      'Спершу покажемо дані НП для звірки. Введення номера не прив’язує накладну.',
    preview: 'Перевірити номер',
    previewing: 'Перевіряємо номер…',
    retry: 'Повторити пошук',
    candidateTitle: 'ТТН {number}',
    createdAt: 'Створено в НП',
    sender: 'Відправник',
    recipient: 'Отримувач',
    from: 'Звідки',
    to: 'Куди',
    cod: 'Післяплата',
    unavailable: 'НП не надала дані',
    financeUnavailable:
      'Сума недоступна без права перегляду фінансів або даних НП.',
    cannotConfirm:
      'Підтвердження недоступне: даних для звірки або необхідних прав недостатньо. Перевірте накладну в кабінеті НП; за потреби зверніться до власника.',
    confirm: 'Підтвердити цю ТТН',
    confirming: 'Підтверджуємо…',
    reject: 'Не ця накладна',
    stale:
      'Дані змінилися. Повторіть пошук і звірте накладну перед підтвердженням.',
    confirmFailed: 'Не вдалося підтвердити ТТН. Повторіть пошук і звірте дані.',
  },
  'en-GB': {
    title: 'Check waybill creation',
    description:
      'Order #{number}. The Nova Poshta response may have been interrupted. Confirm the matching waybill explicitly.',
    searching: 'Searching for a waybill in the Nova Poshta account…',
    found:
      'Compare the Nova Poshta details and confirm only the waybill for this order.',
    notFound:
      'No waybill found. Search again or check a number from the Nova Poshta account.',
    incomplete:
      'Some waybill details are unverified or do not match the order. Check the number in the Nova Poshta account or search again.',
    limited:
      'The search was limited. Some waybills may be missing. Check the number in the Nova Poshta account.',
    unknown:
      'The creation result remains unknown. Creating another waybill is unavailable until confirmation.',
    searchFailed:
      'Could not check waybill creation. Search again or check a number from the Nova Poshta account.',
    accessFailed:
      'Access to the Nova Poshta account used for the original operation is unavailable. Restore access in integration settings and search again.',
    inactive:
      'The Nova Poshta integration is disabled. Enable it in settings and search again.',
    invalidNumber:
      'Nova Poshta did not recognise this waybill number. Check the number in its account and enter it again.',
    identityUnverified:
      'Could not verify that this waybill belongs to the order. Check its number and details in the Nova Poshta account.',
    manual: 'Waybill number from the Nova Poshta account',
    manualHint:
      'We will show the carrier details for review first. Entering a number does not attach the waybill.',
    preview: 'Check number',
    previewing: 'Checking number…',
    retry: 'Search again',
    candidateTitle: 'Waybill {number}',
    createdAt: 'Created in Nova Poshta',
    sender: 'Sender',
    recipient: 'Recipient',
    from: 'From',
    to: 'To',
    cod: 'Cash on delivery',
    unavailable: 'Not provided by Nova Poshta',
    financeUnavailable:
      'The amount is unavailable without finance viewing permission or carrier details.',
    cannotConfirm:
      'Confirmation unavailable: verification details or required permissions are missing. Check the waybill in the Nova Poshta account; contact the owner if needed.',
    confirm: 'Confirm this waybill',
    confirming: 'Confirming…',
    reject: 'Not this waybill',
    stale:
      'The details have changed. Search again and review the waybill before confirming.',
    confirmFailed:
      'Could not confirm the waybill. Search again and review the details.',
  },
  pl: {
    title: 'Sprawdź utworzenie listu przewozowego',
    description:
      'Zamówienie #{number}. Odpowiedź Nowej Poczty mogła zostać przerwana. Potwierdź pasujący list przewozowy.',
    searching: 'Szukamy listu przewozowego na koncie Nowej Poczty…',
    found: 'Porównaj dane Nowej Poczty i potwierdź tylko list tego zamówienia.',
    notFound:
      'Nie znaleziono listu przewozowego. Wyszukaj ponownie lub sprawdź numer z konta Nowej Poczty.',
    incomplete:
      'Nie wszystkie dane listu są potwierdzone lub nie zgadzają się z zamówieniem. Sprawdź numer na koncie przewoźnika lub wyszukaj ponownie.',
    limited:
      'Wyszukiwanie było ograniczone. Niektórych listów może brakować. Sprawdź numer na koncie Nowej Poczty.',
    unknown:
      'Wynik utworzenia pozostaje nieznany. Utworzenie kolejnego listu jest niedostępne do czasu potwierdzenia.',
    searchFailed:
      'Nie udało się sprawdzić utworzenia listu. Wyszukaj ponownie lub sprawdź numer z konta Nowej Poczty.',
    accessFailed:
      'Brak dostępu do konta Nowej Poczty użytego w pierwotnej operacji. Przywróć dostęp w ustawieniach integracji i wyszukaj ponownie.',
    inactive:
      'Integracja Nowej Poczty jest wyłączona. Włącz ją w ustawieniach i wyszukaj ponownie.',
    invalidNumber:
      'Nowa Poczta nie rozpoznała numeru listu. Sprawdź numer na jej koncie i wpisz go ponownie.',
    identityUnverified:
      'Nie udało się potwierdzić, że list należy do tego zamówienia. Sprawdź jego numer i dane na koncie Nowej Poczty.',
    manual: 'Numer listu z konta Nowej Poczty',
    manualHint:
      'Najpierw pokażemy dane przewoźnika do porównania. Wpisanie numeru nie przypisuje listu.',
    preview: 'Sprawdź numer',
    previewing: 'Sprawdzamy numer…',
    retry: 'Wyszukaj ponownie',
    candidateTitle: 'List przewozowy {number}',
    createdAt: 'Utworzono w Nowej Poczcie',
    sender: 'Nadawca',
    recipient: 'Odbiorca',
    from: 'Skąd',
    to: 'Dokąd',
    cod: 'Pobranie',
    unavailable: 'Brak danych Nowej Poczty',
    financeUnavailable:
      'Kwota jest niedostępna bez uprawnienia do podglądu finansów lub danych przewoźnika.',
    cannotConfirm:
      'Potwierdzenie niedostępne: brakuje danych do weryfikacji lub wymaganych uprawnień. Sprawdź list na koncie Nowej Poczty; w razie potrzeby skontaktuj się z właścicielem.',
    confirm: 'Potwierdź ten list',
    confirming: 'Potwierdzamy…',
    reject: 'To nie ten list',
    stale:
      'Dane się zmieniły. Wyszukaj ponownie i sprawdź list przed potwierdzeniem.',
    confirmFailed:
      'Nie udało się potwierdzić listu. Wyszukaj ponownie i sprawdź dane.',
  },
})
