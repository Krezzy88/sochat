import { performance } from 'node:perf_hooks';
import { parseMessage } from '../packages/parser/src/index.ts';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateCases, loadCases, renderMarkdown } from './evaluate.ts';
import type { EvalReport, SelectedSplit } from './evaluate.ts';

export interface Options {
  split: SelectedSplit;
  config: 'rules' | 'llm' | 'hybrid';
  provider: 'fake' | 'gemini';
  cases: string;
  outDir: string;
}
const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function parseArgs(args: readonly string[]): Options {
  const options: Options = {
    split: 'dev',
    config: 'rules',
    provider: 'fake',
    cases: resolve(ROOT, 'eval/cases.jsonl'),
    outDir: resolve(ROOT, 'eval/results'),
  };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !value || value.startsWith('--') || seen.has(key))
      throw new Error('Each option requires exactly one value.');
    seen.add(key);
    switch (key) {
      case '--split':
        if (!['dev', 'heldout', 'all'].includes(value))
          throw new Error('Split must be dev, heldout or all.');
        options.split = value as SelectedSplit;
        break;
      case '--config':
        if (!['rules', 'llm', 'hybrid'].includes(value))
          throw new Error('Config must be rules, llm or hybrid.');
        options.config = value as Options['config'];
        break;
      case '--provider':
        if (value !== 'fake' && value !== 'gemini')
          throw new Error('Provider must be fake or gemini.');
        options.provider = value;
        break;
      case '--cases':
        options.cases = resolve(value);
        break;
      case '--out-dir':
        options.outDir = resolve(value);
        break;
      default:
        throw new Error(`Unknown option: ${key}.`);
    }
  }
  return options;
}

export function runEvaluation(args: readonly string[]): {
  report: EvalReport;
  jsonPath: string;
  markdownPath: string;
} {
  const options = parseArgs(args);
  if (options.config !== 'rules')
    throw new Error('Use the asynchronous CLI for provider evaluation.');
  const dataset = readFileSync(options.cases, 'utf8');
  const cases = loadCases(dataset, options.split);
  let sourceCommit: string | null = null;
  let dirty: boolean | null = null;
  try {
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    dirty =
      execFileSync(
        'git',
        ['status', '--porcelain', '--untracked-files=normal'],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim().length > 0;
  } catch {
    /* A source archive can legitimately have no .git directory. */
  }
  const latencies: number[] = [];
  let resolved = 0;
  const measured = evaluateCases(cases, (message, now) => {
    const start = performance.now();
    const parsed = parseMessage(message, now);
    latencies.push(performance.now() - start);
    if (
      !parsed.needs_clarification &&
      !parsed.items.some((item) => item.category === 'khac')
    )
      resolved++;
    return parsed;
  });
  latencies.sort((a, b) => a - b);
  const report: EvalReport = {
    generated_at: new Date().toISOString(),
    config: 'rules',
    split: options.split,
    dataset_sha256: createHash('sha256').update(dataset).digest('hex'),
    source_commit: sourceCommit,
    working_tree_dirty: dirty,
    seed_set_caveat:
      'The 65 supplied synthetic dev seed cases were written by the developer who wrote the reference rules. Their score is not representative of real users. Additional owner-labeled data must be assessed separately.',
    ...measured,
    operational: {
      provider_attempts: 0,
      rules_only_share: resolved / cases.length,
      latency_ms: {
        p50: latencies[Math.ceil(latencies.length * 0.5) - 1] ?? null,
        p95: latencies[Math.ceil(latencies.length * 0.95) - 1] ?? null,
      },
      observed_token_estimate_usd_per_100_messages: 0,
      pricing_caveat:
        'Rules-only local execution; no API cost. Latencies are local parser timings, not API latency.',
    },
  };
  mkdirSync(options.outDir, { recursive: true });
  const jsonPath = resolve(options.outDir, `rules-${options.split}.json`);
  const markdownPath = resolve(options.outDir, `rules-${options.split}.md`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(markdownPath, renderMarkdown(report));
  return { report, jsonPath, markdownPath };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = process.argv.slice(2);
    const options = parseArgs(args);
    if (options.config !== 'rules') {
      const { runExtractionEvaluation } =
        await import('./run_extraction_eval.ts');
      process.exitCode = await runExtractionEvaluation(options);
    } else {
      if (options.provider !== 'fake')
        throw new Error(
          'Select --config llm or hybrid for provider evaluation.',
        );
      const { report, jsonPath, markdownPath } = runEvaluation(args);
      process.stdout.write(renderMarkdown(report));
      process.stdout.write(`JSON: ${jsonPath}\nMarkdown: ${markdownPath}\n`);
      process.exitCode = report.failures.length ? 1 : 0;
    }
  } catch (error) {
    process.stderr.write(
      `Evaluation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
