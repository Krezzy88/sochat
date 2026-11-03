import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isCalendarDate,
  localToday,
  MAX_AMOUNT_VND,
  parseMessage,
} from '../packages/parser/src/index.ts';
import type {
  Classification,
  ParseResult,
} from '../packages/parser/src/index.ts';

export type Split = 'dev' | 'heldout';
export type SelectedSplit = Split | 'all';
export type ScoredItem = Classification & {
  amount_vnd: number | null;
  occurred_on: string | null;
};
export interface EvalCase {
  id: string;
  split: Split;
  text: string;
  now: string;
  expected: { items: ScoredItem[]; needs_clarification: boolean };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validItem(value: unknown): value is ScoredItem {
  if (!object(value)) return false;
  const categories: readonly string[] =
    value.type === 'expense'
      ? EXPENSE_CATEGORIES
      : value.type === 'income'
        ? INCOME_CATEGORIES
        : [];
  return (
    typeof value.category === 'string' &&
    categories.includes(value.category) &&
    (value.amount_vnd === null ||
      (typeof value.amount_vnd === 'number' &&
        Number.isSafeInteger(value.amount_vnd) &&
        value.amount_vnd > 0 &&
        value.amount_vnd <= MAX_AMOUNT_VND)) &&
    (value.occurred_on === null ||
      (typeof value.occurred_on === 'string' &&
        isCalendarDate(value.occurred_on)))
  );
}

/** Select before validating labels: default dev never evaluates held-out answers. */
export function loadCases(jsonl: string, split: SelectedSplit): EvalCase[] {
  const cases: EvalCase[] = [];
  const ids = new Set<string>();
  for (const [index, line] of jsonl.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON on dataset line ${index + 1}.`);
    }
    if (
      !object(row) ||
      typeof row.id !== 'string' ||
      !row.id.trim() ||
      (row.split !== 'dev' && row.split !== 'heldout')
    ) {
      throw new Error(`Invalid case identity/split on line ${index + 1}.`);
    }
    if (ids.has(row.id)) throw new Error(`Duplicate case id: ${row.id}.`);
    ids.add(row.id);
    if (split !== 'all' && row.split !== split) continue;
    if (
      typeof row.text !== 'string' ||
      typeof row.now !== 'string' ||
      !localToday(row.now) ||
      !object(row.expected) ||
      typeof row.expected.needs_clarification !== 'boolean' ||
      !Array.isArray(row.expected.items) ||
      !row.expected.items.every(validItem)
    ) {
      throw new Error(
        `Invalid case fields/labels on line ${index + 1} (${row.id}).`,
      );
    }
    if (
      !row.expected.needs_clarification &&
      row.expected.items.some(
        (item) => item.amount_vnd === null || item.occurred_on === null,
      )
    ) {
      throw new Error(`Unresolved fields require clarification (${row.id}).`);
    }
    cases.push(row as unknown as EvalCase);
  }
  if (cases.length === 0)
    throw new Error(`No cases selected for split ${split}.`);
  return cases;
}

export interface Metric {
  correct: number;
  total: number;
  accuracy: number | null;
}
export interface Failure {
  id: string;
  expected: EvalCase['expected'];
  actual: {
    items: ScoredItem[];
    needs_clarification: boolean;
    reasons: ParseResult['reasons'];
  };
}
export interface Evaluation {
  cases: number;
  exact_case: Metric;
  fields: Record<'amount_vnd' | 'category' | 'occurred_on' | 'type', Metric>;
  clarification: {
    true_positive: number;
    false_positive: number;
    false_negative: number;
    true_negative: number;
    precision: number | null;
    recall: number | null;
  };
  failures: Failure[];
}

const metric = (correct: number, total: number): Metric => ({
  correct,
  total,
  accuracy: total ? correct / total : null,
});
const scored = ({
  type,
  category,
  amount_vnd,
  occurred_on,
}: ScoredItem): ScoredItem =>
  ({ type, category, amount_vnd, occurred_on }) as ScoredItem;

export function evaluateCases(
  cases: readonly EvalCase[],
  parser = parseMessage,
): Evaluation {
  const fields = {
    amount_vnd: metric(0, 0),
    category: metric(0, 0),
    occurred_on: metric(0, 0),
    type: metric(0, 0),
  };
  const clarification: Evaluation['clarification'] = {
    true_positive: 0,
    false_positive: 0,
    false_negative: 0,
    true_negative: 0,
    precision: null,
    recall: null,
  };
  const failures: Failure[] = [];
  for (const row of cases) {
    const actual = parser(row.text, row.now);
    const expected = row.expected;
    if (expected.needs_clarification) {
      if (actual.needs_clarification) clarification.true_positive++;
      else clarification.false_negative++;
    } else if (actual.needs_clarification) clarification.false_positive++;
    else clarification.true_negative++;
    let exact =
      actual.needs_clarification === expected.needs_clarification &&
      actual.items.length === expected.items.length;
    // Align by item order and penalize missing AND extra predictions.
    const slots = Math.max(actual.items.length, expected.items.length);
    for (let index = 0; index < slots; index++) {
      const predicted = actual.items[index];
      const gold = expected.items[index];
      for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
        fields[key].total++;
        if (gold && predicted && gold[key] === predicted[key])
          fields[key].correct++;
        else exact = false;
      }
    }
    if (!exact)
      failures.push({
        id: row.id,
        expected,
        actual: {
          items: actual.items.map(scored),
          needs_clarification: actual.needs_clarification,
          reasons: actual.reasons,
        },
      });
  }
  for (const key of Object.keys(fields) as (keyof typeof fields)[])
    fields[key] = metric(fields[key].correct, fields[key].total);
  const predictedPositive =
    clarification.true_positive + clarification.false_positive;
  const actualPositive =
    clarification.true_positive + clarification.false_negative;
  clarification.precision = predictedPositive
    ? clarification.true_positive / predictedPositive
    : null;
  clarification.recall = actualPositive
    ? clarification.true_positive / actualPositive
    : null;
  return {
    cases: cases.length,
    exact_case: metric(cases.length - failures.length, cases.length),
    fields,
    clarification,
    failures,
  };
}

export interface ReportMetadata {
  generated_at: string;
  config: 'rules';
  split: SelectedSplit;
  dataset_sha256: string;
  source_commit: string | null;
  working_tree_dirty: boolean | null;
  seed_set_caveat: string;
}
export type EvalReport = ReportMetadata & Evaluation;

const percent = (value: number | null): string =>
  value === null ? 'n/a' : `${(value * 100).toFixed(2)}%`;
const markdownCell = (value: string): string => value.replace(/[|\r\n]/g, ' ');

export function renderMarkdown(report: EvalReport): string {
  return (
    [
      '# Rules extraction evaluation',
      '',
      `Generated: ${report.generated_at}. Config: ${report.config}. Split: ${report.split}.`,
      '',
      report.seed_set_caveat,
      '',
      `Source commit: ${report.source_commit ?? 'unknown'}. Working tree dirty: ${String(report.working_tree_dirty)}.`,
      `Dataset SHA-256: ${report.dataset_sha256}.`,
      '',
      '| Metric | Correct / total | Accuracy |',
      '| --- | --- | --- |',
      `| Exact case | ${report.exact_case.correct} / ${report.exact_case.total} | ${percent(report.exact_case.accuracy)} |`,
      ...Object.entries(report.fields).map(
        ([key, value]) =>
          `| ${key} | ${value.correct} / ${value.total} | ${percent(value.accuracy)} |`,
      ),
      '',
      `Clarification: TP=${report.clarification.true_positive}, FP=${report.clarification.false_positive}, FN=${report.clarification.false_negative}, TN=${report.clarification.true_negative}.`,
      `Precision: ${percent(report.clarification.precision)}. Recall: ${percent(report.clarification.recall)}.`,
      '',
      'Items are aligned by order. Each field denominator is the sum of max(expected items, predicted items) per case; extra/missing items count as errors. Null fields are scored by exact equality. Exact case also requires matching item count and clarification state. Undefined ratios are n/a (null in JSON).',
      '',
      `## Failures (${report.failures.length})`,
      '',
      ...report.failures.flatMap((failure) => [
        `### ${markdownCell(failure.id)}`,
        '',
        '```json',
        JSON.stringify(failure, null, 2),
        '```',
        '',
      ]),
    ].join('\n') + '\n'
  );
}
