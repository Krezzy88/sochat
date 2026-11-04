// Explicit opt-in for the disposable sochat-ci stack only. Never an app endpoint.
import { execFileSync } from 'node:child_process';
import process from 'node:process';
export function resetSyntheticComposeLimiter(baseURL: string | undefined) {
  const fixture = process.env.SOCHAT_COMPOSE_FIXTURE;
  if (!fixture) return;
  if (fixture !== 'sochat-ci' || baseURL !== 'http://localhost:18080')
    throw Error(
      'Limiter fixture is restricted to disposable sochat-ci on localhost:18080',
    );
  const project = execFileSync(
    'docker',
    [
      'inspect',
      '--format',
      '{{ index .Config.Labels "com.docker.compose.project" }}',
      'sochat-ci-db-1',
    ],
    { encoding: 'utf8' },
  ).trim();
  if (project !== 'sochat-ci')
    throw Error('Unexpected Compose database project');
  execFileSync(
    'docker',
    [
      'exec',
      'sochat-ci-db-1',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'sochat_demo',
      '-d',
      'sochat_demo',
      '-c',
      'DELETE FROM api_rate_limits WHERE user_id IS NULL',
    ],
    { stdio: 'pipe' },
  );
}
