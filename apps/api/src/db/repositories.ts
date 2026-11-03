import type pg from 'pg';

export interface TransactionInput {
  type: 'expense' | 'income';
  amount: bigint;
  categoryId: string;
  date: string;
  note: string;
}
/** IDs and bigint totals stay strings at the pg boundary; no global type parser changes. */
export function repositories(db: pg.Pool) {
  const one = async (sql: string, values: unknown[]) =>
    (await db.query(sql, values)).rows[0] ?? null;
  return {
    users: {
      create: (email: string, passwordHash: string, name: string) =>
        one(
          'INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id',
          [email, passwordHash, name],
        ),
      get: (user: string) =>
        one('SELECT id,display_name FROM users WHERE id=$1', [user]),
      delete: (user: string) =>
        one('DELETE FROM users WHERE id=$1 RETURNING id', [user]),
    },
    categories: {
      list: async (user: string) =>
        (
          await db.query(
            'SELECT id,key,type FROM categories WHERE user_id IS NULL OR user_id=$1 ORDER BY id',
            [user],
          )
        ).rows,
      create: (
        user: string,
        key: string,
        name: string,
        type: 'expense' | 'income',
      ) =>
        one(
          'INSERT INTO categories(user_id,key,name_vi,type) VALUES($1,$2,$3,$4) RETURNING id',
          [user, key, name, type],
        ),
    },
    transactions: {
      create: (user: string, input: TransactionInput) =>
        one(
          `INSERT INTO transactions(user_id,type,amount_vnd,category_id,occurred_on,note)
        SELECT $1,$2,$3,id,$5,$6 FROM categories WHERE id=$4 AND type=$2 AND (user_id IS NULL OR user_id=$1) RETURNING id`,
          [
            user,
            input.type,
            input.amount.toString(),
            input.categoryId,
            input.date,
            input.note,
          ],
        ),
      get: (user: string, id: string) =>
        one(
          'SELECT id,amount_vnd,note,occurred_on::text FROM transactions WHERE user_id=$1 AND id=$2',
          [user, id],
        ),
      list: async (user: string) =>
        (
          await db.query(
            'SELECT id,amount_vnd,note,occurred_on::text FROM transactions WHERE user_id=$1 ORDER BY occurred_on DESC,id DESC LIMIT 100',
            [user],
          )
        ).rows,
      update: (user: string, id: string, note: string) =>
        one(
          'UPDATE transactions SET note=$3,updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING id',
          [user, id, note],
        ),
      delete: (user: string, id: string) =>
        one(
          'DELETE FROM transactions WHERE user_id=$1 AND id=$2 RETURNING id',
          [user, id],
        ),
    },
    budgets: {
      put: (user: string, category: string, month: string, limit: bigint) =>
        one(
          `INSERT INTO budgets(user_id,category_id,month,limit_vnd)
        SELECT $1,id,$3,$4 FROM categories WHERE id=$2 AND type='expense' AND (user_id IS NULL OR user_id=$1)
        ON CONFLICT(user_id,category_id,month) DO UPDATE SET limit_vnd=EXCLUDED.limit_vnd RETURNING id`,
          [user, category, month, limit.toString()],
        ),
      list: async (user: string) =>
        (
          await db.query(
            'SELECT id,limit_vnd,month::text FROM budgets WHERE user_id=$1 ORDER BY id',
            [user],
          )
        ).rows,
    },
    goals: {
      create: (user: string, name: string, target: bigint, deadline: string) =>
        one(
          'INSERT INTO goals(user_id,name,target_vnd,deadline) VALUES($1,$2,$3,$4) RETURNING id',
          [user, name, target.toString(), deadline],
        ),
      list: async (user: string) =>
        (
          await db.query(
            'SELECT id,name,target_vnd,deadline::text FROM goals WHERE user_id=$1 ORDER BY id',
            [user],
          )
        ).rows,
      get: (user: string, id: string) =>
        one('SELECT id,name,target_vnd FROM goals WHERE user_id=$1 AND id=$2', [
          user,
          id,
        ]),
      update: (user: string, id: string, name: string) =>
        one(
          'UPDATE goals SET name=$3 WHERE user_id=$1 AND id=$2 RETURNING id',
          [user, id, name],
        ),
      delete: (user: string, id: string) =>
        one('DELETE FROM goals WHERE user_id=$1 AND id=$2 RETURNING id', [
          user,
          id,
        ]),
      contribute: (user: string, goal: string, amount: bigint, date: string) =>
        one(
          'INSERT INTO goal_contributions(user_id,goal_id,amount_vnd,contributed_on) SELECT $1,id,$3,$4 FROM goals WHERE id=$2 AND user_id=$1 RETURNING id',
          [user, goal, amount.toString(), date],
        ),
      contributions: async (user: string, goal: string) =>
        (
          await db.query(
            'SELECT id,amount_vnd FROM goal_contributions WHERE user_id=$1 AND goal_id=$2 ORDER BY id',
            [user, goal],
          )
        ).rows,
    },
    reports: {
      month: async (user: string, from: string, to: string) =>
        (
          await db.query(
            `SELECT category_id,type,sum(amount_vnd)::text AS total_vnd FROM transactions WHERE user_id=$1 AND occurred_on >= $2 AND occurred_on < $3 GROUP BY category_id,type ORDER BY category_id,type`,
            [user, from, to],
          )
        ).rows,
      daily: async (user: string, from: string, to: string) =>
        (
          await db.query(
            `SELECT occurred_on::text,type,sum(amount_vnd)::text AS total_vnd FROM transactions WHERE user_id=$1 AND occurred_on >= $2 AND occurred_on < $3 GROUP BY occurred_on,type ORDER BY occurred_on,type`,
            [user, from, to],
          )
        ).rows,
      year: async (user: string, from: string, to: string) =>
        (
          await db.query(
            `SELECT to_char(occurred_on,'YYYY-MM') AS month,type,sum(amount_vnd)::text AS total_vnd FROM transactions WHERE user_id=$1 AND occurred_on >= $2 AND occurred_on < $3 GROUP BY 1,type ORDER BY 1,type`,
            [user, from, to],
          )
        ).rows,
    },
    cache: {
      put: (user: string, key: string, response: unknown, model: string) =>
        one(
          'INSERT INTO llm_cache(user_id,key,response,model) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,key) DO UPDATE SET response=EXCLUDED.response,model=EXCLUDED.model,created_at=now() RETURNING key',
          [user, key, JSON.stringify(response), model],
        ),
      get: (user: string, key: string) =>
        one(
          'SELECT response,model FROM llm_cache WHERE user_id=$1 AND key=$2',
          [user, key],
        ),
    },
  };
}
