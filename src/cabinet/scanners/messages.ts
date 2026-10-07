import { defineMessages } from '@/i18n'

export const scannerMessages = defineMessages({
  uk: {
    eyebrow: 'Склад',
    title: 'QR-сканер',
    intro:
      'Наведіть камеру на стікер деталі. Дані деталі не показуються до перевірки доступу.',
    checkingInline: 'Перевіряємо код у поточній розбірці…',
    cameraStopped:
      'Камеру зупинено. Введіть код вручну або ввімкніть камеру знову.',
    cameraOn:
      'Камера ввімкнена. Тримайте стікер у рамці, поки код не зчитається.',
    cameraUnsupported:
      'Цей браузер не читає QR із камери. Введіть код зі стікера вручну нижче.',
    imageUnsupported:
      'Цей браузер не читає QR із зображення. Введіть код зі стікера вручну.',
    imageNoCode:
      'На цьому фото QR-коду немає. Сфотографуйте стікер ближче або введіть код вручну.',
    imageFailed:
      'Не вдалося прочитати файл. Виберіть інше фото стікера або введіть код вручну.',
    cameraLabel: 'Камера QR',
    recognisedTitle: 'Код розпізнано',
    recognisedHint:
      'Переконайтеся, що це та сама деталь, яку тримаєте в руках.',
    quantity: '{count} {unit}',
    actionsTitle: 'Що зробити',
    actionsHint: 'Дії виконуються одразу для цієї запчастини.',
    placement: 'Розміщення',
    noPlacement: 'Комірку не вказано',
    move: 'Перемістити',
    sticker: 'Стікер',
    print: 'Надрукувати',
    source: 'Джерело',
    openCar: 'Відкрити авто',
    fullHistory: 'Повна історія',
    movementTitle: 'Рух запчастини',
    noEvents: 'Подій ще немає — вони зʼявляться після першої зміни.',
    recentTitle: 'Попередні скани коду',
    checkingTitle: 'Перевіряємо код…',
    checkingHint:
      'Звіряємо стікер із деталями цієї розбірки. Це займає секунду.',
    notFoundTitle: 'Код не знайдено в цій розбірці',
    notFoundHint:
      'Стікер може належати іншій розбірці, або деталь уже видалено. Звірте код на стікері й спробуйте ще раз.',
    scanAgain: 'Сканувати ще раз',
    cameraDeniedTitle: 'Камера недоступна',
    cameraDeniedHint:
      'Дозвольте доступ до камери в налаштуваннях браузера й увімкніть її ще раз. Поки що введіть код зі стікера вручну або виберіть його фото.',
    readyTitle: 'Готово до сканування',
    readyHint:
      'Увімкніть камеру й наведіть її на QR-стікер деталі. Знайдену деталь покажемо тут — перед тим, як відкривати картку.',
    openPart: 'Відкрити картку деталі',
    scanNext: 'Сканувати наступний код',
    stopCamera: 'Зупинити камеру',
    startCamera: 'Увімкнути камеру',
    frozenHint: 'Зображення завмерло? Увімкніть камеру ще раз.',
    manualTitle: 'Ввести код вручну',
    manualHint: 'Запасний шлях, коли стікер потертий або камера недоступна.',
    codeLabel: 'QR-код',
    codeHint: 'Код зі стікера або посилання виду /scan/…',
    codePlaceholder: 'Напр. QR-123',
    fileLabel: 'Файл QR-коду',
    fileHint: 'Фото стікера з галереї — код розпізнаємо із зображення.',
    filePreview: 'Попередній перегляд {name}',
    findPart: 'Знайти деталь',
    vinUnavailable: 'VIN та OEM-декодування поки недоступні.',
  },
  'en-GB': {
    eyebrow: 'Warehouse',
    title: 'QR scanner',
    intro:
      'Point the camera at a part sticker. Part details stay hidden until access is checked.',
    checkingInline: 'Checking the code in this business…',
    cameraStopped:
      'Camera stopped. Enter the code manually or turn the camera on again.',
    cameraOn: 'Camera on. Keep the sticker in the frame until the code reads.',
    cameraUnsupported:
      'This browser can’t read QR codes from the camera. Enter the sticker code manually below.',
    imageUnsupported:
      'This browser can’t read QR codes from images. Enter the sticker code manually.',
    imageNoCode:
      'There’s no QR code in this photo. Take a closer photo of the sticker or enter the code manually.',
    imageFailed:
      'Couldn’t read the file. Choose another photo of the sticker or enter the code manually.',
    cameraLabel: 'QR camera',
    recognisedTitle: 'Code recognised',
    recognisedHint: 'Make sure this is the part you’re holding.',
    quantity: '{count} {unit}',
    actionsTitle: 'What next',
    actionsHint: 'Actions apply to this part straight away.',
    placement: 'Location',
    noPlacement: 'No bin set',
    move: 'Move',
    sticker: 'Sticker',
    print: 'Print',
    source: 'Source',
    openCar: 'Open vehicle',
    fullHistory: 'Full history',
    movementTitle: 'Part movements',
    noEvents: 'No events yet — they’ll appear after the first change.',
    recentTitle: 'Previous scans',
    checkingTitle: 'Checking code…',
    checkingHint:
      'Matching the sticker against this business’s parts. It takes a second.',
    notFoundTitle: 'Code not found in this business',
    notFoundHint:
      'The sticker may belong to another business, or the part has been deleted. Check the code on the sticker and try again.',
    scanAgain: 'Scan again',
    cameraDeniedTitle: 'Camera unavailable',
    cameraDeniedHint:
      'Allow camera access in your browser settings and turn it on again. Meanwhile, enter the sticker code manually or choose a photo of it.',
    readyTitle: 'Ready to scan',
    readyHint:
      'Turn on the camera and point it at a part’s QR sticker. We’ll show the part here before you open its card.',
    openPart: 'Open part card',
    scanNext: 'Scan next code',
    stopCamera: 'Stop camera',
    startCamera: 'Turn on camera',
    frozenHint: 'Picture frozen? Turn the camera on again.',
    manualTitle: 'Enter code manually',
    manualHint:
      'A fallback when the sticker is worn or the camera is unavailable.',
    codeLabel: 'QR code',
    codeHint: 'The sticker code or a /scan/… link',
    codePlaceholder: 'E.g. QR-123',
    fileLabel: 'QR code file',
    fileHint:
      'A photo of the sticker from your gallery — we’ll read the code from the image.',
    filePreview: 'Preview of {name}',
    findPart: 'Find part',
    vinUnavailable: 'VIN and OEM decoding aren’t available yet.',
  },
  pl: {
    eyebrow: 'Magazyn',
    title: 'Skaner QR',
    intro:
      'Skieruj aparat na naklejkę części. Dane części nie są pokazywane przed sprawdzeniem dostępu.',
    checkingInline: 'Sprawdzamy kod w bieżącej firmie…',
    cameraStopped:
      'Aparat zatrzymany. Wpisz kod ręcznie lub ponownie włącz aparat.',
    cameraOn:
      'Aparat włączony. Trzymaj naklejkę w ramce, aż kod zostanie odczytany.',
    cameraUnsupported:
      'Ta przeglądarka nie odczytuje kodów QR z aparatu. Wpisz kod z naklejki ręcznie poniżej.',
    imageUnsupported:
      'Ta przeglądarka nie odczytuje kodów QR ze zdjęć. Wpisz kod z naklejki ręcznie.',
    imageNoCode:
      'Na tym zdjęciu nie ma kodu QR. Zrób zdjęcie naklejki z bliska lub wpisz kod ręcznie.',
    imageFailed:
      'Nie udało się odczytać pliku. Wybierz inne zdjęcie naklejki lub wpisz kod ręcznie.',
    cameraLabel: 'Aparat QR',
    recognisedTitle: 'Kod rozpoznany',
    recognisedHint: 'Upewnij się, że to ta sama część, którą trzymasz w ręku.',
    quantity: '{count} {unit}',
    actionsTitle: 'Co dalej',
    actionsHint: 'Działania od razu dotyczą tej części.',
    placement: 'Lokalizacja',
    noPlacement: 'Nie podano miejsca',
    move: 'Przenieś',
    sticker: 'Naklejka',
    print: 'Drukuj',
    source: 'Źródło',
    openCar: 'Otwórz pojazd',
    fullHistory: 'Pełna historia',
    movementTitle: 'Ruch części',
    noEvents: 'Brak zdarzeń — pojawią się po pierwszej zmianie.',
    recentTitle: 'Poprzednie skany',
    checkingTitle: 'Sprawdzamy kod…',
    checkingHint:
      'Porównujemy naklejkę z częściami tej firmy. To potrwa sekundę.',
    notFoundTitle: 'Nie znaleziono kodu w tej firmie',
    notFoundHint:
      'Naklejka może należeć do innej firmy albo część została usunięta. Sprawdź kod na naklejce i spróbuj ponownie.',
    scanAgain: 'Skanuj ponownie',
    cameraDeniedTitle: 'Aparat niedostępny',
    cameraDeniedHint:
      'Zezwól na dostęp do aparatu w ustawieniach przeglądarki i włącz go ponownie. Na razie wpisz kod z naklejki ręcznie lub wybierz jej zdjęcie.',
    readyTitle: 'Gotowe do skanowania',
    readyHint:
      'Włącz aparat i skieruj go na naklejkę QR części. Znalezioną część pokażemy tutaj, zanim otworzysz jej kartę.',
    openPart: 'Otwórz kartę części',
    scanNext: 'Skanuj następny kod',
    stopCamera: 'Zatrzymaj aparat',
    startCamera: 'Włącz aparat',
    frozenHint: 'Obraz zamarł? Włącz aparat ponownie.',
    manualTitle: 'Wpisz kod ręcznie',
    manualHint:
      'Rozwiązanie zapasowe, gdy naklejka jest starta lub aparat niedostępny.',
    codeLabel: 'Kod QR',
    codeHint: 'Kod z naklejki lub link w formacie /scan/…',
    codePlaceholder: 'Np. QR-123',
    fileLabel: 'Plik z kodem QR',
    fileHint: 'Zdjęcie naklejki z galerii — odczytamy kod ze zdjęcia.',
    filePreview: 'Podgląd {name}',
    findPart: 'Znajdź część',
    vinUnavailable: 'Dekodowanie VIN i OEM nie jest jeszcze dostępne.',
  },
})
