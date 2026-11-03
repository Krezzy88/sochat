// Owner-authorized bounded local synthetic checks; never run in CI.
import process from 'node:process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { request } from '@playwright/test';
import { keyword } from '../apps/api/src/http/semantic.ts';
if (process.env.CI) throw new Error('Local only');
const api = await request.newContext({
  baseURL: 'http://localhost:8080',
  extraHTTPHeaders: { Origin: 'http://localhost:8080' },
});
const csrf = await (await api.get('/api/auth/csrf')).json();
const auth = await api.post('/api/auth/register', {
  headers: { 'X-CSRF-Token': csrf.csrf_token },
  data: {
    email: `expansion-${randomUUID()}@example.test`,
    password: 'Synthetic-expansion-password-2026',
    display_name: 'Synthetic expansion',
  },
});
assert.equal(auth.status(), 201);
const token = (await auth.json()).csrf_token;
const post = async (path: string, data: unknown) => {
  const r = await api.post(path, { headers: { 'X-CSRF-Token': token }, data });
  assert.equal(
    r.status(),
    200,
    `${path}: ${r.status()} ${(await r.text()).slice(0, 200)}`,
  );
  return r.json();
};
const report: Record<string, unknown> = {
  kind: 'Synthetic real Gemini smoke; small author-designed retrieval set, not representative accuracy',
  generated_at: new Date().toISOString(),
};
try {
  const defaults = await (await api.get('/api/me/ai-preferences')).json();
  assert.deepEqual(defaults, { semantic_enabled: false });
  report.default_off = true;
  assert.equal(
    (
      await api.put('/api/me/ai-preferences', {
        headers: { 'X-CSRF-Token': token },
        data: { semantic_enabled: true },
      })
    ).status(),
    200,
  );
  const revision = await post('/api/assistant/revise', {
    message: 'tăng thêm 20k',
    items: [
      {
        type: 'expense',
        category: 'an_uong',
        amount_vnd: '50000',
        occurred_on: '2026-11-03',
        note: 'Synthetic lunch',
      },
    ],
  });
  assert.equal(revision.needs_clarification, false);
  assert.equal(revision.items[0].amount_vnd, '70000');
  report.revision = {
    amount_vnd: revision.items[0].amount_vnd,
    ledger_unchanged:
      (await (await api.get('/api/transactions')).json()).items.length === 0,
  };
  const notes = [
    'Mua thuốc cảm tại nhà thuốc',
    'Sửa xe máy bị thủng lốp',
    'Cà phê muối cùng bạn',
    'Mua vé xem phim rạp',
    'Đóng học phí tiếng Anh',
    'Mua thức ăn cho mèo',
    'Mua rau ở siêu thị',
    'Thanh toán tiền điện',
  ];
  const saved = await api.post('/api/transactions/batch', {
    headers: { 'X-CSRF-Token': token },
    data: {
      idempotency_key: randomUUID(),
      items: notes.map((note) => ({
        type: 'expense',
        category: 'khac',
        amount_vnd: '10000',
        occurred_on: '2026-11-03',
        note,
      })),
    },
  });
  assert.equal(saved.status(), 201);
  report.index = await post('/api/assistant/index', {});
  const cases = [
    { query: 'chi phí chữa bệnh', relevant: notes[0]! },
    { query: 'khắc phục phương tiện hỏng bánh', relevant: notes[1]! },
    { query: 'nuôi thú cưng', relevant: notes[5]! },
    { query: 'học ngoại ngữ', relevant: notes[4]! },
  ];
  const retrieval = [];
  for (const c of cases) {
    const result = await post('/api/assistant/search', { query: c.query });
    const ranked = [...notes].sort(
      (a, b) => keyword(c.query, b) - keyword(c.query, a),
    );
    retrieval.push({
      ...c,
      keyword_top1: ranked[0],
      hybrid_top1: result.items[0]?.note,
      keyword_hit: ranked[0] === c.relevant,
      hybrid_hit: result.items[0]?.note === c.relevant,
    });
  }
  report.retrieval = {
    cases: retrieval,
    keyword_top1: retrieval.filter((r) => r.keyword_hit).length,
    hybrid_top1: retrieval.filter((r) => r.hybrid_hit).length,
    total: cases.length,
  };
  assert.equal(
    (
      await api.put('/api/me/ai-preferences', {
        headers: { 'X-CSRF-Token': token },
        data: { semantic_enabled: false },
      })
    ).status(),
    200,
  );
  assert.equal(
    (
      await api.post('/api/assistant/search', {
        headers: { 'X-CSRF-Token': token },
        data: { query: 'thú cưng' },
      })
    ).status(),
    403,
  );
  report.revocation_denies_search = true;
} finally {
  assert.equal(
    (
      await api.delete('/api/me', { headers: { 'X-CSRF-Token': token } })
    ).status(),
    204,
  );
  await api.dispose();
  writeFileSync(
    'docs/measurements/ai-expansion-live.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(JSON.stringify(report, null, 2));
