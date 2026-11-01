import type { PaymentDto, SubscriptionDto } from '@/api/types'

/** Failed renewal copy needs a current, evidenced recurring attempt, not merely blocked access. */
export function failedRenewal(
  subscription: Pick<SubscriptionDto, 'state' | 'currentPeriodEnd'>,
  history: readonly PaymentDto[] | null,
): PaymentDto | null {
  if (subscription.state !== 'blocked' && subscription.state !== 'pastDue')
    return null
  const periodEnd = Date.parse(subscription.currentPeriodEnd ?? '')
  if (!Number.isFinite(periodEnd)) return null
  const latest = history
    ?.filter((payment) => payment.type !== 'verification')
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  return latest?.type === 'recurring' &&
    latest.status === 'failed' &&
    Date.parse(latest.createdAt) >= periodEnd
    ? latest
    : null
}

/** An expired/cancelled period is not a scheduled future charge. */
export function scheduledCharge(
  subscription: Pick<
    SubscriptionDto,
    'state' | 'nextChargeAt' | 'currentPeriodEnd'
  >,
): string | null {
  if (['blocked', 'cancelled', 'none'].includes(subscription.state)) return null
  return (
    subscription.nextChargeAt ??
    (subscription.state === 'active' || subscription.state === 'pastDue'
      ? subscription.currentPeriodEnd
      : null)
  )
}
