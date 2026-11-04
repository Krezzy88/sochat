import { expect, it, vi, afterEach } from 'vitest';
import type pg from 'pg';
vi.mock('./assistant.ts', async (original) => ({
  ...(await original<typeof import('./assistant.ts')>()),
  generateStructured: vi.fn(),
}));
import { generateStructured } from './assistant.ts';
import { revise } from './revision.ts';
const item = {
  type: 'expense' as const,
  category: 'an_uong',
  amount_vnd: '50000',
  occurred_on: '2026-11-03',
  note: 'test',
};
const plan = {
  indices: [0],
  amount_vnd: 20000,
  amount_mode: 'increase',
  occurred_on: null,
  category: null,
  note: null,
  needs_clarification: false,
  question: '',
};
afterEach(() => vi.resetAllMocks());
it('applies explicit delta in code, leaving original draft intact and never writes', async () => {
  vi.mocked(generateStructured).mockResolvedValue(plan);
  const pool = {} as pg.Pool;
  const r = await revise(
    { message: 'tăng thêm 20k', items: [item] },
    new Date(),
    '1',
    pool,
  );
  expect(r.items[0]!.amount_vnd).toBe('70000');
  expect(item.amount_vnd).toBe('50000');
  const sent = vi.mocked(generateStructured).mock.calls[0]![0];
  expect(JSON.stringify(sent)).not.toContain('50000');
  expect(JSON.stringify(sent)).not.toContain('2026-11-03');
});
it.each([
  { indices: [4] },
  { indices: [0, 0] },
  { amount_vnd: 999 },
  { amount_mode: 'decrease', amount_vnd: 100000 },
  { category: 'luong' },
])('rejects invalid or hallucinated revision %j', async (patch) => {
  vi.mocked(generateStructured).mockResolvedValue({ ...plan, ...patch });
  expect(
    (
      await revise(
        { message: 'giảm 100k, tăng 20k', items: [item] },
        new Date(),
        '1',
        {} as pg.Pool,
      )
    ).needs_clarification,
  ).toBe(true);
});
it('requires explicit target with several drafts', async () => {
  vi.mocked(generateStructured).mockResolvedValue(plan);
  expect(
    (
      await revise(
        { message: 'tăng thêm 20k', items: [item, item] },
        new Date(),
        '1',
        {} as pg.Pool,
      )
    ).needs_clarification,
  ).toBe(true);
});
