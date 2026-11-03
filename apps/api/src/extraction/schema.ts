import { z } from 'zod';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isCalendarDate,
} from '../../../../packages/parser/src/index.ts';
const fields = {
  amount_vnd: z.number().int().min(1).max(100_000_000_000),
  note: z.string().max(120),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().min(0).max(1),
};
const WireItem = z.strictObject({
  ...fields,
  type: z.enum(['expense', 'income']),
  category: z.enum([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]),
});
export const WireResult = z.strictObject({
  items: z.array(WireItem).max(10),
  needs_clarification: z.boolean(),
  clarification_question: z.string().max(200).nullable(),
});
export const LlmResult = WireResult.superRefine((value, ctx) => {
  for (const [index, item] of value.items.entries()) {
    const categories: readonly string[] =
      item.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!categories.includes(item.category))
      ctx.addIssue({
        code: 'custom',
        message: 'Category/type mismatch',
        path: ['items', index, 'category'],
      });
    if (!isCalendarDate(item.occurred_on))
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid calendar date',
        path: ['items', index, 'occurred_on'],
      });
  }
  if (!value.needs_clarification && value.items.length === 0)
    ctx.addIssue({
      code: 'custom',
      message: 'Empty result needs clarification',
    });
  if (value.needs_clarification && !value.clarification_question?.trim())
    ctx.addIssue({
      code: 'custom',
      message: 'Clarification question required',
    });
});
export type LlmOutput = z.infer<typeof LlmResult>;
// Server-side refinements are intentionally enforced again after generation.
export const RESPONSE_SCHEMA = z.toJSONSchema(WireResult);
