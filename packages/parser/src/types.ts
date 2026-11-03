export const EXPENSE_CATEGORIES = [
  'an_uong',
  'di_chuyen',
  'nha_tro',
  'hoc_tap',
  'giai_tri',
  'mua_sam',
  'suc_khoe',
  'hoa_don',
  'khac',
] as const;
export const INCOME_CATEGORIES = [
  'tro_cap',
  'luong',
  'lam_them',
  'thu_khac',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type Classification =
  | { type: 'expense'; category: ExpenseCategory }
  | { type: 'income'; category: IncomeCategory };

export type ParseReason =
  | 'amount_out_of_range'
  | 'negative_amount'
  | 'zero_amount'
  | 'malformed_amount'
  | 'fractional_vnd'
  | 'ambiguous_unit'
  | 'tiny_amount'
  | 'bare_small_number'
  | 'multiple_amounts'
  | 'no_amount_found'
  | 'message_too_long'
  | 'invalid_date'
  | 'invalid_now';

export type ParsedItem = Classification & {
  /** JSON-safe integer VND, capped at 1e11; normalization uses bigint internally. */
  amount_vnd: number | null;
  note: string;
  /** Null means the supplied calendar date needs clarification. */
  occurred_on: string | null;
  flags: ParseReason[];
};

export interface ParseResult {
  items: ParsedItem[];
  needs_clarification: boolean;
  reasons: ParseReason[];
  questions: string[];
}

export interface AmountMatch {
  value: number | null;
  start: number;
  end: number;
  flags: ParseReason[];
}

export interface DateResolution {
  date: string | null;
  explicit: boolean;
  flags: ParseReason[];
}
