import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'off', screenshot: 'off' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run e2e:serve',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
