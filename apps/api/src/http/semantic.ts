import process from 'node:process';
import { createHash } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import { PgExtractionStore } from '../extraction/store.ts';
import { fail } from './problem.ts';
import { fold } from '../../../../packages/parser/src/index.ts';
export const embeddingModel = 'gemini-embedding-2';
export function safeNote(note: string) {
  return note
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b(?:AIza|sk-)[A-Za-z0-9_-]+\b/g, ' ')
    .replace(/\d[\d.,\s]*(?:k|tr|triệu|nghìn|đồng|vnd)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}
export function cosine(a: number[], b: number[]) {
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const norm = Math.sqrt(
    a.reduce((s, v) => s + v * v, 0) * b.reduce((s, v) => s + v * v, 0),
  );
  return norm ? dot / norm : 0;
}
export function keyword(query: string, note: string) {
  const words = [...new Set(fold(query).split(/\W+/).filter(Boolean))];
  const text = fold(note);
  return words.length
    ? words.filter((w) => text.includes(w)).length / words.length
    : 0;
}
export async function embeddings(
  texts: string[],
  now: Date,
  user: string,
  pool: pg.Pool,
): Promise<number[][]> {
  if (
    process.env.CI ||
    process.env.LLM_PROVIDER !== 'gemini' ||
    !process.env.GEMINI_API_KEY
  )
    fail(503, 'Tìm kiếm ngữ nghĩa cần Gemini thật.');
  if (!texts.length || texts.length > 20)
    fail(400, 'Mỗi lượt tối đa 20 ghi chú.');
  const day = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now);
  if (
    !(await new PgExtractionStore(pool).reserve(user, day, {
      perUser: 10,
      global: 30,
    }))
  )
    fail(429, 'Đã đạt hạn mức AI hôm nay.');
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:batchEmbedContents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${embeddingModel}`,
            content: { parts: [{ text: safeNote(text) }] },
            outputDimensionality: 768,
          })),
        }),
      },
    );
    if (!response.ok) throw new Error();
    const result = z
      .object({
        embeddings: z
          .array(z.object({ values: z.array(z.number().finite()).length(768) }))
          .length(texts.length),
      })
      .parse(await response.json());
    return result.embeddings.map((e) => e.values);
  } catch {
    fail(503, 'Chưa tạo được embedding. Không có dữ liệu nào được lưu thêm.');
  }
}
export async function requireSemantic(user: string, pool: pg.Pool) {
  const p = await pool.query(
    'SELECT semantic_enabled FROM ai_preferences WHERE user_id=$1',
    [user],
  );
  if (!p.rows[0]?.semantic_enabled)
    fail(403, 'Bật quyền gửi ghi chú trong Cài đặt trước nhé.');
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function indexNotes(user: string, pool: pg.Pool, now: Date) {
  await requireSemantic(user, pool);
  const rows = (
    await pool.query(
      'SELECT t.id,t.note FROM transactions t LEFT JOIN transaction_embeddings e ON e.transaction_id=t.id AND e.user_id=t.user_id AND e.model=$2 WHERE t.user_id=$1 AND e.transaction_id IS NULL AND length(trim(t.note))>0 ORDER BY t.id LIMIT 1000',
      [user, embeddingModel],
    )
  ).rows
    .filter((r) => safeNote(r.note))
    .slice(0, 20);
  if (!rows.length) return { indexed: 0 };
  const vectors = await embeddings(
    rows.map((r) => r.note),
    now,
    user,
    pool,
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize consent changes against committing derived data.
    const p = await client.query(
      'SELECT semantic_enabled FROM ai_preferences WHERE user_id=$1 FOR UPDATE',
      [user],
    );
    if (!p.rows[0]?.semantic_enabled) fail(403, 'Quyền tìm kiếm đã được tắt.');
    for (let i = 0; i < rows.length; i++)
      await client.query(
        'INSERT INTO transaction_embeddings(user_id,transaction_id,model,note_hash,embedding) SELECT $1,id,$3,$4,$5 FROM transactions WHERE user_id=$1 AND id=$2 AND note=$6 ON CONFLICT DO NOTHING',
        [
          user,
          rows[i]!.id,
          embeddingModel,
          hash(rows[i]!.note),
          vectors[i],
          rows[i]!.note,
        ],
      );
    await client.query('COMMIT');
    return { indexed: rows.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
export async function semanticSearch(
  query: string,
  user: string,
  pool: pg.Pool,
  now: Date,
) {
  await requireSemantic(user, pool);
  const rows = (
    await pool.query(
      'SELECT t.id,t.note,t.amount_vnd::text,t.occurred_on::text,t.type,e.embedding FROM transaction_embeddings e JOIN transactions t ON t.id=e.transaction_id AND t.user_id=e.user_id WHERE e.user_id=$1 AND e.model=$2 ORDER BY t.id LIMIT 1000',
      [user, embeddingModel],
    )
  ).rows;
  if (!rows.length) return { items: [], indexed: 0 };
  const vector = (await embeddings([query], now, user, pool))[0]!;
  await requireSemantic(user, pool);
  return {
    indexed: rows.length,
    items: rows
      .map((r) => ({
        id: r.id,
        note: r.note,
        amount_vnd: r.amount_vnd,
        occurred_on: r.occurred_on,
        type: r.type,
        score:
          0.8 * cosine(vector, r.embedding) +
          0.2 * keyword(safeNote(query), safeNote(r.note)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  };
}
