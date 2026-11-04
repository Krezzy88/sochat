import { readFileSync } from 'node:fs';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import pg from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { migrate } from './migrate.ts';
import { tenantPool, withTenant } from './tenant.ts';
let container: StartedPostgreSqlContainer, pool: pg.Pool, scoped: pg.Pool;
let a: string, b: string;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18.6-bookworm').start();
  pool = new pg.Pool({
    connectionString: container.getConnectionUri(),
    max: 1,
  });
  await migrate(pool);
  const users = await pool.query(
    "INSERT INTO users(email,password_hash,display_name) VALUES('a@rls.test','hash','A'),('b@rls.test','hash','B') RETURNING id",
  );
  [a, b] = users.rows.map((r) => r.id);
  await pool.query(
    'INSERT INTO ai_preferences(user_id,semantic_enabled) VALUES($1,true),($2,false)',
    [a, b],
  );
  await pool.query(
    readFileSync(
      new URL('../../../../db/enable-rls.sql', import.meta.url),
      'utf8',
    ),
  );
  scoped = tenantPool(pool, true);
});
afterAll(async () => {
  await pool?.end();
  await container?.stop();
});
it('isolates queries with intentionally omitted predicates on one reused connection', async () => {
  for (let i = 0; i < 3; i++)
    for (const user of [a, b])
      await withTenant(user, async () => {
        expect(
          (await scoped.query('SELECT user_id FROM ai_preferences')).rows,
        ).toEqual([{ user_id: user }]);
      });
  const results = await Promise.all(
    [a, b, a, b].map((user) =>
      withTenant(user, async () => ({
        user,
        rows: (await scoped.query('SELECT user_id FROM ai_preferences')).rows,
      })),
    ),
  );
  for (const r of results) expect(r.rows).toEqual([{ user_id: r.user }]);
});
it('denies cross-user writes and clears context on failed transactions', async () => {
  await expect(
    withTenant(a, () =>
      scoped.query(
        'UPDATE ai_preferences SET semantic_enabled=true WHERE user_id=$1 RETURNING user_id',
        [b],
      ),
    ),
  ).resolves.toMatchObject({ rowCount: 0 });
  await expect(
    withTenant(a, () =>
      scoped.query('INSERT INTO ai_preferences(user_id) VALUES($1)', [b]),
    ),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(
    withTenant(a, () => scoped.query('SELECT 1/0')),
  ).rejects.toMatchObject({ code: '22012' });
  await withTenant(b, async () => {
    const c = await scoped.connect();
    try {
      await c.query('BEGIN');
      expect(
        (await c.query('SELECT user_id FROM ai_preferences')).rows,
      ).toEqual([{ user_id: b }]);
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  });
  expect(
    (
      await pool.query(
        "SELECT current_user AS role,current_setting('sochat.user_id',true) AS tenant",
      )
    ).rows[0],
  ).toMatchObject({ role: 'test', tenant: '' });
});

it('fails closed for client queries outside an explicit tenant transaction', async () => {
  await withTenant(a, async () => {
    const c = await scoped.connect();
    try {
      await expect(c.query('SELECT * FROM ai_preferences')).rejects.toThrow(
        'explicit transaction',
      );
      await c.query('BEGIN');
      await expect(c.query('BEGIN')).rejects.toThrow('Nested');
    } finally {
      c.release();
    }
  });
  await withTenant(b, async () => {
    expect(
      (await scoped.query('SELECT user_id FROM ai_preferences')).rows,
    ).toEqual([{ user_id: b }]);
  });
});
