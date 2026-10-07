# Interaction contract: authentication, billing, part source and import

| Capability       | Canonical owner                                        | Source of truth                 | Allowed variants                        | Verification                      |
| ---------------- | ------------------------------------------------------ | ------------------------------- | --------------------------------------- | --------------------------------- |
| Form             | `src/components/app` Field, TextInput, Button          | Core auth API and this contract | login, registration, OTP, profile name  | login component and browser tests |
| Feedback         | `src/components/app` Notice and useOperation           | returned safe API codes         | loading, validation, temporary failure  | component tests                   |
| Auth session     | `src/api/session.ts`, `worker/session.ts`, AuthContext | Core identity in Core DB        | login, registration, refresh, logout    | worker and session tests          |
| Billing mutation | shared cabinet billing gates                           | Core subscription DTO           | checkout, recovery, provider management | billing screen tests              |

Login is for existing accounts. Registration is explicit and server-authorized;
no browser flag enables it. Both preserve the validated invitation/return path.
OTP challenges and deadlines live only in memory, reset on phone/mode change,
and cannot commit stale responses after navigation. Registration's private cookie
contains a signed opaque binding, never an OTP or a trusted user identity.

Product forms own validation (`noValidate`), preserve the phone on recoverable
errors, prevent duplicate requests, permit code paste, and keep errors inline.
Shared controls provide keyboard operation and visible focus. No new route,
theme, popup or form library is introduced.

Checkout eligibility is separate from subscription management. Active or still
entitled Apple/Google subscriptions block duplicate web purchases. No-history
and ended-access users can start web checkout when Core's flags permit it.
Only a confirmed server trial deadline is displayed. Pending unexpired invoices
can be reopened; expired invoices require a new checkout. Existing tenant and
permission gates remain authoritative.

Personal account controls live at `/account/security`, protected only by login.
They do not mount company or entitlement providers. Onboarding, active cabinet,
and cabinet recovery states link to this route. `AccountDeletion` owns the same
confirmation in the cabinet profile and standalone account page. Only confirmed
successful deletion clears the matching session; failures retain retry and stale
responses never clear a newer owner. Shared company records and subscriptions
are explicitly distinguished from personal identity deletion.

## Part source and import

Inventory forms keep the existing cabinet SectionPanel, Field, SelectInput,
Button and Notice owners. Native source selects retain platform keyboard and
popup behavior. Import source uses the same Field and TextInput primitives;
no new visual tokens or overlay are introduced.

The launch decision to require a car or intake is reflected in the source step:
manual creation requires a selected source, with a link to the matching
source-create flow when authorized. The typed part (except photos) is kept in
session storage and a same-tenant `return_to` brings the user back with the new
source selected. A car given by link that turns out archived is reported on
the source field before submit. Cars and intakes with parts cannot be deleted:
known counts block the action up front and offer archiving instead. Batch compatibility remains editable. Archived cars
retain their history but cannot receive new parts. A stale `origin=free` URL is
reset with an inline notice; available stock and unassigned warehouse zones are
unaffected.

The tenant-scoped `parts.bulk-import` flag controls import entry points through
the shared FeatureGate. Permissions and entitlements remain separate. Flags are
refreshed every minute; switching tenant clears the previous snapshot. Direct
API mutations are gated on the server; history, accepted work and results remain
available when the flag is off.

An import has one destination, carried through upload navigation, remembered
per import in this browser until the mapping is saved, and persisted in mapping
schema 2. A draft reopened without a known destination says so before offering a
new batch. A `car_id`/`intake_id` in the import URL preserves that car/intake. An upload
without context proposes an editable batch name derived from its display
filename. Resuming an unmapped upload without a filename requires entering the
name. Mapping source changes invalidate confirmation. Legacy schema mappings
and profiles must be reviewed before proceeding; an outdated profile explains
itself instead of raising a confirmation conflict. Source error codes
(`PART_SOURCE_ARCHIVED`, `IMPORT_SOURCE_*`, `SOURCE_HAS_PARTS`) read in the
interface language; unknown codes fall back to the server message. `ImportConfirmStep` shows the destination
alongside server validation; row columns cannot override it. Source lookups use
abort signals and localized unavailable/archive errors. The Core API remains
authoritative for permissions, source validity, quotas and retry behavior.

Verification owners: `PartsScreen.test.tsx`, `ImportScreen.test.tsx` and
`import-model.test.ts` cover mandatory source, compatibility, legacy filters,
legacy mapping review and source-wide import payloads.

