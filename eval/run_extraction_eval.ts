import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import pg from 'pg';
import { moneyProfile } from '../packages/parser/src/index.ts';
import { HybridExtractor } from '../apps/api/src/extraction/hybrid.ts';
import type {
  ExtractionResult,
  CallLog,
} from '../apps/api/src/extraction/hybrid.ts';
import {
  FakeProvider,
  GeminiProvider,
  PROMPT_VERSION,
} from '../apps/api/src/extraction/provider.ts';
import type { ExtractionProvider } from '../apps/api/src/extraction/provider.ts';
import {
  MemoryExtractionStore,
  PgExtractionStore,
} from '../apps/api/src/extraction/store.ts';
import { evaluateCases, loadCases, renderMarkdown } from './evaluate.ts';
import type { EvalReport } from './evaluate.ts';
import type { Options } from './run_eval.ts';
const quantile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1] ?? null;
};
export async function runExtractionEvaluation(
  options: Options,
): Promise<number> {
  if (options.config === 'rules')
    throw new Error('Provider evaluation requires llm or hybrid.');
  if (options.provider === 'gemini' && process.env.CI)
    throw new Error('Real Gemini evaluation is prohibited in CI.');
  const profile = moneyProfile(process.env.MONEY_PROFILE);
  const raw = readFileSync(options.cases, 'utf8');
  const cases = loadCases(raw, options.split);
  let pool: pg.Pool | undefined;
  try {
    let provider: ExtractionProvider;
    let store: MemoryExtractionStore | PgExtractionStore;
    let user = 'synthetic-eval';
    if (options.provider === 'gemini') {
      if (!process.env.DATABASE_URL)
        throw new Error(
          'Set DATABASE_URL and run db:migrate for persistent evaluation caps.',
        );
      provider = await GeminiProvider.create();
      pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
      });
      const row = await pool.query(
        "INSERT INTO users(email,password_hash,display_name) VALUES('llm-evaluation@sochat.invalid','not-a-login-hash','Synthetic evaluation') ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id",
      );
      user = row.rows[0].id;
      store = new PgExtractionStore(pool);
    } else {
      // Deliberately scripted to ask rather than simulate Gemini accuracy. Never uses gold labels.
      provider = new FakeProvider(
        cases.map(() => ({
          items: [],
          needs_clarification: true,
          clarification_question: 'Bạn ghi rõ số tiền và ngày nhé?',
        })),
      );
      store = new MemoryExtractionStore();
    }
    const logs: CallLog[] = [];
    const service = new HybridExtractor(
      provider,
      store,
      {
        perUser: Number(process.env.LLM_DAILY_CAP_PER_USER ?? 50),
        global: Number(process.env.LLM_DAILY_CAP_GLOBAL ?? 500),
      },
      { moneyProfile: profile, log: (event) => logs.push(event) },
    );
    const predictions: ExtractionResult[] = [];
    const latencies: number[] = [];
    for (const row of cases) {
      const start = performance.now();
      predictions.push(
        await service.parseHybrid(row.text, row.now, user, options.config),
      );
      latencies.push(performance.now() - start);
    }
    let index = 0;
    const metrics = evaluateCases(cases, () => {
      const result = predictions[index++];
      if (!result) throw new Error('Missing evaluation prediction');
      return result;
    });
    let commit: string | null = null;
    let dirty: boolean | null = null;
    try {
      commit = execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      dirty =
        execFileSync('git', ['status', '--porcelain'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim().length > 0;
    } catch {
      /* Source archive. */
    }
    const usage = logs.reduce(
      (sum, event) => ({
        input_tokens: sum.input_tokens + event.input_tokens,
        output_tokens: sum.output_tokens + event.output_tokens,
        total_tokens: sum.total_tokens + event.total_tokens,
      }),
      { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    );
    const inputPrice = Number(process.env.LLM_INPUT_USD_PER_MILLION);
    const outputPrice = Number(process.env.LLM_OUTPUT_USD_PER_MILLION);
    const priced =
      !!process.env.LLM_INPUT_USD_PER_MILLION?.trim() &&
      !!process.env.LLM_OUTPUT_USD_PER_MILLION?.trim() &&
      Number.isFinite(inputPrice) &&
      inputPrice >= 0 &&
      Number.isFinite(outputPrice) &&
      outputPrice >= 0;
    const knownEstimate =
      options.provider === 'fake'
        ? 0
        : priced &&
            logs.every((event) =>
              ['success', 'invalid_output'].includes(event.outcome),
            )
          ? (usage.input_tokens * inputPrice +
              usage.output_tokens * outputPrice) /
            1e6
          : null;
    const common = {
      generated_at: new Date().toISOString(),
      money_profile: profile,
      split: options.split,
      dataset_sha256: createHash('sha256').update(raw).digest('hex'),
      source_commit: commit,
      working_tree_dirty: dirty,
      seed_set_caveat:
        'The 65 synthetic seed cases and reference rules share an author; scores are not representative of real users. Unlabeled owner inbox is excluded. ' +
        (options.provider === 'fake'
          ? 'FakeProvider always asks for clarification; fake metrics are not Gemini performance.'
          : 'This is an explicit owner-run real Gemini evaluation.'),
    };
    const report = {
      ...common,
      ...metrics,
      config: options.config,
      provider: options.provider,
      model: provider.model,
      prompt_version: PROMPT_VERSION,
      operational: {
        messages: cases.length,
        provider_attempts: logs.length,
        usage,
        no_provider_attempt_share:
          predictions.filter((p) => p.attempts === 0).length / cases.length,
        rules_only_share:
          predictions.filter(
            (p) =>
              p.path === 'rules' && p.attempts === 0 && !p.needs_clarification,
          ).length / cases.length,
        latency_ms: {
          p50: quantile(latencies, 0.5),
          p95: quantile(latencies, 0.95),
        },
        observed_token_estimate_usd_per_100_messages:
          knownEstimate === null ? null : (knownEstimate * 100) / cases.length,
        attempts_with_unknown_usage: logs.filter(
          (e) => !['success', 'invalid_output'].includes(e.outcome),
        ).length,
        pricing_caveat:
          'Owner-supplied USD/token rates; observed-token estimate only, not billing. Missing prices yield null. Failed HTTP calls can have unknown billable usage. Fake has no API cost.',
      },
    };
    const markdown =
      renderMarkdown({ ...common, ...metrics, config: 'rules' } as EvalReport)
        .replace(
          '# Rules extraction evaluation',
          `# ${options.config} extraction evaluation (${options.provider})`,
        )
        .replace('Config: rules.', `Config: ${options.config}.`) +
      `\n## Operational metrics\n\n\`\`\`json\n${JSON.stringify(report.operational, null, 2)}\n\`\`\`\n`;
    mkdirSync(options.outDir, { recursive: true });
    const prefix = resolve(
      options.outDir,
      `${options.config}-${options.provider}-${options.split}`,
    );
    writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n');
    writeFileSync(prefix + '.md', markdown);
    process.stdout.write(markdown + `\nJSON: ${prefix}.json\n`);
    return report.failures.length ? 1 : 0;
  } finally {
    await pool?.end();
  }
}
