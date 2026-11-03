import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { resolve } from 'node:path';
const rows = Number(process.env.ROWS ?? 1000000);
const runs = Number(process.env.RUNS ?? 11);
if (
  !Number.isSafeInteger(rows) ||
  rows < 1 ||
  rows > 10_000_000 ||
  !Number.isInteger(runs) ||
  runs < 3 ||
  runs > 100
)
  throw new Error('ROWS must be 1..10000000 and RUNS 3..100');
const container = await new PostgreSqlContainer(
  'postgres:18.6-bookworm',
).start();
const pool = new pg.Pool({ connectionString: container.getConnectionUri() });
const output: unknown[] = [];
try {
  await pool.query(
    readFileSync(
      new URL('./migrations/001_schema.sql', import.meta.url),
      'utf8',
    ),
  );
  await pool.query(
    readFileSync(new URL('./seed.sql', import.meta.url), 'utf8').replace(
      ':rows',
      String(rows),
    ),
  );
  await pool.query('VACUUM (ANALYZE) transactions');
  const queries = {
    month:
      "SELECT category_id,sum(amount_vnd) FROM transactions WHERE user_id=$1 AND type='expense' AND occurred_on >= $2 AND occurred_on < $3 GROUP BY category_id",
    daily:
      "SELECT occurred_on,sum(amount_vnd) FROM transactions WHERE user_id=$1 AND type='expense' AND occurred_on >= $2 AND occurred_on < $3 GROUP BY occurred_on ORDER BY occurred_on",
    year: "SELECT date_trunc('month',occurred_on),type,sum(amount_vnd) FROM transactions WHERE user_id=$1 AND occurred_on >= $2 AND occurred_on < $3 GROUP BY 1,type ORDER BY 1,type",
  };
  for (const scenario of ['baseline', 'btree', 'covering']) {
    if (scenario === 'btree')
      await pool.query(
        'CREATE INDEX bench_btree ON transactions(user_id,occurred_on)',
      );
    if (scenario === 'covering') {
      await pool.query('DROP INDEX bench_btree');
      await pool.query(
        readFileSync(
          new URL('./migrations/002_reporting_indexes.sql', import.meta.url),
          'utf8',
        ),
      );
    }
    await pool.query('VACUUM (ANALYZE) transactions');
    for (const [name, sql] of Object.entries(queries)) {
      const values = [
        '500',
        name === 'year' ? '2026-01-01' : '2026-10-01',
        name === 'year' ? '2027-01-01' : '2026-11-01',
      ];
      await pool.query(sql, values);
      const times: number[] = [];
      let plan: unknown;
      for (let n = 0; n < runs; n++) {
        const result = await pool.query(
          'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + sql,
          values,
        );
        const data = result.rows[0]['QUERY PLAN'][0];
        times.push(data['Execution Time']);
        plan = data;
      }
      times.sort((a, b) => a - b);
      output.push({
        scenario,
        query: name,
        p50_ms:
          ((times[Math.floor((times.length - 1) / 2)] ?? 0) +
            (times[Math.floor(times.length / 2)] ?? 0)) /
          2,
        p95_ms: times[Math.ceil(times.length * 0.95) - 1],
        samples_ms: times,
        plan,
      });
    }
  }
  const directory = resolve('db/results');
  mkdirSync(directory, { recursive: true });
  const report = {
    generated_at: new Date().toISOString(),
    rows,
    runs,
    seed: 20261103,
    version: (await pool.query('SELECT version()')).rows[0].version,
    results: output,
  };
  writeFileSync(
    resolve(directory, 'benchmark.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally {
  await pool.end();
  await container.stop();
}
