import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import pg from 'pg';
import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
  vi,
} from 'vitest';
import { migrate } from './migrate.ts';
import { apiRepository } from '../http/repository.ts';
import {
  indexNotes,
  semanticSearch,
  semanticStatus,
  embeddings,
} from '../http/semantic.ts';
let container: StartedPostgreSqlContainer,
  pool: pg.Pool,
  user: string,
  other: string;
const now = new Date('2026-11-03T12:00:00Z');
const vector = () => Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18.6-bookworm').start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await migrate(pool);
});
afterAll(async () => {
  await pool?.end();
  await container?.stop();
});
beforeEach(async () => {
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM llm_global_daily_usage');
  const rows = (
    await pool.query(
      "INSERT INTO users(email,password_hash,display_name) VALUES('a@ai.test','hash','A'),('b@ai.test','hash','B') RETURNING id",
    )
  ).rows;
  user = rows[0].id;
  other = rows[1].id;
  vi.stubEnv('CI', '');
  vi.stubEnv('LLM_PROVIDER', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', 'synthetic-unit-key');
  vi.stubEnv('GEMINI_MODEL', 'synthetic-model');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function consent(enabled = true) {
  await pool.query(
    'INSERT INTO ai_preferences(user_id,semantic_enabled) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET semantic_enabled=$2',
    [user, enabled],
  );
}
async function seed() {
  await pool.query(
    "INSERT INTO transactions(user_id,category_id,type,amount_vnd,occurred_on,note) SELECT $1,id,'expense',50000,'2026-11-03','Mua thuốc 50000 test@example.test' FROM categories WHERE key='an_uong' AND user_id IS NULL",
    [user],
  );
}
const mockEmbedding = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ embeddings: [{ values: vector() }] })),
    ),
  );
