import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  testDir: projectRoot + '/e2e',
  testMatch: 'app.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: projectRoot + '/test-results',
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.SOCHAT_TEST_URL ?? 'http://localhost:18080',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'compose-chromium' }],
});
