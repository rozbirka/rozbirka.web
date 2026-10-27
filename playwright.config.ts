import { defineConfig, devices } from '@playwright/test'
import { e2ePorts } from './e2e/ports'

// CI runners have 4 vCPUs: two workers, each with a browser, a Worker runtime
// and a stub upstream.
const workers = process.env.CI ? 2 : 1
const stacks = Array.from({ length: workers }, (_, index) => e2ePorts(index))

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate:
    '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  // Tests spread over workers one by one, not file by file: most of them live
  // in cabinet-shell.spec.ts. Each worker gets its own server pair below.
  fullyParallel: true,
  workers,
  retries: 0,
  // The app picks its language from the browser; the suite asserts Ukrainian
  // copy, so pin the browser locale instead of inheriting en-US. The fixtures
  // in e2e/fixtures.ts point baseURL at the worker's own app server.
  use: { baseURL: `http://127.0.0.1:${e2ePorts(0).app}`, locale: 'uk-UA' },
  // Playwright starts these in order, so the first app server builds dist
  // before the others serve it.
  webServer: [
    ...stacks.map(({ upstream }) => ({
      command: 'node scripts/auth-e2e-upstream.mjs',
      env: { E2E_UPSTREAM_PORT: String(upstream) },
      url: `http://127.0.0.1:${upstream}/_test/stats`,
      reuseExistingServer: false,
    })),
    ...stacks.map(({ app, upstream }, index) => ({
      command: [
        ...(index === 0 ? ['npm run build:qa &&'] : []),
        `npx wrangler dev --env qa --local --ip 127.0.0.1 --port ${app}`,
        `--inspector-port ${9229 + index} --persist-to .wrangler/e2e-${index}`,
        `--var CORE_ORIGIN:http://127.0.0.1:${upstream}`,
        '--var AUTH_REGISTRATION_KEY:e2e-registration-fixture-only',
      ].join(' '),
      port: app,
      reuseExistingServer: false,
    })),
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'android', use: { ...devices['Pixel 5'] } },
    { name: 'ios', use: { ...devices['iPhone 13'] } },
  ],
})
