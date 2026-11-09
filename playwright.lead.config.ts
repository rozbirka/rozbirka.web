import { defineConfig, devices } from '@playwright/test'

const coreDirectory = process.env.LEAD_E2E_CORE_DIR
if (!coreDirectory)
  throw new Error('Set LEAD_E2E_CORE_DIR to the Core checkout')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'landing-lead-real-core.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { locale: 'uk-UA', serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'dotnet build tests/Rozbirka.LeadE2EHost --no-restore --disable-build-servers -m:1 && dotnet run --no-build --no-restore --no-launch-profile --project tests/Rozbirka.LeadE2EHost',
      cwd: coreDirectory,
      env: { ASPNETCORE_ENVIRONMENT: 'LeadE2E' },
      url: 'http://127.0.0.1:54831/_test/stats',
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command:
        'npm run build:prod && npx vite preview --host 127.0.0.1 --port 54832 --strictPort',
      url: 'http://127.0.0.1:54832',
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
})
