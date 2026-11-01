import { defineMessages } from '@/i18n'

/**
 * The connected Nova Poshta integration (design module 46 §2): the overview
 * cards and the change of delivery settings on the «Налаштування» tab.
 */
export const npSettingsMessages = defineMessages({
  uk: {
    headSub: 'Доставка Україною між відділеннями.',
    keyLabel: 'API-ключ',
    replaceApiKey: 'Змінити API-ключ',
    connectNewKey: 'Підключити новий API-ключ',
    replaceKeyHint:
      'Новий ключ перевіряється в майстрі й застосовується після завершення налаштування. Попередній ключ зберігається для раніше створених ТТН.',
    access: 'Доступ',
    accessWorking: 'Працює',
    accessBroken: 'Не працює',
    accessOff: 'Вимкнено',
    notConnected:
      'Нову пошту ще не підключено. Підключення проведе через ключ, відправника, касу й точку відправлення.',
    // «Відправлення»
    shippingCard: 'Відправлення',
    updated: 'Оновлено',
    sender: 'Відправник',
    contact: 'Контактна особа',
    point: 'Точка відправлення',
    till: 'Каса для післяплати',
    noTill: 'Без каси · вручну',
    changeSettings: 'Змінити налаштування',
    readOnly:
      'Змінювати налаштування й відключати інтеграцію може власник або користувач із правом «Налаштування інтеграцій».',
    shippingLoadError: 'Не вдалося завантажити налаштування відправлення.',
    // «Ваші права»
    rightsTitle: 'Ваші права',
    rightsHint: 'Права надає власник у розділі «Команда».',
    rightIntegrations: 'Налаштування інтеграцій',
    rightOrders: 'Керування замовленнями',
    rightFinance: 'Фінанси',
    rightYes: 'є',
    rightNo: 'немає',
    // Edit mode
    checkChanges: 'Перевірити зміни',
    editNote:
      'Зміни застосовуватимуться лише до нових накладних. Уже створені накладні залишаться без змін.',
    senderHint: 'Відправник із кабінету Нової пошти.',
    changedFrom: 'Змінено · було {old}',
    tillHint: 'Нова каса не переносить уже зареєстровані оплати.',
    keyForChange:
      'Нового відправника, контакт чи точку Нова пошта перевіряє лише з ключем. Збережений ключ ми не показуємо — вставте його ще раз.',
    keyRequired: 'Вставте ключ, щоб перевірити зміни.',
    summaryTitle: 'Зберегти зміни підключення?',
    summaryVerified:
      'Перевірено в Новій пошті. Зміни діятимуть для нових накладних.',
    summaryTillOnly: 'Зміни діятимуть для нових накладних.',
    saveChanges: 'Зберегти зміни',
    changeLine: '{field}: {from} → {to}',
    unchangedOne: '{fields} не змінюється.',
    unchangedMany: '{fields} не змінюються.',
    and: 'й',
    fieldSender: 'Відправник',
    fieldContact: 'Контактна особа',
    fieldPoint: 'Точка відправлення',
    fieldTill: 'Каса',
    draftsNote:
      'Чернетки доставки у відкритих замовленнях треба буде перевірити перед створенням ТТН.',
    saved: 'Налаштування збережено. Вони діятимуть для нових накладних.',
    senderRejected:
      'Нова пошта не підтвердила відправника «{name}» для цього ключа. Чинні налаштування не змінено.',
    saveFailed:
      'Не вдалося зберегти зміни. Введене збережено — спробуйте ще раз.',
    saveAgain: 'Зберегти ще раз',
    conflictTitle: 'Налаштування вже змінено',
    conflictText:
      'Поки ви редагували, налаштування змінив інший користувач. Оновіть дані, перевірте зміни ще раз і збережіть.',
    refreshData: 'Оновити дані',
    checkExpired:
      'Перевірка змін застаріла. Натисніть «Перевірити зміни» ще раз.',
  },
  'en-GB': {
    headSub: 'Branch-to-branch delivery within Ukraine.',
    keyLabel: 'API key',
    replaceApiKey: 'Change API key',
    connectNewKey: 'Connect a new API key',
    replaceKeyHint:
      'The wizard verifies the new key and applies it after setup is completed. The previous key is kept for existing waybills.',
    access: 'Access',
    accessWorking: 'Working',
    accessBroken: 'Not working',
    accessOff: 'Switched off',
    notConnected:
      'Nova Poshta is not connected yet. Setup walks you through the key, sender, till and dispatch point.',
    shippingCard: 'Dispatch',
    updated: 'Updated',
    sender: 'Sender',
    contact: 'Contact person',
    point: 'Dispatch point',
    till: 'Till for cash on delivery',
    noTill: 'No till · manual',
    changeSettings: 'Change settings',
    readOnly:
      'Settings can be changed, and the integration disconnected, by the owner or a user with the “Integration settings” permission.',
    shippingLoadError: 'Could not load the dispatch settings.',
    rightsTitle: 'Your permissions',
    rightsHint: 'Permissions are granted by the owner in “Team”.',
    rightIntegrations: 'Integration settings',
    rightOrders: 'Order management',
    rightFinance: 'Finance',
    rightYes: 'yes',
    rightNo: 'no',
    checkChanges: 'Check changes',
    editNote:
      'Changes apply to new waybills only. Waybills already created stay as they are.',
    senderHint: 'A sender from your Nova Poshta account.',
    changedFrom: 'Changed · was {old}',
    tillHint: 'A new till does not move payments already recorded.',
    keyForChange:
      'Nova Poshta checks a new sender, contact or dispatch point only with the key. We never show the stored key — paste it again.',
    keyRequired: 'Paste the key to check the changes.',
    summaryTitle: 'Save connection changes?',
    summaryVerified:
      'Checked with Nova Poshta. The changes apply to new waybills.',
    summaryTillOnly: 'The changes apply to new waybills.',
    saveChanges: 'Save changes',
    changeLine: '{field}: {from} → {to}',
    unchangedOne: '{fields} stays the same.',
    unchangedMany: '{fields} stay the same.',
    and: 'and',
    fieldSender: 'Sender',
    fieldContact: 'Contact person',
    fieldPoint: 'Dispatch point',
    fieldTill: 'Till',
    draftsNote:
      'Delivery drafts in open orders will need checking before a waybill is created.',
    saved: 'Settings saved. They apply to new waybills.',
    senderRejected:
      'Nova Poshta did not confirm the sender “{name}” for this key. The current settings are unchanged.',
    saveFailed: 'Could not save the changes. Your input is kept — try again.',
    saveAgain: 'Save again',
    conflictTitle: 'Settings already changed',
    conflictText:
      'Someone else changed the settings while you were editing. Refresh the data, check the changes again and save.',
    refreshData: 'Refresh data',
    checkExpired: 'The check has expired. Press “Check changes” again.',
  },
  pl: {
    headSub: 'Dostawa po Ukrainie między oddziałami.',
    keyLabel: 'Klucz API',
    replaceApiKey: 'Zmień klucz API',
    connectNewKey: 'Podłącz nowy klucz API',
    replaceKeyHint:
      'Kreator sprawdza nowy klucz i stosuje go po zakończeniu konfiguracji. Poprzedni klucz pozostaje dostępny dla istniejących listów przewozowych.',
    access: 'Dostęp',
    accessWorking: 'Działa',
    accessBroken: 'Nie działa',
    accessOff: 'Wyłączone',
    notConnected:
      'Nowa Poczta nie jest jeszcze podłączona. Konfiguracja przeprowadzi przez klucz, nadawcę, kasę i punkt nadania.',
    shippingCard: 'Nadawanie',
    updated: 'Zaktualizowano',
    sender: 'Nadawca',
    contact: 'Osoba kontaktowa',
    point: 'Punkt nadania',
    till: 'Kasa za pobranie',
    noTill: 'Bez kasy · ręcznie',
    changeSettings: 'Zmień ustawienia',
    readOnly:
      'Zmieniać ustawienia i odłączać integrację może właściciel lub użytkownik z uprawnieniem „Ustawienia integracji”.',
    shippingLoadError: 'Nie udało się wczytać ustawień nadawania.',
    rightsTitle: 'Twoje uprawnienia',
    rightsHint: 'Uprawnienia nadaje właściciel w sekcji „Zespół”.',
    rightIntegrations: 'Ustawienia integracji',
    rightOrders: 'Zarządzanie zamówieniami',
    rightFinance: 'Finanse',
    rightYes: 'tak',
    rightNo: 'nie',
    checkChanges: 'Sprawdź zmiany',
    editNote:
      'Zmiany obejmą tylko nowe listy przewozowe. Już utworzone pozostaną bez zmian.',
    senderHint: 'Nadawca z konta Nowej Poczty.',
    changedFrom: 'Zmieniono · było {old}',
    tillHint: 'Nowa kasa nie przenosi już zarejestrowanych płatności.',
    keyForChange:
      'Nowego nadawcę, kontakt lub punkt Nowa Poczta sprawdza tylko z kluczem. Zapisanego klucza nie pokazujemy — wklej go ponownie.',
    keyRequired: 'Wklej klucz, aby sprawdzić zmiany.',
    summaryTitle: 'Zapisać zmiany podłączenia?',
    summaryVerified:
      'Sprawdzono w Nowej Poczcie. Zmiany obejmą nowe listy przewozowe.',
    summaryTillOnly: 'Zmiany obejmą nowe listy przewozowe.',
    saveChanges: 'Zapisz zmiany',
    changeLine: '{field}: {from} → {to}',
    unchangedOne: '{fields} się nie zmienia.',
    unchangedMany: '{fields} się nie zmieniają.',
    and: 'i',
    fieldSender: 'Nadawca',
    fieldContact: 'Osoba kontaktowa',
    fieldPoint: 'Punkt nadania',
    fieldTill: 'Kasa',
    draftsNote:
      'Szkice dostaw w otwartych zamówieniach trzeba będzie sprawdzić przed utworzeniem listu przewozowego.',
    saved: 'Ustawienia zapisane. Obejmą nowe listy przewozowe.',
    senderRejected:
      'Nowa Poczta nie potwierdziła nadawcy „{name}” dla tego klucza. Obecne ustawienia nie zostały zmienione.',
    saveFailed:
      'Nie udało się zapisać zmian. Wpisane dane są zachowane — spróbuj ponownie.',
    saveAgain: 'Zapisz ponownie',
    conflictTitle: 'Ustawienia już zmieniono',
    conflictText:
      'Podczas edycji ustawienia zmienił inny użytkownik. Odśwież dane, sprawdź zmiany ponownie i zapisz.',
    refreshData: 'Odśwież dane',
    checkExpired: 'Sprawdzenie wygasło. Naciśnij „Sprawdź zmiany” ponownie.',
  },
})
