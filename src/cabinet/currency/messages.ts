import { defineMessages } from '@/i18n'

/**
 * Accounting currency: the settings block and the first-price pattern shared
 * by every price field. Copy follows the ROZ-162 board table (uk/en-GB/pl).
 */
export const currencyMessages = defineMessages({
  uk: {
    title: 'Валюта обліку',
    hint: 'Ціни автомобілів, запчастин, партій і витрат використовують цю валюту. Після збереження першої ціни її не можна буде змінити.',
    lockedHint:
      'Валюту обліку не можна змінити після збереження першої ціни. Каси можуть приймати оплату в інших валютах.',
    badge: 'Зафіксовано',
    noRights: 'Валюту обліку налаштовує власник розбірки',
    notSet: 'Валюту обліку ще не обрано',
    placeholder: 'Оберіть валюту обліку',
    field: 'Валюта',
    search: 'Пошук за кодом або назвою',
    noMatch: 'Нічого не знайдено за «{query}». Спробуйте код, наприклад GBP.',
    save: 'Зберегти',
    saving: 'Зберігаємо…',
    change: 'Змінити',
    cancel: 'Скасувати',
    loading: 'Завантажуємо валюту обліку…',
    loadError: 'Не вдалося завантажити валюту обліку.',
    retry: 'Повторити',
    refused: 'Валюту не збережено. Ваш вибір залишився, спробуйте ще раз.',
    lockedMeanwhile:
      'Валюту не змінено: за цей час уже збережено першу ціну, тож валюту зафіксовано.',
    denied: 'Змінювати валюту обліку може лише власник розбірки.',
    checking: 'Звʼязок перервався. Перевіряємо, чи збережено валюту…',
    checkFailed:
      'Не вдалося перевірити, чи збережено валюту. Ваш вибір залишився.',
    checkAgain: 'Перевірити ще раз',
    saved: 'Валюту обліку збережено.',
    backToForm: 'Повернутися до форми',
    needCurrency: 'Перед збереженням ціни оберіть валюту обліку',
    chooseLink: 'Обрати валюту обліку',
    draftKept: 'Чернетку збережемо, після вибору повернемо сюди.',
    askOwner: 'Зверніться до власника розбірки, щоб він обрав валюту.',
    willLock:
      'Після збереження цієї ціни валюту обліку {code} буде зафіксовано.',
    priceHint: 'У валюті обліку: {code}, {name}',
    conflictTitle: 'Ціну не збережено: валюта обліку змінилася',
    conflictBody:
      'Поки форма була відкрита, валюту обліку змінено з {from} на {to}. Перевірте суму: чернетку збережено, але не перераховано.',
    saveIn: 'Зберегти в {code}',
    precheckFailed:
      'Не вдалося перевірити валюту обліку перед збереженням ціни. Спробуйте ще раз.',
    precision: 'Для {code} — не більше двох знаків після коми.',
    precisionWhole: 'Сума в {code} має бути цілою, без дробової частини.',
    tooLarge: 'Сума завелика.',
  },
  'en-GB': {
    title: 'Accounting currency',
    hint: 'Prices for cars, parts, batches and expenses use this currency. Once the first price is saved, it can’t be changed.',
    lockedHint:
      'The accounting currency can’t be changed after the first price is saved. Cash desks can still accept payments in other currencies.',
    badge: 'Locked',
    noRights: 'The yard owner sets the accounting currency',
    notSet: 'No accounting currency chosen yet',
    placeholder: 'Choose an accounting currency',
    field: 'Currency',
    search: 'Search by code or name',
    noMatch: 'Nothing found for “{query}”. Try a code, for example GBP.',
    save: 'Save',
    saving: 'Saving…',
    change: 'Change',
    cancel: 'Cancel',
    loading: 'Loading the accounting currency…',
    loadError: 'Couldn’t load the accounting currency.',
    retry: 'Retry',
    refused: 'The currency wasn’t saved. Your choice is kept — try again.',
    lockedMeanwhile:
      'The currency wasn’t changed: a first price was saved in the meantime, so the currency is now locked.',
    denied: 'Only the yard owner can change the accounting currency.',
    checking:
      'The connection dropped. Checking whether the currency was saved…',
    checkFailed:
      'Couldn’t check whether the currency was saved. Your choice is kept.',
    checkAgain: 'Check again',
    saved: 'Accounting currency saved.',
    backToForm: 'Back to the form',
    needCurrency: 'Choose an accounting currency before saving a price',
    chooseLink: 'Choose the accounting currency',
    draftKept: 'We’ll keep your draft and bring you back here afterwards.',
    askOwner: 'Ask the yard owner to choose the currency.',
    willLock: 'Saving this price will lock the accounting currency to {code}.',
    priceHint: 'In the accounting currency: {code}, {name}',
    conflictTitle: 'Price not saved: the accounting currency changed',
    conflictBody:
      'While the form was open, the accounting currency changed from {from} to {to}. Check the amount: your draft is kept but not converted.',
    saveIn: 'Save in {code}',
    precheckFailed:
      'Couldn’t check the accounting currency before saving the price. Try again.',
    precision: 'Use no more than two decimal places for {code}.',
    precisionWhole: 'Amounts in {code} must be whole numbers.',
    tooLarge: 'This amount is too large.',
  },
  pl: {
    title: 'Waluta rozliczeniowa',
    hint: 'Ceny samochodów, części, partii i wydatków są w tej walucie. Po zapisaniu pierwszej ceny nie będzie można jej zmienić.',
    lockedHint:
      'Waluty rozliczeniowej nie można zmienić po zapisaniu pierwszej ceny. Kasy mogą przyjmować płatności w innych walutach.',
    badge: 'Zablokowano',
    noRights: 'Walutę rozliczeniową ustawia właściciel',
    notSet: 'Nie wybrano jeszcze waluty rozliczeniowej',
    placeholder: 'Wybierz walutę rozliczeniową',
    field: 'Waluta',
    search: 'Szukaj po kodzie lub nazwie',
    noMatch: 'Nic nie znaleziono dla „{query}”. Spróbuj kodu, na przykład GBP.',
    save: 'Zapisz',
    saving: 'Zapisywanie…',
    change: 'Zmień',
    cancel: 'Anuluj',
    loading: 'Wczytywanie waluty rozliczeniowej…',
    loadError: 'Nie udało się wczytać waluty rozliczeniowej.',
    retry: 'Ponów',
    refused:
      'Nie zapisano waluty. Twój wybór został zachowany, spróbuj ponownie.',
    lockedMeanwhile:
      'Nie zmieniono waluty: w międzyczasie zapisano pierwszą cenę, więc waluta jest zablokowana.',
    denied: 'Walutę rozliczeniową może zmienić tylko właściciel.',
    checking:
      'Połączenie zostało przerwane. Sprawdzamy, czy waluta została zapisana…',
    checkFailed:
      'Nie udało się sprawdzić, czy waluta została zapisana. Twój wybór został zachowany.',
    checkAgain: 'Sprawdź ponownie',
    saved: 'Zapisano walutę rozliczeniową.',
    backToForm: 'Wróć do formularza',
    needCurrency: 'Przed zapisaniem ceny wybierz walutę rozliczeniową',
    chooseLink: 'Wybierz walutę rozliczeniową',
    draftKept: 'Zachowamy wersję roboczą i wrócimy tu po wyborze.',
    askOwner: 'Poproś właściciela, aby wybrał walutę.',
    willLock:
      'Po zapisaniu tej ceny waluta rozliczeniowa {code} zostanie zablokowana.',
    priceHint: 'W walucie rozliczeniowej: {code}, {name}',
    conflictTitle: 'Nie zapisano ceny: waluta rozliczeniowa się zmieniła',
    conflictBody:
      'Gdy formularz był otwarty, waluta rozliczeniowa zmieniła się z {from} na {to}. Sprawdź kwotę: wersja robocza została zachowana, ale nie przeliczona.',
    saveIn: 'Zapisz w {code}',
    precheckFailed:
      'Nie udało się sprawdzić waluty rozliczeniowej przed zapisaniem ceny. Spróbuj ponownie.',
    precision: 'Dla {code} podaj najwyżej dwa miejsca po przecinku.',
    precisionWhole: 'Kwota w {code} musi być liczbą całkowitą.',
    tooLarge: 'Ta kwota jest za duża.',
  },
})
