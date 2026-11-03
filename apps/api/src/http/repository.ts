import { createHash, createHmac } from 'node:crypto';
import type pg from 'pg';
import type { z } from 'zod';
import * as c from './contracts.ts';
import { fail } from './problem.ts';
type DB = Pick<pg.Pool, 'query'>;
const SELECT_TX = `SELECT t.id,t.type,t.amount_vnd::text,c.key AS category,t.note,t.occurred_on::text FROM transactions t JOIN categories c ON c.id=t.category_id`;
interface TxRow {
  id: string;
  type: 'expense' | 'income';
  amount_vnd: string;
  category: string;
  note: string;
  occurred_on: string;
}
interface GoalRow {
  id: string;
  name: string;
  target_vnd: string;
  deadline: string;
  contributed_vnd: string;
}
async function ownedCategory(
  db: DB,
  user: string,
  key: string,
  type: string,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    'SELECT id FROM categories WHERE key=$2 AND type=$3 AND (user_id IS NULL OR user_id=$1) ORDER BY user_id NULLS LAST LIMIT 1',
    [user, key, type],
  );
  return result.rows[0]?.id ?? fail(404, 'Không tìm thấy danh mục phù hợp.');
}
export function apiRepository(pool: pg.Pool, secret: string) {
  async function atomic<T>(
    work: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    async throttle(
      scope: string,
      identity: string,
      user: string | null,
      max: number,
      windowMs: number,
      now: Date,
    ): Promise<boolean> {
      const key = createHmac('sha256', secret)
        .update(JSON.stringify([scope, identity]))
        .digest('hex');
      await pool.query('DELETE FROM api_rate_limits WHERE expires_at <= $1', [
        now,
      ]);
      const row = await pool.query<{ count: number }>(
        `INSERT INTO api_rate_limits(key,user_id,count,expires_at) VALUES($1,$2,1,$3) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN api_rate_limits.expires_at <= $4 THEN 1 ELSE api_rate_limits.count+1 END,expires_at=CASE WHEN api_rate_limits.expires_at <= $4 THEN EXCLUDED.expires_at ELSE api_rate_limits.expires_at END,user_id=EXCLUDED.user_id RETURNING count`,
        [key, user, new Date(now.getTime() + windowMs), now],
      );
      return (row.rows[0]?.count ?? max + 1) <= max;
    },
    async findUser(email: string) {
      return (
        (
          await pool.query<{
            id: string;
            email: string;
            display_name: string;
            password_hash: string;
          }>(
            'SELECT id,email,display_name,password_hash FROM users WHERE email=$1',
            [email],
          )
        ).rows[0] ?? null
      );
    },
    async user(user: string) {
      return (
        (
          await pool.query<{ id: string; email: string; display_name: string }>(
            'SELECT id,email,display_name FROM users WHERE id=$1',
            [user],
          )
        ).rows[0] ?? null
      );
    },
    async register(email: string, hash: string, name: string) {
      return (
        (
          await pool.query<{ id: string; email: string; display_name: string }>(
            'INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,email,display_name',
            [email, hash, name],
          )
        ).rows[0] ?? fail(500, 'Không tạo được tài khoản.')
      );
    },
    async deleteUser(user: string) {
      await pool.query('DELETE FROM users WHERE id=$1', [user]);
    },
    async categories(user: string) {
      return (
        await pool.query(
          'SELECT id,key,name_vi,type FROM categories WHERE user_id IS NULL OR user_id=$1 ORDER BY id',
          [user],
        )
      ).rows;
    },
    async batch(user: string, input: z.infer<typeof c.batch>) {
      return atomic(async (client) => {
        const hash = createHash('sha256')
          .update(c.stableJson(input.items))
          .digest('hex');
        const inserted = await client.query(
          'INSERT INTO batch_requests(user_id,key,request_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key',
          [user, input.idempotency_key, hash],
        );
        if (!inserted.rowCount) {
          const old = (
            await client.query<{ request_hash: string; response: unknown }>(
              'SELECT request_hash,response FROM batch_requests WHERE user_id=$1 AND key=$2',
              [user, input.idempotency_key],
            )
          ).rows[0];
          if (old?.request_hash !== hash)
            fail(409, 'Idempotency key đã dùng với nội dung khác.');
          return old.response;
        }
        const items: TxRow[] = [];
        for (const item of input.items) {
          const category = await ownedCategory(
            client,
            user,
            item.category,
            item.type,
          );
          const row = await client.query<{ id: string }>(
            'INSERT INTO transactions(user_id,type,amount_vnd,category_id,note,occurred_on) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
            [
              user,
              item.type,
              item.amount_vnd.toString(),
              category,
              item.note,
              item.occurred_on,
            ],
          );
          const id = row.rows[0]?.id;
          const result = await client.query<TxRow>(
            SELECT_TX + ' WHERE t.user_id=$1 AND t.id=$2',
            [user, id],
          );
          items.push(result.rows[0] ?? fail(500, 'Không lưu được giao dịch.'));
        }
        const response = { items };
        await client.query(
          'UPDATE batch_requests SET response=$3 WHERE user_id=$1 AND key=$2',
          [user, input.idempotency_key, JSON.stringify(response)],
        );
        return response;
      });
    },
    async transactions(user: string, query: z.infer<typeof c.listQuery>) {
      const values: unknown[] = [user];
      const where = ['t.user_id=$1'];
      const add = (sql: string, value: unknown) => {
        values.push(value);
        where.push(sql.replace('?', `$${values.length}`));
      };
      if (query.from) add('t.occurred_on >= ?', query.from);
      if (query.to) add('t.occurred_on <= ?', query.to);
      if (query.category) add('c.key = ?', query.category);
      if (query.type) add('t.type = ?', query.type);
      if (query.cursor) {
        let raw: unknown;
        try {
          raw = JSON.parse(
            Buffer.from(query.cursor, 'base64url').toString('utf8'),
          );
        } catch {
          fail(400, 'Cursor không hợp lệ.');
        }
        const parsed = c.cursor.safeParse(raw);
        if (!parsed.success) fail(400, 'Cursor không hợp lệ.');
        values.push(parsed.data.date, parsed.data.id);
        where.push(
          `(t.occurred_on,t.id) < ($${values.length - 1}::date,$${values.length}::bigint)`,
        );
      }
      values.push(query.limit + 1);
      const rows = (
        await pool.query<TxRow>(
          SELECT_TX +
            ' WHERE ' +
            where.join(' AND ') +
            ` ORDER BY t.occurred_on DESC,t.id DESC LIMIT $${values.length}`,
          values,
        )
      ).rows;
      const items = rows.slice(0, query.limit);
      const last = items.at(-1);
      return {
        items,
        next_cursor:
          rows.length > query.limit && last
            ? Buffer.from(
                JSON.stringify({ date: last.occurred_on, id: last.id }),
              ).toString('base64url')
            : null,
      };
    },
    async patchTransaction(
      user: string,
      id: string,
      patch: z.infer<typeof c.transactionPatch>,
    ) {
      return atomic(async (client) => {
        const old =
          (
            await client.query<TxRow>(
              SELECT_TX + ' WHERE t.user_id=$1 AND t.id=$2 FOR UPDATE OF t',
              [user, id],
            )
          ).rows[0] ?? fail(404, 'Không tìm thấy giao dịch.');
        const type = patch.type ?? old.type;
        const key = patch.category ?? old.category;
        const category = await ownedCategory(client, user, key, type);
        await client.query(
          'UPDATE transactions SET type=$3,amount_vnd=$4,category_id=$5,note=$6,occurred_on=$7,updated_at=now() WHERE user_id=$1 AND id=$2',
          [
            user,
            id,
            type,
            (patch.amount_vnd ?? BigInt(old.amount_vnd)).toString(),
            category,
            patch.note ?? old.note,
            patch.occurred_on ?? old.occurred_on,
          ],
        );
        return (
          await client.query<TxRow>(
            SELECT_TX + ' WHERE t.user_id=$1 AND t.id=$2',
            [user, id],
          )
        ).rows[0];
      });
    },
    async deleteTransaction(user: string, id: string) {
      if (
        !(
          await pool.query(
            'DELETE FROM transactions WHERE user_id=$1 AND id=$2 RETURNING id',
            [user, id],
          )
        ).rowCount
      )
        fail(404, 'Không tìm thấy giao dịch.');
    },
    async exportRows(user: string, after: string) {
      return (
        await pool.query<TxRow>(
          SELECT_TX + ' WHERE t.user_id=$1 AND t.id>$2 ORDER BY t.id LIMIT 500',
          [user, after],
        )
      ).rows;
    },
    async report(user: string, from: string, to: string) {
      const totals = (
        await pool.query<{ type: 'income' | 'expense'; total_vnd: string }>(
          'SELECT type,sum(amount_vnd)::text AS total_vnd FROM transactions WHERE user_id=$1 AND occurred_on >= $2 AND occurred_on < $3 GROUP BY type',
          [user, from, to],
        )
      ).rows;
      const income = totals.find((r) => r.type === 'income')?.total_vnd ?? '0';
      const expense =
        totals.find((r) => r.type === 'expense')?.total_vnd ?? '0';
      return {
        income_vnd: income,
        expense_vnd: expense,
        net_vnd: (BigInt(income) - BigInt(expense)).toString(),
      };
    },
    async month(user: string, from: string, to: string) {
      const values = [user, from, to];
      return {
        totals: await this.report(user, from, to),
        by_category: (
          await pool.query(
            `SELECT c.key AS category,c.name_vi,t.type,sum(t.amount_vnd)::text AS total_vnd FROM transactions t JOIN categories c ON c.id=t.category_id WHERE t.user_id=$1 AND t.occurred_on >= $2 AND t.occurred_on < $3 GROUP BY c.key,c.name_vi,t.type ORDER BY c.key,t.type`,
            values,
          )
        ).rows,
        daily: (
          await pool.query(
            'SELECT occurred_on::text,type,sum(amount_vnd)::text AS total_vnd FROM transactions WHERE user_id=$1 AND occurred_on >= $2 AND occurred_on < $3 GROUP BY occurred_on,type ORDER BY occurred_on,type',
            values,
          )
        ).rows,
        top_notes: (
          await pool.query(
            "SELECT note,sum(amount_vnd)::text AS total_vnd FROM transactions WHERE user_id=$1 AND type='expense' AND occurred_on >= $2 AND occurred_on < $3 GROUP BY note ORDER BY sum(amount_vnd) DESC,note LIMIT 5",
            values,
          )
        ).rows,
      };
    },
    async year(user: string, from: string, to: string) {
      return {
        totals: await this.report(user, from, to),
        months: (
          await pool.query(
            "SELECT to_char(occurred_on,'YYYY-MM') AS month,type,sum(amount_vnd)::text AS total_vnd FROM transactions WHERE user_id=$1 AND occurred_on >= $2 AND occurred_on < $3 GROUP BY 1,type ORDER BY 1,type",
            [user, from, to],
          )
        ).rows,
      };
    },
    async budgets(user: string, month: string) {
      return (
        await pool.query(
          'SELECT b.id,c.key AS category,b.month::text,b.limit_vnd::text FROM budgets b JOIN categories c ON c.id=b.category_id WHERE b.user_id=$1 AND b.month=$2 ORDER BY c.key',
          [user, month],
        )
      ).rows;
    },
    async putBudgets(
      user: string,
      month: string,
      input: z.infer<typeof c.budgets>,
    ) {
      await atomic(async (client) => {
        for (const item of input.items) {
          const category = await ownedCategory(
            client,
            user,
            item.category,
            'expense',
          );
          await client.query(
            'INSERT INTO budgets(user_id,category_id,month,limit_vnd) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,category_id,month) DO UPDATE SET limit_vnd=EXCLUDED.limit_vnd',
            [user, category, month, item.limit_vnd.toString()],
          );
        }
      });
      return this.budgets(user, month);
    },
    async budgetStatus(user: string, from: string, to: string) {
      return (
        await pool.query<{
          category: string;
          limit_vnd: string;
          spent_vnd: string;
        }>(
          `SELECT c.key AS category,b.limit_vnd::text,COALESCE(sum(t.amount_vnd),0)::text AS spent_vnd FROM budgets b JOIN categories c ON c.id=b.category_id LEFT JOIN transactions t ON t.user_id=b.user_id AND t.category_id=b.category_id AND t.type='expense' AND t.occurred_on >= $2 AND t.occurred_on < $3 WHERE b.user_id=$1 AND b.month=$2 GROUP BY c.key,b.limit_vnd ORDER BY c.key`,
          [user, from, to],
        )
      ).rows.map((row) => {
        const spent = BigInt(row.spent_vnd),
          limit = BigInt(row.limit_vnd);
        return {
          ...row,
          remaining_vnd: (spent < limit ? limit - spent : 0n).toString(),
          status:
            spent >= limit
              ? 'exceeded'
              : spent * 100n >= limit * 80n
                ? 'warning'
                : 'ok',
        };
      });
    },
    async goals(user: string, id?: string) {
      return (
        await pool.query<GoalRow>(
          `SELECT g.id,g.name,g.target_vnd::text,g.deadline::text,COALESCE(sum(c.amount_vnd),0)::text AS contributed_vnd FROM goals g LEFT JOIN goal_contributions c ON c.goal_id=g.id AND c.user_id=g.user_id WHERE g.user_id=$1 AND ($2::bigint IS NULL OR g.id=$2) GROUP BY g.id ORDER BY g.id`,
          [user, id ?? null],
        )
      ).rows;
    },
    async createGoal(user: string, input: c.Goal) {
      const row = (
        await pool.query<{ id: string }>(
          'INSERT INTO goals(user_id,name,target_vnd,deadline) VALUES($1,$2,$3,$4) RETURNING id',
          [user, input.name, input.target_vnd.toString(), input.deadline],
        )
      ).rows[0];
      return (await this.goals(user, row?.id))[0];
    },
    async patchGoal(
      user: string,
      id: string,
      input: z.infer<typeof c.goalPatch>,
    ) {
      const changed = await pool.query(
        'UPDATE goals SET name=COALESCE($3,name),target_vnd=COALESCE($4,target_vnd),deadline=COALESCE($5,deadline) WHERE user_id=$1 AND id=$2 RETURNING id',
        [
          user,
          id,
          input.name ?? null,
          input.target_vnd?.toString() ?? null,
          input.deadline ?? null,
        ],
      );
      if (!changed.rowCount) fail(404, 'Không tìm thấy quỹ.');
      return (
        (await this.goals(user, id))[0] ?? fail(404, 'Không tìm thấy quỹ.')
      );
    },
    async deleteGoal(user: string, id: string) {
      if (
        !(
          await pool.query(
            'DELETE FROM goals WHERE user_id=$1 AND id=$2 RETURNING id',
            [user, id],
          )
        ).rowCount
      )
        fail(404, 'Không tìm thấy quỹ.');
    },
    async contribute(
      user: string,
      id: string,
      input: z.infer<typeof c.contribution>,
    ) {
      const row = await pool.query(
        'INSERT INTO goal_contributions(user_id,goal_id,amount_vnd,contributed_on,note) SELECT $1,id,$3,$4,$5 FROM goals WHERE user_id=$1 AND id=$2 RETURNING id,amount_vnd::text,contributed_on::text,note',
        [
          user,
          id,
          input.amount_vnd.toString(),
          input.contributed_on,
          input.note,
        ],
      );
      return row.rows[0] ?? fail(404, 'Không tìm thấy quỹ.');
    },
  };
}
