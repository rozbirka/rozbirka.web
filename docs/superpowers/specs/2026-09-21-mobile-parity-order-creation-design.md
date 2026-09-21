# Mobile-Parity Web Order Creation Design

**Date:** 2026-09-21
**Status:** Approved in chat; pending written-spec review
**Repository:** `rozbirka.web`
**Mobile reference:** `rozbirka.mobile/app/order/new.tsx` at mobile `develop` commit `c734967`

## Goal

Replace the current one-page, one-item Web order form with the same four-step
order-creation workflow used by Mobile. A user must be able to select multiple
available parts, set quantities and prices, optionally select or create a
customer, review notes and totals, and create the complete order in one request.

The Web experience keeps the current Rozbirka cabinet visual system and adapts
the Mobile interaction to pointer, keyboard, and responsive browser layouts.
Web must not expose QR or camera scanning.

## Scope

The change applies to `/app/:tenant/orders/new`. The existing
`/app/:tenant/orders/:orderId/items/new` flow for adding an item to an existing
order remains unchanged. The order directory and order detail screens remain
unchanged.

The existing Core API is sufficient. This work changes no backend contracts,
database schema, permissions, or Mobile code.

## Architecture

`OrdersScreen` continues to own route selection. New-order creation delegates
to a focused create-flow module instead of sharing the legacy single-item form
with the add-item route. The add-item route retains the existing `OrderForm`.

The create-flow module owns the four-step UI and composes smaller step
components. Pure draft operations live in a separate model module so quantity
limits, repeated-part merging, price normalization, total calculation, and
step validation can be tested without rendering the screen.

Existing APIs and shared controls are reused:

- `partsApi.list` for paged available-part search and source filters;
- `carsApi` and `intakesApi` for source-filter choices;
- `customersApi.search`, `getById`, `create`, and `activate` for customers;
- `ordersApi.create` for the final multi-item request;
- `QuantityStepper` for the `− / value / +` quantity control;
- existing customer phone normalization with a permanent `+380` draft prefix;
- existing cabinet permission and latest-mutation guards.

## Draft state

The screen keeps one in-memory draft containing:

- current step: `parts`, `prices`, `customer`, or `summary`;
- selected items, keyed by part id, with the full list item, quantity, and
  normalized price string;
- part search text, current page, source filters, and fetched results;
- selected customer or no customer;
- customer search and new-customer draft;
- notes, limited to 1000 characters;
- current item-editor state;
- loading and error state for each independent request.

Moving backward or forward does not clear draft data. A successful creation
clears the draft by navigating with replacement to the created order.

## Step 1: Parts

The first step is titled `Запчастини` and lists only parts with status
`available`. Search is debounced and resets pagination. Each row shows the
photo when present, part name, source/car context, available quantity, and the
quantity already added to the order.

The list initially requests 20 rows. `Показати ще` appends the next page while
one exists. Loading, empty, and retryable error states are shown inside the
list without discarding selected items.

A source-filter control opens an in-page sheet/dialog with two tabs: `Авто`
and `Приймання`. It supports searching each source list and selecting multiple
sources. Applying the filter refreshes the part list using `carIds` and
`intakeIds`; resetting clears both filters. Failure to load optional source
choices leaves ordinary part search usable.

There is no QR button, camera permission request, QR lookup, or scanner route
on Web.

Selecting a part opens the item editor and closes the part-results interaction.
The editor shows the part name, available stock, quantity stepper, unit price,
and line total. Quantity starts at 1, cannot go below 1, and cannot exceed the
part's currently reported available quantity. Unit price accepts normalized
non-negative decimal money input, including zero.

When a part is selected again, the confirmed editor quantity is added to the
existing draft quantity and the new price replaces the draft price, matching
Mobile. The resulting total quantity cannot exceed available stock; the
stepper's maximum is the remaining available quantity. If no stock remains,
the part cannot be added again.

The user cannot continue until at least one valid item exists.

## Step 2: Prices

The second step is titled `Ціна`. It lists every selected item with its photo,
name, source context, quantity, editable normalized unit price, and remove
action. A removed item disappears from every later step.

