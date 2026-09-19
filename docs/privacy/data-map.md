# Privacy source map — 2026-09-19

The maintained public policy is `src/screens/privacy.tsx`. It has one version for
all visitors, no acquisition navigation, and contact-only links. Native legal
copy must match its factual sections and version. No reviewer-specific variant.

## Code-supported processing

| Data                                                                       | Purpose / source                                                | Service boundary                                                       |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Phone, name, account identifier, membership                                | Core Users/auth, OTP login, permissions                         | Google Cloud Core/database; Cloudflare trusted auth relay; Twilio SMS  |
| IP address and session identifiers                                         | Trusted edge request metadata, rate limiting and authentication | Cloudflare Worker; Core Redis and refresh-session store                |
| Company inventory, orders, customer information, finance, photos/documents | Shared business records and storage                             | Core/Google Cloud; Cloudflare request delivery                         |
| Payment identifiers, status, card mask and payment token                   | Subscription and payment accounting                             | Core Mono billing integration / Monobank                               |
| Existing store subscription identifiers/status/history                     | Historical Apple/Google billing reconciliation where applicable | Core RevenueCat events/subscriber integration; Apple/Google/RevenueCat |

Relevant Core source: `AuthModule/Auth/TwilioSmsService.cs`,
`AuthModule/Auth/PostgresRefreshSessionStore.cs`, Billing/RevenueCatSubscriberClient,
Core billing entities and Mono payment integration. The Web Worker strips caller
trust headers and injects trusted edge metadata; the current Mobile app does not
contain the RevenueCat SDK. Retained server billing integration does not prove
there are active store subscriptions; live reconciliation is still required.

## Deletion contract

Successful DELETE `/auth/me` (204) erases original personal identity and sessions,
memberships/permissions and personal authentication artifacts. Shared company
business records/media remain, with historical actor references assigned to a
neutral inactive actor. A non-reversible subject tombstone prevents restoration
of an old account. Account deletion does not cancel subscriptions. Backup restore
procedures must preserve deletion tombstones; this page does not claim immediate
backup/provider erasure or an unverified retention deadline.

`/account/security` requires authentication only, outside CabinetProvider and
company entitlement gates. Onboarding and cabinet recovery screens link there.
The shared deletion component signs out only after confirmed successful deletion,
preserves retry after failure and rejects stale-owner cleanup. Leaving the screen
does not abort the already dispatched destructive request.

## Unverified operational/legal facts

The legal controller's registered identity/address, verified support ownership,
actual backup retention/restore schedule, provider deletion procedures, legal
retention requirements, store subscription inventory and App Store Connect labels
require operator confirmation. Existing public support@rozbirka.com is retained;
no legal entity or retention period is invented. Publication must be coordinated
with the Core deletion release. These source findings are not a legal compliance
or App Review acceptance guarantee.

App Privacy labels must reflect actual collection, purpose, linkage and providers,
including backend collection. Neither `NSPrivacyTracking=false` nor an empty
manifest collection array establishes no collection. See Apple's maintained
[App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).
This work does not change App Store Connect declarations.
