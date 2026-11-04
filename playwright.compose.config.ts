import process from 'node:process';
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
    baseURL: process.env.SOCHAT_TEST_URL ?? 'http://localhost:18080',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'compose-chromium' }],
});
