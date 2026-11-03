import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { collectCoverage } from './coverage.ts';
async function register(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Đăng ký ngay' }).click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Bạn sinh viên');
  await page
    .getByLabel('Email', { exact: true })
    .fill(`synthetic-${randomUUID()}@example.test`);
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Synthetic-browser-password-2026');
  await page
    .getByLabel('Xác nhận mật khẩu', { exact: true })
    .fill('Synthetic-browser-password-2026');
  await page
    .getByRole('button', { name: 'Tạo tài khoản', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Hôm nay bạn chi gì?' }),
  ).toBeVisible();
}
async function parse(page: Page, text = 'ăn phở 50k') {
  await page.getByLabel('Tin nhắn thu chi').fill(text);
  await page.getByRole('button', { name: 'Phân tích', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Kiểm tra trước khi lưu' }),
  ).toBeVisible();
}
async function save(page: Page) {
  await page
    .getByRole('button', { name: 'Xác nhận và lưu', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu' }),
  ).toBeVisible();
}
async function go(page: Page, name: string) {
  await page
    .getByRole('navigation')
    .getByRole('link', { name, exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name, exact: true, level: 1 }),
  ).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await register(page);
});
test.afterEach(async ({ page }, info) => {
  await collectCoverage(page, info);
  // Cleanup only this synthetic actor. Never print or persist cookies/CSRF.
  await page
    .evaluate(async () => {
      const r = await fetch('/api/me');
      if (!r.ok) return;
      const d = await r.json();
      await fetch('/api/me', {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': d.csrf_token },
      });
    })
    .catch(() => {});
});
test('register → edit proposal → confirm → report → goal → CSV → delete account', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('docs/screenshots', { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/chat-${info.project.name}.png`,
    fullPage: info.project.name === 'desktop-chromium',
  });
  await parse(page, 'trưa nay ăn phở 50k, cà phê 25k');
  const before = await page.request.get('/api/transactions');
  expect((await before.json()).items).toHaveLength(0);
  await page.getByLabel('Số tiền (đ)', { exact: true }).first().fill('55000');
  await save(page);
  await go(page, 'Tổng quan');
  await expect(
    page.getByText('80.000', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Số tiền thu và chi chính xác theo kỳ' }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/dashboard-${info.project.name}.png`,
    fullPage: info.project.name === 'desktop-chromium',
  });
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((el) => el.clientWidth),
  );
  await go(page, 'Quỹ mục tiêu');
  await page.getByLabel('Tên quỹ', { exact: true }).fill('Chuyến đi Đà Lạt');
  await page.getByLabel('Số tiền mục tiêu (đ)').fill('3000000');
  await page.getByLabel('Ngày mục tiêu').fill('2027-12-31');
  await page.getByRole('button', { name: 'Tạo quỹ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Chuyến đi Đà Lạt', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '+ Đóng góp', exact: true }).click();
  await page.getByLabel('Số tiền đóng góp (đ)').fill('100000');
  await page
    .getByRole('button', { name: 'Ghi nhận đóng góp', exact: true })
    .click();
  await expect(page.getByText('Đã ghi nhận đóng góp vào quỹ.')).toBeVisible();
  await go(page, 'Cài đặt');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất CSV', exact: true }).click();
  const file = await download;
  const stream = await file.createReadStream();
  let csv = '';
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain('55000');
  expect(csv).toContain('25000');
  await page.getByRole('button', { name: 'Xóa tài khoản của tôi' }).click();
  await page.getByLabel('Nhập XÓA để xác nhận').fill('XÓA');
  await page.getByRole('button', { name: 'Xóa vĩnh viễn' }).click();
  await expect(
    page.getByRole('heading', { name: 'Mừng bạn quay lại' }),
  ).toBeVisible();
  expect((await page.request.get('/api/me')).status()).toBe(401);
  expect(errors).toEqual([]);
});
test('unitless amount stays unresolved until the user supplies it', async ({
  page,
}) => {
  await parse(page, 'ăn phở 50');
  await expect(page.getByText('Có chỗ cần bạn làm rõ')).toBeVisible();
  await expect(page.getByLabel('Số tiền (đ)', { exact: true })).toHaveValue('');
  await page
    .getByRole('button', { name: 'Xác nhận và lưu', exact: true })
    .click();
  expect(
    (await (await page.request.get('/api/transactions')).json()).items,
  ).toHaveLength(0);
  await page.getByLabel('Số tiền (đ)', { exact: true }).fill('50000');
  await save(page);
  expect(
    (await (await page.request.get('/api/transactions')).json()).items,
  ).toHaveLength(1);
});
test('retry after a lost confirmation response never duplicates a save', async ({
  page,
}) => {
  await parse(page);
  await page.route(
    '**/api/transactions/batch',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page
    .getByRole('button', { name: 'Xác nhận và lưu', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Thử lưu lại');
  await expect(page.getByLabel('Số tiền (đ)', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Thử lưu lại', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu' }),
  ).toBeVisible();
  expect(
    (await (await page.request.get('/api/transactions')).json()).items,
  ).toHaveLength(1);
});
test('transaction edit/delete and budget warning use persisted data', async ({
  page,
}) => {
  await parse(page);
  await save(page);
  await go(page, 'Giao dịch');
  await page.getByRole('button', { name: /^Sửa / }).click();
  await page.getByLabel('Số tiền (đ)', { exact: true }).fill('80000');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã cập nhật');
  await expect(page.getByRole('cell', { name: /80.000/ })).toBeVisible();
  await go(page, 'Ngân sách');
  await page.getByLabel('Giới hạn tháng (đ)').fill('100000');
  await page.getByRole('button', { name: 'Lưu ngân sách' }).click();
  await expect(page.getByText('Đã dùng từ 80%', { exact: true })).toBeVisible();
  await expect(page.getByText('Đã dùng 80%', { exact: true })).toBeVisible();
  await go(page, 'Giao dịch');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: /^Xóa / }).click();
  await expect(
    page.getByRole('heading', { name: 'Chưa có giao dịch phù hợp' }),
  ).toBeVisible();
});
test('session survives reload; keyboard navigation and logout work', async ({
  page,
}) => {
  const email = (await (await page.request.get('/api/me')).json()).user.email;
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Hôm nay bạn chi gì?' }),
  ).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Đến nội dung chính' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await go(page, 'Cài đặt');
  await page
    .getByRole('button', { name: 'Đăng xuất', exact: true })
    .last()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Mừng bạn quay lại' }),
  ).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('Synthetic-browser-password-2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cài đặt', exact: true, level: 1 }),
  ).toBeVisible();
});
test('report error and retry are visible; yearly table is available', async ({
  page,
}) => {
  await page.route(
    '**/api/reports/month?*',
    (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({ detail: 'Dữ liệu tạm thời chưa sẵn sàng.' }),
      }),
    { times: 1 },
  );
  await go(page, 'Tổng quan');
  await expect(page.getByRole('alert')).toContainText('Dữ liệu tạm thời');
  await page.getByRole('button', { name: 'Thử tải lại' }).click();
  await expect(
    page.getByRole('heading', { name: 'Một trang sổ còn trống' }),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Ghi chép', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Hôm nay bạn chi gì?' }),
  ).toBeVisible();
  await parse(page);
  await save(page);
  await go(page, 'Tổng quan');
  await page.getByLabel('Kỳ báo cáo', { exact: true }).selectOption('year');
  await expect(
    page.getByRole('table', { name: 'Số tiền thu và chi chính xác theo kỳ' }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: /50.000/ }).first(),
  ).toBeVisible();
});

