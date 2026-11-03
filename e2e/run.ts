import { spawnSync } from 'node:child_process';
import { summarizeCoverage } from './coverage.ts';
for (const args of [
  ['run', 'web:build'],
  ['exec', 'playwright', 'test', '--', ...process.argv.slice(2)],
]) {
  const result = spawnSync('npm', args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

summarizeCoverage();
