import { AsyncLocalStorage } from 'node:async_hooks';
import process from 'node:process';
import type pg from 'pg';
const context = new AsyncLocalStorage<string>();
export const withTenant = <T>(user: string, work: () => T): T =>
  context.run(user, work);
export function tenantPool(
  pool: pg.Pool,
  enabled = process.env.ENABLE_RLS === 'true',
): pg.Pool {
  if (!enabled) return pool;
  const scope = async (client: pg.PoolClient, user: string) => {
    await client.query('SET LOCAL ROLE sochat_tenant');
    await client.query("SELECT set_config('sochat.user_id',$1,true)", [user]);
  };
  return new Proxy(pool, {
    get(target, key) {
      if (key === 'query')
        return async (text: string, values?: unknown[]) => {
          const user = context.getStore();
          if (!user) return target.query(text, values);
          const client = await target.connect();
          try {
            await client.query('BEGIN');
            await scope(client, user);
            const result = await client.query(text, values);
            await client.query('COMMIT');
            return result;
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          } finally {
            client.release();
          }
        };
      if (key === 'connect')
        return async () => {
          const client = await target.connect();
          const user = context.getStore();
          if (!user) return client;
          let transaction = false;
          return new Proxy(client, {
            get(c, k) {
              if (k === 'release') return () => c.release(transaction);
              if (k === 'query')
                return async (text: string, values?: unknown[]) => {
                  const command = text.trim().toUpperCase();
                  if (
                    command === 'BEGIN' ||
                    command ===
                      'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
                  ) {
                    if (transaction)
                      throw new Error(
                        'Nested tenant transaction is not supported',
                      );
                    await c.query(text);
                    try {
                      await scope(c, user);
                      transaction = true;
                    } catch (error) {
                      await c.query('ROLLBACK');
                      throw error;
                    }
                    return;
                  }
                  if (!transaction)
                    throw new Error(
                      'Tenant client requires an explicit transaction',
                    );
                  const result = await c.query(text, values);
                  if (command === 'COMMIT' || command === 'ROLLBACK')
                    transaction = false;
                  return result;
                };
              const v = Reflect.get(c, k);
              return typeof v === 'function' ? v.bind(c) : v;
            },
          });
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
