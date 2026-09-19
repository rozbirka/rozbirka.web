# Authentication and billing interaction contract

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
