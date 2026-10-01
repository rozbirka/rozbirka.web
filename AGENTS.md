# AI Agent Guide: `rozbirka.web`

## Scope

This repository contains the public Rozbirka website, authentication and account flows, SEO-aware React routes, prerendered output, and the Cloudflare Worker that serves the application. Keep changes limited to this repository unless the task explicitly coordinates a contract change with `rozbirka.core` or `rozbirka.mobile`.

## Repository map

- `src/routes/` — route declarations and router composition.
- `src/screens/` — route-level screens, including login and account.
- `src/components/site/` and `src/components/layout/` — public marketing sections, navigation and layout.
- `src/components/app/` — cabinet and product UI kit (`@/components/app`).
- `src/cabinet/` — cabinet shell, modules and screens.
- `src/components/ui/` — button for the dev-only `/screens` prototypes; not used by the landing or the cabinet.
- `src/auth/` — authentication context and route guards.
- `src/api/` — API client, auth, tenant, billing, token, and shared API types.
- `src/seo/` — page metadata and structured data.
- `src/entry-server.tsx` — SSR entry used by prerendering.
- `src/assets/` and `public/` — source, optimized, and static assets.
- `worker/` — Cloudflare Worker entry and request handling.
- `scripts/` — prerender, production-route, asset, and performance checks.
- `e2e/` and `playwright.config.ts` — browser and accessibility coverage.
- `wrangler.jsonc` — QA and production Cloudflare configuration.

## UI documentation

Before UI changes read [docs/ui/index.md](docs/ui/index.md), then only the relevant
foundations, components, patterns, platform and verification documents. Follow
links to actual code before choosing styles or controls. The guide explicitly
documents the user-selected working branch including cabinet changes; it does
not assert that those changes are merged or deployed. Revalidate its sources
when moving to another branch. Do not silently turn observed patterns into
new business rules or global design standards.

## Stack and commands

### Local cabinet startup (mandatory)

Read `LOCAL-DEVELOPMENT.md` before starting/restarting the local cabinet.
Plain `npm run dev` does not provide the session BFF in this setup.
Use `npm run dev:local` for daily development: Vite HMR on 5173 plus local
Wrangler BFF on 8787. Reserve the build-and-serve flow for release-like checks.
Do not report the cabinet working from a landing-page HTTP 200 or an anonymous
`/session/refresh` 401. Verify the requested cabinet route and distinguish
service health from an authenticated session. Never substitute QA endpoints.

The app uses React 19, React Router 7, TypeScript 6, Vite 8, Tailwind CSS 4, Radix UI, Vitest, Playwright, and Wrangler. Use the committed lockfile and the Node/npm versions CI uses: Node 22 (`.nvmrc`, `engines`) and npm 11.16+ (`packageManager`). npm does not enforce `engines` here (and repo-wide `force=true` hides the warning), so check `node -v` yourself: a newer local Node may give results that differ from CI.

- Install dependencies: `npm ci`
- Start locally: `npm run dev:local` (plain `npm run dev` is Vite only, without the session BFF)
- Run the standard validation gate: `npm run check`
- Build the default target: `npm run build`
- Build environment variants: `npm run build:qa` and `npm run build:prod`
- Check generated routes and prerender output: `npm run check:routes` and `npm run check:prerender`
- Run browser tests: `npm run test:e2e`
- Check asset and Lighthouse budgets: `npm run budget:assets` and `npm run audit:lhci`
- Run the quality gate: `npm run verify:quality`
- Run production artifact checks: `npm run verify:release:prod`

Before handing off a change, run `npm run check` and the build most relevant to the target environment. Add focused tests when behavior changes. `verify:quality` runs non-browser checks, browser tests and cabinet smoke. `verify:release:prod` runs build/artifact, Lighthouse, asset-budget and Wrangler dry-run checks and may require the environment expected by CI.

## Change guidelines

- When adding or changing a route, update its route declaration, SEO metadata, structured data when applicable, prerender coverage, navigation, and route tests together.
- Keep API calls in `src/api/`; reuse the shared client and types instead of creating screen-local HTTP code.
- Treat authentication and tenant selection as security boundaries. Preserve token clearing on failed refresh or logout, send the selected tenant through the shared client, and never trust a client-selected tenant without server-side authorization.
- Do not expose secrets in `VITE_*` variables, client bundles, rendered HTML, committed environment files, or `wrangler.jsonc`. Only values intentionally public to the browser belong in client environment variables.
- Do not document or depend on unmerged feature branches, except in an explicitly labelled working snapshot such as `docs/ui`, which names its branch, HEAD and local changes. Confirm behavior against the target branch and generated API contract.
- Preserve semantic landmarks, keyboard navigation, visible focus, contrast, reduced-motion behavior, and existing accessibility tests.
- Keep large source images out of runtime paths. Use the asset pipeline and optimized AVIF/WebP variants, and respect asset and Core Web Vitals budgets.
- Keep QA and production behavior aligned. Any Cloudflare route, Worker, or deployment change must be reflected in `wrangler.jsonc` and the relevant workflow, without committing credentials.
