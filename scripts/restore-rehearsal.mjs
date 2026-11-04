import process from 'node:process';
import console from 'node:console';
import { mkdir, chmod, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

export function validateDatabases(source, target) {
  const a = new URL(source),
    b = new URL(target);
  for (const u of [a, b]) {
    if (
      !['postgres:', 'postgresql:'].includes(u.protocol) ||
      !u.hostname ||
      !u.pathname.slice(1)
    )
      throw new Error('Use PostgreSQL URLs with explicit database names.');
    if (
      u.searchParams.get('sslmode') === 'disable' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
    )
      throw new Error('Remote TLS must not be disabled.');
  }
  if (
    !/^sochat_restore_[a-z0-9_]+$/.test(decodeURIComponent(b.pathname.slice(1)))
  )
    throw new Error('Target database name must start with sochat_restore_.');
  if (
    a.hostname === b.hostname &&
    (a.port || '5432') === (b.port || '5432') &&
    a.pathname === b.pathname
  )
    throw new Error('Source and target must differ.');
  return [a, b];
}
function pgEnvironment(u) {
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGSSLMODE:
      u.searchParams.get('sslmode') ||
      (['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
        ? 'disable'
        : 'verify-full'),
    PGCHANNELBINDING: u.searchParams.get('channel_binding') || 'prefer',
  };
}
const tables = [
  'users',
  'transactions',
  'budgets',
  'goals',
  'goal_contributions',
  'account_tokens',
];
async function fingerprint(db) {
  const result = {};
  for (const table of tables) {
    const exists = (
      await db.query('SELECT to_regclass($1) AS name', ['public.' + table])
    ).rows[0].name;
    if (!exists) {
      result[table] = null;
      continue;
    }
    result[table] = (
      await db.query(`SELECT count(*)::text AS n FROM ${table}`)
    ).rows[0].n;
  }
  result.amount = (
    await db.query(
      'SELECT coalesce(sum(amount_vnd),0)::text AS n FROM transactions',
    )
  ).rows[0].n;
  return result;
}
export async function main() {
  const [source, target] = validateDatabases(
    process.env.BACKUP_SOURCE_URL || '',
    process.env.RESTORE_TARGET_URL || '',
  );
  if (!process.argv.includes('--execute')) {
    console.log(
      'Configuration valid. Dry run only: no connection, dump or restore. Use --execute after reviewing source, empty target and retention.',
    );
    return;
  }
  const directory = resolve(
    '.local/backups',
    new Date().toISOString().replace(/[:.]/g, '-'),
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const archive = join(directory, 'database.dump');
  const sourceDB = new pg.Client({ connectionString: source.href }),
    targetDB = new pg.Client({ connectionString: target.href });
  try {
    await sourceDB.connect();
    await targetDB.connect();
    const count = (
      await targetDB.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      )
    ).rows[0].n;
    if (count !== 0)
      throw new Error('Restore target must have an empty public schema.');
    await sourceDB.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (
      await sourceDB.query('SELECT pg_export_snapshot() AS snapshot')
    ).rows[0].snapshot;
    const expected = await fingerprint(sourceDB);
    const binary = process.env.SOCHAT_PG_BIN || '/Library/PostgreSQL/18/bin';
    // Never put connection strings or passwords into argv or print child stderr.
    execFileSync(
      join(binary, 'pg_dump'),
      [
        '--format=custom',
        '--no-owner',
        '--no-acl',
        '--snapshot',
        snapshot,
        '--file',
        archive,
      ],
      { env: pgEnvironment(source), stdio: 'pipe', timeout: 900000 },
    );
    await chmod(archive, 0o600);
    await sourceDB.query('COMMIT');
    execFileSync(
      join(binary, 'pg_restore'),
      [
        '--dbname',
        decodeURIComponent(target.pathname.slice(1)),
        '--no-owner',
        '--no-acl',
        '--exit-on-error',
        '--single-transaction',
        archive,
      ],
      { env: pgEnvironment(target), stdio: 'pipe', timeout: 900000 },
    );
    const actual = await fingerprint(targetDB);
    const matches = JSON.stringify(expected) === JSON.stringify(actual);
    await writeFile(
      join(directory, 'verification.json'),
      JSON.stringify(
        {
          verified_at: new Date().toISOString(),
          row_counts_and_transaction_sum_match: matches,
          scope: 'restore rehearsal, not retention or disaster-recovery SLA',
        },
        null,
        2,
      ) + '\n',
      { mode: 0o600 },
    );
    if (!matches)
      throw new Error(
        'Restored fingerprint differs. Keep the private archive/report for investigation.',
      );
    console.log(
      'Restore rehearsal passed. Private archive and verification saved under .local/backups. Review retention and remove the disposable target manually.',
    );
  } finally {
    await sourceDB.end().catch(() => {});
    await targetDB.end().catch(() => {});
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch(() => {
    console.error(
      'Restore rehearsal failed. No credentials or database output are printed. Check configuration, target permissions and local PostgreSQL 18 tools.',
    );
    process.exitCode = 1;
  });
}
