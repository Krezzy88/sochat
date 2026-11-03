import type pg from 'pg';
export interface Caps {
  perUser: number;
  global: number;
}
export interface ExtractionStore {
  get(user: string, key: string): Promise<unknown | null>;
  put(user: string, key: string, model: string, value: unknown): Promise<void>;
  reserve(user: string, day: string, caps: Caps): Promise<boolean>;
}
export function validateCaps(caps: Caps): void {
  for (const value of [caps.perUser, caps.global])
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error('LLM daily caps must be nonnegative safe integers');
}
/** Deterministic fake/evaluation store only; production uses PgExtractionStore. */
export class MemoryExtractionStore implements ExtractionStore {
  private cache = new Map<string, unknown>();
  private users = new Map<string, number>();
  private global = new Map<string, number>();
  async get(user: string, key: string): Promise<unknown | null> {
    return structuredClone(this.cache.get(JSON.stringify([user, key])) ?? null);
  }
  async put(
    user: string,
    key: string,
    model: string,
    value: unknown,
  ): Promise<void> {
    void model;
    this.cache.set(JSON.stringify([user, key]), structuredClone(value));
  }
  async reserve(user: string, day: string, caps: Caps): Promise<boolean> {
    validateCaps(caps);
    const key = JSON.stringify([user, day]);
    const u = this.users.get(key) ?? 0;
    const g = this.global.get(day) ?? 0;
    if (u >= caps.perUser || g >= caps.global) return false;
    this.users.set(key, u + 1);
    this.global.set(day, g + 1);
    return true;
  }
}
export class PgExtractionStore implements ExtractionStore {
  private readonly pool: pg.Pool;
  constructor(pool: pg.Pool) {
    this.pool = pool;
  }
  async get(user: string, key: string): Promise<unknown | null> {
    return (
      (
        await this.pool.query(
          "SELECT response FROM llm_cache WHERE user_id=$1 AND key=$2 AND created_at > now()-interval '24 hours'",
          [user, key],
        )
      ).rows[0]?.response ?? null
    );
  }
  async put(
    user: string,
    key: string,
    model: string,
    value: unknown,
  ): Promise<void> {
    await this.pool.query(
      "DELETE FROM llm_cache WHERE user_id=$1 AND created_at <= now()-interval '24 hours'",
      [user],
    );
    await this.pool.query(
      'INSERT INTO llm_cache(user_id,key,response,model) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,key) DO UPDATE SET response=EXCLUDED.response,model=EXCLUDED.model,created_at=now()',
      [user, key, JSON.stringify(value), model],
    );
  }
  async reserve(user: string, day: string, caps: Caps): Promise<boolean> {
    validateCaps(caps);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(73667202)');
      const u = await client.query(
        'SELECT calls FROM llm_daily_usage WHERE user_id=$1 AND day=$2',
        [user, day],
      );
      const g = await client.query(
        'SELECT calls FROM llm_global_daily_usage WHERE day=$1',
        [day],
      );
      if (
        Number(u.rows[0]?.calls ?? 0) >= caps.perUser ||
        Number(g.rows[0]?.calls ?? 0) >= caps.global
      ) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        'INSERT INTO llm_daily_usage(user_id,day,calls) VALUES($1,$2,1) ON CONFLICT(user_id,day) DO UPDATE SET calls=llm_daily_usage.calls+1',
        [user, day],
      );
      await client.query(
        'INSERT INTO llm_global_daily_usage(day,calls) VALUES($1,1) ON CONFLICT(day) DO UPDATE SET calls=llm_global_daily_usage.calls+1',
        [day],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
