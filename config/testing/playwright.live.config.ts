import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  testDir: projectRoot + '/e2e',
  testMatch: 'real-gemini.live.ts',
  workers: 1,
  retries: 0,
  timeout: 60000,
  outputDir: projectRoot + '/test-results',
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.SOCHAT_LIVE_TEST_URL ?? 'http://localhost:8080',
    trace: 'off',
    screenshot: 'off',
  },
});
