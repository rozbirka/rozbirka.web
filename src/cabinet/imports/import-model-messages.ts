import { defineMessages } from '@/i18n'

/** Import schema field ids (`ImportField.id`) as a person reads them. */
export const importFieldMessages = defineMessages({
  uk: {
    Name: 'Назва',
    Quantity: 'Кількість',
    DesiredSalePrice: 'Ціна за одиницю',
    ExternalCode: 'Артикул',
    OemCode: 'OEM-код',
    PartType: 'Тип деталі',
    Unit: 'Одиниця виміру',
    Notes: 'Примітка',
    Condition: 'Стан',
    SourceType: 'Походження',
    CarId: 'Автомобіль',
    IntakeId: 'Партія',
    InventoryZoneId: 'Складська зона',
    EquipmentTypeId: 'Тип техніки',
    MakeId: 'Марка',
    ModelId: 'Модель',
    GenerationId: 'Покоління',
    YearFrom: 'Рік від',
    YearTo: 'Рік до',
    CarBrand: 'Марка (текст)',
    CarModel: 'Модель (текст)',
    Strategy: 'Сценарій',
    CustomerId: 'Клієнт',
    ReserveQuantity: 'Кількість у резерві',
    ReservePrice: 'Ціна резерву',
    OrderNotes: 'Примітка замовлення',
    OrderGroupKey: 'Група замовлення',
    PhotoKeys: 'Підготовлені фото',
  },
  'en-GB': {
    Name: 'Name',
    Quantity: 'Quantity',
    DesiredSalePrice: 'Unit price',
    ExternalCode: 'Part number',
    OemCode: 'OEM code',
    PartType: 'Part type',
    Unit: 'Unit of measure',
    Notes: 'Note',
    Condition: 'Condition',
    SourceType: 'Origin',
    CarId: 'Car',
    IntakeId: 'Intake',
    InventoryZoneId: 'Storage zone',
    EquipmentTypeId: 'Vehicle type',
    MakeId: 'Make',
    ModelId: 'Model',
    GenerationId: 'Generation',
    YearFrom: 'Year from',
    YearTo: 'Year to',
    CarBrand: 'Make (text)',
    CarModel: 'Model (text)',
    Strategy: 'Scenario',
    CustomerId: 'Customer',
    ReserveQuantity: 'Reserved quantity',
    ReservePrice: 'Reservation price',
    OrderNotes: 'Order note',
    OrderGroupKey: 'Order group',
    PhotoKeys: 'Prepared photos',
  },
  pl: {
    Name: 'Nazwa',
    Quantity: 'Ilość',
    DesiredSalePrice: 'Cena jednostkowa',
    ExternalCode: 'Numer katalogowy',
    OemCode: 'Kod OEM',
    PartType: 'Typ części',
    Unit: 'Jednostka miary',
    Notes: 'Uwagi',
    Condition: 'Stan',
    SourceType: 'Pochodzenie',
    CarId: 'Auto',
    IntakeId: 'Przyjęcie',
    InventoryZoneId: 'Strefa magazynowa',
    EquipmentTypeId: 'Rodzaj pojazdu',
    MakeId: 'Marka',
    ModelId: 'Model',
    GenerationId: 'Generacja',
    YearFrom: 'Rok od',
    YearTo: 'Rok do',
    CarBrand: 'Marka (tekst)',
    CarModel: 'Model (tekst)',
    Strategy: 'Scenariusz',
    CustomerId: 'Klient',
    ReserveQuantity: 'Ilość w rezerwacji',
    ReservePrice: 'Cena rezerwacji',
    OrderNotes: 'Uwagi do zamówienia',
    OrderGroupKey: 'Grupa zamówienia',
    PhotoKeys: 'Przygotowane zdjęcia',
  },
})

