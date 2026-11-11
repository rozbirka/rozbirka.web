# Verified Web releases

`Deploy Rozbirka Web` produces one environment-specific release set after all
static, unit, contract, integration, five-browser, authenticated smoke and
existing release budget gates pass. It contains `dist`, the Worker compiled by
Wrangler's release dry-run, a resolved runtime config and SHA-256 file manifest.
Production retains Lighthouse. QA/production artifacts are not interchangeable.

## Prepare and deploy

Pushes to `main` prepare a production package once. Pushes to `develop` prepare
and automatically deploy QA using that same package. A manual preparation uses
the existing workflow on the intended branch, selects `qa` or `prod`, leaves
`release_run_id` empty, keeps `skip_e2e` false and sets `enable_deployment` false
(the default). Manual deployment requires `enable_deployment` true and an
existing `release_run_id`; an empty ID fails before quality/build jobs start.
Production requires `main` and the existing protected environment approvals.
Pull requests validate independently and never publish a deployable release.

The immutable artifact is `web-release-<run-id>-<producer-attempt>`, retained for
30 days. Record its workflow run ID and source SHA. The release resolver verifies
the repository, workflow, push/manual event, source branch/SHA, every required
successful gate and sealing job, artifact run binding and archive digest. The
deployer checks out that source SHA, verifies all packaged file checksums and
uses `wrangler deploy --no-bundle`; it runs route checks against the target.

## Retry or resume

After a deployment or route-check failure, use **Re-run failed jobs**, which
retains the successful producer and release resolution. To resume in a new run,
dispatch on the same source branch/environment, enable deployment and supply the
original `release_run_id`. The branch may have advanced; the package's exact
source SHA supplies deployment tooling. These supported retry paths never rerun
build, tests, Lighthouse or Worker bundling. Environment approval and live route
checks still apply. A source run whose deployment failed is eligible once its
producer and all gates succeeded. A later run attempt does not invalidate its
original seal.

A run without a sealed artifact (failed validation, skipped E2E, PR, expired or
deleted artifact) cannot be resumed as a deployment. Start a fresh preparation
dispatch to validate again. **Re-run all jobs** is an explicit rebuild operation;
use the supported retry paths to preserve the verified package. Existing
pre-change `web-dist` artifacts are not eligible.

Keep the producer job/gate names and `scripts/web-release.mjs` trust policy in
sync when changing the pipeline. Do not overwrite an uploaded artifact or add
build hooks to the packaged runtime config.
