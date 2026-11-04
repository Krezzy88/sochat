// Explicit owner-authorized local smoke, not an evaluation/held-out or CI task.
import process from 'node:process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GeminiProvider } from '../apps/api/src/extraction/provider.ts';
import { HybridExtractor } from '../apps/api/src/extraction/hybrid.ts';
import { MemoryExtractionStore } from '../apps/api/src/extraction/store.ts';
if (process.env.CI) throw new Error('Live smoke is local only.');
const provider = await GeminiProvider.create(process.env);
const events: unknown[] = [];
const extractor = new HybridExtractor(
  provider,
  new MemoryExtractionStore(),
  { perUser: 3, global: 3 },
  { log: (e) => events.push(e) },
);
const results = [];
for (const message of ['mua mô hình lắp ráp 275k', 'ăn phở 35']) {
  const result = await extractor.parseHybrid(
    message,
    new Date().toISOString(),
    'synthetic-live-ux',
  );
  results.push({
    synthetic_message: message,
    path: result.path,
    attempts: result.attempts,
    needs_clarification: result.needs_clarification,
    amounts: result.items.map((i) => i.amount_vnd),
    reasons: result.reasons,
    usage: result.usage,
  });
}
mkdirSync('docs/measurements', { recursive: true });
const report = {
  kind: 'Owner-authorized local real Gemini smoke, two synthetic inputs; not representative accuracy or held-out evaluation',
  model: provider.model,
  generated_at: new Date().toISOString(),
  results,
  operational_events: events,
};
writeFileSync(
  'docs/measurements/gemini-live-ux.json',
  JSON.stringify(report, null, 2) + '\n',
);
process.stdout.write(
  JSON.stringify({ model: provider.model, results }, null, 2) + '\n',
);
