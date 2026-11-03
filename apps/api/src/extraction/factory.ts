import { writeOperationalLog } from './log.ts';
import type pg from 'pg';
import process from 'node:process';
import { HybridExtractor } from './hybrid.ts';
import { FakeProvider, GeminiProvider } from './provider.ts';
import { PgExtractionStore } from './store.ts';
/** Future API startup hook. Production cache/caps always use PostgreSQL. */
export async function createExtractor(
  pool: pg.Pool,
  env: Record<string, string | undefined> = process.env,
): Promise<HybridExtractor> {
  const kind = env.LLM_PROVIDER ?? 'fake';
  if (kind !== 'fake' && kind !== 'gemini')
    throw new Error('LLM_PROVIDER must be fake or gemini.');
  if (kind === 'gemini' && env.CI)
    throw new Error('Gemini is prohibited in CI.');
  // Repeat one deterministic clarification response; never mimic model accuracy.
  const provider =
    kind === 'gemini'
      ? await GeminiProvider.create(env)
      : new FakeProvider(
          [
            {
              items: [],
              needs_clarification: true,
              clarification_question: 'Bạn nhập rõ số tiền và đơn vị nhé?',
            },
          ],
          true,
        );
  return new HybridExtractor(
    provider,
    new PgExtractionStore(pool),
    {
      perUser: Number(env.LLM_DAILY_CAP_PER_USER ?? 50),
      global: Number(env.LLM_DAILY_CAP_GLOBAL ?? 500),
    },
    {
      log: (event) => {
        writeOperationalLog(event);
      },
    },
  );
}
