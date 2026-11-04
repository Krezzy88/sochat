import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { collectCoverage } from './coverage.ts';
test.beforeEach(async ({ page, browserName }) => {
  if (browserName === 'chromium')
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
});
test.afterEach(async ({ page, browserName }, info) => {
  if (browserName === 'chromium') await collectCoverage(page, info);
});
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 667, height: 375 },
]) {
  test(`login fits ${viewport.width}x${viewport.height} without hiding actions`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const login = page.getByRole('button', { name: 'Đăng nhập', exact: true });
    await expect(login).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Quên mật khẩu?', exact: true }),
    ).toHaveCount(0);
    const size = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    expect(size.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(size.height).toBeLessThanOrEqual(viewport.height + 1);
    const box = await login.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    mkdirSync('.local/release/responsive', { recursive: true });
    await page.screenshot({
      path: `.local/release/responsive/login-${viewport.width}-${viewport.height}.png`,
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Đăng ký ngay', exact: true })
      .click();
    await expect(
      page.getByLabel('Xác nhận mật khẩu', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Tạo tài khoản', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('button', { name: 'Tạo tài khoản', exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width + 1);
  });
}
