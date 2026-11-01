import { defineMessages } from '@/i18n'

/**
 * Restoring access to waybills of an earlier Nova Poshta cabinet (design
 * module 46 §3): the «Відновити доступ» sheet and the order-side entry.
 */
export const npRecoveryMessages = defineMessages({
  uk: {
    title: 'Відновити доступ до старих накладних',
    lead: 'Ключ попереднього кабінету Нової пошти потрібен лише для накладних, створених через нього.',
    listTitle: 'Накладні без доступу · {count}',
    more: {
      one: 'І ще {count} накладна.',
      few: 'І ще {count} накладні.',
      many: 'І ще {count} накладних.',
      other: 'І ще {count} накладної.',
    },
    readOnlyNote:
      'Поточне підключення для нових ТТН не зміниться. Старий ключ використовується лише для читання цих накладних.',
    keyLabel: 'Ключ попереднього кабінету',
    keyPlaceholder: 'Вставте ключ',
    check: 'Перевірити доступ',
    checking: 'Перевіряємо…',
    apply: 'Застосувати',
    confirmed: 'Доступ підтверджено',
    resultTitle: 'Результат перевірки',
    keyAccepted: 'Ключ прийнято Новою поштою',
    yes: 'так',
    cabinetMatches: 'Кабінет збігається з накладними',
    matchCount: '{matched} з {total}',
    notConfirmed: {
      one: 'Ключ дійсний, але жодна з {count} накладної не належить цьому кабінету. Доступ не відновлено.',
      few: 'Ключ дійсний, але жодна з {count} накладних не належить цьому кабінету. Доступ не відновлено.',
      many: 'Ключ дійсний, але жодна з {count} накладних не належить цьому кабінету. Доступ не відновлено.',
      other:
        'Ключ дійсний, але жодна з {count} накладної не належить цьому кабінету. Доступ не відновлено.',
    },
    keyRejected:
      'Нова пошта не прийняла ключ. Перевірте, чи скопійовано його повністю, і спробуйте ще раз.',
    npFailed:
      'Нова пошта не відповіла. Ключ не перевірено — спробуйте ще раз за кілька хвилин.',
    recovered: {
      one: 'Доступ відновлено для {count} накладної. Статуси оновлюються.',
      few: 'Доступ відновлено для {count} накладних. Статуси оновлюються.',
      many: 'Доступ відновлено для {count} накладних. Статуси оновлюються.',
      other: 'Доступ відновлено для {count} накладної. Статуси оновлюються.',
    },
    lostTitle: 'Доступ до накладної втрачено',
    noRight:
      'Ця накладна створена через попередній кабінет Нової пошти, і доступу до нього більше немає. Статус не оновлюється. Відновити доступ може власник або користувач із правом «Налаштування інтеграцій».',
    // Order delivery block (3.2)
    noAccess: 'Немає доступу',
    statusStale:
      'Статус ТТН {number} не оновлюється: ключ попереднього кабінету більше не діє.',
    recover: 'Відновити доступ',
    openWaybill: 'Відкрити ТТН',
  },
  'en-GB': {
    title: 'Restore access to older waybills',
    lead: 'The key of the previous Nova Poshta account is only needed for waybills created through it.',
    listTitle: 'Waybills without access · {count}',
    more: {
      one: 'And {count} more waybill.',
      other: 'And {count} more waybills.',
    },
    readOnlyNote:
      'The current connection for new waybills does not change. The old key is only used to read these waybills.',
    keyLabel: 'Key of the previous account',
    keyPlaceholder: 'Paste the key',
    check: 'Check access',
    checking: 'Checking…',
    apply: 'Apply',
    confirmed: 'Access confirmed',
    resultTitle: 'Check result',
    keyAccepted: 'Key accepted by Nova Poshta',
    yes: 'yes',
    cabinetMatches: 'Account matches the waybills',
    matchCount: '{matched} of {total}',
    notConfirmed: {
      one: 'The key is valid, but the {count} waybill does not belong to this account. Access was not restored.',
      other:
        'The key is valid, but none of the {count} waybills belong to this account. Access was not restored.',
    },
    keyRejected:
      'Nova Poshta did not accept the key. Check that it was copied in full and try again.',
    npFailed:
      'Nova Poshta did not respond. The key was not checked — try again in a few minutes.',
    recovered: {
      one: 'Access restored for {count} waybill. Statuses are updating.',
      other: 'Access restored for {count} waybills. Statuses are updating.',
    },
    lostTitle: 'Access to the waybill lost',
    noRight:
      'This waybill was created through a previous Nova Poshta account that is no longer accessible. Its status is not updated. Access can be restored by the owner or a user with the “Integration settings” permission.',
    noAccess: 'No access',
    statusStale:
      'Waybill {number} status is not updating: the previous account’s key no longer works.',
    recover: 'Restore access',
    openWaybill: 'Open waybill',
  },
  pl: {
    title: 'Przywróć dostęp do starszych listów przewozowych',
    lead: 'Klucz poprzedniego konta Nowej Poczty jest potrzebny tylko dla listów utworzonych przez nie.',
    listTitle: 'Listy przewozowe bez dostępu · {count}',
    more: {
      one: 'I jeszcze {count} list przewozowy.',
      few: 'I jeszcze {count} listy przewozowe.',
      many: 'I jeszcze {count} listów przewozowych.',
      other: 'I jeszcze {count} listu przewozowego.',
    },
    readOnlyNote:
      'Obecne podłączenie dla nowych listów się nie zmieni. Stary klucz służy tylko do odczytu tych listów.',
    keyLabel: 'Klucz poprzedniego konta',
    keyPlaceholder: 'Wklej klucz',
    check: 'Sprawdź dostęp',
    checking: 'Sprawdzamy…',
    apply: 'Zastosuj',
    confirmed: 'Dostęp potwierdzony',
    resultTitle: 'Wynik sprawdzenia',
    keyAccepted: 'Klucz przyjęty przez Nową Pocztę',
    yes: 'tak',
    cabinetMatches: 'Konto zgadza się z listami przewozowymi',
    matchCount: '{matched} z {total}',
    notConfirmed: {
      one: 'Klucz jest ważny, ale {count} list przewozowy nie należy do tego konta. Dostępu nie przywrócono.',
      few: 'Klucz jest ważny, ale żaden z {count} listów przewozowych nie należy do tego konta. Dostępu nie przywrócono.',
      many: 'Klucz jest ważny, ale żaden z {count} listów przewozowych nie należy do tego konta. Dostępu nie przywrócono.',
      other:
        'Klucz jest ważny, ale żaden z {count} listów przewozowych nie należy do tego konta. Dostępu nie przywrócono.',
    },
    keyRejected:
      'Nowa Poczta nie przyjęła klucza. Sprawdź, czy został skopiowany w całości, i spróbuj ponownie.',
    npFailed:
      'Nowa Poczta nie odpowiedziała. Klucz nie został sprawdzony — spróbuj ponownie za kilka minut.',
    recovered: {
      one: 'Przywrócono dostęp do {count} listu przewozowego. Statusy się aktualizują.',
      few: 'Przywrócono dostęp do {count} listów przewozowych. Statusy się aktualizują.',
      many: 'Przywrócono dostęp do {count} listów przewozowych. Statusy się aktualizują.',
      other:
        'Przywrócono dostęp do {count} listu przewozowego. Statusy się aktualizują.',
    },
    lostTitle: 'Utracono dostęp do listu przewozowego',
    noRight:
      'Ten list przewozowy utworzono przez poprzednie konto Nowej Poczty, do którego nie ma już dostępu. Status się nie aktualizuje. Dostęp może przywrócić właściciel lub użytkownik z uprawnieniem „Ustawienia integracji”.',
    noAccess: 'Brak dostępu',
    statusStale:
      'Status listu przewozowego {number} się nie aktualizuje: klucz poprzedniego konta już nie działa.',
    recover: 'Przywróć dostęp',
    openWaybill: 'Otwórz list przewozowy',
  },
})
