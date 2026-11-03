import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { writeFileSync } from 'node:fs';
if (process.env.CI) throw new Error('Local real Gemini smoke only.');
test('real question filters execute owner-scoped SQL and show ledger evidence', async ({
  page,
}) => {
  const api = page.request;
  const csrf = await (await api.get('/api/auth/csrf')).json();
  const auth = await api.post('/api/auth/register', {
    headers: { 'X-CSRF-Token': csrf.csrf_token },
    data: {
      email: `query-${randomUUID()}@example.test`,
      password: 'Synthetic-query-password-2026',
      display_name: 'Synthetic query',
    },
  });
  expect(auth.status()).toBe(201);
  const token = (await auth.json()).csrf_token;
  try {
    const saved = await api.post('/api/transactions/batch', {
      headers: { 'X-CSRF-Token': token },
      data: {
        idempotency_key: randomUUID(),
        items: [
          {
            type: 'expense',
            category: 'an_uong',
            amount_vnd: '50000',
            note: 'Synthetic lunch',
            occurred_on: '2026-11-02',
          },
          {
            type: 'expense',
            category: 'di_chuyen',
            amount_vnd: '90000',
            note: 'Synthetic transport',
            occurred_on: '2026-11-02',
          },
        ],
      },
    });
    expect(saved.status()).toBe(201);
    await page.goto('/');
    await page
      .getByLabel('Câu hỏi về thu chi')
      .fill('Tháng 11 năm 2026 chi ăn uống bao nhiêu?');
    const pending = page.waitForResponse((r) =>
      r.url().includes('/api/assistant/query'),
    );
    await page
      .getByRole('button', { name: 'Hỏi cuốn sổ', exact: true })
      .click();
    const response = await pending;
    expect(response.status()).toBe(200);
    const answer = await response.json();
    expect(answer.needs_clarification).toBe(false);
    expect(answer.month).toBe('2026-11');
    expect(answer.category).toBe('an_uong');
    expect(answer.expense_vnd).toBe('50000');
    await page
      .getByRole('button', { name: 'Xem giao dịch làm bằng chứng' })
      .click();
    await expect(
      page.getByRole('cell', { name: 'Synthetic lunch', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Synthetic transport', exact: true }),
    ).toHaveCount(0);
    expect(
      (await (await api.get('/api/transactions')).json()).items,
    ).toHaveLength(2);
    writeFileSync(
      'docs/measurements/assistant-query-live.json',
      JSON.stringify(
        {
          kind: 'Synthetic authorized real Gemini query smoke',
          generated_at: new Date().toISOString(),
          answer,
          ledger_unchanged: true,
          evidence_excludes_other_category: true,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await api.delete('/api/me', { headers: { 'X-CSRF-Token': token } });
  }
});
