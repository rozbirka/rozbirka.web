# Parts import implementation plan

**Goal:** Deliver the user-approved six-screen import flow in ROZ-104 and reduce measured backend read round trips.
**Architecture:** Tenant-scoped routes reuse cabinet access and API client. Backend remains authoritative for schema, validation, digest, lifecycle and retries. UI state is discarded on tenant/session changes; upload and commit keys survive uncertain retries within the mounted flow.
**Tech stack:** React, TypeScript, Vitest, ASP.NET Core, EF Core, PostgreSQL.
**Spec:** User-approved screenshots in this conversation, 2026-09-15 16:17–16:19: history, file with source preview, mapping with shared values, row review, confirmation, execution/results.

## Constraints
- Existing ROZ-104 branch and ROZ-132 worktree. Preserve unrelated local changes and .ua.
- User authorized committing and pushing the completed changes. No merge, deployment, additional tasks or agents.
- No inferred currency conversion, condition, split of 1L-1R, or unsupported editing of source cells.
- No customer values or tokens in diagnostics. Statuses reflect evidence, not release claims.

## Tasks
- [x] Backend: reduce ImportPreparationService.AuthorizeAsync from three round trips to one projection, preserving tenant/member/permission errors and repeated checks. ImportReadQueryBudgetTests target status 8, rows 7, history 4 (baseline 12/11/6). Cover inactive membership, revoked permissions, cross-tenant lookup and revision change. Run import tests and full Core/Aspire checks.
- [x] API: add src/api/part-imports.ts with upload, capabilities, history/status, rows/errors, mapping/analysis, validate/commit, cancel/retry, profiles and reports. Preserve multipart delimiter and encoding; use shared cancellation and error handling. Validate wire behavior with API tests.
- [x] UI: add src/cabinet/imports/ImportScreen.tsx and focused components/models. Register parts/imports and parts/imports/:importId, plus an inventory-list entry. Use server schema for mapping and explicit shared values; preserve source preview and profile conflicts. Selection is version-bound; confirmation requires a fresh digest and exact selection. Poll only active imports with bounded sequential requests and cleanup.
- [x] Tests: resumed draft through confirmation, invalid selection, uncertain commit retry key, stale server revision, unmount, permissions, terminal polling model, source-column exclusions, multipart upload and reference-picker StrictMode lifecycle. Run npm run check and npm run build:qa. Review rendered UI against screenshots.
- [x] Record before/after evidence and remaining release prerequisites in the verification report. Linear statuses remain unchanged; local implementation is ready for review, not a release.
