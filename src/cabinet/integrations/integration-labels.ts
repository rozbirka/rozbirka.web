import type { StatusTone } from '@/components/app'
import type { ApiProblem } from '@/api/contracts'
import type { Integration, IntegrationStatus } from '@/api/integrations'
import type { BusinessCountry } from '@/api/tenant-settings'
import { SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { integrationLabelMessages } from './integration-label-messages'

type LabelKey = Extract<keyof (typeof integrationLabelMessages)['uk'], string>

const hasLabel = (key: string): key is LabelKey =>
  Object.prototype.hasOwnProperty.call(integrationLabelMessages.uk, key)

const label = (
  locale: Locale,
  key: LabelKey,
  params?: Readonly<Record<string, string | number>>,
) => translate(integrationLabelMessages, locale, key, params)

export const NOVA_POSHTA = 'nova_poshta'

/** Core answers 409 with this code when NP is asked for outside Ukraine. */
export const INTEGRATION_COUNTRY_UNAVAILABLE = 'integration_country_unavailable'

/**
 * Nova Poshta serves Ukrainian businesses only (REQ-LOCALIZATION AC-18/AC-36):
 * the business country decides, never the personal language. An unknown
 * country keeps the pre-region behaviour and Core still has the last word.
 */
export function isNovaPoshtaAvailable(
  country: BusinessCountry | null,
): boolean {
  return country === null || country === 'UA'
}

/** `true` when a problem is Core refusing NP for the business country. */
export function isCountryUnavailableProblem(
  problem: Pick<ApiProblem, 'code'>,
): boolean {
  return problem.code?.toLowerCase() === INTEGRATION_COUNTRY_UNAVAILABLE
}

/** Title and sentence of the "not in your country" state. */
export function novaPoshtaUnavailableText(locale: Locale = SOURCE_LOCALE): {
  title: string
  message: string
} {
  return {
    title: label(locale, 'unavailable.title'),
    message: label(locale, `error.${INTEGRATION_COUNTRY_UNAVAILABLE}`),
  }
}

/**
 * The server's own message for a failed request, except where the code means
 * something this cabinet explains itself (NP refused for the country).
 */
export function integrationProblemMessage(
  problem: Pick<ApiProblem, 'code' | 'message'>,
  locale: Locale = SOURCE_LOCALE,
): string {
  return isCountryUnavailableProblem(problem)
    ? label(locale, `error.${INTEGRATION_COUNTRY_UNAVAILABLE}`)
    : problem.message
}

const STATUS_TONES: Record<IntegrationStatus, StatusTone> = {
  draft: 'neutral',
  active: 'ok',
  inactive: 'neutral',
  error: 'danger',
}

/** An unknown status is shown as it came, not guessed into a colour. */
export function integrationStatusPresentation(
  status: string,
  locale: Locale = SOURCE_LOCALE,
): {
  label: string
  tone: StatusTone
} {
  const key = `status.${status}`
  return Object.prototype.hasOwnProperty.call(STATUS_TONES, status) &&
    hasLabel(key)
    ? {
        label: label(locale, key),
        tone: STATUS_TONES[status as IntegrationStatus],
      }
    : { label: status, tone: 'neutral' }
}

/** The square badge in the list. Two letters, so a long name never wraps it. */
export function integrationMark(
  code: string,
  locale: Locale = SOURCE_LOCALE,
): string {
  const key = `mark.${code}`
  return hasLabel(key) ? label(locale, key) : code.slice(0, 2).toUpperCase()
}

export function integrationKind(
  code: string,
  locale: Locale = SOURCE_LOCALE,
): string | null {
  const key = `kind.${code}`
  return hasLabel(key) ? label(locale, key) : null
}

/**
 * Codes Core returns in `lastErrorCode`. Anything unknown keeps the code
 * itself — an invented explanation would be worse than an honest one.
 */
export function integrationErrorMessage(
  code: string,
  locale: Locale = SOURCE_LOCALE,
): string {
  const key = `error.${code.toLowerCase()}`
  return key !== 'error.unknown' && hasLabel(key)
    ? label(locale, key)
    : label(locale, 'error.unknown', { code })
}

export function diagnosticCheckLabel(
  code: string,
  locale: Locale = SOURCE_LOCALE,
): string {
  const key = `check.${code}`
  return hasLabel(key) ? label(locale, key) : code
}

/** Nova Poshta is the only provider Core can back today. */
export function isSupportedIntegration(integration: Integration): boolean {
  return integration.code === NOVA_POSHTA
}

/**
 * The managed tracking subscription's lifecycle, as Core names it. The pill is
 * short enough to sit beside a heading; the sentence says what the yard should
 * expect next, because half of these states resolve on their own.
 */
const TRACKING_TONES: Record<string, StatusTone> = {
  Disabled: 'neutral',
  Connecting: 'warn',
  AwaitingVerification: 'warn',
  Connected: 'ok',
  RetryPending: 'warn',
  NeedsCredentials: 'danger',
  NeedsReview: 'danger',
  Disconnecting: 'neutral',
}

/** States that change on their own, so the screen keeps asking while in one. */
const TRACKING_TRANSITIONAL = new Set([
  'Connecting',
  'AwaitingVerification',
  'Disconnecting',
  'RetryPending',
])

export function trackingStatePresentation(
  state: string,
  locale: Locale = SOURCE_LOCALE,
): {
  label: string
  tone: StatusTone
  detail: string
} {
  const key = `tracking.${state}`
  const detailKey = `tracking.${state}.detail`
  const tone = Object.prototype.hasOwnProperty.call(TRACKING_TONES, state)
    ? TRACKING_TONES[state]
    : undefined
  if (tone !== undefined && hasLabel(key) && hasLabel(detailKey))
    return {
      label: label(locale, key),
      tone,
      detail: label(locale, detailKey),
    }
  return {
    label: label(locale, 'tracking.unknown'),
    tone: 'neutral',
    detail: label(locale, 'tracking.unknown.detail'),
  }
}

export function isTrackingTransitional(state: string): boolean {
  return TRACKING_TRANSITIONAL.has(state)
}

/**
 * Why Core stopped, in `reasonCode`. Two families arrive here: what our own
 * reconciliation found, and `provider_*` — the carrier's refusal, named after
 * its failure kind. Null when there is nothing to explain, so a caller can
 * skip the line.
 */
export function trackingReasonMessage(
  code: string | null,
  locale: Locale = SOURCE_LOCALE,
): string | null {
  if (code === null) return null
  const key = `reason.${code}`
  return key !== 'reason.unknown' && hasLabel(key)
    ? label(locale, key)
    : label(locale, 'reason.unknown')
}

/** Carrier codes a tracking command can fail with, and their sentence. */
const TRACKING_PROVIDER_PROBLEMS: Record<string, LabelKey> = {
  nova_poshta_unauthorized: 'error.nova_poshta_unauthorized',
  nova_poshta_rejected: 'reason.provider_rejected',
  nova_poshta_ratelimited: 'error.nova_poshta_ratelimited',
  nova_poshta_unavailable: 'error.nova_poshta_unavailable',
  nova_poshta_disabled: 'error.nova_poshta_disabled',
  [INTEGRATION_COUNTRY_UNAVAILABLE]: `error.${INTEGRATION_COUNTRY_UNAVAILABLE}`,
}

/**
 * A failed command, in the interface language. Core answers in its own
 * words — about its internals — so the code decides the text and the body is
 * never shown.
 */
export function trackingProblemMessage(
  problem: ApiProblem,
  locale: Locale = SOURCE_LOCALE,
): string {
  const code = problem.code?.toLowerCase() ?? ''
  const own = `problem.${code}`
  if (code.startsWith('tracking_') && hasLabel(own)) return label(locale, own)
  const provider = Object.prototype.hasOwnProperty.call(
    TRACKING_PROVIDER_PROBLEMS,
    code,
  )
    ? TRACKING_PROVIDER_PROBLEMS[code]
    : undefined
  if (provider !== undefined) return label(locale, provider)
  if (problem.kind === 'forbidden') return label(locale, 'problem.forbidden')
  if (problem.kind === 'not-found') return label(locale, 'problem.notFound')
  if (problem.kind === 'network' || problem.kind === 'timeout')
    return label(locale, 'problem.network')
  return label(locale, 'problem.generic')
}
