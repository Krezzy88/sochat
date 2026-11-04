import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  testDir: projectRoot + '/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: projectRoot + '/test-results',
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'off', screenshot: 'off' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    cwd: projectRoot,
    command: 'npm run e2e:serve',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
