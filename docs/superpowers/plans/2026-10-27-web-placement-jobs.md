# Web placement jobs implementation plan

Goal: use the existing AsyncWorker placement jobs for web bulk placement, matching mobile behavior.
Architecture: generated API aliases/client calls; bulk Sheet creates one idempotent job and polls status; unassigned list restores recent jobs after closing or navigation. Single placement retains its existing write path. No backend contract changes, no publication.

- [x] Confirm deployed-source endpoint/DTO and mobile behavior; preserve 1000-part server limit, section/shelf semantics, per-item results and tenant/user scope.
- [x] Add typed start/get/list client methods with request tests.
- [x] Replace multi-part loop with one start request, stable operation ID across unknown responses, bounded polling and read-only retry.
- [x] Present progress, allow minimizing once accepted, show compact per-item results, retry only failed and untouched IDs with a new operation ID.
- [x] Restore recent owned jobs from source-zone list; refresh contents once on terminal job state; guard tenant changes/unmount and pause background/offline polling.
- [x] Adapt existing bulk regressions, verify 80-part constant request count, retries, pending requests, recovery and both themes/viewports in browser.
- [x] Independent review; full check and QA artifact build. Keep changes local for user review.
