// Synthetic local production-mode rehearsal. Never calls real Gemini/heldout.
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('HTTPS same-origin dashboard preserves secure sessions, versioned writes and exact exports', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
  await page
    .getByLabel('Tên hiển thị', { exact: true })
    .fill('Release fixture');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`release-${randomUUID()}@example.test`);
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Synthetic-release-password-2026');
  await page
    .getByLabel('Xác nhận mật khẩu', { exact: true })
    .fill('Synthetic-release-password-2026');
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: true })
    .click();
  await expect(page.getByLabel('Tin nhắn thu chi')).toBeVisible();
  try {
    const cookie = (await context.cookies()).find(
      (c) => c.name === 'sochat.sid',
    );
    expect(cookie?.secure).toBe(true);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    await page.reload();
    await expect(page.getByLabel('Tin nhắn thu chi')).toBeVisible();
    const me = await (await page.request.get('/api/me')).json();
    const headers = { 'X-CSRF-Token': me.csrf_token };
    const parsed = await page.request.post('/api/chat/parse', {
      headers,
      data: { message: 'phở 35' },
    });
    expect(parsed.status()).toBe(200);
    expect((await parsed.json()).items[0].amount_vnd).toBe(35000);
    const saved = await page.request.post('/api/transactions/batch', {
      headers,
      data: {
        idempotency_key: randomUUID(),
        items: [
          {
            type: 'expense',
            category: 'an_uong',
            amount_vnd: '35000',
            occurred_on: '2026-11-03',
            note: 'Synthetic release fixture',
          },
        ],
      },
    });
    expect(saved.status()).toBe(201);
    const row = (await saved.json()).items[0];
    expect(
      (
        await page.request.patch('/api/transactions/' + row.id, {
          headers,
          data: { version: row.version, amount_vnd: '45000' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.patch('/api/transactions/' + row.id, {
          headers,
          data: { version: row.version, amount_vnd: '55000' },
        })
      ).status(),
    ).toBe(409);
    const exported = await page.request.get('/api/me/export');
    expect(exported.status()).toBe(200);
    const csv = await exported.text();
    expect(csv).toContain('"45000"');
    expect(csv).not.toContain('synthetic-restore-marker');
    expect((await page.request.get('/api/does-not-exist')).status()).toBe(404);
    expect(
      await page
        .locator('body')
        .evaluate((el) => el.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    const me = await page.request.get('/api/me');
    if (me.ok())
      expect(
        (
          await page.request.delete('/api/me', {
            headers: { 'X-CSRF-Token': (await me.json()).csrf_token },
          })
        ).status(),
      ).toBe(204);
  }
});
