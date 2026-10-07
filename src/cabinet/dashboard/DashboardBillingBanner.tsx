import { Link } from 'react-router'
import { Button, Notice, type NoticeTone } from '@/components/app'
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

interface BillingGuidance {
  title: string
  message: string
  tone: NoticeTone
  urgent: boolean
}

/**
 * The one thing allowed to interrupt the dashboard. It appears only when the
 * subscription needs a decision, and it carries the single action that ends it.
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
    <Notice
      action={
        billingPath === null ? undefined : (
          <Button asChild variant={guidance.urgent ? 'primary' : 'ghost'}>
            <Link to={billingPath}>{t('goToSubscription')}</Link>
          </Button>
        )
      }
      block
      role={guidance.urgent ? 'alert' : 'status'}
      tone={guidance.tone}
    >
      <p className="font-medium text-white">{guidance.title}</p>
      <p className="text-app-muted mt-0.5">{guidance.message}</p>
    </Notice>
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
