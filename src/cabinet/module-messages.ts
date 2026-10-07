import { defineMessages, translate, type Locale } from '@/i18n'
import type {
  CabinetModuleKey,
  CabinetNavigationGroup,
} from './module-registry'

/**
 * Names of cabinet modules and sidebar sections. Keys are the module keys so
 * the registry, navigation, command palette and the access screens share one
 * name per module.
 */
export const moduleMessages = defineMessages({
  uk: {
    dashboard: 'Головна',
    cars: 'Автомобілі',
    parts: 'Запчастини',
    inventory: 'Інвентаризація',
    orders: 'Замовлення',
    customers: 'Клієнти',
    cash: 'Фінанси',
    team: 'Команда',
    intakes: 'Приймання',
    stickers: 'Стікери',
    reports: 'Звіти',
    billing: 'Підписка',
    plans: 'Тарифи',
    payments: 'Платежі',
    profile: 'Профіль',
    integrations: 'Інтеграції',
    business: 'Бізнес',
    'group.stock': 'Склад',
    'group.sales': 'Продажі',
    'group.money': 'Гроші',
    'group.settings': 'Налаштування',
  },
  'en-GB': {
    dashboard: 'Home',
    cars: 'Cars',
    parts: 'Parts',
    inventory: 'Stocktake',
    orders: 'Orders',
    customers: 'Customers',
    cash: 'Finance',
    team: 'Team',
    intakes: 'Intake',
    stickers: 'Labels',
    reports: 'Reports',
    billing: 'Subscription',
    plans: 'Plans',
    payments: 'Payments',
    profile: 'Profile',
    integrations: 'Integrations',
    business: 'Business',
    'group.stock': 'Stock',
    'group.sales': 'Sales',
    'group.money': 'Money',
    'group.settings': 'Settings',
  },
  pl: {
    dashboard: 'Start',
    cars: 'Samochody',
    parts: 'Części',
    inventory: 'Inwentaryzacja',
    orders: 'Zamówienia',
    customers: 'Klienci',
    cash: 'Finanse',
    team: 'Zespół',
    intakes: 'Przyjęcia',
    stickers: 'Etykiety',
    reports: 'Raporty',
    billing: 'Subskrypcja',
    plans: 'Plany',
    payments: 'Płatności',
    profile: 'Profil',
    integrations: 'Integracje',
    business: 'Firma',
    'group.stock': 'Magazyn',
    'group.sales': 'Sprzedaż',
    'group.money': 'Finanse',
    'group.settings': 'Ustawienia',
  },
})

/** Module name in `locale`, e.g. for a page title or a navigation entry. */
export function moduleLabel(module: CabinetModuleKey, locale: Locale): string {
  return translate(moduleMessages, locale, module)
}

/** Sidebar section heading; the overview section has none. */
export function navigationGroupLabel(
  group: CabinetNavigationGroup,
  locale: Locale,
): string | null {
  return group === 'overview'
    ? null
    : translate(moduleMessages, locale, `group.${group}`)
}
