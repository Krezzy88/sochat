import { expect, it } from 'vitest';
import { validateDatabases } from './restore-rehearsal.mjs';
it('requires a dedicated restore database and refuses the source database', () => {
  expect(() =>
    validateDatabases(
      'postgres://u:p@localhost/live',
      'postgres://u:p@localhost/live',
    ),
  ).toThrow();
  expect(() =>
    validateDatabases(
      'postgres://u:p@localhost/sochat_restore_a',
      'postgres://u:p@localhost/sochat_restore_a',
    ),
  ).toThrow();
  expect(() =>
    validateDatabases(
      'postgres://u:p@localhost/live',
      'postgres://u:p@remote/sochat_restore_a?sslmode=disable',
    ),
  ).toThrow();
  expect(
    validateDatabases(
      'postgres://u:p@localhost/live',
      'postgres://u:p@localhost/sochat_restore_a',
    ),
  ).toHaveLength(2);
});
