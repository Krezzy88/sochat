import process from 'node:process';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
if (process.env.CI) throw new Error('Local real-provider test only.');
test('separate panels support expense, question, draft edit; consented search and revocation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const api = page.request;
  const csrf = await (await api.get('/api/auth/csrf')).json();
  const auth = await api.post('/api/auth/register', {
    headers: { 'X-CSRF-Token': csrf.csrf_token },
    data: {
      email: `ui-expansion-${randomUUID()}@example.test`,
      password: 'Synthetic-browser-expansion-2026',
      display_name: 'Bạn thử nghiệm',
    },
  });
  expect(auth.status()).toBe(201);
  const token = (await auth.json()).csrf_token;
  const send = async (text: string, path: string) => {
    const revision = path.endsWith('/revise'),
      question = path.endsWith('/query');
    if (revision)
      await page
        .getByText('Sửa bản nháp bằng câu nói', { exact: true })
        .click();
    await page
      .getByLabel(
        revision
          ? 'Yêu cầu sửa bản nháp'
          : question
            ? 'Câu hỏi về thu chi'
            : 'Tin nhắn thu chi',
      )
      .fill(text);
    const response = page.waitForResponse((r) => r.url().includes(path));
    await page
      .getByRole('button', {
        name: revision
          ? 'Áp dụng vào bản nháp'
          : question
            ? 'Hỏi cuốn sổ'
            : 'Phân tích',
        exact: true,
      })
      .click();
    const r = await response;
    expect(r.status()).toBe(200);
    return r.json();
  };
  try {
    await page.goto('/');
    await expect(
      page.getByRole('textbox', { name: 'Tin nhắn thu chi' }),
    ).toHaveCount(1);
    if (process.env.SOCHAT_LIVE_FEATURES_ONLY === 'true') {
      await send('ăn phở 70k', '/api/chat/parse');
      await page
        .getByRole('button', { name: 'Xác nhận và lưu', exact: true })
        .click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Đã lưu' }),
      ).toBeVisible();
    } else {
      await send('ăn phở 50k', '/api/chat/parse');
      expect(
        (await (await api.get('/api/transactions')).json()).items,
      ).toHaveLength(0);
      const query = await send(
        'Tháng 11 năm 2026 chi ăn uống bao nhiêu?',
        '/api/assistant/query',
      );
      expect(query.expense_vnd).toBe('0');
      const revision = await send('tăng thêm 20k', '/api/assistant/revise');
      expect(revision.items[0].amount_vnd).toBe('70000');
      await page
        .getByRole('button', { name: 'Xác nhận và lưu', exact: true })
        .click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Đã lưu' }),
      ).toBeVisible();
      const ledger = (await (await api.get('/api/transactions')).json()).items;
      expect(ledger).toHaveLength(1);
      expect(ledger[0].amount_vnd).toBe('70000');
    }
    mkdirSync('docs/screenshots/ux', { recursive: true });
    await page.screenshot({
      path: 'docs/screenshots/ux/separate-panels-desktop.png',
      fullPage: true,
    });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Cài đặt', exact: true })
      .click();
    const semantic = page.getByLabel(
      'Cho phép gửi ghi chú giao dịch để tìm theo ý nghĩa',
    );
    await expect(semantic).not.toBeChecked();
    await semantic.check();
    await expect(semantic).toBeChecked();
    await expect(semantic).toBeEnabled();
    await page.screenshot({
      path: 'docs/screenshots/ux/ai-consent-desktop.png',
      fullPage: true,
    });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Giao dịch', exact: true })
      .click();
    await page.getByText('Tìm nâng cao theo ý nghĩa', { exact: true }).click();
    const indexing = page.waitForResponse((r) =>
      r.url().includes('/api/assistant/index'),
    );
    await page
      .getByRole('button', { name: 'Lập chỉ mục 20 ghi chú tiếp theo' })
      .click();
    expect((await indexing).status()).toBe(200);
    await page.getByLabel('Tìm theo ý nghĩa', { exact: true }).fill('bữa ăn');
    const search = page.waitForResponse((r) =>
      r.url().includes('/api/assistant/search'),
    );
    await page
      .getByRole('button', { name: 'Tìm giao dịch', exact: true })
      .click();
    expect((await search).status()).toBe(200);
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã tìm trong 1 ghi chú' }),
    ).toBeVisible();
    await page.screenshot({
      path: 'docs/screenshots/ux/semantic-search-desktop.png',
      fullPage: true,
    });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Cài đặt', exact: true })
      .click();
    await semantic.uncheck();
    await expect(semantic).not.toBeChecked();
    await expect(semantic).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: 'docs/screenshots/ux/ai-consent-mobile.png',
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    writeFileSync(
      'docs/measurements/ai-expansion-browser-live.json',
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          real_provider: true,
          separate_panels: true,
          exact_delta:
            process.env.SOCHAT_LIVE_FEATURES_ONLY === 'true' ? null : '70000',
          unsaved_query_excluded:
            process.env.SOCHAT_LIVE_FEATURES_ONLY !== 'true',
          consent_default_off: true,
          semantic_search: true,
          revocation: true,
          page_errors: errors,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    expect(
      (
        await api.delete('/api/me', { headers: { 'X-CSRF-Token': token } })
      ).status(),
    ).toBe(204);
  }
});
