import assert from 'node:assert/strict';
import process from 'node:process';
const fetch = globalThis.fetch;
const base = process.env.SOCHAT_DEMO_URL ?? 'http://localhost:18080';
const page = await fetch(base);
assert.equal(page.status, 200, 'web serves successfully');
assert.match(await page.text(), /<div id="root"><\/div>/);
const csrf = await fetch(base + '/api/auth/csrf');
assert.equal(csrf.status, 200, 'web proxies API successfully');
assert.ok(
  csrf.headers.get('set-cookie')?.includes('HttpOnly'),
  'API session cookie survives proxy',
);
assert.match((await csrf.json()).csrf_token, /^[0-9a-f]{64}$/);
process.stdout.write('Compose web/API/session proxy smoke passed.\n');
