# Parts import verification — 2026-09-15

## Result

Implemented the approved six-screen Web flow in the existing ROZ-104 worktree: history, upload and source preview, column mapping and shared values, row review, server validation and confirmation, execution and reports. Routes use cabinet access control and the shared tenant-scoped API client. Draft UI state is keyed to tenant, user, generation and import ID. Explicit source exclusions use source-column IDs. Commit retries reuse their key; a stale revision invalidates confirmation.

Oleksii’s branch changes are integrated by local fast-forward. At the final fetch, local and remote `vsobol/roz-104-frontend-rozbirkaweb-primary` both point to `5d546610616f5ccb44a4696077d0ef1f6ecc0b41`. This includes gallery loading, larger typography, full-width screens and CODEOWNERS. Import changes are prepared for publication in this feature branch.

## SQL measurement

The ROZ-132 change combines the active tenant, active membership and parts.manage predicates into one SQL projection per authorization check. Rechecks remain fresh; no cache, transaction or write-path changes were introduced.

| Read operation | Before | After |
| -------------- | -----: | ----: |
| Import status  |     12 |     8 |
| Rows page      |     11 |     7 |
| History page   |      6 |     4 |

Measured with an EF command interceptor against PostgreSQL using the same single-import fixture. These are database command counts, not elapsed-time or throughput benchmarks. The regression test also revokes permission between the first import read and its second admission check and expects FORBIDDEN. Inactive membership and an unavailable tenant return NOT_FOUND.

## Verification

- `npm run check`: passed; 850 unit, 164 contract and 47 integration tests (1,061 total).
- `npm run build:qa`: passed, including SSR and prerender.
- Core with PostgreSQL and PubSub emulator: 1,297 passed, zero skipped. The later added permission-revocation race assertion also passed in a targeted run; production code did not change after the full run.
- Aspire tests: 4 passed.
- Real local API smoke: multipart TAB CSV upload → analysis → mapping → rows passed. Explicit skipped source column accepted; quantity 1.0 normalized to 1. The fixture was cancelled; no commit submitted.
- Playwright visual check of the actual React import screen with fixture responses: 1,440px desktop and 390px mobile, no horizontal overflow or JavaScript errors. This is separate from authenticated browser-to-server end-to-end coverage.
- StrictMode reference lookup and stale HTTP revision regressions were observed failing before their fixes and passing afterward.

## Review boundaries

Rows are paginated in groups of 100 and selected per page. Large files can be selected across pages; there is no global select-all control. Confirmation shows the counts supplied by the server; the contract does not expose total available inventory units. Photos can be mapped from prepared keys; this UI does not prepare media or create reference entities. These boundaries avoid inventing server behavior beyond the approved core flow.

At the time of the initial verification, no remote push, deployment or Linear mutation had been performed. The user subsequently authorized committing and pushing the Web and Backend changes. Existing backend work and the original PostgreSQL volumes were preserved. The local running API was used for wire verification; SQL command measurements came from tests of the changed backend, not that pre-existing process.

## Local evidence

- `/tmp/roz104-import-check-final.log`
- `/tmp/roz104-import-build-qa.log`
- `/tmp/roz104-wire-smoke.log`
- `/tmp/roz104-visual-check.log`
- `/tmp/roz104-import-review-desktop.png`
- `/tmp/roz104-import-mapping-desktop.png`
- `/tmp/roz104-import-mapping-mobile.png`
- `/tmp/roz132-import-sql-full.log`
- `/tmp/roz132-import-aspire-tests.log`
- `/tmp/roz132-sql-read-red.log`
- `/tmp/roz132-sql-read-green.log`
- `/tmp/roz132-sql-race.log`
