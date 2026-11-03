import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['apps/api/src/db/**/*.ts', 'apps/api/src/http/**/*.ts'],
      exclude: ['**/*.integration.ts'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/integration',
    },
    include: ['apps/api/src/db/**/*.integration.ts'],
    hookTimeout: 120000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
