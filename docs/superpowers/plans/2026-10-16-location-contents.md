# Warehouse location contents implementation plan

> **For agentic workers:** Use executing-plans for the Web integration and dispatching-parallel-agents for independently owned Core and Mobile changes. Preserve existing feature work and unrelated files. Do not commit, push or deploy.

**Goal:** Implement the user-approved section/shelf pagination and read-only location contents on Web and Mobile, then update the existing local stack.

**Scope:** All sections in one searchable scrollable list, ten shelves per page. A section has Shelves and All parts views; a pinned Without shelf group opens parts placed directly in that section. Web shelf contents open in the existing Sheet; Mobile contents use a separate route. Search, loading/error/empty states, permissions, tenant ownership and return context must be preserved. Inventory counting, scanning, stock adjustment and reservation behavior are excluded.

**API contract:** Extend POST /parts/search request with sectionIds and shelfIds (UUID arrays), and missingShelf (nullable boolean). Location predicates must match the same placement, tenant, zone and section. missingShelf=true means a placement in a section with no shelf; false means a shelf placement; null imposes no shelf-presence restriction. Existing requests remain unchanged. Use server pagination (pageSize=10) for contents, existing PartSearchItem fields and parts.view permission. No schema migration is required.

## Tasks

- [x] Core: failing tests for shelf/section/direct placement, multi-placement conjunction and tenant isolation; implement only read filters; run focused/full checks and OpenAPI generation/check.
- [x] Web: scrollable section list and shelf pages of ten; reset/clamp URL pages; add section views, lazy read-only contents Sheet and direct-placement group; update generated types from the final local Core contract and verify tests/build/browser.
- [x] Mobile: scrollable sections and shelf pagination, section views, direct-placement group and separate lazy contents route with search/server paging; preserve parent state and guard owner changes; typecheck, full tests and iOS export.
- [x] Integrate: read-only review, inspect scope, restart only the selected local API preserving database volume; verify local API filters and both clients. Keep local Web and Metro alive.

## Acceptance checks

- Zone change resets the section selection and shelf page; changing section resets shelf page; search resets relevant page and never mixes zones.
- Section contents include its shelves plus direct placements. Without shelf excludes zone-only placements and shelves in other sections.
- Opening one shelf fetches only its paginated contents. Empty shelves remain usable; failed reads offer retry.
- Browser/route Back retains zone, section, search, view and list page. Private data is cleared on owner changes.
- Existing local fixtures remain: two physical zones, each with ten test sections and one hundred test shelves. No business parts are moved for verification without separate authorization.

## Verification evidence

- Core: full suite 1,501 passed / 334 skipped; AppHost 7 passed. Independent focused rerun: 15 location search cases passed. OpenAPI generation/check passed.
- Web: full check passed (1,623 unit + 234 contract + 50 integration tests = 1,907); QA artifact build passed. Generated client types checked against the local Core contract.
- Mobile: full suite 1,261 passed, typecheck and iOS export passed. Local Metro iOS bundle returned HTTP 200 after the final placement-cache fix.
- Read-only reviews found one mobile stale-contents issue; fixed with owner-scoped invalidation after placement saves and regression coverage. No remaining material review findings.
- Runtime: selected API restarted with the original PostgreSQL volume; Core and Identity health 200. Database retains 1,352 parts and both fixture zones. Authenticated local PostgreSQL search smoke passed for section, shelf, missingShelf=true and missingShelf=false; temporary verification session revoked.
- Authenticated local Web manually verified section paging, shelf contents, all section parts and direct-placement contents. Test sections currently contain no parts; no real business parts moved. Native handset visual walkthrough remains for the user; no Metro client connected at verification time.
- Publication dependency for a future push: Web generated types use the local Core contract (digest 9974422be45b170259658f2b5ca118ad0f4b7ecf16b2400d16d894d38b0cf755). The immutable published manifest is deliberately unchanged until the matching Core contract is published. Default release contract drift check must be reconciled at that point.

