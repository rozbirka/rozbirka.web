# Part Search Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable paginated part-search dropdown matching the supplied design and use it in every part dropdown outside the main Parts screen.

**Architecture:** A focused `PartSearchPicker` owns debounced server search, filter totals, pagination, and price enrichment. `OrdersScreen` remains responsible for the selected part and order-line fields. Existing Parts and Stickers screens remain unchanged.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library, existing Core API client.

**Spec:** `docs/superpowers/specs/2026-09-21-part-search-picker-design.md`

## Global Constraints

- Exclude the main Parts screen.
- Price is USD and renders as `—` when absent.
- Keep selection compatible with existing order create and add-item payloads.
- Page sizes are 6 and 12.

## Review Focus

- Empty and whitespace queries must not show stale results.
- A null price must render as `—`; zero must render as a valid `$0` price.
- A slower previous request must not overwrite a newer query or page.
- Filter and page-size changes must reset to page 1.
- Selecting a result must preserve the existing order payload and close the dropdown.

---

### Task 1: Reusable picker

**Files:**
- Create: `src/components/parts/PartSearchPicker.tsx`
- Create: `src/components/parts/PartSearchPicker.test.tsx`

**Interfaces:**
- Consumes: `partsApi.list`, `partsApi.get`, and `PartListItem`.
- Produces: `PartSearchPicker({ value, onSelect, onClear })` and `PartPickerItem`.

- [ ] Write failing component tests for search, filters, pagination, selection, missing price, and zero price.
- [ ] Run the focused test and confirm it fails before the component exists.
- [ ] Implement debounced loading with abort cleanup and stale-response protection.
- [ ] Implement the mockup row hierarchy, filters, 6/12 pagination, and accessible controls.
- [ ] Run the focused tests until they pass.

### Task 2: Order integration

**Files:**
- Modify: `src/cabinet/orders/OrdersScreen.tsx`
- Modify: `src/cabinet/orders/OrdersScreen.test.tsx`

**Interfaces:**
- Consumes: `PartSearchPicker` and `PartPickerItem` from Task 1.
- Produces: unchanged Core order create and update payloads.

- [ ] Update order tests to exercise the shared picker and assert the selected name remains in the input.
- [ ] Run the focused order tests and confirm the old inline picker fails the new assertions.
- [ ] Replace inline search state, effects, and list markup with `PartSearchPicker`.
- [ ] Run all order tests and confirm create and add-item behavior remains unchanged.

### Task 3: Verification

**Files:**
- Modify only files required by formatting.

**Interfaces:**
- Consumes: completed shared picker and order integration.
- Produces: verified local web build.

- [ ] Run component and order tests.
- [ ] Run TypeScript and ESLint checks.
- [ ] Run the full web test suite.
- [ ] Build against `http://localhost:8088` and confirm the local server reloads.
