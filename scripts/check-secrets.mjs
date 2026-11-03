import console from 'node:console';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const patterns = [
  /AIza[0-9A-Za-z_-]{35}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{36,}/,
];
let failed = false;
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) {
    console.error('Tracked environment file:', file);
    failed = true;
  }
  const text = readFileSync(file).toString('utf8');
  if (patterns.some((pattern) => pattern.test(text))) {
    console.error('Potential secret in tracked file:', file);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else
  console.log(
    'Tracked-file secret-pattern check passed (bounded patterns; not a comprehensive secret scanner).',
  );
