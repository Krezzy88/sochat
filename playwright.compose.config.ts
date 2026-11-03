import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'app.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:18080',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'compose-chromium' }],
});
