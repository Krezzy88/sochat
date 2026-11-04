import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: projectRoot,
  test: {
    coverage: {
      provider: 'v8',
      thresholds: { lines: 88, statements: 88, branches: 78, functions: 93 },
      include: ['apps/api/src/db/**/*.ts', 'apps/api/src/http/**/*.ts'],
      exclude: ['**/*.integration.ts', '**/*.test.ts'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/integration',
    },
    include: ['apps/api/src/db/**/*.integration.ts'],
    hookTimeout: 120000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
