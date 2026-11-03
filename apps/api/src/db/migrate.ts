import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import pg from 'pg';

export async function migrate(
  pool: pg.Pool,
  directory = new URL('../../../../db/migrations/', import.meta.url),
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(73667201)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations ORDER BY name',
    );
    const names = (await readdir(directory))
      .filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name))
      .sort();
    for (const row of applied.rows)
      if (!names.includes(row.name))
        throw new Error('An applied migration is missing');
    for (const name of names) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = applied.rows.find((row) => row.name === name);
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      if (applied.rows.some((row) => row.name > name))
        throw new Error('Out-of-order migration');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(name, checksum) VALUES ($1,$2)',
        [name, checksum],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(pool);
    process.stdout.write(
      `Migrations applied from ${fileURLToPath(new URL('../../../../db/migrations/', import.meta.url))}\n`,
    );
  } finally {
    await pool.end();
  }
}
