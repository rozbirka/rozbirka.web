# Compact warehouse location browser implementation plan

**Approved design:** User selected a two-pane Web browser and a separate Mobile section/shelves screen, with search and compact rows. Inventory counting, quantity, reservations and backend contracts remain unchanged.

**Goal:** Keep 10 sections and 50–100 shelves navigable without expanding a long nested page.

**Architecture:** A Web presentation component consumes existing location data and CRUD callbacks. Native navigation reuses the current zone screen's location actions, with a section route and a virtualized list. Search and selection state remain local to the warehouse/zone and current tenant; returning restores the parent list.

## Tasks

- [x] Web: add a test with 10 sections and 100 shelves, name/code search, one selected section, bounded shelf pages, empty search, permission-safe actions and URL restoration.
- [x] Web: extract the hierarchy browser, render compact sections and one shelf table, retain existing forms, QR and archive handlers.
- [x] Mobile: test search/filtering and section navigation with 100 shelves, including identical names under different parents.
- [x] Mobile: replace nested shelf expansion with section navigation and FlatList; retain existing location actions and parent state on Back.
- [x] Verify: focused behavioral checks, full suites and typechecks, Web check/build, native iOS export, mocked Web browser checks at wide and narrow widths. Inspect the final diff to confirm counting/session and backend code were not changed.

## Review focus

- Empty sections and failed queries must remain distinguishable from no search matches.
- Archived/missing selected sections fall back safely, without showing another section's shelves under an old heading.
- Search returns correct parent paths for identical shelf names.
- Changes of tenant/warehouse do not retain private data from the previous owner.
- Search, pagination and action menus stay keyboard-accessible and do not overflow narrow layouts.

## Verification results

- Web: full `npm run check` passed (1,899 tests plus static checks). QA build and Chromium scenario passed at 1440, 390 and 320 px with 10 sections and 100 shelves per section; reload and navigation Back restore search. Screenshots inspected. Browser data was mocked.
- Mobile: typecheck, all 1,255 tests and iOS export passed. Native device interaction and live backend integration were not exercised.
- Independent read-only review found no Critical or Important issues. No backend or inventory counting/session business logic changed.

## Readability follow-up

User requested clearer warehouse UI for a 45+ operator. Removed nested selection borders, kept an inset keyboard focus, increased location names and counts, labelled the add-section action, and separated technical codes from section summaries. Mobile changes apply only to compact location rows; existing inventory counting rows retain their defaults. Shelf totals now use one index instead of filtering every shelf for every section.

Latest verification: Web full check, focused browser scenario at 1440/390/320 px, final QA build, Mobile typecheck, 1,255 tests and iOS export passed. Inspected the real local warehouse in the browser; pointer selection has no outline, keyboard focus remains visible with a -2 px inset. Read-only review found no material issues. Physical iPhone visual verification is still pending. Local Vite and Metro remain running.
