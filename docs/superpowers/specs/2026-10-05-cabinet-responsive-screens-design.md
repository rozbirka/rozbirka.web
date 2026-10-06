# Cabinet Responsive Screens Design

## Goal

Make every authenticated cabinet screen usable on phones and tablets while
preserving the current desktop presentation. The cabinet must work from a
320 px viewport through tablet widths without page-level horizontal overflow,
clipped actions, overlapping content, or drawers that cannot be completed.

This design extends the responsive shell established by
`2026-08-14-roz-40-responsive-cabinet-shell-design.md`. The shell navigation
model remains unchanged; this work adapts the module contents rendered inside
it.

## Agreed Product Decisions

- Scope is limited to authenticated cabinet routes under `/app/*`.
- Public landing, authentication, registration, invitation, scan-resume, and
  standalone account pages are out of scope.
- Desktop at 1024 px and wider keeps its current visual composition.
- Tablet support covers 768–1023 px.
- Phone support covers 320–767 px.
- The existing visual language, Ukrainian copy, business rules, backend APIs,
  permissions, and data contracts do not change.
- Verification includes an actual iPhone Simulator in portrait and landscape,
  using a separate simulator session rather than the user's browser session.

## Scope

The audit and adaptation cover the dashboard, cars, parts, inventory, intakes,
stickers, orders and order details, customers and customer details, cash,
reports, imports, scanners, integrations, team, business settings,
subscription, plans, payments, and profile screens.

Every cabinet-owned overlay used by these screens is included: sheets,
drawers, short dialogs, confirmations, menus, search pickers, filters, form
footers, loading states, empty states, error states, and permission or billing
states.

## Responsive Foundation

The implementation starts with shared primitives and layout contracts, then
applies local screen fixes only where shared behavior is insufficient. This
keeps forms, tables, drawers, headings, actions, and spacing consistent across
modules.

The viewport model is:

- **Desktop, 1024 px and wider:** preserve the present layout and density.
- **Tablet, 768–1023 px:** use the existing compact navigation rail, reduce
  page gutters, retain multi-column arrangements only when their contents fit,
  and collapse constrained sidebars beneath primary content.
- **Phone, 320–767 px:** use the existing bottom navigation, one primary
  content column, mobile-safe gutters, and no page-level horizontal scrolling.

Containers and grid children must be shrinkable. Fixed column widths that can
force viewport overflow are replaced at narrow widths with `minmax(0, ...)`,
fluid widths, or a stacked layout. Long values may wrap, truncate with an
accessible full value, or scroll within a deliberately bounded data region;
they must never widen the page.

The cabinet preserves safe-area spacing around the bottom navigation, sticky
actions, and full-screen mobile sheets. Interactive controls retain at least a
44 by 44 px practical touch target where space permits, visible focus, and
keyboard operation.

## Shared Component Behavior

### Page structure and actions

Page headers keep title, supporting text, status, and actions readable at all
target widths. At phone widths, action groups wrap or stack beneath the title.
Primary actions remain prominent; secondary actions must not compress labels
or leave the viewport. Section padding and vertical rhythm become more compact
on phones without altering desktop values.

### Tables and record lists

Data tables use the existing responsive card representation below 768 px when
each row can be understood as a record. The identifying value remains first,
and other values receive visible mobile labels. Row actions remain reachable
by touch and keyboard.

At tablet widths, tables remain tabular when their columns fit. Horizontal
scrolling is reserved for genuinely wide datasets such as detailed financial
or import tables, and it is confined to the framed table region. The document
itself must not scroll horizontally.

Custom lists that do not use the shared `DataTable` follow the same content
priority: identity, state, essential values, then secondary metadata and
actions. No duplicated mobile and desktop records are introduced solely for
layout.

### Forms and controls

Form sections become one column on phones. Two-column layouts may remain on
tablets, while compact paired controls such as amount and currency may remain
beside each other only when labels and values fit at 320 px. Search fields use
the available width; filter and segmented-control groups wrap or become a
compact stacked control without changing their meaning.

