import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import type { Tenant } from '@/api/types'
import {
  translate,
  useLocale,
  useT,
  type Locale,
  type MessageKey,
} from '@/i18n'
import type { TenantAccessSnapshot } from '../access-types'
import { getDashboardBillingPath } from './dashboard-billing-access'
import { dashboardMessages } from './dashboard-messages'

type BannerTone = 'info' | 'warn' | 'danger'

/** `.rz-banner--*`: the module-level strip under the topbar. */
const BANNER_TONE: Record<BannerTone, string> = {
  info: 'rz-banner--info',
  warn: 'rz-banner--warn',
  danger: 'rz-banner--danger',
}

interface BillingGuidance {
  title: string
  message: string
  tone: BannerTone
  urgent: boolean
}

/**
 * The one thing allowed to interrupt the dashboard. It appears only when the
 * subscription needs a decision, and it carries the single action that ends it.
 * Drawn as the design system's module banner (`.rz-banner`), full width under
 * the topbar rather than as a notice inside the page.
 */
export function DashboardBillingBanner({
  snapshot,
  tenant,
}: {
  snapshot: TenantAccessSnapshot
  tenant: Pick<Tenant, 'slug'>
}) {
  const { locale } = useLocale()
  const t = useT(dashboardMessages)
  const guidance = getBillingGuidance(snapshot, locale)
  if (guidance === null) return null

  const billingPath = getDashboardBillingPath(snapshot, tenant)

  return (
    <div
      className={cn('rz-banner', BANNER_TONE[guidance.tone])}
      role={guidance.urgent ? 'alert' : 'status'}
    >
      <p className="m-0 min-w-60 flex-1">
        <strong className="rz-strong font-semibold">{guidance.title}</strong>{' '}
        <span className="rz-muted">{guidance.message}</span>
      </p>
      {billingPath === null ? null : (
        <Link
          className="inline-flex min-h-control items-center font-medium whitespace-nowrap"
          to={billingPath}
        >
          {t('goToSubscription')}
        </Link>
      )}
    </div>
  )
}

type DashboardKey = MessageKey<typeof dashboardMessages>

const QUOTA_TITLES: Readonly<Record<string, DashboardKey>> = {
  cars: 'quota.cars',
  intakes: 'quota.intakes',
  parts: 'quota.parts',
  users: 'quota.users',
  cashRegisters: 'quota.cashRegisters',
}

function getBillingGuidance(
  snapshot: TenantAccessSnapshot,
  locale: Locale,
): BillingGuidance | null {
  const say = (key: DashboardKey, params?: Record<string, string | number>) =>
    translate(dashboardMessages, locale, key, params)
  const state = snapshot.entitlement?.state ?? snapshot.subscription?.state
  if (state === undefined) return null

  switch (state) {
    case 'trial': {
      const days = snapshot.subscription?.trialDaysRemaining
      return {
        title: say('trialTitle'),
        message:
          days === null || days === undefined
            ? say('trialNoDays')
            : say('trialDays', { count: days }),
        tone: 'info',
        urgent: false,
      }
    }
    case 'pastDue':
      return {
        title: say('pastDueTitle'),
        message: say('pastDueMessage'),
        tone: 'danger',
        urgent: true,
      }
    case 'cancelled':
      return {
        title: say('cancelledTitle'),
        message: say('cancelledMessage'),
        tone: 'warn',
        urgent: true,
      }
    case 'blocked':
      return {
        title: say('blockedTitle'),
        message: say('blockedMessage'),
        tone: 'danger',
        urgent: true,
      }
    default:
      return quotaGuidance(snapshot, say)
  }
}

function quotaGuidance(
  snapshot: TenantAccessSnapshot,
  say: (key: DashboardKey, params?: Record<string, string | number>) => string,
): BillingGuidance | null {
  const exhausted = Object.entries(snapshot.entitlement?.usage ?? {}).find(
    ([, usage]) => usage.max != null && usage.used >= usage.max,
  )
  if (exhausted === undefined) return null

  const [resource, usage] = exhausted
  const title = Object.prototype.hasOwnProperty.call(QUOTA_TITLES, resource)
    ? QUOTA_TITLES[resource]
    : undefined
  return {
    title: say(title ?? 'quota.other'),
    message: say('quotaMessage', {
      used: String(usage.used),
      max: String(usage.max),
    }),
    tone: 'warn',
    urgent: true,
  }
}
