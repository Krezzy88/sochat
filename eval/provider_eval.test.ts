import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { it, expect } from 'vitest';
it('runs the hybrid FakeProvider dev evaluation and writes operational metrics', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sochat-hybrid-eval-'));
  try {
    const child = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'eval/run_eval.ts',
        '--config',
        'hybrid',
        '--provider',
        'fake',
        '--out-dir',
        directory,
      ],
      { encoding: 'utf8' },
    );
    expect(child.status).toBe(0);
    const data = JSON.parse(
      readFileSync(join(directory, 'hybrid-fake-dev.json'), 'utf8'),
    );
    expect(data.provider).toBe('fake');
    expect(data.config).toBe('hybrid');
    expect(data.cases).toBe(65);
    expect(data.exact_case.correct).toBe(65);
    expect(data.operational.provider_attempts).toBe(5);
    expect(data.operational.observed_token_estimate_usd_per_100_messages).toBe(
      0,
    );
    expect(data.operational.latency_ms.p95).toBeGreaterThanOrEqual(
      data.operational.latency_ms.p50,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
it('rejects Gemini evaluation in CI before any authenticated request', () => {
  const child = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      'eval/run_eval.ts',
      '--config',
      'llm',
      '--provider',
      'gemini',
    ],
    { encoding: 'utf8', env: { ...process.env, CI: 'true' } },
  );
  expect(child.status).toBe(1);
  expect(child.stderr).toContain('prohibited in CI');
});
