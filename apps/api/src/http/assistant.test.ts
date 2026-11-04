import { expect, it } from 'vitest';
import { queryIntent } from './assistant.ts';
it('accepts bounded monthly filters and rejects invented categories, dates, SQL and identity fields', () => {
  expect(
    queryIntent.safeParse({
      month: '2026-11',
      category: 'an_uong',
      needs_clarification: false,
    }).success,
  ).toBe(true);
  for (const patch of [
    { month: '2026-13' },
    { month: '9999-12' },
    { category: 'DROP TABLE users' },
    { user_id: '2' },
    { sql: 'SELECT * FROM transactions' },
    { needs_clarification: 'false' },
  ])
    expect(
      queryIntent.safeParse({
        month: '2026-11',
        category: null,
        needs_clarification: false,
        ...patch,
      }).success,
    ).toBe(false);
});
