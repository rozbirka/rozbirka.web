# Local web cabinet — workstation runbook

## Invariants

- Browser origin: `http://localhost:5173`. Do not alternate with 127.0.0.1 in
  browser URLs: cookies are host-specific.
- Browser API: `VITE_API_URL=http://localhost:8088`.
- BFF: `IDENTITY_ORIGIN=http://localhost:8088`, explicitly overridden at launch.
- Never use QA API/auth/database as a fallback. Preserve cookies, volumes,
  `.dev.vars`, and `.wrangler/state`.
- Do not switch branches or discard dirty work to start the app.

## Existing local backend and data

The selected checkout for this task is
`/Users/admin/code/rozbirka/rozbirka.core/.worktrees/part-search-web-fields`.
Revalidate the checkout with the user if the requested branch changes.

Its ignored `orchestration/Rozbirka.AppHost/appsettings.Development.json` pins:

```json
{
  "ROZBIRKA_POSTGRES_VOLUME": "rozbirka.apphost-841cb8679a-postgres-data",
  "ROZBIRKA_REDIS_VOLUME": "rozbirka.apphost-841cb8679a-redis-data"
}
```

Check these volumes exist and inspect actual container mounts after starting.
An AppHost path change previously generated an empty database volume. Never
accept a newly generated volume as the user's existing database. The last
verified baseline was 17 tenants, 2630 parts, 20 cars (not a permanent invariant).
Do not restore/import a database or delete volumes as part of routine startup.

Inspect existing listeners/processes first. Reuse a healthy matching backend.
If absent, run in a persistent terminal from that Core checkout:

```sh
ROZBIRKA_GATEWAY_URL=http://localhost:8088 dotnet run --project orchestration/Rozbirka.AppHost/Rozbirka.AppHost.csproj --launch-profile http
```

Wait for `/health/core` and `/health/identity` on localhost:8088 to return 200.
Aspire starts dependencies and AsyncWorker; do not create duplicates. A running
AsyncWorker process alone does not prove message handling.

## Build and serve the web with BFF

From `/Users/admin/code/rozbirka/rozbirka.web`, preserve existing environment
settings and confirm `.dev.vars` has the local Identity origin without printing
other secret values. Inspect inherited VITE variables for conflicting overrides.

```sh
npx tsc -b && VITE_API_URL=http://localhost:8088 npx vite build --mode development && VITE_API_URL=http://localhost:8088 npx vite build --ssr src/entry-server.tsx --outDir dist-ssr --mode development && node scripts/prerender.mjs
```

After successful build, run in a persistent terminal:

```sh
npx wrangler dev --local --ip 127.0.0.1 --port 5173 --var IDENTITY_ORIGIN:http://localhost:8088
```

For a restart, resolve and stop only this existing web process, then relaunch.
Do not kill unrelated Node processes or restart the database unnecessarily.
Wrangler serves built assets: source edits require another build. This is not
a Vite hot-reload setup. Do not claim fresh source is served without rebuilding.

## Completion checks

1. Core and Identity health are both 200; actual database mount is correct.
2. Web assets and session BFF routes are reachable. An anonymous refresh 401
   verifies only the route, not upstream Identity or a working login.
3. Inspect the browser page and console. `/` is the public marketing site,
   not the cabinet. Preserve the user's current route when restarting.
4. Verify the user's cabinet route, e.g.
   `http://localhost:5173/app/cardubliany-mock/dashboard`, when that tenant is
   still selected. Check visible data and session restoration after reload.
5. If login is required, say that explicitly. Do not invent credentials, send
   an SMS merely as a health probe, or claim authenticated verification.
6. If the user reports failure but only a normal login page is visible, ask
   for the failing action/error rather than guessing or restarting blindly.

Keep long-running terminals alive. Report exactly what was verified, including
any remaining login or browser-level blocker.
