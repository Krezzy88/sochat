import { describe, expect, it } from 'vitest';
import { extractAmounts, fold, parseMessage, resolveDate } from './index.ts';

const NOW = '2026-11-02T09:00:00+07:00';

describe('known reference gaps: tests written before fixes', () => {
  it.each([
    ['100000000001', 'amount_out_of_range'],
    ['100000001k', 'amount_out_of_range'],
    ['99999999999999999999k', 'amount_out_of_range'],
    ['9007199254740993', 'amount_out_of_range'],
    ['9'.repeat(400) + 'k', 'amount_out_of_range'],
    ['-50k', 'negative_amount'],
    ['−50k', 'negative_amount'],
    ['- 50k', 'negative_amount'],
    ['0k', 'zero_amount'],
    ['0đ', 'zero_amount'],
    ['1.5.2tr', 'malformed_amount'],
    ['1,5,2tr', 'malformed_amount'],
  ])('rejects and flags %s', (amount, reason) => {
    const result = parseMessage(`mua đồ ${amount}`, NOW);
    expect(result.needs_clarification).toBe(true);
    expect(result.reasons).toContain(reason);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.amount_vnd).toBeNull();
    expect(extractAmounts(fold(amount))[0]?.value).toBeNull();
  });

  it('rejects messages longer than 500 characters before extracting', () => {
    const result = parseMessage('phở 50k ' + 'a'.repeat(500), NOW);
    expect(result.items).toEqual([]);
    expect(result.needs_clarification).toBe(true);
    expect(result.reasons).toContain('message_too_long');
  });

  it.each(['', '   ', '😀🍜💸'])(
    'asks a Vietnamese question for empty/non-money input %j',
    (text) => {
      const result = parseMessage(text, NOW);
      expect(result.items).toEqual([]);
      expect(result.needs_clarification).toBe(true);
      expect(result.questions[0]).toMatch(/số tiền/i);
    },
  );

  it.each(['31/02', '31/04/2026', '00/11', '29/02/2025', 'ngày 31 tháng 2'])(
    'does not replace invalid explicit date %s with today',
    (date) => {
      const result = parseMessage(`${date} phở 50k`, NOW);
      expect(result.needs_clarification).toBe(true);
      expect(result.reasons).toContain('invalid_date');
      expect(result.items[0]?.occurred_on).toBeNull();
      expect(resolveDate(fold(date), NOW).date).toBeNull();
    },
  );

  it('revalidates a leap date after implicit previous-year fallback', () => {
    const result = parseMessage('29/02 phở 50k', '2024-01-02T09:00:00+07:00');
    expect(result.needs_clarification).toBe(true);
    expect(result.items[0]?.occurred_on).toBeNull();
  });
});
