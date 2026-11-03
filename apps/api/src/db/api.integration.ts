import { readFileSync } from 'node:fs';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import pg from 'pg';
import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { randomUUID } from 'node:crypto';
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { createApp } from '../http/app.ts';
import { HybridExtractor } from '../extraction/hybrid.ts';
import { FakeProvider } from '../extraction/provider.ts';
import { MemoryExtractionStore } from '../extraction/store.ts';
import { migrate } from './migrate.ts';
import { problem } from '../http/contracts.ts';
let container: StartedPostgreSqlContainer;
let pool: pg.Pool;
let runtime: Awaited<ReturnType<typeof createApp>>;
type Actor = {
  agent: ReturnType<typeof request.agent>;
  token: string;
  id: string;
  email: string;
};
let a: Actor;
let b: Actor;
const origin = 'http://localhost:5173';
const password = 'Synthetic-password-2026';
const transaction = {
  type: 'expense',
  amount_vnd: '50000',
  category: 'an_uong',
  note: 'owner-a-marker',
  occurred_on: '2026-11-02',
};
const now = () => new Date('2026-11-03T09:00:00+07:00');
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18.6-bookworm').start();
  pool = new pg.Pool({
    connectionString: container.getConnectionUri(),
    max: 10,
  });
  await migrate(pool);
  runtime = await createApp({
    pool,
    origin,
    sessionSecret: 'test-only-session-secret-'.repeat(3),
    now,
    extractor: new HybridExtractor(
      new FakeProvider(
        [
          {
            items: [],
            needs_clarification: true,
            clarification_question: 'Bao nhiêu đồng?',
          },
        ],
        true,
      ),
      new MemoryExtractionStore(),
      { perUser: 50, global: 500 },
    ),
    limits: { login: 2, parse: 2, register: 100, authIp: 100 },
  });
});
afterAll(async () => {
  await runtime?.close();
  await pool?.end();
  await container?.stop();
});
async function actor(): Promise<Actor> {
  const agent = request.agent(runtime.app);
  const csrf = await agent.get('/api/auth/csrf').expect(200);
  const email = `synthetic-${randomUUID()}@example.test`;
  const result = await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .set('X-CSRF-Token', csrf.body.csrf_token)
    .send({ email, password, display_name: 'Synthetic' })
    .expect(201);
  return {
    agent,
    token: result.body.csrf_token,
    id: result.body.user.id,
    email,
  };
}
beforeEach(async () => {
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM api_rate_limits');
  a = await actor();
  b = await actor();
});
function call(
  actor: Actor,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  body?: object | string,
) {
  let test = actor.agent[method](path)
    .set('Origin', origin)
    .set('X-CSRF-Token', actor.token);
  if (body !== undefined) test = test.send(body);
  return test;
}
async function save(
  actor: Actor,
  items: unknown[] = [transaction],
  key = randomUUID(),
) {
  return call(actor, 'post', '/api/transactions/batch', {
    items,
    idempotency_key: key,
  }).expect(201);
}
async function goal(actor: Actor = a) {
  return call(actor, 'post', '/api/goals', {
    name: 'Laptop',
    target_vnd: '100000',
    deadline: '2026-11-13',
  }).expect(201);
}
describe('auth/session/CSRF and validation', () => {
  it('stores argon2id hashes and only an opaque httpOnly cookie', async () => {
    const hash = (
      await pool.query('SELECT password_hash FROM users WHERE id=$1', [a.id])
    ).rows[0].password_hash;
    expect(hash).toMatch(/^\$argon2id\$/);
    const response = await call(a, 'get', '/api/me').expect(200);
    expect(response.body.user.id).toBe(a.id);
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    const sessions = await pool.query(
      'SELECT user_id FROM sessions WHERE user_id=$1',
      [a.id],
    );
    expect(sessions.rowCount).toBe(1);
  });
  it('rotates SID and CSRF on login and destroys logout sessions', async () => {
    const agent = request.agent(runtime.app);
    const initial = await agent.get('/api/auth/csrf').expect(200);
    const old =
      String((initial.headers['set-cookie'] ?? [])[0]).split(';')[0] ?? '';
    const logged = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', initial.body.csrf_token)
      .send({ email: a.email, password })
      .expect(200);
    const cookie = String(logged.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(logged.body.csrf_token).not.toBe(initial.body.csrf_token);
    await request(runtime.app).get('/api/me').set('Cookie', old).expect(401);
    await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', logged.body.csrf_token)
      .expect(204);
    await agent.get('/api/me').expect(401);
  });
  it('requires valid CSRF for login/register and all authenticated writes', async () => {
    await a.agent.post('/api/auth/logout').expect(403);
    await a.agent
      .post('/api/chat/parse')
      .set('X-CSRF-Token', 'bad')
      .send({ message: 'phở 50k' })
      .expect(403);
    await request(runtime.app)
      .post('/api/auth/login')
      .send({ email: a.email, password })
      .expect(403);
    await request(runtime.app)
      .post('/api/auth/register')
      .send({ email: 'n@example.test', password, display_name: 'N' })
      .expect(403);
  });
  it('blocks other origins and rejects unexpected identity fields', async () => {
    await a.agent
      .get('/api/me')
      .set('Origin', 'https://attacker.invalid')
      .expect(403);
    await call(a, 'get', '/api/me?user_id=' + b.id).expect(400);
    await call(a, 'delete', '/api/me', { user_id: b.id }).expect(400);
    expect(
      (await pool.query('SELECT id FROM users WHERE id=$1', [b.id])).rowCount,
    ).toBe(1);
  });
  it('uses generic login errors and throttles by IP plus normalized email', async () => {
    const agent = request.agent(runtime.app);
    const csrf = (await agent.get('/api/auth/csrf')).body.csrf_token;
    for (let i = 0; i < 2; i++)
      await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrf)
        .send({ email: a.email.toUpperCase(), password: 'wrong' })
        .expect(401);
    const blocked = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .set('X-Forwarded-For', '192.0.2.99')
      .send({ email: a.email, password })
      .expect(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(problem.safeParse(blocked.body).success).toBe(true);
  });
  it.each([
    ['post', '/api/chat/parse', { message: 'a'.repeat(501) }],
    [
      'post',
      '/api/transactions/batch',
      {
        items: [{ ...transaction, amount_vnd: '0' }],
        idempotency_key: randomUUID(),
      },
    ],
    [
      'post',
      '/api/transactions/batch',
      {
        items: [{ ...transaction, amount_vnd: 1.5 }],
        idempotency_key: randomUUID(),
      },
    ],
    [
      'post',
      '/api/transactions/batch',
      {
        items: [{ ...transaction, occurred_on: '2026-02-31' }],
        idempotency_key: randomUUID(),
      },
    ],
    ['patch', '/api/transactions/not-an-id', { note: 'bad' }],
    ['get', '/api/reports/month?month=2026-13', undefined],
    ['get', '/api/transactions?cursor=garbage', undefined],
    [
      'post',
      '/api/goals',
      { name: '', target_vnd: '1', deadline: '2026-11-01' },
    ],
  ] as const)(
    'returns problem+json for invalid %s %s',
    async (method, path, body) => {
      const result = await call(a, method, path, body).expect(400);
      expect(result.type).toBe('application/problem+json');
      expect(problem.safeParse(result.body).success).toBe(true);
    },
  );
  it('requires authentication for every private route', async () => {
    const spec = runtime.openapi.paths;
    for (const [path, methods] of Object.entries(spec)) {
      for (const [method, definition] of Object.entries(methods)) {
        const d = definition as { security: unknown[] };
        if (!d.security.length) continue;
        const target = path.replace('{id}', '1');
        const response = await request(runtime.app)[method as 'get'](target);
        expect(response.status, `${method} ${target}`).toBe(401);
      }
    }
  });
});
describe('proposal, confirmation and idempotency', () => {
  it('does not save a parse proposal; throttles parse per user', async () => {
    const first = await call(a, 'post', '/api/chat/parse', {
      message: 'phở 50k',
    }).expect(200);
    expect(first.body.items[0].needs_confirmation).toBe(true);
    expect(
      (
        await pool.query('SELECT count(*) FROM transactions WHERE user_id=$1', [
          a.id,
        ])
      ).rows[0].count,
    ).toBe('0');
    await call(a, 'post', '/api/chat/parse', { message: 'phở 50k' }).expect(
      200,
    );
    await call(a, 'post', '/api/chat/parse', { message: 'phở 50k' }).expect(
      429,
    );
    await call(b, 'post', '/api/chat/parse', { message: 'phở 50k' }).expect(
      200,
    );
  });
  it('saves once for concurrent retries and rejects key reuse with a different payload', async () => {
    const key = randomUUID();
    const [x, y] = await Promise.all([
      save(a, [transaction], key),
      save(a, [transaction], key),
    ]);
    expect(x.body).toEqual(y.body);
    expect(
      (
        await pool.query('SELECT count(*) FROM transactions WHERE user_id=$1', [
          a.id,
        ])
      ).rows[0].count,
    ).toBe('1');
    await call(a, 'post', '/api/transactions/batch', {
      idempotency_key: key,
      items: [{ ...transaction, amount_vnd: '1' }],
    }).expect(409);
    const other = await save(b, [transaction], key);
    expect(other.body.items[0].id).not.toBe(x.body.items[0].id);
  });
  it('rolls back an entire batch when a later category is invalid', async () => {
    const key = randomUUID();
    await call(a, 'post', '/api/transactions/batch', {
      idempotency_key: key,
      items: [transaction, { ...transaction, category: 'not_visible' }],
    }).expect(404);
    expect(
      (
        await pool.query('SELECT count(*) FROM transactions WHERE user_id=$1', [
          a.id,
        ])
      ).rows[0].count,
    ).toBe('0');
    await save(a, [transaction], key);
  });
  it('supports stable cursor pagination, filtering and edits/deletes', async () => {
    await save(a, [
      transaction,
      { ...transaction, amount_vnd: 25000 },
      {
        ...transaction,
        category: 'di_chuyen',
        note: 'bus',
        occurred_on: '2026-11-01',
      },
    ]);
    const first = await call(a, 'get', '/api/transactions?limit=1').expect(200);
    const second = await call(
      a,
      'get',
      '/api/transactions?limit=1&cursor=' + first.body.next_cursor,
    ).expect(200);
    expect(first.body.items[0].id).not.toBe(second.body.items[0].id);
    const filtered = await call(
      a,
      'get',
      '/api/transactions?category=di_chuyen&from=2026-11-01&to=2026-11-01&type=expense',
    ).expect(200);
    expect(filtered.body.items).toHaveLength(1);
    const id = filtered.body.items[0].id;
    const updated = await call(a, 'patch', '/api/transactions/' + id, {
      amount_vnd: '12345',
      note: 'edited',
    }).expect(200);
    expect(updated.body.amount_vnd).toBe('12345');
    await call(a, 'delete', '/api/transactions/' + id).expect(204);
    await call(a, 'delete', '/api/transactions/' + id).expect(404);
  });
});
describe('two-user endpoint isolation', () => {
  it.each([
    ['patch', '/api/transactions/ID', { note: 'attacker' }],
    ['delete', '/api/transactions/ID', undefined],
    ['get', '/api/goals/ID', undefined],
    ['patch', '/api/goals/ID', { name: 'attacker' }],
    ['delete', '/api/goals/ID', undefined],
    [
      'post',
      '/api/goals/ID/contributions',
      { amount_vnd: '1', contributed_on: '2026-11-03' },
    ],
  ] as const)(
    'returns 404 for B attempting %s %s on A data',
    async (method, path, body) => {
      const txn = (await save(a)).body.items[0].id;
      const g = (await goal()).body.id;
      const id = path.includes('transactions') ? txn : g;
      await call(b, method, path.replace('ID', id), body).expect(404);
      expect(
        (await call(a, 'get', '/api/transactions')).body.items[0].note,
      ).toBe('owner-a-marker');
      await call(a, 'get', '/api/goals/' + g).expect(200);
    },
  );
  it('isolates every data-returning collection/report and the profile/export', async () => {
    await save(a);
    await goal();
    await call(a, 'put', '/api/budgets?month=2026-11', {
      items: [{ category: 'an_uong', limit_vnd: '100000' }],
    }).expect(200);
    const privateCategory = (
      await pool.query(
        "INSERT INTO categories(user_id,key,name_vi,type) VALUES($1,'private_food','Private','expense') RETURNING id",
        [a.id],
      )
    ).rows[0].id;
    for (const path of [
      '/api/transactions',
      '/api/goals',
      '/api/budgets?month=2026-11',
      '/api/budgets/status?month=2026-11',
    ])
      expect((await call(b, 'get', path).expect(200)).body.items).toEqual([]);
    for (const path of [
      '/api/reports/month?month=2026-11',
      '/api/reports/year?year=2026',
    ])
      expect(
        (await call(b, 'get', path).expect(200)).body.totals.expense_vnd,
      ).toBe('0');
    expect(
      (await call(b, 'get', '/api/categories')).body.items,
    ).not.toContainEqual(expect.objectContaining({ id: privateCategory }));
    expect((await call(b, 'get', '/api/me')).body.user.id).toBe(b.id);
    expect((await call(b, 'get', '/api/me/export')).text).not.toContain(
      'owner-a-marker',
    );
    await call(b, 'put', '/api/budgets?month=2026-11', {
      items: [{ category: 'private_food', limit_vnd: '1' }],
    }).expect(404);
    await call(b, 'post', '/api/transactions/batch', {
      idempotency_key: randomUUID(),
      items: [{ ...transaction, category: 'private_food' }],
    }).expect(404);
  });
});
describe('reports, budgets, goals, export and account deletion', () => {
  it('computes exact reports and 80/100 percent thresholds in code/SQL', async () => {
    await save(a, [
      transaction,
      {
        ...transaction,
        type: 'income',
        category: 'luong',
        amount_vnd: '100000',
        occurred_on: '2026-11-03',
      },
    ]);
    const report = await call(
      a,
      'get',
      '/api/reports/month?month=2026-11',
    ).expect(200);
    expect(report.body.totals).toEqual({
      income_vnd: '100000',
      expense_vnd: '50000',
      net_vnd: '50000',
    });
    expect(report.body.daily).toEqual([
      { occurred_on: '2026-11-02', type: 'expense', total_vnd: '50000' },
      { occurred_on: '2026-11-03', type: 'income', total_vnd: '100000' },
    ]);
    expect(report.body.top_notes[0].total_vnd).toBe('50000');
    expect(
      (await call(a, 'get', '/api/reports/year?year=2026')).body.months,
    ).toHaveLength(2);
    await call(a, 'put', '/api/budgets?month=2026-11', {
      items: [{ category: 'an_uong', limit_vnd: '100000' }],
    }).expect(200);
    const status = async () =>
      (await call(a, 'get', '/api/budgets/status?month=2026-11').expect(200))
        .body.items[0].status;
    expect(await status()).toBe('ok');
    await save(a, [{ ...transaction, amount_vnd: '30000' }]);
    expect(await status()).toBe('warning');
    await save(a, [{ ...transaction, amount_vnd: '20000' }]);
    expect(await status()).toBe('exceeded');
  });
  it('computes savings goals with integer ceiling and handles past deadlines', async () => {
    const g = (await goal()).body;
    expect(g.suggested_daily_saving_vnd).toBe('10000');
    await call(a, 'post', '/api/goals/' + g.id + '/contributions', {
      amount_vnd: '1',
      contributed_on: '2026-11-03',
    }).expect(201);
    const partial = await call(a, 'get', '/api/goals/' + g.id).expect(200);
    expect(partial.body.remaining_vnd).toBe('99999');
    expect(partial.body.suggested_daily_saving_vnd).toBe('10000');
    const past = await call(a, 'patch', '/api/goals/' + g.id, {
      deadline: '2026-11-01',
    }).expect(200);
    expect(past.body.suggested_daily_saving_vnd).toBeNull();
    await call(a, 'delete', '/api/goals/' + g.id).expect(204);
    expect(
      (
        await pool.query(
          'SELECT count(*) FROM goal_contributions WHERE goal_id=$1',
          [g.id],
        )
      ).rows[0].count,
    ).toBe('0');
  });
  it('exports owned integer VND and protects CSV formula cells', async () => {
    await save(a, [
      { ...transaction, note: '=HYPERLINK("https://example.invalid")' },
    ]);
    const exported = await call(a, 'get', '/api/me/export').expect(200);
    expect(exported.type).toBe('text/csv');
    expect(exported.text).toContain('50000');
    expect(exported.text).toContain("'=HYPERLINK");
    expect(exported.headers['content-disposition']).toContain('attachment');
  });
  it('hard deletion leaves zero rows in every user-owned table and revokes all sessions', async () => {
    await save(a);
    const g = (await goal()).body;
    await call(a, 'post', '/api/goals/' + g.id + '/contributions', {
      amount_vnd: '1',
      contributed_on: '2026-11-03',
    }).expect(201);
    await call(a, 'put', '/api/budgets?month=2026-11', {
      items: [{ category: 'an_uong', limit_vnd: '1' }],
    });
    await pool.query(
      "INSERT INTO llm_cache(user_id,key,response,model) VALUES($1,'synthetic','{}','fake')",
      [a.id],
    );
    await pool.query(
      "INSERT INTO llm_daily_usage(user_id,day,calls) VALUES($1,'2026-11-03',1)",
      [a.id],
    );
    const second = request.agent(runtime.app);
    const csrf = (await second.get('/api/auth/csrf')).body.csrf_token;
    await second
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: a.email, password })
      .expect(200);
    await call(a, 'delete', '/api/me').expect(204);
    await second.get('/api/me').expect(401);
    await a.agent.get('/api/me').expect(401);
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='user_id'",
    );
    for (const row of tables.rows) {
      const table = String(row.table_name);
      if (!/^[a-z_]+$/.test(table)) throw new Error('Unsafe catalog name');
      expect(
        (
          await pool.query(`SELECT count(*) FROM "${table}" WHERE user_id=$1`, [
            a.id,
          ])
        ).rows[0].count,
      ).toBe('0');
    }
    expect((await call(b, 'get', '/api/me').expect(200)).body.user.id).toBe(
      b.id,
    );
  });
  it('validates a generated OpenAPI 3.1 document and serves that same contract', async () => {
    const document = JSON.parse(JSON.stringify(runtime.openapi));
    await SwaggerParser.validate(document);
    const retained = JSON.parse(
      readFileSync(new URL('../../openapi.json', import.meta.url), 'utf8'),
    );
    expect(retained).toEqual(runtime.openapi);
    expect(
      (await request(runtime.app).get('/openapi.json').expect(200)).body,
    ).toEqual(runtime.openapi);
    expect(Object.keys(runtime.openapi.paths)).toContain(
      '/api/transactions/batch',
    );
  });
  it('sets Secure cookies and requires HTTPS in production', async () => {
    const prod = await createApp({
      pool,
      origin: 'https://sochat.example.test',
      sessionSecret: 'production-test-secret-'.repeat(3),
      production: true,
      trustProxyHops: 1,
      extractor: new HybridExtractor(
        new FakeProvider([]),
        new MemoryExtractionStore(),
        { perUser: 1, global: 1 },
      ),
    });
    try {
      await request(prod.app).get('/api/auth/csrf').expect(400);
      const response = await request(prod.app)
        .get('/api/auth/csrf')
        .set('X-Forwarded-Proto', 'https')
        .expect(200);
      expect(String(response.headers['set-cookie'])).toContain('Secure');
      expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
      expect(String(response.headers['set-cookie'])).toContain('SameSite=Lax');
    } finally {
      await prod.close();
    }
  });
});

