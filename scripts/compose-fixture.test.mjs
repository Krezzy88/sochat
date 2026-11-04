import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resetSyntheticComposeLimiter } from '../e2e/compose-fixture.ts';
vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it('does not touch Docker or any database without explicit fixture opt-in', () => {
  vi.stubEnv('SOCHAT_COMPOSE_FIXTURE', undefined);
  resetSyntheticComposeLimiter('https://owner.example.test');
  expect(execFileSync).not.toHaveBeenCalled();
});
it.each(['https://owner.example.test', 'http://localhost:8080'])(
  'rejects non-fixture target %s before database access',
  (base) => {
    vi.stubEnv('SOCHAT_COMPOSE_FIXTURE', 'sochat-ci');
    expect(() => resetSyntheticComposeLimiter(base)).toThrow('restricted');
    expect(execFileSync).not.toHaveBeenCalled();
  },
);
it('rejects a container whose Compose project label is not the disposable fixture', () => {
  vi.stubEnv('SOCHAT_COMPOSE_FIXTURE', 'sochat-ci');
  vi.mocked(execFileSync).mockReturnValue('sochat-demo\n');
  expect(() => resetSyntheticComposeLimiter('http://localhost:18080')).toThrow(
    'Unexpected',
  );
  expect(execFileSync).toHaveBeenCalledTimes(1);
});
