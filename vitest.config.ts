import { defineConfig } from 'vitest/config';

export default defineConfig({
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
      // Phase 7 will calibrate thresholds from measured application coverage.
    },
  },
});