it('rejects duplicate registration without returning SQL details and rejects tampered cookies', async () => {
  const agent = request.agent(runtime.app);
  const csrf = (await agent.get('/api/auth/csrf')).body.csrf_token;
  const duplicate = await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrf)
    .send({ email: a.email, password, display_name: 'Duplicate' })
    .expect(409);
  expect(JSON.stringify(duplicate.body)).not.toContain(a.email);
  expect(JSON.stringify(duplicate.body)).not.toContain('password_hash');
  await request(runtime.app)
    .get('/api/me')
    .set('Cookie', 'sochat.sid=s%3Atampered.signature')
    .expect(401);
});
it('returns problem responses for malformed JSON, oversized bodies and wrong content type', async () => {
  const bad = await a.agent
    .post('/api/chat/parse')
    .set('X-CSRF-Token', a.token)
    .type('json')
    .send('{bad')
    .expect(400);
  expect(problem.safeParse(bad.body).success).toBe(true);
  const large = await call(a, 'post', '/api/chat/parse', {
    message: 'a'.repeat(20000),
  }).expect(413);
  expect(problem.safeParse(large.body).success).toBe(true);
  await a.agent
    .post('/api/chat/parse')
    .set('X-CSRF-Token', a.token)
    .type('text')
    .send('phở 50k')
    .expect(415);
});
it('streams all owned export rows across the 500-row page boundary', async () => {
  await pool.query(
    "INSERT INTO transactions(user_id,type,amount_vnd,category_id,note,occurred_on) SELECT $1,'expense'::txn_type,1000,c.id,'synthetic-export-'||g,DATE '2026-11-02' FROM generate_series(1,601) g CROSS JOIN categories c WHERE c.key='an_uong' AND c.user_id IS NULL",
    [a.id],
  );
  const exported = await call(a, 'get', '/api/me/export').expect(200);
  expect(exported.text).toContain('synthetic-export-601');
  expect(exported.text.split('\r\n').filter(Boolean)).toHaveLength(602);
});

