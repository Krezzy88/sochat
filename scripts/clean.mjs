import { rm } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
const root = new URL('../', import.meta.url);
for (const name of [
  'coverage',
  'test-results',
  'playwright-report',
  'apps/web/dist',
  '.DS_Store',
]) {
  await rm(new URL(name, root), { recursive: true, force: true });
}
console.log(
  'Removed reproducible build/test outputs from ' + fileURLToPath(root),
);
