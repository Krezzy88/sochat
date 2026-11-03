import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateCases, loadCases, renderMarkdown } from './evaluate.ts';
import type { EvalCase, ScoredItem } from './evaluate.ts';
import { parseArgs, runEvaluation } from './run_eval.ts';

const NOW = '2026-11-02T09:00:00+07:00';
const ITEM: ScoredItem = {
  type: 'expense',
  category: 'an_uong',
  amount_vnd: 50_000,
  occurred_on: '2026-11-02',
};
const makeCase = (id: string, needs_clarification = false): EvalCase => ({
  id,
  split: 'dev',
  text: 'phở 50k',
  now: NOW,
  expected: { items: [ITEM], needs_clarification },
});
const temporary: string[] = [];
function directory(): string {
  const path = mkdtempSync(join(tmpdir(), 'sochat-eval-test-'));
  temporary.push(path);
  return path;
}
afterEach(() => {
  for (const path of temporary.splice(0))
    rmSync(path, { recursive: true, force: true });
});

describe('dataset selection and validation', () => {
  it('does not validate or evaluate held-out labels in the default dev selection', () => {
    const dev = makeCase('dev-fixture');
    const unselected = {
      id: 'unselected-fixture',
      split: 'heldout',
      expected: 'intentionally unreadable',
    };
    expect(
      loadCases(
        [dev, unselected].map((value) => JSON.stringify(value)).join('\n'),
        'dev',
      ),
    ).toEqual([dev]);
  });

  it.each([
    ['{', /Invalid JSON/],
    [JSON.stringify({ id: 'bad', split: 'train' }), /identity\/split/],
    [
      [makeCase('duplicate'), makeCase('duplicate')]
        .map((value) => JSON.stringify(value))
        .join('\n'),
      /Duplicate/,
    ],
    [JSON.stringify({ ...makeCase('bad-now'), now: 'bad' }), /fields\/labels/],
    [
      JSON.stringify({
        ...makeCase('bad-money'),
        expected: {
          items: [{ ...ITEM, amount_vnd: -1 }],
          needs_clarification: true,
        },
      }),
      /fields\/labels/,
    ],
    [
      JSON.stringify({
        ...makeCase('bad-category'),
        expected: {
          items: [{ ...ITEM, category: 'luong' }],
          needs_clarification: true,
        },
      }),
      /fields\/labels/,
    ],
    [
      JSON.stringify({
        ...makeCase('bad-date'),
        expected: {
          items: [{ ...ITEM, occurred_on: '2026-02-31' }],
          needs_clarification: true,
        },
      }),
      /fields\/labels/,
    ],
    [
      JSON.stringify({
        ...makeCase('bad-null'),
        expected: {
          items: [{ ...ITEM, amount_vnd: null }],
          needs_clarification: false,
        },
      }),
      /require clarification/,
    ],
    ['', /No cases selected/],
  ])(
    'rejects an invalid dataset without manufacturing scores',
    (jsonl, message) => {
      expect(() => loadCases(jsonl, 'dev')).toThrow(message);
    },
  );
});

describe('evaluation metric arithmetic', () => {
  it('counts TP, FP, FN and TN separately and computes precision/recall', () => {
    const cases = [
      makeCase('tp', true),
      makeCase('fp'),
      makeCase('fn', true),
      makeCase('tn'),
    ];
    let index = 0;
    const result = evaluateCases(cases, () => ({
      items: [{ ...ITEM, note: '', flags: [] }],
      needs_clarification: index++ < 2,
      reasons: [],
      questions: [],
    }));
    expect(result.clarification).toEqual({
      true_positive: 1,
      false_positive: 1,
      false_negative: 1,
      true_negative: 1,
      precision: 0.5,
      recall: 0.5,
    });
    expect(result.exact_case).toEqual({ correct: 2, total: 4, accuracy: 0.5 });
    expect(result.failures.map((failure) => failure.id)).toEqual(['fp', 'fn']);
  });

  it('penalizes extra items, missing items and incorrect field values', () => {
    const cases = [
      makeCase('extra'),
      makeCase('missing'),
      makeCase('wrong-amount'),
    ];
    let index = 0;
    const result = evaluateCases(cases, () => {
      const items =
        [[ITEM, ITEM], [], [{ ...ITEM, amount_vnd: 25_000 }]][index++] ?? [];
      return {
        items: items.map((item) => ({ ...item, note: '', flags: [] })),
        needs_clarification: false,
        reasons: [],
        questions: [],
      };
    });
    expect(result.fields.amount_vnd).toEqual({
      correct: 1,
      total: 4,
      accuracy: 0.25,
    });
    expect(result.fields.category).toEqual({
      correct: 2,
      total: 4,
      accuracy: 0.5,
    });
    expect(result.exact_case.accuracy).toBe(0);
    expect(result.clarification.precision).toBeNull();
    expect(result.clarification.recall).toBeNull();
  });

  it('uses null/n/a for field accuracy with no item slots', () => {
    const result = evaluateCases([
      {
        ...makeCase('no-amount', true),
        text: '😀',
        expected: { items: [], needs_clarification: true },
      },
    ]);
    expect(result.fields.amount_vnd.accuracy).toBeNull();
    expect(result.exact_case.accuracy).toBe(1);
  });
});

describe('evaluation CLI', () => {
  it('defaults to dev/rules and accepts explicit split syntax without executing held-out cases', () => {
    expect(parseArgs([])).toMatchObject({ split: 'dev', config: 'rules' });
    expect(parseArgs(['--split', 'heldout']).split).toBe('heldout');
    expect(parseArgs(['--split', 'all']).split).toBe('all');
  });

  it.each([
    ['--split', 'train'],
    ['--config', 'unknown'],
    ['--unknown', 'yes'],
    ['--split'],
    ['--split', 'dev', '--split', 'all'],
    ['--cases', '--split'],
  ])('rejects unsupported/invalid options %j', (...args) => {
    expect(() => parseArgs(args)).toThrow();
  });

  it('writes JSON and Markdown for a synthetic dev fixture', () => {
    const path = directory();
    const cases = join(path, 'cases.jsonl');
    writeFileSync(cases, JSON.stringify(makeCase('cli-fixture')) + '\n');
    const { report, jsonPath, markdownPath } = runEvaluation([
      '--cases',
      cases,
      '--out-dir',
      path,
    ]);
    expect(report.exact_case.accuracy).toBe(1);
    expect(report.dataset_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(readFileSync(jsonPath, 'utf8'))).toEqual(report);
    expect(readFileSync(markdownPath, 'utf8')).toBe(renderMarkdown(report));
    expect(readFileSync(markdownPath, 'utf8')).not.toMatch(/\n\n$/);
    expect(readFileSync(markdownPath, 'utf8')).toContain('not representative');
  });

  it('returns a nonzero process status and lists failures for incorrect dev predictions', () => {
    const path = directory();
    const cases = join(path, 'wrong.jsonl');
    const fixture = makeCase('deliberately-wrong-gold');
    fixture.expected.items = [{ ...ITEM, amount_vnd: 25_000 }];
    writeFileSync(cases, JSON.stringify(fixture));
    const child = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        new URL('./run_eval.ts', import.meta.url).pathname,
        '--cases',
        cases,
        '--out-dir',
        path,
      ],
      { encoding: 'utf8' },
    );
    expect(child.status).toBe(1);
    expect(child.stdout).toContain('deliberately-wrong-gold');
    expect(child.stdout).toContain('Failures (1)');
    expect(child.stderr).toBe('');
  });
});
