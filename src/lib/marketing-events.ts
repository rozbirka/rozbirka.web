/** Fixed, non-identifying funnel facts. Never accept URLs, text or IDs. */
export const funnelEvents = [
  'registration_cta_click',
  'registration_view',
  'registration_phone_invalid',
  'registration_otp_requested',
  'registration_otp_view',
  'registration_otp_invalid',
  'registration_otp_sent',
  'registration_otp_send_failed',
  'registration_otp_resend_requested',
  'registration_otp_resent',
  'registration_otp_resend_failed',
  'registration_otp_verify_requested',
  'registration_otp_verified',
  'registration_otp_verify_failed',
  'registration_name_view',
  'registration_name_submit',
  'registration_name_invalid',
  'registration_name_saved',
  'registration_name_failed',
  'tenant_setup_view',
  'tenant_create_requested',
  'tenant_create_failed',
  'tenant_setup_resume_failed',
  'tenant_created',
  'trial_started_web',
] as const
export type FunnelEvent = (typeof funnelEvents)[number]

const measurementId = 'G-D35DJ28PLE'
type MarketingWindow = Window & {
  dataLayer?: unknown[]
  __rozbirkaMarketingInitialized?: boolean
}

export function marketingEnabled(): boolean {
  return (
    import.meta.env['VITE_APP_ENV'] === 'production' &&
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    window.location.hostname === 'rozbirka.pro'
  )
}

function emit(name: string, extra: Record<string, string> = {}): void {
  if (!marketingEnabled()) return
  try {
    const target = window as MarketingWindow
    const queue = target.dataLayer ?? (target.dataLayer = [])
    function gtag(..._args: unknown[]) {
      // Google's queue consumes an Arguments object.
      // eslint-disable-next-line prefer-rest-params
      queue.push(arguments)
    }
    if (!target.__rozbirkaMarketingInitialized) {
      target.__rozbirkaMarketingInitialized = true
      gtag('js', new Date())
      // Never expose auth query strings, invite codes, tenant paths or referrers.
      gtag('config', measurementId, {
        send_page_view: false,
        page_location: 'https://rozbirka.pro/',
        page_referrer: '',
        page_title: 'Rozbirka',
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      })
      const script = document.createElement('script')
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
      document.head.appendChild(script)
    }
    gtag('event', name, {
      ...extra,
      send_to: measurementId,
      page_location: 'https://rozbirka.pro/',
      page_referrer: '',
      page_title: 'Rozbirka',
    })
  } catch {
    // Analytics failure must never break registration or an accepted lead.
  }
}

export function trackFunnelEvent(event: FunnelEvent): void {
  // Runtime allowlist also protects callers outside TypeScript.
  if (funnelEvents.includes(event)) emit(event)
}

export function trackLandingLead(): void {
  emit('generate_lead', { lead_source: 'landing_form' })
}
