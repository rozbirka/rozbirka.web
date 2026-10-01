# Mobile-Parity Web Order Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Web's single-item order form at `/app/:tenant/orders/new` with the four-step, multi-item Mobile order-creation flow, excluding QR scanning.

**Architecture:** Keep `OrdersScreen` as the route dispatcher and retain its existing add-item form. Add a focused `OrderCreateScreen` plus small Parts and Customer step components, backed by a pure `order-create-model` module for draft rules. Reuse existing Web API adapters and operation-kit controls; Core, Identity, Mobile, and API contracts do not change.

**Tech Stack:** React 19, React Router 7, TypeScript 6, Tailwind CSS 4, Radix dialogs through the existing app kit, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-21-mobile-parity-order-creation-design.md`

## Global Constraints

- Implement only `/app/:tenant/orders/new`; keep `/orders/:orderId/items/new` behavior intact.
- Do not add QR scanning, camera access, QR lookup, or a QR button to Web.
- Match the Mobile four-step order and business behavior at mobile `develop` commit `c734967`.
- Use only existing Core endpoints and generated/current Web API types.
- Keep all user-facing copy Ukrainian.
- Quantity is an integer from 1 through the remaining available stock and uses `QuantityStepper`.
- Unit price is a normalized non-negative decimal with at most 10 integer and 2 fraction digits; zero is valid.
- Customer selection is optional; new-customer phone drafts always begin with `+380`.
- Notes are limited to 1000 characters and trimmed before submission.
- Recheck current tenant, subscription, and permissions at each mutation boundary.
- Do not push, deploy, create a pull request, or perform UI walkthrough testing.

## Review Focus

- Re-selecting a part must merge quantity without exceeding available stock; Task 1 and Task 3 tests pin this.
- A zero price must remain valid while empty, malformed, or negative prices block progress; Task 1 and Task 4 tests pin this.
- Part or customer results arriving after a tenant/search change must not overwrite the current screen; Task 3 and Task 5 abort/stale-result tests pin this.
- Duplicate-phone handling must preserve the pending customer draft and choose or activate the correct record; Task 5 tests pin this.
- Failed or repeated final submissions must preserve the draft and create at most one order; Task 6 tests pin this.

---

## File Structure

- Create `src/cabinet/orders/order-create-model.ts`: pure draft types, money/notes normalization, item merge/remove/update, totals, and step validity.
- Create `src/cabinet/orders/order-create-model.test.ts`: exhaustive pure model coverage.
- Create `src/cabinet/orders/OrderCreateScreen.tsx`: workflow state, navigation, permission checks, request orchestration, summary, and submission.
- Create `src/cabinet/orders/OrderCreatePartsStep.tsx`: available-part search, pagination, source filter, item editor, and price step.
- Create `src/cabinet/orders/OrderCreateCustomerStep.tsx`: customer search/selection, prefill, creation, and duplicate handling.
- Create `src/cabinet/orders/OrderCreateScreen.test.tsx`: workflow component and API integration coverage.
- Modify `src/cabinet/orders/OrdersScreen.tsx`: dispatch canonical creation to `OrderCreateScreen`; retain `OrderForm` for add-item only.
- Modify `src/cabinet/orders/OrdersScreen.test.tsx`: keep directory/detail/add-item tests and replace legacy canonical-form assumptions with route-boundary assertions.

### Task 1: Pure order draft model

**Files:**
- Create: `src/cabinet/orders/order-create-model.ts`
- Create: `src/cabinet/orders/order-create-model.test.ts`

**Interfaces:**
- Consumes: `PartListItem` from `@/api/parts`.
- Produces: `OrderCreateStep`, `OrderDraftItem`, `normalizeOrderPrice`, `parseOrderPrice`, `normalizeOrderNotes`, `remainingPartQuantity`, `addDraftItem`, `removeDraftItem`, `updateDraftPrice`, `orderDraftTotal`, and `canContinueOrderStep`.

- [ ] **Step 1: Write failing normalization and validation tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  addDraftItem,
  canContinueOrderStep,
  normalizeOrderNotes,
  normalizeOrderPrice,
  orderDraftTotal,
  parseOrderPrice,
  removeDraftItem,
  updateDraftPrice,
} from './order-create-model'

const part = {
  id: 'part-1',
  name: 'Ліхтар',
  photos: [],
  quantityTotal: 3,
  quantityReserved: 0,
  quantityAvailable: 3,
  quantitySoldTotal: 0,
  status: 'available',
  car: null,
  order: null,
} as const

describe('order create model', () => {
  it('normalizes money and accepts zero', () => {
    expect(normalizeOrderPrice('12,345abc')).toBe('12.34')
    expect(parseOrderPrice('0')).toBe(0)
    expect(parseOrderPrice('')).toBeUndefined()
    expect(parseOrderPrice('1.234')).toBeUndefined()
  })

  it('merges repeated parts without exceeding stock', () => {
    const first = addDraftItem([], part, 2, '10')
    expect(addDraftItem(first, part, 2, '12')).toEqual([
      expect.objectContaining({ quantity: 3, price: '12' }),
    ])
  })

  it('updates, totals and removes items', () => {
    const items = updateDraftPrice(addDraftItem([], part, 2, '10'), 'part-1', '7.50')
    expect(orderDraftTotal(items)).toBe(15)
    expect(removeDraftItem(items, 'part-1')).toEqual([])
  })

  it('validates each step and trims notes', () => {
    const items = addDraftItem([], part, 1, '')
    expect(canContinueOrderStep('parts', items)).toBe(true)
    expect(canContinueOrderStep('prices', items)).toBe(false)
    expect(normalizeOrderNotes('  дзвінок  ')).toBe('дзвінок')
    expect(normalizeOrderNotes('   ')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the model test and verify the missing module failure**

Run: `npm run test:unit -- src/cabinet/orders/order-create-model.test.ts`

Expected: FAIL because `./order-create-model` does not exist.

- [ ] **Step 3: Implement the pure model**

```ts
import type { PartListItem } from '@/api/parts'

