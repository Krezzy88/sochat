import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { collectCoverage } from './coverage.ts';
import { resetSyntheticComposeLimiter } from './compose-fixture.ts';
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
  const saved = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/transactions/batch') &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Xác nhận và lưu', exact: true })
    .click();
  expect((await saved).status()).toBe(201);
  await expect(
    page.getByRole('status').filter({ hasText: /Đã lưu \d+ khoản/ }),
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
test.beforeEach(async ({ page, browserName }, info) => {
  resetSyntheticComposeLimiter(info.project.use.baseURL);
  if (browserName === 'chromium')
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await register(page);
});
test.afterEach(async ({ page, browserName }, info) => {
  if (browserName === 'chromium') await collectCoverage(page, info);
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
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã cập nhật giao dịch.' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: /80.000/ })).toBeVisible();
  await go(page, 'Ngân sách');
  await page.getByLabel('Giới hạn tháng (đ)').fill('100000');
  await page.getByRole('button', { name: 'Lưu ngân sách' }).click();
  await expect(page.getByText('Đã dùng từ 80%', { exact: true })).toBeVisible();
  await expect(page.getByText('Đã dùng 80%', { exact: true })).toBeVisible();
  await go(page, 'Giao dịch');
  await page.getByRole('button', { name: /^Xóa / }).click();
  await page
    .getByRole('dialog', { name: 'Xóa giao dịch?' })
    .getByRole('button', { name: 'Xóa giao dịch', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Chưa có giao dịch phù hợp' }),
  ).toBeVisible();
});
test('session survives reload; keyboard navigation and logout work', async ({
  page,
  browserName,
}) => {
  const email = (await (await page.request.get('/api/me')).json()).user.email;
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Hôm nay bạn chi gì?' }),
  ).toBeVisible();
  // macOS WebKit uses Option-Tab to include links under its default settings.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
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
  await page.getByRole('button', { name: 'Xóa quỹ Quỹ đã sửa' }).click();
  await page
    .getByRole('dialog', { name: 'Xóa quỹ?' })
    .getByRole('button', { name: 'Xóa quỹ', exact: true })
    .click();
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
  await toggle.click();
  await page
    .getByRole('dialog', { name: 'Cho phép tìm kiếm bằng AI?' })
    .getByRole('button', { name: 'Bật tính năng' })
    .click();
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

test('toasts dismiss, themed cancel preserves data, reporting boxes are equal', async ({
  page,
}) => {
  await parse(page, 'ăn phở 50k');
  await save(page);
  const toast = page.locator('.toast').filter({ hasText: 'Đã lưu 1 khoản' });
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Đóng thông báo' }).click();
  await expect(toast).toHaveCount(0);
  await go(page, 'Giao dịch');
  const remove = page.getByRole('button', { name: /^Xóa / });
  await remove.click();
  const confirm = page.getByRole('dialog', { name: 'Xóa giao dịch?' });
  await expect(
    confirm.getByRole('button', { name: 'Hủy', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(remove).toBeFocused();
  expect(
    (await (await page.request.get('/api/transactions')).json()).items,
  ).toHaveLength(1);
  await go(page, 'Tổng quan');
  const period = await page
      .getByLabel('Kỳ báo cáo', { exact: true })
      .boundingBox(),
    month = await page.getByLabel(/^Tháng báo cáo: /).boundingBox();
  expect(period).not.toBeNull();
  expect(month).not.toBeNull();
  expect(Math.abs(period!.width - month!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(period!.height - month!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(period!.y - month!.y)).toBeLessThanOrEqual(1);
  await go(page, 'Cài đặt');
  const consent = page.getByLabel(
    'Cho phép gửi ghi chú giao dịch để tìm theo ý nghĩa',
  );
  await consent.click();
  await page
    .getByRole('dialog', { name: 'Cho phép tìm kiếm bằng AI?' })
    .getByRole('button', { name: 'Hủy', exact: true })
    .click();
  await expect(consent).not.toBeChecked();
  expect(
    (await (await page.request.get('/api/me/ai-preferences')).json())
      .semantic_enabled,
  ).toBe(false);
});

test('budget edit pre-fills limit; month/year selection and confirmed deletion are scoped', async ({
  page,
}) => {
  await parse(page, 'ăn phở 50k');
  await save(page);
  await go(page, 'Ngân sách');
  await page.getByLabel('Giới hạn tháng (đ)').fill('100000');
  await page
    .getByRole('button', { name: 'Lưu ngân sách', exact: true })
    .click();
  const edit = page.getByRole('button', {
    name: 'Sửa ngân sách Ăn uống',
    exact: true,
  });
  await edit.click();
  await expect(page.getByLabel('Giới hạn tháng (đ)')).toHaveValue('100.000');
  await expect(page.getByLabel('Giới hạn tháng (đ)')).toBeFocused();
  await page.getByLabel('Giới hạn tháng (đ)').fill('150000');
  const beforeMonth = await page
    .getByLabel('Tháng ngân sách', { exact: true })
    .inputValue();
  await page
    .getByLabel('Tháng ngân sách', { exact: true })
    .selectOption(beforeMonth === '12' ? '01' : '12');
  await page
    .getByRole('dialog', { name: 'Đổi tháng ngân sách?', exact: true })
    .getByRole('button', { name: 'Hủy', exact: true })
    .click();
  await expect(page.getByLabel('Tháng ngân sách', { exact: true })).toHaveValue(
    beforeMonth,
  );
  await expect(page.getByLabel('Giới hạn tháng (đ)')).toHaveValue('150.000');

  await page
    .getByRole('button', { name: 'Lưu thay đổi ngân sách', exact: true })
    .click();
  await expect(page.getByText('/ 150.000', { exact: false })).toBeVisible();
  const originalMonth = await page
      .getByLabel('Tháng ngân sách', { exact: true })
      .inputValue(),
    originalYear = await page
      .getByLabel('Năm ngân sách', { exact: true })
      .inputValue();
  const nextYear = String(Number(originalYear) + 1);
  await page
    .getByLabel('Năm ngân sách', { exact: true })
    .selectOption(nextYear);
  await expect(
    page.getByRole('heading', { name: 'Chưa đặt ngân sách tháng này' }),
  ).toBeVisible();
  await page.getByLabel('Tháng ngân sách', { exact: true }).selectOption('12');
  await page.getByLabel('Giới hạn tháng (đ)').fill('200000');
  await page
    .getByRole('button', { name: 'Lưu ngân sách', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sửa ngân sách Ăn uống', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Năm ngân sách', { exact: true })
    .selectOption(originalYear);
  await page
    .getByLabel('Tháng ngân sách', { exact: true })
    .selectOption(originalMonth);
  await expect(edit).toBeVisible();
  const remove = page.getByRole('button', {
    name: 'Xóa ngân sách Ăn uống',
    exact: true,
  });
  await remove.click();
  await page
    .getByRole('dialog', { name: 'Xóa ngân sách?', exact: true })
    .getByRole('button', { name: 'Hủy', exact: true })
    .click();
  await expect(remove).toBeVisible();
  await remove.click();
  await page
    .getByRole('dialog', { name: 'Xóa ngân sách?', exact: true })
    .getByRole('button', { name: 'Xóa ngân sách', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Chưa đặt ngân sách tháng này' }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get('/api/budgets?month=' + nextYear + '-12')
      ).json()
    ).items[0].limit_vnd,
  ).toBe('200000');
  expect(
    (await (await page.request.get('/api/transactions')).json()).items,
  ).toHaveLength(1);
});

test('month popup applies selected period, Escape cancels, and years are selectable', async ({
  page,
}) => {
  await go(page, 'Tổng quan');
  const control = page.getByLabel(/^Tháng báo cáo: /),
    previous = (await control.textContent())!;
  await control.click();
  const popup = page.getByRole('dialog', {
    name: 'Chọn tháng báo cáo',
    exact: true,
  });
  await expect(popup).toBeVisible();
  await popup.getByLabel('Chọn tháng', { exact: true }).selectOption('12');
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(control).toHaveText(previous);
  await expect(control).toBeFocused();
  await control.click();
  await popup.getByLabel('Chọn tháng', { exact: true }).selectOption('12');
  await popup.getByLabel('Chọn năm', { exact: true }).selectOption('2027');
  const response = page.waitForResponse((r) =>
    r.url().includes('/reports/month?month=2027-12'),
  );
  await popup.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(control).toHaveText('12/2027');
  await page.getByLabel('Kỳ báo cáo', { exact: true }).selectOption('year');
  await page.getByLabel('Năm báo cáo', { exact: true }).selectOption('2027');
  await expect(page.getByLabel('Năm báo cáo', { exact: true })).toHaveValue(
    '2027',
  );
  await go(page, 'Giao dịch');
  await expect(page.getByLabel('Từ ngày', { exact: true })).toHaveAttribute(
    'type',
    'date',
  );
  await expect(page.getByLabel('Đến ngày', { exact: true })).toHaveAttribute(
    'type',
    'date',
  );
});

test('lost contribution response retries the same intent without double counting', async ({
  page,
}) => {
  await go(page, 'Quỹ mục tiêu');
  await page.getByLabel('Tên quỹ', { exact: true }).fill('Quỹ chống trùng');
  await page.getByLabel('Số tiền mục tiêu (đ)').fill('100000');
  await page.getByLabel('Ngày mục tiêu').fill('2027-12-31');
  await page.getByRole('button', { name: 'Tạo quỹ', exact: true }).click();
  await page.getByRole('button', { name: '+ Đóng góp', exact: true }).click();
  await page.getByLabel('Số tiền đóng góp (đ)').fill('30000');
  await page.route(
    '**/api/goals/*/contributions',
    async (route) => {
      const actual = await route.fetch();
      expect(actual.status()).toBe(201);
      await route.abort();
    },
    { times: 1 },
  );
  await page
    .getByRole('button', { name: 'Ghi nhận đóng góp', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Thử ghi lại', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Số tiền đóng góp (đ)')).toBeDisabled();
  await page.getByRole('button', { name: 'Thử ghi lại', exact: true }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Đã ghi nhận đóng góp vào quỹ.' }),
  ).toBeVisible();
  expect(
    (await (await page.request.get('/api/goals')).json()).items[0]
      .contributed_vnd,
  ).toBe('30000');
  expect(
    (await (await page.request.get('/api/transactions')).json()).items,
  ).toHaveLength(0);
});

test('lost goal creation response retries without creating another goal', async ({
  page,
}) => {
  await go(page, 'Quỹ mục tiêu');
  await page.getByLabel('Tên quỹ', { exact: true }).fill('Quỹ tạo an toàn');
  await page.getByLabel('Số tiền mục tiêu (đ)').fill('100000');
  await page.getByLabel('Ngày mục tiêu').fill('2027-12-31');
  await page.route(
    '**/api/goals',
    async (route) => {
      const actual = await route.fetch();
      expect(actual.status()).toBe(201);
      await route.abort();
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Tạo quỹ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Thử tạo lại', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Tên quỹ', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Thử tạo lại', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Quỹ tạo an toàn', exact: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get('/api/goals')).json()).items,
  ).toHaveLength(1);
});
test('two tabs reject stale transaction save and allow explicit reload', async ({
  page,
  context,
}) => {
  await parse(page, 'ăn phở 50k');
  await save(page);
  await go(page, 'Giao dịch');
  const second = await context.newPage();
  await second.goto('/#transactions');
  await second.getByRole('button', { name: /^Sửa / }).click();
  await page.getByRole('button', { name: /^Sửa / }).click();
  await second
    .getByRole('dialog')
    .getByLabel('Số tiền (đ)', { exact: true })
    .fill('75000');
  await second
    .getByRole('button', { name: 'Lưu thay đổi', exact: true })
    .click();
  await expect(second.getByRole('dialog')).toHaveCount(0);
  const draft = page.getByRole('dialog', { name: 'Sửa giao dịch' });
  await draft.getByLabel('Số tiền (đ)', { exact: true }).fill('99000');
  await draft
    .getByRole('button', { name: 'Lưu thay đổi', exact: true })
    .click();
  await expect(draft.getByRole('alert')).toContainText('thay đổi');
  await expect(draft.getByLabel('Số tiền (đ)', { exact: true })).toHaveValue(
    '99.000',
  );
  expect(
    (await (await page.request.get('/api/transactions')).json()).items[0]
      .amount_vnd,
  ).toBe('75000');
  await draft.getByRole('button', { name: 'Tải bản mới', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Tải bản mới?', exact: true })
    .getByRole('button', { name: 'Tải bản mới', exact: true })
    .click();
  await page.getByRole('button', { name: /^Sửa / }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Sửa giao dịch' })
      .getByLabel('Số tiền (đ)', { exact: true }),
  ).toHaveValue('75.000');
  await second.close();
});

test('reload recovers a committed goal after losing its response without another create', async ({
  page,
}) => {
  await go(page, 'Quỹ mục tiêu');
  await page.getByLabel('Tên quỹ', { exact: true }).fill('Quỹ khôi phục');
  await page.getByLabel('Số tiền mục tiêu (đ)').fill('100000');
  await page.getByLabel('Ngày mục tiêu').fill('2027-12-31');
  await page.route(
    '**/api/goals',
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort();
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Tạo quỹ', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Thử tạo lại', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Quỹ khôi phục', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Yêu cầu tạo quỹ trước đã hoàn tất.' }),
  ).toBeVisible();
  expect(
    (await (await page.request.get('/api/goals')).json()).items,
  ).toHaveLength(1);
  await expect(page.getByLabel('Tên quỹ', { exact: true })).toBeEnabled();
});

test('non-JSON upstream startup response shows a friendly retry message', async ({
  page,
}) => {
  await page.route(
    '**/api/transactions?*',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html>Starting service</html>',
      }),
    { times: 1 },
  );
  await go(page, 'Giao dịch');
  await expect(page.getByRole('alert')).toContainText('Máy chủ chưa sẵn sàng');
  await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('literal note search can be cleared without AI', async ({ page }) => {
  await parse(page);
  await save(page);
  await go(page, 'Giao dịch');
  await page
    .getByLabel('Tìm ghi chú', { exact: true })
    .fill('no-matching-note');
  await page
    .getByRole('button', { name: 'Lọc giao dịch', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /^Sửa / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bỏ bộ lọc', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Sửa / })).toHaveCount(1);
});

test('semantic preparation requires fresh confirmation and cancel sends no notes (mocked transport)', async ({
  page,
}) => {
  let preparation = 0,
    searches = 0;
  await page.route('**/api/assistant/search-status', (r) =>
    r.fulfill({ json: { indexed: 0, pending: 2, total: 2 } }),
  );
  await page.route('**/api/assistant/index', (r) => {
    preparation++;
    return r.fulfill({ json: { indexed: 2 } });
  });
  await page.route('**/api/assistant/search', (r) => {
    searches++;
    return r.fulfill({ json: { indexed: 0, items: [] } });
  });
  await go(page, 'Giao dịch');
  await page.getByText('Tìm theo ý nghĩa (tùy chọn)', { exact: true }).click();
  await page.getByLabel('Tìm theo ý nghĩa', { exact: true }).fill('đi chơi');
  await page
    .getByRole('button', { name: 'Tìm theo ý nghĩa', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Chuẩn bị tìm theo ý nghĩa?',
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Tìm theo ý nghĩa', exact: true }),
  ).toBeEnabled();
  expect(preparation).toBe(0);
  expect(searches).toBe(0);
});

test('question views render largest expenses and budget usage (mocked transport)', async ({
  page,
}) => {
  await page.route('**/api/assistant/query', (route) => {
    const budget = route.request().postDataJSON().message.includes('ngân sách');
    return route.fulfill({
      json: {
        needs_clarification: false,
        question: 'Tổng hợp từ giao dịch đã lưu của bạn.',
        month: '2026-11',
        category: 'an_uong',
        income_vnd: '0',
        expense_vnd: '80000',
        comparison: null,
        evidence_url: '/api/transactions?type=expense',
        mode: budget ? 'budget_usage' : 'largest_expenses',
        largest: budget
          ? []
          : [
              {
                id: '1',
                version: '1',
                type: 'expense',
                category: 'an_uong',
                amount_vnd: '80000',
                occurred_on: '2026-11-04',
                note: 'Bữa tối mẫu',
              },
            ],
        budgets: budget
          ? [
              {
                category: 'an_uong',
                spent_vnd: '80000',
                limit_vnd: '100000',
                remaining_vnd: '20000',
                status: 'warning',
              },
            ]
          : [],
      },
    });
  });
  await page
    .getByLabel('Câu hỏi về thu chi', { exact: true })
    .fill('5 khoản chi lớn nhất');
  await page.getByRole('button', { name: 'Hỏi cuốn sổ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tối đa 5 khoản chi lớn nhất' }),
  ).toBeVisible();
  await expect(page.getByText(/Bữa tối mẫu/)).toBeVisible();
  await page
    .getByLabel('Câu hỏi về thu chi', { exact: true })
    .fill('ngân sách ăn uống');
  await page.getByRole('button', { name: 'Hỏi cuốn sổ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Mức sử dụng ngân sách' }),
  ).toBeVisible();
  await expect(page.getByText(/80%, làm tròn xuống/)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Tối đa 5 khoản chi lớn nhất' }),
  ).toHaveCount(0);
});

test('all main pages stay within narrow phone, tablet and laptop widths', async ({
  page,
}) => {
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const name of [
      'Giao dịch',
      'Tổng quan',
      'Ngân sách',
      'Quỹ mục tiêu',
      'Cài đặt',
    ]) {
      await go(page, name);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${name} at ${width}px`,
      ).toBeLessThanOrEqual(width + 1);
    }
  }
});

test('quiet Gemini indicator distinguishes configured, disabled and unavailable states', async ({
  page,
}) => {
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.locator('.engine-status')).toHaveCount(0);
  for (const state of ['on', 'off', 'unknown'] as const) {
    await page.route('**/api/chat/status', async (route) => {
      if (state === 'unknown') return route.fulfill({ status: 503, json: {} });
      return route.fulfill({
        json: { provider: state === 'on' ? 'gemini' : 'fake' },
      });
    });
    await page.reload();
    const label =
      state === 'on'
        ? 'Gemini đang bật'
        : state === 'off'
          ? 'Gemini đang tắt'
          : 'Chưa xác định trạng thái Gemini';
    const indicator = page.getByLabel(label, { exact: true });
    await expect(indicator).toBeVisible();
    const iconOffset = await indicator.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const icon = el.querySelector('svg')!.getBoundingClientRect();
      return (
        Math.abs(box.x + box.width / 2 - icon.x - icon.width / 2) +
        Math.abs(box.y + box.height / 2 - icon.y - icon.height / 2)
      );
    });
    expect(iconOffset).toBeLessThanOrEqual(1);
    await expect(page.locator('.ai-status')).toHaveAttribute(
      'data-state',
      state,
    );
    await indicator.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.ai-status-popover')).toBeVisible();
    await expect(page.locator('.ai-status-popover')).toContainText(label);
    await page.keyboard.press('Escape');
    await expect(page.locator('.ai-status-popover')).toBeHidden();
    await expect(indicator).toBeFocused();
    await indicator.click();
    if (state === 'unknown') {
      await page.unroute('**/api/chat/status');
      await page
        .getByRole('button', { name: 'Kiểm tra lại', exact: true })
        .click();
      await expect(
        page.getByLabel('Gemini đang tắt', { exact: true }),
      ).toBeVisible();
    }
    await page.unroute('**/api/chat/status');
  }
});

test('populated workspace, editors and period popup remain usable across screen sizes', async ({
  page,
}, info) => {
  await parse(page, 'ăn phở 50k, cà phê 25k');
  await save(page);
  await go(page, 'Ngân sách');
  await page.getByLabel('Giới hạn tháng (đ)', { exact: true }).fill('2000000');
  await page
    .getByRole('button', { name: 'Lưu ngân sách', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: /^Sửa ngân sách/ }),
  ).toBeVisible();
  await go(page, 'Quỹ mục tiêu');
  await page
    .getByLabel('Tên quỹ', { exact: true })
    .fill('Chuyến đi dài cùng gia đình và những người bạn thân');
  await page.getByLabel('Số tiền mục tiêu (đ)').fill('100000000000');
  await page.getByLabel('Ngày mục tiêu').fill('2027-12-31');
  await page.getByRole('button', { name: 'Tạo quỹ', exact: true }).click();
  await expect(page.locator('.goal-card')).toBeVisible();
  test.setTimeout(60000);
  await page
    .getByRole('button', { name: 'Đóng thông báo', exact: true })
    .click();
  const folder = '.local/release/ui-polish';
  mkdirSync(folder, { recursive: true });
  for (const [width, height] of [
    [320, 800],
    [768, 800],
    [1366, 800],
    [1024, 500],
    [800, 450],
    [640, 400],
    [390, 500],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const [route, name] of [
      ['chat', ''],
      ['transactions', 'Giao dịch'],
      ['dashboard', 'Tổng quan'],
      ['budgets', 'Ngân sách'],
      ['goals', 'Quỹ mục tiêu'],
      ['settings', 'Cài đặt'],
    ]) {
      if (name) await go(page, name);
      else {
        await page
          .getByRole('navigation')
          .getByRole('link', { name: 'Ghi chép', exact: true })
          .click();
        await expect(
          page.getByRole('heading', { name: 'Hôm nay bạn chi gì?' }),
        ).toBeVisible();
      }
      await expect(page.locator('.loading')).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${name} ${width}px`,
      ).toBeLessThanOrEqual(width + 1);
      for (const height of await page
        .locator('main select:visible')
        .evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect().height),
        )) {
        expect(
          height,
          `${route}: select has a usable touch height`,
        ).toBeGreaterThanOrEqual(46);
      }
      if (route === 'transactions') {
        const heights = await page
          .locator('.filters :is(input, select)')
          .evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect().height),
          );
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(
          1,
        );
      }
      if (route === 'budgets' || route === 'goals') {
        const gap = await page
          .locator('.side-form .editor-fields')
          .evaluate((el) => parseFloat(getComputedStyle(el).rowGap));
        expect(gap).toBeGreaterThanOrEqual(12);
      }
      if (route === 'dashboard') {
        const controls = page.locator('.page-header .period-controls');
        const sizes = await controls
          .locator(':scope > label > :is(input, select, button)')
          .evaluateAll((els) =>
            els.map((el) => ({
              width: el.getBoundingClientRect().width,
              height: el.getBoundingClientRect().height,
              radius: getComputedStyle(el).borderRadius,
            })),
          );
        expect(Math.abs(sizes[0]!.width - sizes[1]!.width)).toBeLessThanOrEqual(
          1,
        );
        expect(sizes[0]!.height).toBe(sizes[1]!.height);
        expect(sizes[0]!.radius).toBe(sizes[1]!.radius);
        await page.getByLabel(/^Tháng báo cáo: /).click();
        const dialog = page.getByRole('dialog', { name: 'Chọn tháng báo cáo' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
        await expect(page.getByLabel(/^Tháng báo cáo: /)).toBeFocused();
      }
      if (route === 'chat' && height >= 800) {
        await expect(page.getByLabel('Tin nhắn thu chi')).toBeInViewport();
      }
      const lastAction = page
        .locator('main')
        .locator(
          'button:visible, input:visible, select:visible, summary:visible',
        )
        .last();
      await lastAction.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect(lastAction).toBeInViewport();
      expect(
        await lastAction.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            ),
          );
        }),
        `${route} action is not covered at ${width}x${height}`,
      ).toBe(true);
      await page.locator('.app-footer').scrollIntoViewIfNeeded();
      await expect(page.locator('.app-footer')).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${folder}/${route}-${width}-${height}-${info.project.name}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
});

test('rapid navigation and late AI status preserve chat input and focus', async ({
  page,
}) => {
  for (let i = 0; i < 5; i++) {
    await go(page, 'Giao dịch');
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/chat/status', async (route) => {
      await pending;
      await route.fulfill({
        json: { provider: 'fake', money_profile: 'standard' },
      });
    });
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Ghi chép', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Hôm nay bạn chi gì?' }),
    ).toBeVisible();
    const input = page.getByLabel('Tin nhắn thu chi');
    const text = `ăn phở ${50 + i}k`;
    try {
      await input.fill(text);
      await expect(input).toHaveValue(text);
      await expect(input).toBeFocused();
    } finally {
      release();
    }
    await expect(
      page.getByLabel('Gemini đang tắt', { exact: true }),
    ).toBeVisible();
    await expect(input).toHaveValue(text);
    await expect(input).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Phân tích', exact: true }),
    ).toBeEnabled();
    await page.unroute('**/api/chat/status');
  }
});
