import type { ComponentType } from 'react'
import type { CabinetModuleScreenProps } from './ModuleBoundary'
import {
  BadgeDollarSign,
  Building2,
  Car,
  ChartColumn,
  CircleUser,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Package,
  Plug,
  ReceiptText,
  ScanLine,
  Sticker,
  UserRoundCog,
  Users,
  WalletCards,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import {
  FEATURES,
  type BillingState,
  type FeatureCode,
  type PlanUsageDto,
} from '../api/types'
import type { Permission, ModulePermission } from './access-types'

export type CabinetModuleKey =
  | 'dashboard'
  | 'cars'
  | 'parts'
  | 'warehouses'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'cash'
  | 'team'
  | 'intakes'
  | 'stickers'
  | 'reports'
  | 'billing'
  | 'plans'
  | 'payments'
  | 'profile'
  | 'business'
  | 'integrations'

export type QuotaResource = keyof PlanUsageDto

/** Sections of the cabinet sidebar, in the order the work actually happens. */
export type CabinetNavigationGroup =
  | 'overview'
  | 'stock'
  | 'sales'
  | 'money'
  | 'settings'

export interface CabinetNavigationItem {
  /**
   * Ukrainian source name, kept for existing callers. Screens show
   * `moduleLabel(key, locale)` from `./module-messages`, which is localized.
   */
  label: string
  icon: LucideIcon
  /**
   * `nested` pages stay reachable (routes, Cmd+K) but live inside another
   * module's tabs, not in the sidebar — v2 puts Тарифи and Платежі under
   * Підписка.
   */
  placement: 'primary' | 'account' | 'nested'
  group: CabinetNavigationGroup
  /**
   * Order in the mobile tab bar, lowest first; the first few fit, the rest move
   * under "Ще". Registry order is not usage order, so this is explicit.
   */
  mobilePriority?: number
}

export interface CabinetModuleDefinition {
  key: CabinetModuleKey
  routeSegment: string
  viewPermission?: Permission | ModulePermission
  mutationPermission?: Permission | ModulePermission
  requiredFeature?: FeatureCode
  allowedSubscriptionStates?: readonly BillingState[]
  quotaResource?: QuotaResource
  navigation?: CabinetNavigationItem
}

const BUSINESS_SUBSCRIPTION_STATES = [
  'trial',
  'active',
  'pastDue',
  'cancelled',
] as const satisfies readonly BillingState[]

export const cabinetModules: Readonly<
  Record<CabinetModuleKey, CabinetModuleDefinition>
> = {
  dashboard: {
    key: 'dashboard',
    routeSegment: '/dashboard',
    navigation: {
      label: 'Головна',
      icon: LayoutDashboard,
      placement: 'primary',
      group: 'overview',
      mobilePriority: 1,
    },
  },
  cars: {
    key: 'cars',
    routeSegment: '/cars',
    viewPermission: 'cars.view',
    mutationPermission: 'cars.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    quotaResource: 'cars',
    navigation: {
      label: 'Автомобілі',
      icon: Car,
      placement: 'primary',
      group: 'stock',
      mobilePriority: 5,
    },
  },
  parts: {
    key: 'parts',
    routeSegment: '/parts',
    viewPermission: 'parts.view',
    mutationPermission: 'parts.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    quotaResource: 'parts',
    navigation: {
      label: 'Запчастини',
      icon: Package,
      placement: 'primary',
      group: 'stock',
      mobilePriority: 2,
    },
  },
  warehouses: {
    key: 'warehouses',
    routeSegment: '/warehouses',
    viewPermission: 'inventory.view',
    mutationPermission: 'inventory.zones.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    navigation: {
      label: 'Склади',
      icon: Warehouse,
      placement: 'primary',
      group: 'stock',
      mobilePriority: 7,
    },
  },
  inventory: {
    key: 'inventory',
    routeSegment: '/inventory',
    viewPermission: 'inventory.view',
    mutationPermission: 'inventory.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    navigation: {
      label: 'Інвентаризація',
      icon: ClipboardCheck,
      placement: 'primary',
      group: 'stock',
      mobilePriority: 8,
    },
  },
  orders: {
    key: 'orders',
    routeSegment: '/orders',
    viewPermission: 'orders.view',
    mutationPermission: 'orders.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    navigation: {
      label: 'Замовлення',
      icon: ClipboardList,
      placement: 'primary',
      group: 'sales',
      mobilePriority: 3,
    },
  },
  customers: {
    key: 'customers',
    routeSegment: '/customers',
    viewPermission: 'customers.view',
    mutationPermission: 'customers.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    navigation: {
      label: 'Клієнти',
      icon: Users,
      placement: 'primary',
      group: 'sales',
      mobilePriority: 8,
    },
  },
  cash: {
    key: 'cash',
    routeSegment: '/cash',
    viewPermission: 'finance.view',
    mutationPermission: 'finance.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    quotaResource: 'cashRegisters',
    navigation: {
      label: 'Фінанси',
      icon: WalletCards,
      placement: 'primary',
      group: 'money',
      mobilePriority: 4,
    },
  },
  team: {
    key: 'team',
    routeSegment: '/team',
    viewPermission: 'team.view',
    mutationPermission: 'team.manage',
    requiredFeature: FEATURES.TeamCollaboration,
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    quotaResource: 'users',
    navigation: {
      label: 'Команда',
      icon: UserRoundCog,
      placement: 'account',
      group: 'settings',
    },
  },
  intakes: {
    key: 'intakes',
    routeSegment: '/intakes',
    viewPermission: 'intakes.view',
    mutationPermission: 'intakes.manage',
    requiredFeature: FEATURES.IntakeManagement,
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    quotaResource: 'intakes',
    navigation: {
      label: 'Приймання',
      icon: ScanLine,
      placement: 'primary',
      group: 'stock',
      mobilePriority: 6,
    },
  },
  stickers: {
    key: 'stickers',
    routeSegment: '/stickers',
    viewPermission: 'parts.view',
    mutationPermission: 'stickers.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    navigation: {
      label: 'Стікери',
      icon: Sticker,
      placement: 'primary',
      group: 'stock',
      mobilePriority: 7,
    },
  },
  reports: {
    key: 'reports',
    routeSegment: '/reports',
    viewPermission: 'reports.view',
    mutationPermission: 'reports.manage',
    requiredFeature: FEATURES.AdvancedReports,
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    navigation: {
      label: 'Звіти',
      icon: ChartColumn,
      placement: 'primary',
      group: 'money',
      mobilePriority: 9,
    },
  },
  billing: {
    key: 'billing',
    routeSegment: '/settings/billing/overview',
    viewPermission: 'billing.view',
    mutationPermission: 'billing.manage',
    navigation: {
      label: 'Підписка',
      group: 'settings',
      icon: CreditCard,
      placement: 'account',
    },
  },
  plans: {
    key: 'plans',
    routeSegment: '/settings/billing/plans',
    viewPermission: 'billing.view',
    mutationPermission: 'billing.manage',
    navigation: {
      label: 'Тарифи',
      group: 'settings',
      icon: BadgeDollarSign,
      placement: 'nested',
    },
  },
  payments: {
    key: 'payments',
    routeSegment: '/settings/billing/payments',
    viewPermission: 'billing.view',
    mutationPermission: 'billing.manage',
    navigation: {
      label: 'Платежі',
      group: 'settings',
      icon: ReceiptText,
      placement: 'nested',
    },
  },
  integrations: {
    key: 'integrations',
    routeSegment: '/settings/integrations',
    // Core demands team.manage even to list integrations: a stored API key is
    // a key to someone else's account, not a read-only setting.
    viewPermission: 'team.manage',
    mutationPermission: 'team.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    navigation: {
      label: 'Інтеграції',
      group: 'settings',
      icon: Plug,
      placement: 'account',
    },
  },
  business: {
    key: 'business',
    routeSegment: '/settings/business',
    viewPermission: 'team.view',
    mutationPermission: 'team.manage',
    allowedSubscriptionStates: BUSINESS_SUBSCRIPTION_STATES,
    navigation: {
      label: 'Бізнес',
      group: 'settings',
      icon: Building2,
      placement: 'account',
    },
  },
  profile: {
    key: 'profile',
    routeSegment: '/settings/profile',
    navigation: {
      label: 'Профіль',
      group: 'settings',
      icon: CircleUser,
      placement: 'account',
    },
  },
}

