import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'real-gemini.live.ts',
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.SOCHAT_LIVE_TEST_URL ?? 'http://localhost:8080',
    trace: 'off',
    screenshot: 'off',
  },
});
