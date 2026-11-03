// Isolated synthetic test/preview server. Never loads .env or calls Gemini.
import { randomBytes } from 'node:crypto';
import { preview } from 'vite';
import pg from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from '../apps/api/src/db/migrate.ts';
import { createApp } from '../apps/api/src/http/app.ts';
import { HybridExtractor } from '../apps/api/src/extraction/hybrid.ts';
import { FakeProvider } from '../apps/api/src/extraction/provider.ts';
import { MemoryExtractionStore } from '../apps/api/src/extraction/store.ts';
const container = await new PostgreSqlContainer(
  'postgres:18.6-bookworm',
).start();
const pool = new pg.Pool({ connectionString: container.getConnectionUri() });
await migrate(pool);
const runtime = await createApp({
  pool,
  sessionSecret: randomBytes(48).toString('hex'),
  origin: 'http://localhost:5173',
  extractor: new HybridExtractor(
    new FakeProvider(
      [
        {
          items: [],
          needs_clarification: true,
          clarification_question: 'Bạn đã chi bao nhiêu đồng?',
        },
      ],
      true,
    ),
    new MemoryExtractionStore(),
    { perUser: 50, global: 500 },
  ),
  limits: { register: 100, authIp: 200 },
});
let server: ReturnType<typeof runtime.app.listen> | undefined;
let vite: Awaited<ReturnType<typeof preview>> | undefined;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (vite)
    await new Promise<void>((resolve) =>
      vite!.httpServer.close(() => resolve()),
    );
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  await runtime.close();
  await pool.end();
  await container.stop();
}
process.on('SIGINT', () => {
  void close().then(() => process.exit());
});
process.on('SIGTERM', () => {
  void close().then(() => process.exit());
});
try {
  await new Promise<void>((resolve, reject) => {
    server = runtime.app.listen(3000, '127.0.0.1', (error) =>
      error ? reject(error) : resolve(),
    );
    server.once('error', reject);
  });
  vite = await preview({
    root: 'apps/web',
    configFile: 'apps/web/vite.config.ts',
  });
  process.stdout.write('Synthetic preview: http://localhost:5173/\n');
} catch {
  process.stderr.write('Test preview startup failed; check ports 3000/5173.\n');
  await close();
  process.exitCode = 1;
}
