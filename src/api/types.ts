import type { SupportedCurrency } from '../i18n/currencies'
import type { Locale } from '../i18n/locales'
import type { components } from './generated/core'

// === Core authentication (`/auth/*` in the pinned Core contract) ===

type CoreSchemas = components['schemas']

export type SendOtpRequest = CoreSchemas['SendOtpRequest']
export type SendOtpResponse = CoreSchemas['OtpSendResponse']
export type VerifyOtpRequest = CoreSchemas['VerifyOtpRequest']

/** User returned by the verify endpoints; `language` `null` = automatic. */
export type VerifyUser = CoreSchemas['VerifyUserDto']

/**
 * The Worker's session verify response: Core's `VerifyResponse` without the
 * refresh token, which stays in the Worker's HttpOnly cookie.
 */
export interface SessionVerifyResponse {
  accessToken: string
  user: VerifyUser
  isNewUser: boolean
}

export interface SessionRefreshResponse {
  accessToken: string
  expiresIn: number
}

export type UpdateNameRequest = CoreSchemas['UpdateNameRequest']

/**
 * PATCH /auth/me/language — `null` returns to automatic selection. Narrower
 * than Core's `UpdateLanguageRequest` (any string): the web sends only
 * supported locales; contract-alignment.ts keeps the two in step.
 */
export interface UpdateLanguageRequest {
  language: Locale | null
}

/** Response of PATCH /auth/me/name and /auth/me/language. */
export type UpdateNameResponse = CoreSchemas['UpdateNameResponse']

/**
 * GET /auth/me. `language` is the saved personal interface language (`uk`,
 * `en-GB`, `pl`; `null` = automatic) and is validated by the locale resolver
 * before use; `effectiveLanguage` is Core's own resolution.
 */
export type User = CoreSchemas['MeResponse']

// === Tenants (rozbirka.core) ===

export type TenantPlan = 'trial' | 'active' | 'blocked' | (string & {})

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  planTier: string
  city: string | null
  logoUrl: string | null
  isActive: boolean
  createdAt: string
  roleName: string | null
  /**
   * Whether a delivery order must hold a deposit before it ships. Off, the
   * yard carries the cost of an uncollected parcel itself.
   */
  requireDeliveryDeposit: boolean
  /*
   * Business settings (Core feat/backend-localization-currency-onboarding,
   * not pinned yet). Optional because the pinned contract and older fixtures
   * lack them; `normalizeTenant` turns unknown values into `null`. Missing
   * means unknown — read them through `tenantSettings()`, never guess.
   */
  /** `UA`, `GB` or `PL`. */
  countryCode?: 'UA' | 'GB' | 'PL' | null
  /** IANA zone of the business, e.g. `Europe/Kyiv`. */
  timeZoneId?: string | null
  /** Language of documents and customer messages (not the user's UI). */
  documentLanguage?: Locale | null
  /** `null` until the owner chooses it; there is no default currency. */
  accountingCurrency?: SupportedCurrency | null
  /** Region and document language are fixed after the first operation. */
  regionLocked?: boolean | null
  /** Accounting currency is fixed after the first priced record. */
  currencyLocked?: boolean | null
}

export interface CreateTenantRequest {
  tenantName: string
  city?: string
  logoUrl?: string
}

export interface CreateTenantResponse {
  tenantId: string
  name: string
  slug: string
  plan: TenantPlan
  planTier: string
  isActive: boolean
}

// === Billing (rozbirka.core, feature/subscriptions) ===
// Source of truth: rozbirka.core/docs/billing-integration.md

export type BillingState =
  | 'none'
  | 'trial'
  | 'active'
  | 'pastDue'
  | 'cancelled'
  | 'blocked'

export type PaymentType = 'checkout' | 'recurring' | 'verification'
export type PaymentStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'reversed'
  | 'cancelled'

export interface LimitUsageDto {
  used: number
  max: number | null
}

export interface PlanUsageDto {
  cars: LimitUsageDto
  intakes: LimitUsageDto
  parts: LimitUsageDto
  users: LimitUsageDto
  cashRegisters: LimitUsageDto
}

export interface SubscriptionDto {
  state: BillingState
  planCode: string | null
  planName: string | null
  trialEndsAt: string | null
  trialDaysRemaining: number | null
  currentPeriodEnd: string | null
  nextChargeAt: string | null
  amount: number | null
  currency: string | null
  cardLast4: string | null
  cardBrand: string | null
  canSubscribe: boolean
  canCancel: boolean
  canReactivate: boolean
  /** Show "Activate free trial" CTA — true only if trial never used + no live sub. */
  canActivateTrial: boolean
  usage: PlanUsageDto
  features: string[]
}

export interface SubscribeRequest {
  /** Plan code from /billing/plans. Omit to use backend default (Pro). */
  planCode?: string
}

export interface CheckoutResponse {
  checkoutUrl: string
}

export interface PaymentDto {
  id: string
  amount: number
  currency: string
  type: PaymentType
  status: PaymentStatus
  createdAt: string
  providerInvoiceId: string | null
  /** Set only on Pending Checkout rows — resume an interrupted checkout. */
  checkoutUrl: string | null
  /** ISO date when the Mono pay page stops accepting payments. */
  checkoutExpiresAt: string | null
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CancelRequest {
  reason?: string
}

export interface PublicPlanLimits {
  cars: number | null
  intakes: number | null
  parts: number | null
  users: number | null
  cashRegisters: number | null
  photosPerPart: number | null
}

export interface PublicPlanDto {
  code: string
  name: string
  amount: number
  currency: string
  interval: string
  trialDays: number
  limits: PublicPlanLimits
  features: string[]
}

// Canonical feature codes
export const FEATURES = {
  IntakeManagement: 'intake_management',
  AdvancedReports: 'reports.advanced',
  BulkExport: 'bulk_export',
  TeamCollaboration: 'team_collaboration',
  AdvancedAnalytics: 'advanced_analytics',
  CompatSuggest: 'compat_suggest',
  MultiCashRegisters: 'multi_cash_registers',
  ExtendedPhotos: 'extended_photos',
  ApiAccess: 'api_access',
  MultiLocation: 'multi_location',
  PrioritySupport: 'priority_support',
  WhiteLabel: 'white_label',
} as const

export type FeatureCode = (typeof FEATURES)[keyof typeof FEATURES]

export interface ApiError {
  code?: string
  message?: string
}
