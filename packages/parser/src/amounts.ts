import { maskNoise } from './text.ts';
import type { AmountMatch, ParseReason } from './types.ts';

export const MAX_AMOUNT_VND = 100_000_000_000;
const MAX_AMOUNT = 100_000_000_000n;
const UNIT = /^\s*(trieu|tr|cu|nghin|ngan|k|lit|dong|vnd|d)(?![a-z])/;
const QUANTITY = /^\s*(ly|chai|nguoi|phan|to|cai|lan|kg|g|ml|l)(?![a-z])/;

/** Exact decimal scaling. Fractional dong are rejected, never rounded. */
function scaled(raw: string, scale: bigint): bigint | null {
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(raw);
  if (!match?.[1]) return null;
  const fraction = match[2] ?? '';
  const divisor = 10n ** BigInt(fraction.length);
  const numerator = BigInt(match[1] + fraction) * scale;
  return numerator % divisor === 0n ? numerator / divisor : null;
}

export function extractAmounts(foldedText: string): AmountMatch[] {
  const text = maskNoise(foldedText);
  const amounts: AmountMatch[] = [];
  const add = (
    start: number,
    end: number,
    value: bigint | null,
    flags: ParseReason[] = [],
  ): void => {
    if (value !== null) {
      if (value > MAX_AMOUNT) {
        value = null;
        flags.push('amount_out_of_range');
      } else if (value === 0n) {
        value = null;
        flags.push('zero_amount');
      } else if (value < 1000n) flags.push('tiny_amount');
    }
    amounts.push({
      start,
      end,
      value: value === null ? null : Number(value),
      flags,
    });
  };

  for (const match of text.matchAll(/\bnua\s+(?:trieu|cu)(?![a-z])/g)) {
    add(match.index, match.index + match[0].length, 500_000n);
  }

  // Consume the whole numeric token before interpreting it. Never extract the
  // valid-looking suffix of malformed "1.5.2tr" or an overflowing number.
  for (const match of text.matchAll(
    /(?<![a-z\d.,])(?:[-−]\s*)?\d+(?:[.,]\d+)*/g,
  )) {
    const start = match.index;
    if (amounts.some((amount) => start < amount.end && start >= amount.start))
      continue;
    const negative = /^[-−]/.test(match[0]);
    const raw = match[0].replace(/^[-−]\s*/, '');
    let end = start + match[0].length;
    const remainder = text.slice(end);
    const unitMatch = UNIT.exec(remainder);
    const unit = unitMatch?.[1];
    if (unitMatch) end += unitMatch[0].length;

    const separated = /^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(raw);
    if (!unit && !negative && QUANTITY.test(remainder)) continue;
    if (!unit && /^[a-z]/.test(remainder)) {
      add(start, end, null, ['malformed_amount']);
      continue;
    }
    if (!unit && !negative && /^\d{1,3}$/.test(raw)) continue;

    if (negative) {
      add(start, end, null, ['negative_amount']);
      continue;
    }
    if (unit === 'lit') {
      add(start, end, null, ['ambiguous_unit']);
      continue;
    }

    const millions = unit === 'trieu' || unit === 'tr' || unit === 'cu';
    const thousands = unit === 'nghin' || unit === 'ngan' || unit === 'k';
    const scale = millions ? 1_000_000n : thousands ? 1000n : 1n;
    const decimalValid = /^\d+(?:[.,]\d+)?$/.test(raw);
    if (
      !(millions || thousands ? decimalValid : separated || /^\d+$/.test(raw))
    ) {
      add(start, end, null, ['malformed_amount']);
      continue;
    }
    let value = scaled(
      !millions && !thousands && separated ? raw.replace(/[.,]/g, '') : raw,
      scale,
    );
    if (value === null) {
      add(start, end, null, ['fractional_vnd']);
      continue;
    }
    if (millions || thousands) {
      const tail = text.slice(end);
      const half = /^\s*ruoi\b/.exec(tail);
      const suffix = millions
        ? /^\s*(\d{1,3})(?![\d.,]|\s*(?:trieu|tr|cu|nghin|ngan|k|dong|vnd|d)(?![a-z]))/.exec(
            tail,
          )
        : /^(\d)(?![\d.,])/.exec(tail);
      if (half) {
        value += scale / 2n;
        end += half[0].length;
      } else if (suffix?.[1] && !QUANTITY.test(tail.slice(suffix[0].length))) {
        value += (BigInt(suffix[1]) * scale) / 10n ** BigInt(suffix[1].length);
        end += suffix[0].length;
      }
      if (/^(?:\d|[.,]\d)/.test(text.slice(end))) {
        add(start, end, null, ['malformed_amount']);
        continue;
      }
    }
    add(start, end, value);
  }
  return amounts.sort((a, b) => a.start - b.start);
}

/** Unitless small numbers require clarification, but quantities and dates do not. */
export function bareNumbers(foldedText: string): RegExpMatchArray[] {
  return [
    ...maskNoise(foldedText).matchAll(
      /(?<![\d.,a-z])\d{1,3}(?![\d.,]|\s*(?:k|tr|trieu|cu|nghin|ngan|lit|d|dong|vnd|ly|chai|nguoi|phan|to|cai|lan|kg|g|ml|l)(?![a-z]))/g,
    ),
  ];
}
