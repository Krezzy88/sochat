import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  extractAmounts,
  fold,
  isCalendarDate,
  MAX_AMOUNT_VND,
  parseMessage,
} from './index.ts';

const NOW = '2026-11-02T09:00:00+07:00';
const OPTIONS = { seed: 20261103, numRuns: 2000 };
const unicode = fc.string({ unit: 'grapheme', maxLength: 600 });

describe('parser invariants with reproducible fast-check seeds', () => {
  it('never throws and is deterministic for arbitrary Unicode strings', () => {
    fc.assert(
      fc.property(unicode, (message) => {
        const parsed = parseMessage(message, NOW);
        expect(parsed).toEqual(parseMessage(message, NOW));
        for (const item of parsed.items) {
          expect(
            item.occurred_on === null || isCalendarDate(item.occurred_on),
          ).toBe(true);
        }
      }),
      OPTIONS,
    );
  });

  it('returns only bounded positive safe integers or null, including numeric-heavy strings', () => {
    const numeric = fc
      .array(
        fc.constantFrom(
          '0',
          '1',
          '9',
          '.',
          ',',
          'k',
          'tr',
          '−',
          '-',
          '/',
          ' ',
          'đ',
        ),
        { maxLength: 500 },
      )
      .map((parts) => parts.join(''));
    fc.assert(
      fc.property(fc.oneof(unicode, numeric), (message) => {
        const amounts = [
          ...parseMessage(message, NOW).items.map((item) => item.amount_vnd),
          ...extractAmounts(fold(message)).map((amount) => amount.value),
        ];
        for (const amount of amounts) {
          expect(
            amount === null ||
              (Number.isSafeInteger(amount) &&
                amount > 0 &&
                amount <= MAX_AMOUNT_VND),
          ).toBe(true);
        }
      }),
      OPTIONS,
    );
  });

  it('returns valid calendar dates or null for arbitrary date-shaped inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 1000, max: 9999 }),
        (day, month, year) => {
          for (const item of parseMessage(
            `${day}/${month}/${year} phở 50k`,
            NOW,
          ).items) {
            expect(
              item.occurred_on === null || isCalendarDate(item.occurred_on),
            ).toBe(true);
          }
        },
      ),
      OPTIONS,
    );
  });

  it('keeps UTF-16 offsets aligned after NFC folding', () => {
    fc.assert(
      fc.property(unicode, (text) => {
        expect(fold(text).length).toBe(text.normalize('NFC').length);
      }),
      OPTIONS,
    );
  });
});
