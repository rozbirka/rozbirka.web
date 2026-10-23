# Inventory Location Hierarchy and QR Design

**Date:** 2026-10-10  
**Status:** Proposed for review  
**Repositories:** `rozbirka.core`, `rozbirka.web`, `rozbirka.mobile`

## Goal and agreed rule

A part may be stored at any terminal level of **warehouse → zone → section
(rack) → shelf**. The operator may stop after any level, but cannot select a
descendant while omitting an ancestor. Each physical level has its own stable
QR code and printable label. Scanning identifies a location; the screen where
the scan starts determines what happens next.

The existing system `Без зони` / unassigned zone represents a part placed in a
warehouse without a physical zone. It is not a physical location and gets no
QR label.

## Current behavior and approaches considered

Core currently stores a required zone and an optional shelf on a part-location
link. A selected section without a shelf is only UI state and disappears on
save. Zones and shelves already have QR codes; warehouse and section DTOs do
not. Mobile resolves zone QR for zone counting and shelf QR for part placement.
Web prints zone and shelf labels. The general mobile scanner handles parts.

1. **Recommended: extend the existing part-location link.** Add nullable
   `SectionId`; retain required `ZoneId` and nullable `ShelfId`. Represent a
   warehouse-only selection with its existing system unassigned zone. Add
   typed QR identities for warehouses and sections while retaining existing
   zone and shelf values. This preserves historical placement and counting
   data with a focused migration.
2. **Replace all placements with a generic location tree.** This models every
   level uniformly, but rewrites inventory membership, counting, reporting,
   imports, and existing clients. The migration and compatibility risk are
   disproportionate to the requested behavior.
3. **Keep section selection only in the UI.** This would appear to work until
   reload and would misrepresent the saved location. It is rejected.

## Persistence and API contract

Each part-location link retains its warehouse through the selected zone:

| Visible terminal level | Stored zone | Stored section | Stored shelf |
| --- | --- | --- | --- |
| Warehouse | That warehouse's system unassigned zone | `null` | `null` |
| Zone | Selected physical zone | `null` | `null` |
| Section | Parent physical zone | Selected section | `null` |
| Shelf | Parent physical zone | Parent section | Selected shelf |

Extend the placement request and response with nullable `sectionId` and
section details. Existing requests that send zone IDs and a shelf ID remain
accepted: the server derives the section from the shelf. A section-only
request sends its section ID; the server verifies that it is active and belongs
to a selected zone. If a shelf is supplied, it must belong to the supplied or
derived section and selected zone. If several zones are selected, the
section/shelf applies only to its parent zone; the other zone links remain
zone-level. The server rejects mismatched ancestors, archived targets, and
cross-tenant IDs. No client may persist a section or shelf without its parent
chain. Existing links with a shelf gain a section from that shelf during the
database migration; zone-only links retain `null` section.

Expose a stable `qrCode` in warehouse and section DTOs using typed values
`inventory-warehouse:<id>` and `inventory-section:<id>`. Existing zone and
shelf QR values are unchanged. QR identity is based on the immutable ID, not
the editable name or human code. A tenant-scoped location resolver returns
the matched type, ID, full ancestor path, and active state; it does not mutate
placement or counting data. Existing zone/shelf resolve endpoints remain
available to older mobile builds. Scans of another tenant's or an archived
location fail with a user-readable error.

## User flows

### Manage and label locations

In Web and Mobile, users with location-management permission create or edit
the hierarchy in order. Each physical warehouse, zone, section, and shelf
shows its QR and offers a printable label. The label states its type, name,
human code, and full path; its encoded QR identity stays stable after a
rename. The label generator uses the tenant's document language. Existing
zone and shelf labels keep their current QR content.

### Place a part

The location step begins with a warehouse. At each level it offers **Save
here** and **Choose next level**. Choosing a section requires a zone;
choosing a shelf requires a section. A QR scan in this step selects the
scanned level and all its ancestors, then lets the operator save at that
level or continue downward. A shelf scan fills the complete path. Manual
selection remains available. The saved part and placement screens display
the true terminal level, including warehouse-only and section-only, without
inventing a more precise location.

### Scan outside placement

The general Mobile scanner opens the matching location in the inventory
hierarchy. Warehouse QR opens its warehouse screen; zone QR opens its zone;
section and shelf QR open the parent zone with that section or shelf in view.
Part QR continues to open the part. Web remains a label and management
surface; no browser camera flow is introduced.

### Inventory count

Counting remains zone-based. A zone QR opens that zone's counting flow. A
section or shelf QR resolves its parent zone and opens that zone's counting
flow while identifying the scanned child to the operator. A warehouse QR
prompts for a zone. Scanning a location never counts a part: only the part
QR records a part scan. Existing offline scan and lease behavior remain
unchanged.

## Delivery and compatibility

Implement Core schema, migration, validation, resolver, and OpenAPI contract
first. Update Web and Mobile clients against that contract; do not emit new
warehouse/section QR labels to users until the receiving Mobile build can
resolve them. Old clients continue using existing zone/shelf QR and placement
requests. Keep this feature isolated from unrelated local changes in the
three repositories. Local verification precedes any push or PR; release
requires the normal operator approval and pipeline gates.

## Verification

- Core tests cover all four terminal levels, migration of existing shelf
  links, multi-zone placement, invalid ancestors, archived locations,
  tenant isolation, stable QR after rename, and legacy requests.
- Web tests cover nested labels, correct full path, printing all four QR
  types, and saving at each terminal level.
- Mobile tests cover scanning by context, manual step-by-step selection,
  saving at each level, invalid QR feedback, and unchanged part/zone/shelf
  scan paths. Physical-device QA checks camera scanning and printed labels.
- Inspect an existing Rozbirka part with only a zone and one with a shelf
  after migration to confirm their displayed and stored locations agree.

## Out of scope

Shelf-level or section-level stocktake sessions, moving a part merely by
scanning outside its placement form, browser camera access, and a new generic
location-tree storage subsystem.
