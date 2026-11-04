import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'expansion.live.ts',
  workers: 1,
  retries: 0,
  timeout: 90000,
  use: { baseURL: 'http://localhost:8080', trace: 'off', screenshot: 'off' },
});