Validation messages, hints, counters, and status notices wrap inside their
container. Opening the software keyboard must not hide the focused control or
the only available submit action.

### Sheets, drawers, dialogs, and menus

Cabinet sheets use their current desktop width at 1024 px and wider. On
tablets they may occupy a larger portion of the viewport. On phones they
become full-viewport surfaces with safe-area padding.

The sheet header and footer stay available while only the body scrolls. Close,
cancel, and submit controls remain reachable with long forms and with the
mobile keyboard open. Existing pending-state and successful-close behavior is
preserved.

Dialogs and menus are constrained to the visual viewport. They must not open
off-screen or beneath the bottom navigation, and focus containment,
restoration, Escape behavior, and accessible naming remain intact.

### Cards, KPI blocks, and long content

Card and KPI grids progressively reduce their column count. Amounts, status
pills, dates, names, phone numbers, email addresses, invitation codes, and
technical identifiers must not overlap adjacent content. Long tokens use
wrapping or intentional truncation with access to the full value.

## Screen-Level Adaptation

After shared primitives are stable, each cabinet route is audited for:

- fixed widths and minimum widths that exceed the viewport;
- grids whose columns do not collapse at the agreed breakpoints;
- action bars, filters, segmented controls, and pagination that cannot wrap;
- custom tables or timelines that need a mobile record layout;
- charts, previews, image galleries, QR content, and upload areas that exceed
  their container;
- nested scrolling, sticky elements, and bottom-navigation collisions;
- drawers or dialogs whose content, footer, or close action becomes
  unreachable;
- loading, empty, error, denied, and partial-data states that differ in size
  from the main path.

Local responsive rules may be added to a screen when its information hierarchy
is domain-specific. Unrelated redesign, copy changes, or business behavior are
not part of this work.

## Data Flow and Error Handling

Responsive behavior is presentation-only. Screens continue to consume the
same route state, query state, API responses, permissions, and mutation hooks.
No backend endpoint, request payload, validation rule, quota, currency rule,
or authorization decision changes.

Loading, empty, failed, denied, blocked, and offline states receive the same
responsive constraints as successful content. Existing notices and toasts
remain the source of operational feedback. Layout changes must not suppress an
error, move it away from the relevant field, or create a second submit path.

If the audit reveals a functional defect unrelated to viewport behavior, it is
recorded separately and is not silently bundled into this implementation.

## Accessibility

- Responsive reordering must preserve a meaningful DOM and focus order.
- Controls retain accessible names when visible labels move or collapse.
- Mobile card layouts preserve table or list semantics appropriate to the
  shared component.
- Focus indicators remain visible against the dark surfaces.
- Touch targets, sheet controls, menu items, and bottom navigation remain
  operable without precision tapping.
- Reduced-motion preferences continue to disable nonessential transitions.
- Text remains usable at browser zoom without page-level horizontal overflow.

## Verification

Automated browser coverage targets 320, 375, 768, and 1024 px viewports. It
checks representative routes and shared patterns for document-level overflow,
reachable navigation and primary actions, responsive table/card behavior,
drawer opening and closing, focus behavior, and console errors.

Reusable assertions should cover the shared shell and component contracts;
route-specific tests cover screens with custom composition. Tests use isolated
fixtures and must not send OTP messages or modify real business data.

After automated checks, the local cabinet is opened in an iPhone Simulator.
The changed screens are reviewed in portrait and landscape for visual rhythm,
scrolling, safe areas, bottom navigation, software keyboard interaction,
sticky headers or footers, sheets, menus, and long content. This simulator
session is separate from the user's browser and authentication session.

Completion evidence includes the exact viewport or simulator device, routes
checked, commands and results, any mocked states, and any scenario that could
not be verified. Repository static checks, unit tests, relevant browser tests,
and the production build must pass before the work is called complete.

## Out of Scope

- Redesigning the desktop cabinet.
- Public marketing and authentication pages.
- Native mobile application changes.
- Backend or database changes.
- New business features, permissions, filters, or reports.
- General refactoring unrelated to responsive layout.
