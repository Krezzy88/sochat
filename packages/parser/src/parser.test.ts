import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractAmounts, fold, parseMessage, resolveDate } from './index.ts';

const NOW = '2026-11-02T09:00:00+07:00';
// Only dev rows are evaluated. Never add held-out cases to unit-test fixtures.
const seeds = readFileSync(
  new URL('../../../eval/cases.jsonl', import.meta.url),
  'utf8',
)
  .trim()
  .split('\n')
  .map(
    (line) =>
      JSON.parse(line) as {
        id: string;
        split: string;
        text: string;
        now: string;
        expected: { items: unknown[]; needs_clarification: boolean };
      },
  )
  .filter((row) => row.split === 'dev');

describe('supplied synthetic dev baseline (not representative of real users)', () => {
  it.each(seeds)('$id', (seed) => {
    const actual = parseMessage(seed.text, seed.now);
    expect(actual.needs_clarification).toBe(seed.expected.needs_clarification);
    expect(
      actual.items.map(({ type, amount_vnd, category, occurred_on }) => ({
        type,
        amount_vnd,
        category,
        occurred_on,
      })),
    ).toEqual(seed.expected.items);
  });
});

describe('deterministic amount normalization', () => {
  it.each(['1tr2345', '35k50', '1tr2k'])(
    'does not silently accept a numeric prefix of %s',
    (amount) => {
      const actual = parseMessage(`mua đồ ${amount}`, NOW);
      expect(actual.reasons).toContain('malformed_amount');
      expect(actual.items[0]?.amount_vnd).toBeNull();
    },
  );

  it('does not reinterpret a quantity after a million amount as fractional money', () => {
    expect(parseMessage('ăn 1tr 2 người', NOW).items[0]?.amount_vnd).toBe(
      1_000_000,
    );
  });

  it.each([
    ['1tr2', 1_200_000],
    ['1tr25', 1_250_000],
    ['1 trieu 2', 1_200_000],
    ['1,5tr', 1_500_000],
    ['1.200.000', 1_200_000],
    ['1,200,000đ', 1_200_000],
    ['nửa triệu', 500_000],
    ['2 triệu rưỡi', 2_500_000],
    ['35k5', 35_500],
    ['1.001k', 1001],
    ['100000000000', 100_000_000_000],
    ['0.000001tr', 1],
    ['2.5k', 2500],
  ])('normalizes %s exactly', (text, value) => {
    expect(extractAmounts(fold(text)).map((amount) => amount.value)).toEqual([
      value,
    ]);
  });

  it('does not silently round fractional dong', () => {
    const actual = parseMessage('phở 1.0001k', NOW);
    expect(actual.items[0]?.amount_vnd).toBeNull();
    expect(actual.reasons).toContain('fractional_vnd');
  });

  it('keeps separate amounts after a million unit', () => {
    const actual = parseMessage('mua đồ 1tr 50k', NOW);
    expect(actual.items[0]?.amount_vnd).toBeNull();
    expect(actual.reasons).toContain('multiple_amounts');
  });

  it('accepts exactly 500 characters and rejects 501', () => {
    expect(
      parseMessage('phở 50k' + ' '.repeat(493), NOW).reasons,
    ).not.toContain('message_too_long');
    expect(parseMessage('phở 50k' + ' '.repeat(494), NOW).reasons).toContain(
      'message_too_long',
    );
  });

  it('does not split a Unicode character when counting the limit', () => {
    expect(parseMessage('😀'.repeat(500), NOW).reasons).not.toContain(
      'message_too_long',
    );
    expect(parseMessage('😀'.repeat(501), NOW).reasons).toContain(
      'message_too_long',
    );
  });

  it('preserves original Vietnamese notes and handles decomposed accents', () => {
    const original = 'Ăn phở 50k, cà phê 25k';
    expect(parseMessage(original.normalize('NFD'), NOW)).toEqual(
      parseMessage(original, NOW),
    );
    expect(parseMessage(original, NOW).items.map((item) => item.note)).toEqual([
      'Ăn phở 50k',
      'cà phê 25k',
    ]);
    expect(fold('ĐỔ XĂNG 60.000đ')).toBe('do xang 60.000d');
  });
});

describe('calendar dates and injected time', () => {
  it('uses Vietnam midnight rather than the UTC day', () => {
    expect(resolveDate('hom nay', '2026-11-01T17:30:00Z').date).toBe(
      '2026-11-02',
    );
  });

  it.each(['bad', '2026-11-02', '2026-11-02T09:00:00', '2026-02-30T09:00:00Z'])(
    'asks instead of consulting the wall clock for invalid now %s',
    (now) => {
      expect(parseMessage('phở 50k', now).reasons).toEqual(['invalid_now']);
    },
  );

  it('accepts explicit leap days and two-digit years', () => {
    expect(parseMessage('29/02/2024 phở 50k', NOW).items[0]?.occurred_on).toBe(
      '2024-02-29',
    );
    expect(parseMessage('1/11/26 phở 50k', NOW).items[0]?.occurred_on).toBe(
      '2026-11-01',
    );
  });

  it('inherits a leading date but lets an item specify its own date', () => {
    const actual = parseMessage('hôm qua phở 50k; hôm nay cà phê 25k', NOW);
    expect(actual.items.map((item) => item.occurred_on)).toEqual([
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});