export const ORDER_NOTES_MAX_LENGTH = 1000
export type OrderCreateStep = 'parts' | 'prices' | 'customer' | 'summary'
export interface OrderDraftItem {
  part: PartListItem
  quantity: number
  price: string
}

export const normalizeOrderPrice = (value: string) => {
  const cleaned = value.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const [integer = '', ...fractions] = cleaned.split('.')
  const fraction = fractions.join('').slice(0, 2)
  return cleaned.includes('.')
    ? `${integer.slice(0, 10)}.${fraction}`
    : integer.slice(0, 10)
}

export const parseOrderPrice = (value: string) => {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const normalizeOrderNotes = (value: string) => {
  const trimmed = value.slice(0, ORDER_NOTES_MAX_LENGTH).trim()
  return trimmed === '' ? null : trimmed
}

export const remainingPartQuantity = (
  items: readonly OrderDraftItem[],
  part: PartListItem,
) =>
  Math.max(
    0,
    part.quantityAvailable -
      (items.find((item) => item.part.id === part.id)?.quantity ?? 0),
  )

export const addDraftItem = (
  items: readonly OrderDraftItem[],
  part: PartListItem,
  quantity: number,
  price: string,
): OrderDraftItem[] => {
  const existing = items.find((item) => item.part.id === part.id)
  const availableToAdd = Math.max(
    0,
    part.quantityAvailable - (existing?.quantity ?? 0),
  )
  const addition = Math.min(
    availableToAdd,
    Math.max(1, Math.floor(quantity)),
  )
  if (addition === 0) return [...items]
  const normalizedPrice = normalizeOrderPrice(price)
  if (!existing)
    return [...items, { part, quantity: addition, price: normalizedPrice }]
  return items.map((item) =>
    item.part.id === part.id
      ? {
          ...item,
          quantity: item.quantity + addition,
          price: normalizedPrice,
        }
      : item,
  )
}

export const removeDraftItem = (
  items: readonly OrderDraftItem[],
  partId: string,
) => items.filter((item) => item.part.id !== partId)

export const updateDraftPrice = (
  items: readonly OrderDraftItem[],
  partId: string,
  price: string,
) =>
  items.map((item) =>
    item.part.id === partId
      ? { ...item, price: normalizeOrderPrice(price) }
      : item,
  )

export const orderDraftTotal = (items: readonly OrderDraftItem[]) =>
  items.reduce(
    (total, item) =>
      total + item.quantity * (parseOrderPrice(item.price) ?? 0),
    0,
  )

export const canContinueOrderStep = (
  step: OrderCreateStep,
  items: readonly OrderDraftItem[],
) => {
  if (step === 'parts') return items.length > 0
  if (step === 'prices')
    return (
      items.length > 0 &&
      items.every((item) => {
        const price = parseOrderPrice(item.price)
        return price !== undefined && price >= 0
      })
    )
  return true
}
```

- [ ] **Step 4: Run the model tests**

Run: `npm run test:unit -- src/cabinet/orders/order-create-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the model**

```bash
git add src/cabinet/orders/order-create-model.ts src/cabinet/orders/order-create-model.test.ts
git commit -m "feat: add order creation draft model"
```

### Task 2: Route the canonical create page into a four-step shell

**Files:**
- Create: `src/cabinet/orders/OrderCreateScreen.tsx`
- Create: `src/cabinet/orders/OrderCreateScreen.test.tsx`
- Modify: `src/cabinet/orders/OrdersScreen.tsx:165-181`
- Modify: `src/cabinet/orders/OrdersScreen.test.tsx`

**Interfaces:**
- Consumes: `CabinetModuleScreenProps`, `OrderCreateStep`, `OrderDraftItem`, `canContinueOrderStep`.
- Produces: exported `OrderCreateScreen({ definition })`; `OrdersScreen` renders it only for the canonical `/orders/new` route.

- [ ] **Step 1: Write failing route and shell tests**

Add tests that render `/app/garage/orders/new` and assert:

```ts
expect(screen.getByRole('heading', { name: 'Нове замовлення' })).toBeVisible()
expect(screen.getByText('1 / 4')).toBeVisible()
expect(screen.getByText('Запчастини')).toBeVisible()
expect(screen.getByRole('button', { name: 'Далі' })).toBeDisabled()
expect(screen.queryByText(/QR|Сканувати/i)).not.toBeInTheDocument()
```

Also render `/app/garage/orders/order-1/items/new` and retain the current
`Додати позицію` form assertion so the route split cannot regress it.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm run test:unit -- src/cabinet/orders/OrderCreateScreen.test.tsx src/cabinet/orders/OrdersScreen.test.tsx`

Expected: FAIL because the new screen is missing and canonical creation still
renders the legacy form.

- [ ] **Step 3: Implement route dispatch and the step shell**

Change the route selection to:

```tsx
if (location.pathname.endsWith('/items/new')) {
  return (
    <OrderForm
      definition={definition}
      orderId={idFromPath(location.pathname.replace('/items/new', ''))}
    />
  )
}
if (location.pathname.endsWith('/new')) {
  return <OrderCreateScreen definition={definition} />
}
```

In `OrderCreateScreen`, create ordered steps:

```ts
const STEPS = [
  { id: 'parts', label: 'Запчастини' },
  { id: 'prices', label: 'Ціна' },
  { id: 'customer', label: 'Клієнт' },
  { id: 'summary', label: 'Підсумок' },
] as const
```

Render a four-segment progress bar, `current / 4`, the current label, a content
region, and footer buttons. Store selected items, selected customer, and notes
in the orchestrator. Use `canCreateOrder`-equivalent permission logic and the
existing denied copy when canonical creation is unavailable.

- [ ] **Step 4: Run route and shell tests**

Run: `npm run test:unit -- src/cabinet/orders/OrderCreateScreen.test.tsx src/cabinet/orders/OrdersScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the shell**

```bash
git add src/cabinet/orders/OrderCreateScreen.tsx src/cabinet/orders/OrderCreateScreen.test.tsx src/cabinet/orders/OrdersScreen.tsx src/cabinet/orders/OrdersScreen.test.tsx
git commit -m "feat: add four-step order creation shell"
```

### Task 3: Available-parts search, filters, pagination, and quantity editor

**Files:**
- Create: `src/cabinet/orders/OrderCreatePartsStep.tsx`
- Modify: `src/cabinet/orders/OrderCreateScreen.tsx`
- Modify: `src/cabinet/orders/OrderCreateScreen.test.tsx`

**Interfaces:**
- Consumes: `partsApi.list`, `carsApi.list`, `intakesApi.list`, `OrderDraftItem[]`, `addDraftItem`, `QuantityStepper`, `FormDialog`, `Sheet`.
- Produces: `OrderCreatePartsStep` props `{ items, onItemsChange, onContinue }` and a reusable prices-step render within the same focused module.

- [ ] **Step 1: Extend API mocks and write failing part-flow tests**

Mock `partsApi.list`, `carsApi.list`, and `intakesApi.list`. Add tests proving:

```ts
expect(partMocks.list).toHaveBeenCalledWith(
  expect.objectContaining({ status: 'available', page: 1, pageSize: 20 }),
)
await user.type(screen.getByLabelText('Пошук запчастини'), 'ліхтар')
await user.click(await screen.findByRole('button', { name: /Ліхтар/ }))
expect(screen.getByRole('dialog', { name: 'Додати запчастину' })).toBeVisible()
expect(screen.getByLabelText('Кількість')).toHaveValue('1')
expect(screen.getByRole('button', { name: 'Менше' })).toBeDisabled()
await user.click(screen.getByRole('button', { name: 'Більше' }))
expect(screen.getByLabelText('Кількість')).toHaveValue('2')
```

Add tests for maximum available stock, repeated selection/merge, price
normalization, outside/Escape closure, `Показати ще` page append, and applying
`carIds`/`intakeIds`. Simulate a stale first search resolving after a newer
search and assert only the newer results render.

- [ ] **Step 2: Run the new part-flow tests and verify failure**

Run: `npm run test:unit -- src/cabinet/orders/OrderCreateScreen.test.tsx`

Expected: FAIL because the parts step does not exist.

- [ ] **Step 3: Implement paged available-part search**

Use an abortable effect keyed by debounced query, selected source ids, and
page. Reset items/pages when query or filters change; append only when loading
the next page. Always pass `status: 'available'` and `pageSize: 20`.

Render each row as a button with thumbnail, part name, car/source context,
available quantity, and an `×N` badge when already selected. Render loading,
empty, retry, and load-more states without clearing the order draft.

- [ ] **Step 4: Implement source filtering and the item editor**

Use `Sheet` for `Фільтр`, with `Авто` and `Приймання` radio tabs, source search,
multi-select checkboxes, `Скинути`, and `Застосувати · N`. Load up to 100 source
rows with abortable requests when the sheet opens. Do not display intake
supplier data.

Use `FormDialog` for `Додати запчастину`. Render:

```tsx
<Field label="Кількість" required>
  <QuantityStepper
    label="Кількість"
    min={1}
    max={remainingAvailable}
    onChange={setEditorQuantity}
    value={editorQuantity}
  />
</Field>
<Field label="Ціна за шт." required>
  <TextInput
    inputMode="decimal"
    onChange={(event) => setEditorPrice(normalizeOrderPrice(event.target.value))}
    value={editorPrice}
  />
</Field>
```

Show the line total when quantity exceeds one. Disable confirmation for an
invalid price or no remaining stock. Confirm through `addDraftItem`, then close
the dialog and return focus to the selected row.

- [ ] **Step 5: Run model and part-flow tests**

Run: `npm run test:unit -- src/cabinet/orders/order-create-model.test.ts src/cabinet/orders/OrderCreateScreen.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit parts selection**

```bash
git add src/cabinet/orders/OrderCreatePartsStep.tsx src/cabinet/orders/OrderCreateScreen.tsx src/cabinet/orders/OrderCreateScreen.test.tsx
git commit -m "feat: add order parts selection flow"
```

### Task 4: Price review and multi-item totals

**Files:**
- Modify: `src/cabinet/orders/OrderCreatePartsStep.tsx`
- Modify: `src/cabinet/orders/OrderCreateScreen.tsx`
- Modify: `src/cabinet/orders/OrderCreateScreen.test.tsx`

**Interfaces:**
- Consumes: `updateDraftPrice`, `removeDraftItem`, `orderDraftTotal`, and current draft items.
- Produces: prices step callbacks `{ onItemsChange, onAddMore, onContinue }`.

- [ ] **Step 1: Write failing prices-step tests**

Build a two-part draft through Step 1, move to Step 2, and assert both rows,
their quantities, editable prices, and total. Cover:

```ts
await user.clear(screen.getByLabelText('Ціна за одиницю Ліхтар'))
expect(screen.getByRole('button', { name: 'Далі' })).toBeDisabled()
await user.type(screen.getByLabelText('Ціна за одиницю Ліхтар'), '0')
expect(screen.getByRole('button', { name: 'Далі' })).toBeEnabled()
await user.click(screen.getByRole('button', { name: 'Прибрати Двері' }))
expect(screen.queryByText('Двері')).not.toBeInTheDocument()
```

Assert `Додати ще запчастину` returns to Step 1 and preserves the remaining
draft.

- [ ] **Step 2: Run the prices-step tests and verify failure**

Run: `npm run test:unit -- src/cabinet/orders/OrderCreateScreen.test.tsx`

Expected: FAIL because the prices step has no item editor.

- [ ] **Step 3: Implement the prices step**

Render an accessible list of selected items. Each row contains the thumbnail,
part/source description, quantity in `шт.`, normalized price input, and named
remove button. Display `Разом` using `orderDraftTotal` and current cabinet
money formatting. Disable `Далі` whenever `canContinueOrderStep('prices')` is
false.

- [ ] **Step 4: Run the prices-step tests**

Run: `npm run test:unit -- src/cabinet/orders/OrderCreateScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit price review**

```bash
git add src/cabinet/orders/OrderCreatePartsStep.tsx src/cabinet/orders/OrderCreateScreen.tsx src/cabinet/orders/OrderCreateScreen.test.tsx
git commit -m "feat: add order price review step"
```

### Task 5: Optional customer selection and inline creation

**Files:**
- Create: `src/cabinet/orders/OrderCreateCustomerStep.tsx`
- Modify: `src/cabinet/orders/OrderCreateScreen.tsx`
- Modify: `src/cabinet/orders/OrderCreateScreen.test.tsx`

**Interfaces:**
- Consumes: `customersApi.search/getById/create/activate`, `newCustomerPhoneDraft`, `normalizeCustomerPhoneDraft`, `readCustomerPhoneConflict`, latest mutation guard.
- Produces: `OrderCreateCustomerStep` props `{ selectedCustomer, onSelectCustomer, summary }`.

- [ ] **Step 1: Write failing customer-flow tests**

Cover search and immediate result closure, removing a selected customer,
continuing with no customer, preloading `?customerId=customer-1`, and a failed
prefill that leaves `Далі` enabled.

Cover new customer creation:

```ts
await user.type(screen.getByLabelText('Пошук клієнта'), 'Нова Ірина')
await user.click(screen.getByRole('button', { name: /Новий клієнт/ }))
expect(screen.getByLabelText('Телефон')).toHaveValue('+380')
await user.type(screen.getByLabelText('Телефон'), '501112233')
await user.click(screen.getByRole('button', { name: 'Створити клієнта' }))
expect(customerMocks.create).toHaveBeenCalledWith(
  { name: 'Нова Ірина', phone: '+380501112233', notes: null },
  expect.objectContaining({ signal: expect.any(AbortSignal) }),
)
```

Add active duplicate use, inactive duplicate activation, permission revocation,
draft restoration after closing conflict, outside click/Escape, and stale
search response tests.

- [ ] **Step 2: Run the customer tests and verify failure**

Run: `npm run test:unit -- src/cabinet/orders/OrderCreateScreen.test.tsx`

Expected: FAIL because the customer step is missing.

- [ ] **Step 3: Implement optional search and preselection**

Debounce search by 300 ms and abort obsolete requests. Selecting a result must
clear search, close the list, and render a selected card with name, phone, and
remove action. Load route `customerId` with `getById`; convert its detail to the
selected customer shape. Keep prefill errors local and retryable.

- [ ] **Step 4: Implement new-customer and conflict dialogs**

Open `FormDialog` from `Новий клієнт "query"`. Prefill name/phone from the
query, initialize phone with `newCustomerPhoneDraft()`, normalize every phone
change, and require a trimmed name. Recheck `customers.manage` at submission.

On `CUSTOMER_PHONE_EXISTS`, close the create dialog and open the existing
warning/confirmation UI. Select an active duplicate or activate an inactive
one. Preserve name and phone until the conflict resolves or the user changes
the number.

- [ ] **Step 5: Run customer and phone helper tests**

Run: `npm run test:unit -- src/cabinet/orders/OrderCreateScreen.test.tsx src/cabinet/customers/customer-phone.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit customer selection**

```bash
git add src/cabinet/orders/OrderCreateCustomerStep.tsx src/cabinet/orders/OrderCreateScreen.tsx src/cabinet/orders/OrderCreateScreen.test.tsx
git commit -m "feat: add order customer step"
```

### Task 6: Summary, final creation, and guarded exit

**Files:**
- Modify: `src/cabinet/orders/OrderCreateScreen.tsx`
- Modify: `src/cabinet/orders/OrderCreateScreen.test.tsx`
- Modify: `src/cabinet/orders/OrdersScreen.test.tsx`

**Interfaces:**
- Consumes: `ordersApi.create`, model normalization/totals, `ConfirmDialog`, React Router navigation/blocking, `useLatestMutationGuard`.
- Produces: one canonical multi-item create request and successful replacement navigation.

- [ ] **Step 1: Write failing summary and submission tests**

Build two items and an optional customer through the public UI. Assert summary
rows, notes counter, 1000-character limit, line totals, and full total. Submit
and assert:

```ts
expect(orderMocks.create).toHaveBeenCalledWith({
  customerId: 'customer-1',
  notes: 'Подзвонити перед видачею',
  items: [
    { partId: 'part-1', quantity: 2, unitPrice: 75 },
    { partId: 'part-2', quantity: 1, unitPrice: 25.5 },
  ],
})
```

Add tests that two rapid clicks call `create` once; a rejected request keeps all
four-step draft data and enables retry; permission/tenant revocation prevents
the request; success replaces to `/app/garage/orders/order-1`.

Add navigation tests: Step 2–4 back returns one step without data loss; Step 1
cancel with a dirty draft opens `ConfirmDialog`; clean cancel navigates directly;
`beforeunload` is prevented only for a dirty unsaved draft.

- [ ] **Step 2: Run summary/submission tests and verify failure**

Run: `npm run test:unit -- src/cabinet/orders/OrderCreateScreen.test.tsx src/cabinet/orders/OrdersScreen.test.tsx`

Expected: FAIL because summary submission and exit guards are incomplete.

- [ ] **Step 3: Implement summary and final request**

Render selected customer, notes with `${notes.length}/1000`, each item, line
totals, and full total. On submit, recheck canonical order permissions and map
the draft through `parseOrderPrice`; the step invariant guarantees a number.
Set a synchronous busy flag before awaiting `ordersApi.create`, preserve state
on error, and use `navigate('../created-id', { replace: true })` on success.

- [ ] **Step 4: Implement guarded navigation**

Treat `items.length > 0 || notes.length > 0` as dirty. Add/remove a
`beforeunload` listener with the dirty state. Use a route blocker for external
in-app navigation and `ConfirmDialog` for Step 1 cancel; previous-step actions
never confirm. Set a saved ref before replacement navigation so success cannot
open the warning.

- [ ] **Step 5: Run all order tests**

Run: `npm run test:unit -- src/cabinet/orders/order-create-model.test.ts src/cabinet/orders/OrderCreateScreen.test.tsx src/cabinet/orders/OrdersScreen.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit final creation behavior**

```bash
git add src/cabinet/orders/OrderCreateScreen.tsx src/cabinet/orders/OrderCreateScreen.test.tsx src/cabinet/orders/OrdersScreen.test.tsx
git commit -m "feat: complete mobile-parity order creation"
```

### Task 7: Remove legacy canonical-form coupling and verify the branch

**Files:**
- Modify: `src/cabinet/orders/OrdersScreen.tsx`
- Modify: `src/cabinet/orders/OrdersScreen.test.tsx`
- Modify: `src/cabinet/orders/OrderCreateScreen.test.tsx`

**Interfaces:**
- Consumes: completed `OrderCreateScreen` and retained add-item `OrderForm`.
- Produces: final code with no dead canonical-form state, copy, or tests.

- [ ] **Step 1: Identify and remove canonical-only branches from `OrderForm`**

Make `OrderForm` require `orderId: string` and delete its canonical-only
customer picker, inline-customer state, notes section, `ordersApi.create`
branch, and canonical labels. Preserve full-item-list loading, merge behavior,
permission rechecks, and `ordersApi.updateItems` for add-item.

- [ ] **Step 2: Update legacy tests around the final route boundary**

Remove tests that type canonical order data through `ID запчастини`. Keep all
directory, detail, confirmation, refund, notes, customer reassignment, and
add-item tests. Ensure the canonical route assertion delegates to the new
screen and the add-item route still sends the full replacement item list.

- [ ] **Step 3: Run formatting, static checks, and the complete unit suite**

Run:

```bash
npx prettier --write src/cabinet/orders docs/superpowers/plans/2026-09-21-mobile-parity-order-creation.md
npm run typecheck
npm run lint
npm run test:unit
```

Expected: all commands exit 0; the unit suite has no skipped or failing order
creation tests.

- [ ] **Step 4: Build against the running local API**

Run:

```bash
VITE_API_URL=http://localhost:8088 npm run build -- --mode development
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/app/rozbirka/orders/new
```

Expected: build exits 0 and curl prints `200`. Do not navigate through the UI;
the user performs that visual verification.

- [ ] **Step 5: Commit cleanup and verification changes**

```bash
git add src/cabinet/orders
git commit -m "refactor: isolate order creation workflow"
```

- [ ] **Step 6: Report the exact screens and behavior changed**

Report `/orders/new`, the four steps, quantity stepper, source filters, optional
customer flow, summary/submission, test counts, build result, and commit list.
State explicitly that `/orders/:orderId/items/new` was preserved and QR was not
added.
