import { URL } from 'node:url';
import { expect, it } from 'vitest';
import {
  validateDatabases,
  pgEnvironment,
  safeDiagnostic,
} from './restore-rehearsal.mjs';
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

it('uses verified system trust for remote TLS without changing local non-TLS rehearsal', () => {
  const [source, target] = validateDatabases(
    'postgres://u:p@remote/live?sslmode=require',
    'postgres://u:p@remote/sochat_restore_a?sslmode=verify-ca',
  );
  expect(source.searchParams.get('sslmode')).toBe('verify-full');
  expect(target.searchParams.get('sslmode')).toBe('verify-full');
  const env = pgEnvironment(source);
  expect(env.PGSSLMODE).toBe('verify-full');
  expect(env.PGSSLROOTCERT).toBeTruthy();
  const local = pgEnvironment(new URL('postgres://u:p@localhost/test'));
  expect(local.PGSSLMODE).toBe('disable');
  expect(local.PGSSLROOTCERT).toBe('');
});
it('reports failure phase and reason without copying credentials or stderr', () => {
  const result = safeDiagnostic('dump', {
    stderr:
      'connection postgresql://user:private@host/db: root certificate file /private/root.crt does not exist',
  });
  expect(result).toEqual({ stage: 'dump', reason: 'missing_root_certificate' });
  expect(JSON.stringify(result)).not.toContain('private');
});
