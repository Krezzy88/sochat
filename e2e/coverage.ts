import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';
type V8Range = { startOffset: number; endOffset: number; count: number };
function executedRanges(ranges: V8Range[]) {
  const events = ranges
    .flatMap((range) => [
      { offset: range.startOffset, range, start: true },
      { offset: range.endOffset, range, start: false },
    ])
    .sort((a, b) => a.offset - b.offset);
  const active = new Set<V8Range>();
  const result: { start: number; end: number }[] = [];
  for (let i = 0; i < events.length;) {
    const offset = events[i]!.offset;
    while (i < events.length && events[i]!.offset === offset) {
      const event = events[i++]!;
      if (event.start) active.add(event.range);
      else active.delete(event.range);
    }
    const next = events[i]?.offset;
    const inner = [...active].sort(
      (a, b) =>
        a.endOffset - a.startOffset - (b.endOffset - b.startOffset) ||
        a.count - b.count,
    )[0];
    if (next !== undefined && inner && inner.count > 0)
      result.push({ start: offset, end: next });
  }
  return result;
}
export async function collectCoverage(page: Page, info: TestInfo) {
  const entries = await page.coverage.stopJSCoverage();
  mkdirSync('test-results/browser-coverage', { recursive: true });
  writeFileSync(
    `test-results/browser-coverage/${createHash('sha256').update(info.testId).digest('hex')}.json`,
    JSON.stringify(
      entries
        .filter((e) => e.url.startsWith('http://localhost:5173/assets/'))
        .map((e) => ({
          file: e.url.split('/').at(-1),
          ranges: executedRanges(e.functions.flatMap((f) => f.ranges)),
        })),
    ),
  );
}
export function summarizeCoverage() {
  const combined = new Map<string, { start: number; end: number }[]>();
  for (const name of readdirSync('test-results/browser-coverage')) {
    const entries = JSON.parse(
      readFileSync('test-results/browser-coverage/' + name, 'utf8'),
    ) as { file: string; ranges: { start: number; end: number }[] }[];
    for (const e of entries)
      combined.set(e.file, [...(combined.get(e.file) ?? []), ...e.ranges]);
  }
  let total = 0,
    covered = 0;
  for (const file of readdirSync('apps/web/dist/assets').filter((f) =>
    f.endsWith('.js'),
  )) {
    total += readFileSync('apps/web/dist/assets/' + file, 'utf8').length;
    let end = 0;
    for (const range of (combined.get(file) ?? []).sort(
      (a, b) => a.start - b.start,
    )) {
      covered += Math.max(0, range.end - Math.max(end, range.start));
      end = Math.max(end, range.end);
    }
  }
  const report = {
    kind: 'Chromium executed JavaScript UTF-16 ranges across desktop/mobile journeys',
    includes:
      'All production web JS chunks, including React/Recharts dependencies',
    excludes: 'CSS, HTML, API, TypeScript line/branch coverage',
    covered,
    total,
    percent: Number(((covered * 100) / total).toFixed(2)),
  };
  mkdirSync('docs/measurements', { recursive: true });
  writeFileSync(
    'docs/measurements/web-coverage.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  process.stdout.write(
    `Browser JS range coverage: ${report.percent}% (${covered}/${total} UTF-16 units; includes dependencies).\n`,
  );
}
