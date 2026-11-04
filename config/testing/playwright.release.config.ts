import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  testDir: projectRoot + '/e2e',
  testMatch: 'release.check.ts',
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: projectRoot + '/test-results',
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
    cwd: projectRoot,
    command: 'node --experimental-strip-types e2e/release-server.ts',
    url: 'https://localhost:18143/healthz',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
