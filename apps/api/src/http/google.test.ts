import { afterEach, expect, it, vi } from 'vitest';
import { startGoogle } from './google.ts';
afterEach(() => vi.unstubAllEnvs());
it('requires explicit Google configuration', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', '');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
  await expect(
    startGoogle('https://app.example.test', new Date(), null),
  ).rejects.toMatchObject({ status: 503 });
});
it('creates short-lived state, nonce and PKCE without offline or Gmail access', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'synthetic-client');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'synthetic-secret');
  const now = new Date('2026-11-04T00:00:00Z');
  const first = await startGoogle('https://app.example.test', now, '123');
  const second = await startGoogle('https://app.example.test', now, null);
  const url = new URL(first.url);
  expect(url.origin).toBe('https://accounts.google.com');
  expect(url.searchParams.get('redirect_uri')).toBe(
    'https://app.example.test/api/auth/google/callback',
  );
  expect(url.searchParams.get('scope')?.split(' ').sort()).toEqual([
    'email',
    'openid',
    'profile',
  ]);
  expect(url.searchParams.get('access_type')).toBe('online');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('code_challenge')).toBeTruthy();
  expect(first.flow.state).not.toBe(second.flow.state);
  expect(first.flow.nonce).not.toBe(second.flow.nonce);
  expect(first.flow.expires).toBe(now.getTime() + 600000);
  expect(first.flow.linkUser).toBe('123');
  expect(first.url).not.toContain(first.flow.verifier);
});