- Final Web regression: search debounce no longer repeats the previous filter while typing; failing-before/passing-after test verified. Focused tests 13/13, final unified full suite 1,899 passed, typecheck/scoped lint and final QA build passed. The earlier npm check groups overlap in nine cases; group execution totals above are not the unique-test count.
- Chromium acceptance scenario passed at 1440/390/320 px: shelf pagination, reload restoration, scoped search, nonempty shelf and section contents, direct-only contents and Back restoration. Browser fixture grants parts.view; radio segments are activated via their visible labels. Final search guard is additionally covered by the debounce regression.
- Local sessions kept alive: Core 8347, Web 22970, Mobile Metro 21916. Authenticated browser kept open on the second zone/section page; screenshot /tmp/rozbirka-location-pagination.jpg. No commits, pushes or deployment performed.

## User follow-up: remove section pagination

The user requested removing section pagination on 2026-10-16 at 15:35. Both Web and Mobile now show all sections in the selected zone in a scrollable searchable list. Web ignores legacy locationSectionPage parameters while preserving locationSection. Mobile retains virtualized FlatList rendering. Shelves remain paginated by ten; part contents and inventory counting are unchanged.

Updated the existing Web pagination regression for the new behavior: all ten sections remain reachable, a legacy page parameter does not change the selected section, and choosing another section shows its shelves. Failing-before/passing-after verified; focused location tests 13/13 pass. Mobile typecheck and full suite pass. Local authenticated Web verified all twelve sections in the first zone, no section navigation, and selection of section 04. Screenshot: /tmp/rozbirka-sections-without-pagination.jpg.

## User follow-up: stable aligned panel scrolling

The user reported shifted/clipped section controls on 2026-10-16 at 15:41. Root cause: the zone header/Add section button lived inside the section scroller, and independent content-height limits gave the two desktop panels different bounds.

Desktop panels now share a bounded height and aligned header/button positions. Headers and shelf pagination stay outside scrolling bodies; table column headings stay visible. Only lists scroll, with contained overscroll and a stable scrollbar gutter. The active section is revealed by adjusting only its list scrollTop, avoiding page-wide scrollIntoView. Narrow Web uses the stacked layout and a bounded section list; native Mobile and inventory counting are unchanged.

Verification: npm check passed (1,624 unit / 234 contract / 50 integration executions), QA artifact build passed; Chromium acceptance at 1440/390/320 px passed including new header-position and panel-bound checks. Authenticated local scrolling confirmed Add section remained at y=141.914 and the table heading at y=355.914 before/after independent list scrolls; both panels were 750px tall. Local HMR remains live. Screenshot: /tmp/rozbirka-location-panels-fixed.jpg.

## User follow-up: verify fifty parts

At the user's explicit request, created 50 clearly labelled local test parts in Rozbirka / Основний склад / Стелаж1 / Секція для кузова. Forty are on Полиця для фар; ten are directly in the section. The two pre-existing part records and placements were preserved. Names start with Тест 50, OEM codes TEST-50-001 through TEST-50-050, external codes local-contents-50-20261016-*. Fixture manifest /tmp/rozbirka-local-50-parts.json records the created IDs and baseline IDs; the temporary seeding auth session was revoked. No real parts moved and no reservations, sales or counting sessions created.

Actual PostgreSQL API reads verified 52 section positions in pages [10,10,10,10,10,2], all IDs unique; the fifty test-only records return five full pages. Exact OEM search, 40 shelf test records and 10 direct records passed. The live browser traversed all six pages, correctly disabled Next on the last page, found OEM TEST-50-050, opened its detail and restored search on browser Back. Direct record TEST-50-045 was absent from shelf contents and present in Without shelf.

Found and fixed a real layout issue: the part pager was below the section's visible scrolling area. LocationPartsList now keeps search/count and pager outside its independently scrolling rows. The Sheet gains an optional bodyClassName slot, used only by this contents drawer to retain the same bounded layout. Missing thumbnails render the existing box icon instead of a broken image; failing-before/passing-after regression passed.

Verification: 56 focused tests, typecheck, npm check (1,625 unit / 234 contract / 50 integration executions), QA build, and the expanded 50-record Chromium scenario at 1440/390/320 px passed. The browser scenario verifies five pages, long names, section/drawer pager bounds and no horizontal overflow. Screenshot: /tmp/rozbirka-50-parts-section.jpg.

Mobile: typecheck and 108 inventory tests passed; it uses the same verified search contract and the fixtures are available through the existing local Metro/API. No connected physical Metro client. Attempted visual verification using an existing local simulator app, but native UI automation could not reliably control/capture its menu; stopped the simulator booted for this attempt. Native handset visual walkthrough remains unverified. No native code changed.
