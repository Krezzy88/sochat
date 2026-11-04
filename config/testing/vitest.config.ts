import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: projectRoot,
  test: {
    environment: 'node',
    include: [
      'scripts/**/*.test.mjs',
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'eval/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'scripts/check-runtime.mjs',
        'apps/api/src/extraction/**/*.ts',
        'packages/parser/src/**/*.ts',
        'eval/**/*.ts',
      ],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 76, statements: 76, branches: 75, functions: 74 },
      // floor(Phase 6 measured unit coverage) - 3; see docs/RUNBOOK.md.
    },
  },
});
