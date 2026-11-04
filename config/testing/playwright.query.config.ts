import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  testDir: projectRoot + '/e2e',
  testMatch: 'query.live.ts',
  outputDir: projectRoot + '/test-results',
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: { baseURL: 'http://localhost:8080', trace: 'off', screenshot: 'off' },
});