it('refuses off-by-default retrieval without provider calls', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(indexNotes(user, pool, now)).rejects.toMatchObject({
    status: 403,
  });
  await expect(semanticSearch('thuốc', user, pool, now)).rejects.toMatchObject({
    status: 403,
  });
  expect(fetch).not.toHaveBeenCalled();
});
it('indexes sanitized notes, caches them, searches only owned vectors, and does not alter money', async () => {
  await consent();
  await seed();
  mockEmbedding();
  expect(await indexNotes(user, pool, now)).toEqual({ indexed: 1 });
  expect(await indexNotes(user, pool, now)).toEqual({ indexed: 0 });
  const sent = String(vi.mocked(fetch).mock.calls[0]![1]!.body);
  expect(sent).not.toMatch(/50000|example|user_id/);
  const result = await semanticSearch('thuốc', user, pool, now);
  expect(result.items).toHaveLength(1);
  expect(result.items[0]!.amount_vnd).toBe('50000');
  await pool.query(
    'INSERT INTO ai_preferences(user_id,semantic_enabled) VALUES($1,true)',
    [other],
  );
  expect(await semanticSearch('thuốc', other, pool, now)).toEqual({
    items: [],
    indexed: 0,
  });
});
it('does not persist embeddings when consent is revoked in flight', async () => {
  await consent();
  await seed();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      await consent(false);
      return new Response(
        JSON.stringify({ embeddings: [{ values: vector() }] }),
      );
    }),
  );
  await expect(indexNotes(user, pool, now)).rejects.toMatchObject({
    status: 403,
  });
  expect(
    (await pool.query('SELECT count(*) FROM transaction_embeddings')).rows[0]
      .count,
  ).toBe('0');
});
it.each(['http', 'invalid', 'network'])(
  'handles embedding provider failure %s',
  async (mode) => {
    await consent();
    await seed();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (mode === 'network') throw new Error('private');
        return mode === 'http'
          ? new Response('', { status: 500 })
          : new Response('{}');
      }),
    );
    await expect(indexNotes(user, pool, now)).rejects.toMatchObject({
      status: 503,
    });
  },
);
it('guards CI, empty batches and daily caps', async () => {
  vi.stubEnv('CI', 'true');
  await expect(embeddings(['test'], now, user, pool)).rejects.toMatchObject({
    status: 503,
  });
  vi.stubEnv('CI', '');
  await expect(embeddings([], now, user, pool)).rejects.toMatchObject({
    status: 400,
  });
  await pool.query(
    "INSERT INTO llm_daily_usage(user_id,day,calls) VALUES($1,'2026-11-03',10)",
    [user],
  );
  await expect(embeddings(['test'], now, user, pool)).rejects.toMatchObject({
    status: 429,
  });
});
import { revise } from '../http/revision.ts';
const draft = {
  type: 'expense' as const,
  category: 'an_uong',
  amount_vnd: '50000',
  occurred_on: '2026-11-03',
  note: 'private draft',
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
function modelReply(result: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(result) }] } },
            ],
          }),
        ),
    ),
  );
}
it.each([
  { patch: {}, message: 'tăng 20k', amount: '70000' },
  { patch: { amount_mode: 'set' }, message: 'sửa thành 20k', amount: '20000' },
  { patch: { amount_mode: 'decrease' }, message: 'giảm 20k', amount: '30000' },
  {
    patch: {
      amount_vnd: null,
      note: 'new',
      occurred_on: '2026-11-02',
      category: 'mua_sam',
    },
    message: 'đổi ghi chú new, ngày hôm qua, mua sắm',
    amount: '50000',
  },
])(
  'applies a validated model plan in code without ledger writes %j',
  async ({ patch, message, amount }) => {
    modelReply({ ...plan, ...patch });
    const r = await revise({ message, items: [draft] }, now, user, pool);
    expect(r.needs_clarification).toBe(false);
    expect(r.items[0]!.amount_vnd).toBe(amount);
    expect(
      (await pool.query('SELECT count(*) FROM transactions')).rows[0].count,
    ).toBe('0');
  },
);
it.each([
  { needs_clarification: true, question: 'Which?' },
  { indices: [] },
  { indices: [9] },
  { indices: [0, 0] },
  { amount_vnd: 999 },
  { category: 'luong' },
  { amount_mode: 'decrease', amount_vnd: 100000 },
  { amount_vnd: null },
])('keeps the draft unchanged for unsafe plan %j', async (patch) => {
  modelReply({ ...plan, ...patch });
  const r = await revise(
    { message: 'giảm 100k hoặc tăng 20k', items: [draft] },
    now,
    user,
    pool,
  );
  expect(r.needs_clarification).toBe(true);
  expect(r.items).toEqual([draft]);
});
it('clarifies ambiguous targets and missing original amount, supports an explicit numbered target', async () => {
  modelReply(plan);
  expect(
    (
      await revise(
        { message: 'tăng 20k', items: [draft, draft] },
        now,
        user,
        pool,
      )
    ).needs_clarification,
  ).toBe(true);
  expect(
    (
      await revise(
        { message: 'tăng khoản 1 thêm 20k', items: [draft, draft] },
        now,
        user,
        pool,
      )
    ).items[1],
  ).toEqual(draft);
  expect(
    (
      await revise(
        { message: 'tăng 20k', items: [{ ...draft, amount_vnd: '' }] },
        now,
        user,
        pool,
      )
    ).needs_clarification,
  ).toBe(true);
});
it.each(['http', 'network', 'envelope', 'json', 'schema'])(
  'sanitizes structured-provider failure %s',
  async (mode) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (mode === 'network') throw new Error('private-key');
        if (mode === 'http') return new Response('', { status: 500 });
        if (mode === 'envelope') return new Response('{}');
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: mode === 'json' ? 'invalid' : '{}' }],
                },
              },
            ],
          }),
        );
      }),
    );
    await expect(
      revise({ message: 'tăng 20k', items: [draft] }, now, user, pool),
    ).rejects.toMatchObject({ status: 503 });
  },
);