/** Allowed constant values (API codes) a person picks from. */
export const importValueMessages = defineMessages({
  uk: {
    Available: 'Доступні',
    Reserved: 'Резерв',
    car: 'З автомобіля',
    batch: 'З партії',
    good: 'Добрий',
    fair: 'Задовільний',
    scrap: 'На утилізацію',
    new: 'Новий',
    refurbished: 'Відновлений',
  },
  'en-GB': {
    Available: 'Available',
    Reserved: 'Reserved',
    car: 'From a car',
    batch: 'From an intake',
    good: 'Good',
    fair: 'Fair',
    scrap: 'For scrap',
    new: 'New',
    refurbished: 'Refurbished',
  },
  pl: {
    Available: 'Dostępne',
    Reserved: 'Rezerwacja',
    car: 'Z auta',
    batch: 'Z przyjęcia',
    good: 'Dobry',
    fair: 'Zadowalający',
    scrap: 'Do utylizacji',
    new: 'Nowy',
    refurbished: 'Regenerowany',
  },
})

/** Import record statuses. */
export const importStatusMessages = defineMessages({
  uk: {
    Uploading: 'Завантаження',
    Uploaded: 'Аналіз',
    Analyzing: 'Аналіз',
    NeedsReview: 'Підготовка',
    Ready: 'Готовий до запуску',
    Queued: 'У черзі',
    Running: 'Виконується',
    CancelRequested: 'Зупиняється',
    Cancelled: 'Скасовано',
    Completed: 'Завершено',
    CompletedWithErrors: 'Частково завершено',
    Failed: 'Помилка',
    Expired: 'Строк минув',
  },
  'en-GB': {
    Uploading: 'Uploading',
    Uploaded: 'Analysing',
    Analyzing: 'Analysing',
    NeedsReview: 'Preparing',
    Ready: 'Ready to run',
    Queued: 'Queued',
    Running: 'Running',
    CancelRequested: 'Stopping',
    Cancelled: 'Cancelled',
    Completed: 'Completed',
    CompletedWithErrors: 'Partly completed',
    Failed: 'Failed',
    Expired: 'Expired',
  },
  pl: {
    Uploading: 'Przesyłanie',
    Uploaded: 'Analiza',
    Analyzing: 'Analiza',
    NeedsReview: 'Przygotowanie',
    Ready: 'Gotowy do uruchomienia',
    Queued: 'W kolejce',
    Running: 'W toku',
    CancelRequested: 'Zatrzymywanie',
    Cancelled: 'Anulowano',
    Completed: 'Zakończono',
    CompletedWithErrors: 'Częściowo zakończono',
    Failed: 'Błąd',
    Expired: 'Wygasł',
  },
})

