# Web location label queue implementation plan

**Goal:** Match the approved mobile location-label selection and resumable queue on Web.
**Architecture:** A shared label selector composed from the cabinet UI kit, a scoped persisted queue, and the existing thermal-label renderer. List contexts remain separate: warehouse → zones, zone → sections, section → shelves.
**Spec:** User request in this chat, 2026-10-19; reuse the approved mobile flow.
**Constraints:** Web only; preserve inventory counting and existing navigation/design. Node 22. No product screenshots or browser acceptance checks: the user performs manual UI verification.

- [x] Pin queue behavior with tests: deduplication, 200 remaining-label limit, batches of 20, partial acknowledgement, removal, corrupt/expired storage and tenant isolation.
- [x] Implement queue core and live collection loader, never persisting stale QR payloads.
- [x] Build selection and queue UI with Sheet, DataTable, SearchInput, Card, Button and ConfirmDialog. Preserve choices across searches, support all and reset, show queued rows, individual removal and continuation from another collection. Browser print/PDF must not silently advance the queue.
- [x] Integrate label selection into warehouse, zone and section lists. Remove warehouse-label printing; preserve individual QR previews and unrelated inventory actions.
- [x] Verify focused tests, full npm run check, build and local Vite/BFF/API reachability. Request an independent code review, fix material findings and hand the local URL to the user.

**Review focus:** Stale tenant operations; archived/missing queued labels; selection across search/page changes; cancelled/partial system printing; restoring a queue from a different parent collection.

## Verification

Source: `codex/inventory-zone-shelves`, base `8f1e625`, plus local changes in the inventory label selector, queue, loader and integration.

- `npm run check`: passed (1,951 unit/contract/integration tests; typecheck, lint, formatting, dependency and parity checks).
- `VITE_API_URL=http://localhost:8088 npm run build`: passed.
- Independent code review: fixed inaccessible cancellation for archived queue parents and stale cancellation after a storage update; no remaining important findings.
- Local Vite, updated module, cabinet SPA route and Core/Identity health: HTTP 200. Anonymous BFF refresh: 401, route reachable; authenticated session not verified.
- Actual browser appearance, focus/responsive acceptance and physical printer output: left for user manual verification, as requested. No product screenshots, login attempts or business-data mutations performed.
- PDF uses the browser's system print dialog and Save as PDF; it never advances queue progress. Actual printing requires explicit acknowledgement of all or selected printed labels.

## Accepted visual correction (2026-10-19)

The user supplied the Web Stickers screen as the required reference. Replaced the location-label drawer with a full-page mode at the existing parent URL (`?labels=1`), using components extracted from the actual Stickers screen: `StickerWorkspace`, `StickerListPanel`, `StickerSelectionRow`, and `StickerSheetPreview`. Parts and location labels now share the header, two-column layout, selection styling and sheet preview. Queue progress, partial acknowledgement and scope isolation remain intact.

Verification after correction: 114 focused inventory/sticker tests passed, full check and local build passed. Regression tests cover keyboard/checkbox/row selection, disabled rows, full-page navigation and preventing output of the old queue while previewing new selections. Independent review found no remaining important issue after that preview/output fix. Browser appearance and physical printing remain for the user to verify manually.

## Accepted drawer presentation (2026-10-19)

After approving the sticker layout, the user requested a drawer. The same workspace now opens in the shared Sheet `workspace` size (up to 1440 px and 90vw on desktop). Its parent warehouse/zone/section view stays mounted behind the modal. The shared sheet supplies the title and close control; the workspace suppresses its duplicate heading. Other Sheet sizes and the standalone parts sticker page keep their existing presentation.

Verified: 162 focused inventory/sticker/app-kit tests, the full check (1,951 tests), local build, and updated Vite module reachability passed. Independent review found no important drawer integration issues. Manual visual and printer acceptance remain with the user.

## Accepted inline presentation (2026-10-19)

The user approved the first inline mockup: checkbox selection in the existing collection with the shared sheet preview and queue on the right. The print workspace now renders inside the warehouse zones card or the zone/section browser, preserving the current page heading, add controls, URL pathname and parent resource. The modal Sheet wrapper and global drawer mount have been removed. The existing `labels=1` query enables this local presentation; Finish selection restores the normal list, its filter and keyboard focus on the originating action menu.

The implementation reuses `StickerWorkspace`, `StickerListPanel`, `StickerSelectionRow` and `StickerSheetPreview`. Search spans both columns. Queue storage, scoped mutation guards, fresh label validation, partial print acknowledgement, PDF behavior and cross-tab safeguards remain in place. Inline cancellation also remains available if the queue's parent has been archived or cannot be loaded. Inventory sessions and counting behavior are unchanged.

Verified: 90 focused tests, `npm run check` (1,966 tests), local build, Core/Identity health and updated Vite source reachability passed. Product UI and physical printer acceptance remain for the user's manual check; no product browser visits, screenshots, login attempts or business-data mutations were performed.

## Accepted print simplification (2026-10-19)

The user explicitly removed the post-print acknowledgement dialog. As on Web Stickers, Print and PDF now open the browser print flow for all prepared labels (up to the existing 200-label queue limit) and return to the existing inline workspace. There is no follow-up selection screen or automatic acknowledgement. The prepared queue remains available for retry until explicitly edited or cancelled, including after browser cancellation or PDF export. Queue status shows the number of prepared labels rather than a physical-print progress claim. This supersedes the earlier twenty-label batches and manual partial-print acknowledgement described above. Tenant, stale-label, cross-tab and cancellation safeguards remain intact.

## Accepted direct selection editing (2026-10-19)

After preparation the main list checkboxes now edit the persisted selection directly. Selecting, deselecting, selecting all/matches and clearing update the preview, summary and Print/PDF counts immediately, without a separate Add or Edit Queue step. Search and pagination preserve the complete selection. Deselecting the last label clears the prepared queue and disables preparation until another label is chosen. Prepared labels removed from the hierarchy remain deselectable in the main list. The existing 200-label limit rejects oversized changes without losing the prepared selection; output locks edits while rendering and still rejects stale cross-tab or tenant operations.