it('reports only committed embeddings if a note changes during provider work', async () => {
  await consent();
  await seed();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      await pool.query(
        "UPDATE transactions SET note='changed during request' WHERE user_id=$1",
        [user],
      );
      return new Response(
        JSON.stringify({ embeddings: [{ values: vector() }] }),
      );
    }),
  );
  expect(await indexNotes(user, pool, now)).toEqual({ indexed: 0 });
  expect(
    (await pool.query('SELECT count(*) FROM transaction_embeddings')).rows[0]
      .count,
  ).toBe('0');
});
it('does not return a transaction deleted during query embedding work', async () => {
  await consent();
  await seed();
  mockEmbedding();
  await indexNotes(user, pool, now);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      await pool.query('DELETE FROM transactions WHERE user_id=$1', [user]);
      return new Response(
        JSON.stringify({ embeddings: [{ values: vector() }] }),
      );
    }),
  );
  expect(await semanticSearch('thuốc', user, pool, now)).toEqual({
    indexed: 0,
    items: [],
  });
});

it('compares two monthly totals in one owner-scoped query including empty months and categories', async () => {
  await seed();
  await pool.query(
    "INSERT INTO transactions(user_id,category_id,type,amount_vnd,occurred_on,note) SELECT $1,id,'expense',20000,'2026-10-01','baseline' FROM categories WHERE key='an_uong' AND user_id IS NULL",
    [user],
  );
  await pool.query(
    "INSERT INTO transactions(user_id,category_id,type,amount_vnd,occurred_on,note) SELECT $1,id,'expense',999999,'2026-11-01','other' FROM categories WHERE key='an_uong' AND user_id IS NULL",
    [other],
  );
  const repo = apiRepository(pool, 'test-secret');
  expect(
    await repo.questionTotals(user, ['2026-10', '2026-11'], 'an_uong'),
  ).toEqual([
    { month: '2026-10', income_vnd: '0', expense_vnd: '20000' },
    { month: '2026-11', income_vnd: '0', expense_vnd: '50000' },
  ]);
  expect(await repo.questionTotals(user, ['2026-12'], null)).toEqual([
    { month: '2026-12', income_vnd: '0', expense_vnd: '0' },
  ]);
  expect(
    (await repo.questionTotals(user, ['2026-11'], 'di_chuyen'))[0]?.expense_vnd,
  ).toBe('0');
});

it('answers largest expenses and budget usage from one owner-scoped snapshot', async () => {
  await seed();
  const repo = apiRepository(pool, 'test-secret');
  const category = (
    await pool.query(
      "SELECT id FROM categories WHERE key='an_uong' AND user_id IS NULL",
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO budgets(user_id,category_id,month,limit_vnd) VALUES($1,$2,'2026-11-01',40000)",
    [user, category],
  );
  const largest = await repo.questionAnswer(
    user,
    '2026-11',
    null,
    null,
    'largest_expenses',
  );
  expect(largest.largest).toHaveLength(1);
  expect(largest.largest[0]?.amount_vnd).toBe('50000');
  const budget = await repo.questionAnswer(
    user,
    '2026-11',
    null,
    'an_uong',
    'budget_usage',
  );
  expect(budget.budgets[0]).toMatchObject({
    spent_vnd: '50000',
    limit_vnd: '40000',
    remaining_vnd: '0',
    status: 'exceeded',
  });
  expect(
    (
      await repo.questionAnswer(
        other,
        '2026-11',
        null,
        null,
        'largest_expenses',
      )
    ).largest,
  ).toHaveLength(0);
  expect(
    (await repo.questionAnswer(other, '2026-11', null, null, 'budget_usage'))
      .budgets,
  ).toHaveLength(0);
});

it('reports owned search preparation progress and excludes non-descriptive notes', async () => {
  await consent();
  await seed();
  expect(await semanticStatus(user, pool)).toEqual({
    indexed: 0,
    pending: 1,
    total: 1,
  });
  mockEmbedding();
  await indexNotes(user, pool, now);
  expect(await semanticStatus(user, pool)).toEqual({
    indexed: 1,
    pending: 0,
    total: 1,
  });
  await expect(semanticStatus(other, pool)).rejects.toMatchObject({
    status: 403,
  });
});