export interface FeatureModuleEntry {
  readonly code: string
  readonly labelKey: string
  readonly parentModule: CabinetModuleKey
  readonly loadScreen: () => Promise<{
    default: ComponentType<CabinetModuleScreenProps>
  }>
}

export interface RegisteredFeatureModule extends FeatureModuleEntry {
  readonly viewPermission: `modules.${string}.view`
  readonly mutationPermission: `modules.${string}.manage`
  readonly routeSegment: string
}

export function defineFeatureModules(
  entries: readonly FeatureModuleEntry[],
): readonly RegisteredFeatureModule[] {
  const codes = new Set<string>()
  return Object.freeze(
    entries.map((entry) => {
      if (
        !/^[a-z][a-z0-9-]{0,31}$/.test(entry.code) ||
        codes.has(entry.code) ||
        !Object.hasOwn(cabinetModules, entry.parentModule)
      ) {
        throw new Error('Invalid or duplicate module registration')
      }
      codes.add(entry.code)
      return Object.freeze({
        ...entry,
        viewPermission: `modules.${entry.code}.view` as const,
        mutationPermission: `modules.${entry.code}.manage` as const,
        routeSegment: `/modules/${entry.code}/parts`,
      })
    }),
  )
}

// Explicit, build-time extensions of this registry. Provider implementations register here later.
export const independentModules = defineFeatureModules([])
