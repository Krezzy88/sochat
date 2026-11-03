import { expect, it } from 'vitest';
import { safeNote, cosine, keyword } from './semantic.ts';
it('removes explicit numbers, email, links and common API keys before embedding', () => {
  const text = safeNote(
    'cà phê 50.000 đồng test@example.com https://bank.test/123 AIzaabcdef123',
  );
  expect(text).not.toMatch(/50|000|@|https|AIza/);
  expect(text).toContain('cà phê');
});
it('computes cosine and lexical scores locally, including zero vectors', () => {
  expect(cosine([1, 0], [1, 0])).toBe(1);
  expect(cosine([1, 0], [0, 1])).toBe(0);
  expect(cosine([0, 0], [1, 1])).toBe(0);
  expect(keyword('cà phê', 'Mua cà phê')).toBe(1);
});