it('never invokes the live assistant in a fake app and rejects supplied account identity', async () => {
  await call(a, 'post', '/api/assistant/query', {
    message: 'Tháng này ăn uống bao nhiêu?',
    user_id: b.id,
  }).expect(400);
  await call(a, 'post', '/api/assistant/query', {
    message: 'Tháng này ăn uống bao nhiêu?',
  }).expect(503);
  expect((await call(a, 'get', '/api/transactions')).body.items).toHaveLength(
    0,
  );
});

it('executes only typed read filters, isolates users, and never sends ledger rows to Gemini', async () => {
  const original = runtime;
  const replies: unknown[] = [
    { month: '2026-11', category: 'an_uong', needs_clarification: false },
    { month: '2026-11', category: 'an_uong', needs_clarification: false },
    { month: '2026-11', category: null, needs_clarification: true },
    { month: '2026-99', category: null, needs_clarification: false },
  ];
  const bodies: string[] = [];
  const transport = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, options) => {
      bodies.push(String(options?.body));
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(replies.shift()) }] } },
          ],
        }),
      );
    });
  vi.stubEnv('LLM_PROVIDER', 'gemini');
  vi.stubEnv('GEMINI_MODEL', 'gemini-synthetic');
  vi.stubEnv('GEMINI_API_KEY', 'synthetic-not-real');
  vi.stubEnv('CI', '');
  try {
    runtime = await createApp({
      pool,
      origin,
      sessionSecret: 'synthetic-query-test-'.repeat(3),
      now,
      extractor: {
        providerName: 'gemini',
        parseHybrid: async () => {
          throw new Error('Not used');
        },
      },
    });
    const first = await actor(),
      second = await actor();
    await save(first, [{ ...transaction, note: 'private-fixture-first' }]);
    await save(second, [
      { ...transaction, amount_vnd: '900000', note: 'private-fixture-second' },
    ]);
    const one = await call(first, 'post', '/api/assistant/query', {
      message: 'Tháng 11 ăn uống bao nhiêu?',
    }).expect(200);
    expect(one.body.expense_vnd).toBe('50000');
    const two = await call(second, 'post', '/api/assistant/query', {
      message: 'Tháng 11 ăn uống bao nhiêu?',
    }).expect(200);
    expect(two.body.expense_vnd).toBe('900000');
    expect(
      (
        await call(first, 'post', '/api/assistant/query', {
          message: 'So sánh nhiều tháng',
        }).expect(200)
      ).body.needs_clarification,
    ).toBe(true);
    await call(first, 'post', '/api/assistant/query', {
      message: 'Tháng này',
    }).expect(503);
    vi.stubEnv('CI', 'true');
    await call(first, 'post', '/api/assistant/query', {
      message: 'Tháng này',
    }).expect(503);
    expect(bodies).toHaveLength(4);
    expect(bodies.join('')).not.toMatch(
      /private-fixture|@example\.test|password_hash|SELECT/,
    );
    expect(
      (await call(first, 'get', '/api/transactions')).body.items,
    ).toHaveLength(1);
  } finally {
    if (runtime !== original) await runtime.close();
    runtime = original;
    transport.mockRestore();
    vi.unstubAllEnvs();
  }
});
