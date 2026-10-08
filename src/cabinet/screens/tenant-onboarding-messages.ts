import { defineMessages } from '@/i18n'

/** Creating the first yard (ROZ-163/164): name and city, then the dashboard. */
export const tenantOnboardingMessages = defineMessages({
  uk: {
    step: 'Крок 2 з 2',
    title: 'Розкажіть про свій бізнес',
    subtitle:
      'Назву бачить ваша команда й клієнти в документах. Змінити її можна будь-коли в налаштуваннях.',
    nameTooShort: 'Вкажіть назву розбірки — щонайменше 2 символи',
    createFailed: 'Не вдалося створити розбірку. {reason}',
    account: 'Особистий акаунт',
    signOut: 'Вийти',
    nameLabel: 'Назва розбірки',
    nameHint: 'Наприклад: CarDubliany',
    cityLabel: 'Місто (необовʼязково)',
    cityHint:
      'Показуємо в картках запчастин, щоб покупці бачили, звідки доставка.',
    cityPlaceholder: 'Львів',
    retry: 'Спробувати ще раз',
    trial: '14 днів безкоштовно, картка не потрібна',
    creating: 'Створюємо…',
    create: 'Створити розбірку',
  },
  'en-GB': {
    step: 'Step 2 of 2',
    title: 'Tell us about your business',
    subtitle:
      'Your team and customers see the name on documents. You can change it any time in settings.',
    nameTooShort: 'Enter the business name — at least 2 characters',
    createFailed: 'Couldn’t create the business. {reason}',
    account: 'Personal account',
    signOut: 'Sign out',
    nameLabel: 'Business name',
    nameHint: 'For example: Smith Auto Parts',
    cityLabel: 'City (optional)',
    cityHint: 'Shown on part cards so buyers can see where it ships from.',
    cityPlaceholder: 'Manchester',
    retry: 'Try again',
    trial: '14 days free, no card needed',
    creating: 'Creating…',
    create: 'Create business',
  },
  pl: {
    step: 'Krok 2 z 2',
    title: 'Opowiedz nam o swojej firmie',
    subtitle:
      'Nazwę widzą Twój zespół i klienci w dokumentach. Możesz ją zmienić w każdej chwili w ustawieniach.',
    nameTooShort: 'Podaj nazwę firmy — co najmniej 2 znaki',
    createFailed: 'Nie udało się utworzyć firmy. {reason}',
    account: 'Konto osobiste',
    signOut: 'Wyloguj się',
    nameLabel: 'Nazwa firmy',
    nameHint: 'Na przykład: Auto Części Kowalski',
    cityLabel: 'Miasto (opcjonalnie)',
    cityHint:
      'Pokazujemy je na kartach części, aby kupujący widzieli, skąd jest wysyłka.',
    cityPlaceholder: 'Kraków',
    retry: 'Spróbuj ponownie',
    trial: '14 dni za darmo, bez karty',
    creating: 'Tworzenie…',
    create: 'Utwórz firmę',
  },
})