/** Error and warning codes the import API returns. */
export const importIssueMessages = defineMessages({
  uk: {
    SHEET_SELECTION: 'Оберіть аркуш і прочитайте файл ще раз.',
    HIDDEN_ROWS:
      'Файл містить приховані рядки. Перевірте, чи потрібно їх імпортувати.',
    HIDDEN_COLUMNS:
      'Файл містить приховані колонки. Перевірте, чи потрібно їх імпортувати.',
    HEADER_UNUSABLE:
      'Рядок заголовків містить формули або помилки. Оберіть інший рядок.',
    INTEGER: 'Потрібне ціле число',
    DECIMAL: 'Вкажіть точну числову ціну',
    ENUM: 'Оберіть допустиме значення',
    UNACCOUNTED_COLUMN: 'Зіставте або виключіть колонку',
    COMPATIBILITY_REQUIRED: 'Вкажіть сумісність',
    REQUIRED: 'Обов’язкове поле',
    INVALID_INTEGER: 'Кількість має бути цілим числом',
    INVALID_NUMBER: 'Некоректне число',
    DUPLICATE_DECISION_REQUIRED: 'Можливий дублікат',
    REFERENCE_NOT_FOUND: 'Значення недоступне',
    FORBIDDEN: 'Недостатньо прав',
    STALE_REVISION: 'Дані змінилися. Оновіть імпорт і повторіть перевірку.',
    CONFIRMATION_STALE: 'Підтвердження застаріло. Перевірте дані ще раз.',
    STALE_PREVIEW: 'Перегляд застарів. Оновіть імпорт.',
    FEATURE_DISABLED:
      'Імпорт зараз недоступний для цієї розбірки. Історія та результати збережені.',
    IMPORT_DISABLED: 'Імпорт поки недоступний.',
    EXPIRED: 'Строк зберігання минув.',
    FILE_LIMIT: 'Файл перевищує дозволений розмір.',
    IMPORT_SOURCE_UNAVAILABLE: 'Вихідний файл недоступний для завантаження.',
    IMPORT_EXPIRED: 'Строк зберігання файлу минув.',
    SCHEMA_CHANGED:
      'Правила імпорту змінилися. Перевірте налаштування й збережіть їх повторно.',
    PROFILE_SCHEMA_CHANGED:
      'Профіль збережено до зміни правил джерела. Зіставте колонки вручну та збережіть профіль заново.',
    PART_SOURCE_ARCHIVED:
      'Автомобіль в архіві — нові деталі до нього не додаються. Уже створені деталі збережено.',
    IMPORT_SOURCE_REQUIRED:
      'Не вибрано джерело імпорту. Оберіть автомобіль, партію або назву нової партії.',
    IMPORT_SOURCE_OVERRIDE:
      'Рядки файлу вказують інше джерело. Усі деталі імпорту мають належати одному джерелу — перевірте налаштування.',
    INVALID_PART_SOURCE_TYPE:
      'Деталь без автомобіля чи партії створити не можна. Перевірте джерело імпорту.',
    SOURCE_HAS_PARTS:
      'Джерело не можна видалити, доки до нього прив’язані деталі.',
  },
  'en-GB': {
    SHEET_SELECTION: 'Choose a sheet and read the file again.',
    HIDDEN_ROWS:
      'The file has hidden rows. Check whether they should be imported.',
    HIDDEN_COLUMNS:
      'The file has hidden columns. Check whether they should be imported.',
    HEADER_UNUSABLE:
      'The header row contains formulas or errors. Choose another row.',
    INTEGER: 'A whole number is required',
    DECIMAL: 'Enter an exact numeric price',
    ENUM: 'Choose an allowed value',
    UNACCOUNTED_COLUMN: 'Map or exclude this column',
    COMPATIBILITY_REQUIRED: 'Specify compatibility',
    REQUIRED: 'Required field',
    INVALID_INTEGER: 'Quantity must be a whole number',
    INVALID_NUMBER: 'Invalid number',
    DUPLICATE_DECISION_REQUIRED: 'Possible duplicate',
    REFERENCE_NOT_FOUND: 'Value not available',
    FORBIDDEN: 'Not enough permissions',
    STALE_REVISION: 'The data has changed. Refresh the import and check again.',
    CONFIRMATION_STALE:
      'The confirmation is out of date. Check the data again.',
    STALE_PREVIEW: 'The preview is out of date. Refresh the import.',
    FEATURE_DISABLED:
      'Import is currently unavailable for this business. History and results are kept.',
    IMPORT_DISABLED: 'Import is not available yet.',
    EXPIRED: 'The retention period has ended.',
    FILE_LIMIT: 'The file is larger than allowed.',
    IMPORT_SOURCE_UNAVAILABLE:
      'The original file is not available to download.',
    IMPORT_EXPIRED: 'The file’s retention period has ended.',
    SCHEMA_CHANGED:
      'The import rules have changed. Check the settings and save them again.',
    PROFILE_SCHEMA_CHANGED:
      'This profile was saved before the source rules changed. Map the columns manually and save the profile again.',
    PART_SOURCE_ARCHIVED:
      'The car is archived — new parts can’t be added to it. Parts already created are kept.',
    IMPORT_SOURCE_REQUIRED:
      'No import source selected. Choose a car, an intake or a name for a new intake.',
    IMPORT_SOURCE_OVERRIDE:
      'Rows in the file point to a different source. All parts in an import must belong to one source — check the settings.',
    INVALID_PART_SOURCE_TYPE:
      'A part can’t be created without a car or intake. Check the import source.',
    SOURCE_HAS_PARTS:
      'The source can’t be deleted while parts are linked to it.',
  },
  pl: {
    SHEET_SELECTION: 'Wybierz arkusz i wczytaj plik ponownie.',
    HIDDEN_ROWS:
      'Plik zawiera ukryte wiersze. Sprawdź, czy trzeba je zaimportować.',
    HIDDEN_COLUMNS:
      'Plik zawiera ukryte kolumny. Sprawdź, czy trzeba je zaimportować.',
    HEADER_UNUSABLE:
      'Wiersz nagłówków zawiera formuły lub błędy. Wybierz inny wiersz.',
    INTEGER: 'Wymagana liczba całkowita',
    DECIMAL: 'Podaj dokładną cenę liczbową',
    ENUM: 'Wybierz dozwoloną wartość',
    UNACCOUNTED_COLUMN: 'Przypisz lub wyklucz kolumnę',
    COMPATIBILITY_REQUIRED: 'Podaj kompatybilność',
    REQUIRED: 'Pole wymagane',
    INVALID_INTEGER: 'Ilość musi być liczbą całkowitą',
    INVALID_NUMBER: 'Nieprawidłowa liczba',
    DUPLICATE_DECISION_REQUIRED: 'Możliwy duplikat',
    REFERENCE_NOT_FOUND: 'Wartość niedostępna',
    FORBIDDEN: 'Brak uprawnień',
    STALE_REVISION:
      'Dane się zmieniły. Odśwież import i sprawdź dane ponownie.',
    CONFIRMATION_STALE:
      'Potwierdzenie jest nieaktualne. Sprawdź dane ponownie.',
    STALE_PREVIEW: 'Podgląd jest nieaktualny. Odśwież import.',
    FEATURE_DISABLED:
      'Import jest obecnie niedostępny dla tej firmy. Historia i wyniki są zachowane.',
    IMPORT_DISABLED: 'Import nie jest jeszcze dostępny.',
    EXPIRED: 'Okres przechowywania minął.',
    FILE_LIMIT: 'Plik przekracza dozwolony rozmiar.',
    IMPORT_SOURCE_UNAVAILABLE: 'Pliku źródłowego nie można pobrać.',
    IMPORT_EXPIRED: 'Okres przechowywania pliku minął.',
    SCHEMA_CHANGED:
      'Reguły importu się zmieniły. Sprawdź ustawienia i zapisz je ponownie.',
    PROFILE_SCHEMA_CHANGED:
      'Profil zapisano przed zmianą reguł źródła. Przypisz kolumny ręcznie i zapisz profil ponownie.',
    PART_SOURCE_ARCHIVED:
      'Auto jest w archiwum — nie można dodawać do niego nowych części. Już utworzone części zostają.',
    IMPORT_SOURCE_REQUIRED:
      'Nie wybrano źródła importu. Wybierz auto, przyjęcie lub nazwę nowego przyjęcia.',
    IMPORT_SOURCE_OVERRIDE:
      'Wiersze pliku wskazują inne źródło. Wszystkie części importu muszą należeć do jednego źródła — sprawdź ustawienia.',
    INVALID_PART_SOURCE_TYPE:
      'Nie można utworzyć części bez auta lub przyjęcia. Sprawdź źródło importu.',
    SOURCE_HAS_PARTS:
      'Nie można usunąć źródła, dopóki są do niego przypisane części.',
  },
})

/** Text the import model produces on its own. */
export const importModelMessages = defineMessages({
  uk: {
    unknownIssue: 'Потребує перевірки ({code})',
    defaultBatchName: 'Імпорт запчастин',
  },
  'en-GB': {
    unknownIssue: 'Needs checking ({code})',
    defaultBatchName: 'Parts import',
  },
  pl: {
    unknownIssue: 'Wymaga sprawdzenia ({code})',
    defaultBatchName: 'Import części',
  },
})