test('cursor filters and goal edit/delete controls work', async ({ page }) => {
  const me = await (await page.request.get('/api/me')).json();
  for (let start = 0; start < 21; start += 10) {
    const items = Array.from({ length: Math.min(10, 21 - start) }, (_, n) => ({
      type: 'expense',
      category: 'an_uong',
      amount_vnd: '10000',
      note: 'Mẫu ' + (start + n),
      occurred_on: '2026-11-02',
    }));
    const response = await page.request.post('/api/transactions/batch', {
      headers: { 'X-CSRF-Token': me.csrf_token },
      data: { items, idempotency_key: randomUUID() },
    });
    expect(response.status()).toBe(201);
  }
  await go(page, 'Giao dịch');
  await expect(
    page.getByRole('cell', { name: 'Mẫu 20 Chi tiêu', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Trang sau →' }).click();
  await expect(
    page.getByRole('cell', { name: 'Mẫu 0 Chi tiêu', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Trang sau →' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '← Trang trước' }).click();
  await expect(
    page.getByRole('cell', { name: 'Mẫu 20 Chi tiêu', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Loại', exact: true })
    .selectOption('income');
  await page.getByRole('button', { name: 'Lọc giao dịch' }).click();
  await expect(
    page.getByRole('heading', { name: 'Chưa có giao dịch phù hợp' }),
  ).toBeVisible();
  await go(page, 'Quỹ mục tiêu');
  await page.getByLabel('Tên quỹ', { exact: true }).fill('Quỹ mẫu');
  await page.getByLabel('Số tiền mục tiêu (đ)').fill('100000');
  await page.getByLabel('Ngày mục tiêu').fill('2027-12-31');
  await page.getByRole('button', { name: 'Tạo quỹ', exact: true }).click();
  await page.getByRole('button', { name: 'Sửa quỹ Quỹ mẫu' }).click();
  await page.getByLabel('Tên quỹ', { exact: true }).fill('Quỹ đã sửa');
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Quỹ đã sửa', exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Xóa quỹ Quỹ đã sửa' }).click();
  await expect(
    page.getByRole('heading', { name: 'Bạn đang ấp ủ điều gì?' }),
  ).toBeVisible();
});

test('semantic consent defaults off, persists, revokes; voice is absent', async ({
  page,
}) => {
  await expect(
    page.getByRole('button', { name: 'Ghi âm', exact: true }),
  ).toHaveCount(0);
  await go(page, 'Cài đặt');
  const toggle = page.getByLabel(
    'Cho phép gửi ghi chú giao dịch để tìm theo ý nghĩa',
  );
  await expect(toggle).not.toBeChecked();
  const updated = page.waitForResponse(
    (r) =>
      r.url().includes('/api/me/ai-preferences') &&
      r.request().method() === 'PUT',
  );
  await toggle.check();
  expect((await updated).status()).toBe(200);
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeEnabled();
  await page.reload();
  await expect(toggle).toBeChecked();
  const revoked = page.waitForResponse(
    (r) =>
      r.url().includes('/api/me/ai-preferences') &&
      r.request().method() === 'PUT',
  );
  await toggle.uncheck();
  expect((await revoked).status()).toBe(200);
  await expect(toggle).not.toBeChecked();
  expect(
    (
      await page.request.post('/api/assistant/transcribe', {
        data: { audio: 'removed' },
      })
    ).status(),
  ).toBe(404);
});

test('separate question form preserves expense draft (mocked question transport)', async ({
  page,
}) => {
  await parse(page, 'ăn phở 50k');
  await page.route('**/api/assistant/query', (r) =>
    r.fulfill({
      json: {
        needs_clarification: false,
        question: 'Các khoản đã lưu',
        month: '2026-11',
        category: null,
        income_vnd: '0',
        expense_vnd: '0',
        evidence_url: '/api/transactions?from=2026-11-01&to=2026-11-30',
      },
    }),
  );
  await page.getByLabel('Câu hỏi về thu chi').fill('Tháng này chi bao nhiêu?');
  await page.getByRole('button', { name: 'Hỏi cuốn sổ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Kiểm tra trước khi lưu' }),
  ).toBeVisible();
  await page.route('**/api/assistant/revise', async (route) => {
    const input = route.request().postDataJSON();
    await route.fulfill({
      json: {
        items: input.items.map((i: object) => ({ ...i, amount_vnd: '70000' })),
        needs_clarification: false,
        question: 'Đã cập nhật bản nháp.',
        changed_indices: [0],
      },
    });
  });
  await page.getByText('Sửa bản nháp bằng câu nói', { exact: true }).click();
  await page.getByLabel('Yêu cầu sửa bản nháp').fill('tăng thêm 20k');
  await page
    .getByRole('button', { name: 'Áp dụng vào bản nháp', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã cập nhật bản nháp.' }),
  ).toBeVisible();
  await save(page);
  expect(
    (await (await page.request.get('/api/transactions')).json()).items,
  ).toHaveLength(1);
  expect(
    (await (await page.request.get('/api/transactions')).json()).items[0]
      .amount_vnd,
  ).toBe('70000');
});

test('editing a scrolled transaction opens a visible modal and Escape returns focus', async ({
  page,
}) => {
  await parse(page, 'ăn phở 50k');
  await save(page);
  await go(page, 'Giao dịch');
  const trigger = page.getByRole('button', { name: /^Sửa / }).first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Sửa giao dịch' });
  await expect(dialog).toBeInViewport();
  await expect(
    dialog.getByRole('combobox', { name: 'Loại', exact: true }),
  ).toBeFocused();
  await dialog.getByLabel('Số tiền (đ)', { exact: true }).fill('75000');
  await page.route(
    '**/api/transactions/*',
    (r) =>
      r.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ detail: 'Không lưu được, thử lại nhé.' }),
      }),
    { times: 1 },
  );
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Không lưu được');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã cập nhật giao dịch.' }),
  ).toBeVisible();
  expect(
    (await (await page.request.get('/api/transactions')).json()).items[0]
      .amount_vnd,
  ).toBe('75000');
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