## Localization (ROZ-160 / ROZ-161)

Interface languages are `uk` (source), `en-GB` and `pl`. The personal language
resolves profile language → language remembered in this browser → first
supported browser language → `en-GB`; it is chosen in Profile («Мова
інтерфейсу», automatic or one language) and saved through Core
`PATCH /auth/me/language`. A failed save keeps the old language and offers a
retry; without that endpoint the choice is kept on the device and the card says
so. Requests carry the interface language as `Accept-Language`, so OTP SMS and
server messages follow it. Copy lives in per-feature `defineMessages`
namespaces; a missing key is a type error, so no technical key is ever shown.

Numbers, dates and money format by the interface language; times and the
reporting day use the business time zone (tenant `timeZoneId`, Europe/Kyiv
while unknown). Money shows the ISO code with per-currency precision.

Business country, time zone and document language live in Business → «Регіон і
документи». Every member can read them — on that screen and, for roles
without business settings access, read-only in Profile → «Документи
бізнесу» (`RegionSummary`). Only the owner edits them; country and time zone
become read-only after the first operation (`regionLocked`; a 409
`BUSINESS_SETTINGS_LOCKED` race locks the block), while the document language
stays editable (REQ-LOCALIZATION AC-23 — the board's 3c shows it read-only; the
requirement wins). Core sends no lock reason, so the text names the rule Core
enforces: the first saved car, batch, part, order (or order item), car expense
or till transaction locks the region. Printed labels and documents use the
document language, not the interface language.

Business settings read top to bottom as 01 «Реквізити», 02 «Регіон і
документи», 03 «Валюта обліку», 04 «Склади», 05 «Облік»; `#region` and
`#accounting-currency` (`BUSINESS_SECTION_IDS`) open the two settings blocks.

SMS sign-in accepts Ukrainian, British and Polish numbers in E.164 with a
number-country choice; customer phones may be from any country and are never
rewritten with +380. Customer address fields (country, city, street, house,
postcode) are optional. Nova Poshta is offered to Ukrainian businesses only;
GB/PL businesses see an unavailable state (Core enforces the same rule).

The public landing has one URL per language and each URL always shows that
language: `/` Ukrainian (unchanged URL, canonical and content; also
`x-default`), `/en` English (UK), `/pl` Polish. All three are prerendered with
their own title, description, canonical, `og:locale`, `<html lang>` and
hreflang alternates for all three. The language is never detected or
redirected and there is no "switch language" banner. The header switcher (code
button with a menu of native names on desktop, three segments in the mobile
menu) uses plain links that work without JavaScript; choosing remembers the
public-site language in this browser (`siteLocalePreference`) and moves focus
to the new page's h1. The site language and the cabinet language are separate:
the landing choice never changes the interface language of the cabinet or the
sign-in screen (`localePreference`, profile language), and choosing a
language in Profile never changes the site language.

Verification owners: `src/i18n/i18n.test.tsx`, `language-card.test.tsx`,
`region-settings.test.tsx`, `login-international.test.tsx`, `src/lib/phone.test.ts`
and the en-GB render tests next to each migrated screen.

## Owner onboarding

Creating the first yard asks only for name and city, then opens the dashboard.
There `OnboardingChecklist` shows the owner of an eligible yard four steps —
business settings, accounting currency, a car or a batch, the first part —
with progress read from Core's onboarding facts only; opening a form or
pressing «Продовжити» credits nothing. Steps open the existing screens
(business settings sections by fragment, new car/intake with `return_to`, new
part); the dashboard re-reads on mount, focus and reconnection and announces
credited steps in a status toast. «Зробити пізніше» is saved on the server and
collapses the list into «Завершіть налаштування», which never re-expands by
itself; its «Продовжити» clears the deferral first (busy while saving) and
opens the step only after Core confirms, otherwise it stays with an error.
Completion offers the cash desk and team as recommendations and «Сховати»
saves Core `dismissed` (shared with mobile; a card hidden in this browser
before Core stored it is migrated once and the local key removed). Saving the
first part keeps the parts screen and shows the completion notice with «До
дашборду». Every onboarding PATCH re-reads the fact after a lost answer before
reporting failure. Workers, yards created before launch and Cores without the
endpoint see nothing; a first read without a connection is a neutral notice
(eligibility unknown) that re-reads once online; any other failed read shows a
retry, never guessed progress. Verification owners: `onboarding-policy.test.ts`,
`OnboardingChecklist.test.tsx`, `tenant-onboarding.test.tsx`.
