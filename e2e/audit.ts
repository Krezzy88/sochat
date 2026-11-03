import process from 'node:process';
// Run only against `npm run e2e:serve` (isolated DB + fake), not local owner data.
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.SOCHAT_AUDIT_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({
  headless: true,
  args: ['--remote-debugging-port=9222'],
});
const context = await browser.newContext();
const api = context.request;
let token = '';
try {
  const csrf = await api.get(base + '/api/auth/csrf');
  const registration = await api.post(base + '/api/auth/register', {
    headers: { 'X-CSRF-Token': (await csrf.json()).csrf_token },
    data: {
      email: `audit-${randomUUID()}@example.test`,
      password: 'Synthetic-audit-password-2026',
      display_name: 'Bạn sinh viên',
    },
  });
  if (registration.status() !== 201)
    throw new Error('Synthetic audit account setup failed.');
  token = (await registration.json()).csrf_token;
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
  const saved = await api.post(base + '/api/transactions/batch', {
    headers: { 'X-CSRF-Token': token },
    data: {
      idempotency_key: randomUUID(),
      items: [
        {
          type: 'expense',
          amount_vnd: '50000',
          category: 'an_uong',
          note: 'Bữa trưa mẫu',
          occurred_on: date,
        },
        {
          type: 'income',
          amount_vnd: '2000000',
          category: 'tro_cap',
          note: 'Trợ cấp mẫu',
          occurred_on: date,
        },
      ],
    },
  });
  if (saved.status() !== 201)
    throw new Error('Synthetic audit ledger setup failed.');
  const cookie = (await context.cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const results = [];
  for (const page of ['chat', 'dashboard']) {
    const result = await lighthouse(base + '/#' + page, {
      port: 9222,
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility'],
      disableStorageReset: true,
      extraHeaders: { Cookie: cookie },
    });
    if (!result || result.lhr.runtimeError)
      throw new Error('Lighthouse could not complete.');
    const lhr = result.lhr;
    // Retain selected metrics only: full reports can contain the authenticated Cookie header.
    results.push({
      page,
      fetchTime: lhr.fetchTime,
      lighthouseVersion: lhr.lighthouseVersion,
      userAgent: lhr.userAgent,
      formFactor: lhr.configSettings.formFactor,
      throttling: lhr.configSettings.throttling,
      performance: lhr.categories.performance?.score,
      accessibility: lhr.categories.accessibility?.score,
      metrics: Object.fromEntries(
        [
          'first-contentful-paint',
          'largest-contentful-paint',
          'speed-index',
          'total-blocking-time',
          'cumulative-layout-shift',
        ].map((id) => [
          id,
          {
            value: lhr.audits[id]?.numericValue,
            display: lhr.audits[id]?.displayValue,
          },
        ]),
      ),
      failedAccessibility: lhr.categories.accessibility?.auditRefs
        .filter((r) => lhr.audits[r.id]?.score === 0)
        .map((r) => ({
          id: r.id,
          title: lhr.audits[r.id]?.title,
          details: lhr.audits[r.id]?.details,
        })),
      warnings: lhr.runWarnings,
    });
    process.stdout.write(
      `${page}: performance=${lhr.categories.performance?.score}, accessibility=${lhr.categories.accessibility?.score}\n`,
    );
  }
  mkdirSync('docs/measurements', { recursive: true });
  writeFileSync(
    process.env.SOCHAT_AUDIT_OUT ?? 'docs/measurements/lighthouse.json',
    JSON.stringify(
      {
        scope:
          'Two single local mobile simulated-throttling runs, authenticated synthetic data, production Vite preview; not hosted performance or manual accessibility certification.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  if (token)
    await api.delete(base + '/api/me', {
      headers: { 'X-CSRF-Token': token },
    });
  await browser.close();
}
