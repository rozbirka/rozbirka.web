# Part sticker print queue implementation plan

**Goal:** Complete the agreed sticker scope by giving parts the same queue lifecycle as storage labels while preserving part hand-off URLs and sticker layout.

**Architecture:** Reuse the tested queue persistence, ownership, revision and Web Lock behavior. Keep parts and locations in separate namespaces. Each physical part sticker copy has a stable queue ID: batches contain at most 20 copies, the queue at most 200 pending copies, and only explicit user confirmation advances progress. Existing part selection and quantity controls stay separate from the active queue; old saved selections and `?part=` links remain valid.

**Scope correction:** The earlier statement that part printing was out of scope was incorrect. Only the existing navigation flow was to remain unchanged. This document records the user's correction and implementation, without introducing another approval gate.

- [x] Extract shared persistence/ownership machinery without changing location queue semantics; run all existing location store tests.
- [x] Add copy-aware part queue operations and store with tests for split batches, arbitrary partial acknowledgement, removal, append, limits, persistence, owner reset and stale writes.
- [x] Integrate a part printing controller and queue UI into the existing parts screen. Preserve selection, availability limits, QR output, document locale, download/share and hand-off URLs. Re-fetch every emitted batch; open print popups before asynchronous work; fail the whole batch when a requested part is unavailable.
- [x] Add regression scenarios: 25 copies → print 20 → confirm 7 → reload with 18 pending; no progress after PDF/download/share, blocked popup or nothing printed; partial copies of one part; queue editing/cancel/append; tenant and external storage changes during output.
- [x] Run focused tests, `npm run check`, `npm run build:qa`; update the manual QA flow. Browser testing remains with the user.
