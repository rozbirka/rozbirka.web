/** Public landing events have fixed payloads: never pass form fields or IDs. */
export function trackLandingLead(): void {
  if (
    typeof window === 'undefined' ||
    window.location.protocol !== 'https:' ||
    window.location.hostname !== 'rozbirka.pro'
  )
    return
  try {
    const queue = (window as Window & { dataLayer?: unknown[] }).dataLayer
    if (!Array.isArray(queue)) return
    // Use the existing gtag queue without requiring Google scripts to finish.
    function gtag(..._args: unknown[]) {
      // gtag consumes an Arguments object, not a GTM event object.
      // eslint-disable-next-line prefer-rest-params
      queue!.push(arguments)
    }
    gtag('event', 'generate_lead', { lead_source: 'landing_form' })
  } catch {
    // Measurement must never turn an accepted lead into a form error.
  }
}
