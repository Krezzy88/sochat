import { it, expect } from 'vitest';
import { writeOperationalLog } from './log.ts';
it('does not serialize message, account, password or credential fields from a runtime event', () => {
  const lines: string[] = [];
  const event = {
    latency_ms: 12,
    input_tokens: 4,
    output_tokens: 2,
    total_tokens: 6,
    outcome: 'success' as const,
    message: 'private-message',
    email: 'private@example.test',
    password: 'private-password',
    apiKey: 'private-key',
    userId: 'private-user',
  };
  writeOperationalLog(event, (line) => lines.push(line));
  expect(JSON.parse(lines[0]!)).toEqual({
    latency_ms: 12,
    input_tokens: 4,
    output_tokens: 2,
    total_tokens: 6,
    outcome: 'success',
  });
  expect(lines.join('')).not.toContain('private');
});
