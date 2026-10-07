import type { PublicPlanDto } from '@/api/types'
import type { PlanCode } from '@/lib/plan-selection'
import { SOURCE_LOCALE, type Locale } from '@/i18n/locales'
import { defineMessages, translate, type MessageKey } from '@/i18n/messages'

export interface LandingPlan {
  code: PlanCode
  name: 'Pro' | 'Enterprise'
  price: string
  period: string
  trialDays: 14
  description: string
  perks: string[]
  ctaLabel: string
  variant: 'pro' | 'enterprise'
}

/** Plan card copy of the public landing (names and prices are not text). */
export const landingPlanMessages = defineMessages({
  uk: {
    period: 'місяць',
    proDescription: 'Все необхідне, щоб масштабувати продажі',
    proPerk1: '20 авто, 2 000 запчастин',
    proPerk2: '5 користувачів, 2 каси',
    proPerk3: 'Партії, звіти та QR-коди',
    proCta: 'Почати 14 днів безкоштовно',
    enterpriseDescription: 'Для розбірок без обмежень каталогу',
    enterprisePerk1: 'Без лімітів на авто та запчастини',
    enterprisePerk2: 'Без лімітів на користувачів і каси',
    enterprisePerk3: 'Партії, звіти, команда та QR-коди',
    enterpriseCta: 'Обрати',
  },
  'en-GB': {
    period: 'month',
    proDescription: 'Everything you need to scale your sales',
    proPerk1: '20 cars, 2,000 parts',
    proPerk2: '5 users, 2 tills',
    proPerk3: 'Batches, reports and QR codes',
    proCta: 'Start 14-day free trial',
    enterpriseDescription: 'For businesses that need an unlimited catalogue',
    enterprisePerk1: 'Unlimited cars and parts',
    enterprisePerk2: 'Unlimited users and tills',
    enterprisePerk3: 'Batches, reports, team and QR codes',
    enterpriseCta: 'Choose',
  },
  pl: {
    period: 'miesiąc',
    proDescription: 'Wszystko, czego potrzebujesz, by zwiększać sprzedaż',
    proPerk1: '20 aut, 2000 części',
    proPerk2: '5 użytkowników, 2 kasy',
    proPerk3: 'Partie, raporty i kody QR',
    proCta: 'Zacznij 14 dni za darmo',
    enterpriseDescription: 'Dla firm bez limitów katalogu',
    enterprisePerk1: 'Bez limitów aut i części',
    enterprisePerk2: 'Bez limitów użytkowników i kas',
    enterprisePerk3: 'Partie, raporty, zespół i kody QR',
    enterpriseCta: 'Wybierz',
  },
})

/** Plans shown when the API catalog is unavailable, in `locale`. */
export function fallbackLandingPlans(
  locale: Locale = SOURCE_LOCALE,
): readonly LandingPlan[] {
  const t = (key: MessageKey<typeof landingPlanMessages>) =>
    translate(landingPlanMessages, locale, key)
  return [
    {
      code: 'pro_monthly',
      name: 'Pro',
      price: '$59',
      period: t('period'),
      trialDays: 14,
      description: t('proDescription'),
      perks: [t('proPerk1'), t('proPerk2'), t('proPerk3')],
      ctaLabel: t('proCta'),
      variant: 'pro',
    },
    {
      code: 'enterprise_monthly',
      name: 'Enterprise',
      price: '$299',
      period: t('period'),
      trialDays: 14,
      description: t('enterpriseDescription'),
      perks: [t('enterprisePerk1'), t('enterprisePerk2'), t('enterprisePerk3')],
      ctaLabel: t('enterpriseCta'),
      variant: 'enterprise',
    },
  ]
}

/** Ukrainian fallback plans (the source copy). */
export const FALLBACK_LANDING_PLANS: readonly LandingPlan[] =
  fallbackLandingPlans(SOURCE_LOCALE)

const order: PlanCode[] = ['pro_monthly', 'enterprise_monthly']

const featureContract = [
  'intake_management',
  'multi_cash_registers',
  'qr_codes',
  'reports.advanced',
  'team_collaboration',
] as const

const contracts = {
  pro_monthly: {
    amount: 59,
    features: featureContract,
    limits: {
      cars: 20,
      intakes: 25,
      parts: 2000,
      users: 5,
      cashRegisters: 2,
      photosPerPart: null,
    },
  },
  enterprise_monthly: {
    amount: 299,
    features: featureContract,
    limits: {
      cars: null,
      intakes: null,
      parts: null,
      users: null,
      cashRegisters: null,
      photosPerPart: null,
    },
  },
} as const

function isPublicPlan(value: unknown): value is PublicPlanDto {
  if (!value || typeof value !== 'object') return false
  const plan = value as Partial<PublicPlanDto>
  return (
    typeof plan.code === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.amount === 'number' &&
    plan.currency === 'USD' &&
    plan.interval === '1m' &&
    plan.trialDays === 14 &&
    !!plan.limits &&
    typeof plan.limits === 'object' &&
    Array.isArray(plan.features) &&
    plan.features.every((feature) => typeof feature === 'string')
  )
}

function mapPlan(
  plan: PublicPlanDto,
  fallbackPlans: readonly LandingPlan[],
): LandingPlan | null {
  if (!(plan.code in contracts)) return null
  const code = plan.code as PlanCode
  const fallback = fallbackPlans.find((candidate) => candidate.code === code)
  const contract = contracts[code]
  const limitsMatch = Object.entries(contract.limits).every(
    ([key, value]) =>
      plan.limits[key as keyof PublicPlanDto['limits']] === value,
  )
  const expectedFeatures = [...contract.features].sort()
  const featuresMatch =
    plan.features.length === contract.features.length &&
    [...plan.features]
      .sort()
      .every((feature, index) => feature === expectedFeatures[index])

  if (fallback === undefined) return null
  if (
    plan.name !== fallback.name ||
    plan.amount !== contract.amount ||
    !limitsMatch ||
    !featuresMatch
  ) {
    return null
  }

  return { ...fallback, price: `$${plan.amount}` }
}

/**
 * Validated API catalog mapped onto the landing cards in `locale`; any
 * mismatch with the published contract falls back to the static plans.
 */
export function resolveLandingPlans(
  value: unknown,
  locale: Locale = SOURCE_LOCALE,
): readonly LandingPlan[] {
  const fallbackPlans = fallbackLandingPlans(locale)
  if (!Array.isArray(value)) return fallbackPlans
  const mapped = value
    .filter(isPublicPlan)
    .map((plan) => mapPlan(plan, fallbackPlans))
    .filter((plan): plan is LandingPlan => plan !== null)
  if (mapped.length !== order.length) return fallbackPlans
  const byCode = new Map(mapped.map((plan) => [plan.code, plan]))
  if (byCode.size !== order.length) return fallbackPlans
  return order.map((code) => byCode.get(code)!)
}
