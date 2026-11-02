import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.ts', workers: 1, fullyParallel: false,
  globalSetup: './tests/fixtures/setup.ts',
  use: { baseURL: 'http://127.0.0.1:4317' },
  webServer: { command: 'pnpm exec tsx tests/fixtures/dev-server.ts', wait: { stdout: /Ready in/ }, stdout: 'pipe', reuseExistingServer: false, timeout: 120000 },
  projects: [ { name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } } ],
});
