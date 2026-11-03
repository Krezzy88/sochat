import process from 'node:process';
import type { CallLog } from './hybrid.ts';
export function writeOperationalLog(
  event: CallLog,
  write: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
) {
  const { latency_ms, input_tokens, output_tokens, total_tokens, outcome } =
    event;
  write(
    JSON.stringify({
      latency_ms,
      input_tokens,
      output_tokens,
      total_tokens,
      outcome,
    }) + '\n',
  );
}
