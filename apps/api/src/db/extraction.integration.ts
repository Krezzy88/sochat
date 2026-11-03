import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import pg from 'pg';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { migrate } from './migrate.ts';
import { PgExtractionStore } from '../extraction/store.ts';
let container: StartedPostgreSqlContainer;
let pool: pg.Pool;
let store: PgExtractionStore;
let a: string;
let b: string;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18.6-bookworm').start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await migrate(pool);
  store = new PgExtractionStore(pool);
});
afterAll(async () => {
  await pool?.end();
  await container?.stop();
});
beforeEach(async () => {
  await pool.query('DELETE FROM users');
  await pool.query('TRUNCATE llm_global_daily_usage');
  const rows = await pool.query(
    "INSERT INTO users(email,password_hash,display_name) VALUES('a@example.test','fake','A'),('b@example.test','fake','B') RETURNING id",
  );
  a = rows.rows[0].id;
  b = rows.rows[1].id;
});
it('atomically enforces per-user and global limits across concurrent connections', async () => {
  const values = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      store.reserve(i % 2 ? a : b, '2026-11-03', { perUser: 3, global: 5 }),
    ),
  );
  expect(values.filter(Boolean)).toHaveLength(5);
  const rows = await pool.query('SELECT calls FROM llm_daily_usage');
  expect(rows.rows.every((r) => r.calls <= 3)).toBe(true);
  expect(
    (await pool.query('SELECT calls FROM llm_global_daily_usage')).rows[0]
      .calls,
  ).toBe(5);
  expect(await store.reserve(a, '2026-11-04', { perUser: 3, global: 5 })).toBe(
    true,
  );
});
it('isolates cache ownership and expires responses after 24 hours', async () => {
  await store.put(a, 'same', 'fake', { items: [] });
  expect(await store.get(b, 'same')).toBeNull();
  expect(await store.get(a, 'same')).toEqual({ items: [] });
  await pool.query(
    "UPDATE llm_cache SET created_at=now()-interval '25 hours' WHERE user_id=$1",
    [a],
  );
  expect(await store.get(a, 'same')).toBeNull();
});
it('deletion removes cache and per-user usage without refunding the global budget', async () => {
  await store.put(a, 'key', 'fake', { items: [] });
  await store.reserve(a, '2026-11-03', { perUser: 1, global: 1 });
  await pool.query('DELETE FROM users WHERE id=$1', [a]);
  expect(
    (await pool.query('SELECT count(*) FROM llm_daily_usage')).rows[0].count,
  ).toBe('0');
  expect(await store.get(a, 'key')).toBeNull();
  expect(await store.reserve(b, '2026-11-03', { perUser: 1, global: 1 })).toBe(
    false,
  );
});
