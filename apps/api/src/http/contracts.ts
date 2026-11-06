import { z } from 'zod';
import { isCalendarDate } from '../../../../packages/parser/src/index.ts';
export const id = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine(
    (v) => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n,
  );
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate)
  .meta({ format: 'date' });
export const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .refine((v) => isCalendarDate(v + '-01') && Number(v.slice(0, 4)) < 9999);
export const money = z
  .union([
    z.number().int().min(1).max(100_000_000_000),
    z.string().regex(/^(?:[1-9]\d{0,10}|100000000000)$/),
  ])
  .transform((v) => BigInt(v));
export const category = z.string().regex(/^[a-z_]{2,40}$/);
export const note = z
  .string()
  .max(300)
  .transform((v) => v.normalize('NFC'));
export const transaction = z.strictObject({
  type: z.enum(['expense', 'income']),
  amount_vnd: money,
  category,
  note: note.default(''),
  occurred_on: day,
});
export const transactionPatch = transaction
  .partial()
  .extend({ version: id })
  .refine((v) => Object.keys(v).length > 1);
export const registration = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  display_name: z.string().trim().min(1).max(80),
});
export const login = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
export const profileUpdate = z
  .strictObject({
    display_name: z.string().trim().min(1).max(80).optional(),
    current_password: z.string().min(1).max(128).optional(),
    new_password: z.string().min(12).max(128).optional(),
  })
  .refine(
    (v) =>
      (v.current_password === undefined) === (v.new_password === undefined) &&
      (v.display_name !== undefined || v.new_password !== undefined),
  );
export const batch = z.strictObject({
  items: z.array(transaction).min(1).max(10),
  idempotency_key: z.uuid(),
});
export const idParams = z.strictObject({ id });
export const empty = z.strictObject({});
export const monthQuery = z.strictObject({ month });
export const yearQuery = z.strictObject({
  year: z.coerce.number().int().min(1).max(9998),
});
export const listQuery = z
  .strictObject({
    search: z.string().trim().max(100).normalize().optional(),
    from: day.optional(),
    to: day.optional(),
    category: category.optional(),
    type: z.enum(['expense', 'income']).optional(),
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .max(256)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to);
export const cursor = z.strictObject({ date: day, id });
export const budgetVersion = z
  .string()
  .regex(/^[1-9]\d{0,18}:[1-9]\d{0,18}$/)
  .refine((v) => v.split(':').every((n) => BigInt(n) <= 9223372036854775807n));
export const budgets = z
  .strictObject({
    items: z
      .array(
        z.strictObject({
          category,
          limit_vnd: money,
          version: z.union([z.literal('0'), budgetVersion]),
        }),
      )
      .min(1)
      .max(30),
  })
  .refine(
    (v) => new Set(v.items.map((x) => x.category)).size === v.items.length,
  );
export const goal = z.strictObject({
  name: z.string().trim().min(1).max(100),
  target_vnd: money,
  deadline: day,
});
export const goalCreate = goal.extend({ idempotency_key: z.uuid() });
export const goalPatch = goal
  .partial()
  .extend({ version: id })
  .refine((v) => Object.keys(v).length > 1);
export const contribution = z.strictObject({
  idempotency_key: z.uuid(),
  amount_vnd: money,
  contributed_on: day,
  note: note.default(''),
});
export const message = z.strictObject({
  message: z
    .string()
    .refine(
      (v) => Array.from(v).length <= 500,
      'Maximum 500 Unicode characters',
    ),
});
export type Transaction = z.infer<typeof transaction>;
export type Goal = z.infer<typeof goal>;
export const problem = z.strictObject({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
});
export function nextMonth(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return `${String(m === 12 ? (y ?? 0) + 1 : y).padStart(4, '0')}-${String(m === 12 ? 1 : (m ?? 0) + 1).padStart(2, '0')}-01`;
}
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  );
}
