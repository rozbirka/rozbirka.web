# QA Web workflow repair — 2026-09-20

Failed run: https://github.com/rozbirka/rozbirka.web/actions/runs/35527437395

## Evidence and changes

- Unit gate passed 987 tests and contract tooling passed 175 tests. The contract download failed with `iam.serviceAccounts.getAccessToken` denied.
- The CI provider already requires owner `rozbirka`, but `web-contract-reader@rozbirka-ci.iam.gserviceaccount.com` still trusted `oleksiilopatskyi-del/rozbirka.web`. Replaced that exact `roles/iam.workloadIdentityUser` binding with the current `rozbirka/rozbirka.web` principal in pool `projects/905241582497/locations/global/workloadIdentityPools/github-pool`. No broad token-creator grant was added. Existing Platform configuration and canonical CI tfvars already specify owner `rozbirka`.
- Once contracts could be read, local drift check exposed a stale manifest: it pinned Core commit `9e16571ab0c8c19d0893be80fed54003d306bb9e`, while committed Web types had already changed.
- Ran Core's `scripts/publish-openapi.sh` with contract commit `1c0162db70a0452ee0ced925019b65db79495298`. Its schema drift check passed; upload used generation-match0 into the private CI bucket. Pinned `contracts/openapi-sources.json` to that immutable object and SHA-256 `1a7e5f75315617461e0a728fa447835e0d8ad09bbe19dd58851a0ee327af5746`, then regenerated Core types. Legacy Identity contract remains pinned for existing type consumers; this does not invoke or restore Identity runtime.
- Browser jobs failed because ready-report and pending-payment fixtures contained absolute expirations already in the past. Chromium showed 8 failures in report readiness/accessibility/layout and pending checkout controls. UI correctly treated the fixtures as expired. Fixture expiry is now relative to test execution; product expiry checks and assertions remain intact.

## Verification

Run `npm run check`, `npm run build:qa`, and manifest download plus `npm run contracts:check`. Contract HTTP fixture tests require local loopback access; a sandbox EPERM was resolved by running the same gate with loopback permission.

Browser coverage is verified in the repeated GitHub Actions matrix (chromium,firefox,webkit,ios,android), without local browser/CUA use. Record the new run's result before declaring QA CI green. These repairs do not deploy production or alter live billing products.

## Confirmed result

Run https://github.com/rozbirka/rozbirka.web/actions/runs/35528246007 completed **success** on commit `78a4edbacc5af914b34572f1072194d4b248b7cd`: Quality, all five browser profiles, authenticated Chromium smoke, release artifact and QA deployment passed. Cloudflare QA Worker version: `7e0c52b0-4137-4611-bc03-ec9189fc0669`. Local `npm run check`, `npm run build:qa` and downloaded immutable contract drift check also passed. Production unchanged.
