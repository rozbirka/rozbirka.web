# Registration measurement

Marketing runs only when **both** the Vite build is `VITE_APP_ENV=production`
and the browser is on `https://rozbirka.pro`. QA HTML has no Google loaders;
QA event calls cannot create a queue or load a script, even if the artifact is
accidentally served on the production domain. The artifact gate checks this.

The public header remembers the language of the page actually visited, not
only language-menu clicks. Registration uses this site language without
changing the cabinet preference. A blocked storage write retains the choice
for the current page session.

## Funnel

Events have fixed names and fixed payloads. Never add phone numbers, OTPs,
names, business names, IDs, invite/scan tokens, free-text errors or raw URLs.

1. `registration_cta_click`: a landing registration link was clicked.
2. `registration_view`: registration mode opened (also direct entry/reload).
3. `registration_otp_requested` → `registration_otp_sent` or
   `registration_otp_send_failed`; local phone validation is
   `registration_phone_invalid`.
4. `registration_otp_view`; resends use `registration_otp_resend_requested`,
   `registration_otp_resent`, `registration_otp_resend_failed`.
5. `registration_otp_verify_requested` → `registration_otp_verified` or
   `registration_otp_verify_failed`; incomplete codes use
   `registration_otp_invalid`.
6. If required: `registration_name_view`, `registration_name_submit`,
   `registration_name_saved` / `registration_name_failed`; invalid local
   input uses `registration_name_invalid`.
7. `tenant_setup_view`, `tenant_create_requested`, then `tenant_created` or
   `tenant_create_failed`. A subsequent session hydration failure uses
   `tenant_setup_resume_failed`, not a false creation failure.
8. `trial_started_web` only after Core acknowledges an active tenant with
   `plan=trial`. It is not emitted by a click, view, failed request or stale
   response after logout. This is the browser observation, distinct from the
   authoritative Wolverine/outbox `start_trial` fact; do not sum both as two
   trials. Browser blocking/lost responses can undercount this observation.

`generate_lead` remains distinct from trial and only follows an accepted,
non-honeypot lead response. Existing sign-ins do not emit registration steps.

Direct registration initializes GA without automatic pageviews or GTM;
explicit funnel events send the canonical root location and no referrer or
private page title. Landing attribution retains only known campaign/click
parameters. Marketing failures never fail authentication or creation.

These events appear automatically in GA4 once real production traffic emits
them. A GA4 funnel exploration/key-event configuration and Ads import are
separate reporting settings; this code does not silently modify campaigns,
bidding or conversion goals. QA and local browser tests must make zero
marketing requests. Never smoke-test by sending customer OTPs or fabricating
production conversions.
