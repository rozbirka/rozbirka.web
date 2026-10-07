import { defineMessages } from '@/i18n'

/** Import workspace: header, step rail, destination and screen-level errors. */
export const importScreenMessages = defineMessages({
  uk: {
    checkingAccess: 'Перевіряємо доступ…',
    noAccess: 'Недостатньо прав для імпорту',
    loadingSettings: 'Завантажуємо налаштування імпорту…',
    stepHistory: 'Історія',
    stepFile: 'Файл',
    stepSettings: 'Налаштування',
    stepReview: 'Перевірка',
    stepConfirm: 'Підтвердження',
    stepRun: 'Виконання',
    titleHistory: 'Імпорт запчастин',
    titleFile: 'Завантаження файлу',
    titleSettings: 'Налаштування імпорту',
    titleReview: 'Перевірка даних',
    titleConfirm: 'Підтвердження',
    titleRun: 'Деталі імпорту',
    descriptionHistory: 'Перенесення залишків із власної таблиці CSV або XLSX.',
    descriptionFile:
      'CSV або XLSX до 10 MiB. Перевірте, що система прочитала таблицю правильно.',
    descriptionSettings:
      'Зіставте колонки файлу з полями Розбірки. Спільні значення застосовуються до всіх рядків.',
    descriptionReview:
      'Виберіть рядки для імпорту та вирішіть проблеми. Один рядок із кількістю 5 створює одну позицію з п’ятьма одиницями товару.',
    descriptionConfirm:
      'Це те, що буде створено. Після запуску зміни виконуються у фоні.',
    descriptionRun: 'Стан роботи та результати рядків цього імпорту.',
    descriptionFailed:
      'Файл прочитати не вдалося. Нижче — що саме сталося й що можна зробити.',
    descriptionSending:
      'Файл передається на сервер. Не закривайте вкладку до кінця передавання.',
    descriptionReading:
      'Файл на сервері. Читаємо структуру таблиці — це кілька секунд.',
    archivedCar: 'До архівного автомобіля не можна імпортувати деталі.',
    batchFallback: 'Партія',
    sourceLoadFailed:
      'Не вдалося завантажити джерело. Перевірте доступ і спробуйте ще раз.',
    newBatchLabel: 'Нова партія: {name}',
    loadingSource: 'Завантажуємо джерело…',
    sourceRulesChanged:
      'Правила джерела змінилися. Перевірте одне джерело для всього імпорту та збережіть налаштування повторно.',
    batchNameLength: 'Вкажіть назву партії від 1 до 200 символів.',
    waitForSource: 'Зачекайте, поки завантажиться джерело.',
    wrongFileType: 'Оберіть файл CSV або XLSX.',
    newImport: 'Новий імпорт',
    configureImport: 'Налаштувати імпорт',
    uploadFile: 'Завантажити файл',
    checkData: 'Перевірити дані',
    toConfirmation: 'До підтвердження',
    startImport: 'Почати імпорт',
    toHistory: 'До історії',
    toParts: 'До деталей',
    caption: 'Склад · Імпорт запчастин',
    stepsLabel: 'Кроки імпорту',
    sourceRegion: 'Джерело всього імпорту',
    sourceHeading: 'Одне джерело для всіх деталей',
    sourceUnknown:
      'Джерело цього імпорту не збережено. Якщо файл мав потрапити до автомобіля чи партії, почніть імпорт з їхньої картки. Інакше вкажіть назву нової партії.',
    newBatchName: 'Назва нової партії',
    newBatchHint:
      'Партія буде створена разом із першою деталлю. Постачальник і закупівельна вартість залишаться незаповненими.',
    existingSource: '{label}. Нове джерело не створюватиметься.',
    retry: 'Повторити',
  },
  'en-GB': {
    checkingAccess: 'Checking access…',
    noAccess: 'You don’t have permission to import',
    loadingSettings: 'Loading import settings…',
    stepHistory: 'History',
    stepFile: 'File',
    stepSettings: 'Settings',
    stepReview: 'Review',
    stepConfirm: 'Confirmation',
    stepRun: 'Run',
    titleHistory: 'Parts import',
    titleFile: 'Upload a file',
    titleSettings: 'Import settings',
    titleReview: 'Review data',
    titleConfirm: 'Confirmation',
    titleRun: 'Import details',
    descriptionHistory:
      'Bring stock over from your own CSV or XLSX spreadsheet.',
    descriptionFile:
      'CSV or XLSX up to 10 MiB. Check that the spreadsheet has been read correctly.',
    descriptionSettings:
      'Map the file’s columns to Rozbirka fields. Shared values apply to every row.',
    descriptionReview:
      'Choose the rows to import and resolve any issues. One row with a quantity of 5 creates one item with five units of stock.',
    descriptionConfirm:
      'This is what will be created. Once started, the changes run in the background.',
    descriptionRun: 'Progress and row results for this import.',
    descriptionFailed:
      'The file couldn’t be read. Below is what happened and what you can do.',
    descriptionSending:
      'The file is being sent to the server. Keep this tab open until it finishes.',
    descriptionReading:
      'The file is on the server. Reading the table structure — this takes a few seconds.',
    archivedCar: 'Parts can’t be imported into an archived car.',
    batchFallback: 'Intake',
    sourceLoadFailed:
      'Couldn’t load the source. Check your access and try again.',
    newBatchLabel: 'New intake: {name}',
    loadingSource: 'Loading source…',
    sourceRulesChanged:
      'The source rules have changed. Check the single source for the whole import and save the settings again.',
    batchNameLength: 'Enter an intake name of 1 to 200 characters.',
    waitForSource: 'Wait until the source has loaded.',
    wrongFileType: 'Choose a CSV or XLSX file.',
    newImport: 'New import',
    configureImport: 'Set up import',
    uploadFile: 'Upload file',
    checkData: 'Check data',
    toConfirmation: 'Go to confirmation',
    startImport: 'Start import',
    toHistory: 'Back to history',
    toParts: 'Back to parts',
    caption: 'Stock · Parts import',
    stepsLabel: 'Import steps',
    sourceRegion: 'Source of the whole import',
    sourceHeading: 'One source for all parts',
    sourceUnknown:
      'The source of this import wasn’t saved. If the file was meant for a car or an intake, start the import from its card. Otherwise, enter a name for a new intake.',
    newBatchName: 'New intake name',
    newBatchHint:
      'The intake is created together with the first part. Supplier and purchase cost are left blank.',
    existingSource: '{label}. No new source will be created.',
    retry: 'Retry',
  },
  pl: {
    checkingAccess: 'Sprawdzanie dostępu…',
    noAccess: 'Brak uprawnień do importu',
    loadingSettings: 'Wczytywanie ustawień importu…',
    stepHistory: 'Historia',
    stepFile: 'Plik',
    stepSettings: 'Ustawienia',
    stepReview: 'Sprawdzenie',
    stepConfirm: 'Potwierdzenie',
    stepRun: 'Wykonanie',
    titleHistory: 'Import części',
    titleFile: 'Przesyłanie pliku',
    titleSettings: 'Ustawienia importu',
    titleReview: 'Sprawdzenie danych',
    titleConfirm: 'Potwierdzenie',
    titleRun: 'Szczegóły importu',
    descriptionHistory: 'Przeniesienie stanów z własnej tabeli CSV lub XLSX.',
    descriptionFile:
      'CSV lub XLSX do 10 MiB. Sprawdź, czy system poprawnie odczytał tabelę.',
    descriptionSettings:
      'Przypisz kolumny pliku do pól Rozbirki. Wspólne wartości dotyczą wszystkich wierszy.',
    descriptionReview:
      'Wybierz wiersze do importu i rozwiąż problemy. Jeden wiersz z ilością 5 tworzy jedną pozycję z pięcioma sztukami towaru.',
    descriptionConfirm:
      'Tyle zostanie utworzone. Po uruchomieniu zmiany wykonują się w tle.',
    descriptionRun: 'Stan pracy i wyniki wierszy tego importu.',
    descriptionFailed:
      'Nie udało się odczytać pliku. Poniżej — co się stało i co można zrobić.',
    descriptionSending:
      'Plik jest przesyłany na serwer. Nie zamykaj karty do końca przesyłania.',
    descriptionReading:
      'Plik jest na serwerze. Odczytujemy strukturę tabeli — to potrwa kilka sekund.',
    archivedCar: 'Do zarchiwizowanego auta nie można importować części.',
    batchFallback: 'Przyjęcie',
    sourceLoadFailed:
      'Nie udało się wczytać źródła. Sprawdź dostęp i spróbuj ponownie.',
    newBatchLabel: 'Nowe przyjęcie: {name}',
    loadingSource: 'Wczytywanie źródła…',
    sourceRulesChanged:
      'Reguły źródła się zmieniły. Sprawdź jedno źródło dla całego importu i zapisz ustawienia ponownie.',
    batchNameLength: 'Podaj nazwę przyjęcia od 1 do 200 znaków.',
    waitForSource: 'Poczekaj, aż źródło się wczyta.',
    wrongFileType: 'Wybierz plik CSV lub XLSX.',
    newImport: 'Nowy import',
    configureImport: 'Skonfiguruj import',
    uploadFile: 'Prześlij plik',
    checkData: 'Sprawdź dane',
    toConfirmation: 'Do potwierdzenia',
    startImport: 'Rozpocznij import',
    toHistory: 'Do historii',
    toParts: 'Do części',
    caption: 'Magazyn · Import części',
    stepsLabel: 'Kroki importu',
    sourceRegion: 'Źródło całego importu',
    sourceHeading: 'Jedno źródło dla wszystkich części',
    sourceUnknown:
      'Źródło tego importu nie zostało zapisane. Jeśli plik miał trafić do auta lub przyjęcia, rozpocznij import z ich karty. W przeciwnym razie podaj nazwę nowego przyjęcia.',
    newBatchName: 'Nazwa nowego przyjęcia',
    newBatchHint:
      'Przyjęcie zostanie utworzone razem z pierwszą częścią. Dostawca i koszt zakupu pozostaną puste.',
    existingSource: '{label}. Nowe źródło nie zostanie utworzone.',
    retry: 'Ponów',
  },
})
