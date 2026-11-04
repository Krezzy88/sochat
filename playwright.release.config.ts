import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'release.check.ts',
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'https://localhost:18143',
    ignoreHTTPSErrors: true,
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    { name: 'release-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'release-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node --experimental-strip-types e2e/release-server.ts',
    url: 'https://localhost:18143/healthz',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
