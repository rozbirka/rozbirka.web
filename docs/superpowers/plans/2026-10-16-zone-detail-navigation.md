# Dedicated zone navigation

Approved design: variant 1. Warehouse is a zone overview; a physical zone opens its own Web screen with section/shelf panels. Mobile uses its existing zone → section → shelves screens. Counting, reservation, stock and placement rules remain unchanged. Work stays in the selected dirty feature checkouts; no push or deployment.

1. Add Web inventory/zones/:zoneId to the existing protected inventory route catalog and InventoryScreen dispatcher. Implement a keyed ZoneView using getZone and the existing resource/error handling, warehouse breadcrumb/Back, zone title and permission-gated link to all zone parts. System/archived zones do not expose new structure writes.
2. Move WarehouseShelves off WarehouseView. Scope it to the route's zoneId, fetch sections/shelves with that filter and retain defensive zone/warehouse filtering. Reuse all existing editors, QR labels and parts contents. Remove the redundant zone picker on the dedicated screen. Preserve URL section/search/page state; activate a newly created section.
3. Warehouse physical-zone names link to the new route even without parts.view. Preserve the system unassigned link to the existing parts filter. Keep existing warehouse/zone CRUD and session UI.
4. Mobile already has the approved route shape. Verify warehouse links, zone-scoped reads, section routes and editors; make only missing interaction corrections. Keep existing counts, QR and inventory operations.
5. Update relevant route, screen and browser regressions. Prove warehouse has no embedded location manager, zone reads are scoped, editors submit the correct zone/section, Back restores context and missing access/error/empty states work. Run Web check/build and focused browser acceptance; Mobile typecheck/full suite. Verify the live local screen with existing two-zone/50-part fixtures and keep runtime sessions alive.

Ledger: backend DTOs have no section/shelf counts on warehouse zone rows. Reuse existing position metrics in the warehouse and actual structure counts in the dedicated zone panels; do not add broad tenant-wide reads just to decorate overview rows.

Implementation ledger:
- Initial route/screen regression run: 10 failed, 80 passed, confirming the missing zone route/overview behavior before implementation.
- Added the protected zone route and keyed detail screen. Physical warehouse zones link to their own route independently of parts.view. System zones retain the existing parts filter.
- Moved section/shelf management to the zone screen, scoped API reads by zone and defensively filtered zone/warehouse ownership. Fixed-zone mode removes the redundant picker. Existing contents, QR, editors, scrolling and pagers are reused.
- Newly created sections become selected. Completed mutations cannot navigate after unmount or ownership-signal abort.
- Focused regressions: 99 passed. Browser acceptance: 1 passed on 1440/390/320 px, including shelf paging, 50-part contents, search/reload and Back restoration. The test also builds the QA artifact locally; no deployment occurred.
- Live local backend: warehouse overview → Стелаж1, section switching, separate стелаж 2 with its own 10 sections, and existing 52-position section contents verified. Screenshot: /tmp/rozbirka-zone-detail-local.jpg.
- Mobile: existing warehouse → zone → section → shelves navigation already meets this design, so no additional product code was needed. Typecheck passed; full regression suite 1261 passed. Native handset walkthrough was not performed in this task.
- Final independent review: no important findings; reviewer also ran the 99 focused regressions successfully.

| Acceptance scenario | Result | Evidence |
| --- | --- | --- |
| Warehouse is a zone overview; selected zone has dedicated management | Passed | Unit regressions, mocked browser flow and real local API walkthrough |
| Zone-only reads and permissions, system/archived structure guards | Passed | Screen tests, scoped requests and independent code review |
| Compact sections/shelves/contents, paging and Back context | Passed | Chromium at 1440, 390, 320 px; 50 mocked parts and 52 real local positions |
| Mobile route hierarchy | Passed in code/regressions | Existing route chain and full mobile suite; native visual check remains unverified |

Source: Web ad6b5a5 plus preserved local changes in codex/inventory-zone-shelves; Mobile f15e08e plus existing local changes in codex/mobile-part-zone-qr. Counting, reservations and stock business rules were not changed by this navigation task. Existing warehouse zone rows retain position metrics; structure counts are shown inside the zone panels because the overview DTO has no section/shelf counts.

Final verification: npm run check passed (dependency health, typecheck, lint, formatting, parity, unit, contract and integration suites). QA build passed as part of browser acceptance. Local Web and Metro status returned 200; authenticated live zone/contents reads succeeded against the local Core gateway. Runtime sessions preserved. No push, merge or deployment.
