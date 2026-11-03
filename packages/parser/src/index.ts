import { bareNumbers, extractAmounts } from './amounts.ts';
import { classify } from './classify.ts';
import { localToday, resolveDate } from './dates.ts';
import { fold, splitSegments } from './text.ts';
import type { ParsedItem, ParseReason, ParseResult } from './types.ts';

export { bareNumbers, extractAmounts, MAX_AMOUNT_VND } from './amounts.ts';
export { classify } from './classify.ts';
export { isCalendarDate, localToday, resolveDate } from './dates.ts';
export { fold } from './text.ts';
export { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './types.ts';
export type {
  AmountMatch,
  Classification,
  DateResolution,
  ExpenseCategory,
  IncomeCategory,
  ParsedItem,
  ParseReason,
  ParseResult,
} from './types.ts';

const QUESTIONS: Readonly<Record<ParseReason, string>> = {
  amount_out_of_range:
    'Số tiền cần nằm trong khoảng 1 đến 100.000.000.000 đồng. Bạn kiểm tra lại nhé?',
  negative_amount:
    'Khoản thu hoặc chi cần số tiền dương. Bạn muốn ghi số tiền bao nhiêu?',
  zero_amount: 'Số tiền phải lớn hơn 0 đồng. Bạn muốn ghi bao nhiêu?',
  malformed_amount:
    'Cách viết số tiền chưa rõ. Bạn nhập lại số tiền và đơn vị nhé?',
  fractional_vnd: 'Số tiền cần là số nguyên đồng. Bạn muốn ghi bao nhiêu đồng?',
  ambiguous_unit:
    'Đơn vị tiền chưa rõ. Bạn viết lại số tiền bằng đồng, nghìn hoặc triệu nhé?',
  tiny_amount: 'Số tiền dưới 1.000 đồng có đúng không? Bạn xác nhận lại nhé?',
  bare_small_number: 'Số tiền này tính bằng đồng hay nghìn đồng?',
  multiple_amounts:
    'Có nhiều số tiền trong cùng một khoản. Bạn muốn ghi số nào?',
  no_amount_found:
    'Bạn muốn ghi khoản thu hoặc chi nào, với số tiền bao nhiêu?',
  message_too_long:
    'Tin nhắn vượt quá 500 ký tự. Bạn chia thành các tin ngắn hơn nhé?',
  invalid_date: 'Ngày này không hợp lệ. Bạn nhập lại ngày, tháng và năm nhé?',
  invalid_now: 'Không xác định được ngày hiện tại. Bạn thử lại sau nhé?',
};

function result(items: ParsedItem[], reasons: ParseReason[]): ParseResult {
  const unique = [...new Set(reasons)];
  return {
    items,
    needs_clarification: unique.length > 0,
    reasons: unique,
    questions: unique.map((reason) => QUESTIONS[reason]),
  };
}

/** Pure proposal only: never persists data or calls an external provider. */
export function parseMessage(message: string, nowIso: string): ParseResult {
  // At most two UTF-16 code units per code point. Short-circuit huge inputs
  // before allocating the bounded code-point array, and count before NFC.
  if (message.length > 1000 || Array.from(message).length > 500) {
    return result([], ['message_too_long']);
  }
  if (!localToday(nowIso)) return result([], ['invalid_now']);
  const original = message.normalize('NFC');
  const messageDate = resolveDate(fold(original), nowIso);
  const items: ParsedItem[] = [];
  const reasons: ParseReason[] = [];
  let carry = '';

  for (const segment of splitSegments(original)) {
    const amounts = extractAmounts(segment.folded);
    const bare = bareNumbers(segment.folded);
    if (amounts.length === 0 && bare.length === 0) {
      carry = `${carry} ${segment.text}`.trim();
      continue;
    }
    const note = `${carry} ${segment.text}`.trim();
    const category = classify(fold(note));
    const segmentDate = resolveDate(segment.folded, nowIso);
    const date = segmentDate.explicit ? segmentDate : messageDate;
    const flags: ParseReason[] = [
      ...date.flags,
      ...amounts.flatMap((amount) => amount.flags),
    ];
    if (amounts.length === 0) flags.push('bare_small_number');
    if (amounts.length > 1) flags.push('multiple_amounts');
    items.push({
      ...category,
      amount_vnd: amounts.length === 1 ? (amounts[0]?.value ?? null) : null,
      note,
      occurred_on: date.date,
      flags: [...new Set(flags)],
    });
    reasons.push(...flags);
    carry = '';
  }
  if (items.length === 0) reasons.push(...messageDate.flags, 'no_amount_found');
  return result(items, reasons);
}