`Додати ще запчастину` returns to Step 1 without clearing the draft. The
running order total is the sum of `quantity × unitPrice` for every item.

The user cannot continue while any price is empty, malformed, or negative.
Zero is valid.

## Step 3: Customer

The third step is titled `Клієнт`. Customer selection is optional. The step
shows a compact order summary, customer search, search results, and the
currently selected customer.

Selecting a customer immediately closes the result list and replaces search
with the selected-customer card. The user can remove the selection and search
again. Clicking outside a result list or pressing Escape closes it.

When the route contains `?customerId=...`, the screen loads that customer by id
and starts with the customer selected. A failed prefill load does not block
order creation and is presented as a retryable customer error.

Searching for a missing customer exposes `Новий клієнт`. The create form is an
in-page sheet/dialog prefilled from the search text. Its phone input starts at
`+380`, retains that prefix, and uses the existing phone normalizer. Name is
required; phone is optional.

An active duplicate-phone conflict offers to use the existing customer. An
inactive duplicate offers to activate and select that customer. Closing the
conflict returns to the customer form without losing its draft. Customer
creation remains hidden when `customers.manage` is unavailable, while ordinary
optional selection remains usable with `customers.view`.

The user may continue without selecting a customer.

## Step 4: Summary

The final step is titled `Підсумок`. It shows the selected customer when one
exists, an optional notes field with a visible `current/1000` counter, every
item with quantity, unit price and line total, and the full order total.

Notes are trimmed through the same normalization used by Mobile. Empty notes
are omitted/null according to the existing Web API contract.

`Створити` sends one `ordersApi.create` request:

```ts
{
  customerId: selectedCustomer?.id ?? null,
  notes: normalizedNotes ?? null,
  items: draftItems.map(({ part, quantity, price }) => ({
    partId: part.id,
    quantity,
    unitPrice: parseOrderPrice(price),
  })),
}
```

Double submission is blocked. Success navigates with replacement to the new
order detail. Failure preserves the entire draft and shows an actionable error
so the user can retry.

## Navigation and unsaved changes

The header shows four progress segments, `current / 4`, and the current step
title. The primary footer action is `Далі` on Steps 1–3 and `Створити` on Step
4. `Назад` moves to the previous step. On Step 1, `Скасувати` returns to the
order directory.

Leaving the route with selected items or non-empty notes asks whether to
discard the draft. Browser refresh/close uses `beforeunload`; in-app cancel and
back actions use the cabinet confirmation surface. No warning is shown after a
successful save.

## Responsive and accessible behavior

Desktop centers a comfortably wide workflow and may show dense part rows;
narrow screens stack content and keep primary actions reachable. The control
order and behavior stay the same at every width.

All controls have Ukrainian accessible names. The progress indicator exposes
the current step in text. The quantity stepper supports its buttons and direct
numeric typing, announces the quantity field, and disables `−`/`+` at its
limits. Lists and dialogs support keyboard focus, Escape, outside click, and
visible focus styles. Images use useful part-name alternatives.

## Permissions and stale actions

Canonical creation still requires an active subscription plus
`orders.manage`, `parts.view`, and `customers.view`. Every mutation rechecks
the latest tenant and permissions at the action boundary. Customer mutation
additionally requires `customers.manage`. A tenant transition aborts requests
and prevents stale results from changing the current draft.

## Testing

Implementation is test-first. Pure model tests cover adding, merging,
availability clamping, removal, money normalization, totals, notes, and step
validity. Component tests cover all four steps, pagination, filters, picker
closure, the quantity stepper, optional/preselected/new/duplicate customers,
back navigation, unsaved-change confirmation, permission changes, final
payload, retry behavior, and duplicate-submit protection.

Final validation runs the complete Web unit suite and a development-mode build.
The user performs visual UI testing; automated work does not click through the
running application on the user's behalf.

## Out of scope

- QR scanning, camera access, or manual QR lookup on Web;
- changes to Mobile;
- changes to Core or Identity;
- changes to adding an item to an existing order;
- order payment, confirmation, refund, or cancellation behavior;
- deployment, pushing, or pull-request creation.
