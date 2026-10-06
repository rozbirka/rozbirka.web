# Cabinet Interaction Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove confirmed interaction risks in cabinet dialogs, search pickers, delivery payments, and narrow-screen inventory layouts.

**Architecture:** Keep the fixes at the component that owns each behavior. Preserve existing API contracts and visual design, and cover each change with a focused interaction test before changing production code.

**Tech Stack:** React 19, TypeScript, Radix UI, Vitest, Testing Library.

**Spec:** User request in this task and `docs/ui/patterns.md`.

## Global Constraints

- Do not use browser automation because the authenticated browser session must remain untouched.
- Do not invent backend validation rules that are absent from the generated contract.
- Pending mutations must not be dismissible, and ambiguous retries must reuse their idempotency key.

## Review Focus

- Escape and overlay dismissal while a confirmation is pending.
- Search text changing while old results remain visible or selectable.
- Empty-result copy appearing before a catalogue request settles.
- Retrying an ambiguous delivery payment without creating a second mutation identity.
- Successful retries rotating the mutation identity for the next payment.

---

### Task 1: Pending confirmation dismissal

**Files:**
- Modify: `src/components/app/confirm-dialog.tsx`
- Test: `src/components/app/app-kit.test.tsx`

**Interfaces:**
- Consumes: existing `pending` prop.
- Produces: `onOpenChange(false)` is ignored while pending.

- [x] Add a failing test for Escape dismissal while pending.
- [x] Run the focused test and confirm the failure.
- [x] Guard the dialog's open-state callback.
- [x] Run the focused test and confirm it passes.

### Task 2: Search result lifecycle

**Files:**
- Modify: `src/cabinet/CommandPalette.tsx`
- Modify: `src/cabinet/integrations/settlement-picker.tsx`
- Test: `src/cabinet/CommandPalette.test.tsx`
- Test: `src/cabinet/integrations/settlement-picker.test.tsx`

**Interfaces:**
- Consumes: existing abortable search APIs.
- Produces: old results clear on input change and catalogue loading is explicit.

- [x] Add failing tests for immediate result clearing and pre-response loading copy.
- [x] Run them and confirm the failures.
- [x] Reset visible result state at input change and track the queried settlement term.
- [x] Run focused tests and confirm they pass.

### Task 3: Delivery payment retry identity

**Files:**
- Modify: `src/cabinet/orders/delivery/DeliveryOrderBody.tsx`
- Test: `src/cabinet/orders/delivery/DeliveryOrderBody.test.tsx`

**Interfaces:**
- Consumes: record/link payment payload and normalized API error kind.
- Produces: stable key for an ambiguous retry, new key after success or payload change.

- [x] Add a failing test for network failure, same-payload retry, and later successful payment.
- [x] Run it and confirm the key changes incorrectly.
- [x] Add payload-scoped keys for record and link operations.
- [x] Run focused tests and confirm they pass.

### Task 4: Long inventory identifier wrapping

**Files:**
- Modify: `src/cabinet/inventory/InventoryScreen.tsx`
- Test: `src/cabinet/inventory/InventoryScreen.test.tsx`

- [x] Add and run a failing test with a long unbroken QR code.
- [x] Allow the QR label to wrap inside the narrow placement layout.
- [x] Run the focused test and confirm it passes.

### Task 5: Verification and review

**Files:**
- Review all files changed by Tasks 1–3.

**Interfaces:**
- Consumes: the focused regression tests.
- Produces: a checked branch with no regression in the standard repository gate.

- [x] Run focused tests.
- [x] Run `npm run check`.
- [x] Run `npm run build`.
- [x] Review the final diff for behavior and scope.
