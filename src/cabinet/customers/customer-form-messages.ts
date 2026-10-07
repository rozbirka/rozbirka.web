import { defineMessages } from '@/i18n'

/**
 * Customer create/edit form: contact, international phone, optional address
 * (REQ-LOCALIZATION AC-20/AC-31/AC-34/AC-35). The phone texts are shared with
 * the customer picker inside an order.
 */
export const customerFormMessages = defineMessages({
  uk: {
    titleNew: 'Новий клієнт',
    titleEdit: 'Редагувати клієнта',
    eyebrow: 'Продажі · Клієнти',
    descriptionNew: 'Додайте контактні дані та нотатки клієнта.',
    descriptionEdit:
      'Зміни побачить уся команда в картці клієнта та замовленнях.',
    requiredNote: 'Зірочкою позначено обов’язкове поле',
    saveChanges: 'Зберегти зміни',
    createCustomer: 'Створити клієнта',
    saved: 'Зміни збережено',
    created: 'Клієнта створено',
    activated: 'Клієнта активовано',
    loadError: 'Не вдалося завантажити дані. Спробуйте ще раз.',
    loadFailedTitle: 'Не вдалося завантажити клієнта',
    loading: 'Завантажуємо клієнта…',
    deniedTitle: 'Потрібен доступ до замовлень.',
    deniedDescription:
      'Картку клієнта не відкрити без його замовлень, тож потрібен доступ до розділу «Замовлення». Попросіть власника кабінету відкрити його.',
    accessLost:
      'Права на зміну клієнтів більше немає. Оновіть сторінку або попросіть власника кабінету відкрити доступ.',
    readOnly:
      'Дані можна переглянути, але не змінити. Щоб редагувати клієнтів, попросіть власника кабінету відкрити доступ.',

    contactTitle: 'Контакт',
    contactDescription:
      'Ім’я показуємо в списку клієнтів і в замовленнях, телефон — для дзвінка та пошуку.',
    name: 'Ім’я',
    nameExample: 'Наприклад: Ірина Коваль або СТО «Пітстоп»',
    nameMissing:
      'Введіть ім’я клієнта — за ним ви знайдете його в списку й у замовленнях. Наприклад: Ірина Коваль або СТО «Пітстоп»',
    phone: 'Телефон',
    phoneHint:
      'Один номер для дзвінка та SMS. Номер з іншої країни вводьте з «+» і кодом країни, наприклад {example}',
    phoneInvalid:
      'Перевірте номер: потрібен міжнародний формат, наприклад {example}',

    addressTitle: 'Адреса',
    addressDescription:
      'Необов’язково. Країна клієнта може відрізнятися від країни розбірки.',
    country: 'Країна',
    countryNotSet: 'Не вказано',
    city: 'Місто',
    street: 'Вулиця',
    building: 'Будинок',
    postcode: 'Поштовий індекс',

    notesTitle: 'Нотатки',
    notesDescription:
      'Домовленості, зручний час для дзвінка, побажання щодо доставки.',
    notes: 'Нотатки',
    notesHint: 'Видно лише вашій команді',

    duplicateHint: 'Відкрийте наявну картку, щоб не заводити другу.',
    useExisting: 'Використати клієнта {name}',
    activateNamed: 'Активувати {name}',
  },
  'en-GB': {
    titleNew: 'New customer',
    titleEdit: 'Edit customer',
    eyebrow: 'Sales · Customers',
    descriptionNew: 'Add the customer’s contact details and notes.',
    descriptionEdit:
      'The whole team will see the changes on the customer card and in orders.',
    requiredNote: 'Fields marked with an asterisk are required',
    saveChanges: 'Save changes',
    createCustomer: 'Create customer',
    saved: 'Changes saved',
    created: 'Customer created',
    activated: 'Customer activated',
    loadError: 'Couldn’t load the data. Please try again.',
    loadFailedTitle: 'Couldn’t load the customer',
    loading: 'Loading customer…',
    deniedTitle: 'Access to orders is required.',
    deniedDescription:
      'The customer card can’t be opened without their orders, so you need access to Orders. Ask the account owner to grant it.',
    accessLost:
      'You no longer have permission to change customers. Refresh the page or ask the account owner for access.',
    readOnly:
      'You can view this data but not change it. To edit customers, ask the account owner for access.',

    contactTitle: 'Contact',
    contactDescription:
      'The name is shown in the customer list and in orders; the phone is for calls and search.',
    name: 'Name',
    nameExample: 'For example: Jane Smith or Pitstop Garage',
    nameMissing:
      'Enter the customer’s name — you’ll find them by it in the list and in orders. For example: Jane Smith or Pitstop Garage',
    phone: 'Phone',
    phoneHint:
      'One number for calls and SMS. Enter a number from another country with “+” and the country code, e.g. {example}',
    phoneInvalid:
      'Check the number: use the international format, e.g. {example}',

    addressTitle: 'Address',
    addressDescription:
      'Optional. The customer’s country can differ from your business’s country.',
    country: 'Country',
    countryNotSet: 'Not set',
    city: 'Town or city',
    street: 'Street',
    building: 'House number',
    postcode: 'Postcode',

    notesTitle: 'Notes',
    notesDescription:
      'Agreements, a convenient time to call, delivery preferences.',
    notes: 'Notes',
    notesHint: 'Visible to your team only',

    duplicateHint: 'Open the existing card instead of creating a second one.',
    useExisting: 'Use customer {name}',
    activateNamed: 'Activate {name}',
  },
  pl: {
    titleNew: 'Nowy klient',
    titleEdit: 'Edytuj klienta',
    eyebrow: 'Sprzedaż · Klienci',
    descriptionNew: 'Dodaj dane kontaktowe i notatki klienta.',
    descriptionEdit:
      'Zmiany zobaczy cały zespół w karcie klienta i w zamówieniach.',
    requiredNote: 'Gwiazdką oznaczono pole obowiązkowe',
    saveChanges: 'Zapisz zmiany',
    createCustomer: 'Utwórz klienta',
    saved: 'Zmiany zapisane',
    created: 'Klient utworzony',
    activated: 'Klient aktywowany',
    loadError: 'Nie udało się wczytać danych. Spróbuj ponownie.',
    loadFailedTitle: 'Nie udało się wczytać klienta',
    loading: 'Wczytujemy klienta…',
    deniedTitle: 'Wymagany dostęp do zamówień.',
    deniedDescription:
      'Karty klienta nie da się otworzyć bez jego zamówień, dlatego potrzebny jest dostęp do sekcji „Zamówienia”. Poproś właściciela konta o dostęp.',
    accessLost:
      'Nie masz już uprawnień do zmiany klientów. Odśwież stronę lub poproś właściciela konta o dostęp.',
    readOnly:
      'Możesz przeglądać dane, ale nie możesz ich zmieniać. Aby edytować klientów, poproś właściciela konta o dostęp.',

    contactTitle: 'Kontakt',
    contactDescription:
      'Imię widać na liście klientów i w zamówieniach, telefon służy do połączeń i wyszukiwania.',
    name: 'Imię i nazwisko',
    nameExample: 'Na przykład: Anna Kowalska lub Warsztat „Pitstop”',
    nameMissing:
      'Wpisz imię klienta — po nim znajdziesz go na liście i w zamówieniach. Na przykład: Anna Kowalska lub Warsztat „Pitstop”',
    phone: 'Telefon',
    phoneHint:
      'Jeden numer do połączeń i SMS. Numer z innego kraju wpisz z „+” i kodem kraju, np. {example}',
    phoneInvalid:
      'Sprawdź numer: potrzebny jest format międzynarodowy, np. {example}',

    addressTitle: 'Adres',
    addressDescription:
      'Opcjonalnie. Kraj klienta może się różnić od kraju firmy.',
    country: 'Kraj',
    countryNotSet: 'Nie podano',
    city: 'Miejscowość',
    street: 'Ulica',
    building: 'Numer domu',
    postcode: 'Kod pocztowy',

    notesTitle: 'Notatki',
    notesDescription:
      'Ustalenia, dogodna pora na telefon, życzenia dotyczące dostawy.',
    notes: 'Notatki',
    notesHint: 'Widoczne tylko dla Twojego zespołu',

    duplicateHint: 'Otwórz istniejącą kartę, aby nie tworzyć drugiej.',
    useExisting: 'Użyj klienta {name}',
    activateNamed: 'Aktywuj {name}',
  },
})
