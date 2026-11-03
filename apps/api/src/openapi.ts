import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createApp } from './http/app.ts';
import { HybridExtractor } from './extraction/hybrid.ts';
import { FakeProvider } from './extraction/provider.ts';
import { MemoryExtractionStore } from './extraction/store.ts';
const pool = new pg.Pool();
const runtime = await createApp({
  pool,
  sessionSecret: randomBytes(48).toString('hex'),
  origin: 'http://localhost:5173',
  extractor: new HybridExtractor(
    new FakeProvider([]),
    new MemoryExtractionStore(),
    { perUser: 0, global: 0 },
  ),
});
try {
  writeFileSync(
    new URL('../openapi.json', import.meta.url),
    JSON.stringify(runtime.openapi, null, 2) + '\n',
  );
} finally {
  await runtime.close();
  await pool.end();
}
