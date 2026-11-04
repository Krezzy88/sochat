// Private owner-approved dev evaluation; never a held-out/CI metric.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { loadCases, evaluateCases } from '../eval/evaluate.ts';
import type { ExtractionResult } from '../apps/api/src/extraction/hybrid.ts';
if (process.env.CI) throw Error('Owner development data is prohibited in CI');
const tag = process.argv[process.argv.indexOf('--tag') + 1];
if (!process.argv.includes('--tag') || !tag || !/^[a-z0-9-]+$/.test(tag))
  throw Error('Use --tag <private-run-name>');
const raw = readFileSync('.local/owner-dev/approved.jsonl', 'utf8');
const rows = raw
  .trim()
  .split('\n')
  .map((x) => JSON.parse(x) as { label_status?: string });
if (
  rows.length !== 50 ||
  rows.some((x) => !x.label_status?.startsWith('owner_approved_'))
)
  throw Error('Expected 50 explicitly approved owner dev labels');
const cases = loadCases(raw, 'dev');
const predictions = new Map(
  readFileSync(`.local/owner-dev/${tag}-predictions.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .map((x) => {
      const r = JSON.parse(x) as { text: string; result: ExtractionResult };
      return [r.text, r.result];
    }),
);
if (predictions.size !== cases.length) throw Error('Prediction count mismatch');
const score = evaluateCases(cases, (text) => {
  const r = predictions.get(text);
  if (!r) throw Error('Missing prediction');
  return r;
});
const report = {
  kind: 'Owner-approved development/tuning set; NOT representative/heldout',
  generated_at: new Date().toISOString(),
  labels_sha256: createHash('sha256').update(raw).digest('hex'),
  ...score,
};
writeFileSync(
  `.local/owner-dev/${tag}-score.json`,
  JSON.stringify(report, null, 2) + '\n',
  { mode: 0o600 },
);
console.log(
  JSON.stringify(
    { ...report, failures: report.failures.map((x) => x.id) },
    null,
    2,
  ),
);
