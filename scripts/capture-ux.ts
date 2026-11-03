import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 950 },
  });
  await page.goto('http://localhost:8080/');
  await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
  await page.screenshot({
    path: 'docs/screenshots/ux/auth-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/screenshots/ux/auth-mobile.png',
    fullPage: true,
  });
} finally {
  await browser.close();
}
