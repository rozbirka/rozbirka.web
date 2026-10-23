import { defineMessages } from '@/i18n'
import type { Permission } from '../access-types'

// Every canonical permission needs a title and explanation in every locale.
type PermissionCopy = Record<Permission | `${Permission}.hint`, string>

export const permissionMessages = defineMessages({
  uk: {
    'cars.view': 'Перегляд автомобілів',
    'cars.view.hint': 'Список автомобілів та їхні картки.',
    'cars.manage': 'Керування автомобілями',
    'cars.manage.hint': 'Додавання та зміна даних автомобілів.',
    'parts.view': 'Перегляд запчастин',
    'parts.view.hint': 'Каталог запчастин, ціни та дані деталей.',
    'parts.manage': 'Керування запчастинами',
    'parts.manage.hint': 'Додавання та редагування запчастин.',
    'inventory.view': 'Перегляд складів та інвентаризацій',
    'inventory.view.hint':
      'Склади, місця зберігання, залишки та результати інвентаризацій.',
    'inventory.count': 'Підрахунок запчастин',
    'inventory.count.hint':
      'Сканування й підрахунок деталей під час інвентаризації.',
    'inventory.manage': 'Керування інвентаризаціями',
    'inventory.manage.hint':
      'Створення, запуск, завершення та скасування інвентаризацій.',
    'inventory.adjust': 'Коригування залишків',
    'inventory.adjust.hint':
      'Зміна облікового залишку за результатами інвентаризації.',
    'inventory.zones.manage': 'Керування складами й розміщенням',
    'inventory.zones.manage.hint':
      'Склади, зони, секції, полиці та розміщення запчастин.',
    'orders.view': 'Перегляд замовлень',
    'orders.view.hint': 'Замовлення, їхні позиції, клієнти й статуси.',
    'orders.manage': 'Керування замовленнями',
    'orders.manage.hint':
      'Створення й редагування замовлень та зміна їхніх статусів.',
    'customers.view': 'Перегляд клієнтів',
    'customers.view.hint': 'Список клієнтів, контакти та їхні картки.',
    'customers.manage': 'Керування клієнтами',
    'customers.manage.hint': 'Створення й редагування клієнтів.',
    'finance.view': 'Перегляд фінансів',
    'finance.view.hint': 'Каси, залишки коштів та історія операцій.',
    'finance.manage': 'Керування фінансами',
    'finance.manage.hint':
      'Надходження, витрати, перекази та налаштування кас.',
    'team.view': 'Перегляд команди',
    'team.view.hint': 'Учасники команди, ролі та запрошення.',
    'team.manage': 'Керування командою',
    'team.manage.hint': 'Запрошення учасників, зміна ролей, прав і доступу.',
    'intakes.view': 'Перегляд приймань',
    'intakes.view.hint': 'Партії, дані приймання та прийняті запчастини.',
    'intakes.manage': 'Керування прийманнями',
    'intakes.manage.hint':
      'Створення й редагування приймань та додавання запчастин.',
    'stickers.manage': 'Друк стікерів',
    'stickers.manage.hint': 'Формування та друк стікерів для запчастин.',
    'reports.view': 'Перегляд звітів',
    'reports.view.hint': 'Перегляд готових звітів і завантаження PDF.',
    'reports.manage': 'Створення звітів',
    'reports.manage.hint': 'Формування нових звітів за вибраними параметрами.',
    'billing.view': 'Перегляд підписки',
    'billing.view.hint': 'Поточний тариф, ліміти й стан підписки.',
    'billing.manage': 'Керування підпискою',
    'billing.manage.hint': 'Зміна тарифу та керування підпискою.',
  } satisfies PermissionCopy,
  'en-GB': {
    'cars.view': 'View vehicles',
    'cars.view.hint': 'View the vehicle list and vehicle details.',
    'cars.manage': 'Manage vehicles',
    'cars.manage.hint': 'Add vehicles and edit their details.',
    'parts.view': 'View parts',
    'parts.view.hint': 'Browse parts, prices and part details.',
    'parts.manage': 'Manage parts',
    'parts.manage.hint': 'Add parts and edit their details.',
    'inventory.view': 'View warehouses and stocktakes',
    'inventory.view.hint':
      'View warehouses, storage locations, stock levels and stocktake results.',
    'inventory.count': 'Count stock',
    'inventory.count.hint': 'Scan and count parts during a stocktake.',
    'inventory.manage': 'Manage stocktakes',
    'inventory.manage.hint': 'Create, start, complete and cancel stocktakes.',
    'inventory.adjust': 'Adjust stock levels',
    'inventory.adjust.hint':
      'Apply stock adjustments based on stocktake results.',
    'inventory.zones.manage': 'Manage warehouses and locations',
    'inventory.zones.manage.hint':
      'Manage warehouses, zones, sections, shelves and part locations.',
    'orders.view': 'View orders',
    'orders.view.hint': 'View orders, their items, customers and statuses.',
    'orders.manage': 'Manage orders',
    'orders.manage.hint': 'Create and edit orders and change their statuses.',
    'customers.view': 'View customers',
    'customers.view.hint':
      'View the customer list, contact details and customer records.',
    'customers.manage': 'Manage customers',
    'customers.manage.hint': 'Create and edit customer records.',
    'finance.view': 'View finances',
    'finance.view.hint':
      'View cash accounts, balances and transaction history.',
    'finance.manage': 'Manage finances',
    'finance.manage.hint':
      'Record income, expenses and transfers and manage cash accounts.',
    'team.view': 'View the team',
    'team.view.hint': 'View team members, roles and invitations.',
    'team.manage': 'Manage the team',
    'team.manage.hint':
      'Invite members and change roles, permissions and access.',
    'intakes.view': 'View intakes',
    'intakes.view.hint': 'View batches, intake details and received parts.',
    'intakes.manage': 'Manage intakes',
    'intakes.manage.hint': 'Create and edit intakes and add received parts.',
    'stickers.manage': 'Print stickers',
    'stickers.manage.hint': 'Generate and print stickers for parts.',
    'reports.view': 'View reports',
    'reports.view.hint': 'View completed reports and download PDF files.',
    'reports.manage': 'Create reports',
    'reports.manage.hint': 'Generate new reports using the selected options.',
    'billing.view': 'View the subscription',
    'billing.view.hint':
      'View the current plan, limits and subscription status.',
    'billing.manage': 'Manage the subscription',
    'billing.manage.hint': 'Change the plan and manage the subscription.',
  } satisfies PermissionCopy,
  pl: {
    'cars.view': 'Przeglądanie aut',
    'cars.view.hint': 'Lista aut i ich karty.',
    'cars.manage': 'Zarządzanie autami',
    'cars.manage.hint': 'Dodawanie aut i edycja ich danych.',
    'parts.view': 'Przeglądanie części',
    'parts.view.hint': 'Katalog części, ceny i dane części.',
    'parts.manage': 'Zarządzanie częściami',
    'parts.manage.hint': 'Dodawanie części i edycja ich danych.',
    'inventory.view': 'Przeglądanie magazynów i inwentaryzacji',
    'inventory.view.hint':
      'Magazyny, miejsca składowania, stany i wyniki inwentaryzacji.',
    'inventory.count': 'Liczenie części',
    'inventory.count.hint':
      'Skanowanie i liczenie części podczas inwentaryzacji.',
    'inventory.manage': 'Zarządzanie inwentaryzacjami',
    'inventory.manage.hint':
      'Tworzenie, rozpoczynanie, kończenie i anulowanie inwentaryzacji.',
    'inventory.adjust': 'Korygowanie stanów',
    'inventory.adjust.hint':
      'Korekta stanów magazynowych na podstawie wyników inwentaryzacji.',
    'inventory.zones.manage': 'Zarządzanie magazynami i rozmieszczeniem',
    'inventory.zones.manage.hint':
      'Magazyny, strefy, sekcje, półki i rozmieszczenie części.',
    'orders.view': 'Przeglądanie zamówień',
    'orders.view.hint': 'Zamówienia, ich pozycje, klienci i statusy.',
    'orders.manage': 'Zarządzanie zamówieniami',
    'orders.manage.hint':
      'Tworzenie i edycja zamówień oraz zmiana ich statusów.',
    'customers.view': 'Przeglądanie klientów',
    'customers.view.hint': 'Lista klientów, dane kontaktowe i karty klientów.',
    'customers.manage': 'Zarządzanie klientami',
    'customers.manage.hint': 'Tworzenie i edycja kart klientów.',
    'finance.view': 'Przeglądanie finansów',
    'finance.view.hint': 'Kasy, salda i historia operacji.',
    'finance.manage': 'Zarządzanie finansami',
    'finance.manage.hint': 'Wpływy, wydatki, przelewy i ustawienia kas.',
    'team.view': 'Przeglądanie zespołu',
    'team.view.hint': 'Członkowie zespołu, role i zaproszenia.',
    'team.manage': 'Zarządzanie zespołem',
    'team.manage.hint':
      'Zapraszanie członków oraz zmiana ról, uprawnień i dostępu.',
    'intakes.view': 'Przeglądanie przyjęć',
    'intakes.view.hint': 'Partie, dane przyjęcia i przyjęte części.',
    'intakes.manage': 'Zarządzanie przyjęciami',
    'intakes.manage.hint': 'Tworzenie i edycja przyjęć oraz dodawanie części.',
    'stickers.manage': 'Drukowanie naklejek',
    'stickers.manage.hint': 'Generowanie i drukowanie naklejek na części.',
    'reports.view': 'Przeglądanie raportów',
    'reports.view.hint':
      'Przeglądanie gotowych raportów i pobieranie plików PDF.',
    'reports.manage': 'Tworzenie raportów',
    'reports.manage.hint':
      'Generowanie nowych raportów według wybranych parametrów.',
    'billing.view': 'Przeglądanie subskrypcji',
    'billing.view.hint': 'Aktualny plan, limity i stan subskrypcji.',
    'billing.manage': 'Zarządzanie subskrypcją',
    'billing.manage.hint': 'Zmiana planu i zarządzanie subskrypcją.',
  } satisfies PermissionCopy,
})
