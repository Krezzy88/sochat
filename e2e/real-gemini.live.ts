// Explicit local real-provider smoke. Excluded from normal CI test patterns.
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
if (process.env.CI) throw new Error('Live Gemini UI checks are local only.');
test('real Gemini, grouped money, accessible auth and responsive playful UI', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Bạn thử nghiệm');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`ux-${randomUUID()}@example.test`);
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Synthetic-live-password-2026');
  await page
    .getByLabel('Xác nhận mật khẩu', { exact: true })
    .fill('Not-matching-password');
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Bắt đầu cuốn sổ của bạn' }),
  ).toBeVisible();
  await page
    .getByLabel('Xác nhận mật khẩu', { exact: true })
    .fill('Synthetic-live-password-2026');
  await page
    .getByRole('button', { name: 'Hiện mật khẩu', exact: true })
    .click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click();
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: true })
    .click();
  try {
    await expect(
      page.getByText('✦ Gemini thật đã bật', { exact: true }),
    ).toBeVisible();
    mkdirSync('docs/screenshots/ux', { recursive: true });
    await page.screenshot({
      path: 'docs/screenshots/ux/chat-desktop.png',
      fullPage: true,
    });
    await page
      .getByLabel('Tin nhắn thu chi')
      .fill('đóng phí workshop làm gốm 185k');
    const parsed = page.waitForResponse(
      (r) =>
        r.url().includes('/api/chat/parse') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Phân tích', exact: true }).click();
    const response = await parsed;
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.provider).toBe('gemini');
    expect(result.path).toBe('llm');
    expect(result.attempts).toBeGreaterThan(0);
    await expect(
      page.getByText('Gemini đã hỗ trợ bóc tách', { exact: true }),
    ).toBeVisible();
    expect(
      (await (await page.request.get('/api/transactions')).json()).items,
    ).toHaveLength(0);
    const amount = page.getByLabel('Số tiền (đ)', { exact: true });
    await amount.fill('3.500.000');
    await expect(amount).toHaveValue('3.500.000');
    await amount.evaluate((el) =>
      (el as HTMLInputElement).setSelectionRange(1, 1),
    );
    await amount.press('9');
    await expect(amount).toHaveValue('39.500.000');
    await amount.fill('185000');
    await expect(amount).toHaveValue('185.000');
    await page
      .getByRole('button', { name: 'Xác nhận và lưu', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã lưu' }),
    ).toBeVisible();
    const ledger = await (await page.request.get('/api/transactions')).json();
    expect(ledger.items).toHaveLength(1);
    expect(ledger.items[0].amount_vnd).toBe('185000');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
    await page.screenshot({
      path: 'docs/screenshots/ux/chat-mobile.png',
      fullPage: false,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await page
        .locator('.mascot')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
    writeFileSync(
      'docs/measurements/gemini-live-ui.json',
      JSON.stringify(
        {
          kind: 'Owner-authorized synthetic real Gemini browser smoke',
          generated_at: new Date().toISOString(),
          provider: result.provider,
          path: result.path,
          attempts: result.attempts,
          usage: result.usage,
          needs_clarification: result.needs_clarification,
          confirmed_amount_vnd: ledger.items[0].amount_vnd,
          checks: [
            'password confirmation/visibility',
            'real Gemini fallback',
            'no save before confirmation',
            'grouping/paste/caret',
            'integer confirmation',
            '390px no overflow',
            'reduced motion',
          ],
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    const me = await page.request.get('/api/me');
    if (me.ok()) {
      await page.request.delete('/api/me', {
        headers: { 'X-CSRF-Token': (await me.json()).csrf_token },
      });
    }
  }
});
