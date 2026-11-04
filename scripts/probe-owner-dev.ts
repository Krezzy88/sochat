// Owner-authorized development probe; private output only, never CI/heldout.
import process from 'node:process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
  existsSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { GeminiProvider } from '../apps/api/src/extraction/provider.ts';
import { HybridExtractor } from '../apps/api/src/extraction/hybrid.ts';
import { MemoryExtractionStore } from '../apps/api/src/extraction/store.ts';
if (process.env.CI || !process.argv.includes('--owner-approved'))
  throw Error('Explicit local owner approval required');
const tag = process.argv[process.argv.indexOf('--tag') + 1];
if (!process.argv.includes('--tag') || !tag || !/^[a-z0-9-]+$/.test(tag))
  throw Error('Use --tag <new-run-name>');
const outputPath = `.local/owner-dev/${tag}-predictions.jsonl`;
const summaryPath = `.local/owner-dev/${tag}-probe-summary.json`;
if (existsSync(outputPath) || existsSync(summaryPath))
  throw Error('Run tag already exists; preserve evidence');
const raw = readFileSync('eval/inbox/owner-20261103.jsonl', 'utf8');
const rows = raw
  .trim()
  .split('\n')
  .map((s) => JSON.parse(s) as { id: string; text: string });
if (rows.length !== 50) throw Error('Expected exactly 50 owner dev cases');
const provider = await GeminiProvider.create({
  ...process.env,
  MONEY_PROFILE: 'owner-confirmed-v2',
});
// Dedicated authorized evaluation budget, not the web application's quota/store.
const service = new HybridExtractor(
  provider,
  new MemoryExtractionStore(),
  {
    perUser: 50,
    global: 50,
  },
  { moneyProfile: 'owner-confirmed-v2' },
);
mkdirSync('.local/owner-dev', { recursive: true, mode: 0o700 });
const output = [],
  started = Date.now();
for (const row of rows) {
  const t = performance.now();
  const result = await service.parseHybrid(
    row.text,
    '2026-11-03T12:00:00+07:00',
    'owner-dev-authorized',
  );
  output.push({
    id: row.id,
    text: row.text,
    latency_ms: performance.now() - t,
    result,
  });
  writeFileSync(
    outputPath,
    output.map((r) => JSON.stringify(r)).join('\n') + '\n',
    { mode: 0o600 },
  );
}
const attempts = output.reduce((s, r) => s + r.result.attempts, 0);
const report = {
  source_commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  working_tree_dirty: !!execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  kind: 'Owner-supplied dev text; owner-approved labels, development/tuning only, no heldout',
  generated_at: new Date().toISOString(),
  model: provider.model,
  money_profile: 'owner-confirmed-v2',
  injected_time: '2026-11-03T12:00:00+07:00',
  dataset_sha256: createHash('sha256').update(raw).digest('hex'),
  cases: output.length,
  attempts,
  max_attempts: 50,
  elapsed_ms: Date.now() - started,
  paths: output.reduce<Record<string, number>>((s, r) => {
    s[r.result.path] = (s[r.result.path] ?? 0) + 1;
    return s;
  }, {}),
  clarification_cases: output.filter((r) => r.result.needs_clarification)
    .length,
  usage: output.reduce(
    (s, r) => ({
      input_tokens: s.input_tokens + r.result.usage.input_tokens,
      output_tokens: s.output_tokens + r.result.usage.output_tokens,
      total_tokens: s.total_tokens + r.result.usage.total_tokens,
    }),
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  ),
  safety_flags: output
    .filter((r) => r.result.reasons.some((s) => s.startsWith('llm_')))
    .map((r) => ({
      id: r.id,
      reasons: r.result.reasons.filter((s) => s.startsWith('llm_')),
    })),
  privacy:
    'Raw outputs private in .local; no heldout access, web caps unchanged',
};
writeFileSync(summaryPath, JSON.stringify(report, null, 2) + '\n', {
  mode: 0o600,
});
chmodSync(outputPath, 0o600);
console.log(JSON.stringify(report, null, 2));
