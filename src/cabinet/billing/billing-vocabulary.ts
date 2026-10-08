import type { StatusTone } from '@/components/app'
import type { PaymentDto, PaymentStatus } from '@/api/types'
import { SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { billingMessages } from './messages'

type BillingKey = keyof (typeof billingMessages)['uk']

/** Plan feature codes, read by a person. Unknown codes are shown as they came. */
const featureKeys: Record<string, BillingKey> = {
  intake_management: 'featureIntakeManagement',
  'reports.advanced': 'featureReportsAdvanced',
  bulk_export: 'featureBulkExport',
  team_collaboration: 'featureTeamCollaboration',
  advanced_analytics: 'featureAdvancedAnalytics',
  compat_suggest: 'featureCompatSuggest',
  multi_cash_registers: 'featureMultiCashRegisters',
  extended_photos: 'featureExtendedPhotos',
}

export const featureLabel = (code: string, locale: Locale = SOURCE_LOCALE) => {
  const key = featureKeys[code]
  return key === undefined ? code : translate(billingMessages, locale, key)
}

const LIMITS = [
  { key: 'cars', message: 'limitCars' },
  { key: 'intakes', message: 'limitIntakes' },
  { key: 'parts', message: 'limitParts' },
  { key: 'users', message: 'limitUsers' },
  { key: 'cashRegisters', message: 'limitCashRegisters' },
] as const

/** The five limits every plan and every subscription reports, in one order. */
export const limitLabels = (locale: Locale) =>
  LIMITS.map((limit) => ({
    key: limit.key,
    label: translate(billingMessages, locale, limit.message),
  }))

/** Price period as it follows an amount: «за місяць», "per month". */
export const intervalLabel = (interval: string, locale: Locale) => {
  if (/^1m$/i.test(interval))
    return translate(billingMessages, locale, 'perMonth')
  if (/^(1y|12m)$/i.test(interval))
    return translate(billingMessages, locale, 'perYear')
  if (/^3m$/i.test(interval))
    return translate(billingMessages, locale, 'perQuarter')
  return translate(billingMessages, locale, 'perOther', { interval })
}

/** Billing period on its own, for the period switch: «місяць», "Monthly". */
export const intervalName = (interval: string, locale: Locale) => {
  if (/^1m$/i.test(interval))
    return translate(billingMessages, locale, 'monthly')
  if (/^(1y|12m)$/i.test(interval))
    return translate(billingMessages, locale, 'yearly')
  if (/^3m$/i.test(interval))
    return translate(billingMessages, locale, 'quarterly')
  return interval
}

/** Whole days from now to an ISO instant; negative when it is already past. */
export const daysUntil = (iso: string | null): number | null => {
  if (iso === null) return null
  const target = new Date(iso).valueOf()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86_400_000)
}

/** «7 днів», "7 days" — a count of days with its word. */
export const daysText = (count: number, locale: Locale) =>
  translate(billingMessages, locale, 'days', { count })

const paymentStatus: Record<
  PaymentStatus,
  { message: BillingKey; tone: StatusTone }
> = {
  success: { message: 'paymentSuccess', tone: 'ok' },
  pending: { message: 'paymentPending', tone: 'warn' },
  failed: { message: 'paymentFailed', tone: 'danger' },
  reversed: { message: 'paymentReversed', tone: 'neutral' },
  cancelled: { message: 'paymentCancelled', tone: 'neutral' },
}

/** Payment vocabulary shared by the subscription history and the ledger. */
export function paymentStatusMeta(
  status: PaymentStatus,
  locale: Locale,
): { label: string; tone: StatusTone } {
  const meta = paymentStatus[status]
  return {
    label: translate(billingMessages, locale, meta.message),
    tone: meta.tone,
  }
}

export function paymentTypeLabel(
  type: PaymentDto['type'],
  locale: Locale,
): string {
  switch (type) {
    case 'checkout':
      return translate(billingMessages, locale, 'paymentCheckout')
    case 'recurring':
      return translate(billingMessages, locale, 'paymentRecurring')
    case 'verification':
      return translate(billingMessages, locale, 'paymentVerification')
    default:
      return type
  }
}
