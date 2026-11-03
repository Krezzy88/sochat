import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import pg from 'pg';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from './migrate.ts';
import { repositories } from './repositories.ts';
let container: StartedPostgreSqlContainer;
let pool: pg.Pool;
let repo: ReturnType<typeof repositories>;
let a: string;
let b: string;
let category: string;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18.6-bookworm').start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await migrate(pool);
  repo = repositories(pool);
});
afterAll(async () => {
  await pool?.end();
  await container?.stop();
});
beforeEach(async () => {
  await pool.query('DELETE FROM users');
  a = (await repo.users.create('a@example.test', 'synthetic-hash', 'A')).id;
  b = (await repo.users.create('b@example.test', 'synthetic-hash', 'B')).id;
  category = (await repo.categories.list(a)).find(
    (row) => row.key === 'an_uong',
  ).id;
});
const input = () => ({
  type: 'expense' as const,
  amount: 50_000n,
  categoryId: category,
  date: '2026-11-01',
  note: 'synthetic',
});
describe('PostgreSQL 18 migrations and constraints', () => {
  it('rejects migration drift and rolls back a failed migration batch', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sochat-migrations-'));
    try {
      for (const name of [
        '001_schema.sql',
        '002_reporting_indexes.sql',
        '004_llm_limits.sql',
      ])
        writeFileSync(
          join(directory, name),
          readFileSync(
            new URL('../../../../db/migrations/' + name, import.meta.url),
          ),
        );
      writeFileSync(
        join(directory, '005_probe.sql'),
        'CREATE TABLE rollback_probe(id int); SELECT 1/0;',
      );
      await expect(
        migrate(pool, pathToFileURL(directory + '/')),
      ).rejects.toMatchObject({ code: '22012' });
      expect(
        (await pool.query("SELECT to_regclass('rollback_probe') AS name"))
          .rows[0].name,
      ).toBeNull();
      rmSync(join(directory, '005_probe.sql'));
      writeFileSync(join(directory, '001_schema.sql'), '-- altered');
      await expect(
        migrate(pool, pathToFileURL(directory + '/')),
      ).rejects.toThrow('Applied migration changed');
      await migrate(pool);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('applies once and is repeatable', async () => {
    await migrate(pool);
    expect(
      (await pool.query('SELECT count(*) FROM schema_migrations')).rows[0]
        .count,
    ).toBe('3');
  });
  it.each([0n, -1n, 100_000_000_001n])(
    'rejects invalid money %s',
    async (amount) => {
      await expect(
        repo.transactions.create(a, { ...input(), amount }),
      ).rejects.toMatchObject({ code: '23514' });
    },
  );
  it('accepts the inclusive maximum', async () => {
    const row = await repo.transactions.create(a, {
      ...input(),
      amount: 100_000_000_000n,
    });
    expect((await repo.transactions.get(a, row.id)).amount_vnd).toBe(
      '100000000000',
    );
  });
  it('requires budget month to be the first', async () => {
    await expect(
      repo.budgets.put(a, category, '2026-11-02', 1n),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('enforces category key uniqueness within a user and for defaults', async () => {
    await repo.categories.create(a, 'custom', 'Custom', 'expense');
    await expect(
      repo.categories.create(a, 'custom', 'Duplicate', 'expense'),
    ).rejects.toMatchObject({ code: '23505' });
    expect(
      await repo.categories.create(b, 'custom', 'Other owner', 'expense'),
    ).not.toBeNull();
    await expect(
      pool.query(
        "INSERT INTO categories(key,name_vi,type) VALUES('an_uong','duplicate','expense')",
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
  it('rejects cross-owner goal contributions even via direct SQL', async () => {
    const goal = await repo.goals.create(a, 'Laptop', 100n, '2027-01-01');
    await expect(
      pool.query(
        'INSERT INTO goal_contributions(user_id,goal_id,amount_vnd,contributed_on) VALUES($1,$2,1,CURRENT_DATE)',
        [b, goal.id],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });
});
describe('aggregate isolation and deletion', () => {
  it('isolates every id-taking transaction and goal operation', async () => {
    const txn = await repo.transactions.create(a, input());
    const goal = await repo.goals.create(a, 'Laptop', 100n, '2027-01-01');
    await repo.goals.contribute(a, goal.id, 1n, '2026-11-01');
    for (const action of [
      () => repo.transactions.get(b, txn.id),
      () => repo.transactions.update(b, txn.id, 'attack'),
      () => repo.transactions.delete(b, txn.id),
      () => repo.goals.get(b, goal.id),
      () => repo.goals.update(b, goal.id, 'attack'),
      () => repo.goals.delete(b, goal.id),
      () => repo.goals.contribute(b, goal.id, 1n, '2026-11-01'),
    ])
      expect(await action()).toBeNull();
    expect(await repo.goals.contributions(b, goal.id)).toEqual([]);
    expect(await repo.transactions.get(a, txn.id)).not.toBeNull();
  });
  it('isolates category references, budgets, cache and lists', async () => {
    const own = await repo.categories.create(
      a,
      'private',
      'Private',
      'expense',
    );
    expect(
      await repo.transactions.create(b, { ...input(), categoryId: own.id }),
    ).toBeNull();
    expect(await repo.budgets.put(b, own.id, '2026-11-01', 10n)).toBeNull();
    await repo.budgets.put(a, category, '2026-11-01', 10n);
    await repo.transactions.create(a, input());
    await repo.goals.create(a, 'Laptop', 100n, '2027-01-01');
    await repo.cache.put(a, 'key', { items: [] }, 'fake');
    expect(await repo.cache.get(b, 'key')).toBeNull();
    expect(await repo.categories.list(b)).not.toContainEqual(
      expect.objectContaining({ id: own.id }),
    );
    expect(await repo.transactions.list(b)).toEqual([]);
    expect(await repo.budgets.list(b)).toEqual([]);
    expect(await repo.goals.list(b)).toEqual([]);
    expect(await repo.users.get(b)).toMatchObject({ id: b });
  });
  it('hard-deletes every user-owned table while retaining another user', async () => {
    await repo.transactions.create(a, input());
    await repo.budgets.put(a, category, '2026-11-01', 100n);
    const goal = await repo.goals.create(a, 'Laptop', 100n, '2027-01-01');
    await repo.goals.contribute(a, goal.id, 1n, '2026-11-01');
    await repo.categories.create(a, 'private', 'Private', 'expense');
    await repo.cache.put(a, 'key', { items: [] }, 'fake');
    await repo.users.delete(a);
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='user_id'",
    );
    for (const row of tables.rows) {
      const name = String(row.table_name);
      if (!/^[a-z_]+$/.test(name))
        throw new Error('Invalid catalog identifier');
      expect(
        (
          await pool.query(`SELECT count(*) FROM "${name}" WHERE user_id=$1`, [
            a,
          ])
        ).rows[0].count,
      ).toBe('0');
    }
    expect(await repo.users.get(a)).toBeNull();
    expect(await repo.users.get(b)).not.toBeNull();
  });
  it('reports hand-computed totals and isolates all report queries', async () => {
    await repo.transactions.create(a, input());
    await repo.transactions.create(a, { ...input(), amount: 25_000n });
    await repo.transactions.create(a, {
      ...input(),
      amount: 10_000n,
      date: '2026-12-01',
    });
    const income = (await repo.categories.list(a)).find(
      (row) => row.type === 'income',
    ).id;
    await repo.transactions.create(a, {
      ...input(),
      type: 'income',
      categoryId: income,
      amount: 100_000n,
    });
    await repo.transactions.create(b, { ...input(), amount: 999n });
    expect(await repo.reports.month(a, '2026-11-01', '2026-12-01')).toEqual([
      { category_id: category, type: 'expense', total_vnd: '75000' },
      { category_id: income, type: 'income', total_vnd: '100000' },
    ]);
    expect(
      await repo.reports.daily(a, '2026-11-01', '2026-12-01'),
    ).toHaveLength(2);
    expect(await repo.reports.year(a, '2026-01-01', '2027-01-01')).toEqual([
      { month: '2026-11', type: 'expense', total_vnd: '75000' },
      { month: '2026-11', type: 'income', total_vnd: '100000' },
      { month: '2026-12', type: 'expense', total_vnd: '10000' },
    ]);
    await repo.users.delete(b);
    for (const report of Object.values(repo.reports))
      expect(await report(b, '2026-01-01', '2027-01-01')).toEqual([]);
  });
});
