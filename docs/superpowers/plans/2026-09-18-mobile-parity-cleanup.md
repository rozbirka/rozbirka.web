# Mobile Parity Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the requested cabinet screens match the mobile product vocabulary and interaction model, while removing unsupported web-only controls.

**Architecture:** Keep changes inside the existing cabinet screens and shared app controls. Reuse the current API contracts and pagination component; add small shared input behavior only where several screens need the same phone prefix or dismissible picker behavior.

**Tech Stack:** React 19, React Router 7, TypeScript, Tailwind CSS, Vitest, Testing Library.

**Spec:** User requirements from 2026-09-18 in this task; mobile references live in `../rozbirka.mobile/app`.

## Global Constraints

- Do not change backend contracts.
- Do not add web scanning entry points.
- Do not run browser or E2E tests; the user performs manual UI verification.
- Use Ukrainian labels and the mobile condition/status vocabulary.
- Every changed behavior receives a focused regression test before production code.

---

### Task 1: Dashboard cleanup

**Files:**
- Modify: `src/cabinet/dashboard/DashboardScreen.tsx`
- Modify: `src/cabinet/dashboard/DashboardActivity.tsx`
- Test: `src/cabinet/dashboard/DashboardScreen.test.tsx`
- Test: `src/cabinet/dashboard/DashboardActivity.test.tsx`

- [ ] Add failing assertions that the scan action is absent and confirmed orders use the green status tone.
- [ ] Run the focused dashboard tests and confirm the new assertions fail.
- [ ] Remove the scan action and map `confirmed` to `ok`.
- [ ] Run the focused dashboard tests.

### Task 2: Parts mobile vocabulary and filters

**Files:**
- Modify: `src/cabinet/parts/PartsScreen.tsx`
- Test: `src/cabinet/parts/PartsScreen.test.tsx`

- [ ] Add failing assertions for the fixed mobile conditions and absence of saved-filter controls.
- [ ] Run the focused parts tests and confirm failure.
- [ ] Replace free-text condition entry with `Хороший`, `Задовільний`, and `На запчастини`; remove saved views.
- [ ] Run the focused parts tests.

### Task 3: Intake detail parity

**Files:**
- Modify: `src/cabinet/intakes/IntakesScreen.tsx`
- Test: `src/cabinet/intakes/IntakesScreen.test.tsx`

- [ ] Add failing assertions that supplier UI is absent, part rows link to part cards, and positions paginate.
- [ ] Run the focused intake tests and confirm failure.
- [ ] Remove supplier presentation and input, link position names to `/parts/:id`, and paginate positions with the shared `Pagination` control.
- [ ] Run the focused intake tests.

### Task 4: Sticker part selection

**Files:**
- Modify: `src/cabinet/stickers/StickersScreen.tsx`
- Test: `src/cabinet/stickers/StickersScreen.test.tsx`

- [ ] Add failing assertions for searchable paginated part rows with checkboxes.
- [ ] Run the focused sticker tests and confirm failure.
- [ ] Replace the single select and quantity field with a parts list, checkboxes, select-all/reset actions, and paging while keeping generation actions.
- [ ] Run the focused sticker tests.

### Task 5: Order layout and dismissible pickers

**Files:**
- Modify: `src/cabinet/orders/OrdersScreen.tsx`
- Test: `src/cabinet/orders/OrdersScreen.test.tsx`

- [ ] Add failing assertions for Notes → Payments → Positions order, item pagination, picker dismissal after selection/outside click, and right-aligned numeric inputs.
- [ ] Run the focused order tests and confirm failure.
- [ ] Close result lists after selection, add outside-click/Escape dismissal, preserve selected labels, reorder detail blocks, and paginate positions.
- [ ] Run the focused order tests.

### Task 6: Ukrainian customer phone prefix

**Files:**
- Create: `src/cabinet/customers/customer-phone.ts`
- Create: `src/cabinet/customers/customer-phone.test.ts`
- Modify: `src/cabinet/customers/CustomersScreen.tsx`
- Modify: `src/cabinet/orders/OrdersScreen.tsx`

- [ ] Write failing helper and screen assertions for an initial `+380` value and prefix preservation.
- [ ] Run focused phone/customer/order tests and confirm failure.
- [ ] Add the shared prefix normalizer and use it in customer create/edit and inline order customer creation.
- [ ] Run the focused tests.

### Task 7: Cash creation parity

**Files:**
- Modify: `src/cabinet/cash/CashScreen.tsx`
- Test: `src/cabinet/cash/CashScreen.test.tsx`

- [ ] Add failing assertions for mobile-style currency toggles and one balance field per selected currency.
- [ ] Run the focused cash tests and confirm failure.
- [ ] Replace comma-separated currency/balance text areas with currency cards and aligned numeric balance inputs.
- [ ] Run the focused cash tests.

### Task 8: Profile cleanup and verification

**Files:**
- Modify: `src/cabinet/profile/profile-screen.tsx`
- Test: `src/cabinet/profile/profile-screen.test.tsx`

- [ ] Add failing assertions that Interface, Notifications, and Security are absent.
- [ ] Run the focused profile tests and confirm failure.
- [ ] Remove the three unsupported cards and their dead constants/components.
- [ ] Run all touched unit tests, TypeScript, ESLint, and the production build.
- [ ] Commit the verified changes locally and report every screen/file changed.
