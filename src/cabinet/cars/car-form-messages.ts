import { defineMessages } from '@/i18n'

/** The car form, the make/model picker and the photo pickers. */
export const carFormMessages = defineMessages({
  uk: {
    newCar: 'Новий автомобіль',
    editCar: 'Редагувати автомобіль',
    colorWhite: 'Білий',
    colorBlack: 'Чорний',
    colorGrey: 'Сірий',
    colorSilver: 'Срібний',
    colorBlue: 'Синій',
    colorRed: 'Червоний',

    requiredFieldsMissing:
      'Заповніть обовʼязкові поля: код, марку, модель, рік числом і ціну придбання числом.',
    expensesInvalid:
      'Перевірте правильність додаткових витрат. Кожна потребує назви до 200 символів і суми більшої за нуль.',
    expensesPartiallySaved:
      'Автомобіль створено, але не всі витрати збережено: {error} Виправте дані витрати й надішліть форму ще раз — автомобіль не створиться повторно.',
    checkCode: 'Код заповнено',
    checkMakeModel: 'Марка й модель',
    checkYear: 'Рік — чотири цифри',
    checkPriceLocked: 'Ціну веде фінансист',
    checkPrice: 'Ціна придбання',
    checkDone: ' — заповнено',
    checkNotDone: ' — ще не заповнено',
    loadingCar: 'Завантажуємо дані автомобіля…',
    backToCar: 'До автомобіля',
    saveChanges: 'Зберегти зміни',
    createCar: 'Створити автомобіль',
    requiredMarked: 'Обовʼязкові поля позначені',
    restLater: 'Решту можна заповнити пізніше.',
    createdOn: 'Створено {date}',
    createdNotice:
      'Автомобіль створено. Решту витрат можна додати на його сторінці.',
    openCar: 'Відкрити автомобіль',

    identityTitle: 'Ідентифікація',
    identityHintEdit:
      'Код і VIN використовуються в пошуку та на стікерах. Зміна коду не впливає на вже надруковані стікери.',
    identityHintNew:
      'За кодом ви знаходите авто на складі, за VIN — звіряєте його з документами.',
    codeLabel: 'Код',
    codeHint: 'Внутрішній номер авто на складі',
    yearLabel: 'Рік',
    yearHint: 'Чотири цифри, наприклад 2020',
    makeLabel: 'Марка',
    modelLabel: 'Модель',
    colorTitle: 'Колір',
    colorFreeLabel: 'Колір словами',
    colorFreeHint: 'Будь-який колір можна вписати словами.',
    colorPlaceholder: 'Синій',
    vinHint:
      '17 символів з техпаспорта. Декодування VIN сервер не виконує — марку, модель і рік заповнюємо вручну.',

    purchaseTitle: 'Придбання',
    purchaseHint:
      'Ціна придбання разом із витратами формує інвестовану суму авто.',
    acquiredAt: 'Дата придбання',

    extraExpensesTitle: 'Додаткові витрати',
    extraExpensesHint:
      'Те, що вже витрачено на авто: транспортування, розмитнення, мийка. Разом із ціною придбання це інвестована сума.',
    photosTitle: 'Фото',
    photosHint: 'Можна вибрати кілька файлів одразу або зняти на камеру.',
    noPhotos: 'Фото немає.',
    currentPhotoAlt: 'Поточне фото автомобіля {number}',
    photosEditNote:
      'Фото додають і прибирають під час створення авто — ручка оновлення їх не приймає.',
    notesTitle: 'Нотатки',
    notesHint:
      'Стан авто, домовленості з продавцем, що перевірити перед розбиранням.',
    notesPlaceholder: 'Ходова частина в робочому стані.',

    summaryTitle: 'Зведення',
    beforeCreateTitle: 'Перед створенням',
    codeMissing: 'Код не вказано',
    makeModelMissing: 'Марка й модель не вказані',
    vinMissing: 'VIN не вказано',
    summaryPrice: 'Ціна придбання',
    summaryExpenses: 'Витрати',
    summaryInvested: 'Інвестовано',
    deleteNoProfitability:
      'Видалення прибирає авто разом з його історією. Авто з деталями видалити не можна.',
    deleteBlockedParts: {
      one: 'На авто закріплено {count} запчастину, тому видалити його не можна. Щоб прибрати авто зі списку, архівуйте його на картці авто.',
      few: 'На авто закріплено {count} запчастини, тому видалити його не можна. Щоб прибрати авто зі списку, архівуйте його на картці авто.',
      many: 'На авто закріплено {count} запчастин, тому видалити його не можна. Щоб прибрати авто зі списку, архівуйте його на картці авто.',
      other:
        'На авто закріплено {count} запчастини, тому видалити його не можна. Щоб прибрати авто зі списку, архівуйте його на картці авто.',
    },
    deleteAllowed: 'Видалення прибирає авто разом з його історією.',
    deleteCar: 'Видалити автомобіль',
    deleteConsequence:
      'Автомобіль і його витрати буде видалено назавжди. Якщо до авто прив’язані деталі, навіть продані, видалення буде відхилено.',
    deleteTitle: 'Видалити автомобіль?',

    noExpenses: 'Витрат ще немає.',
    expensesAffect: 'Витрати впливають на інвестовану суму й окупність авто.',
    manageExpenses: 'Керувати витратами',
    noNewExpenses: 'Витрат ще немає — авто збережеться й без них.',
    expenseNameLabel: 'Назва',
    expenseRowSr: 'витрати {number}',
    expenseNamePlaceholder: 'Транспортування',
    removeExpenseRow: 'Прибрати витрату {number}',
    expensesLater: 'Витрати можна додати й пізніше, на сторінці авто.',
    addExpense: 'Додати витрату',

    pickMake: 'Оберіть марку',
    pickModel: 'Оберіть модель',
    searchIn: 'Пошук: {label}',
    startTyping: 'Почніть вводити назву',
    loadingList: 'Завантажуємо…',
    listFailed: 'Не вдалося завантажити список. Спробуйте ще раз.',

    choosePhotos: 'Вибрати фото',
    uploadAfterCreate: 'Файли завантажаться після створення автомобіля',
    addPhotos: 'Додати фото',
    noFiles: 'Файлів ще не вибрано.',
    photoPreview: 'Попередній перегляд фото',
    previewOf: 'Попередній перегляд {name}',
    removeFile: 'Прибрати {name}',
    selectedPhotos: 'Вибрані фото',
    uploading: 'Завантаження…',
    uploadFailed:
      'Ці файли не завантажилися. Виберіть інші або спробуйте ще раз.',
    photoFallback: 'Фото',
    removePhoto: 'Прибрати фото',
  },
  'en-GB': {
    newCar: 'New car',
    editCar: 'Edit car',
    colorWhite: 'White',
    colorBlack: 'Black',
    colorGrey: 'Grey',
    colorSilver: 'Silver',
    colorBlue: 'Blue',
    colorRed: 'Red',

    requiredFieldsMissing:
      'Fill in the required fields: code, make, model, year as a number and purchase price as a number.',
    expensesInvalid:
      'Check the additional expenses. Each needs a name of up to 200 characters and an amount greater than zero.',
    expensesPartiallySaved:
      'The car was created, but not all expenses were saved: {error} Fix the expense and submit the form again — the car won’t be created twice.',
    checkCode: 'Code filled in',
    checkMakeModel: 'Make and model',
    checkYear: 'Year — four digits',
    checkPriceLocked: 'Price is managed by finance',
    checkPrice: 'Purchase price',
    checkDone: ' — done',
    checkNotDone: ' — not filled in yet',
    loadingCar: 'Loading car details…',
    backToCar: 'Back to car',
    saveChanges: 'Save changes',
    createCar: 'Create car',
    requiredMarked: 'Required fields are marked',
    restLater: 'You can fill in the rest later.',
    createdOn: 'Created {date}',
    createdNotice:
      'Car created. You can add the remaining expenses on its page.',
    openCar: 'Open car',

    identityTitle: 'Identification',
    identityHintEdit:
      'The code and VIN are used in search and on stickers. Changing the code doesn’t affect stickers already printed.',
    identityHintNew:
      'The code helps you find the car in stock; the VIN lets you check it against the papers.',
    codeLabel: 'Code',
    codeHint: 'The car’s internal stock number',
    yearLabel: 'Year',
    yearHint: 'Four digits, for example 2020',
    makeLabel: 'Make',
    modelLabel: 'Model',
    colorTitle: 'Colour',
    colorFreeLabel: 'Colour in words',
    colorFreeHint: 'You can type any colour in words.',
    colorPlaceholder: 'Blue',
    vinHint:
      '17 characters from the registration document. The server doesn’t decode VINs — make, model and year are filled in by hand.',

    purchaseTitle: 'Purchase',
    purchaseHint:
      'The purchase price plus expenses makes up the amount invested in the car.',
    acquiredAt: 'Purchase date',

    extraExpensesTitle: 'Additional expenses',
    extraExpensesHint:
      'What has already been spent on the car: transport, customs, cleaning. Together with the purchase price, this is the amount invested.',
    photosTitle: 'Photos',
    photosHint: 'You can pick several files at once or use the camera.',
    noPhotos: 'No photos.',
    currentPhotoAlt: 'Current car photo {number}',
    photosEditNote:
      'Photos are added and removed when the car is created — editing doesn’t change them.',
    notesTitle: 'Notes',
    notesHint:
      'Condition of the car, arrangements with the seller, what to check before dismantling.',
    notesPlaceholder: 'Running gear in working order.',

    summaryTitle: 'Summary',
    beforeCreateTitle: 'Before you create',
    codeMissing: 'No code yet',
    makeModelMissing: 'No make or model yet',
    vinMissing: 'No VIN yet',
    summaryPrice: 'Purchase price',
    summaryExpenses: 'Expenses',
    summaryInvested: 'Invested',
    deleteNoProfitability:
      'Deleting removes the car along with its history. A car with parts can’t be deleted.',
    deleteBlockedParts: {
      one: '{count} part is assigned to this car, so it can’t be deleted. To take the car off the list, archive it on the car’s page.',
      other:
        '{count} parts are assigned to this car, so it can’t be deleted. To take the car off the list, archive it on the car’s page.',
    },
    deleteAllowed: 'Deleting removes the car along with its history.',
    deleteCar: 'Delete car',
    deleteConsequence:
      'The car and its expenses will be deleted for good. If any parts are linked to it, even sold ones, deletion will be refused.',
    deleteTitle: 'Delete car?',

    noExpenses: 'No expenses yet.',
    expensesAffect: 'Expenses affect the car’s invested total and payback.',
    manageExpenses: 'Manage expenses',
    noNewExpenses: 'No expenses yet — the car will save without them.',
    expenseNameLabel: 'Name',
    expenseRowSr: 'of expense {number}',
    expenseNamePlaceholder: 'Transport',
    removeExpenseRow: 'Remove expense {number}',
    expensesLater: 'You can also add expenses later, on the car’s page.',
    addExpense: 'Add expense',

    pickMake: 'Choose a make',
    pickModel: 'Choose a model',
    searchIn: 'Search: {label}',
    startTyping: 'Start typing a name',
    loadingList: 'Loading…',
    listFailed: 'Couldn’t load the list. Please try again.',

    choosePhotos: 'Choose photos',
    uploadAfterCreate: 'Files upload once the car is created',
    addPhotos: 'Add photos',
    noFiles: 'No files chosen yet.',
    photoPreview: 'Photo preview',
    previewOf: 'Preview of {name}',
    removeFile: 'Remove {name}',
    selectedPhotos: 'Selected photos',
    uploading: 'Uploading…',
    uploadFailed:
      'These files didn’t upload. Choose different ones or try again.',
    photoFallback: 'Photo',
    removePhoto: 'Remove photo',
  },
  pl: {
    newCar: 'Nowe auto',
    editCar: 'Edytuj auto',
    colorWhite: 'Biały',
    colorBlack: 'Czarny',
    colorGrey: 'Szary',
    colorSilver: 'Srebrny',
    colorBlue: 'Niebieski',
    colorRed: 'Czerwony',

    requiredFieldsMissing:
      'Uzupełnij wymagane pola: kod, markę, model, rok jako liczbę i cenę zakupu jako liczbę.',
    expensesInvalid:
      'Sprawdź dodatkowe wydatki. Każdy potrzebuje nazwy do 200 znaków i kwoty większej od zera.',
    expensesPartiallySaved:
      'Auto zostało utworzone, ale nie wszystkie wydatki zapisano: {error} Popraw dane wydatku i wyślij formularz ponownie — auto nie zostanie utworzone drugi raz.',
    checkCode: 'Kod uzupełniony',
    checkMakeModel: 'Marka i model',
    checkYear: 'Rok — cztery cyfry',
    checkPriceLocked: 'Cenę prowadzi dział finansów',
    checkPrice: 'Cena zakupu',
    checkDone: ' — uzupełnione',
    checkNotDone: ' — jeszcze nieuzupełnione',
    loadingCar: 'Wczytywanie danych auta…',
    backToCar: 'Do auta',
    saveChanges: 'Zapisz zmiany',
    createCar: 'Utwórz auto',
    requiredMarked: 'Pola wymagane oznaczono',
    restLater: 'Resztę można uzupełnić później.',
    createdOn: 'Utworzono {date}',
    createdNotice:
      'Utworzono auto. Pozostałe wydatki możesz dodać na jego stronie.',
    openCar: 'Otwórz auto',

    identityTitle: 'Identyfikacja',
    identityHintEdit:
      'Kod i VIN są używane w wyszukiwaniu i na naklejkach. Zmiana kodu nie wpływa na już wydrukowane naklejki.',
    identityHintNew:
      'Po kodzie znajdziesz auto w magazynie, po VIN porównasz je z dokumentami.',
    codeLabel: 'Kod',
    codeHint: 'Wewnętrzny numer auta w magazynie',
    yearLabel: 'Rok',
    yearHint: 'Cztery cyfry, na przykład 2020',
    makeLabel: 'Marka',
    modelLabel: 'Model',
    colorTitle: 'Kolor',
    colorFreeLabel: 'Kolor słownie',
    colorFreeHint: 'Dowolny kolor możesz wpisać słownie.',
    colorPlaceholder: 'Niebieski',
    vinHint:
      '17 znaków z dowodu rejestracyjnego. Serwer nie dekoduje VIN — markę, model i rok uzupełniamy ręcznie.',

    purchaseTitle: 'Zakup',
    purchaseHint:
      'Cena zakupu razem z wydatkami tworzy kwotę zainwestowaną w auto.',
    acquiredAt: 'Data zakupu',

    extraExpensesTitle: 'Dodatkowe wydatki',
    extraExpensesHint:
      'To, co już wydano na auto: transport, cło, mycie. Razem z ceną zakupu to kwota zainwestowana.',
    photosTitle: 'Zdjęcia',
    photosHint: 'Możesz wybrać kilka plików naraz lub zrobić zdjęcie aparatem.',
    noPhotos: 'Brak zdjęć.',
    currentPhotoAlt: 'Obecne zdjęcie auta {number}',
    photosEditNote:
      'Zdjęcia dodaje się i usuwa przy tworzeniu auta — edycja ich nie zmienia.',
    notesTitle: 'Notatki',
    notesHint:
      'Stan auta, ustalenia ze sprzedawcą, co sprawdzić przed rozbiórką.',
    notesPlaceholder: 'Zawieszenie sprawne.',

    summaryTitle: 'Podsumowanie',
    beforeCreateTitle: 'Przed utworzeniem',
    codeMissing: 'Nie podano kodu',
    makeModelMissing: 'Nie podano marki ani modelu',
    vinMissing: 'Nie podano VIN',
    summaryPrice: 'Cena zakupu',
    summaryExpenses: 'Wydatki',
    summaryInvested: 'Zainwestowano',
    deleteNoProfitability:
      'Usunięcie usuwa auto wraz z jego historią. Auta z częściami nie można usunąć.',
    deleteBlockedParts: {
      one: 'Do auta przypisano {count} część, więc nie można go usunąć. Aby zdjąć auto z listy, zarchiwizuj je na karcie auta.',
      few: 'Do auta przypisano {count} części, więc nie można go usunąć. Aby zdjąć auto z listy, zarchiwizuj je na karcie auta.',
      many: 'Do auta przypisano {count} części, więc nie można go usunąć. Aby zdjąć auto z listy, zarchiwizuj je na karcie auta.',
      other:
        'Do auta przypisano {count} części, więc nie można go usunąć. Aby zdjąć auto z listy, zarchiwizuj je na karcie auta.',
    },
    deleteAllowed: 'Usunięcie usuwa auto wraz z jego historią.',
    deleteCar: 'Usuń auto',
    deleteConsequence:
      'Auto i jego wydatki zostaną usunięte na zawsze. Jeśli są do niego przypisane części, nawet sprzedane, usunięcie zostanie odrzucone.',
    deleteTitle: 'Usunąć auto?',

    noExpenses: 'Nie ma jeszcze wydatków.',
    expensesAffect: 'Wydatki wpływają na zainwestowaną kwotę i zwrot auta.',
    manageExpenses: 'Zarządzaj wydatkami',
    noNewExpenses: 'Nie ma jeszcze wydatków — auto zapisze się i bez nich.',
    expenseNameLabel: 'Nazwa',
    expenseRowSr: 'wydatku {number}',
    expenseNamePlaceholder: 'Transport',
    removeExpenseRow: 'Usuń wydatek {number}',
    expensesLater: 'Wydatki możesz dodać też później, na stronie auta.',
    addExpense: 'Dodaj wydatek',

    pickMake: 'Wybierz markę',
    pickModel: 'Wybierz model',
    searchIn: 'Szukaj: {label}',
    startTyping: 'Zacznij wpisywać nazwę',
    loadingList: 'Wczytywanie…',
    listFailed: 'Nie udało się wczytać listy. Spróbuj ponownie.',

    choosePhotos: 'Wybierz zdjęcia',
    uploadAfterCreate: 'Pliki zostaną przesłane po utworzeniu auta',
    addPhotos: 'Dodaj zdjęcia',
    noFiles: 'Nie wybrano jeszcze plików.',
    photoPreview: 'Podgląd zdjęcia',
    previewOf: 'Podgląd {name}',
    removeFile: 'Usuń {name}',
    selectedPhotos: 'Wybrane zdjęcia',
    uploading: 'Przesyłanie…',
    uploadFailed:
      'Tych plików nie udało się przesłać. Wybierz inne lub spróbuj ponownie.',
    photoFallback: 'Zdjęcie',
    removePhoto: 'Usuń zdjęcie',
  },
})
