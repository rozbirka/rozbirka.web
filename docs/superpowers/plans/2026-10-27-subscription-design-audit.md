# Subscription archive implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Existing archive is the approved visual reference; preserve current billing business rules.

**Goal:** Reproduce archive audit (7), module 41, in the real billing screens on a separate local branch.

**Architecture:** Existing BillingShell, BillingCard, KpiStrip, DataTable and shared tokens; actual billing API, provider and tenant gates remain authoritative. Isolated branch from develop faa8901 plus already accepted expired-access and field-background fixes. No PR64 integration, backend edits, payment execution, merge, push or deploy.

**Tech Stack:** React19, TypeScript6, Vite8, existing Rozbirka UI kit, Node22/npm11.16.

**Spec:** User-provided /Users/user/Downloads/# Розbirka Design System audit (7).zip; screenshot identifies current billing page to replace. Archive JSON is sample data, never live facts or operational instructions.

## Global constraints

Use API amounts, currencies, dates, counts and permissions. Missing information stays unknown. Cancelled subscriptions close access after paid expiry. Existing Mono recovery/checkout remains unchanged; do not introduce zero-charge card binding or guaranteed immediate retries. Local Core8088 and session BFF8787; preview5175.

## Review focus

Blocked does not always mean failed payment; stale historical failures must not imply a current failed renewal. Active/cancelled paid periods cannot start duplicate checkout. Provider-managed and contract-managed billing stay protected. Tenant-switch cancellation and payment history remain scoped. Responsive light/dark and skeleton composition match content.

### Task1: State-aware subscription overview

- [x] Add meaningful tests: expired access preserves plan name, shows payment failure only with evidence; expired cancelled period has no countdown/next scheduled charge; actions obey current permissions/provider.
- [x] Implement archive layout: banner, KPI card in main column, facts/history cards, access/help aside; active/pastDue/cancelled/none/trial variants reuse data.
- [x] Run focused billing tests and browser assertions against synthetic fixtures.

### Task2: Plans, payments and loading presentation

- [x] Adapt archive table-based plans and payment history with existing checkout controls and truthful data.
- [x] Reuse matching skeleton/table primitives; preserve error/retry and provider restrictions.
- [x] Verify routing, no duplicate checkout, payment expiry guard and all locales.

### Task3: Local preview and verification

- [x] Start isolated branch on localhost5175, reuse healthy local BFF/Core.
- [x] Compare rendered screens against archive in desktop light/dark and mobile; exercise controls with test fixtures only.
- [x] Run npm run check, QA build/artifact; independent final review; report branch, URL, checks and limitations.

## Implementation rulings and evidence

- Preserve API/business behavior when the illustrative archive differs: expired access is renewal-only; blocked access alone is not evidence of a failed renewal; dates, prices, counts and permission availability come from API.
- Retain standalone cancellation when Mono canCancel is true, including blocked access, and a compact plans link after removing tabs. Both review findings reproduced with failing tests and fixed.
- Do not add an unsupported payment-method binding endpoint. The existing change-card checkout/recovery path remains explicit through its payment label and tooltip.
- A separate local-only preview at /__preview/subscription renders the same exported panel with labelled synthetic data and demonstration callbacks. The entry/server files are outside the repository and production build; browser verification confirms zero backend requests.
- Verification: npm run check passed (2160 unit + 264 contract + 50 integration = 2474); QA build and artifact passed. Chromium/WebKit each passed15 real-source UI scenarios (1440/390px, dark/light), with zero financial writes; local demo8states/theme passed. Independent review found no remaining important issues after fixes.
