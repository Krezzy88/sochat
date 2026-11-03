import process from 'node:process';
import pg from 'pg';
import { createExtractor } from './extraction/factory.ts';
import { createApp } from './http/app.ts';
const secret = process.env.SESSION_SECRET;
if (!secret || !process.env.DATABASE_URL)
  throw new Error(
    'Set DATABASE_URL and a random SESSION_SECRET in local .env.',
  );
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
  query_timeout: 6000,
});
pool.on('error', () =>
  process.stderr.write('Database connection unavailable.\n'),
);
try {
  await pool.query('SELECT 1');
  const extractor = await createExtractor(pool);
  const runtime = await createApp({
    pool,
    extractor,
    sessionSecret: secret,
    origin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
    production: process.env.NODE_ENV === 'production',
    trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
  });
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid PORT');
  const server = runtime.app.listen(port, '127.0.0.1', () =>
    process.stdout.write(JSON.stringify({ event: 'api_started', port }) + '\n'),
  );
  server.on('error', () => {
    process.stderr.write('API listen failed. Check PORT.\n');
    process.exitCode = 1;
    stop();
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      void runtime.close().finally(() => pool.end());
    });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch {
  await pool.end();
  process.stderr.write(
    'API startup failed. Check database migrations, SESSION_SECRET and provider configuration locally.\n',
  );
  process.exitCode = 1;
}
