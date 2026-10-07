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
інтерфейсу», automatic or one language) and saved through Identity
`PATCH /auth/me/language`. A failed save keeps the old language and offers a
retry; without that endpoint the choice is kept on the device and the card says
so. Requests carry the interface language as `Accept-Language`, so OTP SMS and
server messages follow it. Copy lives in per-feature `defineMessages`
namespaces; a missing key is a type error, so no technical key is ever shown.

Numbers, dates and money format by the interface language; times and the
reporting day use the business time zone (tenant `timeZoneId`, Europe/Kyiv
while unknown). Money shows the ISO code with per-currency precision.

Business country, time zone and document language live in Business → «Регіон і
документи». Only the owner edits them; country and time zone become read-only
after the first operation (`regionLocked`; a 409 `BUSINESS_SETTINGS_LOCKED`
race locks the block), while the document language stays editable
(REQ-LOCALIZATION AC-23 — the board's 3c shows it read-only; the requirement
wins). Printed labels and documents use the document language, not the
interface language.

SMS sign-in accepts Ukrainian, British and Polish numbers in E.164 with a
number-country choice; customer phones may be from any country and are never
rewritten with +380. Customer address fields (country, city, street, house,
postcode) are optional. Nova Poshta is offered to Ukrainian businesses only;
GB/PL businesses see an unavailable state (Core enforces the same rule).

Verification owners: `src/i18n/i18n.test.tsx`, `language-card.test.tsx`,
`region-settings.test.tsx`, `login-international.test.tsx`, `src/lib/phone.test.ts`
and the en-GB render tests next to each migrated screen.
